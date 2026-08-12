<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Shuttle\Site\Model\Service;

\defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Session\Session;
use InvalidArgumentException;

/**
 * Interpreter de comandos para o Shuttle terminal.
 *
 * @package     Tabaoca.Component.Shuttle.Site
 * @subpackage  com_shuttle
 * @since       2.0.0
 */
class CommandInterpreter
{
	protected CottonBridge $cottonBridge;
	protected $toolCallCallback;

	public function __construct(CottonBridge $cottonBridge = null, callable $toolCallCallback = null)
	{
		$this->cottonBridge = $cottonBridge ?? new CottonBridge();
		$this->toolCallCallback = $toolCallCallback;
	}

	public function setToolCallCallback(callable $callback): void
	{
		$this->toolCallCallback = $callback;
	}

	public function executeTool(string $name, array $arguments): array
	{
		if ($this->toolCallCallback === null) {
			return ['error' => 'Tool callback not configured'];
		}

		return call_user_func($this->toolCallCallback, $name, $arguments);
	}

	/**
	 * Executa um comando raw enviado pelo terminal Shuttle.
	 *
	 * @param  string  $rawCommand
	 * @param  string  $cwd
	 * @param  array   $options
	 * @param  array   $parameters
	 * @return array
	 */
		public function executeAi(array $args, string $cwd): array
	{
		return $this->handleAi($args, $cwd);
	}

public function execute(string $rawCommand, string $cwd, array $options = [], array $parameters = []): array
	{
		$rawCommand = trim($rawCommand);
		if ($rawCommand === '') {
			return ['error' => 'Command cannot be empty'];
		}

		[$command, $rawArgs] = $this->parseCommand($rawCommand);
		$args = !empty($options) || !empty($parameters) ? array_merge($options, $parameters) : $rawArgs;

		if ($validationError = $this->validateCommand($command, $args)) {
			return ['error' => $validationError];
		}

		switch ($command) {
			case 'find':
				return $this->handleFind($args, $cwd);
			case 'grep':
				return $this->handleGrep($args, $cwd);
			case 'cat':
				return $this->handleCat($args, $cwd);
			case 'head':
				return $this->handleHead($args, $cwd);
			case 'tail':
				return $this->handleTail($args, $cwd);
			case 'sed':
				return $this->handleSed($args, $cwd);
			case 'cc-resolve':
				return $this->handleCcResolve($args, $cwd);
			case 'mkdir':
				return $this->handleMkdir($args, $cwd);
			case 'rmdir':
				return $this->handleRmdir($args, $cwd);
			case 'mv':
				return $this->handleMv($args, $cwd);
			case 'cp':
				return $this->handleCp($args, $cwd);
			case 'joomla':
				return $this->handleJoomla($args, $cwd);
			case 'cotton-create':
				return $this->handleCottonCreate($args, $cwd);
			case 'cotton-save':
				return $this->handleCottonSave($args, $cwd);
			case 'cotton-delete':
				return $this->handleCottonDelete($args, $cwd);
			case 'cd':
				return $this->handleCd($args, $cwd);
			case 'ls':
				return $this->handleLs($args, $cwd);
			case 'run':
				return $this->handleRun($args, $cwd);
			case 'ai':
				return $this->executeAi($args, $cwd);
			default:
				return ['error' => Text::_('COM_SHUTTLE_UNKNOWN_COMMAND') . ': "' . $command . '"'];
		}
	}

	protected function parseCommand(string $rawCommand): array
	{
		$tokens = preg_split('/\s+/', trim($rawCommand));
		$command = array_shift($tokens) ?: '';
		return [$command, $tokens];
	}

	protected function validateCommand(string $command, array $args): ?string
	{
		$rules = $this->loadCommandRules();
		if (empty($command)) {
			return 'Command cannot be empty';
		}

		if (!isset($rules[$command])) {
			return Text::_('COM_SHUTTLE_UNKNOWN_COMMAND') . ': "' . $command . '"';
		}

		$rule = $rules[$command];
		$validOptions = array_map(static fn ($opt) => $opt['name'], $rule['options']);
		$validAliases = array_filter(array_map(static fn ($opt) => $opt['alias'] ?? null, $rule['options']));
		$allValidOptions = array_merge($validOptions, $validAliases);

		$parameters = [];
		$options = [];
		$optionValueCount = 0;
		foreach ($args as $arg) {
			if (!str_starts_with($arg, '-')) {
				$parameters[] = $arg;
				continue;
			}

			$optionName = $arg;
			$optionValue = null;
			if (str_contains($arg, '=')) {
				[$optionName, $optionValue] = explode('=', $arg, 2);
			}

			if (!in_array($optionName, $allValidOptions, true)) {
				return Text::_('COM_SHUTTLE_INVALID_OPTION') . ': "' . $optionName . '" ' . Text::_('COM_SHUTTLE_FOR_COMMAND') . ' "' . $command . '"';
			}

			$optionConfig = array_filter($rule['options'], static fn ($opt) => ($opt['name'] === $optionName || ($opt['alias'] ?? null) === $optionName));
			$optionConfig = $optionConfig ? array_shift($optionConfig) : null;
			if ($optionConfig && !empty($optionConfig['hasValue']) && $optionValue !== null) {
				$optionValueCount++;
			}

			$options[] = $arg;
		}

		$count = count($parameters) + $optionValueCount;
		if ($count < ($rule['parameters']['min'] ?? 0)) {
			return Text::_('COM_SHUTTLE_COMMAND_REQUIRES_MIN') . ' ' . $command . ' ' . $rule['parameters']['min'] . ' ' . Text::_('COM_SHUTTLE_PARAMETER_S');
		}

		if (isset($rule['parameters']['max']) && $count > $rule['parameters']['max']) {
			return Text::_('COM_SHUTTLE_COMMAND_ACCEPTS_MAX') . ' ' . $command . ' ' . $rule['parameters']['max'] . ' ' . Text::_('COM_SHUTTLE_PARAMETER_S');
		}

		return null;
	}

	protected function loadCommandRules(): array
	{
		static $rules = null;
		if ($rules !== null) {
			return $rules;
		}

		$path = JPATH_ROOT . '/media/com_shuttle/js/CommandRules.json';
		if (!is_file($path) || !is_readable($path)) {
			return [];
		}

		$content = file_get_contents($path);
		if ($content === false) {
			return [];
		}

		$decoded = json_decode($content, true);
		if (!is_array($decoded)) {
			return [];
		}

		return $rules = $decoded;
	}

	public function getCommandRules(): array
	{
		return $this->loadCommandRules();
	}

	public function handleFind(array $args, string $cwd): array
	{
		$options = [
			'json' => false,
			'type' => null,
			'nameOnly' => false,
			'count' => false,
		];
		$termParts = [];
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-t':
					case '--type':
						$options['type'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-t':
					case '--type':
						$options['type'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-t':
				case '--type':
					$pendingOption = $arg;
					break;
				case '-n':
				case '--name-only':
					$options['nameOnly'] = true;
					break;
				case '-c':
				case '--count':
					$options['count'] = true;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					$termParts[] = $arg;
					break;
			}
		}

		$term = trim(implode(' ', $termParts));
		if ($term === '') {
			return [
				'error' => 'find requires a search term (parametro "query" obrigatorio). Forneca um termo de busca. Se voce quer listar o conteudo de uma pasta, use "ls" ao inves de "find".',
				'output' => 'Erro: find precisa de um termo de busca. Use o parametro "query" com o termo desejado. Se quiser listar arquivos de uma pasta, use "ls".',
			];
		}

		$results = array_merge(
			$this->cottonBridge->searchFolders($term),
			$this->cottonBridge->searchFiles($term)
		);

		if ($options['type'] !== null) {
			$typeFilter = strtolower($options['type']);
			if (in_array($typeFilter, ['file', 'folder'], true)) {
				$results = array_values(array_filter($results, static fn ($item) => ($item->type ?? '') === $typeFilter));
			}
		}

		$count = count($results);

		if ($options['count']) {
			return [
				'command' => 'find',
				'query' => $term,
				'count' => $count,
				'output' => (string) $count,
				'data' => [],
			];
		}

		if ($options['nameOnly']) {
			$names = array_map(static fn ($item) => $item->name ?? '', $results);
			return [
				'command' => 'find',
				'query' => $term,
				'count' => $count,
				'output' => implode("\n", $names),
				'data' => $names,
			];
		}

		$data = array_map(static function ($item) {
			return [
				'type' => $item->type,
				'id' => (int) $item->id,
				'name' => $item->name ?? '',
				'path' => $item->path ?? '',
			];
		}, $results);

		$output = Text::_('COM_SHUTTLE_FOUND') . ' ' . $count . ' ' . ($count === 1 ? Text::_('COM_SHUTTLE_ITEM') : Text::_('COM_SHUTTLE_ITEMS')) . ' ' . Text::_('COM_SHUTTLE_FOUND_FOR') . ' "' . $term . '".';

		if ($options['json']) {
			return [
				'command' => 'find',
				'query' => $term,
				'count' => $count,
				'output' => json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
				'data' => $data,
			];
		}

		return [
			'command' => 'find',
			'query' => $term,
			'count' => $count,
			'output' => $output,
			'data' => $data,
		];
	}

