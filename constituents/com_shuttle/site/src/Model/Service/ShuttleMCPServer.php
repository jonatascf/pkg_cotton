<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Shuttle\Site\Model\Service;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;

class ShuttleMCPServer
{
	protected CottonBridge $cottonBridge;
	protected CommandInterpreter $interpreter;
	protected array $toolCache = [];
	protected array $modelListCache = [];
	protected int $modelCacheTtl = 10;

	public function __construct(CottonBridge $cottonBridge = null, CommandInterpreter $interpreter = null)
	{
		$this->cottonBridge = $cottonBridge ?? new CottonBridge();
		$this->interpreter = $interpreter ?? new CommandInterpreter($this->cottonBridge);
		$this->interpreter->setToolCallCallback([$this, 'callTool']);
		$this->loadCommandRules();
	}

	private function loadCommandRules(): void
	{
		$file = JPATH_ROOT . '/media/com_shuttle/js/CommandRules.json';

		if (!is_readable($file)) {
			return;
		}

		$json = file_get_contents($file);
		if ($json === false) {
			return;
		}

		$rules = json_decode($json, true);
		if (!is_array($rules)) {
			return;
		}

		foreach ($rules as $command => $definition) {
			if (!is_array($definition)) {
				continue;
			}

			$description = $definition['description'] ?? 'Comando: ' . $command;
			$schema = $this->buildCommandSchema($definition);
			$properties = $schema['properties'] ?? [];
			$required = $schema['required'] ?? [];

			$tool = [
				'name' => $command,
				'description' => $description,
			];

			if (!empty($properties)) {
				$tool['inputSchema'] = [
					'type' => 'object',
					'properties' => $properties,
				];

				if (!empty($required)) {
					$tool['inputSchema']['required'] = $required;
				}
			}

			$this->toolCache[$command] = $tool;

			if ($command === 'cat') {
				//error_log('[Shuttle MCP] cat tool schema: ' . json_encode($tool, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
			}
		}
	}

