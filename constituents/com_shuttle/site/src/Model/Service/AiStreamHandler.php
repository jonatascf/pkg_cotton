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
 * Gerencia o fluxo de streaming de AI com suporte a tool calls.
 *
 * Responsável por:
 * - Montar o payload da API KILO a partir de argumentos MCP.
 * - Consumir o stream via KiloStreamClient.
 * - Detectar e executar tool calls durante o stream.
 * - Re-emitir eventos SSE estruturados para o frontend via callback.
 */
class AiStreamHandler
{
	protected CommandInterpreter $interpreter;

	protected ShuttleMCPServer $mcpServer;

	protected KiloStreamClient $streamClient;

	protected int $maxToolRounds;

	protected int $maxTokens;

	protected float $temperature;

	public function __construct(
		?CommandInterpreter $interpreter = null,
		?ShuttleMCPServer $mcpServer = null,
		?KiloStreamClient $streamClient = null
	) {
		$this->interpreter = $interpreter ?? new CommandInterpreter();
		$this->mcpServer = $mcpServer ?? new ShuttleMCPServer();
		$this->streamClient = $streamClient ?? new KiloStreamClient();
		$this->maxToolRounds = 5;
		$this->maxTokens = 4096;
		$this->temperature = 0.3;
	}

	/**
	 * Processa uma requisição de streaming AI.
	 *
	 * @param  array  $arguments
	 *   Espera chaves: prompt, model, mode, mcp-tools, mcp-resources, mcp-prompts, conversation
	 * @param  string  $cwd
	 * @param  callable  $onSseEvent  function (string $event, array $data): void
	 * @param  callable|null  $shouldStop  function (): bool
	 * @return array|null
	 */
	public function handleStream(array $arguments, string $cwd, callable $onSseEvent, ?callable $shouldStop = null): ?array
	{
		$prompt = (string) ($arguments['prompt'] ?? '');
		$model = (string) ($arguments['model'] ?? 'kilo-auto/free');
		$mode = (string) ($arguments['mode'] ?? 'code');
		$mcpTools = (array) ($arguments['mcp-tools'] ?? []);
		$mcpResources = (array) ($arguments['mcp-resources'] ?? []);
		$mcpPrompts = (array) ($arguments['mcp-prompts'] ?? []);
		$conversationHistory = (array) ($arguments['conversation'] ?? []);

		$apiKey = ShuttleJwtMiddleware::getUserApiKey();
		$baseUrl = 'https://api.kilo.ai/api/gateway';

		if ($apiKey === '') {
			$this->emitError($onSseEvent, 'Missing API key. Configure kilocode-api-key in your profile or set KILO_API_KEY.');
			return null;
		}

		if ($prompt === '' && empty($conversationHistory)) {
			$this->emitError($onSseEvent, 'ai requires a prompt');
			return null;
		}

		$systemPrompt = $this->interpreter->buildAiSystemPrompt($mode, $mcpTools, $mcpResources, $mcpPrompts);
		$messages = $this->buildMessages($systemPrompt, $conversationHistory, $prompt);

		$toolsPayload = $this->buildToolsPayload($mcpTools);

		$streamResult = $this->runStreamLoop(
			$model,
			$messages,
			$toolsPayload,
			$apiKey,
			$baseUrl,
			$onSseEvent,
			$shouldStop
		);

		return $streamResult;
	}

	private function buildMessages(string $systemPrompt, array $conversationHistory, string $prompt): array
	{
		$messages = [
			['role' => 'system', 'content' => $systemPrompt],
		];

		foreach ($conversationHistory as $entry) {
			if (!isset($entry['role'])) {
				continue;
			}

			$role = $entry['role'];

			if ($role === 'assistant' && !empty($entry['tool_calls'])) {
				$messages[] = [
					'role' => 'assistant',
					'content' => $entry['content'] ?? null,
					'tool_calls' => $entry['tool_calls'],
				];
				continue;
			}

			if ($role === 'tool' && !empty($entry['tool_call_id'])) {
				$messages[] = [
					'role' => 'tool',
					'tool_call_id' => $entry['tool_call_id'],
					'content' => $entry['content'] ?? '',
				];
				continue;
			}

			if (!isset($entry['content'])) {
				continue;
			}

			$messages[] = [
				'role' => $role,
				'content' => $entry['content'],
			];
		}

		$lastEntry = $conversationHistory[count($conversationHistory) - 1] ?? null;
		$isDuplicatePrompt = $lastEntry
			&& $lastEntry['role'] === 'user'
			&& isset($lastEntry['content'])
			&& $lastEntry['content'] === $prompt;

		if (!$isDuplicatePrompt) {
			$messages[] = ['role' => 'user', 'content' => $prompt];
		}

		return $messages;
	}

