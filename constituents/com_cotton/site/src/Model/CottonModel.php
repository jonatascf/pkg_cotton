<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Site\Model;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\Model\BaseModel;
use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Uri\Uri;
use Joomla\CMS\Component\ComponentHelper;
use Tabaoca\Component\Cotton\Site\Model\Folder\FolderManager;
use Tabaoca\Component\Cotton\Site\Model\File\FileManager;
use Tabaoca\Component\Cotton\Site\Model\Service\TrashManager;
use Tabaoca\Component\Cotton\Site\Model\Service\SpaceCalculator;

/**
 * Model of Cotton Cloud System component
 *
 * @package     Tabaoca.Component.Cotton.Site
 * @subpackage  com_cotton
 * @since       2.0.0
 */
class CottonModel extends BaseModel {

	/**
	* Constant to check max file size to database LONGBLOB field.
	*/ 
	protected $max_filesize_db = 4294967295;

	/**
	 * @var FolderManager|null
	 */
	protected $folderManager = null;

	/**
	 * @var FileManager|null
	 */
	protected $fileManager = null;

	/**
	 * @var TrashManager|null
	 */
	protected $trashManager = null;

	/**
	 * @var SpaceCalculator|null
	 */
	protected $spaceCalculator = null;

	/**
	 * Lazy-create FolderManager
	 *
	 * @return FolderManager
	 */
	protected function getFolderManager()
	{
		if ($this->folderManager === null) {
			$this->folderManager = new FolderManager();
		}
		return $this->folderManager;
	}

	/**
	 * Lazy-create FileManager
	 *
	 * @return FileManager
	 */
	public function getFileManager()
	{
		if ($this->fileManager === null) {
			$this->fileManager = new FileManager();
		}
		return $this->fileManager;
	}

	/**
	 * Lazy-create TrashManager
	 *
	 * @return TrashManager
	 */
	protected function getTrashManager()
	{
		if ($this->trashManager === null) {
			$this->trashManager = new TrashManager();
		}
		return $this->trashManager;
	}

	/**
	 * Lazy-create SpaceCalculator
	 *
	 * @return SpaceCalculator
	 */
	protected function getSpaceCalculator()
	{
		if ($this->spaceCalculator === null) {
			$this->spaceCalculator = new SpaceCalculator();
		}
		return $this->spaceCalculator;
	}
	
	/**
	* Method to get inicial data information to init the Cotton Cloud System.
	* 
	* @return  object  Root folder content information and configuration data of system.
	* @since   2.0.0
	*/
	public function init () {

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = $currentuser->get("id");

		$config = ComponentHelper::getParams('com_cotton');

		$data = $this->items_load(0);
		$data->limits = $this->limit_file_space();
		$data->config = new \stdClass();
		$data->config->text_formats = $this->array_formats($config->get('cotton_text_formats', 'txt,md,ini,htm,html,xhtml,xml,js,mjs,php,css,sass,scss,less,csv,ics,json,jsonld,xul'));
		$data->config->image_formats = $this->array_formats($config->get('cotton_image_formats', 'bmp,jpg,jpeg,jfif,pjpeg,pjp,png,apng,gif,svg,webp'));
		$data->config->video_formats = $this->array_formats($config->get('cotton_video_formats', 'mp4,webm,ogg'));
		$data->config->audio_formats = $this->array_formats($config->get('cotton_audio_formats', 'wav,mp3,ogg'));
		$data->config->config_header = $config->get('cotton_header');

		return $data;

	}

	/**
	* Method to load folder tree starting from a specific folder.
	*
	* @param   int     $folder_id   Folder id to start the tree (0 for root).
	* @param   bool    $with_files  If true, include files data in the tree nodes.
	* 
	* @return  object  Tree structure with folders ordered alphabetically.
	* @since   2.0.0
	*/
	public function tree_load ($folder_id = 0, $with_files = false) {

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = (int) $currentuser->get("id");
		$app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);

		$allFolders = $this->getFolderManager()->getRepo()->getUserFolders($user_id);

		$lookup = [];
		foreach ($allFolders as $f) {
			$f->children = [];
			$f->files = [];
			$lookup[(int) $f->id] = $f;
		}

		$rootId = (int) $folder_id;
		$tree = [];

		if ($rootId === 0) {
			$rootFolder = new \stdClass();
			$rootFolder->id = 0;
			$rootFolder->name = Text::_('COM_COTTON_ROOT');
			$rootFolder->children = [];
			$rootFolder->files = [];
			
			foreach ($allFolders as $f) {
				$fParentId = (int) ($f->parent_id ?? 0);
				if ($fParentId === 0) {
					$rootFolder->children[] = $f;
				} elseif (isset($lookup[$fParentId])) {
					$lookup[$fParentId]->children[] = $f;
				}
			}
			
			$tree[] = $rootFolder;
		} else {
			if (isset($lookup[$rootId])) {
				$tree[] = $lookup[$rootId];
				foreach ($allFolders as $f) {
					$fId = (int) $f->id;
					$fParentId = (int) ($f->parent_id ?? 0);
					if ($fId !== $rootId && isset($lookup[$fParentId])) {
						$lookup[$fParentId]->children[] = $f;
					}
				}
			}
		}

		$this->sortTreeRecursive($tree);

		if ($with_files) {
			$fileRepo = new \Tabaoca\Component\Cotton\Site\Model\File\FileRepository();
			if ($rootId === 0) {
				$rootFiles = $fileRepo->getByFolderForUser(0, $user_id);
				$tree[0]->files = $rootFiles;
				usort($tree[0]->files, function($a, $b) {
					return strcasecmp($a->name, $b->name);
				});
			}
			foreach ($lookup as $folder) {
				$files = $fileRepo->getByFolderForUser((int) $folder->id, $user_id);
				$folder->files = $files;
				usort($folder->files, function($a, $b) {
					return strcasecmp($a->name, $b->name);
				});
			}
		}