	private function buildCommandSchema(array $definition): array
	{
		$properties = [];
		$required = [];
		$description = $definition['description'] ?? '';
		$paramDescription = $definition['parameters']['description'] ?? '';
		$parameters = $definition['parameters'] ?? ['min' => 0, 'max' => 0];
		$min = (int) ($parameters['min'] ?? 0);
		$options = $definition['options'] ?? [];

		if (preg_match('/Opcional\. O caminho do diretorio[^.]*\./', $description, $match)) {
			$properties['path'] = ['type' => 'string', 'description' => 'Caminho opcional da pasta'];
		}

		if (preg_match('/O caminho virtual ou ID[^.]*\./', $description, $match) || preg_match('/O caminho virtual ou ID[^.]*\./', $paramDescription, $match)) {
			$properties['target'] = ['type' => 'string', 'description' => 'Caminho virtual ou ID do item'];
		}

		if (preg_match('/O ID ou caminho[^.]*\./', $description, $match) || preg_match('/O ID ou caminho[^.]*\./', $paramDescription, $match)) {
			$properties['target'] = ['type' => 'string', 'description' => 'Caminho virtual ou ID do item'];
		}

		if (preg_match('/caminho virtual ou ID[^.]*\./', $paramDescription, $match)) {
			$properties['target'] = ['type' => 'string', 'description' => 'Caminho virtual ou ID do item'];
		}

		if (preg_match('/caminho virtual ou ID[^.]*\./', $description, $match)) {
			$properties['target'] = ['type' => 'string', 'description' => 'Caminho virtual ou ID'];
		}

		if (preg_match('/O caminho virtual do Cotton ou ID[^.]*\./', $description, $match)) {
			$properties['target'] = ['type' => 'string', 'description' => 'Caminho virtual ou ID'];
		}

		if (preg_match('/-?\s?Procura arquivos e pastas[^.]*por termo de nome ou caminho/', $description, $match)) {
			$properties['query'] = ['type' => 'string', 'description' => 'Termo de busca ou caminho virtual'];
		}

		if (preg_match('/Searches for files and folders[^.]*by name or path term/i', $description, $match)) {
			$properties['query'] = ['type' => 'string', 'description' => 'Search term or virtual path'];
		}

		if (preg_match('/O caminho virtual[^.]*\./', $description, $match)) {
			$properties['path'] = ['type' => 'string', 'description' => 'Caminho virtual'];
		}

		if (preg_match('/Lists files and directories[^.]*specific path/i', $description, $match)) {
			$properties['path'] = ['type' => 'string', 'description' => 'Optional directory path'];
		}

		if (preg_match('/Displays the content of a Cotton Cloud file/i', $description, $match)) {
			$properties['target'] = ['type' => 'string', 'description' => 'Virtual path or numeric ID of the file'];
		}

		if (preg_match('/Searches for patterns in Cotton Cloud files/i', $description, $match)) {
			$properties['pattern'] = ['type' => 'string', 'description' => 'Search pattern'];
			$properties['targets'] = ['type' => 'array', 'description' => 'Files or paths to search', 'items' => ['type' => 'string']];
		}

		if (preg_match('/Displays the first lines of a Cotton Cloud file/i', $description, $match) || preg_match('/Displays the last lines of a Cotton Cloud file/i', $description, $match)) {
			$properties['target'] = ['type' => 'string', 'description' => 'Virtual path or numeric ID of the file'];
		}

		if (preg_match('/Creates a directory/i', $description, $match)) {
			$properties['path'] = ['type' => 'string', 'description' => 'Directory path to create'];
		}

		if (preg_match('/Removes a directory/i', $description, $match)) {
			$properties['target'] = ['type' => 'string', 'description' => 'Virtual path or numeric ID of the directory'];
		}

		if (preg_match('/Renames or moves/i', $description, $match)) {
			$properties['source'] = ['type' => 'string', 'description' => 'Source path or ID'];
			$properties['destination'] = ['type' => 'string', 'description' => 'Destination path or ID'];
		}

		if (preg_match('/Copies a file or folder/i', $description, $match)) {
			$properties['source'] = ['type' => 'string', 'description' => 'Source path or ID'];
			$properties['destination'] = ['type' => 'string', 'description' => 'Destination path or ID'];
		}

		if (preg_match('/Executes a command or script/i', $description, $match)) {
			$properties['target'] = ['type' => 'string', 'description' => 'Virtual path or numeric ID of the script/file to execute'];
		}

		if (preg_match('/Usa o ID num[^.]*do arquivo em vez de um caminho virtual/', $description, $match)) {
			$properties['id'] = ['type' => 'string', 'description' => 'ID numérico do arquivo'];
		}

		if (preg_match('/Cria um arquivo no Cotton Cloud/', $description, $match)) {
			$properties['folder'] = ['type' => 'string', 'description' => 'Caminho virtual ou ID da pasta onde criar o arquivo'];
			$properties['name'] = ['type' => 'string', 'description' => 'Nome do arquivo a ser criado'];
		}

		if (preg_match('/express[oã]es? sed/', $description, $match) || preg_match('/express[oã]es? sed/', $paramDescription, $match)) {
			$properties['expressions'] = ['type' => 'array', 'description' => 'Expressões sed a serem executadas', 'items' => ['type' => 'string']];
		}

		foreach ($options as $option) {
			$name = $option['name'] ?? '';
			$alias = $option['alias'] ?? '';
			$desc = $option['description'] ?? '';
			$hasValue = $option['hasValue'] ?? false;

			if ($name === '') {
				continue;
			}

			$longKey = str_starts_with($name, '--') ? ltrim($name, '-') : null;
			$aliasKey = $alias !== '' && str_starts_with($alias, '--') ? ltrim($alias, '-') : null;
			$type = $hasValue ? 'string' : 'boolean';

			if ($longKey && !isset($properties[$longKey])) {
				$properties[$longKey] = ['type' => $type, 'description' => $desc];
			}

			if ($aliasKey && !isset($properties[$aliasKey])) {
				$properties[$aliasKey] = ['type' => $type, 'description' => $desc];
			}
		}

		if ($min > 0) {
			if (isset($properties['query']) && $min === 1) {
				$required = ['query'];
			} elseif (isset($properties['target']) && $min === 1) {
				$required = ['target'];
			} elseif (isset($properties['target'], $properties['expressions']) && $min >= 2) {
				$required = ['target', 'expressions'];
			} elseif (isset($properties['folder'], $properties['name']) && $min >= 2) {
				$required = ['folder', 'name'];
			} else {
				$required = array_slice(array_keys($properties), 0, $min);
			}
		}

		return [
			'properties' => $properties,
			'required' => $required,
		];
	}

	private function getCached(string $key, callable $fallback, int $ttl = null)
	{
		$ttl = $ttl ?? $this->modelCacheTtl;
		$cache = Factory::getApplication()->get('cache');

		if ($cache === null) {
			return $fallback();
		}

		$cached = $cache->get($key, 'com_shuttle');

		if ($cached !== false && (time() - ($cached['cached_at'] ?? 0)) < $ttl) {
			return $cached['data'];
		}

		$data = $fallback();
		$cache->store(['cached_at' => time(), 'data' => $data], $key, 'com_shuttle');

		return $data;
	}