	private function buildToolsPayload(array $mcpTools): array
	{
		$toolsPayload = [];

		foreach ($mcpTools as $tool) {
			if (!isset($tool['name']) || !isset($tool['description'])) {
				continue;
			}

			$function = [
				'name' => $tool['name'],
				'description' => $tool['description'],
			];

			if (!empty($tool['inputSchema'])) {
				$function['parameters'] = $tool['inputSchema'];
			}

			$toolsPayload[] = [
				'type' => 'function',
				'function' => $function,
			];
		}

		return $toolsPayload;
	}

	private function runStreamLoop(
		string $model,
		array $messages,
		array $toolsPayload,
		string $apiKey,
		string $baseUrl,
		callable $onSseEvent,
		?callable $shouldStop
	): ?array {
		$finalOutput = '';
		$finalToolCalls = [];
		$finalToolResults = [];
		$currentMessages = $messages;
		$allText = '';

		for ($round = 0; $round < $this->maxToolRounds; $round++) {
		$payload = [
			'model' => $model,
			'messages' => $currentMessages,
			'temperature' => $this->temperature,
			'max_tokens' => $this->maxTokens,
			'stream' => true,
		];

		if (!empty($toolsPayload)) {
			$payload['tools'] = $toolsPayload;
		}

			$roundText = '';
			$roundToolCalls = [];
			$finishReason = null;

		$onText = function (string $delta) use ($onSseEvent, &$roundText, &$allText): void {
			$roundText .= $delta;
			$allText .= $delta;
			$this->emit($onSseEvent, 'message', ['content' => $delta]);
		};

		$onReasoning = function (string $delta) use ($onSseEvent): void {
			$this->emit($onSseEvent, 'reasoning', ['content' => $delta]);
		};

		$onToolDelta = function (array $deltas) use ($onSseEvent, &$roundToolCalls): void {
				foreach ($deltas as $delta) {
					$index = (int) ($delta['index'] ?? 0);

					if (!isset($roundToolCalls[$index])) {
						$roundToolCalls[$index] = [
							'id' => $delta['id'] ?? uniqid('call_', true),
							'type' => $delta['type'] ?? 'function',
							'function' => [
								'name' => '',
								'arguments' => '',
							],
						];

						$this->emit($onSseEvent, 'tool_call', [
							'type' => 'tool_call_start',
							'id' => $roundToolCalls[$index]['id'],
							'name' => '',
							'arguments' => '',
						]);
					}

					$call = &$roundToolCalls[$index];

					if (isset($delta['function']['name'])) {
						$call['function']['name'] .= $delta['function']['name'];
						$this->emit($onSseEvent, 'tool_call', [
							'type' => 'tool_call_delta',
							'id' => $call['id'],
							'name' => $delta['function']['name'],
							'arguments' => '',
						]);
					}

					if (isset($delta['function']['arguments'])) {
						$argsDelta = (string) $delta['function']['arguments'];
						$call['function']['arguments'] .= $argsDelta;

						$this->emit($onSseEvent, 'tool_call', [
							'type' => 'tool_call_delta',
							'id' => $call['id'],
							'name' => '',
							'arguments' => $argsDelta,
						]);
					}
				}
			};

			$onFinish = function (string $reason) use ($onSseEvent, &$finishReason): void {
				$finishReason = $reason;
				$this->emit($onSseEvent, 'message', ['content' => '', 'finish_reason' => $reason]);
			};

			$onUsage = function (array $usage) use ($onSseEvent): void {
				$this->emit($onSseEvent, 'usage', $usage);
			};

			$onStreamError = function (string $message, ?array $debug = null) use ($onSseEvent): void {
				$this->emitError($onSseEvent, $message, $debug);
			};

		$metadata = $this->streamClient->streamChat(
			$payload,
			$apiKey,
			$onText,
			$onReasoning,
			$onToolDelta,
			$onFinish,
			$onUsage,
			$onStreamError,
			$shouldStop
		);

		if ($metadata === null || empty($metadata['success'])) {
			$errorMessage = $metadata['error'] ?? 'Stream interrupted or failed';

			if (!empty($metadata['http_code'])) {
				$errorMessage .= ' (HTTP ' . $metadata['http_code'] . ')';
			}

			$this->emitError($onSseEvent, $errorMessage);
			$this->emit($onSseEvent, 'done', [
				'message' => 'Stream failed',
				'success' => false,
				'output' => $allText,
				'tool_calls' => $roundToolCalls,
				'tool_results' => [],
			]);

			return [
				'success' => false,
				'output' => $allText,
				'error' => $errorMessage,
				'tool_calls' => $roundToolCalls,
				'tool_results' => [],
			];
		}

			if ($finishReason === null) {
				$finishReason = $metadata['finish_reason'] ?? 'stop';
			}

			foreach ($roundToolCalls as $call) {
				$this->emit($onSseEvent, 'tool_call', [
					'type' => 'tool_call_stop',
					'id' => $call['id'],
					'name' => $call['function']['name'],
					'arguments' => $call['function']['arguments'],
				]);
			}

			if (empty($roundToolCalls)) {
				$finalOutput = $roundText;
				break;
			}

			if (connection_aborted()) {
				$this->emitError($onSseEvent, 'Client disconnected');
				break;
			}

			$assistantMessage = [
				'role' => 'assistant',
				'content' => $roundText ?: null,
				'tool_calls' => array_values($roundToolCalls),
			];
			$currentMessages[] = $assistantMessage;
			$finalToolCalls = array_merge($finalToolCalls, $roundToolCalls);

			if (connection_aborted()) {
				$this->emitError($onSseEvent, 'Client disconnected');
				break;
			}

			$toolResults = $this->executeToolCalls($roundToolCalls, $cwd);

			foreach ($toolResults as $result) {
				$toolMessage = [
					'role' => 'tool',
					'tool_call_id' => $result['id'],
					'content' => $result['output'] ?? json_encode($result),
				];
				$currentMessages[] = $toolMessage;
			}

			$finalToolResults = array_merge($finalToolResults, $toolResults);

			foreach ($toolResults as $result) {
				$this->emit($onSseEvent, 'tool_result', [
					'id' => $result['id'],
					'name' => $result['name'],
					'success' => $result['success'] ?? false,
					'output' => $result['output'] ?? '',
					'error' => $result['error'] ?? null,
					'metadata' => $result['metadata'] ?? [],
				]);
			}
		}

		$this->emit($onSseEvent, 'done', [
			'message' => 'Stream completed',
			'success' => true,
			'output' => $finalOutput,
			'tool_calls' => $finalToolCalls,
			'tool_results' => $finalToolResults,
		]);

		return [
			'success' => true,
			'output' => $finalOutput,
			'tool_calls' => $finalToolCalls,
			'tool_results' => $finalToolResults,
		];
	}

