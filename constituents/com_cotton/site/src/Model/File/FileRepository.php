<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Cotton\Site\Model\File;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\Database\DatabaseInterface;
use Joomla\Database\ParameterType;

/**
 * Repository responsável pelo acesso a dados de arquivos.
 */
class FileRepository
{
    /** @var \JDatabaseDriver */
    protected $db;

    /** Simple in-process cache fallback */
    protected static $localCache = [];

    /** Default cache TTL (seconds) */
    protected $cacheTtl = 30;

    public function __construct($db = null)
    {
        $this->db = $db ?? Factory::getDbo();
        try {
            $params = \Joomla\CMS\Component\ComponentHelper::getParams('com_cotton');
            $ttl = (int) $params->get('cache_ttl', $this->cacheTtl);
            if ($ttl > 0) {
                $this->cacheTtl = $ttl;
            }
        } catch (\Throwable $e) {
            // ignore, keep default ttl
        }
    }

    protected function cacheGet(string $key)
    {
        try {
            if (class_exists('Joomla\\CMS\\Factory')) {
                $cache = Factory::getCache('com_cotton');
                $val = $cache->get($key);
                if ($val !== false) {
                    return $val;
                }
            }
        } catch (\Throwable $e) {
            // ignore and fallback
        }

        if (isset(self::$localCache[$key])) {
            $entry = self::$localCache[$key];
            if ($entry['expiry'] === 0 || $entry['expiry'] >= time()) {
                return $entry['value'];
            }
            unset(self::$localCache[$key]);
        }

        return false;
    }

    protected function cacheSet(string $key, $value, ?int $ttl = null): void
    {
        $ttl = $ttl ?? $this->cacheTtl;
        try {
            if (class_exists('Joomla\\CMS\\Factory')) {
                $cache = Factory::getCache('com_cotton');
                $cache->store($value, $key);
                return;
            }
        } catch (\Throwable $e) {
            // ignore and fallback
        }

        $expiry = $ttl > 0 ? time() + $ttl : 0;
        self::$localCache[$key] = ['value' => $value, 'expiry' => $expiry];
    }

    protected function cacheDelete(string $key): void
    {
        try {
            if (class_exists('Joomla\\CMS\\Factory')) {
                $cache = Factory::getCache('com_cotton');
                if (method_exists($cache, 'remove')) {
                    $cache->remove($key);
                    return;
                }
                if (method_exists($cache, 'clean')) {
                    $cache->clean();
                    return;
                }
            }
        } catch (\Throwable $e) {
            // ignore
        }

        if (isset(self::$localCache[$key])) {
            unset(self::$localCache[$key]);
        }
    }

    protected function cacheInvalidatePrefix(string $prefix): void
    {
        try {
            if (class_exists('Joomla\\CMS\\Factory')) {
                $cache = Factory::getCache('com_cotton');
                if (method_exists($cache, 'clean')) {
                    $cache->clean();
                    return;
                }
            }
        } catch (\Throwable $e) {
            // ignore
        }

        foreach (array_keys(self::$localCache) as $k) {
            if (strpos($k, $prefix) === 0) {
                unset(self::$localCache[$k]);
            }
        }
    }

    public function getById(int $id): ?\stdClass
    {
        $cacheKey = 'file_id_' . $id;
        $cached = $this->cacheGet($cacheKey);
        if ($cached !== false) {
            return $cached;
        }

        $query = $this->db->getQuery(true)
            ->select('*')
            ->from($this->db->quoteName('#__cotton_file'))
            ->where($this->db->quoteName('id') . ' = ' . $this->db->quote($id));

        $this->db->setQuery($query);
        $obj = $this->db->loadObject();
        $this->cacheSet($cacheKey, $obj, $this->cacheTtl);
        return $obj;
    }

    public function getByFolder(int $folderId): array
    {
        $cacheKey = 'folder_files_' . $folderId;
        $cached = $this->cacheGet($cacheKey);
        if ($cached !== false) {
            return (array) $cached;
        }

        $query = $this->db->getQuery(true)
            ->select('*')
            ->from($this->db->quoteName('#__cotton_file'))
            ->where($this->db->quoteName('folder_id') . ' = ' . $this->db->quote($folderId))
            ->order($this->db->quoteName('name') . ' ASC');

        $this->db->setQuery($query);
        $result = (array) $this->db->loadObjectList();
        $this->cacheSet($cacheKey, $result, $this->cacheTtl);
        return $result;
    }

