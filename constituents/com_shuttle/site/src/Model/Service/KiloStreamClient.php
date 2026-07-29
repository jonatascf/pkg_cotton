<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Shuttle\Site\Model\Service;

defined('_JEXEC') or die;

use InvalidArgumentException;

/**
 * Cliente de streaming real para a API KILO.
 *
 * Consome SSE (Server-Sent Events) diretamente da API KILO via cURL,
 * repassando chunks e eventos para callbacks do consumidor.
 */
class KiloStreamClient
{
	private string $baseUrl;

	private int $connectTimeout;

	private int $readTimeout;

	private string $lastErrorMessage = '';

	/**
	 * @param  string  $baseUrl
	 * @param  int  $connectTimeout
	 * @param  int  $readTimeout
	 */
	public function __construct(string $baseUrl = 'https://api.kilo.ai/api/gateway', int $connectTimeout = 15, int $readTimeout = 60)
	{
		$this->baseUrl = rtrim($baseUrl, '/');
		$this->connectTimeout = $connectTimeout;
		$this->readTimeout = $readTimeout;
	}

	/**
	 * Envia requisição de chat e consome o SSE stream.
	 *
	 * @param  array  $payload
	 * @param  string  $apiKey
	 * @param  callable|null  $onTextChunk  function (string $delta): void
	 * @param  callable|null  $onToolCallDelta  function (array $delta): void
	 * @param  callable|null  $onFinishReason  function (string $reason): void
	 * @param  callable|null  $onUsage  function (array $usage): void
	 * @param  callable|null  $onError  function (string $message, ?array $debug): void
	 * @param  callable|null  $shouldStop  function (): bool
	 * @return array|null  Metadados finais ou null em erro de conexão.
	 */
	public function streamChat(
		array $payload,
		string $apiKey,
		?callable $onTextChunk = null,
		?callable $onReasoningChunk = null,
		?callable $onToolCallDelta = null,
		?callable $onFinishReason = null,
		?callable $onUsage = null,
		?callable $onError = null,
		?callable $shouldStop = null
	): ?array {
		if (empty($apiKey)) {
			if ($onError) {
				$onError('Missing API key', null);
			}
			return null;
		}

		$endpoint = $this->baseUrl . '/chat/completions';
		$body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

		if ($body === false) {
			if ($onError) {
				$onError('Failed to encode payload', ['json_error' => json_last_error_msg()]);
			}
			return null;
		}

		$ch = curl_init($endpoint);

		if ($ch === false) {
			if ($onError) {
				$onError('Failed to initialize cURL', null);
			}
			return null;
		}

		$headers = [
			'Content-Type: application/json',
			'Authorization: Bearer ' . $apiKey,
			'Accept: text/event-stream',
		];

		curl_setopt_array($ch, [
			CURLOPT_POST => true,
			CURLOPT_POSTFIELDS => $body,
			CURLOPT_HTTPHEADER => $headers,
			CURLOPT_RETURNTRANSFER => false,
			CURLOPT_HEADER => false,
			CURLOPT_CONNECTTIMEOUT => $this->connectTimeout,
			CURLOPT_TIMEOUT => $this->readTimeout,
			CURLOPT_WRITEFUNCTION => function ($ch, $data) use (
				$onTextChunk,
				$onReasoningChunk,
				$onToolCallDelta,
				$onFinishReason,
				$onUsage,
				$onError,
				$shouldStop
			) {
				static $buffer = '';
				static $currentEvent = 'message';
				static $eventData = '';
				static $currentToolCalls = [];
				static $currentId = null;
				static $currentName = null;
				static $usage = null;
				static $finishReason = null;
				static $lastErrorMessage = '';

				if ($shouldStop !== null && $shouldStop()) {
					return 0;
				}

				$buffer .= $data;

				$lines = explode("\n", $buffer);
				$buffer = array_pop($lines);

				foreach ($lines as $line) {
					$trimmed = rtrim($line, "\r");

					if ($trimmed === '') {
						if ($eventData !== '') {
							$this->dispatchEvent(
								$currentEvent,
								$eventData,
								[
									'onTextChunk' => $onTextChunk,
									'onReasoningChunk' => $onReasoningChunk,
									'onToolCallDelta' => $onToolCallDelta,
									'onFinishReason' => $onFinishReason,
									'onUsage' => $onUsage,
									'onError' => $onError,
								],
								$currentToolCalls,
								$usage,
								$finishReason
							);
						}

						$currentEvent = 'message';
						$eventData = '';
						continue;
					}

					if (str_starts_with($trimmed, ':')) {
						continue;
					}

					if (str_starts_with($trimmed, 'event:')) {
						$currentEvent = trim(substr($trimmed, 6));
						continue;
					}

					if (str_starts_with($trimmed, 'data:')) {
						$raw = substr($trimmed, 5);
						if (str_starts_with($raw, ' ')) {
							$raw = substr($raw, 1);
						}

						if ($raw === '[DONE]') {
							if ($onFinishReason) {
								$onFinishReason($finishReason ?? 'stop');
							}
							if ($onUsage && $usage !== null) {
								$onUsage($usage);
							}
							continue;
						}

						$eventData .= $raw;
						continue;
					}

					if (str_starts_with($trimmed, 'id:')) {
						$currentId = trim(substr($trimmed, 3));
						continue;
					}

					if (str_starts_with($trimmed, 'retry:')) {
						continue;
					}

					if ($eventData !== '') {
						$eventData .= "\n" . $trimmed;
					}
				}

				if ($eventData !== '') {
					$this->dispatchEvent(
						$currentEvent,
						$eventData,
						[
							'onTextChunk' => $onTextChunk,
							'onReasoningChunk' => $onReasoningChunk,
							'onToolCallDelta' => $onToolCallDelta,
							'onFinishReason' => $onFinishReason,
							'onUsage' => $onUsage,
							'onError' => $onError,
						],
						$currentToolCalls,
						$usage,
						$finishReason
					);
				}

				return strlen($data);
		},
		CURLOPT_FOLLOWLOCATION => true,
			CURLOPT_MAXREDIRS => 3,
		]);

		curl_exec($ch);

		$curlError = curl_error($ch);
		$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		if ($curlError !== '') {
			return [
				'success' => false,
				'error' => 'cURL error: ' . $curlError,
				'http_code' => $httpCode,
				'usage' => $usage ?? null,
				'finish_reason' => $finishReason ?? null,
			];
		}

		$hasStreamingError = $this->lastErrorMessage !== '';

		if ($httpCode === 402) {
			$message = $hasStreamingError
				? $this->lastErrorMessage
				: 'Payment required or credits exhausted on the KILO gateway. Check your plan or API key.';
			$this->lastErrorMessage = '';
			return [
				'success' => false,
				'error' => $message,
				'http_code' => $httpCode,
				'usage' => $usage ?? null,
				'finish_reason' => $finishReason ?? null,
			];
		}

		if ($httpCode >= 400) {
			$message = $hasStreamingError
				? $this->lastErrorMessage
				: ('HTTP error: ' . $httpCode);
			$this->lastErrorMessage = '';
			return [
				'success' => false,
				'error' => $message,
				'http_code' => $httpCode,
				'usage' => $usage ?? null,
				'finish_reason' => $finishReason ?? null,
			];
		}

		$this->lastErrorMessage = '';

		return [
			'success' => !$hasStreamingError,
			'error' => $hasStreamingError ? $this->lastErrorMessage : null,
			'http_code' => $httpCode,
			'usage' => $usage ?? null,
			'finish_reason' => $finishReason ?? null,
		];
	}