	public function getCachedTools(): array
	{
		return $this->getCached('mcp.tools', function () {
			return $this->listTools();
		});
	}

	public function getCachedModelList(): array
	{
		return $this->getCached('mcp.models', function () {
			return $this->fetchModelList();
		}, 600);
	}

	private function fetchModelList(): array
	{
		$url = 'https://api.kilo.ai/api/gateway/models';

		try {
			$response = @file_get_contents($url);

			if ($response === false) {
				return [];
			}

			$data = json_decode($response, true);

			return array_map(static function ($model) {
				return [
					'id' => $model['id'] ?? '',
					'name' => $model['name'] ?? $model['id'],
					'owned_by' => $model['owned_by'] ?? '',
					'pricing' => $model['pricing'] ?? [],
					'context_length' => $model['context_length'] ?? null,
					'free' => isset($model['pricing']['prompt']) && $model['pricing']['prompt'] === '0'
						&& isset($model['pricing']['completion']) && $model['pricing']['completion'] === '0',
				];
			}, array_filter($data['data'] ?? [], static fn ($m) => !empty($m['id'])));
		} catch (\Throwable) {
			return [];
		}
	}

	public function getFreeModels(): array
	{
		$models = $this->getCachedModelList();

		return array_values(array_filter($models, static fn ($m) => $m['free']));
	}

	public function listTools(): array
	{
		if (!empty($this->toolCache)) {
			//error_log('[Shuttle MCP] listTools cache hit, count=' . count($this->toolCache));
			if (isset($this->toolCache['cat'])) {
				//error_log('[Shuttle MCP] cat schema: ' . json_encode($this->toolCache['cat'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
			}
			return [
				'jsonrpc' => '2.0',
				'result' => [
					'tools' => array_values($this->toolCache),
				],
			];
		}

		return [
			'jsonrpc' => '2.0',
			'result' => [
				'tools' => [],
			],
		];
	}

	private function initialize(): array
	{
		return [
			'jsonrpc' => '2.0',
			'result' => [
				'protocolVersion' => '2024-11-05',
				'capabilities' => [
					'tools' => new \stdClass(),
					'resources' => new \stdClass(),
					'prompts' => new \stdClass(),
				],
				'serverInfo' => [
					'name' => 'shuttle-mcp',
					'version' => '2.0.0',
				],
			],
		];
	}

	public function handleRequest(array $request): array
	{
		$method = $request['method'] ?? '';

		switch ($method) {
			case 'initialize':
				return $this->initialize();
			case 'tools/list':
				return $this->listTools();
			case 'tools/call':
				return $this->callTool($request['params']['name'] ?? '', $request['params']['arguments'] ?? []);
			case 'resources/list':
				return $this->listResources();
			case 'resources/read':
				return $this->readResource($request['params']['uri'] ?? '');
			case 'prompts/list':
				return $this->listPrompts();
			case 'models/list':
				return $this->listModels();
			default:
				return $this->error('Method not found: ' . $method, -32601);
		}
	}

