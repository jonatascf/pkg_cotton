<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Shuttle\Site\Model\Service;

\defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\Database\DatabaseInterface;

/**
 * Bridge entre com_shuttle e com_cotton, usando repositories do Cotton.
 *
 * @package     Tabaoca.Component.Shuttle.Site
 * @subpackage  com_shuttle
 * @since       2.0.0
 */
class CottonBridge
{
	protected DatabaseInterface $db;

	public function __construct(DatabaseInterface $db = null)
	{
		$this->db = $db ?? Factory::getDbo();
	}

	/**
	 * Resolve um caminho virtual ou ID em metadados de Cotton.
	 *
	 * @param  string  $virtualPath
	 * @return array
	 */
	public function resolvePath(string $virtualPath): array
	{
		$virtualPath = trim($virtualPath);
		if ($virtualPath === '' || $virtualPath === '/' || $virtualPath === '.') {
			return [
				'type' => 'folder',
				'id' => 0,
				'name' => '',
				'path' => '/',
				'parent_id' => null,
			];
		}

		if (is_numeric($virtualPath)) {
			$fileRepository = $this->createFileRepository();
			$file = $fileRepository->getById((int) $virtualPath);
			if ($file) {
				return [
					'type' => 'file',
					'id' => (int) $file->id,
					'name' => $file->name,
					'path' => $file->path ?? null,
				];
			}

			$folderRepository = $this->createFolderRepository();
			$folder = $folderRepository->getById((int) $virtualPath);
			if ($folder) {
				$folderPath = (int) $folder->id === 0 ? '/' : $this->getFolderPath((int) $folder->id);
				return [
					'type' => 'folder',
					'id' => (int) $folder->id,
					'name' => $folder->name,
					'path' => $folderPath,
					'parent_id' => $folder->parent_id !== null ? (int) $folder->parent_id : null,
				];
			}
		}

		$path = trim($virtualPath, " /\\");
		$segments = array_filter(explode('/', $path), 'strlen');
		if (empty($segments)) {
			return ['error' => 'Empty virtual path'];
		}

		$parentId = 0;
		$result = [
			'type' => 'folder',
			'id' => 0,
			'name' => '',
			'path' => '/' . implode('/', $segments),
			'parent_id' => null,
		];

		foreach ($segments as $index => $segment) {
			$folder = $this->findFolderByName($parentId, $segment);
			if (!$folder) {
				if ($index === count($segments) - 1) {
					$file = $this->findFileInFolder($parentId, $segment);
					if ($file) {
						$file->path = $this->getFolderPath($parentId) . '/' . $file->name;
						return [
							'type' => 'file',
							'id' => (int) $file->id,
							'name' => $file->name,
							'path' => $file->path,
						];
					}
				}
				return ['error' => Text::_('COM_SHUTTLE_CANNOT_RESOLVE_PATH') . ': "' . $virtualPath . '"'];
			}

			$result['id'] = (int) $folder->id;
			$result['name'] = $folder->name;
			$result['parent_id'] = $folder->parent_id !== null ? (int) $folder->parent_id : null;
			$parentId = (int) $folder->id;
		}

		return $result;
	}

	/**
	 * Resolve um ID numérico de pasta diretamente no repositório, sem passar pelo resolvedor de caminhos.
	 *
	 * @param  int  $folderId
	 * @return array|null
	 */
	public function getFolderById(int $folderId): ?array
	{
		if ($folderId === 0) {
			return [
				'type'      => 'folder',
				'id'        => 0,
				'name'      => '',
				'path'      => '/',
				'parent_id' => null,
			];
		}

		$folderRepository = $this->createFolderRepository();
		$folder = $folderRepository->getById($folderId);
		if (!$folder) {
			return null;
		}

		return [
			'type'      => 'folder',
			'id'        => (int) $folder->id,
			'name'      => $folder->name,
			'path'      => $folder->parent_id ? $this->getFolderPath((int) $folder->id) : '/' . $folder->name,
			'parent_id' => $folder->parent_id !== null ? (int) $folder->parent_id : null,
		];
	}