		$data = new \stdClass();
		$data->tree = $tree;
		$data->n = count($tree);

		return $data;

	}


	/**
	* Method to load all items (folders and files) of a folder.
	*
	* @param   int  $folder_id Folder id to load items (0 for root).
	* 
	* @return  object  Folder items data (folders and files ordered alphabetically).
	* @since   2.0.0
	*/
	public function items_load ($folder_id = 0) {

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = (int) $currentuser->get("id");

		$folderRepo = new \Tabaoca\Component\Cotton\Site\Model\Folder\FolderRepository();
		$fileRepo = new \Tabaoca\Component\Cotton\Site\Model\File\FileRepository();

		$folder_id = (int) $folder_id;
		$folders = $folderRepo->getChildrenWithStats($folder_id, $user_id);

		$data = new \stdClass();
		$data->n_folders = count($folders);
		$data->folders = array_values($folders);

		$files = $fileRepo->getByFolderForUser($folder_id, $user_id);

		$data->n_files = count($files);
		$data->files = array_values($files);
		$data->folder_id = $folder_id;
        $data->path_folder = $folderRepo->getFolderPath((int) $folder_id, $user_id);
		$data->limits = $this->limit_file_space();

		$data->n = $data->n_folders + $data->n_files;

		return $data;

	}