    public function getByFolderForUser(int $folderId, int $userId): array
    {
        $cacheKey = 'folder_user_files_' . $folderId . '_' . $userId;
        $cached = $this->cacheGet($cacheKey);
        if ($cached !== false) {
            return (array) $cached;
        }

        $query = $this->db->getQuery(true)
            ->select('a.id, a.owner_id, a.name, a.description, a.date_created, a.date_updated, a.folder_id, a.allowed_users, a.open_link, a.trash, a.size')
            ->from($this->db->quoteName('#__cotton_file', 'a'))
            ->where($this->db->quoteName('a.folder_id') . ' = ' . $this->db->quote($folderId))
            ->where($this->db->quoteName('a.owner_id') . ' = ' . $this->db->quote($userId))
            ->where($this->db->quoteName('a.trash') . ' = 0')
            ->order($this->db->quoteName('a.name') . ' ASC');

        $this->db->setQuery($query);
        $result = (array) $this->db->loadObjectList();
        $this->cacheSet($cacheKey, $result, $this->cacheTtl);
        return $result;
    }

    public function getForOpen(int $fileId): ?\stdClass
    {
        $query = $this->db->getQuery(true)
            ->select('a.id, a.owner_id, a.name, a.date_created, a.date_updated, a.file_data, a.folder_id, a.allowed_users, a.open_link, a.trash')
            ->from($this->db->quoteName('#__cotton_file', 'a'))
            ->where($this->db->quoteName('a.id') . ' = ' . $this->db->quote($fileId))
            ->where($this->db->quoteName('a.trash') . ' = 0');

        $this->db->setQuery($query);
        $file = $this->db->loadObject();
        
        // Add folder path if file was found
        if ($file && isset($file->folder_id) && $file->folder_id > 0) {
            $file->path = $this->getFolderPath((int) $file->folder_id, (int) $file->owner_id);
        } else if ($file) {
            $file->path = '';
        }
        
        return $file;
    }

    /**
     * Get full path of a folder for file context
     *
     * @param int $folderId
     * @param int $userId
     * @return string
     */
    protected function getFolderPath(int $folderId, int $userId): string
    {
        try {
            $folderRepo = new \Tabaoca\Component\Cotton\Site\Model\Folder\FolderRepository($this->db);
            return $folderRepo->getFolderPath($folderId, $userId);
        } catch (\Throwable $e) {
            return '';
        }
    }

    public function insert(array $data): int
    {
        $columns = [];
        $values = [];

        foreach ($data as $k => $v) {
            $columns[] = $this->db->quoteName($k);
            $values[] = $this->db->quote($v);
        }

        $query = $this->db->getQuery(true)
            ->insert($this->db->quoteName('#__cotton_file'))
            ->columns($columns)
            ->values(implode(',', $values));

        $this->db->setQuery($query);
        $this->db->execute();

        $id = (int) $this->db->insertid();

        // Invalidate caches related to this folder/owner
        $folderId = $data['folder_id'] ?? null;
        $ownerId = $data['owner_id'] ?? $data['created_by'] ?? null;
        if ($folderId) {
            $this->cacheDelete('folder_files_' . $folderId);
            if ($ownerId) {
                $this->cacheDelete('folder_user_files_' . $folderId . '_' . $ownerId);
            }
            // invalidate children stats for parent of this folder if available
            $q = $this->db->getQuery(true)
                ->select('parent_id, owner_id')
                ->from($this->db->quoteName('#__cotton_folder'))
                ->where($this->db->quoteName('id') . ' = ' . $this->db->quote($folderId));
            $this->db->setQuery($q);
            $row = $this->db->loadObject();
            if ($row) {
                $this->cacheInvalidatePrefix('children_stats_' . $row->parent_id . '_');
            }
        }

        return $id;
    }

    public function update(int $id, array $data): bool
    {
        $sets = [];
        $binds = [];

        foreach ($data as $k => $v) {
            $placeholder = ':set_' . $k;
            $sets[] = $this->db->quoteName($k) . ' = ' . $placeholder;
            $binds[$placeholder] = $this->resolveBind($v);
        }

        $query = $this->db->createQuery()
            ->update($this->db->quoteName('#__cotton_file'))
            ->set($sets)
            ->where($this->db->quoteName('id') . ' = :id');

        foreach ($binds as $placeholder => $bindDef) {
            $query->bind($placeholder, $bindDef['value'], $bindDef['type']);
        }
        $query->bind(':id', $id, ParameterType::INTEGER);

        $this->db->setQuery($query);
        $ok = (bool) $this->db->execute();

        // Invalidate caches for this file
        $existing = $this->getById($id);
        $folderId = $existing->folder_id ?? ($data['folder_id'] ?? null);
        $ownerId = $existing->owner_id ?? ($data['owner_id'] ?? null);
        $this->cacheDelete('file_id_' . $id);
        if ($folderId) {
            $this->cacheDelete('folder_files_' . $folderId);
            if ($ownerId) {
                $this->cacheDelete('folder_user_files_' . $folderId . '_' . $ownerId);
            }
            $q = $this->db->getQuery(true)
                ->select('parent_id')
                ->from($this->db->quoteName('#__cotton_folder'))
                ->where($this->db->quoteName('id') . ' = ' . $this->db->quote($folderId));
            $this->db->setQuery($q);
            $row = $this->db->loadObject();
            if ($row) {
                $this->cacheInvalidatePrefix('children_stats_' . $row->parent_id . '_');
            }
        }

        return $ok;
    }

