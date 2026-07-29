<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Site\Model\Service;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Tabaoca\Component\Cotton\Site\Model\Folder\FolderRepository;

class TrashManager
{
    /**
     * Move an item to trash (trash=1) or recover (trash=0)
     * @param string $type 'folder'|'file'
     * @param int $id
     * @param bool $recover
     * @return bool
     */
    public function setTrash(string $type, int $id, bool $recover = false): bool
    {
        $db = Factory::getDbo();
        $table = ($type === 'folder') ? '#__cotton_folder' : '#__cotton_file';
        $trashValue = $recover ? 0 : 1;

        $item = new \stdClass();
        $item->id = (int) $id;
        $item->trash = $trashValue;

        return (bool) $db->updateObject($table, $item, 'id');
    }

    /**
     * Permanently delete an item.
     * @param string $type
     * @param int $id
     * @return bool
     */
    public function purge(string $type, int $id): bool
    {
        $db = Factory::getDbo();
        $table = ($type === 'folder') ? '#__cotton_folder' : '#__cotton_file';

        $query = $db->getQuery(true)
            ->delete($db->quoteName($table))
            ->where($db->quoteName('id') . ' = ' . $db->quote($id));

        $db->setQuery($query);
        return (bool) $db->execute();
    }

    /**
     * Load trashed items for a user.
     * Returns object with folders, files, list, limits and path.
     * Compatible with both trash_load and load_trash endpoints.
     */
    public function loadTrash(int $userId): \stdClass
    {
        $db = Factory::getDbo();
        $data = new \stdClass();
        $folderRepo = new FolderRepository();

        // Load trashed folders
        $query = $db->getQuery(true)
            ->select('a.id as id, a.owner_id as owner_id, a.name as name, a.description as description, a.date_created as date_created, a.date_updated as date_updated, 
					a.parent_id as parent_id, a.allowed_users as allowed_users, a.open_link as open_link, a.trash as trash, a.params as params')
            ->from($db->quoteName('#__cotton_folder', 'a'))
            ->where($db->quoteName('a.owner_id') . ' = ' . $db->quote($userId))
            ->where($db->quoteName('a.trash') . ' = 1')
            ->group($db->quoteName('a.id'))
            ->select('COUNT(DISTINCT b.id) as n_folders')
            ->join('LEFT', $db->quoteName('#__cotton_folder', 'b') . ' ON b.parent_id = a.id AND b.owner_id = ' . $db->quote($userId))
            ->select('COUNT(DISTINCT c.id) as n_files')
            ->join('LEFT', $db->quoteName('#__cotton_file', 'c') . ' ON c.folder_id = a.id AND c.owner_id = ' . $db->quote($userId))
            ->order($db->quoteName('a.name'));

        $db->setQuery($query);
        $db->execute();

        $data->n_folders_trash = $db->getNumRows();
        $folders = $db->loadObjectList();
        $data->folders_trash = $folders ?: [];
        
        // Add path to each folder
        foreach ($data->folders_trash as $folder) {
            $folder->path = $folderRepo->getFolderPath((int) $folder->id, $userId);
        }

        // Load trashed files
        $query = $db->getQuery(true)
            ->select('a.id as id, a.owner_id as owner_id, a.name as name, a.description as description, a.date_created as date_created, a.date_updated as date_updated, 
					a.folder_id as folder_id, a.allowed_users as allowed_users, a.open_link as open_link, a.trash as trash, a.params as params, a.size as size')
            ->from($db->quoteName('#__cotton_file', 'a'))
            ->where($db->quoteName('a.owner_id') . ' = ' . $db->quote((int) $userId))
            ->where($db->quoteName('a.trash') . ' = 1')
            ->order($db->quoteName('a.name'));

        $db->setQuery($query);
        $db->execute();

        $files = $db->loadObjectList();
        $data->n_files_trash = $db->getNumRows();
        $data->files_trash = $files ?: [];
        
        // Add path to each file
        foreach ($data->files_trash as $file) {
            $file->path = $folderRepo->getFolderPath((int) $file->folder_id, $userId);
        }

        // Load all user folders for tree view (not including trash folders)
        $allFolders = $folderRepo->getUserFolders($userId);
        $data->n_list = count($allFolders);
        $data->list = $allFolders;

        // Add paths to folders in tree
        foreach ($data->list as $folder) {
            $folder->path = $folderRepo->getFolderPath((int) $folder->id, $userId);
        }

        // Add limits
        $data->limits = $this->getLimits($userId);
        $data->path = '/Trash';

        return $data;
    }

    /**
     * Get space limits for user
     */
    private function getLimits(int $userId): \stdClass
    {
        $db = Factory::getDbo();
        $data = new \stdClass();

        $query = $db->getQuery(true)
            ->select('SUM(a.size) as used_space')
            ->from($db->quoteName('#__cotton_file', 'a'))
            ->where($db->quoteName('a.owner_id') . ' = ' . $db->quote($userId));

        $db->setQuery($query);
        $db->execute();
        $used_space = $db->loadObjectList();
        $data->used_space = $used_space ? (int) $used_space[0]->used_space : 0;

        $query = $db->getQuery(true)
            ->select('SUM(a.size) as trash_used_space')
            ->from($db->quoteName('#__cotton_file', 'a'))
            ->where($db->quoteName('a.owner_id') . ' = ' . $db->quote($userId))
            ->where($db->quoteName('a.trash') . ' = 1');

        $db->setQuery($query);
        $db->execute();
        $trash_used_space = $db->loadObjectList();
        $data->trash_used_space = $trash_used_space ? (int) $trash_used_space[0]->trash_used_space : 0;

        $val = trim(ini_get('upload_max_filesize'));
        $last = strtolower($val[strlen($val)-1]);
        $result = '';
        for ($i = 0; $i < strlen($val); $i++) {
            $result .= $val[$i];
        }
        $result = intval($result);
        switch ($last) {
            case 'g': $result *= 1024;
            case 'm': $result *= 1024;
            case 'k': $result *= 1024;
        }
        $data->max_filesize = $result > 4294967295 ? 4294967295 : $result;
        $data->limit_space = 0; // No limit by default in this simplified version

        return $data;
    }
}