/**
 	* Load trash items (files and folders with trash = 1).
 	* 
 	* @return  object  Trash content data (folders, files).
 	* @since   2.0.0
 	*/
 	public function trash_load () {
	 	
 		$currentuser = Factory::getApplication()->getIdentity();
 		$user_id = (int) $currentuser->get("id");
 		
 		return $this->getTrashManager()->loadTrash((int) $user_id);
 	}

 	/**
 	* Method to sort tree nodes and children recursively in alphabetical order.
	*
	* @param   array  &$nodes  Nodes reference to sort.
	* 
	* @return  void
	*/
	private function sortTreeRecursive(&$nodes) {
		usort($nodes, function($a, $b) {
			return strcasecmp($a->name, $b->name);
		});
		foreach ($nodes as &$node) {
			if (!empty($node->children)) {
				$this->sortTreeRecursive($node->children);
			}
		}
	}

	/**
	* Method to create a new folder item in the database.
	* 
	* @param   int  $parent_id  Id of parent folder.
	* @param   string  $folder_name  The name to new folder.
	* @param   string  $folder_description The description to new folder.
	* 
	* @return  object  status and $parent_id
	* @since   2.0.0
	*/
	public function folder_create ($parent_id, $name, $description) {

		$validation = $this->validateItemName($name);
		if (!$validation['valid']) {
			throw new \Exception($validation['message']);
		}

		$res = $this->getFolderManager()->create((int) $parent_id, (string) $name, (string) $description);

		$data = new \stdClass();
		foreach ((array) $res as $k => $v) {
			$data->{$k} = $v;
		}
		// keep compatibility: parent_id expected by callers
		$data->parent_id = $parent_id;

		return $data;

	}

	/**
	* Method to update data information from a folder item.
	* 
	* @param   int  $folder_id  Id of folder to be updated.
	* @param   string  $folder_name  The name to folder.
	* @param   string  $folder_description The description to folder.
	* 
	* @return  object  Folder data updated.
	* @since   2.0.0
	*/
	public function folder_update ($folder_id, $folder_name, $folder_description, $open_link = 0, $allowed_users = '') {

		$validation = $this->validateItemName($folder_name);
		if (!$validation['valid']) {
			throw new \Exception($validation['message']);
		}

		// Delegate update to FolderManager
		$res = $this->getFolderManager()->update((int) $folder_id, (string) $folder_name, (string) $folder_description, (int) $open_link, (string) $allowed_users);

		$data = new \stdClass();
		foreach ((array) $res as $k => $v) {
			$data->{$k} = $v;
		}

		// return similar structure as original (folder-like) when success
		if (!empty($data->success)) {
			$folder = new \stdClass();
			$folder->id = $folder_id;
			$folder->name = $folder_name;
			$folder->date_updated = date('Y-m-d H:i:s');
			$folder->description = $folder_description;
			$folder->open_link = $open_link;
			$folder->allowed_users = $allowed_users;
			return $folder;
		}

		return $data;

	}

	/**
	* Method to delete a folder item and all your content.
	* 
	* @param   int  $folder_id  Id of folder to be deleted.
	* @param   bool  $trash  If send to trash or delete from database.
	* 
	* @return  void
	* @since   2.0.0
	*/
	public function folder_delete ($folder_id, $trash) {

		// Delegate recursive delete/trash handling to FolderManager
		$trashMode = (int) $trash;
		return $this->getFolderManager()->deleteRecursive((int) $folder_id, $trashMode);
	}

	/**
	* Method to send items to trash or recover item from trash.
	* 
	* @param   array  $items  List of items to be sended to trash.
	* @param   string  $type  If 'folder' or 'file' type of item.
	* @param   bool  $recover  If send to trash o recover item.  
	* 
	* @return  void
	* @since   2.0.0
	*/
	private function folder_items_trash ($items, $type, $recover) {

		// Delegate to FolderManager for bulk trash operations
		return $this->getFolderManager()->itemsTrash((array) $items, (string) $type, (bool) $recover);

	}

	/**
	* Method to delete a item from a folder.
	* 
	* @param   int  $item_id  Id of item to be sended to trash od deleted from database.
	* @param   string  $item_type  If 'folder' or 'file' type of item.
	* @param   bool  $trash  If send to trash or delete item from database.  
	* 
	* @return  object  Status, Item Id and Item type.
	* @since   2.0.0
	*/
	public function item_delete ($item_id, $item_type, $trash) {
				
		$db = $this->getDatabase();
		$item_id = (int) $item_id;
		$item_type = in_array($item_type, ['folder', 'file']) ? $item_type : '';
		$app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);

		if (!$item_id || !$item_type) {
			$data = new \stdClass();
			$data->success = false;
			$data->error = Text::_('COM_COTTON_ERROR');
			return $data;
		}

		switch ($item_type) {
			
			case 'folder':

				// Delegate to FolderManager for recursive trash/delete handling
				$this->folder_delete($item_id, $trash);
				
				break;
			
			case 'file':
				
				if ($trash) {
				
					$item = new \stdClass();
					$item->id = $item_id;
					$item->trash = 1;

					$db->updateObject('#__cotton_file', $item, 'id');

				} else {

					$query = $db->getQuery(true);
					$query->delete($db->quoteName('#__cotton_file'));
					$query->where($db->quoteName('id') . ' = ' . $db->quote($item_id));
					
					$db->setQuery($query);
					$db->execute();

				}
				
				break;

		}

		$data = new \stdClass();
		$data->success = true;
		$data->error = '';
		$data->item_id = $item_id;
		$data->item_type = $item_type;

		return $data;

	}

	/**
	* Method to clear and delete all items in the trash from database.
	* 
	* @return  object  Status.
	* @since   2.0.0
	*/
	public function clear_trash () {
		
		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = (int) $currentuser->get("id");

		$db = $this->getDatabase();

		// Delete Folders in trash
		$query_a = $db->getQuery(true);
		$query_a->delete($db->quoteName('#__cotton_folder'));
		$query_a->where($db->quoteName('owner_id') . ' = ' . $db->quote($user_id));
		$query_a->where($db->quoteName('trash') . ' != 0');
		
		$db->setQuery($query_a);
		$db->execute();

		// Delete Files in trash
		$query_b = $db->getQuery(true);
		$query_b->delete($db->quoteName('#__cotton_file'));
		$query_b->where($db->quoteName('owner_id') . ' = ' . $db->quote($user_id));
		$query_b->where($db->quoteName('trash') . ' != 0');

		$db->setQuery($query_b);
		$db->execute();

		$data = new \stdClass();
		$data->success = true;
		$data->error = '';

		return $data;

	}

	/**
	* Method to recover a item from trash to another folder.
	* 
	* @param   int  $item_id  Id of item to be recovered.
	* @param   string  $item_type  If 'folder' or 'file' type of item.
	* @param   string  $item_name  Name of item to be recovered for check if name exists in folder.
	* @param   int  $folder_id  Id of folder to send recovered item.
	* 
	* @return  object  Status.
	* @since   2.0.0
	*/
	public function item_recover ($item_id, $item_type, $item_name, $folder_id) {

		switch ($item_type) {

			case 'folder' :

				$item = new \stdClass();
				$item->id = $item_id;
				$item->name = $this->check_item_name($folder_id, $item_name, $item_type);
				$item->parent_id = $folder_id;
				$item->trash = 0;

				$db = $this->getDatabase();
				$up = $db->updateObject('#__cotton_folder', $item, 'id');

				break;

			case 'file':

				$item = new \stdClass();
				$item->id = $item_id;
				$item->name = $this->check_item_name($folder_id, $item_name, $item_type);
				$item->folder_id = $folder_id;
				$item->trash = 0;

				$db = $this->getDatabase();
				$up = $db->updateObject('#__cotton_file', $item, 'id');

				break;

		}

		$data = new \stdClass();
		$data->success = true;
		$data->error = '';


		return $data;

	}

	/**
	* Method to delete items from database.
	* 
	* @param   array  $items  List of items to be deleted.
	* @param   string  $type  If 'folder' or 'file' type of items.
	* 
	* @return  void
	* @since   2.0.0
	*/
	public function folder_items_delete ($items, $type) {

		// Delegate to FolderManager for permanent deletions
		return $this->getFolderManager()->itemsDelete((array) $items, (string) $type);

	}

	/**
	* Method to upload a file item to database.
	* 
	* @param   int  $folder_id  Id of folder to insert the file.
	* @param   array  $file_uploaded  Data of file uploaded.
	* @param   string  $file_description  Description of the file uploaded.
	* @param   int  $index  Sequence index to upload multiple files.
	* @param   string  $upload_type  If is 'upload_file' or 'create_file' type.
	* 
	* @return  object  Status, Active Folder Id and index for multiple files.
	* @since   2.0.0
	*/
	public function file_upload ($folder_id, $file_uploaded, $file_description, $index,  $chunk_index,  $total_chunks, $file_id, $upload_type) {

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = $currentuser->get("id");
		$limits = $this->limit_file_space();
		$data = new \stdClass();
		$app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);

		$phpFileUploadErrors = array(	0 => Text::_('COM_COTTON_FILE_UPLOAD_ERROR_0'),
										1 => Text::_('COM_COTTON_FILE_UPLOAD_ERROR_1'),
										2 => Text::_('COM_COTTON_FILE_UPLOAD_ERROR_2'),
										3 => Text::_('COM_COTTON_FILE_UPLOAD_ERROR_3'),
										4 => Text::_('COM_COTTON_FILE_UPLOAD_ERROR_4'),
										5 => Text::_('COM_COTTON_FILE_UPLOAD_ERROR_5'), //File type error
										6 => Text::_('COM_COTTON_FILE_UPLOAD_ERROR_6'),
										7 => Text::_('COM_COTTON_FILE_UPLOAD_ERROR_7'),
										8 => Text::_('COM_COTTON_FILE_UPLOAD_ERROR_8'),
										9 => Text::_('COM_COTTON_FILE_UPLOAD_ERROR_9')
									);
		
		if ($file_uploaded != null) {

			if (!intval($file_uploaded['error'])) {

				if (($limits->used_space + intval($file_uploaded['size']) < $limits->limit_space) || (!$limits->limit_space)) {

					// LIMPAR memória antes de processar
					if (function_exists('gc_enable')) {
						gc_enable();
						gc_collect_cycles();
					}
					// read content when upload
					if ($upload_type == 'upload') {

						$content = file_get_contents($file_uploaded['tmp_name']);

					} else if ($upload_type == 'create') {

						$content = '';

					}

					// chunk handling: create or update
					if ($chunk_index == 0 && empty($file_id)) {
						// Criar registro vazio - conteúdo será adicionado via chunks
						$name = $this->check_item_name($folder_id, $file_uploaded['name'], 'file');
						$res = $this->getFileManager()->create((int) $folder_id, (string) $name, '', (string) $file_description);

						if (!empty($res['success'])) {
							$file_id = $res['id'];
							$data->file_id = $file_id;
						} else {
							$data->success = false;
							$data->error = $res['message'] ?? 'error';
							return $data;
						}
					}

					// Append do chunk ao arquivo temporário
					if ($upload_type == 'upload') {
						$this->getFileManager()->appendChunk((int) $file_id, $content);
					}

					// FORÇAR liberação após usar
					unset($content);
					unset($file_uploaded);
					if (function_exists('gc_collect_cycles')) {
						gc_collect_cycles();
					}

					$data->chunk_index = $chunk_index + 1;
					$data->total_chunks = $total_chunks;

				} else {

					$data->success = false;
					$data->error = $phpFileUploadErrors[9];

				}

			} else {

				$data->success = false;
				$data->error = $phpFileUploadErrors[$file_uploaded['error']];

			}

		if (function_exists('gc_enable')) {
            gc_enable();
            gc_collect_cycles();
        }

		} else {

			$data->success = false;
			$data->error = $phpFileUploadErrors[5];

		}
		
		// Only set success if no error was set previously
		if (!isset($data->success) || $data->success !== false) {
			$data->success = true;
			$data->error = '';
		}
		$data->active_folder_id = $folder_id;
		$data->index = $index;
		$data->file_id = $file_id ?? 0;

		// FORÇAR GC antes de retornar
		if (function_exists('gc_collect_cycles')) {
			gc_collect_cycles();
    	}
		
		if (session_status() === PHP_SESSION_ACTIVE) {
			session_write_close();
		}

		return $data;

	}

	/**
	 * Finaliza upload concatenando arquivo temporário ao arquivo final
	 * @param int $file_id
	 * @return object
	 */
    public function file_finalize($file_id) {
		$app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);

    	$data = new \stdClass();
    	
    	if (!$file_id) {
    		$data->success = false;
    		$data->error = Text::_('COM_COTTON_ERROR_NOFILE');
    		return $data;
    	}
    	
    	// Usar streaming do FileManager
    	$result = $this->getFileManager()->finalizeUpload((int) $file_id);
    	
    	$data->success = $result['success'] ?? false;
    	$data->error = $result['message'] ?? ($result['success'] ? '' : 'Unknown error');
    	$data->file_id = $file_id;
    	
    	return $data;
    }

    public function file_cancel($file_id) {
		$app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);

    	$data = new \stdClass();
    	
    	if (!$file_id) {
    		$data->success = false;
    		$data->error = Text::_('COM_COTTON_ERROR_NOFILE');
    		return $data;
    	}
    	
    	$result = $this->getFileManager()->cancelUpload((int) $file_id);
    	
    	$data->success = $result['success'] ?? false;
    	$data->error = $result['message'] ?? ($result['success'] ? '' : 'Unknown error');
    	$data->file_id = $file_id;
    	
    	return $data;
    }

	/**
	* Method to check if item name exists.
	*
	* @param   int  $folder_id  Id of folder of item.
	* @param   string  $item_name  Name of file to be checked.
	* @param   string  $item_type  If 'folder' or 'file' type of item.
	* 
	* @return  string  Same item name if does not exists or item name added a number.
	* @since   2.0.0
	*/
	public function check_item_name ($folder_id, $item_name, $item_type) {

		$folder_items = $this->items_load($folder_id);
		$i = 0;
		$ext_name = $item_name;

		switch ($item_type) {

			case 'folder':

				$items = new \stdClass();
				$items->n = $folder_items->n_folders;
				$items->item = $folder_items->folders;
				break;

			case 'file':

				$items = new \stdClass();
				$items->n = $folder_items->n_files;
				$items->item = $folder_items->files;
				break;

		}

		if ($items->n) {

			while ($this->check_repeat_name($items, $ext_name)) {

				$i++;

				$ext = explode('.', $item_name);

				if (count($ext) > 1) {

					$ext[count($ext)-2] .= '('.$i.')';

				} else {

					$ext[count($ext)-1] .= '('.$i.')';

				}

				$ext_name = implode('.', $ext);

			}

			if ($i == 0) {

				return $item_name;

			} else {
			
				return $ext_name;

			}

		}

		return $item_name;

	}

	public function validateItemName ($name) {
		$app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);

		$name = trim((string) $name);

		if ($name === '') {
			return [
				'valid' => false,
				'message' => Text::_('COM_COTTON_FOLDERNAME_EMPTY')
			];
		}

		if (preg_match('/[\/\\\\:*?"<>|]/', $name)) {
			return [
				'valid' => false,
				'message' => Text::_('COM_COTTON_ITEMNAME_INVALID') . ': ' . Text::_('COM_COTTON_INVALID_CHARS')
			];
		}

		return [ 'valid' => true ];

	}

	/**
	* Method to check same item name in a list of items.
	*
	* @param   object  $items  List of items to check.
	* @param   string  $item_name  Name of item to be checked.
	* 
	* @return  bool  True if exists same name and False if does not.
	* @since   2.0.0
	*/
	public function check_repeat_name ($items, $item_name) {

		$i = 0;

		while ($i < $items->n) {

			if ($items->item[$i]->name == $item_name) {

				return true;

			}

			$i++;

		}

		return false;

	}

	/**
	* Method to read data file from database.
	*
	* @param   int  $file_id  Id of file to be opened.
	* @param   string  $open_type  If type of function is 'download' or 'open'.
	* 
	* @return  binary  Binary data of file with headers.
	* @since   2.0.0
	*/
	public function file_open ($file_id, $open_type) {

		$app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);
		
		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = $currentuser->get("id");

		$app = Factory::getApplication();

		$result = [];

		$data = $this->file_select_open($file_id);
		
		if ($data->n) {

			$allowed = json_decode($data->file[0]->allowed_users) ?: [];

			if (($data->file[0]->owner_id == $user_id) || (in_array($user_id, $allowed))) {

				$this->file_open_print($data->file[0], $open_type);

			} else {

				switch (intval($data->file[0]->open_link)) {

					case 0:
						
						$this->file_open_error(Text::_('COM_COTTON_ERROR_NOACCESS'));
						break;

					case 1:

						if ($user_id) {

							$this->file_open_print($data->file[0], $open_type);

						} else {

							$this->file_open_error(Text::_('COM_COTTON_ERROR_NOACCESS'));

						}
						

						break;

					case 2:

						$this->file_open_print($data->file[0], $open_type);
						break;

				}

			}
		
		} else {

			$this->file_open_error(Text::_('COM_COTTON_ERROR_NOFILE'));

		}

	}

	/**
	* Method to send binary data of a file with file headers.
	*
	* @param   object  $file  Data of a file to be sended.
	* @param   string  $open_type  If type of function is 'download' or 'open'.
	* 
	* @return  object  Active feed.
	* @since   2.0.0
	*/
	public function file_open_print ($file, $open_type) {

		while (ob_get_level()) {
			ob_end_clean();
		}

		$mimeType = $this->getFileManager()->detectMimeType($file->name);
		$fileSize = (int) strlen($file->file_data);

		header('Content-Length: ' . $fileSize, true);
		header('Content-Type: ' . $mimeType, true);
		header('Cache-Control: private, max-age=0, no-cache', true);
		header('Pragma: public', true);

		switch ($open_type) {

			case 'open':

				header('Content-Disposition: inline; filename="' . $file->name . '"');
				break;

			case 'download':

				header('Content-Disposition: attachment; filename="' . $file->name . '"');
				break;

		}

		echo $file->file_data;
		exit;

	}

	/**
	* Method to return a message error if access to open data file is denied.
	*
	* @param   string  $error  Message to be sended.
	* 
	* @return  string  Html message.
	* @since   2.0.0
	*/
	public function file_open_error ($error) {

		header('Content-Disposition: inline');
		header("Content-type: text/html");

		ob_clean();
		flush();
		echo '<div style="width: 300px;
						  height:60px;
						  background-color: #F9A541;
						  border-radius:6px; padding:20px;
						  font-family: Arial, Helvetica, sans-serif;">
					<span><h3>'.$error.'</h3><a href="'.Uri::root().'">'.Uri::root().'</a></span>
			  </div>';

	}

	/**
	* Method to select a item file information.
	*
	* @param   int  $file_id  Id of a file to be selected.
	* 
	* @return  object  Information of a file.
	* @since   2.0.0
	*/
	private function file_select ($file_id) {

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = $currentuser->get("id");

		$db = $this->getDatabase();
		$query = $db->getQuery(true);

		$query->select('a.id as id, a.owner_id as owner_id, a.name as name, a.date_created as date_created, a.date_updated as date_updated, 
						a.folder_id as folder_id, a.allowed_users as allowed_users, a.open_link as open_link, a.trash as trash, a.params as params');
		$query->from($db->quoteName('#__cotton_file', 'a'));
		$query->where($db->quoteName('a.id') . ' = ' . $db->quote((int) $file_id));
		$query->where($db->quoteName('a.owner_id') . ' = ' . $db->quote((int) $user_id));
		$query->where($db->quoteName('a.trash') . ' = 0');

		$db->setQuery($query);
		$db->execute();

		$data = new \stdClass();
		$data->n = $db->getNumRows();
		$data->file = $db->loadObjectList();

		return $data;

	}

	/**
	* Method to select a item file data.
	*
	* @param   int  $file_id  Id of a file to be opened.
	* 
	* @return  object  Data of a file.
	* @since   2.0.0
	*/
	private function file_select_open ($file_id) {

		$db = $this->getDatabase();
		$query = $db->getQuery(true);

		$query->select('a.id as id, a.owner_id as owner_id, a.name as name, a.date_created as date_created, a.date_updated as date_updated, 
						a.file_data as file_data, a.folder_id as folder_id, a.allowed_users as allowed_users, a.open_link as open_link, a.trash as trash, a.params as params');
		$query->from($db->quoteName('#__cotton_file', 'a'));
		$query->where($db->quoteName('a.id') . ' = ' . $db->quote((int) $file_id));
		$query->where($db->quoteName('a.trash') . ' = 0');

		$db->setQuery($query);
		$db->execute();

		$data = new \stdClass();
		$data->n = $db->getNumRows();
		$data->file = $db->loadObjectList();

		return $data;

	}

	/**
	* Method to save text file data edited by CodeMirror in database.
	* 
	* @param   int  $file_id  Id of file to be saved.
	* @param   text  $file_data  Text of file to be saved.
	* @param   int  $file_size  Size of the text in bytes.
	* 
	* @return  object  Status, Id of the file and saved data.
	* @since   2.0.0
	*/
	public function file_save ($file_id, $file_saved) {
		$app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);

		$limits = $this->limit_file_space();
		$data = new \stdClass();

		if (!intval($file_saved['error'])) {

			if (($limits->used_space + intval($file_saved['size']) < $limits->limit_space) || (!$limits->limit_space)) {
			

				$fp      = fopen($file_saved['tmp_name'], 'r');
				$content = fread($fp, filesize($file_saved['tmp_name']));
				fclose($fp);

				// delegate to FileManager
				$res = $this->getFileManager()->saveContent((int) $file_id, (string) $content);

				if (!empty($res['success'])) {
					$data->success = true;
					$data->error = '';
					$data->file_id = $file_id;
					$data->file_data = $content;
				} else {
					$data->success = false;
					$data->error = $res['message'] ?? Text::_('COM_COTTON_ERROR_SAVE');
					$data->file_id = $file_id;
				}

			} else {

				$data->success = false;
				$data->error = Text::_('COM_COTTON_FILE_UPLOAD_ERROR_9');
				$data->file_id = $file_id;

			}

		} else {

			$data->success = false;
			$data->error = Text::_('COM_COTTON_FILE_UPLOAD_ERROR_' . $file_saved['error']);
			$data->file_id = $file_id;

		}

		return $data;

	}

	/**
	* Method to update information of a file item.
	* 
	* @param   int  $file_id  Id of file to be updated.
	* @param   string  $file_name  Name of file to be updated.
	* @param   string  $file_description  Description of file to be updated.
	* @param   int  $file_open_link  Type of share of file to be updated [0: "No shared", 1: "Shared with Registered Users", 2: "Shared with anyone"].
	* @param   array  $file_allowed_users  List of user IDs with allowed access to this file.
	* 
	* @return  object  File information updated.
	* @since   2.0.0
	*/
	public function file_update ($file_id, $file_name, $file_description, $file_open_link, $file_allowed_users) {

		$validation = $this->validateItemName($file_name);
		if (!$validation['valid']) {
			throw new \Exception($validation['message']);
		}

		$allowed = '';

		// Se open_link = 2 (qualquer usuário), allowed_users pode ser vazio
		// Se open_link = 1 (usuários específicos), processa a string de IDs
		if ($file_open_link == 1 && !empty($file_allowed_users)) {
			$validUsers = [];
			
			// Verificar se é um array JSON ou string separada por vírgulas
			if (is_array($file_allowed_users)) {
				// Já é um array
				$validUsers = array_filter(array_map('intval', $file_allowed_users), function($id) { return $id > 0; });
			} elseif (is_string($file_allowed_users)) {
				// Tentar decodificar como JSON primeiro
				$decoded = json_decode($file_allowed_users, true);
				if (is_array($decoded)) {
					$validUsers = array_filter(array_map('intval', $decoded), function($id) { return $id > 0; });
					} else {
						// Procesar string separada por vírgulas
						$usersArray = explode(',', $file_allowed_users);
						foreach ($usersArray as $userId) {
							$userId = trim($userId);
							if (is_numeric($userId) && intval($userId) > 0) {
								$validUsers[] = intval($userId);
							}
						}
					}
			}
			$allowed = json_encode($validUsers);
		} else {
			$allowed = '';
		}

		$meta = [
			'name' => $file_name,
			'description' => $file_description,
			'date_updated' => date('Y-m-d H:i:s'),
			'open_link' => $file_open_link,
			'allowed_users' => $allowed
		];

		$res = $this->getFileManager()->updateMeta((int) $file_id, $meta);

		if (!empty($res['success'])) {
			$file = new \stdClass();
			$file->id = $file_id;
			$file->name = $file_name;
			$file->description = $file_description;
			$file->date_updated = $meta['date_updated'];
			$file->open_link = $file_open_link;
			$file->allowed_users = $allowed;
			return $file;
		}

		return (object) ['success' => false, 'message' => $res['message'] ?? 'error'];

	}

	/**
	* Method to delete a file item.
	* 
	* @param   int  $file_id  Id of file to be deleted.
	* @param   int  $folder_id  Id of folder to be reloaded after to delete.
	* @param   bool  $trash  If item file is going to the trash or to be deleted from database.
	* 
	* @return  object  Data folder reloaded after item file to be deleted.
	* @since   2.0.0
	*/
	public function file_delete ($file_id, $folder_id, $trash) {

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = (int) $currentuser->get("id");

		$del = $this->file_select($file_id);

		if (!$del->n || (int) $del->file[0]->owner_id !== $user_id) {
			$data->success = false;
			$data->error = Text::_('COM_COTTON_ERROR_NOACCESS');
			return $data;
		}
		
		if ($del->n) {
		
			for ($p = 0; $p < $del->n; $p++) {
				
				if ((int) $del->file[$p]->owner_id !== $user_id) {
			
					if ($trash) {
						
						$this->folder_items_trash([$del->file[$p]], 'file', false);

					} else {

						$this->folder_items_delete([$del->file[$p]], 'file');

					}
				}

			}

			$data = $this->items_load($folder_id);
			$data->error = false;

			return $data;

		} else {

			$data = new \stdClass();
			$data->error = true;

			return $data;

		}

}

 	/**
 	* Method to space limits configuration of Cotton Cloud component.
	* 
	* @return  object  Limit Space per User, Used Space, Trash Used Space and Upload Max File Size.
	* @since   2.0.0
	*/
	public function limit_file_space () {

		$config = ComponentHelper::getParams('com_cotton');
		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = $currentuser->get("id");
		
		$data = new \stdClass();
		
		if (intval($config->get('cotton_limit_space'))) {

			$data->limit_space = intval($config->get('cotton_limit_space'));

		} else {

			$data->limit_space = 0;

		}

		if (intval($config->get('cotton_max_file_size'))) {

			$data->cotton_max_filesize = intval($config->get('cotton_max_file_size'));

		} else {

			$data->cotton_max_filesize = 0;

		}

		$db = $this->getDatabase();
		$query = $db->getQuery(true);

		$query->select('SUM(a.size) as used_space');
		$query->from($db->quoteName('#__cotton_file', 'a'));
		$query->where($db->quoteName('a.owner_id') . ' = ' . $db->quote($user_id));

		$db->setQuery($query);
		$db->execute();

		$n = $db->getNumRows();
		$used_space = $db->loadObjectList();

		if ($n) {

			$data->used_space = intval($used_space[0]->used_space);

		} else {

			$data->used_space = 0;

		}

		$db = $this->getDatabase();
		$query_b = $db->getQuery(true);

		$query_b->select('SUM(a.size) as trash_used_space');
		$query_b->from($db->quoteName('#__cotton_file', 'a'));
		$query_b->where($db->quoteName('a.owner_id') . ' = ' . $db->quote($user_id));
		$query_b->where($db->quoteName('a.trash') . ' = 1');

		$db->setQuery($query_b);
		$db->execute();

		$n = $db->getNumRows();
		$trash_used_space = $db->loadObjectList();

		if ($n) {

			$data->trash_used_space = intval($trash_used_space[0]->trash_used_space);

		} else {

			$data->trash_used_space = 0;

		}

		$val = trim(ini_get('upload_max_filesize'));
		$last = strtolower($val[strlen($val)-1]);
		$result = '';

		for ($i = 0; $i < strlen($val); $i++) {

			$result .= $val[$i];

		}

		$result = intval($result);		
		
		switch ($last) {
			case 'g':
				$result *= 1024;
			case 'm':
				$result *= 1024;
			case 'k':
				$result *= 1024;
		}

		$data->max_filesize = $result;

		if ($data->max_filesize > $this->max_filesize_db) {

			$data->max_filesize = $this->max_filesize_db;

		}

	return $data;

	}

	/**
     * Method to send file data to be opened in CodeMirror editor.
     *
     * @param   int  $file_id  Id of the file to be opened.
     * @param   string  $file_ext  Extension of the file name to check file mime type.
     *
     * @return  object  File data to be opened in CodeMirror editor.
     *
     * @since   1.6
     */
    public function open_editor($file_id, $file_ext = '') {
        
        $app = Factory::getApplication();
        $app->getLanguage()->load('com_cotton', JPATH_SITE);

        $currentuser = Factory::getApplication()->getIdentity();
        $user_id = $currentuser->get("id");

        $db = $this->getDatabase();
        $query = $db->getQuery(true);
        
        $query->select('COUNT(*) as state');
        $query->from('#__extensions as a');
        $query->where('(a.name =' . $db->quote('plg_editors_codemirror') . ' AND a.enabled = 1)');
        
        $db->setQuery($query);
        $db->execute();

        $n = $db->getNumRows();
        $state = $db->loadObjectList();

        $data = new \stdClass();
        $data->file_id = $file_id;
        $data->file_ext = $file_ext;
        
        if ($state[0]->state < 1) {

            $data->success = false;
            $data->error = Text::_('COM_COTTON_ERROR_EDITOR_DISABLED');
            return $data;

        }

        $fileData = $this->file_select_open($file_id);
        
        if (!$fileData->n) {

            $data->success = false;
            $data->error = Text::_('COM_COTTON_ERROR_NOFILE');
            return $data;

        }

        $file = $fileData->file[0];
        $allowed = json_decode($file->allowed_users) ?: [];

        $folderPath = '';
        if (!empty($file->folder_id)) {
            $folderRepo = new \Tabaoca\Component\Cotton\Site\Model\Folder\FolderRepository();
            $folderPath = $folderRepo->getFolderPath((int) $file->folder_id, (int) $file->owner_id);
        }

        $accessGranted = ($file->owner_id == $user_id) || (in_array($user_id, $allowed));
        if (!$accessGranted) {
            switch (intval($file->open_link)) {
                case 0:
                    $data->success = false;
                    $data->error = Text::_('COM_COTTON_ERROR_NOACCESS');
                    return $data;
                case 1:
                    if (!$user_id) {
                        $data->success = false;
                        $data->error = Text::_('COM_COTTON_ERROR_NOACCESS');
                        return $data;
                    }
                    break;
                case 2:
                    break;
            }
        }

        $config = ComponentHelper::getParams('com_cotton');
        $textFileTypes = $config->get('text_file_types', 'txt,php,html,css,js,json,xml,md');
        $supportedExtensions = array_map('trim', explode(',', $textFileTypes));
        $fileExt = strtolower(pathinfo($file->name, PATHINFO_EXTENSION));
        if (!in_array($fileExt, $supportedExtensions)) {
            $data->success = false;
            $data->error = Text::sprintf('COM_COTTON_ERROR_FILE_TYPE_NOT_EDITABLE', $fileExt);
            return $data;
        }

        return $this->buildOpenEditorSuccess($data, $file, $file_ext, $folderPath);
    }

    private function buildOpenEditorSuccess($data, $file, $file_ext, $folderPath) {
        $data->content = $file->file_data;
        $data->file_data = $file->file_data;
        $data->name = $file->name;
        $data->folder_id = $file->folder_id ?? 0;
        $data->folder_path = $folderPath;
        $data->open_link = $file->open_link ?? 0;
        $data->size = strlen($file->file_data ?? '');
        $data->created = $file->date_created ?? '';
        $data->modified = $file->date_updated ?? '';
        $data->file_ext = $file_ext ?: pathinfo($file->name, PATHINFO_EXTENSION);
        $data->success = true;
        $data->error = '';
        return $data;
    }

	/**
	* Method to move a folder to a new parent folder.
	* 
	* @param   int  $folder_id  Id of folder to be moved.
	* @param   int  $new_parent_id  Id of new parent folder.
	* 
	* @return  object  Status.
	* @since   2.1.0
	*/
	public function folder_move ($folder_id, $new_parent_id) {
		$app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = (int) $currentuser->get("id");
		$folder_id = (int) $folder_id;
		$new_parent_id = (int) $new_parent_id;

		$data = new \stdClass();

		// Prevent moving a folder into itself or its own children
		if ($folder_id === $new_parent_id) {
			$data->success = false;
			$data->error = Text::_('COM_COTTON_ERROR_MOVE_SELF');
			return $data;
		}

		// Check ownership
		$folder = $this->getFolderManager()->load($folder_id);
		if (!$folder || (int) $folder->owner_id !== $user_id) {
			$data->success = false;
			$data->error = Text::_('COM_COTTON_ERROR_NOACCESS');
			return $data;
		}

		// Check that new parent is not a descendant of the folder being moved
		if ($new_parent_id > 0) {
			$parentCheck = $new_parent_id;
			$maxDepth = 100;
			$depth = 0;
			while ($parentCheck > 0 && $depth < $maxDepth) {
				if ($parentCheck === $folder_id) {
					$data->success = false;
					$data->error = Text::_('COM_COTTON_ERROR_MOVE_CIRCULAR');
					return $data;
				}
				$parentFolder = $this->getFolderManager()->load($parentCheck);
				$parentCheck = $parentFolder ? (int) $parentFolder->parent_id : 0;
				$depth++;
			}
		}

		$db = $this->getDatabase();
		$item = new \stdClass();
		$item->id = $folder_id;
		$item->parent_id = $new_parent_id;
		$item->date_updated = date('Y-m-d H:i:s');
		$db->updateObject('#__cotton_folder', $item, 'id');

		$data->success = true;
		$data->error = '';
		$data->folder_id = $folder_id;
		$data->new_parent_id = $new_parent_id;

		return $data;

	}

	/**
	* Method to move a file to a different folder.
	* 
	* @param   int  $file_id  Id of file to be moved.
	* @param   int  $folder_id  Id of destination folder.
	* 
	* @return  object  Status.
	* @since   2.1.0
	*/
	public function file_move ($file_id, $folder_id) {

		$app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = (int) $currentuser->get("id");
		$file_id = (int) $file_id;
		$folder_id = (int) $folder_id;

		$data = new \stdClass();

		// Check ownership
		$file = $this->file_select($file_id);
		if (!$file->n || (int) $file->file[0]->owner_id !== $user_id) {
			$data->success = false;
			$data->error = Text::_('COM_COTTON_ERROR_NOACCESS');
			return $data;
		}

		$db = $this->getDatabase();
		$item = new \stdClass();
		$item->id = $file_id;
		$item->folder_id = $folder_id;
		$item->date_updated = date('Y-m-d H:i:s');
		$db->updateObject('#__cotton_file', $item, 'id');

		$data->success = true;
		$data->error = '';
		$data->file_id = $file_id;
		$data->folder_id = $folder_id;

		return $data;

	}

	/**
	* Method to load the full path of a folder (breadcrumb).
	*
	* @param   int  $folder_id  Folder id to load path.
	* 
	* @return  string  Full path of the folder.
	* @since   2.0.0
	*/
	public function folder_load_path ($folder_id) {

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = (int) $currentuser->get("id");

		return $this->getFolderManager()->getRepo()->getFolderPath((int) $folder_id, $user_id);

	}

	/**
	* Method to load all folders for tree view.
	*
	* @return  object  List of all user folders.
	* @since   2.0.0
	*/
	public function folder_load_list () {

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = (int) $currentuser->get("id");

		$allFolders = $this->getFolderManager()->getRepo()->getUserFolders($user_id);

		$data = new \stdClass();
		$data->n = count($allFolders);
		$data->list = $allFolders;

		return $data;

	}

	/**
	* Method to convert a string of files formats extensions in an array to be checked.
	* 
	* @return  object  Active feed.
	* @since   2.0.0
	*/
	private function array_formats ($list) {

		$formats = explode(',', $list);

		for ($i = 0; $i < count($formats); $i++) {

			$formats[$i] = trim($formats[$i]);
			$formats[$i] = strtolower($formats[$i]);

		}

		return $formats;

	}
	
	/**
	* Method to get Joomla database driver.
	* 
	* @return  object  DatabaseDriver.
	* @since   2.0.0
	*/
	private function getDatabase () {

		return Factory::getContainer()->get('DatabaseDriver');

	}

	/**
	* Method to load all files information from a folder content.
	*
	* @param   int  $folder_id Folder id to load files.
	* 
	* @return  object  List of files information.
	* @since   2.0.0
	*/
	public function articles_list () {

		$currentuser = Factory::getApplication()->getIdentity();
		$user_id = $currentuser->get("id");

		$db = $this->getDatabase();
		$query = $db->getQuery(true);

		$query->select('a.id as id, a.title as title, a.created_by as created_by, a.created_by_alias as created_by_alias, a.created as created, a.state as state, a.catid as catid, a.alias as alias, a.language as language');
		$query->from($db->quoteName('#__content', 'a'));
		$query->where($db->quoteName('a.created_by') . ' = ' . $db->quote((int) $user_id));
		$query->order($db->quoteName('a.id'));

		$db->setQuery($query);
		$db->execute();

		$data = new \stdClass();
		$data->n = $db->getNumRows();
		$data->articles = $db->loadObjectList();

		return $data;

	}


}