    /**
     * Resolve value and ParameterType for a bound update/insert.
     *
     * @param mixed $value
     * @return array{value: mixed, type: int}
     */
    protected function resolveBind($value): array
    {
        if (is_int($value)) {
            return ['value' => $value, 'type' => ParameterType::INTEGER];
        }
        if (is_float($value)) {
            return ['value' => $value, 'type' => ParameterType::FLOAT];
        }
        if (is_bool($value)) {
            return ['value' => $value, 'type' => ParameterType::BOOLEAN];
        }
        if (is_null($value)) {
            return ['value' => $value, 'type' => ParameterType::NULL];
        }
        if (is_resource($value) || (is_string($value) && strlen($value) > 1048576)) {
            return ['value' => $value, 'type' => ParameterType::LARGE_OBJECT];
        }
        return ['value' => (string) $value, 'type' => ParameterType::STRING];
    }

    public function delete(int $id): bool
    {
        $existing = $this->getById($id);

        $query = $this->db->getQuery(true)
            ->delete($this->db->quoteName('#__cotton_file'))
            ->where($this->db->quoteName('id') . ' = ' . $this->db->quote($id));

        $this->db->setQuery($query);
        $ok = (bool) $this->db->execute();

        if ($ok && $existing) {
            $folderId = $existing->folder_id ?? null;
            $ownerId = $existing->owner_id ?? null;
            $this->cacheDelete('file_id_' . $id);
            if ($folderId) {
                $this->cacheDelete('folder_files_' . $folderId);
                if ($ownerId) {
                    $this->cacheDelete('folder_user_files_' . $folderId . '_' . $ownerId);
                }
                $q = $this->db->getQuery(true)
                    ->select('parent_id')
                    ->from($this->db->quoteName('#__cotton_folder'))
                    ->where($this->db->quoteName('id') . ' = ' . $this->db->quote($folderId));
                $this->db->setQuery($q);
                $row = $this->db->loadObject();
                if ($row) {
                    $this->cacheInvalidatePrefix('children_stats_' . $row->parent_id . '_');
                }
            }
        }

        return $ok;
    }

    public function getStorageStats(int $ownerId = 0): array
    {
        $query = $this->db->getQuery(true)
            ->select('COUNT(f.id) AS files, COALESCE(SUM(f.size),0) AS total_size')
            ->from($this->db->quoteName('#__cotton_file', 'f'));

        if ($ownerId) {
            $query->where($this->db->quoteName('f.owner_id') . ' = ' . $this->db->quote($ownerId));
        }

        $this->db->setQuery($query);
        $row = $this->db->loadAssoc();

        return $row ?: ['files' => 0, 'total_size' => 0];
    }

    /**
     * Get count of files with same name in folder
     *
     * @param int $folderId
     * @param string $name
     * @return int
     */
    public function getCountByNameInFolder(int $folderId, string $name): int
    {
        $query = $this->db->getQuery(true)
            ->select('COUNT(*)')
            ->from($this->db->quoteName('#__cotton_file'))
            ->where($this->db->quoteName('folder_id') . ' = ' . $this->db->quote($folderId))
            ->where($this->db->quoteName('name') . ' = ' . $this->db->quote($name));

        $this->db->setQuery($query);
        return (int) $this->db->loadResult();
    }

    /**
     * Generate unique name by appending (1), (2), etc. if name exists
     *
     * @param int $folderId
     * @param string $name
     * @return string
     */
    public function generateUniqueName(int $folderId, string $name): string
    {
        // Check if name exists
        if ($this->getCountByNameInFolder($folderId, $name) === 0) {
            return $name;
        }

        // Name exists, need to add counter
        // Split name and extension if it exists
        $lastDotPos = strrpos($name, '.');
        if ($lastDotPos !== false) {
            $baseName = substr($name, 0, $lastDotPos);
            $extension = substr($name, $lastDotPos);
        } else {
            $baseName = $name;
            $extension = '';
        }

        // Find next available number
        $counter = 1;
        while ($this->getCountByNameInFolder($folderId, $baseName . '(' . $counter . ')' . $extension) > 0) {
            $counter++;
        }

        return $baseName . '(' . $counter . ')' . $extension;
    }

