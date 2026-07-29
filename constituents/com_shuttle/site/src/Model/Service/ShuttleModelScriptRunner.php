<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Shuttle\Site\Model\Service;

\defined('_JEXEC') or die;

use InvalidArgumentException;
use Joomla\CMS\Language\Text;

class ShuttleModelScriptRunner
{
	protected CottonBridge $cottonBridge;
	protected CommandInterpreter $interpreter;

	public function __construct(CottonBridge $cottonBridge = null, CommandInterpreter $interpreter = null)
	{
		$this->cottonBridge = $cottonBridge ?? new CottonBridge();
		$this->interpreter = $interpreter ?? new CommandInterpreter($this->cottonBridge);
	}

	public function runScript(string $identifier, string $cwd, array $options = []): array
	{
		$scriptFile = $this->resolveScriptFile($identifier);
		if ($scriptFile === null) {
			return ['error' => Text::_('COM_SHUTTLE_SCRIPT_NOT_FOUND') . ': ' . $identifier];
		}

		if (!$this->isAllowedScript($scriptFile)) {
			return ['error' => Text::_('COM_SHUTTLE_INVALID_SCRIPT_TYPE') . ': ' . ($scriptFile['name'] ?? 'unknown')];
		}

		$content = $this->getFileContent($scriptFile);
		if ($content === null) {
			return ['error' => 'Unable to read script content'];
		}

		$lines = preg_split('/\r\n|\r|\n/', $content);
		$ignoreErrors = false;
		$steps = [];
		$currentCwd = $cwd;
		$dryRun = !empty($options['dryRun']);
		$verbose = !empty($options['verbose']);
		$startLine = !empty($options['startLine']) && ctype_digit($options['startLine']) ? (int) $options['startLine'] : null;
		$endLine = !empty($options['endLine']) && ctype_digit($options['endLine']) ? (int) $options['endLine'] : null;

		foreach ($lines as $index => $rawLine) {
			$lineNumber = $index + 1;

			if ($startLine !== null && $lineNumber < $startLine) {
				continue;
			}

			if ($endLine !== null && $lineNumber > $endLine) {
				break;
			}

			$line = trim($rawLine);

			if ($this->isEmptyOrComment($line)) {
				continue;
			}

			if ($directive = $this->parseDirective($line)) {
				if ($directive['name'] === 'ignore_errors') {
					$ignoreErrors = filter_var($directive['value'], FILTER_VALIDATE_BOOLEAN);
				}
				continue;
			}

			if ($dryRun) {
				$step = [
					'line_number' => $lineNumber,
					'raw_line' => $rawLine,
					'command' => $line,
					'cwd_before' => $currentCwd,
					'status' => 'dry-run',
					'output' => $verbose ? Text::_('COM_SHUTTLE_DRY_RUN') . ' ' . $line : '',
					'error' => null,
				];
				$steps[] = $step;
				continue;
			}

			$result = $this->interpreter->execute($line, $currentCwd);

			if (isset($result['path'])) {
				$currentCwd = $result['path'];
			} elseif (isset($result['data']['path'])) {
				$currentCwd = $result['data']['path'];
			}

			$step = [
				'line_number' => $lineNumber,
				'raw_line' => $rawLine,
				'command' => $line,
				'cwd_before' => $currentCwd,
				'status' => isset($result['error']) ? 'error' : 'ok',
				'output' => $result['output'] ?? '',
				'error' => $result['error'] ?? null,
			];

			$steps[] = $step;

			if (isset($result['error']) && !$ignoreErrors) {
				return [
					'command' => 'run',
					'script' => [
						'id' => $scriptFile['id'],
						'name' => $scriptFile['name'],
						'path' => $scriptFile['path'],
					],
					'completed' => false,
					'failed_at' => $lineNumber,
					'ignore_errors' => $ignoreErrors,
					'error' => $result['error'],
					'steps' => $steps,
				];
			}
		}

		return [
			'command' => 'run',
			'script' => [
				'id' => $scriptFile['id'],
				'name' => $scriptFile['name'],
				'path' => $scriptFile['path'],
			],
			'completed' => true,
			'failed_at' => null,
			'ignore_errors' => $ignoreErrors,
			'steps' => $steps,
		];
	}

	protected function resolveScriptFile(string $identifier): ?array
	{
		if (is_numeric($identifier)) {
			$file = $this->cottonBridge->getById((int) $identifier);
		} else {
			$file = $this->cottonBridge->readFileByPath($identifier);
		}

		if ($file === null) {
			return null;
		}

		return [
			'id' => (int) $file->id,
			'name' => $file->name ?? '',
			'path' => $file->path ?? '',
			'extension' => strtolower(pathinfo($file->name ?? '', PATHINFO_EXTENSION)),
			'file_data' => $file->file_data ?? null,
		];
	}

	protected function getFileContent(array $scriptFile): ?string
	{
		return $scriptFile['file_data'] ?? null;
	}

	protected function isAllowedScript(array $scriptFile): bool
	{
		return ($scriptFile['extension'] ?? '') === 'shuttle';
	}

	protected function isEmptyOrComment(string $line): bool
	{
		return $line === '' || str_starts_with($line, '#') || str_starts_with($line, '//');
	}

	protected function parseDirective(string $line): ?array
	{
		if (preg_match('/^set\s+([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*(.+)$/', $line, $matches)) {
			return [
				'name' => $matches[1],
				'value' => trim($matches[2]),
			];
		}

		return null;
	}
}
