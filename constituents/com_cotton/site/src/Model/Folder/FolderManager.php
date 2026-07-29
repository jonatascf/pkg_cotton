<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Site\Model\Folder;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;

/**
 * Gerencia regras de negócio para pastas.
 */
class FolderManager
{
    protected $repo;

    public function __construct(FolderRepository $repo = null)
    {
        $this->repo = $repo ?? new FolderRepository();
    }

    /**
     * Get the underlying repository instance.
     *
     * @return FolderRepository
     */
    public function getRepo(): FolderRepository
    {
        return $this->repo;
    }

    public function create(int $parentId, string $name, string $description = '')
    {
        $app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);
        
        $name = trim($name);
        if ($name === '') {
            return ['success' => false, 'message' => Text::_('COM_COTTON_FOLDER_NAME_REQUIRED')];
        }

        // Generate unique name if needed
        $uniqueName = $this->repo->generateUniqueName($parentId, $name);

        $user = $app->getIdentity();
        $now = (string) Factory::getDate()->toSql();

        /*$data = [
            'parent_id'  => (int) $parentId,
            'name'       => strip_tags($name),
            'description'=> strip_tags($description),
            'date_created'    => $now,
            'owner_id' => (int) ($user->id ?? 0)
        ];*/

        $data = new \stdClass();
        $data->parent_id = (int) $parentId;
        $data->name = strip_tags($uniqueName);
        $data->description = strip_tags($description);
        $data->date_created = $now;
        $data->date_updated = $now;
        $data->owner_id = (int) ($user->id ?? 0);