    public function appendChunkToFile(int $fileId, string $chunk, string $tempDir = null): bool
    {
        $tempDir = $tempDir ?? sys_get_temp_dir();
        $tempFile = $tempDir . '/cotton_chunk_' . $fileId . '.part';
        
        // Append do chunk ao arquivo temporário
        $result = file_put_contents($tempFile, $chunk, FILE_APPEND | LOCK_EX);
        
        if ($result === false) {
            return false;
        }
        
        return true;
    }

    public function deleteTempFile(int $fileId, string $tempDir = null): bool
    {
        $tempDir = $tempDir ?? sys_get_temp_dir();
        $tempFile = $tempDir . '/cotton_chunk_' . $fileId . '.part';
        
        if (file_exists($tempFile)) {
            return unlink($tempFile);
        }
        
        return true;
    }

    public function finalizeFileFromTemp(int $fileId, string $tempDir = null): array
    {
        $tempDir = $tempDir ?? sys_get_temp_dir();
        $tempFile = $tempDir . '/cotton_chunk_' . $fileId . '.part';
        
        if (!file_exists($tempFile)) {
            return ['success' => false, 'message' => 'Temp file not found'];
        }
        
        $fileSize = filesize($tempFile);
        $maxPacket = $this->getMaxMySQLPacket();
        $readChunk = min(256 * 1024, intval($maxPacket / 2));
        $handle = fopen($tempFile, 'rb');
        
        if ($handle === false) {
            return ['success' => false, 'message' => 'Cannot open temp file'];
        }
        
        $db = Factory::getContainer()->get(DatabaseInterface::class);

        $clear_query = $db->createQuery();
        
        $fields = array(
            $db->quoteName('file_data') . ' = :file_data'
        );
        $conditions = array(
            $db->quoteName('id') . ' = :id'
        );

        $clear = '';
        
        $clear_query->update($db->quoteName('#__cotton_file'))->set($fields)->where($conditions);
        $clear_query
        ->bind(':file_data', $clear, ParameterType::LARGE_OBJECT)
        ->bind(':id', $fileId, ParameterType::INTEGER);

        $db->setQuery($clear_query);

        $result = $db->execute();


        $concat_query = $db->createQuery();

        $fields = array(
            $db->quoteName('file_data') . ' = CONCAT(file_data, :file_data)',
            $db->quoteName('date_updated') . ' = :date_updated'
        );
        $conditions = array(
            $db->quoteName('id') . ' = :id'
        );
        
        $date_updated = (string) Factory::getDate()->toSql();

        $concat_query->update($db->quoteName('#__cotton_file'))->set($fields)->where($conditions);
        $concat_query
        ->bind(':date_updated', $date_updated, ParameterType::STRING)
        ->bind(':id', $fileId, ParameterType::INTEGER);
        
        if (!$result) {
            fclose($handle);
            unlink($tempFile);
            return ['success' => false, 'message' => 'Failed to clear file data'];
        }
        
        $chunk = '';

        while (!feof($handle)) {
            $chunk = fread($handle, $readChunk);
            if ($chunk !== false && $chunk !== '') {
                $concat_query->bind(':file_data', $chunk, ParameterType::LARGE_OBJECT);
                $db->setQuery($concat_query);
                $result = $db->execute();
                if (!$result) {
                    fclose($handle);
                    unlink($tempFile);
                    return ['success' => false, 'message' => 'Failed to update file data'];
                }
            }
        }

        fclose($handle);

        $finalSize = filesize($tempFile);
        if ($finalSize !== false) {
            $sizeQuery = $db->getQuery(true)
                ->update($db->quoteName('#__cotton_file'))
                ->set($db->quoteName('size') . ' = ' . (int) $finalSize)
                ->where($db->quoteName('id') . ' = ' . (int) $fileId);
            $db->setQuery($sizeQuery);
            $db->execute();
        }

        unlink($tempFile);

        return ['success' => true];
    }

    /**
     * Obter max_allowed_packet do MySQL
     */
    protected function getMaxMySQLPacket(): int
    {
        try {
            $this->db->setQuery("SHOW VARIABLES LIKE 'max_allowed_packet'");
            $result = $this->db->loadObject();
            return isset($result->Value) ? intval($result->Value) : 10485760; // default 10MB
        } catch (\Exception $e) {
            return 10485760; // 10MB default
        }
    }

}