	private function executeToolCalls(array $toolCalls, ?string $cwd = null): array
	{
		$cwd = $cwd ?? '/';
		$results = [];

		foreach ($toolCalls as $call) {
			$id = (string) ($call['id'] ?? uniqid('tool_', true));
			$name = (string) ($call['function']['name'] ?? '');
			$argumentsRaw = $call['function']['arguments'] ?? '{}';

			if (is_array($argumentsRaw)) {
				$args = $argumentsRaw;
			} else {
				$args = json_decode((string) $argumentsRaw, true);
			}
			if (!is_array($args)) {
				$args = [];
			}

			if ($name === '') {
				$results[] = [
					'id' => $id,
					'name' => $name,
					'success' => false,
					'output' => 'Empty tool name',
					'error' => 'Empty tool name',
				];
				continue;
			}

			try {
				$mcpResult = $this->mcpServer->callTool($name, $args);

				if (isset($mcpResult['error'])) {
					$results[] = [
						'id' => $id,
						'name' => $name,
						'arguments' => $args,
						'success' => false,
						'output' => $mcpResult['error']['message'] ?? 'Unknown error',
						'error' => $mcpResult['error']['message'] ?? 'Unknown error',
						'code' => $mcpResult['error']['code'] ?? null,
					];
					continue;
				}

				$content = $mcpResult['result']['content'][0]['text'] ?? json_encode($mcpResult);
				$isError = !empty($mcpResult['result']['isError']);
				$parsed = json_decode($content, true);

				$output = $content;
				if (is_array($parsed) && isset($parsed['output'])) {
					$output = (string) $parsed['output'];
				}

				$results[] = [
					'id' => $id,
					'name' => $name,
					'arguments' => $args,
					'success' => !$isError,
					'output' => $output,
					'error' => $isError ? ($parsed['error'] ?? null) : null,
					'metadata' => $mcpResult['result']['metadata'] ?? [],
				];
			} catch (\Throwable $e) {
				$results[] = [
					'id' => $id,
					'name' => $name,
					'arguments' => $args,
					'success' => false,
					'output' => $e->getMessage(),
					'error' => $e->getMessage(),
				];
			}
		}

		return $results;
	}

	private function emit(callable $onSseEvent, string $event, array $data): void
	{
		if ($onSseEvent) {
			$onSseEvent($event, $data);
		}
	}

	private function emitError(callable $onSseEvent, string $message, ?array $debug = null): void
	{
		$payload = ['error' => ['message' => $message]];

		if ($debug !== null) {
			$payload['debug'] = $debug;
		}

		$this->emit($onSseEvent, 'error', $payload);
	}
}