	public function searchFiles(string $term): array
	{
		$term = trim($term);
		if ($term === '') {
			return [];
		}

		$query = $this->db->getQuery(true)
			->select(['a.id', 'a.name', 'a.folder_id'])
			->from($this->db->quoteName('#__cotton_file', 'a'))
			->where($this->db->quoteName('a.trash') . ' = 0')
			->where($this->db->quoteName('a.name') . ' LIKE ' . $this->db->quote('%' . $this->db->escape($term, true) . '%'))
			->order($this->db->quoteName('a.name') . ' ASC');

		$this->db->setQuery($query);
		$files = (array) $this->db->loadObjectList();

		$results = [];
		foreach ($files as $file) {
			$file->path = $this->getFolderPath($file->folder_id);
			$file->type = 'file';
			$results[] = $file;
		}

		return $results;
	}

	public function searchFolders(string $term): array
	{
		$term = trim($term);
		if ($term === '') {
			return [];
		}

		$query = $this->db->getQuery(true)
			->select(['a.id', 'a.name'])
			->from($this->db->quoteName('#__cotton_folder', 'a'))
			->where($this->db->quoteName('a.trash') . ' = 0')
			->where($this->db->quoteName('a.name') . ' LIKE ' . $this->db->quote('%' . $this->db->escape($term, true) . '%'))
			->order($this->db->quoteName('a.name') . ' ASC');

		$this->db->setQuery($query);
		$folders = (array) $this->db->loadObjectList();

		$results = [];
		foreach ($folders as $folder) {
			$folder->path = $this->getFolderPath((int) $folder->id);
			$folder->type = 'folder';
			$results[] = $folder;
		}

		return $results;
	}

	public function loadFolderItems(int $folderId = 0): array
	{
		$model = new \Tabaoca\Component\Cotton\Site\Model\CottonModel();
		$items = $model->items_load($folderId);

		return [
			'folder_id' => $items->folder_id ?? $folderId,
			'path' => $items->path_folder ?? ($folderId === 0 ? '/' : ''),
			'n_folders' => $items->n_folders ?? 0,
			'n_files' => $items->n_files ?? 0,
			'folders' => $items->folders ?? [],
			'files' => $items->files ?? [],
		];
	}

	public function createFolder(int $parentId, string $name, string $description = ''): array
	{
		$model = new \Tabaoca\Component\Cotton\Site\Model\CottonModel();
		return (array) $model->folder_create($parentId, $name, $description);
	}

	public function deleteFolder(int $folderId, bool $permanent = false): array
	{
		$model = new \Tabaoca\Component\Cotton\Site\Model\CottonModel();
		return (array) $model->folder_delete($folderId, $permanent ? 0 : 1);
	}

	public function moveFolder(int $folderId, int $newParentId): array
	{
		$model = new \Tabaoca\Component\Cotton\Site\Model\CottonModel();
		return (array) $model->folder_move($folderId, $newParentId);
	}

	public function moveFile(int $fileId, int $newFolderId): array
	{
		$model = new \Tabaoca\Component\Cotton\Site\Model\CottonModel();
		return (array) $model->file_move($fileId, $newFolderId);
	}

	public function copyFile(int $fileId, int $newFolderId, string $newName = ''): array
	{
		$sourceFile = $this->readFileByPath((string) $fileId);
		if ($sourceFile === null || empty($sourceFile->file_data)) {
			return ['error' => 'Source file not found'];
		}

		$name = $newName !== '' ? $newName : ($sourceFile->name ?? 'copy-' . $fileId);
		$content = $sourceFile->file_data;

		return $this->createFile($newFolderId, $name, $content, '');
	}