	public function callTool(string $name, array $arguments): array
	{
		$cwd = '/';

		$normalizedArguments = $arguments;

		if ($name === 'cat' || $name === 'head' || $name === 'tail' || $name === 'grep' || $name === 'sed' || $name === 'cc-resolve' || $name === 'cotton-save' || $name === 'cotton-create' || $name === 'weaver-set-content') {
			if (array_key_exists('i', $normalizedArguments) && !array_key_exists('id', $normalizedArguments)) {
				$normalizedArguments['id'] = $normalizedArguments['i'];
			}
		}

		//error_log('[Shuttle MCP] callTool: ' . $name . ' args=' . json_encode($arguments) . ' normalized=' . json_encode($normalizedArguments));

		try {
			$result = match ($name) {
				'ls' => $this->interpreter->handleLs($this->buildLsArgs($normalizedArguments), $cwd),
				'find' => $this->interpreter->handleFind($this->buildFindArgs($normalizedArguments), $cwd),
				'cat' => $this->interpreter->handleCat($this->buildTargetArgs($normalizedArguments, 'target'), $cwd),
				'head' => $this->interpreter->handleHead($this->buildHeadTailArgs($normalizedArguments), $cwd),
				'tail' => $this->interpreter->handleTail($this->buildHeadTailArgs($normalizedArguments), $cwd),
				'grep' => $this->interpreter->handleGrep($this->buildGrepArgs($normalizedArguments), $cwd),
				'sed' => $this->interpreter->handleSed($this->buildSedArgs($normalizedArguments), $cwd),
				'mkdir' => $this->handleMkdirMCP($normalizedArguments),
				'rmdir' => $this->interpreter->handleRmdir($this->buildRmdirArgs($normalizedArguments), $cwd),
				'mv' => $this->interpreter->handleMv([$normalizedArguments['source'] ?? '', $normalizedArguments['destination'] ?? ''], $cwd),
				'cp' => $this->interpreter->handleCp($this->buildCpArgs($normalizedArguments), $cwd),
				'cc-resolve' => $this->interpreter->handleCcResolve($this->buildTargetArgs($normalizedArguments, 'target'), $cwd),
				'run' => $this->interpreter->handleRun($this->buildRunArgs($normalizedArguments), $cwd),
				'cotton-create' => $this->handleCottonCreateMCP($normalizedArguments),
				'cotton-save' => $this->interpreter->handleCottonSave($this->buildCottonSaveArgs($normalizedArguments), $cwd),
				'weaver-set-content' => $this->interpreter->handleWeaverSetContent($this->buildWeaverSetContentArgs($normalizedArguments), $cwd),
				'weaver:tabs' => $this->interpreter->handleWeaverTabs($normalizedArguments, $cwd),
				'weaver:active' => $this->interpreter->handleWeaverActive($normalizedArguments, $cwd),
				'weaver:open' => $this->interpreter->handleWeaverOpen($normalizedArguments, $cwd),
				'weaver:create-file' => $this->interpreter->handleWeaverCreateFile($normalizedArguments, $cwd),
				'weaver:create-folder' => $this->interpreter->handleWeaverCreateFolder($normalizedArguments, $cwd),
				'weaver:save' => $this->interpreter->handleWeaverSave($normalizedArguments, $cwd),
				'weaver:edit' => $this->interpreter->handleWeaverEdit($normalizedArguments, $cwd),
				'weaver:root' => $this->interpreter->handleWeaverRoot($normalizedArguments, $cwd),
				default => $this->executeShuttleCommand($name, $normalizedArguments, $cwd),
			};
		} catch (\Throwable $e) {
			$result = ['error' => $e->getMessage()];
		}

		return [
			'jsonrpc' => '2.0',
			'result' => [
				'content' => [
					[
						'type' => 'text',
						'text' => $result['output'] ?? json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
					],
				],
				'isError' => isset($result['error']),
				'metadata' => $this->sanitizeResult($result),
			],
		];
	}

	private function executeShuttleCommand(string $name, array $arguments, string $cwd): array
	{
		$commandRules = $this->interpreter->getCommandRules();
		if (!isset($commandRules[$name])) {
			return ['error' => 'Tool not found: ' . $name];
		}

		$rawArgs = $this->buildRawCommandArgs($name, $arguments);
		return $this->interpreter->execute($name . ' ' . $rawArgs, $cwd);
	}

	private function buildRawCommandArgs(string $command, array $arguments): string
	{
		$commandRules = $this->interpreter->getCommandRules();
		$rule = $commandRules[$command] ?? null;
		if (!$rule) {
			return '';
		}

		$parts = [];
		foreach ($rule['options'] as $option) {
			$name = $option['name'];
			$alias = $option['alias'] ?? null;
			$hasValue = $option['hasValue'] ?? false;
			$key = ltrim($name, '-');
			$keyAlias = $alias ? ltrim($alias, '-') : null;

			$value = null;
			if (array_key_exists($key, $arguments) && $arguments[$key] !== null && $arguments[$key] !== '') {
				$value = $arguments[$key];
			} elseif ($keyAlias && array_key_exists($keyAlias, $arguments) && $arguments[$keyAlias] !== null && $arguments[$keyAlias] !== '') {
				$value = $arguments[$keyAlias];
			}

			if ($value === null) {
				continue;
			}

			if ($hasValue) {
				$parts[] = $name . '=' . $value;
			} else {
				$parts[] = $name;
			}
		}

		$parameters = $rule['parameters'] ?? ['min' => 0, 'max' => 0];
		$min = $parameters['min'] ?? 0;
		$max = $parameters['max'] ?? $min;

		for ($i = 1; $i <= $max; $i++) {
			$value = $arguments[$i] ?? $arguments[array_keys($arguments)[$i - 1] ?? ''] ?? null;
			if ($value === null) {
				break;
			}
			$parts[] = $value;
		}

		return implode(' ', $parts);
	}

