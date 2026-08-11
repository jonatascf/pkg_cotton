<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Site\Controller;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\Controller\BaseController;
use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Session\Session;
use Joomla\CMS\Response\JsonResponse;
use Tabaoca\LibCotton\FileHandler;
use Exception;

/**
 * Controller of Cotton Cloud System component - REFACTORED v2.0
 * 
 * Delegates business logic to CottonModel, uses clean HTTP patterns
 * for consistent error handling and response formatting.
 *
 * @package     Tabaoca.Component.Cotton.Site
 * @subpackage  com_cotton
 * @since       2.0.0
 */
class CottonController extends BaseController {

	/**
	 * Create a new folder.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function folder_create() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$parent_id = $input->get('parent_id', 0, 'INT');
			$folder_name = $input->get('folder_name', '', 'STRING');
			$folder_description = $input->get('folder_description', '', 'STRING');

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->folder_create($parent_id, $folder_name, $folder_description);
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Load folder content information.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function items_load() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$folder_id = $input->get('folder_id', 0, 'INT');

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->items_load($folder_id);
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

/**
 	 * Load trash items (files and folders with trash = 1).
 	 * 
 	 * @return void
 	 * @since 2.0.0
 	 */
 	public function trash_load() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}
			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->trash_load();
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Update folder data.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function folder_update() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$folder_id = $input->get('folder_id', 0, 'INT');
			$folder_name = $input->get('folder_name', '', 'STRING');
			$folder_description = $input->get('folder_description', '', 'STRING');
			$open_link = $input->get('open_link', 0, 'INT');
			$allowed_users = $input->get('allowed_users', '', 'STRING');

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->folder_update($folder_id, $folder_name, $folder_description, $open_link, $allowed_users);
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Load folder tree data.
	 * 
	 * @return void
	 * @since 2.1.0
	 */
	public function tree_load() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}
			$input = Factory::getApplication()->input;
			$folder_id = $input->get('folder_id', 0, 'INT');
			$with_files = $input->get('with_files', 0, 'INT');

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->tree_load($folder_id, (bool) $with_files);
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Delete a folder or a file.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function item_delete() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$item_id = $input->get('item_id', 0, 'INT');
			$item_type = $input->get('item_type', '', 'STRING');
			$trash = $input->get('trash', 0, 'INT');

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->item_delete($item_id, $item_type, $trash);
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Clear all items in the Trash.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function clear_trash() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->clear_trash();
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Recover an item from Trash to another folder.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function item_recover() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$item_id = $input->get('item_id', 0, 'INT');
			$item_type = $input->get('item_type', '', 'STRING');
			$item_name = $input->get('item_name', '', 'STRING');
			$folder_id = $input->get('folder_id', 0, 'INT');

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->item_recover($item_id, $item_type, $item_name, $folder_id);
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Create a new text file in the database.
	 * Este método é usado APENAS para criar arquivos de texto em branco.
	 * Para upload de arquivos, use file_upload.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function file_create() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$folder_id = $input->get('folder_id', 0, 'INT');
			$file_name = $input->get('file_name', 'novo_arquivo.txt', 'STRING');
			$content = $input->get('content', '', 'RAW');
			$file_description = $input->get('file_description', '', 'STRING');

			$handler = new FileHandler();
			$record = $handler->createNew($folder_id, $file_name, $content, $file_description);
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Upload a file to database.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function file_upload() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$folder_id = $input->get('folder_id', 0, 'INT');
			$file = $input->files->get('file', null, 'RAW');
			$index = $input->get('index', 0, 'INT');
			$chunk_index = $input->get('chunk_index', 0, 'INT');
			$total_chunks = $input->get('total_chunks', 0, 'INT');
			$file_id = $input->get('file_id', 0, 'INT');

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->file_upload($folder_id, $file, '', $index, $chunk_index, $total_chunks, $file_id, 'upload');
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

    public function file_finalize() {
    	try {
    		$currentuser = Factory::getApplication()->getIdentity();
    		
    		if (!$currentuser->get("id") || !Session::checkToken()) {
    			echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
    			return;
    		}

    		$input = Factory::getApplication()->input;
    		$file_id = $input->get('file_id', 0, 'INT');

    		$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
    		$record = $model->file_finalize($file_id);
    		echo new JsonResponse($record);
    	} catch (Exception $e) {
    		echo new JsonResponse($e);
    	}
    }

    public function file_cancel() {
    	try {
    		$currentuser = Factory::getApplication()->getIdentity();
    		
    		if (!$currentuser->get("id") || !Session::checkToken()) {
    			echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
    			return;
    		}

    		$input = Factory::getApplication()->input;
    		$file_id = $input->get('file_id', 0, 'INT');

    		$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
    		$record = $model->file_cancel($file_id);
    		echo new JsonResponse($record);
    	} catch (Exception $e) {
    		echo new JsonResponse($e);
    	}
    }

	/**
	 * Download a file from database like attachment.
	 * This method outputs raw binary data directly without Joomla's JSON wrapper.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function download() {
		try {

			$input = Factory::getApplication()->input;
			$file_id = $input->get('file_id', 0, 'INT');

			if (!$file_id) {
				throw new \Exception('Invalid file ID');
			}

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$model->file_open($file_id, 'download');
			
			Factory::getApplication()->close();
		} catch (Exception $e) {
			header('Content-Type: text/html; charset=utf-8');
			echo '<div class="alert alert-danger">Error: ' . htmlspecialchars($e->getMessage()) . '</div>';
			Factory::getApplication()->close();
		}
	}

	/**
	 * Get data from a file. Token not required for public access.
	 * This method outputs raw binary data directly without Joomla's JSON wrapper.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function open() {
		try {
			$input = Factory::getApplication()->input;
			$file_id = $input->get('file_id', 0, 'INT');

			if (!$file_id) {
				throw new \Exception('Invalid file ID');
			}

			// Get the model and call file_open which outputs binary directly
			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$model->file_open($file_id, 'open');
			
			// Exit immediately to prevent Joomla from processing the response
			Factory::getApplication()->close();
		} catch (Exception $e) {
			// For errors, output HTML since it's not binary data
			header('Content-Type: text/html; charset=utf-8');
			echo '<div class="alert alert-danger">Error: ' . htmlspecialchars($e->getMessage()) . '</div>';
			Factory::getApplication()->close();
		}
	}

	/**
	 * Save a text file data.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function file_save() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$file_id = $input->get('file_id', 0, 'INT');
			$content = $input->get('content', '', 'RAW');

			$handler = new FileHandler();
			$result = $handler->saveFile($file_id, $content);
			echo new JsonResponse($result);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Update data information of a file.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function file_update() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$file_id = $input->get('file_id', 0, 'INT');
			$file_name = $input->get('file_name', '', 'STRING');
			$file_description = $input->get('file_description', '', 'STRING');
			$open_link = $input->get('open_link', 0, 'INT');
			$allowed_users = $input->get('allowed_users', '', 'STRING');

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->file_update($file_id, $file_name, $file_description, $open_link, $allowed_users);
			echo new JsonResponse($record);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Get data text from a file to open in CodeMirror Editor.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function open_editor() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$file_id = $input->get('file_id', 0, 'INT');
			$file_ext = $input->get('file_ext', '', 'STRING');

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$result = $model->open_editor($file_id, $file_ext);
			echo new JsonResponse($result);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Delete a folder (dedicated task for UI modal).
	 * Delegates to item_delete with item_type='folder'.
	 * 
	 * @return void
	 * @since 2.1.0
	 */
	public function folder_delete() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$folder_id = $input->get('folder_id', 0, 'INT');
			$trash = $input->get('trash', 1, 'INT');

			if (!$folder_id) {
				echo new JsonResponse(null, Text::_('COM_COTTON_ERROR'), true);
				return;
			}

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->item_delete($folder_id, 'folder', $trash);
			echo new JsonResponse($record);
		} catch (\Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Delete a file (dedicated task for UI modal).
	 * Delegates to item_delete with item_type='file'.
	 * 
	 * @return void
	 * @since 2.1.0
	 */
	public function file_delete() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			$user_id = (int) $currentuser->get("id");

			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$file_id = $input->get('file_id', 0, 'INT');
			$trash = $input->get('trash', 1, 'INT');

			if (!$file_id) {
				echo new JsonResponse(null, Text::_('COM_COTTON_ERROR'), true);
				return;
			}

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->item_delete($file_id, 'file', $trash);
			echo new JsonResponse($record);
		} catch (\Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Create a new file.
	 * 
	 * @return void
	 * @since 2.1.0
	 */
	public function create_new() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$folder_id = $input->get('folder_id', 0, 'INT');
			$name = $input->get('name', '', 'STRING');
			$content = $input->get('content', '', 'RAW');
			$description = $input->get('description', '', 'STRING');

			$handler = new FileHandler();
			$result = $handler->createNew($folder_id, $name, $content, $description);
			echo new JsonResponse($result);
		} catch (Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Move a folder to a new parent folder.
	 * 
	 * @return void
	 * @since 2.1.0
	 */
	public function folder_move() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$folder_id = $input->get('folder_id', 0, 'INT');
			$new_parent_id = $input->get('new_parent_id', 0, 'INT');

			if (!$folder_id) {
				echo new JsonResponse(null, Text::_('COM_COTTON_ERROR'), true);
				return;
			}

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->folder_move($folder_id, $new_parent_id);
			echo new JsonResponse($record);
		} catch (\Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Move a file to a different folder.
	 * 
	 * @return void
	 * @since 2.1.0
	 */
	public function file_move() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$file_id = $input->get('file_id', 0, 'INT');
			$folder_id = $input->get('folder_id', 0, 'INT');

			if (!$file_id) {
				echo new JsonResponse(null, Text::_('COM_COTTON_ERROR'), true);
				return;
			}

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->file_move($file_id, $folder_id);
			echo new JsonResponse($record);
		} catch (\Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * List all articles.
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function articles_list() {
		try {
			$currentuser = Factory::getApplication()->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$model = $this->getModel('Cotton','Site', ['ignore_request' => true]);
			$record = $model->articles_list();
			echo new JsonResponse($record);
		} catch (\Exception $e) {
			echo new JsonResponse($e);
		}
	}
}