	public function handleMkdir(array $args, string $cwd): array
	{
		$options = [
			'parents' => false,
			'json' => false,
		];
		$pathParts = [];
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-p':
					case '--parents':
						$options['parents'] = true;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-p':
					case '--parents':
						$options['parents'] = true;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-p':
				case '--parents':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if (!str_starts_with($arg, '-')) {
						$pathParts[] = $arg;
					}
					break;
			}
		}

		$rawPath = implode(' ', $pathParts);
		$rawPath = str_replace('\\', '/', trim($rawPath));
		$rawPath = preg_replace('#/+$#', '', $rawPath);

		if ($rawPath === '' || $rawPath === '/' || $rawPath === '.') {
			return ['error' => 'mkdir requires a valid directory path', 'output' => 'Erro: mkdir precisa de um caminho valido. Exemplo: mkdir /docs/novo-diretorio'];
		}

		if ($options['parents']) {
			$result = $this->cottonBridge->createFolderRecursive($rawPath, $cwd);
			if (empty($result['success']) || isset($result['error'])) {
				return ['error' => $result['error'] ?? $result['message'] ?? 'Unable to create directory'];
			}

			$finalFolder = $result['data'] ?? null;
			$created = $result['created'] ?? [];

			if ($options['json']) {
				return [
					'command' => 'mkdir',
					'path' => $rawPath,
					'output' => json_encode([
						'created' => $created,
						'final' => $finalFolder,
					], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
					'data' => [
						'created' => $created,
						'final' => $finalFolder,
					],
				];
			}

			$names = array_map(static fn ($item) => $item['name'] ?? '', $created);
			$output = Text::_('COM_SHUTTLE_DIRS_CREATED') . ' ' . implode(', ', $names) . ' (' . Text::_('COM_SHUTTLE_FINAL_ID') . '=' . ($finalFolder['id'] ?? 0) . ')';

			return [
				'command' => 'mkdir',
				'path' => $rawPath,
				'output' => $output,
				'data' => [
					'created' => $created,
					'final' => $finalFolder,
				],
			];
		}

		$absolute = str_starts_with($rawPath, '/');
		$parts = array_filter(explode('/', trim($rawPath, '/')), 'strlen');
		$folderName = array_pop($parts);
		$parentPath = implode('/', $parts);

		if ($absolute) {
			$parentPath = '/' . $parentPath;
		}

		if ($parentPath === '' || $parentPath === '.') {
			$parentPath = '/';
		} elseif (!$absolute && $parentPath !== '/') {
			$parentPath = rtrim($cwd, '/') . '/' . $parentPath;
		}

		$parentPath = preg_replace('#/+#', '/', $parentPath);
		$parentPath = rtrim($parentPath, '/') ?: '/';

		$resolved = $this->cottonBridge->resolvePath($parentPath);
		if (isset($resolved['error']) || ($resolved['type'] ?? '') !== 'folder') {
			return ['error' => Text::_('COM_SHUTTLE_BASE_FOLDER_NOT_FOUND') . ': ' . $parentPath];
		}

		$result = $this->cottonBridge->createFolder((int) $resolved['id'], $folderName, '');
		if (empty($result['success'])) {
			return ['error' => $result['message'] ?? 'Unable to create directory'];
		}

		if ($options['json']) {
			return [
				'command' => 'mkdir',
				'path' => $rawPath,
				'output' => json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
				'data' => $result,
			];
		}

		return [
			'command' => 'mkdir',
			'path' => $rawPath,
			'output' => Text::_('COM_SHUTTLE_DIR_CREATED') . ': ' . $result['name'] . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . $result['id'] . ')',
			'data' => $result,
		];
	}

	public function handleRmdir(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'recursive' => false,
			'force' => false,
			'json' => false,
		];

		$target = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '-r':
				case '--recursive':
					$options['recursive'] = true;
					break;
				case '-f':
				case '--force':
					$options['force'] = true;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($target === null && !str_starts_with($arg, '-')) {
						$target = $arg;
					}
					break;
			}
		}

		if ($target === null && $options['id'] === null) {
			return ['error' => 'rmdir requires a directory path or -i/--id'];
		}

		if ($options['id'] !== null) {
			$target = $options['id'];
		}

		$resolved = $this->cottonBridge->resolvePath($target);
		if (isset($resolved['error'])) {
			return $resolved;
		}

		if (($resolved['type'] ?? '') !== 'folder') {
			return ['error' => Text::_('COM_SHUTTLE_TARGET_NOT_FOLDER') . ': ' . $target];
		}

		$folderId = (int) $resolved['id'];
		if ($folderId === 0) {
			return ['error' => 'Cannot remove root directory'];
		}

		if (!$options['recursive'] && !$options['force']) {
			$folderItems = $this->cottonBridge->loadFolderItems($folderId);
			$hasItems = !empty($folderItems['folders']) || !empty($folderItems['files']);
			if ($hasItems) {
				return ['error' => 'Directory is not empty. Use -r/--recursive to remove it with its contents.'];
			}
		}

		$result = $this->cottonBridge->deleteFolder($folderId, $options['force']);
		if (empty($result['success'])) {
			return ['error' => $result['message'] ?? 'Unable to delete directory'];
		}

		if ($options['json']) {
			return [
				'command' => 'rmdir',
				'folder_id' => $folderId,
				'output' => json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
				'data' => $result,
			];
		}

		$mode = $options['force'] ? 'permanently deleted' : 'moved to trash';
		return [
			'command' => 'rmdir',
			'folder_id' => $folderId,
			'output' => Text::_('COM_SHUTTLE_DIR_REMOVED') . ': ' . ($resolved['name'] ?? $target) . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . $folderId . ', ' . $mode . ')',
			'data' => $result,
		];
	}

	public function handleMv(array $args, string $cwd): array
	{
		$options = [
			'force' => false,
			'json' => false,
		];

		$source = null;
		$destination = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-f':
				case '--force':
					$options['force'] = true;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($source === null && !str_starts_with($arg, '-')) {
						$source = $arg;
					} elseif ($destination === null && !str_starts_with($arg, '-')) {
						$destination = $arg;
					}
					break;
			}
		}

		if ($source === null || $destination === null) {
			return ['error' => 'mv requires source and destination'];
		}

		$sourceResolved = $this->cottonBridge->resolvePath($source);
		if (isset($sourceResolved['error'])) {
			return $sourceResolved;
		}

		$destResolved = $this->cottonBridge->resolvePath($destination);
		if (isset($destResolved['error'])) {
			return $destResolved;
		}

		if (($destResolved['type'] ?? '') !== 'folder') {
			return ['error' => Text::_('COM_SHUTTLE_DEST_NOT_FOLDER') . ': ' . $destination];
		}

		$newParentId = (int) $destResolved['id'];
		$sourceType = $sourceResolved['type'] ?? '';

		if ($sourceType === 'folder') {
			$folderId = (int) $sourceResolved['id'];
			if ($folderId === 0) {
				return ['error' => 'Cannot move root directory'];
			}

			if ($folderId === $newParentId) {
				return ['error' => 'Source and destination are the same'];
			}

			$result = $this->cottonBridge->moveFolder($folderId, $newParentId);
			if (empty($result->success)) {
				return ['error' => $result->error ?? 'Unable to move directory'];
			}

			$output = Text::_('COM_SHUTTLE_DIR_MOVED') . ': ' . ($sourceResolved['name'] ?? $source) . ' -> ' . $destination . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . $folderId . ')';
			$data = [
				'type' => 'folder',
				'source_id' => $folderId,
				'destination_id' => $newParentId,
				'success' => true,
			];

			if ($options['json']) {
				return [
					'command' => 'mv',
					'source' => $source,
					'destination' => $destination,
					'output' => json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
					'data' => $data,
				];
			}

			return [
				'command' => 'mv',
				'source' => $source,
				'destination' => $destination,
				'output' => $output,
				'data' => $data,
			];
		}

		if ($sourceType === 'file') {
			$fileId = (int) $sourceResolved['id'];
			$result = $this->cottonBridge->moveFile($fileId, $newParentId);
			if (empty($result->success)) {
				return ['error' => $result->error ?? 'Unable to move file'];
			}

			$output = Text::_('COM_SHUTTLE_FILE_MOVED') . ': ' . ($sourceResolved['name'] ?? $source) . ' -> ' . $destination . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . $fileId . ')';
			$data = [
				'type' => 'file',
				'source_id' => $fileId,
				'destination_id' => $newParentId,
				'success' => true,
			];

			if ($options['json']) {
				return [
					'command' => 'mv',
					'source' => $source,
					'destination' => $destination,
					'output' => json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
					'data' => $data,
				];
			}

			return [
				'command' => 'mv',
				'source' => $source,
				'destination' => $destination,
				'output' => $output,
				'data' => $data,
			];
		}

		return ['error' => Text::_('COM_SHUTTLE_SOURCE_NOT_FILE_OR_FOLDER') . ': ' . $source];
	}

	public function handleCp(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'recursive' => false,
			'force' => false,
			'noClobber' => false,
			'json' => false,
		];

		$source = null;
		$destination = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '-r':
				case '--recursive':
					$options['recursive'] = true;
					break;
				case '-f':
				case '--force':
					$options['force'] = true;
					break;
				case '-n':
				case '--no-clobber':
					$options['noClobber'] = true;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($source === null && !str_starts_with($arg, '-')) {
						$source = $arg;
					} elseif ($destination === null && !str_starts_with($arg, '-')) {
						$destination = $arg;
					}
					break;
			}
		}

		if ($source === null || $destination === null) {
			return ['error' => 'cp requires source and destination'];
		}

		if ($options['id'] !== null) {
			$source = $options['id'];
		}

		$sourceResolved = $this->cottonBridge->resolvePath($source);
		if (isset($sourceResolved['error'])) {
			return $sourceResolved;
		}

		$destResolved = $this->cottonBridge->resolvePath($destination);
		if (isset($destResolved['error'])) {
			return $destResolved;
		}

		if (($destResolved['type'] ?? '') !== 'folder') {
			return ['error' => Text::_('COM_SHUTTLE_DEST_NOT_FOLDER') . ': ' . $destination];
		}

		$newParentId = (int) $destResolved['id'];
		$sourceType = $sourceResolved['type'] ?? '';

		if ($sourceType === 'file') {
			$fileId = (int) $sourceResolved['id'];
			$newName = $sourceResolved['name'] ?? ('copy-' . $fileId);

			$existing = $this->cottonBridge->findFileInFolder($newParentId, $newName);
			if ($existing !== null) {
				if ($options['noClobber']) {
					return [
						'command' => 'cp',
						'source' => $source,
						'destination' => $destination,
						'output' => Text::_('COM_SHUTTLE_FILE_EXISTS_SKIPPED') . ': ' . $newName,
						'data' => ['skipped' => true, 'name' => $newName],
					];
				}
				if (!$options['force']) {
					return ['error' => Text::_('COM_SHUTTLE_FILE_ALREADY_EXISTS') . ': ' . $newName . '. ' . Text::_('COM_SHUTTLE_USE_FORCE')];
				}
			}

			$result = $this->cottonBridge->copyFile($fileId, $newParentId, $newName);
			if (empty($result['success'])) {
				return ['error' => $result['message'] ?? 'Unable to copy file'];
			}

			$output = Text::_('COM_SHUTTLE_FILE_COPIED') . ': ' . ($sourceResolved['name'] ?? $source) . ' -> ' . $destination . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . ($result['id'] ?? $fileId) . ')';
			$data = [
				'type' => 'file',
				'source_id' => $fileId,
				'destination_id' => $newParentId,
				'new_id' => $result['id'] ?? null,
				'success' => true,
			];

			if ($options['json']) {
				return [
					'command' => 'cp',
					'source' => $source,
					'destination' => $destination,
					'output' => json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
					'data' => $data,
				];
			}

			return [
				'command' => 'cp',
				'source' => $source,
				'destination' => $destination,
				'output' => $output,
				'data' => $data,
			];
		}

		if ($sourceType === 'folder') {
			$folderId = (int) $sourceResolved['id'];
			if ($folderId === 0) {
				return ['error' => 'Cannot copy root directory'];
			}

			if (!$options['recursive']) {
				return ['error' => 'Cannot copy a directory without -r/--recursive'];
			}

			$newName = $sourceResolved['name'] ?? ('copy-' . $folderId);

			$result = $this->cottonBridge->copyFolderRecursive($folderId, $newParentId, $newName);
			if (empty($result['success'])) {
				return ['error' => $result['message'] ?? 'Unable to copy directory'];
			}

			$output = Text::_('COM_SHUTTLE_DIR_COPIED') . ': ' . ($sourceResolved['name'] ?? $source) . ' -> ' . $destination . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . $result['id'] . ')';
			$data = [
				'type' => 'folder',
				'source_id' => $folderId,
				'destination_id' => $newParentId,
				'new_id' => $result['id'] ?? null,
				'success' => true,
			];

			if ($options['json']) {
				return [
					'command' => 'cp',
					'source' => $source,
					'destination' => $destination,
					'output' => json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
					'data' => $data,
				];
			}

			return [
				'command' => 'cp',
				'source' => $source,
				'destination' => $destination,
				'output' => $output,
				'data' => $data,
			];
		}

		return ['error' => Text::_('COM_SHUTTLE_SOURCE_NOT_FILE_OR_FOLDER') . ': ' . $source];
	}

	public function handleJoomla(array $args, string $cwd): array
	{
		$options = array_values(array_filter($args, static function ($arg) {
			return str_starts_with($arg, '-');
		}));

		$parameters = array_values(array_filter($args, static function ($arg) {
			return !str_starts_with($arg, '-');
		}));

		if (!empty($parameters)) {
			return ['error' => 'joomla does not accept positional parameters'];
		}

		$result = $this->cottonBridge->listArticles();
		return [
			'command' => 'joomla',
			'count' => $result['count'],
			'output' => Text::_('COM_SHUTTLE_FOUND') . ' ' . $result['count'] . ' ' . ($result['count'] === 1 ? Text::_('COM_SHUTTLE_ARTICLE') : Text::_('COM_SHUTTLE_ARTICLES')),
			'data' => $result['articles'],
		];
	}

	public function handleGrep(array $args, string $cwd): array
	{
		$options = [
			'ignoreCase' => false,
			'lineNumber' => false,
			'withFilename' => null,
			'invertMatch' => false,
			'filesWithoutMatch' => false,
			'filesWithMatches' => false,
			'count' => false,
			'regex' => false,
			'json' => false,
		];

		$pattern = null;
		$targets = [];
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-e':
					case '--regexp':
						$pattern = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-e':
					case '--regexp':
						$pattern = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
					case '-i':
					case '--ignore-case':
						$options['ignoreCase'] = true;
						break;
					case '-n':
					case '--line-number':
						$options['lineNumber'] = true;
						break;
					case '-H':
					case '--with-filename':
						$options['withFilename'] = true;
						break;
					case '-h':
					case '--no-filename':
						$options['withFilename'] = false;
						break;
					case '-v':
					case '--invert-match':
						$options['invertMatch'] = true;
						break;
					case '-L':
					case '--files-without-match':
						$options['filesWithoutMatch'] = true;
						break;
					case '-l':
					case '--files-with-matches':
						$options['filesWithMatches'] = true;
						break;
					case '-c':
					case '--count':
						$options['count'] = true;
						break;
					case '-E':
					case '--extended-regexp':
						$options['regex'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--ignore-case':
					$options['ignoreCase'] = true;
					break;
				case '-n':
				case '--line-number':
					$options['lineNumber'] = true;
					break;
				case '-H':
				case '--with-filename':
					$options['withFilename'] = true;
					break;
				case '-h':
				case '--no-filename':
					$options['withFilename'] = false;
					break;
				case '-v':
				case '--invert-match':
					$options['invertMatch'] = true;
					break;
				case '-L':
				case '--files-without-match':
					$options['filesWithoutMatch'] = true;
					break;
				case '-l':
				case '--files-with-matches':
					$options['filesWithMatches'] = true;
					break;
				case '-c':
				case '--count':
					$options['count'] = true;
					break;
				case '-E':
				case '--extended-regexp':
					$options['regex'] = true;
					break;
				case '-e':
				case '--regexp':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($pattern === null) {
						$pattern = $arg;
					} else {
						$targets[] = $arg;
					}
					break;
			}
		}

		if ($pattern === null) {
			return ['error' => 'grep requires a pattern'];
		}

		if (empty($targets)) {
			return ['error' => 'grep requires at least one file'];
		}

		$results = $this->cottonBridge->grepFileContent($pattern, $targets, $options);
		$lines = [];
		$data = [];
		$totalMatches = 0;

		$showFilename = $this->resolveFilenameVisibility($options['withFilename'], count($targets));

		if ($options['filesWithoutMatch']) {
			foreach ($results as $fileResult) {
				if (!$fileResult['hasMatch']) {
					$lines[] = $fileResult['filePath'];
					$data[] = [
						'filePath' => $fileResult['filePath'],
						'line' => 0,
						'lineText' => '',
					];
					$totalMatches++;
				}
			}
		} elseif ($options['filesWithMatches']) {
			foreach ($results as $fileResult) {
				if ($fileResult['hasMatch']) {
					$lines[] = $fileResult['filePath'];
					$data[] = [
						'filePath' => $fileResult['filePath'],
						'line' => 0,
						'lineText' => '',
					];
					$totalMatches++;
				}
			}
		} elseif ($options['count']) {
			foreach ($results as $fileResult) {
				$prefix = $showFilename ? $fileResult['filePath'] . ':' : '';
				$lines[] = $prefix . $fileResult['matchCount'];
				$data[] = [
					'filePath' => $fileResult['filePath'],
					'line' => $fileResult['matchCount'],
					'lineText' => '',
				];
				$totalMatches += $fileResult['matchCount'];
			}
		} else {
			foreach ($results as $fileResult) {
				foreach ($fileResult['matches'] as $match) {
					$prefix = '';
					if ($showFilename) {
						$prefix = $fileResult['filePath'] . ':';
					}
					if ($options['lineNumber']) {
						$prefix .= $match['line'] . ':';
					}
					$lines[] = $prefix . $match['lineText'];
					$data[] = [
						'filePath' => $fileResult['filePath'],
						'line' => $match['line'],
						'lineText' => $match['lineText'],
					];
					$totalMatches++;
				}
			}
		}

		return [
			'command' => 'grep',
			'pattern' => $pattern,
			'targets' => $targets,
			'count' => $totalMatches,
			'output' => implode("\n", $lines),
			'data' => $data,
		];
	}

	public function handleCat(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'number' => false,
			'numberNonblank' => false,
			'squeezeBlank' => false,
			'json' => false,
		];

		$target = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '-n':
				case '--number':
					$options['number'] = true;
					break;
				case '-b':
				case '--number-nonblank':
					$options['numberNonblank'] = true;
					break;
				case '-s':
				case '--squeeze-blank':
					$options['squeezeBlank'] = true;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($target === null && !str_starts_with($arg, '-')) {
						$target = $arg;
					}
					break;
			}
		}

		if ($target === null && $options['id'] === null) {
			return ['error' => 'cat requires a file identifier or -i/--id'];
		}

		if ($options['id'] !== null) {
			$target = $options['id'];
		}

		$file = $this->cottonBridge->readFileByPath($target);
		if ($file === null) {
			return ['error' => Text::_('COM_SHUTTLE_FILE_NOT_FOUND') . ': "' . $target . '"'];
		}

		$denied = $this->cottonBridge->assertFileOwner((int) $file->id);
		if ($denied !== null) {
			return ['error' => Text::_('COM_SHUTTLE_ERROR_NOACCESS')];
		}

		$content = $file->file_data ?? '';
		$formattedContent = $this->formatCatOutput($content, $options);

		return [
			'command' => 'cat',
			'file_id' => (int) $file->id,
			'name' => $file->name ?? '',
			'path' => $file->path ?? '',
			'output' => $formattedContent,
			'data' => $file,
			];
	}

	public function handleHead(array $args, string $cwd): array
	{
		$options = [
			'lines' => 10,
			'quiet' => false,
			'verbose' => false,
			'id' => null,
			'json' => false,
		];

		$target = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-n':
					case '--lines':
						$options['lines'] = (int) $arg;
						break;
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-n':
					case '--lines':
						$options['lines'] = (int) $value;
						break;
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-n':
				case '--lines':
					$pendingOption = $arg;
					break;
				case '-q':
				case '--quiet':
					$options['quiet'] = true;
					break;
				case '-v':
				case '--verbose':
					$options['verbose'] = true;
					break;
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($target === null && !str_starts_with($arg, '-')) {
						$target = $arg;
					}
					break;
			}
		}

		if ($target === null && $options['id'] === null) {
			return ['error' => 'head requires a file identifier or -i/--id'];
		}

		if ($options['id'] !== null) {
			$target = $options['id'];
		}

		$file = $this->cottonBridge->readFileByPath($target);
		if ($file === null) {
			return ['error' => Text::_('COM_SHUTTLE_FILE_NOT_FOUND') . ': "' . $target . '"'];
		}

		$denied = $this->cottonBridge->assertFileOwner((int) $file->id);
		if ($denied !== null) {
			return ['error' => Text::_('COM_SHUTTLE_ERROR_NOACCESS')];
		}

		$content = $file->file_data ?? '';
		if ($content === '') {
			$prefix = $this->buildHeadPrefix($options, $file);
			return [
				'command' => 'head',
				'file_id' => (int) $file->id,
				'name' => $file->name ?? '',
				'path' => $file->path ?? '',
				'lines' => 0,
				'output' => $prefix,
				'data' => $file,
			];
		}

		$lines = preg_split('/\r\n|\r|\n/', $content);
		$lines = array_slice($lines, 0, max(1, $options['lines']));
		$prefix = $this->buildHeadPrefix($options, $file);
		$output = $prefix !== '' ? $prefix . "\n" . implode("\n", $lines) : implode("\n", $lines);

		if ($options['json']) {
			return [
				'command' => 'head',
				'file_id' => (int) $file->id,
				'name' => $file->name ?? '',
				'path' => $file->path ?? '',
				'lines' => count($lines),
				'output' => $output,
				'data' => [
					'file_id' => (int) $file->id,
					'name' => $file->name ?? '',
					'path' => $file->path ?? '',
					'lines' => $lines,
					'count' => count($lines),
				],
			];
		}

		return [
			'command' => 'head',
			'file_id' => (int) $file->id,
			'name' => $file->name ?? '',
			'path' => $file->path ?? '',
			'lines' => count($lines),
			'output' => $output,
			'data' => $file,
		];
	}

	protected function buildHeadPrefix(array $options, object $file): string
	{
		$show = $options['verbose'] || !$options['quiet'];
		if (!$show) {
			return '';
		}

		$path = $file->path ?? ($file->name ?? 'unknown');
		return Text::_('COM_SHUTTLE_HEAD_PREFIX') . ' ' . $path . ' ' . Text::_('COM_SHUTTLE_HEAD_SUFFIX');
	}

	public function handleTail(array $args, string $cwd): array
	{
		$options = [
			'lines' => 10,
			'quiet' => false,
			'verbose' => false,
			'id' => null,
			'json' => false,
		];

		$target = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-n':
					case '--lines':
						$options['lines'] = (int) $arg;
						break;
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-n':
					case '--lines':
						$options['lines'] = (int) $value;
						break;
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-n':
				case '--lines':
					$pendingOption = $arg;
					break;
				case '-q':
				case '--quiet':
					$options['quiet'] = true;
					break;
				case '-v':
				case '--verbose':
					$options['verbose'] = true;
					break;
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($target === null && !str_starts_with($arg, '-')) {
						$target = $arg;
					}
					break;
			}
		}

		if ($target === null && $options['id'] === null) {
			return ['error' => 'tail requires a file identifier or -i/--id'];
		}

		if ($options['id'] !== null) {
			$target = $options['id'];
		}

		$file = $this->cottonBridge->readFileByPath($target);
		if ($file === null) {
			return ['error' => Text::_('COM_SHUTTLE_FILE_NOT_FOUND') . ': "' . $target . '"'];
		}

		$denied = $this->cottonBridge->assertFileOwner((int) $file->id);
		if ($denied !== null) {
			return ['error' => Text::_('COM_SHUTTLE_ERROR_NOACCESS')];
		}

		$content = $file->file_data ?? '';
		if ($content === '') {
			$prefix = $this->buildHeadPrefix($options, $file);
			return [
				'command' => 'tail',
				'file_id' => (int) $file->id,
				'name' => $file->name ?? '',
				'path' => $file->path ?? '',
				'lines' => 0,
				'output' => $prefix,
				'data' => $file,
			];
		}

		$lines = preg_split('/\r\n|\r|\n/', $content);
		$count = count($lines);
		$tailLines = max(1, $options['lines']);
		$lines = array_slice($lines, max(0, $count - $tailLines));
		$prefix = $this->buildHeadPrefix($options, $file);
		$output = $prefix !== '' ? $prefix . "\n" . implode("\n", $lines) : implode("\n", $lines);

		if ($options['json']) {
			return [
				'command' => 'tail',
				'file_id' => (int) $file->id,
				'name' => $file->name ?? '',
				'path' => $file->path ?? '',
				'lines' => count($lines),
				'output' => $output,
				'data' => [
					'file_id' => (int) $file->id,
					'name' => $file->name ?? '',
					'path' => $file->path ?? '',
					'lines' => $lines,
					'count' => count($lines),
				],
			];
		}

		return [
			'command' => 'tail',
			'file_id' => (int) $file->id,
			'name' => $file->name ?? '',
			'path' => $file->path ?? '',
		'lines' => count($lines),
		'output' => $output,
		'data' => $file,
		];
	}

	public function handleSed(array $args, string $cwd): array
	{
		$options = [
			'inPlace' => false,
			'quiet' => false,
			'json' => false,
			'expressions' => [],
			'id' => null,
		];

		$target = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-e':
					case '--expression':
						$options['expressions'][] = $arg;
						break;
					case '__sed_i_ambiguous__':
						if (ctype_digit($arg)) {
							$options['id'] = $arg;
						} else {
							$options['inPlace'] = true;
						}
						break;
					case '-n':
					case '--quiet':
						$options['quiet'] = true;
						break;
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--in-place':
						if (ctype_digit($value)) {
							$options['id'] = $value;
						} else {
							$options['inPlace'] = true;
						}
						break;
					case '-n':
					case '--quiet':
						$options['quiet'] = true;
						break;
					case '-e':
					case '--expression':
						$options['expressions'][] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
					$pendingOption = '__sed_i_ambiguous__';
					break;
				case '--in-place':
					$options['inPlace'] = true;
					break;
				case '-n':
				case '--quiet':
					$options['quiet'] = true;
					break;
				case '-e':
				case '--expression':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				case '--id':
					$pendingOption = $arg;
					break;
				default:
					if ($target === null && !str_starts_with($arg, '-')) {
						$target = $arg;
					} elseif (!str_starts_with($arg, '-')) {
						$options['expressions'][] = $arg;
					}
					break;
			}
		}

		if ($target === null && $options['id'] === null) {
			return ['error' => 'sed requires a file identifier'];
		}

		if ($options['id'] !== null) {
			$target = $options['id'];
		}

		if (empty($options['expressions'])) {
			return ['error' => 'sed requires at least one expression'];
		}

		$file = $this->cottonBridge->readFileByPath($target);
		if ($file === null) {
			return ['error' => Text::_('COM_SHUTTLE_FILE_NOT_FOUND') . ': "' . $target . '"'];
		}

		$denied = $this->cottonBridge->assertFileOwner((int) $file->id);
		if ($denied !== null) {
			return ['error' => Text::_('COM_SHUTTLE_ERROR_NOACCESS')];
		}

		$content = $file->file_data ?? '';
		$lines = $content === '' ? [] : preg_split('/\r\n|\r|\n/', $content);
		$originalLineCount = count($lines);

		foreach ($options['expressions'] as $expr) {
			$lines = $this->applySedExpression($lines, $expr);
		}

		$newLineCount = count($lines);
		$outputLines = $options['quiet'] ? [] : $lines;
		$output = implode("\n", $outputLines);

		if ($options['inPlace']) {
			$newContent = implode("\n", $lines);
			$saveResult = $this->cottonBridge->saveFileContent((int) $file->id, $newContent);
			if (empty($saveResult['success'])) {
				return ['error' => $saveResult['message'] ?? 'Unable to save file'];
			}
		}

		if ($options['json']) {
			return [
				'command' => 'sed',
				'file_id' => (int) $file->id,
				'name' => $file->name ?? '',
				'path' => $file->path ?? '',
				'original_lines' => $originalLineCount,
				'result_lines' => $newLineCount,
				'expressions' => $options['expressions'],
				'in_place' => $options['inPlace'],
				'output' => $output,
				'data' => [
					'file_id' => (int) $file->id,
					'name' => $file->name ?? '',
					'path' => $file->path ?? '',
					'lines' => $lines,
					'original_lines' => $originalLineCount,
					'result_lines' => $newLineCount,
					'expressions' => $options['expressions'],
					'in_place' => $options['inPlace'],
				],
			];
		}

		return [
			'command' => 'sed',
			'file_id' => (int) $file->id,
			'name' => $file->name ?? '',
			'path' => $file->path ?? '',
			'original_lines' => $originalLineCount,
			'result_lines' => $newLineCount,
			'expressions' => $options['expressions'],
			'in_place' => $options['inPlace'],
			'output' => $output,
			'data' => $file,
		];
	}

	protected function applySedExpression(array $lines, string $expr): array
	{
		$expr = trim($expr);

		if ($expr === '') {
			return $lines;
		}

		if (str_starts_with($expr, 's/') || str_starts_with($expr, 's|')) {
			return $this->applySedSubstitute($lines, $expr);
		}

		if (str_starts_with($expr, '/') && str_ends_with($expr, '/d')) {
			return $this->applySedDeleteByPattern($lines, $expr);
		}

		if (preg_match('/^(\d+)(?:,(\d+))?d$/', $expr, $matches)) {
			return $this->applySedDeleteByLine($lines, $matches);
		}

		if (str_starts_with($expr, '/') && str_ends_with($expr, '/p')) {
			return $this->applySedPrint($lines, $expr);
		}

		if (preg_match('/^(\d+)?i\\(.+)$/s', $expr, $matches)) {
			return $this->applySedInsertBefore($lines, $matches);
		}

		if (preg_match('/^(\d+)?a\\(.+)$/s', $expr, $matches)) {
			return $this->applySedInsertAfter($lines, $matches);
		}

		return $lines;
	}

	protected function applySedSubstitute(array $lines, string $expr): array
	{
		$delimiter = str_starts_with($expr, 's|') ? '|' : '/';
		$pattern = '#^s' . preg_quote($delimiter, '#') . '(.+?)' . preg_quote($delimiter, '#') . '(.+?)' . preg_quote($delimiter, '#') . '([gix]*)$#';

		if (!preg_match($pattern, $expr, $matches)) {
			return $lines;
		}

		$find = $matches[1];
		$replace = $matches[2];
		$flags = strtolower($matches[3]);

		$global = str_contains($flags, 'g');
		$caseInsensitive = str_contains($flags, 'i');

		$modifier = $caseInsensitive ? 'i' : '';

		foreach ($lines as $index => $line) {
			if ($global) {
				$lines[$index] = preg_replace('~' . $find . '~' . $modifier, $replace, $line);
			} else {
				$lines[$index] = preg_replace('~' . $find . '~' . $modifier, $replace, $line, 1);
			}
		}

		return $lines;
	}

	protected function applySedDeleteByPattern(array $lines, string $expr): array
	{
		$pattern = substr($expr, 1, -2);
		return array_values(array_filter($lines, static function ($line) use ($pattern) {
			return !preg_match('~' . $pattern . '~', $line);
		}));
	}

	protected function applySedDeleteByLine(array $lines, array $matches): array
	{
		$start = (int) $matches[1] - 1;
		$end = isset($matches[2]) ? (int) $matches[2] - 1 : $start;

		foreach ($lines as $index => $line) {
			if ($index >= $start && $index <= $end) {
				unset($lines[$index]);
			}
		}

		return array_values($lines);
	}

	protected function applySedPrint(array $lines, string $expr): array
	{
		$pattern = substr($expr, 1, -2);
		return array_values(array_filter($lines, static function ($line) use ($pattern) {
			return preg_match('~' . $pattern . '~', $line);
		}));
	}

	protected function applySedInsertBefore(array $lines, array $matches): array
	{
		$lineNum = isset($matches[1]) && $matches[1] !== '' ? (int) $matches[1] - 1 : 0;
		$text = $matches[2];

		if ($lineNum < 0) {
			$lineNum = 0;
		}

		array_splice($lines, $lineNum, 0, [$text]);

		return $lines;
	}

	protected function applySedInsertAfter(array $lines, array $matches): array
	{
		$lineNum = isset($matches[1]) && $matches[1] !== '' ? (int) $matches[1] : count($lines);
		$text = $matches[2];

		if ($lineNum > count($lines)) {
			$lineNum = count($lines);
		}

		array_splice($lines, $lineNum, 0, [$text]);

		return $lines;
	}

	public function handleCcResolve(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'json' => false,
			'nameOnly' => false,
			'pathOnly' => false,
			'typeOnly' => false,
		];

		$query = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				case '--name-only':
					$options['nameOnly'] = true;
					break;
				case '--path-only':
					$options['pathOnly'] = true;
					break;
				case '--type-only':
					$options['typeOnly'] = true;
					break;
				default:
					if ($query === null && !str_starts_with($arg, '-')) {
						$query = $arg;
					}
					break;
			}
		}

		if ($query === null && $options['id'] === null) {
			return ['error' => 'cc-resolve requires a virtual path or identifier'];
		}

		$virtualPath = $options['id'] ?? $query;
		$resolved = $this->cottonBridge->resolvePath($virtualPath);
		if (isset($resolved['error'])) {
			return $resolved;
		}

		if ($options['nameOnly']) {
			return [
				'command' => 'cc-resolve',
				'query' => $virtualPath,
				'output' => $resolved['name'] ?? '',
				'data' => $resolved,
			];
		}

		if ($options['pathOnly']) {
			return [
				'command' => 'cc-resolve',
				'query' => $virtualPath,
				'output' => $resolved['path'] ?? '',
				'data' => $resolved,
			];
		}

		if ($options['typeOnly']) {
			return [
				'command' => 'cc-resolve',
				'query' => $virtualPath,
				'output' => $resolved['type'] ?? '',
				'data' => $resolved,
			];
		}

		$output = json_encode($resolved, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

		return [
			'command' => 'cc-resolve',
			'query' => $virtualPath,
			'output' => $output,
			'data' => $resolved,
		];
	}

	public function handleCd(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'json' => false,
		];

		$pathTarget = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($pathTarget === null && !str_starts_with($arg, '-')) {
						$pathTarget = $arg;
					}
					break;
			}
		}

		if ($pathTarget === null && $options['id'] === null) {
			return ['error' => 'cd requires a path or -i/--id'];
		}

		if ($options['id'] !== null) {
			$folderId = (string) $options['id'];
			if ($folderId === '' || !ctype_digit($folderId)) {
				return ['error' => 'Folder ID must be a numeric value'];
			}

			$resolved = $this->cottonBridge->getFolderById((int) $folderId);
			if ($resolved === null) {
				return ['error' => Text::_('COM_SHUTTLE_FOLDER_ID_NOT_FOUND') . ': ' . $folderId];
			}
		} else {
			$normalized = $this->normalizeVirtualPath($pathTarget, $cwd);
			if (isset($normalized['error'])) {
				return ['error' => $normalized['error']];
			}

			$resolved = $this->cottonBridge->resolvePath($normalized['path']);
		}

		if (isset($resolved['error']) || ($resolved['type'] ?? '') !== 'folder') {
			return ['error' => Text::_('COM_SHUTTLE_DIRECTORY_NOT_FOUND') . ': ' . ($pathTarget ?? ($options['id'] ?? ''))];
		}

		$folderId = (int) $resolved['id'];
		if ($folderId !== 0) {
			$folder = $this->cottonBridge->getFolderById($folderId);
			if (!$folder || (int) $folder['owner_id'] !== (int) Factory::getApplication()->getIdentity()->id) {
				return ['error' => Text::_('COM_SHUTTLE_ERROR_NOACCESS')];
			}
		}

		if ($options['json']) {
			return [
				'command' => 'cd',
				'path' => $resolved['path'] === '' ? '/' : $resolved['path'],
				'id' => (int) $resolved['id'],
				'parent_id' => $resolved['parent_id'] ?? null,
				'output' => json_encode([
					'path' => $resolved['path'] === '' ? '/' : $resolved['path'],
					'id' => (int) $resolved['id'],
					'parent_id' => $resolved['parent_id'] ?? null,
				], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
				'data' => $resolved,
			];
		}

		return [
			'command' => 'cd',
			'path' => $resolved['path'] === '' ? '/' : $resolved['path'],
			'id' => (int) $resolved['id'],
			'parent_id' => $resolved['parent_id'] ?? null,
			'output' => Text::_('COM_SHUTTLE_CHANGED_DIR') . ': ' . ($resolved['path'] === '' ? '/' : $resolved['path']),
			'data' => $resolved,
		];
	}

	public function handleLs(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'json' => false,
			'long' => false,
			'recursive' => false,
			'sort' => null,
		];

		$target = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
					case '--sort':
						$options['sort'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
					case '--sort':
						$options['sort'] = $value;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				case '-l':
				case '--long':
					$options['long'] = true;
					break;
				case '-R':
				case '--recursive':
					$options['recursive'] = true;
					break;
				case '--sort':
					$pendingOption = $arg;
					break;
				default:
					if ($target === null && !str_starts_with($arg, '-')) {
						$target = $arg;
					}
					break;
			}
		}

		if ($options['id'] !== null) {
			$folderId = (string) $options['id'];
			if ($folderId === '' || !ctype_digit($folderId)) {
				return ['error' => 'ls requires a numeric folder ID when using -i/--id'];
			}

			$resolved = $this->cottonBridge->getFolderById((int) $folderId);
			if ($resolved === null || ($resolved['type'] ?? '') !== 'folder') {
				return ['error' => Text::_('COM_SHUTTLE_FOLDER_ID_NOT_FOUND') . ': ' . $folderId];
			}
		} else {
			$target = $target ?? '.';
			$normalized = $this->normalizeVirtualPath($target, $cwd);
			if (isset($normalized['error'])) {
				return ['error' => $normalized['error']];
			}

			$resolved = $this->cottonBridge->resolvePath($normalized['path']);
			if (isset($resolved['error']) || ($resolved['type'] ?? '') !== 'folder') {
				return ['error' => Text::_('COM_SHUTTLE_DIRECTORY_NOT_FOUND') . ': ' . $target];
			}
		}

		$folderId = (int) $resolved['id'];
		if ($folderId !== 0) {
			$folder = $this->cottonBridge->getFolderById($folderId);
			if (!$folder || (int) $folder['owner_id'] !== (int) Factory::getApplication()->getIdentity()->id) {
				return ['error' => Text::_('COM_SHUTTLE_ERROR_NOACCESS')];
			}
		}

		if ($options['recursive']) {
			$data = $this->lsRecursive((int) $resolved['id'], $options);
		} else {
			$data = $this->lsFolder((int) $resolved['id'], $options);
		}

		if ($options['json']) {
			return [
				'command' => 'ls',
				'path' => $resolved['path'] === '' ? '/' : $resolved['path'],
				'id' => (int) $resolved['id'],
				'parent_id' => $resolved['parent_id'] ?? null,
				'output' => json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
				'data' => $data,
				'count' => is_array($data) ? count($data) : 0,
			];
		}

		$folders = [];
		$files = [];
		if (is_array($data)) {
			foreach ($data as $item) {
				if (($item['type'] ?? '') === 'folder') {
					$folders[] = (object) [
						'id' => $item['id'] ?? 0,
						'name' => $item['name'] ?? '',
						'date_created' => $item['created'] ?? '',
						'n_folders' => $item['subfolders'] ?? 0,
						'n_files' => $item['subfiles'] ?? 0,
					];
				} else {
					$files[] = (object) [
						'id' => $item['id'] ?? 0,
						'name' => $item['name'] ?? '',
						'size' => $item['size'] ?? 0,
						'date_created' => $item['created'] ?? '',
					];
				}
			}
		}

		return [
			'command' => 'ls',
			'path' => $resolved['path'] === '' ? '/' : $resolved['path'],
			'id' => (int) $resolved['id'],
			'parent_id' => $resolved['parent_id'] ?? null,
			'output' => Text::_('COM_SHUTTLE_LISTING') . ': ' . ($resolved['path'] === '' ? '/' : $resolved['path']),
			'data' => $data,
			'count' => is_array($data) ? count($data) : 0,
			'folders' => $folders,
			'files' => $files,
		];
	}

	protected function lsFolder(int $folderId, array $options): array
	{
		$folderItems = $this->cottonBridge->loadFolderItems($folderId);
		$folders = $folderItems['folders'] ?? [];
		$files = $folderItems['files'] ?? [];

		$data = [];

		foreach ($folders as $folder) {
			$item = [
				'id' => (int) $folder->id,
				'name' => $folder->name . '/',
				'type' => 'folder',
				'created' => $folder->date_created ?? '',
				'size' => 0,
				'path' => '',
			];

			if ($options['long']) {
				$item['content'] = Text::_('COM_SHUTTLE_DIR') . '  ' . ($folder->n_folders ?? 0) . ' ' . Text::_('COM_SHUTTLE_FOLDERS') . ', ' . ($folder->n_files ?? 0) . ' ' . Text::_('COM_SHUTTLE_FILES');
			}

			$data[] = $item;
		}

		foreach ($files as $file) {
			$size = isset($file->size) ? (int) $file->size : 0;
			$item = [
				'id' => (int) $file->id,
				'name' => $file->name,
				'type' => 'file',
				'created' => $file->date_created ?? '',
				'size' => $size,
				'path' => ($folderItems['path'] ?? '') . '/' . $file->name,
			];

			if ($options['long']) {
				$item['content'] = $this->formatFileSize($size);
			}

			$data[] = $item;
		}

		$sort = strtolower($options['sort'] ?? '');
		if ($sort !== '') {
			usort($data, function ($a, $b) use ($sort) {
				$aVal = strtolower($a['name'] ?? '');
				$bVal = strtolower($b['name'] ?? '');

				if ($sort === 'date') {
					$aVal = $a['created'] ?? '';
					$bVal = $b['created'] ?? '';
				} elseif ($sort === 'size') {
					$aVal = (int) ($a['size'] ?? 0);
					$bVal = (int) ($b['size'] ?? 0);
				} elseif ($sort === 'type') {
					$aVal = $a['type'] ?? '';
					$bVal = $b['type'] ?? '';
				}

				if ($aVal == $bVal) {
					return 0;
				}

				return ($aVal < $bVal) ? -1 : 1;
			});
		}

		return $data;
	}

	protected function lsRecursive(int $folderId, array $options): array
	{
		$results = [];
		$queue = [$folderId];
		$visited = [];

		while ($queue !== []) {
			$currentId = array_shift($queue);
			if (isset($visited[$currentId])) {
				continue;
			}
			$visited[$currentId] = true;

			$folderItems = $this->cottonBridge->loadFolderItems($currentId);
			$folders = $folderItems['folders'] ?? [];
			$files = $folderItems['files'] ?? [];
			$path = $folderItems['path'] ?? '';

			foreach ($files as $file) {
				$size = isset($file->size) ? (int) $file->size : 0;
				$item = [
					'id' => (int) $file->id,
					'name' => $file->name,
					'type' => 'file',
					'created' => $file->date_created ?? '',
					'size' => $size,
					'path' => $path . '/' . $file->name,
				];

				if ($options['long']) {
					$item['content'] = $this->formatFileSize($size);
				}

				$results[] = $item;
			}

			foreach ($folders as $folder) {
			$item = [
				'id' => (int) $folder->id,
				'name' => $folder->name . '/',
				'type' => 'folder',
				'created' => $folder->date_created ?? '',
				'size' => 0,
				'path' => '',
			];

				if ($options['long']) {
					$item['content'] = Text::_('COM_SHUTTLE_DIR') . '  ' . ($folder->n_folders ?? 0) . ' ' . Text::_('COM_SHUTTLE_FOLDERS') . ', ' . ($folder->n_files ?? 0) . ' ' . Text::_('COM_SHUTTLE_FILES');
				}

				$results[] = $item;
				$queue[] = (int) $folder->id;
			}
		}

		$sort = strtolower($options['sort'] ?? '');
		if ($sort !== '') {
			usort($results, function ($a, $b) use ($sort) {
				$aVal = strtolower($a['name'] ?? '');
				$bVal = strtolower($b['name'] ?? '');

				if ($sort === 'date') {
					$aVal = $a['created'] ?? '';
					$bVal = $b['created'] ?? '';
				} elseif ($sort === 'size') {
					$aVal = (int) ($a['size'] ?? 0);
					$bVal = (int) ($b['size'] ?? 0);
				} elseif ($sort === 'type') {
					$aVal = $a['type'] ?? '';
					$bVal = $b['type'] ?? '';
				}

				if ($aVal == $bVal) {
					return 0;
				}

				return ($aVal < $bVal) ? -1 : 1;
			});
		}

		return $results;
	}

	protected function normalizeVirtualPath(string $target, string $cwd): array
	{
		$target = str_replace('\\', '/', trim($target));
		if ($target === '' || $target === '.') {
			return ['path' => $cwd ?: '/'];
		}

		if ($target === '/') {
			return ['path' => '/'];
		}

		$absolute = str_starts_with($target, '/');
		$parts = array_filter(explode('/', trim($target, '/')), 'strlen');
		$stack = [];

		if (!$absolute) {
			$cwdPath = trim($cwd, '/');
			if ($cwdPath !== '') {
				$stack = explode('/', $cwdPath);
			}
		}

		foreach ($parts as $part) {
			if ($part === '.' || $part === '') {
				continue;
			}

			if ($part === '..') {
				if (!empty($stack)) {
					array_pop($stack);
				}
				continue;
			}

			$stack[] = $part;
		}

		return ['path' => '/' . implode('/', $stack)];
	}

	protected function resolveFilenameVisibility(?bool $explicit, int $fileCount): bool
	{
		if ($explicit !== null) {
			return $explicit;
		}
		return $fileCount > 1;
	}

	public function handleCottonCreate(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'folder' => null,
			'name' => null,
			'json' => false,
			'content' => '',
			'description' => '',
		];

		$positionals = [];
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				$options[$pendingOption] = $arg;
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$flag, $value] = explode('=', $arg, 2);
				switch ($flag) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '--folder':
						$options['folder'] = $value;
						break;
					case '--name':
						$options['name'] = $value;
						break;
					case '--content':
						$options['content'] = $value;
						break;
					case '--description':
						$options['description'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = 'id';
					break;
				case '--folder':
					$pendingOption = 'folder';
					break;
				case '--name':
					$pendingOption = 'name';
					break;
				case '--content':
					$pendingOption = 'content';
					break;
				case '--description':
					$pendingOption = 'description';
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					$positionals[] = $arg;
					break;
			}
		}

		if ($options['id'] !== null) {
			$folderTarget = $options['id'];
		} elseif ($options['folder'] !== null) {
			$folderTarget = $options['folder'];
		} elseif (!empty($positionals[0])) {
			$folderTarget = $positionals[0];
		}

		if ($options['name'] !== null) {
			$fileName = $options['name'];
		} elseif (!empty($positionals[1])) {
			$fileName = $positionals[1];
		}

		if ($folderTarget === null || $fileName === null) {
			//error_log('[cotton-create] missing identifier. args=' . json_encode($args) . ', options=' . json_encode($options));
			return ['error' => 'cotton-create requires a folder identifier and file name'];
		}

		$resolved = $this->cottonBridge->resolvePath((string) $folderTarget);
		if (isset($resolved['error']) || ($resolved['type'] ?? '') !== 'folder') {
			return ['error' => Text::_('COM_SHUTTLE_FOLDER_TARGET_NOT_FOUND') . ': ' . $folderTarget];
		}

		$result = $this->cottonBridge->createFile((int) $resolved['id'], $fileName, $options['content'], $options['description']);
		if (empty($result['success'])) {
			return ['error' => $result['message'] ?? 'Unable to create file'];
		}

		if ($options['json']) {
			return [
				'command' => 'cotton-create',
				'file_id' => $result['id'],
				'name' => $result['name'],
				'output' => json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
				'data' => $result,
			];
		}

		return [
			'command' => 'cotton-create',
			'file_id' => $result['id'],
			'name' => $result['name'],
			'output' => Text::_('COM_SHUTTLE_FILE_CREATED') . ': ' . $result['name'] . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . $result['id'] . ')',
			'data' => $result,
		];
	}

	public function handleCottonSave(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'json' => false,
			'content' => '',
		];

		$fileTarget = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
					case '--content':
						$options['content'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '--content':
						$options['content'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '--content':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($fileTarget === null && !str_starts_with($arg, '-')) {
						$fileTarget = $arg;
					}
					break;
			}
		}

		if ($fileTarget === null && $options['id'] === null) {
			return ['error' => 'cotton-save requires a file identifier'];
		}

		if ($options['id'] !== null) {
			$fileTarget = $options['id'];
		}

		$resolved = $this->cottonBridge->resolvePath($fileTarget);
		if (isset($resolved['error']) || ($resolved['type'] ?? '') !== 'file') {
			return ['error' => Text::_('COM_SHUTTLE_FILE_TARGET_NOT_FOUND') . ': ' . $fileTarget];
		}

		$result = $this->cottonBridge->saveFileContent((int) $resolved['id'], $options['content']);
		if (empty($result['success'])) {
			return ['error' => $result['message'] ?? 'Unable to save file'];
		}

		if ($options['json']) {
			return [
				'command' => 'cotton-save',
				'file_id' => $resolved['id'],
				'output' => json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
				'content' => $options['content'],
				'data' => $result,
			];
		}

		return [
			'command' => 'cotton-save',
			'file_id' => $resolved['id'],
			'output' => Text::_('COM_SHUTTLE_FILE_SAVED') . ': ' . ($resolved['name'] ?? $resolved['id']) . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . $resolved['id'] . ')',
			'content' => $options['content'],
			'data' => $result,
		];
	}

	public function handleWeaverSetContent(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'json' => false,
			'content' => '',
		];

		$fileTarget = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
					case '--content':
						$options['content'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '--content':
						$options['content'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '--content':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($fileTarget === null && !str_starts_with($arg, '-')) {
						$fileTarget = $arg;
					}
					break;
			}
		}

		if ($fileTarget === null && $options['id'] === null) {
			return ['error' => 'weaver-set-content requires a file identifier'];
		}

		if ($options['id'] !== null) {
			$fileTarget = $options['id'];
		}

		$resolved = $this->cottonBridge->resolvePath($fileTarget);
		if (isset($resolved['error']) || ($resolved['type'] ?? '') !== 'file') {
			return ['error' => Text::_('COM_SHUTTLE_FILE_TARGET_NOT_FOUND') . ': ' . $fileTarget];
		}

		$result = $this->cottonBridge->saveFileContent((int) $resolved['id'], $options['content']);
		if (empty($result['success'])) {
			return ['error' => $result['message'] ?? 'Unable to save file'];
		}

		if ($options['json']) {
			return [
				'command' => 'weaver-set-content',
				'file_id' => $resolved['id'],
				'output' => json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
				'content' => $options['content'],
				'data' => $result,
			];
		}

		return [
			'command' => 'weaver-set-content',
			'file_id' => $resolved['id'],
			'output' => Text::_('COM_SHUTTLE_FILE_UPDATED') . ': ' . ($resolved['name'] ?? $resolved['id']) . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . $resolved['id'] . ')',
			'content' => $options['content'],
			'data' => $result,
		];
	}

	public function handleWeaverTabs(array $args, string $cwd): array
	{
		return [
			'frontend_command' => 'weaver:tabs',
			'output' => 'Execute /weaver:tabs in the Weaver MCP panel to list open tabs.',
		];
	}

	public function handleWeaverActive(array $args, string $cwd): array
	{
		return [
			'frontend_command' => 'weaver:active',
			'output' => 'Execute /weaver:active in the Weaver MCP panel to show the active tab.',
		];
	}

	public function handleWeaverOpen(array $args, string $cwd): array
	{
		$fileId = $args[0] ?? null;
		return [
			'frontend_command' => 'weaver:open',
			'file_id' => $fileId,
			'output' => Text::_('COM_SHUTTLE_WEAVER_OPEN_HINT') . ' ' . ($fileId ?? '') . ' ' . Text::_('COM_SHUTTLE_WEAVER_OPEN_HINT_REST'),
		];
	}

	public function handleWeaverCreateFile(array $args, string $cwd): array
	{
		$folderId = $args[0] ?? null;
		$fileName = $args[1] ?? null;
		return [
			'frontend_command' => 'weaver:create-file',
			'folder_id' => $folderId,
			'file_name' => $fileName,
			'output' => Text::_('COM_SHUTTLE_WEAVER_CREATE_FILE_HINT') . ' ' . ($folderId ?? '') . ' ' . ($fileName ?? '') . ' ' . Text::_('COM_SHUTTLE_WEAVER_CREATE_FILE_HINT_REST'),
		];
	}

	public function handleWeaverCreateFolder(array $args, string $cwd): array
	{
		$folderId = $args[0] ?? null;
		$folderName = $args[1] ?? null;
		return [
			'frontend_command' => 'weaver:create-folder',
			'folder_id' => $folderId,
			'folder_name' => $folderName,
			'output' => Text::_('COM_SHUTTLE_WEAVER_CREATE_FOLDER_HINT') . ' ' . ($folderId ?? '') . ' ' . ($folderName ?? '') . ' ' . Text::_('COM_SHUTTLE_WEAVER_CREATE_FOLDER_HINT_REST'),
		];
	}

	public function handleWeaverSave(array $args, string $cwd): array
	{
		return [
			'frontend_command' => 'weaver:save',
			'output' => 'Execute /weaver:save in the Weaver MCP panel to save the active tab.',
		];
	}

	public function handleWeaverEdit(array $args, string $cwd): array
	{
		$fileId = $args[0] ?? null;
		return [
			'frontend_command' => 'weaver:edit',
			'file_id' => $fileId,
			'output' => Text::_('COM_SHUTTLE_WEAVER_EDIT_HINT') . ' ' . ($fileId ?? '') . ' ' . Text::_('COM_SHUTTLE_WEAVER_EDIT_HINT_REST'),
		];
	}

	public function handleWeaverRoot(array $args, string $cwd): array
	{
		return [
			'frontend_command' => 'weaver:root',
			'output' => 'Execute /weaver:root in the Weaver MCP panel to show the tree root folder ID.',
		];
	}

	public function handleCottonDelete(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'json' => false,
		];

		$fileTarget = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($fileTarget === null && !str_starts_with($arg, '-')) {
						$fileTarget = $arg;
					}
					break;
			}
		}

		if ($fileTarget === null && $options['id'] === null) {
			return ['error' => 'cotton-delete requires a file identifier'];
		}

		if ($options['id'] !== null) {
			$fileTarget = $options['id'];
		}

		$resolved = $this->cottonBridge->resolvePath($fileTarget);
		if (isset($resolved['error']) || ($resolved['type'] ?? '') !== 'file') {
			return ['error' => Text::_('COM_SHUTTLE_FILE_TARGET_NOT_FOUND') . ': ' . $fileTarget];
		}

		$result = $this->cottonBridge->deleteFile((int) $resolved['id']);
		if (empty($result['success'])) {
			return ['error' => $result['message'] ?? 'Unable to delete file'];
		}

		if ($options['json']) {
			return [
				'command' => 'cotton-delete',
				'file_id' => $resolved['id'],
				'output' => json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
				'data' => $result,
			];
		}

		return [
			'command' => 'cotton-delete',
			'file_id' => $resolved['id'],
			'output' => Text::_('COM_SHUTTLE_FILE_DELETED') . ': ' . ($resolved['name'] ?? $resolved['id']) . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . $resolved['id'] . ')',
			'data' => $result,
		];
	}

	public function handleRun(array $args, string $cwd): array
	{
		$options = [
			'id' => null,
			'json' => false,
			'dryRun' => false,
			'verbose' => false,
			'startLine' => null,
			'endLine' => null,
		];

		$scriptTarget = null;
		$pendingOption = null;

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '-i':
					case '--id':
						$options['id'] = $arg;
						break;
					case '--start-line':
						$options['startLine'] = $arg;
						break;
					case '--end-line':
						$options['endLine'] = $arg;
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '-i':
					case '--id':
						$options['id'] = $value;
						break;
					case '--start-line':
						$options['startLine'] = $value;
						break;
					case '--end-line':
						$options['endLine'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
				}
				continue;
			}

			switch ($arg) {
				case '-i':
				case '--id':
					$pendingOption = $arg;
					break;
				case '--dry-run':
					$options['dryRun'] = true;
					break;
				case '--verbose':
					$options['verbose'] = true;
					break;
				case '--start-line':
					$pendingOption = $arg;
					break;
				case '--end-line':
					$pendingOption = $arg;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				default:
					if ($scriptTarget === null && !str_starts_with($arg, '-')) {
						$scriptTarget = $arg;
					}
					break;
			}
		}

		if ($scriptTarget === null && $options['id'] === null) {
			return ['error' => 'run requires a script id or path'];
		}

		$scriptTarget = $options['id'] ?? $scriptTarget;
		$runner = new ShuttleModelScriptRunner($this->cottonBridge, $this);
		$result = $runner->runScript($scriptTarget, $cwd, $options);

		if ($options['json']) {
			return [
				'command' => 'run',
				'script' => $scriptTarget,
				'output' => json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
				'data' => $result,
			];
		}

		return $result;
	}

	protected function normalizeOptions(array $tokens): array
	{
		$options = [];
		$bufferIndex = null;

		foreach ($tokens as $token) {
			if ($token === '--list') {
				$options['list'] = true;
				continue;
			}

			if (strpos($token, '--get=') === 0) {
				$options['get'] = substr($token, 6);
				continue;
			}

			if ($token === '--get') {
				$bufferIndex = 'get';
				continue;
			}

			if (strpos($token, '--patch=') === 0) {
				$options['patch'] = substr($token, 8);
				continue;
			}

			if ($token === '--patch') {
				$bufferIndex = 'patch';
				continue;
			}

			if ($bufferIndex !== null) {
				$options[$bufferIndex] = $token;
				$bufferIndex = null;
				continue;
			}

			if (strpos($token, '--content=') === 0) {
				$options['content'] = substr($token, 10);
				continue;
			}

			if (strpos($token, '--diff=') === 0) {
				$options['diff'] = substr($token, 7);
				continue;
			}

			if (strpos($token, '--id=') === 0) {
				$options['id'] = substr($token, 5);
				continue;
			}

			if (strpos($token, '-i=') === 0) {
				$options['id'] = substr($token, 3);
				continue;
			}
		}

		return $options;
	}

	protected function formatCatOutput(string $content, array $options): string
	{
		if ($content === '') {
			return '';
		}

		$lines = preg_split('/\r\n|\r|\n/', $content);
		$outputLines = [];
		$blankCount = 0;

		foreach ($lines as $index => $line) {
			if ($options['squeezeBlank']) {
				if ($line === '') {
					$blankCount++;
					if ($blankCount > 1) {
						continue;
					}
				} else {
					$blankCount = 0;
				}
			}

			$prefix = '';
			if ($options['number'] || $options['numberNonblank']) {
				if ($options['number'] || $line !== '') {
					$prefix = str_pad($index + 1, 6, ' ', STR_PAD_LEFT) . "\t";
				}
			}

			$outputLines[] = $prefix . $line;
		}

		return implode("\n", $outputLines);
	}

	protected function formatFileSize(int $bytes): string
	{
		if ($bytes === 0) {
			return '0 B';
		}

		$k = 1024;
		$sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		$i = (int) floor(log($bytes) / log($k));
		return round($bytes / pow($k, $i), 2) . ' ' . $sizes[$i];
	}

	private function callKiloApi(array $payload, string $baseUrl, string $apiKey, bool $stream = false): array
	{
		$context = stream_context_create([
			'http' => [
				'method' => 'POST',
				'header' => "Content-Type: application/json\r\n" .
					"Authorization: Bearer {$apiKey}\r\n",
				'content' => json_encode($payload),
				'timeout' => $stream ? 60 : 30,
				'ignore_errors' => true,
			],
		]);

		$response = @file_get_contents($baseUrl . '/chat/completions', false, $context);

		if ($response === false && function_exists('curl_init')) {
			$response = $this->curlPost($baseUrl . '/chat/completions', $payload, $apiKey, $stream ? 60 : 30);
		}

		if ($response === false) {
			$error = error_get_last();
			return [
				'error' => true,
				'message' => $error['message'] ?? 'Unknown error',
				'debug' => $error['message'] ?? null,
			];
		}

		$statusLine = $http_response_header[0] ?? '';
		$statusCode = 0;
		if (preg_match('#HTTP/\d+\.\d+ (\d+)#', $statusLine, $matches)) {
			$statusCode = (int) $matches[1];
		}

		if ($statusCode >= 400) {
			$decodedError = json_decode($response, true);
			//error_log('[Shuttle KILO API Error] Status: ' . $statusCode . ' Response: ' . $response);
			return [
				'error' => true,
				'status_code' => $statusCode,
				'message' => $decodedError['error']['message'] ?? ($decodedError['message'] ?? 'KILO API error'),
				'response' => $response,
				'decoded_error' => $decodedError,
			];
		}

		$decoded = json_decode($response, true);
		if (!is_array($decoded)) {
			//error_log('[Shuttle KILO API Error] Invalid JSON response: ' . $response);
			return [
				'error' => true,
				'message' => 'Invalid JSON response from KILO API',
				'raw_response' => $response,
			];
		}

		return [
			'error' => false,
			'status_code' => $statusCode,
			'data' => $decoded,
			'raw_response' => $response,
		];
	}

	public function buildAiSystemPrompt(string $mode, array $tools, array $resources, array $prompts): string
	{
		$toolsDesc = $this->buildToolsDescription($tools);
		$resourcesDesc = $this->buildResourcesDescription($resources);
		$promptsDesc = $this->buildPromptsDescription($prompts);

		$modeSuffix = match (strtolower($mode)) {
			'ask' => 'MODO ASK: Responda perguntas de forma clara e didática. Priorize explicações e documentação.',
			'debug' => 'MODO DEBUG: Analise erros e falhas sistematicamente. Sugira causas, soluções e passos de investigação.',
			'plan' => 'MODO PLAN: Estruture tarefas em passos organizados. Sugira arquiteturas, divisões e ordens de execução.',
			default => 'MODO CODE: Foque em gerar e editar código, scripts e implementações técnicas. Seja preciso e objetivo.',
		};

		$base = <<<PROMPT
Você é um assistente especializado em comandos do terminal Shuttle do Cotton Cloud e no editor Weaver.
Você tem acesso às seguintes ferramentas MCP:

{$toolsDesc}

Você também tem acesso aos seguintes recursos MCP:

{$resourcesDesc}

E aos seguintes prompts MCP:

{$promptsDesc}

Você também tem acesso direto ao editor Weaver para gerenciar abas e arquivos:

Ferramentas locais do Weaver:
1. /weaver:tabs - Lista todas as abas abertas no editor Weaver.
2. /weaver:active - Mostra a aba ativa no momento.
3. /weaver:open <fileId> - Abre um arquivo em uma nova aba no Weaver.
4. /weaver:create-file <folderId> <nome-do-arquivo> - Cria um novo arquivo no Weaver.
5. /weaver:create-folder <folderId> <nome-da-pasta> - Cria uma nova pasta no Weaver.
6. /weaver:save - Salva o conteúdo da aba ativa no Weaver.
7. /weaver:edit <fileId> <conteudo> - Edita o conteúdo de uma aba aberta diretamente no CodeMirror.
8. /weaver:root - Mostra o ID da pasta raiz da árvore do Weaver.

REGRAS IMPORTANTES:
- Sempre que o usuário pedir algo que possa ser feito com essas ferramentas MCP, use a ferramenta apropriada.
- Para ações no editor Weaver (abrir arquivo, criar arquivo, criar pasta, salvar, listar abas), use as ferramentas locais do Weaver.
- NÃO execute ações destrutivas (rmdir, sed -i, mv, cp) sem confirmação explícita do usuário.
- Para comandos de leitura (ls, cat, head, tail, grep, cc-resolve), execute diretamente.
- Para comandos de escrita/edição (sed, mkdir, rmdir, mv, cp, run), peça confirmação se o usuário não foi explícito.
- Responda em português brasileiro.
- Se o usuário pedir algo que não pode ser feito com essas ferramentas, explique o que é possível fazer.

GUIA DE USO DAS FERRAMENTAS DE NAVEGAÇÃO:
- ls: Use para LISTAR o conteúdo de uma pasta. Se o usuário pedir para "ver arquivos", "listar pasta", "o que tem na pasta", use ls.
- find: Use para BUSCAR arquivos ou pastas por NOME ou CAMINHO. Sempre forneça o termo de busca no parametro obrigatorio "query". NUNCA chame find sem argumentos.
- grep: Use para BUSCAR CONTEÚDO DENTRO de arquivos. Forneça um padrao de busca e o arquivo ou caminho alvo.
- NUNCA use find como substituto de ls para listar diretorios. Se precisar listar uma pasta, use ls.

REGRA DE PARÂMETROS OBRIGATÓRIOS:
- Se uma ferramenta tem parametros marcados como (obrigatorio), voce DEVE fornece-los na chamada. Chamadas sem parametros obrigatorios causam erro.
{$modeSuffix}
PROMPT;

		return trim($base);
	}

	public function buildToolsDescription(array $tools): string
	{
		if (empty($tools)) {
			return 'Nenhuma ferramenta MCP disponível no momento.';
		}

		$lines = [];
		foreach ($tools as $index => $tool) {
			$name = $tool['name'] ?? 'unknown';
			$description = $tool['description'] ?? 'Sem descrição';
			$schema = $tool['inputSchema'] ?? [];
			$properties = $schema['properties'] ?? [];
			$required = array_map('strval', $schema['required'] ?? []);

			$paramsDesc = 'Sem parâmetros';
			if (!empty($properties)) {
				$params = [];
				foreach ($properties as $key => $prop) {
					$type = $prop['type'] ?? 'any';
					$desc = $prop['description'] ?? '';
					$req = in_array($key, $required, true) ? ' (obrigatório)' : '';
					$params[] = "  - {$key} ({$type}){$req}: {$desc}";
				}
				$paramsDesc = implode("\n", $params);
			}

			$lines[] = ($index + 1) . ". {$name} - {$description}\nParâmetros:\n{$paramsDesc}";
		}

		return implode("\n\n", $lines);
	}

	public function buildResourcesDescription(array $resources): string
	{
		if (empty($resources)) {
			return 'Nenhum recurso MCP disponível no momento.';
		}

		$lines = [];
		foreach ($resources as $index => $resource) {
			$name = $resource['name'] ?? 'unknown';
			$description = $resource['description'] ?? 'Sem descrição';
			$uri = $resource['uri'] ?? '';
			$mimeType = $resource['mimeType'] ?? 'unknown';

			$lines[] = ($index + 1) . ". {$name} ({$uri})\n   Tipo: {$mimeType}\n   Descrição: {$description}";
		}

		return implode("\n\n", $lines);
	}

	public function buildPromptsDescription(array $prompts): string
	{
		if (empty($prompts)) {
			return 'Nenhum prompt MCP disponível no momento.';
		}

		$lines = [];
		foreach ($prompts as $index => $prompt) {
			$name = $prompt['name'] ?? 'unknown';
			$description = $prompt['description'] ?? 'Sem descrição';
			$promptArgs = $prompt['arguments'] ?? [];

			$argsDesc = 'Sem argumentos';
			if (!empty($promptArgs)) {
				$args = [];
				foreach ($promptArgs as $arg) {
					$required = !empty($arg['required']) ? ' (obrigatório)' : ' (opcional)';
					$args[] = "  - {$arg['name']}: {$arg['description']}{$required}";
				}
				$argsDesc = implode("\n", $args);
			}

			$lines[] = ($index + 1) . ". {$name} - {$description}\nArgumentos:\n{$argsDesc}";
		}

		return implode("\n\n", $lines);
	}

	public function handleAi(array $args, string $cwd): array
	{
		$options = [
			'model' => 'kilo-auto/free',
			'stream' => false,
			'json' => false,
			'mode' => 'code',
		];

		$promptParts = [];
		$pendingOption = null;
		$mcpTools = [];
		$mcpResources = [];
		$mcpPrompts = [];
		$conversationHistory = [];

		foreach ($args as $arg) {
			if ($pendingOption !== null) {
				switch ($pendingOption) {
					case '--model':
						$options['model'] = $arg;
						break;
					case '--mode':
						$options['mode'] = $arg;
						break;
					case '--mcp-tools':
						$mcpTools = json_decode($arg, true) ?: [];
						break;
					case '--mcp-resources':
						$mcpResources = json_decode($arg, true) ?: [];
						break;
					case '--mcp-prompts':
						$mcpPrompts = json_decode($arg, true) ?: [];
						break;
					case '--conversation':
						$conversationHistory = json_decode($arg, true) ?: [];
						break;
				}
				$pendingOption = null;
				continue;
			}

			if (str_contains($arg, '=')) {
				[$name, $value] = explode('=', $arg, 2);
				switch ($name) {
					case '--model':
						$options['model'] = $value;
						break;
					case '--mode':
						$options['mode'] = $value;
						break;
					case '-j':
					case '--json':
						$options['json'] = true;
						break;
					case '--mcp-tools':
						$mcpTools = json_decode($value, true) ?: [];
						break;
					case '--mcp-resources':
						$mcpResources = json_decode($value, true) ?: [];
						break;
					case '--mcp-prompts':
						$mcpPrompts = json_decode($value, true) ?: [];
						break;
					case '--conversation':
						$conversationHistory = json_decode($value, true) ?: [];
						break;
				}
				continue;
			}

			switch ($arg) {
				case '--model':
					$pendingOption = $arg;
					break;
				case '--mode':
					$pendingOption = $arg;
					break;
				case '--stream':
					$options['stream'] = true;
					break;
				case '-j':
				case '--json':
					$options['json'] = true;
					break;
				case '--mcp-tools':
					$pendingOption = $arg;
					break;
				case '--mcp-resources':
					$pendingOption = $arg;
					break;
				case '--mcp-prompts':
					$pendingOption = $arg;
					break;
				case '--conversation':
					$pendingOption = $arg;
					break;
				default:
					if (!str_starts_with($arg, '-')) {
						$promptParts[] = $arg;
					}
					break;
			}
		}

		$prompt = trim(implode(' ', $promptParts));

		if ($prompt === '' && empty($conversationHistory)) {
			return ['error' => 'ai requires a prompt'];
		}

		$apiKey = \Tabaoca\Component\Shuttle\Site\Model\Service\ShuttleJwtMiddleware::getUserApiKey();
		$baseUrl = 'https://api.kilo.ai/api/gateway';

		if ($apiKey === '') {
			return ['error' => 'Missing API key. Configure kilocode-api-key in your profile or set KILO_API_KEY.'];
		}

		$systemPrompt = $this->buildAiSystemPrompt($options['mode'], $mcpTools, $mcpResources, $mcpPrompts);

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

		$model = strtolower($options['model']);

		$toolsPayload = [];
		if (!empty($mcpTools)) {
			$toolsPayload = array_values(array_filter(array_map(function ($tool) {
				if (!isset($tool['name']) || !isset($tool['description'])) {
					return null;
				}

				$function = [
					'name' => $tool['name'],
					'description' => $tool['description'],
				];

				if (!empty($tool['inputSchema'])) {
					$function['parameters'] = $tool['inputSchema'];
				}

				return [
					'type' => 'function',
					'function' => $function,
				];
			}, $mcpTools)));
		}

		$maxToolRounds = 5;
		$allToolCalls = [];
		$finalMessage = '';
		$finalData = null;
		$toolResultsForResponse = [];

		$systemPromptLength = strlen($systemPrompt);
		$toolsCount = count($toolsPayload);
		$messagesCount = count($messages);

		//error_log('[Shuttle KILO Debug] Model: ' . $options['model'] . ' | SystemPromptLength: ' . $systemPromptLength . ' | ToolsCount: ' . $toolsCount . ' | MessagesCount: ' . $messagesCount);

		for ($round = 0; $round < $maxToolRounds; $round++) {
			$payload = [
				'model' => $options['model'],
				'messages' => $messages,
				'temperature' => 0.3,
				'max_tokens' => 4096,
			];

			if (!empty($toolsPayload)) {
				$payload['tools'] = $toolsPayload;
			}

			$payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
			//error_log('[Shuttle KILO Payload] Round ' . ($round + 1) . ': ' . $payloadJson);

			$apiResult = $this->callKiloApi($payload, $baseUrl, $apiKey, false);

			if ($apiResult['error']) {
				$debugInfo = [
					'error' => $apiResult['message'] ?? 'Failed to connect to KILO API',
					'debug' => $apiResult['debug'] ?? null,
					'base_url' => $baseUrl,
					'status_code' => $apiResult['status_code'] ?? null,
					'raw_debug' => $apiResult,
				];

				return [
					'error' => 'KILO API error',
					'status_code' => $apiResult['status_code'] ?? null,
					'response' => $apiResult['raw_response'] ?? null,
					'decoded_error' => $apiResult['decoded_error'] ?? null,
					'base_url' => $baseUrl,
					'model' => $options['model'],
					'error_message' => $apiResult['message'] ?? 'Unknown error',
					'raw_debug' => $debugInfo,
				];
			}

		$decoded = $apiResult['data'];
		$message = $decoded['choices'][0]['message']['content'] ?? '';
		$toolCalls = $decoded['choices'][0]['message']['tool_calls'] ?? [];

		if ($message === '' && !empty($decoded['choices'][0]['message']['reasoning'])) {
			$message = $decoded['choices'][0]['message']['reasoning'];
		}

			if ($round > 0) {
				$finalMessage = $message;
				$finalData = $decoded;
			} else {
				$finalMessage = $message;
				$finalData = $decoded;
			}

			if (empty($toolCalls)) {
				break;
			}

			$assistantMessage = [
				'role' => 'assistant',
				'content' => $message ?: null,
				'tool_calls' => $toolCalls,
			];
			$messages[] = $assistantMessage;

			$allToolCalls = array_merge($allToolCalls, $toolCalls);

			foreach ($toolCalls as $call) {
				$name = $call['function']['name'] ?? $call['name'] ?? '';
				$arguments = $call['function']['arguments'] ?? $call['arguments'] ?? '{}';

				if (!is_string($arguments)) {
					$arguments = json_encode($arguments);
				}

				$args = json_decode($arguments, true) ?: [];

				try {
					$mcpResult = $this->executeAiToolCalls([$call]);
					$toolResult = $mcpResult[0]['result'] ?? ['success' => false, 'output' => 'Unknown error'];

					$toolResultsForResponse[] = [
						'name' => $name,
						'arguments' => $args,
						'result' => $toolResult,
					];

					$toolMessage = [
						'role' => 'tool',
						'tool_call_id' => $call['id'] ?? uniqid('tool_', true),
						'content' => $toolResult['output'] ?? json_encode($toolResult),
					];
					$messages[] = $toolMessage;
				} catch (\Throwable $e) {
					$toolResultsForResponse[] = [
						'name' => $name,
						'arguments' => $args,
						'result' => [
							'success' => false,
							'output' => $e->getMessage(),
							'isError' => true,
						],
					];

					$toolMessage = [
						'role' => 'tool',
						'tool_call_id' => $call['id'] ?? uniqid('tool_', true),
						'content' => $e->getMessage(),
					];
					$messages[] = $toolMessage;
				}
			}
		}

		$result = [
			'command' => 'ai',
			'prompt' => $prompt,
			'model' => $options['model'],
			'stream' => $options['stream'],
			'output' => $finalMessage,
			'data' => $finalData,
			'tool_calls' => $allToolCalls,
		];

		if (!empty($allToolCalls)) {
			$result['tool_results'] = $toolResultsForResponse;
			$result['has_tool_calls'] = true;
		}

		return $result;
	}

	private function executeAiToolCalls(array $toolCalls): array
	{
		$server = new \Tabaoca\Component\Shuttle\Site\Model\Service\ShuttleMCPServer();
		$results = [];

		foreach ($toolCalls as $call) {
			$name = $call['function']['name'] ?? $call['name'] ?? '';
			$arguments = $call['function']['arguments'] ?? $call['arguments'] ?? '{}';

			if (!is_string($arguments)) {
				$arguments = json_encode($arguments);
			}

			$args = json_decode($arguments, true) ?: [];

			try {
				$mcpResult = $server->callTool($name, $args);

				if (isset($mcpResult['error'])) {
					$results[] = [
						'name' => $name,
						'arguments' => $args,
						'result' => [
							'success' => false,
							'output' => $mcpResult['error']['message'] ?? 'Unknown error',
							'isError' => true,
							'code' => $mcpResult['error']['code'] ?? null,
						],
					];
					continue;
				}

				$content = $mcpResult['result']['content'][0]['text'] ?? json_encode($mcpResult);
				$isError = !empty($mcpResult['result']['isError']);

				$results[] = [
					'name' => $name,
					'arguments' => $args,
					'result' => [
						'success' => !$isError,
						'output' => $content,
						'isError' => $isError,
						'metadata' => $mcpResult['result']['metadata'] ?? [],
					],
				];
			} catch (\Throwable $e) {
				$results[] = [
					'name' => $name,
					'arguments' => $args,
					'result' => [
						'success' => false,
						'output' => $e->getMessage(),
						'isError' => true,
					],
				];
			}
		}

		return $results;
	}

}
