<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Shuttle\Site\Model\Service;

defined('_JEXEC') or die;

/**
 * Structured error types and exception class for tool execution failures.
 *
 * Allows the LLM to make intelligent decisions based on error type
 * (e.g., retry on network errors, fix parameters on validation errors).
 */
class ToolException extends \RuntimeException
{
	public const VALIDATION = 'validation';
	public const PERMISSION = 'permission';
	public const NETWORK = 'network';
	public const NOT_FOUND = 'not_found';
	public const TIMEOUT = 'timeout';
	public const EXECUTION = 'execution';
	public const CONFLICT = 'conflict';
	public const RATE_LIMIT = 'rate_limit';

	private string $errorType;
	private ?string $field;
	private array $context;

	public function __construct(
		string $message,
		string $errorType = self::EXECUTION,
		?string $field = null,
		array $context = [],
		int $code = 0,
		?\Throwable $previous = null
	) {
		parent::__construct($message, $code, $previous);
		$this->errorType = $errorType;
		$this->field = $field;
		$this->context = $context;
	}

	public function getErrorType(): string
	{
		return $this->errorType;
	}

	public function getField(): ?string
	{
		return $this->field;
	}

	public function getContext(): array
	{
		return $this->context;
	}

	public function toArray(): array
	{
		$result = [
			'type' => $this->errorType,
			'message' => $this->getMessage(),
		];

		if ($this->field !== null) {
			$result['field'] = $this->field;
		}

		if (!empty($this->context)) {
			$result['context'] = $this->context;
		}

		return $result;
	}

	public static function validation(string $message, ?string $field = null, array $context = []): self
	{
		return new self($message, self::VALIDATION, $field, $context);
	}

	public static function permission(string $message, array $context = []): self
	{
		return new self($message, self::PERMISSION, null, $context);
	}

	public static function notFound(string $message, array $context = []): self
	{
		return new self($message, self::NOT_FOUND, null, $context);
	}

	public static function network(string $message, array $context = []): self
	{
		return new self($message, self::NETWORK, null, $context);
	}

	public static function timeout(string $message, array $context = []): self
	{
		return new self($message, self::TIMEOUT, null, $context);
	}

	public static function execution(string $message, array $context = []): self
	{
		return new self($message, self::EXECUTION, null, $context);
	}

	public static function conflict(string $message, array $context = []): self
	{
		return new self($message, self::CONFLICT, null, $context);
	}

	public static function rateLimit(string $message, array $context = []): self
	{
		return new self($message, self::RATE_LIMIT, null, $context);
	}

	public static function classify(\Throwable $e): self
	{
		if ($e instanceof self) {
			return $e;
		}

		$message = $e->getMessage();
		$messageLower = strtolower($message);

		if (str_contains($messageLower, 'permission') || str_contains($messageLower, 'denied') || str_contains($messageLower, 'forbidden')) {
			return self::permission($message);
		}

		if (str_contains($messageLower, 'not found') || str_contains($messageLower, 'does not exist') || str_contains($messageLower, 'no such file')) {
			return self::notFound($message);
		}

		if (str_contains($messageLower, 'timeout') || str_contains($messageLower, 'timed out')) {
			return self::timeout($message);
		}

		if (str_contains($messageLower, 'network') || str_contains($messageLower, 'connection') || str_contains($messageLower, 'curl')) {
			return self::network($message);
		}

		if (str_contains($messageLower, 'invalid') || str_contains($messageLower, 'required') || str_contains($messageLower, 'missing')) {
			return self::validation($message);
		}

		return self::execution($message);
	}
}