        try {
            $id = $this->repo->insert($data);
            return ['success' => true, 'id' => $id, 'name' => strip_tags($uniqueName)];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function load(int $id)
    {
        return $this->repo->getById($id);
    }

    /**
     * Load a folder with its children folders, files, and folder tree
     */
    public function loadWithChildren(int $folderId, int $userId): ?\stdClass
    {
        $data = new \stdClass();
        
        // Load children folders with stats
        $childFolders = $this->repo->getChildrenWithStats($folderId, $userId);
        $data->n_folders = count($childFolders);
        $data->folders = $childFolders;
        
        // Load files in this folder
        $fileRepo = new \Tabaoca\Component\Cotton\Site\Model\File\FileRepository();
        $files = $fileRepo->getByFolderForUser($folderId, $userId);
        $data->n_files = count($files);
        $data->files = $files;
        
        // Add paths to each file
        if ($data->n_files) {
            for ($i = 0; $i < $data->n_files; $i++) {
                $data->files[$i]->path = $this->repo->getFolderPath((int) $data->files[$i]->folder_id, $userId);
            }
        }
        
        return $data;
        
    }

    public function update(int $id, string $name, string $description = '', int $open_link = 0, string $allowed_users = '')
    {
        $app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);
        
        $name = trim($name);
        if ($name === '') {
            return ['success' => false, 'message' => Text::_('COM_COTTON_FOLDER_NAME_REQUIRED')];
        }

        // Process allowed_users: convert comma-separated IDs to JSON array
        $processedAllowedUsers = '';
        if ($open_link == 1 && !empty($allowed_users)) {
            $validUsers = [];
            
            // Verificar se é um array JSON ou string separada por vírgulas
            if (is_array($allowed_users)) {
                // Já é um array
                $validUsers = array_filter(array_map('intval', $allowed_users), function($uid) { return $uid > 0; });
            } elseif (is_string($allowed_users)) {
                // Tentar decodificar como JSON primeiro
                $decoded = json_decode($allowed_users, true);
                if (is_array($decoded)) {
                    $validUsers = array_filter(array_map('intval', $decoded), function($uid) { return $uid > 0; });
                } else {
                    // Procesar string separada por vírgulas
                    $usersArray = explode(',', $allowed_users);
                    foreach ($usersArray as $userId) {
                        $userId = trim($userId);
                        if (is_numeric($userId) && intval($userId) > 0) {
                            $validUsers[] = intval($userId);
                        }
                    }
                }
            }
            $processedAllowedUsers = json_encode($validUsers);
        } else {
            $processedAllowedUsers = '';
        }

        $data = [
            'name' => strip_tags($name),
            'description' => strip_tags($description),
            'open_link' => $open_link,
            'allowed_users' => $processedAllowedUsers
        ];

        try {
            $ok = $this->repo->update($id, $data);
            return ['success' => (bool) $ok];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function delete(int $id)
    {
        try {
            $ok = $this->repo->delete($id);
            return ['success' => (bool) $ok];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Delete a folder recursively or move to trash.
     *
     * @param int $folderId
     * @param int $trash 0 = delete, 1 = trash, 2 = recover
     * @return array
     */
    public function deleteRecursive(int $folderId, int $trash = 1): array
    {
        $db = Factory::getDbo();

        // load children folders
        $children = $this->repo->getChildren($folderId);

        // recurse into children
        foreach ($children as $child) {
            $this->deleteRecursive((int) $child->id, $trash);
        }

        // handle files in this folder
        if ($trash) {
            // send files to trash (trash=1)
            $query = $db->getQuery(true)
                ->update($db->quoteName('#__cotton_file'))
                ->set($db->quoteName('trash') . ' = 1')
                ->where($db->quoteName('folder_id') . ' = ' . $db->quote($folderId));
            $db->setQuery($query);
            $db->execute();
        } else {
            // delete files physically from DB (metadata)
            $query = $db->getQuery(true)
                ->delete($db->quoteName('#__cotton_file'))
                ->where($db->quoteName('folder_id') . ' = ' . $db->quote($folderId));
            $db->setQuery($query);
            $db->execute();
        }

        // finally handle this folder itself
        if ($trash) {
            $item = new \stdClass();
            $item->id = $folderId;
            $item->trash = 1;
            $db->updateObject('#__cotton_folder', $item, 'id');
        } else {
            // delete child relations already removed, now delete folder
            $this->repo->delete($folderId);
        }

        return ['success' => true];
    }

    /**
     * Send a list of items to trash or delete them.
     * Kept for compatibility with previous model usage.
     *
     * @param array $items
     * @param string $type 'folder'|'file'
     * @param bool $recover
     * @return array
     */
    public function itemsTrash(array $items, string $type, bool $recover = false): array
    {
        $db = Factory::getDbo();

        foreach ($items as $it) {
            $id = (int) ($it->id ?? $it);
            if ($type === 'folder') {
                $obj = new \stdClass();
                $obj->id = $id;
                $obj->trash = $recover ? 0 : 2;
                $db->updateObject('#__cotton_folder', $obj, 'id');
            } else {
                $obj = new \stdClass();
                $obj->id = $id;
                $obj->trash = $recover ? 0 : 2;
                $db->updateObject('#__cotton_file', $obj, 'id');
            }
        }

        return ['success' => true];
    }

    /**
     * Permanently delete a list of items.
     *
     * @param array $items
     * @param string $type
     * @return array
     */
    public function itemsDelete(array $items, string $type): array
    {
        $db = Factory::getDbo();
        $ids = array_map(function ($i) { return (int) ($i->id ?? $i); }, $items);
        if (empty($ids)) {
            return ['success' => true];
        }

        $list = implode(',', $ids);

        if ($type === 'folder') {
            $query = $db->getQuery(true)
                ->delete($db->quoteName('#__cotton_folder'))
                ->where('id IN (' . $list . ')');
            $db->setQuery($query);
            $db->execute();
        } else {
            $query = $db->getQuery(true)
                ->delete($db->quoteName('#__cotton_file'))
                ->where('id IN (' . $list . ')');
            $db->setQuery($query);
            $db->execute();
        }

        return ['success' => true];
    }
}