	private function dispatchEvent(string $event, string $rawData, array $callbacks, array &$toolCalls, ?array &$usage, ?string &$finishReason): void
	{
		$decoded = json_decode($rawData, true);

		if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
			return;
		}

		if (!is_array($decoded)) {
			return;
		}

		if (isset($decoded['error'])) {
			$message = is_string($decoded['error']) ? $decoded['error'] : ($decoded['error']['message'] ?? json_encode($decoded['error']));
			$this->lastErrorMessage = $message;
			return;
		}

		if (isset($decoded['usage'])) {
			$usage = $decoded['usage'];
		}

		if (isset($decoded['finish_reason'])) {
			$finishReason = $decoded['finish_reason'];
		}

		$choices = $decoded['choices'] ?? [];
		if (!empty($choices)) {
			$choice = $choices[0];
			$delta = $choice['delta'] ?? [];

			if (isset($delta['reasoning'])) {
				if ($callbacks['onReasoningChunk']) {
					$callbacks['onReasoningChunk']((string) $delta['reasoning']);
				}
			}

			if (isset($delta['content'])) {
				if ($callbacks['onTextChunk']) {
					$callbacks['onTextChunk']((string) $delta['content']);
				}
			} elseif (isset($choice['text'])) {
				if ($callbacks['onTextChunk']) {
					$callbacks['onTextChunk']((string) $choice['text']);
				}
			}

			if (isset($delta['tool_calls'])) {
				if ($callbacks['onToolCallDelta']) {
					$callbacks['onToolCallDelta']($delta['tool_calls']);
				}
			}

			if (isset($choice['finish_reason'])) {
				$finishReason = $choice['finish_reason'];
			}
		}
	}
}