	public function listResources(): array
	{
		return [
			'jsonrpc' => '2.0',
			'result' => [
				'resources' => [
					[
						'uri' => 'shuttle://commands',
						'name' => 'Shuttle Commands',
						'description' => 'Lista completa de comandos disponiveis no Shuttle Terminal, carregada a partir do CommandRules.json.',
						'mimeType' => 'application/json',
					],
					[
						'uri' => 'shuttle://models/free',
						'name' => 'Free KILO Models',
						'description' => 'Lista de modelos gratuitos disponiveis na KILO CODE API.',
						'mimeType' => 'application/json',
					],
					[
						'uri' => 'shuttle://weaver/tabs',
						'name' => 'Weaver Open Tabs',
						'description' => 'Lista de abas atualmente abertas no editor Weaver. Requer resolucao no frontend.',
						'mimeType' => 'application/json',
					],
					[
						'uri' => 'shuttle://weaver/active-tab',
						'name' => 'Weaver Active Tab',
						'description' => 'Informacoes da aba ativa no editor Weaver. Requer resolucao no frontend.',
						'mimeType' => 'application/json',
					],
					[
						'uri' => 'shuttle://weaver/tree-root',
						'name' => 'Weaver Tree Root',
						'description' => 'ID da pasta raiz da arvore de pastas aberta no Weaver. Requer resolucao no frontend.',
						'mimeType' => 'application/json',
					],
					[
						'uri' => 'shuttle://weaver/resources',
						'name' => 'Weaver Resources Summary',
						'description' => 'Resumo dos recursos do Weaver (tabs, tree root, active tab). Requer resolucao no frontend.',
						'mimeType' => 'application/json',
					],
					[
						'uri' => 'shuttle://weaver/editor-content',
						'name' => 'Weaver Editor Content',
						'description' => 'Conteudo dos arquivos abertos nas abas do editor Weaver, incluindo IDs dos arquivos e conteudo atual. Requer resolucao no frontend.',
						'mimeType' => 'application/json',
					],
				],
			],
		];
	}