	public function copyFolderRecursive(int $folderId, int $newParentId, string $newName = ''): array
	{
		$sourceFolder = $this->getFolderById($folderId);
		if ($sourceFolder === null) {
			return ['error' => 'Source folder not found'];
		}

		$name = $newName !== '' ? $newName : ($sourceFolder->name ?? 'copy-' . $folderId);
		$created = $this->createFolder($newParentId, $name, '');
		if (empty($created['success'])) {
			return $created;
		}

		$newFolderId = (int) $created['id'];
		$items = $this->loadFolderItems($folderId);

		foreach ($items['files'] ?? [] as $file) {
			$copyResult = $this->copyFile((int) $file->id, $newFolderId);
			if (empty($copyResult['success'])) {
				return $copyResult;
			}
		}

		foreach ($items['folders'] ?? [] as $subfolder) {
			$copyResult = $this->copyFolderRecursive((int) $subfolder->id, $newFolderId);
			if (empty($copyResult['success'])) {
				return $copyResult;
			}
		}

		return [
			'success' => true,
			'id' => $newFolderId,
			'name' => $name,
			'parent_id' => $newParentId,
		];
	}

	public function createFolderRecursive(string $path, string $cwd): array
	{
		$path = str_replace('\\', '/', trim($path));
		$path = preg_replace('#/+$#', '', $path);

		if ($path === '' || $path === '/' || $path === '.') {
			return ['error' => 'Invalid directory path'];
		}

		$absolute = str_starts_with($path, '/');
		$parts = array_values(array_filter(explode('/', trim($path, '/')), 'strlen'));

		$currentPath = $absolute ? '/' : (rtrim($cwd, '/') ?: '/');
		$created = [];

		foreach ($parts as $part) {
			$currentPath = rtrim($currentPath, '/') . '/' . $part;
			$resolved = $this->resolvePath($currentPath);

			if (!isset($resolved['error'])) {
				if (($resolved['type'] ?? '') === 'file') {
					return ['error' => Text::_('COM_SHUTTLE_PATH_IS_FILE') . ': ' . $currentPath];
				}
				continue;
			}

			$parentPath = rtrim($currentPath, '/' . $part);
			if ($parentPath === '') {
				$parentPath = '/';
			}
			$parentResolved = $this->resolvePath($parentPath);
			if (isset($parentResolved['error']) || ($parentResolved['type'] ?? '') !== 'folder') {
				return ['error' => Text::_('COM_SHUTTLE_PARENT_FOLDER_NOT_FOUND') . ': ' . $parentPath];
			}

			$result = $this->createFolder((int) $parentResolved['id'], $part, '');
			if (empty($result['success'])) {
				return ['error' => $result['message'] ?? 'Unable to create directory'];
			}

			$created[] = $result;
		}

		$finalResolved = $this->resolvePath($path);
		if (isset($finalResolved['error'])) {
			return ['error' => 'Failed to create directory'];
		}

		return [
			'success' => true,
			'data' => end($created),
			'created' => $created,
		];
	}

	public function listArticles(): array
	{
		$model = new \Tabaoca\Component\Cotton\Site\Model\CottonModel();
		$data = $model->articles_list();

		return [
			'count' => $data->n ?? 0,
			'articles' => $data->articles ?? [],
		];
	}

	public function grepFileContent(string $pattern, array $targets, array $options = []): array
	{
		$ignoreCase = !empty($options['ignoreCase']);
		$invertMatch = !empty($options['invertMatch']);
		$useRegex    = !empty($options['regex']);
		$filesWithoutMatch = !empty($options['filesWithoutMatch']);
		$countOnly   = !empty($options['count']);

		$allResults = [];

		foreach ($targets as $target) {
			$file = $this->readFileByPath($target);
			if ($file === null || empty($file->file_data)) {
				continue;
			}

			$lines = preg_split('/\r\n|\r|\n/', $file->file_data);
			$fileMatches = [];

			foreach ($lines as $index => $line) {
				$isMatch = false;

				if ($useRegex) {
					$flags = $ignoreCase ? 'i' : '';
					$isMatch = @preg_match('~' . $pattern . '~' . $flags, $line) === 1;
				} else {
					$pos = $ignoreCase ? stripos($line, $pattern) : strpos($line, $pattern);
					$isMatch = $pos !== false;
				}

				if ($invertMatch) {
					$isMatch = !$isMatch;
				}

				if ($isMatch) {
					$fileMatches[] = [
						'line' => $index + 1,
						'lineText' => $line,
					];
				}
			}

			$allResults[] = [
				'filePath' => $file->path ?? '',
				'fileName' => $file->name ?? basename($file->path ?? ''),
				'matches' => $fileMatches,
				'matchCount' => count($fileMatches),
				'hasMatch' => !empty($fileMatches),
			];
		}

		return $allResults;
	}

