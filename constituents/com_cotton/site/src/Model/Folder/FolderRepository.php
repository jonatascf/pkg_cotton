<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Cotton\Site\Model\Folder;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;

/**
 * Repository responsável pelo acesso a dados de pastas.
 */
class FolderRepository
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

    /**
     * Try to get cached value. Uses Joomla cache when available or local in-memory fallback.
     *
     * @param string $key
     * @return mixed|false
     */
    protected function cacheGet(string $key)
    {
        try {
            if (class_exists('\Joomla\\CMS\\Factory')) {
                $cache = Factory::getCache('com_cotton');
                $val = $cache->get($key);
                if ($val !== false) {
                    return $val;
                }
            }
        } catch (\Throwable $e) {
            // ignore and fallback to local
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

    /**
     * Store value in cache (Joomla cache when available or local fallback)
     *
     * @param string $key
     * @param mixed $value
     * @param int|null $ttl
     * @return void
     */
    protected function cacheSet(string $key, $value, ?int $ttl = null): void
    {
        $ttl = $ttl ?? $this->cacheTtl;
        try {
            if (class_exists('\Joomla\\CMS\\Factory')) {
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

    /**
     * Remove a cache entry by key.
     *
     * @param string $key
     * @return void
     */
    protected function cacheDelete(string $key): void
    {
        try {
            if (class_exists('\Joomla\\CMS\\Factory')) {
                $cache = Factory::getCache('com_cotton');
                if (method_exists($cache, 'remove')) {
                    $cache->remove($key);
                    return;
                }
                // fallback: clean all for component (coarse)
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

    /**
     * Invalidate cache entries by prefix (local fallback). Joomla cache does not support prefix removal reliably.
     *
     * @param string $prefix
     * @return void
     */
    protected function cacheInvalidatePrefix(string $prefix): void
    {
        try {
            if (class_exists('\Joomla\\CMS\\Factory')) {
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
        $query = $this->db->getQuery(true)
            ->select('*')
            ->from($this->db->quoteName('#__cotton_folder'))
            ->where($this->db->quoteName('id') . ' = ' . $this->db->quote($id));

        $this->db->setQuery($query);
        return $this->db->loadObject();
    }

    public function getChildren(int $parentId): array
    {
        $query = $this->db->getQuery(true)
            ->select('*')
            ->from($this->db->quoteName('#__cotton_folder'))
            ->where($this->db->quoteName('parent_id') . ' = ' . $this->db->quote($parentId))
            ->order($this->db->quoteName('name') . ' ASC');

        $this->db->setQuery($query);
        return (array) $this->db->loadObjectList();
    }

    public function insert(\stdClass $data): int
    {
        
    $this->db->insertObject('#__cotton_folder', $data, 'id');

       /* $columns = [];
        $values = [];

        foreach ($data as $k => $v) {
            $columns[] = $this->db->quoteName($k);
            $values[] = $this->db->quote($v);
        }

        $query = $this->db->getQuery(true)
            ->insert($this->db->quoteName('#__cotton_folder'))
            ->columns($columns)
            ->values(implode(',', $values));

        $this->db->setQuery($query);
        $this->db->execute();

        $id = (int) $this->db->insertid();*/

        // Invalidate caches affected by new folder
        $ownerId = $data->owner_id ?? null;
        $parentId = $data->parent_id ?? null;
        if ($ownerId) {
            $this->cacheDelete('user_folders_' . $ownerId);
        }
        if ($parentId) {
            // children stats for parent may be affected
            $this->cacheInvalidatePrefix('children_stats_' . $parentId . '_');
        }

        return $data->id;
    }

    public function update(int $id, array $data): bool
    {
        $sets = [];
        foreach ($data as $k => $v) {
            $sets[] = $this->db->quoteName($k) . ' = ' . $this->db->quote($v);
        }

        $query = $this->db->getQuery(true)
            ->update($this->db->quoteName('#__cotton_folder'))
            ->set($sets)
            ->where($this->db->quoteName('id') . ' = ' . $this->db->quote($id));

        $this->db->setQuery($query);
        $ok = (bool) $this->db->execute();

        // Invalidate caches
        $existing = $this->getById($id);
        $ownerId = $existing->owner_id ?? ($data['created_by'] ?? $data['owner_id'] ?? null);
        $parentId = $existing->parent_id ?? ($data['parent_id'] ?? null);
        if ($ownerId) {
            $this->cacheDelete('user_folders_' . $ownerId);
        }
        if ($parentId) {
            $this->cacheInvalidatePrefix('children_stats_' . $parentId . '_');
        }

        return $ok;
    }

    public function delete(int $id): bool
    {
        // Fetch existing to know owner/parent
        $existing = $this->getById($id);

        $query = $this->db->getQuery(true)
            ->delete($this->db->quoteName('#__cotton_folder'))
            ->where($this->db->quoteName('id') . ' = ' . $this->db->quote($id));

        $this->db->setQuery($query);
        $ok = (bool) $this->db->execute();

        if ($ok) {
            $ownerId = $existing->owner_id ?? null;
            $parentId = $existing->parent_id ?? null;
            if ($ownerId) {
                $this->cacheDelete('user_folders_' . $ownerId);
            }
            if ($parentId) {
                $this->cacheInvalidatePrefix('children_stats_' . $parentId . '_');
            }
        }

        return $ok;
    }

    public function getStorageStats(int $ownerId = 0): array
    {
        $query = $this->db->getQuery(true)
            ->select('COUNT(f.id) AS folders, COALESCE(SUM(f.size),0) AS total_size')
            ->from($this->db->quoteName('#__cotton_folder', 'f'));

        if ($ownerId) {
            $query->where($this->db->quoteName('f.created_by') . ' = ' . $this->db->quote($ownerId));
        }

        $this->db->setQuery($query);
        $row = $this->db->loadAssoc();

        return $row ?: ['folders' => 0, 'total_size' => 0];
    }

    /**
     * Get children folders with statistics (file/folder counts)
     */
    public function getChildrenWithStats(int $parentId, int $userId): array
    {
        $cacheKey = 'children_stats_' . $parentId . '_' . $userId;
        $cached = $this->cacheGet($cacheKey);
        if ($cached !== false) {
            return (array) $cached;
        }

        $query = $this->db->getQuery(true)
            ->select('a.id, a.owner_id, a.name as name, a.description, a.date_created, a.date_updated, a.parent_id, a.trash, a.open_link, a.allowed_users')
            ->from($this->db->quoteName('#__cotton_folder', 'a'))
            ->where($this->db->quoteName('a.parent_id') . ' = ' . $this->db->quote($parentId))
            ->where($this->db->quoteName('a.owner_id') . ' = ' . $this->db->quote($userId))
            ->where($this->db->quoteName('a.trash') . ' = 0')
            ->group($this->db->quoteName('a.id'))
            ->select('COUNT(DISTINCT b.id) AS n_folders')
            ->join('LEFT', $this->db->quoteName('#__cotton_folder', 'b') . ' ON b.parent_id = a.id AND b.owner_id = ' . $this->db->quote($userId) . ' AND b.trash = 0')
            ->select('COUNT(DISTINCT c.id) AS n_files')
            ->join('LEFT', $this->db->quoteName('#__cotton_file', 'c') . ' ON c.folder_id = a.id AND c.owner_id = ' . $this->db->quote($userId) . ' AND c.trash = 0')
            ->order($this->db->quoteName('a.name') . ' ASC');

        $this->db->setQuery($query);
        $result = (array) $this->db->loadObjectList();
        $this->cacheSet($cacheKey, $result, $this->cacheTtl);

        return $result;
    }

    /**
     * Get folder path recursively (breadcrumb)
     */
    public function getFolderPath(int $folderId, int $userId): string
    {
        $query = $this->db->getQuery(true)
            ->select('a.id, a.name as name, a.parent_id')
            ->from($this->db->quoteName('#__cotton_folder', 'a'))
            ->where($this->db->quoteName('a.id') . ' = ' . $this->db->quote($folderId))
            ->where($this->db->quoteName('a.owner_id') . ' = ' . $this->db->quote($userId))
            ->where($this->db->quoteName('a.trash') . ' = 0');

        $this->db->setQuery($query);
        $folder = $this->db->loadObject();

        if (!$folder) {
            return '';
        }

        if ($folder->parent_id) {
            return $this->getFolderPath((int) $folder->parent_id, $userId) . '/' . $folder->name;
        }

        return $folder->name;
    }

    /**
     * Get all user folders (for tree view)
     */
    public function getUserFolders(int $userId): array
    {
        $cacheKey = 'user_folders_' . $userId;
        $cached = $this->cacheGet($cacheKey);
        if ($cached !== false) {
            return (array) $cached;
        }

        $query = $this->db->getQuery(true)
            ->select('a.id, a.name as name, a.parent_id, a.open_link')
            ->from($this->db->quoteName('#__cotton_folder', 'a'))
            ->where($this->db->quoteName('a.owner_id') . ' = ' . $this->db->quote($userId))
            ->where($this->db->quoteName('a.trash') . ' = 0')
            ->order($this->db->quoteName('a.name') . ' ASC');

        $this->db->setQuery($query);
        $result = (array) $this->db->loadObjectList();

        foreach ($result as &$folder) {
            $folder->path = $this->getFolderPath((int) $folder->id, $userId);
        }

        $this->cacheSet($cacheKey, $result, $this->cacheTtl);

        return $result;
    }

    /**
     * Get count of folders with same name in parent folder
     *
     * @param int $parentId
     * @param string $name
     * @return int
     */
    public function getCountByNameInParent(int $parentId, string $name): int
    {
        $query = $this->db->getQuery(true)
            ->select('COUNT(*)')
            ->from($this->db->quoteName('#__cotton_folder'))
            ->where($this->db->quoteName('parent_id') . ' = ' . $this->db->quote($parentId))
            ->where($this->db->quoteName('name') . ' = ' . $this->db->quote($name))
            ->where($this->db->quoteName('trash') . ' = 0');

        $this->db->setQuery($query);
        return (int) $this->db->loadResult();
    }

    /**
     * Generate unique name by appending (1), (2), etc. if name exists
     *
     * @param int $parentId
     * @param string $name
     * @return string
     */
    public function generateUniqueName(int $parentId, string $name): string
    {
        // Check if name exists
        if ($this->getCountByNameInParent($parentId, $name) === 0) {
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
        while ($this->getCountByNameInParent($parentId, $baseName . '(' . $counter . ')' . $extension) > 0) {
            $counter++;
        }

        return $baseName . '(' . $counter . ')' . $extension;
    }
}