	public function readResource(string $uri): array
	{
		if ($uri === 'shuttle://commands') {
			$file = JPATH_ROOT . '/media/com_shuttle/js/CommandRules.json';
			$content = is_readable($file) ? file_get_contents($file) : '{}';

			return [
				'jsonrpc' => '2.0',
				'result' => [
					'contents' => [
						[
							'uri' => $uri,
							'mimeType' => 'application/json',
							'text' => $content,
						],
					],
				],
			];
		}

		if ($uri === 'shuttle://models/free') {
			return [
				'jsonrpc' => '2.0',
				'result' => [
					'contents' => [
						[
							'uri' => $uri,
							'mimeType' => 'application/json',
							'text' => json_encode($this->getFreeModels()),
						],
					],
				],
			];
		}

		if (str_starts_with($uri, 'shuttle://weaver/')) {
			return [
				'jsonrpc' => '2.0',
				'result' => [
					'contents' => [
						[
							'uri' => $uri,
							'mimeType' => 'application/json',
							'text' => json_encode([
								'frontend_required' => true,
								'uri' => $uri,
								'message' => 'Este recurso requer resolucao no frontend via WeaverApp.js',
							], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
						],
					],
				],
			];
		}

		return $this->error('Resource not found: ' . $uri, -32601);
	}

	public function listModels(): array
	{
		$models = $this->getCachedModelList();

		return [
			'jsonrpc' => '2.0',
			'result' => [
				'models' => $models,
			],
		];
	}

	public function listPrompts(): array
	{
		return [
			'jsonrpc' => '2.0',
			'result' => [
				'prompts' => [
					[
						'name' => 'file_operations',
						'description' => 'Operacoes comuns com arquivos no Cotton Cloud',
						'arguments' => [
							['name' => 'operation', 'description' => 'Operacao desejada', 'required' => true],
							['name' => 'target', 'description' => 'Arquivo ou pasta alvo', 'required' => false],
						],
					],
				],
			],
		];
	}

	private function tool(string $name, string $description, array $inputSchema = []): array
	{
		$tool = [
			'name' => $name,
			'description' => $description,
		];

		if (!empty($inputSchema)) {
			$tool['inputSchema'] = [
				'type' => 'object',
				'properties' => $inputSchema,
			];
		}

		return $tool;
	}

	private function error(string $message, int $code = -32000): array
	{
		return [
			'jsonrpc' => '2.0',
			'error' => [
				'code' => $code,
				'message' => $message,
			],
		];
	}

	private function buildFindArgs(array $arguments): array
	{
		$args = [];
		$term = $arguments['query'] ?? $arguments['path'] ?? '';

		if ($term === '' && isset($arguments['n']) && $arguments['n'] === true) {
			$term = '1';
		}

		if ($term !== '') {
			$args[] = $term;
		}

		if (!empty($arguments['t'])) {
			$args[] = '-t=' . $arguments['t'];
		} elseif (!empty($arguments['type'])) {
			$args[] = '-t=' . $arguments['type'];
		}

		if (!empty($arguments['n']) || !empty($arguments['nameOnly'])) {
			$args[] = '-n';
		}

		if (!empty($arguments['c']) || !empty($arguments['count'])) {
			$args[] = '-c';
		}

		if (!empty($arguments['j']) || !empty($arguments['json'])) {
			$args[] = '-j';
		}

		return $args;
	}

	private function buildTargetArgs(array $arguments, string $key): array
	{
		$args = [];
		if (!empty($arguments[$key])) {
			$args[] = $arguments[$key];
		}
		if (!empty($arguments['id'])) {
			$args[] = '-i';
			$args[] = $arguments['id'];
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}
		return $args;
	}

	private function buildHeadTailArgs(array $arguments): array
	{
		$args = [];
		if (!empty($arguments['target'])) {
			$args[] = $arguments['target'];
		}
		if (!empty($arguments['id'])) {
			$args[] = '-i';
			$args[] = $arguments['id'];
		}
		if (!empty($arguments['lines'])) {
			$args[] = '-n';
			$args[] = (string) $arguments['lines'];
		}
		if (!empty($arguments['quiet'])) {
			$args[] = '-q';
		}
		if (!empty($arguments['verbose'])) {
			$args[] = '-v';
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}
		return $args;
	}

	private function buildLsArgs(array $arguments): array
	{
		$args = [];
		if (!empty($arguments['path'])) {
			$args[] = $arguments['path'];
		}
		if (!empty($arguments['id'])) {
			$args[] = '-i';
			$args[] = $arguments['id'];
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}
		if (!empty($arguments['long'])) {
			$args[] = '-l';
		}
		if (!empty($arguments['recursive'])) {
			$args[] = '-R';
		}
		if (!empty($arguments['sort'])) {
			$args[] = '--sort=' . $arguments['sort'];
		}
		return $args;
	}

	private function buildGrepArgs(array $arguments): array
	{
		$args = [];
		if (!empty($arguments['pattern'])) {
			$args[] = $arguments['pattern'];
		}
		foreach ((array) ($arguments['targets'] ?? []) as $target) {
			$args[] = $target;
		}
		if (!empty($arguments['regex'])) {
			$args[] = '-E';
		}
		if (!empty($arguments['ignoreCase'])) {
			$args[] = '-i';
		}
		if (!empty($arguments['lineNumber'])) {
			$args[] = '-n';
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}
		return $args;
	}

	private function buildSedArgs(array $arguments): array
	{
		$args = [];
		if (!empty($arguments['target'])) {
			$args[] = $arguments['target'];
		}
		if (!empty($arguments['id'])) {
			$args[] = '-i';
			$args[] = $arguments['id'];
		}
		if (!empty($arguments['inPlace'])) {
			$args[] = '-i';
		}
		if (!empty($arguments['quiet'])) {
			$args[] = '-n';
		}
		$expressions = [];
		if (!empty($arguments['expressions']) && is_array($arguments['expressions'])) {
			$expressions = array_values($arguments['expressions']);
		}
		if (!empty($arguments['expression'])) {
			$expressions[] = $arguments['expression'];
		}
		if (!empty($arguments['e'])) {
			$expressions[] = $arguments['e'];
		}
		foreach ($expressions as $expr) {
			$args[] = '-e';
			$args[] = $expr;
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}
		return $args;
	}

	private function buildRmdirArgs(array $arguments): array
	{
		$args = [];
		if (!empty($arguments['target'])) {
			$args[] = $arguments['target'];
		}
		if (!empty($arguments['id'])) {
			$args[] = '-i';
			$args[] = $arguments['id'];
		}
		if (!empty($arguments['recursive'])) {
			$args[] = '-r';
		}
		if (!empty($arguments['force'])) {
			$args[] = '-f';
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}
		return $args;
	}

	private function buildCpArgs(array $arguments): array
	{
		$args = [];
		if (!empty($arguments['source'])) {
			$args[] = $arguments['source'];
		}
		if (!empty($arguments['destination'])) {
			$args[] = $arguments['destination'];
		}
		if (!empty($arguments['recursive'])) {
			$args[] = '-r';
		}
		if (!empty($arguments['force'])) {
			$args[] = '-f';
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}
		return $args;
	}

	private function buildRunArgs(array $arguments): array
	{
		$args = [];
		if (!empty($arguments['target'])) {
			$args[] = $arguments['target'];
		}
		if (!empty($arguments['id'])) {
			$args[] = '-i';
			$args[] = $arguments['id'];
		}
		if (!empty($arguments['dryRun'])) {
			$args[] = '--dry-run';
		}
		if (!empty($arguments['verbose'])) {
			$args[] = '--verbose';
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}
		return $args;
	}

	private function buildCottonSaveArgs(array $arguments): array
	{
		$args = [];
		$fileTarget = (string) ($arguments['target'] ?? $arguments['id'] ?? $arguments['i'] ?? $arguments['path'] ?? $arguments['folder'] ?? '');

		if ($fileTarget !== '') {
			$args[] = $fileTarget;
		}

		$idValue = $arguments['id'] ?? $arguments['i'] ?? null;
		if ($idValue !== null && $fileTarget !== (string) $idValue) {
			$args[] = '-i';
			$args[] = $idValue;
		}
		if (!empty($arguments['content'])) {
			$args[] = '--content=' . $arguments['content'];
		}
		if (!empty($arguments['description'])) {
			$args[] = '--description=' . $arguments['description'];
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}

		return $args;
	}

	private function buildWeaverSetContentArgs(array $arguments): array
	{
		$args = [];
		$fileTarget = (string) ($arguments['target'] ?? $arguments['id'] ?? $arguments['i'] ?? $arguments['path'] ?? $arguments['file'] ?? '');

		if ($fileTarget !== '') {
			$args[] = $fileTarget;
		}

		$idValue = $arguments['id'] ?? $arguments['i'] ?? null;
		if ($idValue !== null && $fileTarget !== (string) $idValue) {
			$args[] = '-i';
			$args[] = $idValue;
		}
		if (!empty($arguments['content'])) {
			$args[] = '--content=' . $arguments['content'];
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}

		return $args;
	}

	private function buildCottonCreateArgs(array $arguments): array
	{
		$args = [];
		$folder = $arguments['folder'] ?? $arguments['folderId'] ?? $arguments['folder_id'] ?? $arguments['folderPath'] ?? $arguments['folder_path'] ?? $arguments['target'] ?? $arguments['path'] ?? $arguments['id'] ?? $arguments['i'] ?? $arguments['parent'] ?? $arguments['parentId'] ?? $arguments['parent_id'] ?? '';
		$name = $arguments['name'] ?? $arguments['fileName'] ?? $arguments['file_name'] ?? $arguments['filename'] ?? $arguments['file'] ?? '';

		if ($folder !== '') {
			$args[] = $folder;
		}
		if ($name !== '') {
			$args[] = $name;
		}

		$idValue = $arguments['id'] ?? $arguments['i'] ?? null;
		if ($idValue !== null && $folder !== (string) $idValue) {
			$args[] = '-i';
			$args[] = $idValue;
		}
		if (!empty($arguments['content'])) {
			$args[] = '--content=' . $arguments['content'];
		}
		if (!empty($arguments['description'])) {
			$args[] = '--description=' . $arguments['description'];
		}
		if (!empty($arguments['json'])) {
			$args[] = '-j';
		}

		return $args;
	}

	private function handleCottonCreateMCP(array $arguments): array
	{
		$folderTarget = '';
		$name = '';
		$idValue = null;
		$content = '';
		$description = '';

		if (array_key_exists(0, $arguments)) {
			$folderTarget = (string) ($arguments[0] ?? '');
			$name = (string) ($arguments[1] ?? '');
		} else {
			$folderTarget = (string) ($arguments['folder'] ?? $arguments['folderId'] ?? $arguments['folder_id'] ?? $arguments['folderPath'] ?? $arguments['folder_path'] ?? $arguments['target'] ?? $arguments['path'] ?? $arguments['parent'] ?? $arguments['parentId'] ?? $arguments['parent_id'] ?? '');
			$name = (string) ($arguments['name'] ?? $arguments['fileName'] ?? $arguments['file_name'] ?? $arguments['filename'] ?? $arguments['file'] ?? '');
			$idValue = $arguments['id'] ?? $arguments['i'] ?? null;
			$content = (string) ($arguments['content'] ?? '');
			$description = (string) ($arguments['description'] ?? '');

			if ($idValue !== null && $folderTarget === '') {
				$folderTarget = (string) $idValue;
			}
		}

		if ($folderTarget === '' || $name === '') {
			//error_log('[Shuttle MCP] cotton-create missing args. received=' . json_encode($arguments));
			return [
				'error' => 'cotton-create requires folder and name. Received: ' . json_encode($arguments),
				'code' => -32602,
				'output' => 'Erro: cotton-create precisa dos parametros obrigatorios folder e name. Exemplo: {"folder":"/docs", "name":"arquivo.md"}. Se voce acabou de listar pastas com find ou ls, use o caminho ou ID da pasta encontrada no resultado anterior.',
			];
		}

		$resolved = $this->cottonBridge->resolvePath($folderTarget);
		if (isset($resolved['error']) || ($resolved['type'] ?? '') !== 'folder') {
			return [
				'error' => $resolved['error'] ?? Text::_('COM_SHUTTLE_FOLDER_TARGET_NOT_FOUND') . ': ' . $folderTarget,
				'code' => -32602,
				'output' => $resolved['error'] ?? Text::_('COM_SHUTTLE_FOLDER_TARGET_NOT_FOUND') . ': ' . $folderTarget,
			];
		}

		$result = $this->cottonBridge->createFile((int) $resolved['id'], $name, $content, $description);
		if (empty($result['success'])) {
			return [
				'error' => $result['message'] ?? 'Unable to create file',
				'code' => -32603,
				'output' => $result['message'] ?? 'Unable to create file',
			];
		}

		return [
			'success'     => true,
			'file_id'     => $result['id'],
			'name'        => $result['name'],
			'folder_id'   => (int) $resolved['id'],
			'folder_path' => $resolved['path'] ?? '/',
			'size'        => strlen($content),
			'output'      => Text::_('COM_SHUTTLE_FILE_CREATED') . ': ' . $result['name'] . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . $result['id'] . ')',
		];
	}

	private function handleMkdirMCP(array $arguments): array
	{
		$rawPath = (string) ($arguments['path'] ?? $arguments['folder'] ?? $arguments['target'] ?? $arguments['name'] ?? '');
		$parents = !empty($arguments['parents']) || !empty($arguments['p']);

		$rawPath = str_replace('\\', '/', trim($rawPath));
		$rawPath = preg_replace('#/+$#', '', $rawPath);

		if ($rawPath === '' || $rawPath === '/' || $rawPath === '.') {
			return [
				'error' => 'mkdir requires a valid directory path',
				'code' => -32602,
				'output' => 'Erro: mkdir precisa de um caminho valido. Exemplo: mkdir /docs/novo-diretorio',
			];
		}

		$segments = array_values(array_filter(explode('/', $rawPath), 'strlen'));
		$name = array_pop($segments) ?: '';
		$parentPath = '/' . implode('/', $segments);

		if ($parents) {
			$resolved = $this->cottonBridge->resolvePath($rawPath);
			if (isset($resolved['error']) && ($resolved['type'] ?? '') !== 'folder') {
				$result = $this->cottonBridge->createFolderRecursive($rawPath, '/');
			} else {
				$result = ['success' => true, 'name' => $name, 'id' => (int) ($resolved['id'] ?? 0)];
			}
		} else {
			$parentResolved = $this->cottonBridge->resolvePath($parentPath === '' ? '/' : $parentPath);
			if (isset($parentResolved['error']) || ($parentResolved['type'] ?? '') !== 'folder') {
				return [
					'error' => 'Parent folder not found: ' . $parentPath,
					'code' => -32602,
					'output' => 'Erro: pasta pai nao encontrada. Use --parents para criar pastas pais automaticamente.',
				];
			}

			$result = $this->cottonBridge->createFolder((int) $parentResolved['id'], $name);
		}

		if (empty($result['success']) || isset($result['error'])) {
			return [
				'error' => $result['error'] ?? $result['message'] ?? 'Unable to create directory',
				'code' => -32603,
				'output' => $result['error'] ?? $result['message'] ?? 'Unable to create directory',
			];
		}

		return [
			'success' => true,
			'path' => $rawPath,
			'name' => $result['data']['name'] ?? basename($rawPath),
			'folder_id' => (int) ($result['data']['id'] ?? 0),
			'output' => Text::_('COM_SHUTTLE_DIR_CREATED') . ': ' . ($result['data']['name'] ?? basename($rawPath)) . ' (' . Text::_('COM_SHUTTLE_ID') . '=' . ($result['data']['id'] ?? 0) . ')',
		];
	}

	private function sanitizeResult(array $result): array
	{
		unset($result['command']);
		unset($result['output']);

		return $result;
	}


}