	public function readFileByPath(string $target): ?\stdClass
	{
		$resolved = $this->resolvePath($target);
		if (isset($resolved['error']) || ($resolved['type'] ?? '') !== 'file') {
			return null;
		}

		$fileRepository = $this->createFileRepository();
		$file = $fileRepository->getById((int) $resolved['id']);
		if ($file) {
			$file->path = $resolved['path'] ?? $file->path ?? '';
		}

		return $file;
	}

	public function getById(int $id): ?\stdClass
	{
		$fileRepository = $this->createFileRepository();
		return $fileRepository->getById($id);
	}

	public function saveFileContent(int $fileId, string $content): array
	{
		$fileManager = new \Tabaoca\Component\Cotton\Site\Model\File\FileManager($this->createFileRepository());
		return $fileManager->saveContent($fileId, $content);
	}

	public function createFile(int $folderId, string $name, string $content, string $description = ''): array
	{
		$fileManager = new \Tabaoca\Component\Cotton\Site\Model\File\FileManager($this->createFileRepository());
		return $fileManager->create($folderId, $name, $content, $description);
	}

	public function deleteFile(int $fileId): array
	{
		$fileManager = new \Tabaoca\Component\Cotton\Site\Model\File\FileManager($this->createFileRepository());
		return $fileManager->delete($fileId);
	}

	protected function findFileInFolder(int $folderId, string $name): ?\stdClass
	{
		$query = $this->db->getQuery(true)
			->select('*')
			->from($this->db->quoteName('#__cotton_file'))
			->where($this->db->quoteName('folder_id') . ' = ' . $this->db->quote($folderId))
			->where($this->db->quoteName('name') . ' = ' . $this->db->quote($name))
			->where($this->db->quoteName('trash') . ' = 0');

		$this->db->setQuery($query);
		$file = $this->db->loadObject();
		if ($file) {
			$file->path = $this->getFolderPath($folderId) . '/' . $file->name;
		}
		return $file;
	}

	protected function findFolderByName(int $parentId, string $name): ?\stdClass
	{
		$query = $this->db->getQuery(true)
			->select('*')
			->from($this->db->quoteName('#__cotton_folder'))
			->where($this->db->quoteName('parent_id') . ' = ' . $this->db->quote($parentId))
			->where($this->db->quoteName('name') . ' = ' . $this->db->quote($name))
			->where($this->db->quoteName('trash') . ' = 0');

		$this->db->setQuery($query);
		return $this->db->loadObject();
	}

	protected function getFolderPath(int $folderId): string
	{
		if ($folderId === 0) {
			return '';
		}

		$query = $this->db->getQuery(true)
			->select('a.id, a.name, a.parent_id')
			->from($this->db->quoteName('#__cotton_folder', 'a'))
			->where($this->db->quoteName('a.id') . ' = ' . $this->db->quote($folderId))
			->where($this->db->quoteName('a.trash') . ' = 0');

		$this->db->setQuery($query);
		$folder = $this->db->loadObject();
		if (!$folder) {
			return '';
		}

		if ($folder->parent_id) {
			$parentPath = $this->getFolderPath((int) $folder->parent_id);
			return rtrim($parentPath, '/') . '/' . $folder->name;
		}

		return '/' . $folder->name;
	}

	protected function createFolderRepository()
	{
		return new \Tabaoca\Component\Cotton\Site\Model\Folder\FolderRepository($this->db);
	}

	protected function createFileRepository()
	{
		return new \Tabaoca\Component\Cotton\Site\Model\File\FileRepository($this->db);
	}
}
