<?php
/**
 * @package Tabaoca.Component.Cotton.Administrator
 * @subpackage com_cotton
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Administrator\Controller;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\Controller\BaseController;
use Joomla\CMS\Factory;
use Joomla\CMS\Session\Session;
use Joomla\CMS\Response\JsonResponse;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Uri\Uri;
use Joomla\CMS\Component\ComponentHelper;

/**
 * Controller of Cotton Cloud System administrator component
 *
 * @package     Tabaoca.Component.Cotton.Administrator
 * @subpackage  com_cotton
 * @since       2.0.0
 */
class CottonController extends BaseController {

	/**
	* Method to start the loop to refresh data in Dashboard View.
	* 
	* @return  object  Response JSON encoded object to XHR call.
	* @since   2.0.0
	*/
	public function run () {

		try {

			if (!Session::checkToken()) {

				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);

			} else {

				$input = Factory::getApplication()->input;

				$n_folders = $input->get('n_folders', 0, 'INT');
				$n_files = $input->get('n_files', 0, 'INT');
				$n_size = $input->get('n_size', 0, 'INT');

				$model = $this->getModel();

				$record = $model->run($n_folders, $n_files, $n_size);

				echo new JsonResponse($record);

			}

		} catch (\Exception $e) {

			echo new JsonResponse($e);

		}

	}

	/**
	 * Administrative cache clear endpoint.
	 * POST /index.php?option=com_cotton&task=cotton.clear_cache
	 */
	public function clear_cache()
	{
		try {
			if (!Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = Factory::getApplication()->input;
			$key = $input->getString('key', '');

			// Use Joomla cache if available
			try {
				$cache = Factory::getCache('com_cotton');
				if ($key !== '' && method_exists($cache, 'remove')) {
					$cache->remove($key);
					echo new JsonResponse(['success' => true, 'cleared' => [$key]]);
					return;
				}
				if (method_exists($cache, 'clean')) {
					$cache->clean();
					echo new JsonResponse(['success' => true, 'cleared' => 'all']);
					return;
				}
			} catch (\Throwable $e) {
				// ignore and fallback to coarse clean
			}

			// Fallback: attempt to clear component cache directory if exists
			$cacheDir = JPATH_ROOT . '/cache';
			$cleared = false;
			if (is_dir($cacheDir) && is_writable($cacheDir)) {
				$files = glob($cacheDir . '/com_cotton*');
				foreach ($files as $f) {
					@unlink($f);
					$cleared = true;
				}
			}

			echo new JsonResponse(['success' => true, 'cleared' => $cleared ? 'files' : 'none']);

		} catch (\Exception $e) {
			echo new JsonResponse($e);
		}

	}

	/**
	 * Generic proxy/router to delegate Site Controller methods
	 * Allows calling any Site Controller method from Admin
	 * 
	 * Usage: ?task=cotton.proxy&action=items_load&folder_id=1
	 * 
	 * @return void
	 * @since 2.0.0
	 */
	public function proxy() {
		try {
			$app = Factory::getApplication();
			$input = $app->input;
			$action = $input->get('action', '', 'CMD');
			
			if (!$action) {
				echo new JsonResponse(null, Text::_('COM_COTTON_ERROR_NO_ACTION'), true);
				return;
			}

			// Get the MVC factory to properly instantiate the site controller
			$factory = $app->bootComponent('com_cotton')->getMVCFactory('site');
			
			// Create an instance of the site controller with all required parameters
			$siteController = $factory->createController('Cotton', '', [], $app, $input);
			
			// Check if method exists
			if (!method_exists($siteController, $action)) {
				echo new JsonResponse(null, 'Method not found: ' . $action, true);
				return;
			}

			// Call the method dynamically
			$siteController->$action();

		} catch (\Exception $e) {
			echo new JsonResponse($e);
		}
	}

	/**
	 * Shortcut: Get folder content
	 * @return void
	 * @since 2.0.0
	 */
	public function items_load() {
		$this->callSiteMethod('items_load');
	}

	/**
	 * Shortcut: Get tree content
	 * @return void
	 * @since 2.0.0
	 */
	public function tree_load() {
		$this->callSiteMethod('tree_load');
	}

	/**
	 * Shortcut: Create a new folder
	 * @return void
	 * @since 2.0.0
	 */
	public function folder_create() {
		$this->callSiteMethod('folder_create');
	}

	/**
	 * Shortcut: Update folder data
	 * @return void
	 * @since 2.0.0
	 */
	public function folder_update() {
		$this->callSiteMethod('folder_update');
	}

	/**
	 * Shortcut: Delete a folder
	 * @return void
	 * @since 2.0.0
	 */
	public function folder_delete() {
		$this->callSiteMethod('folder_delete');
	}

	/**
	 * Shortcut: Move a folder to new parent
	 * @return void
	 * @since 2.0.0
	 */
	public function folder_move() {
		$this->callSiteMethod('folder_move');
	}

	/**
	 * Shortcut: Upload a file
	 * @return void
	 * @since 2.0.0
	 */
	public function file_upload() {
		$this->callSiteMethod('file_upload');
	}
	/**
	 * Shortcut: Upload a file
	 * @return void
	 * @since 2.0.0
	 */
	public function file_finalize() {
		$this->callSiteMethod('file_finalize');
	}

	/**
	 * Shortcut: Create a new text file
	 * @return void
	 * @since 2.0.0
	 */
	public function file_create() {
		$this->callSiteMethod('file_create');
	}

	/**
	 * Shortcut: Save a text file
	 * @return void
	 * @since 2.0.0
	 */
	public function file_save() {
		$this->callSiteMethod('file_save');
	}

	/**
	 * Shortcut: Update file metadata
	 * @return void
	 * @since 2.0.0
	 */
    public function file_update() {
    	$this->callSiteMethod('file_update');
    }

    /**
     * Shortcut: Cancel a file upload and cleanup temp file
     * @return void
     * @since 2.0.0
     */
    public function file_cancel() {
    	$this->callSiteMethod('file_cancel');
    }

    /**
     * Shortcut: Delete a file
     * @return void
     * @since 2.0.0
     */
    public function file_delete() {
    	$this->callSiteMethod('file_delete');
    }

	/**
	 * Shortcut: Move a file to different folder
	 * @return void
	 * @since 2.0.0
	 */
	public function file_move() {
		$this->callSiteMethod('file_move');
	}

	/**
	 * Shortcut: Download a file
	 * @return void
	 * @since 2.0.0
	 */
	public function download() {
		$this->callSiteMethod('download');
	}

	/**
	 * Shortcut: Open a file for viewing/editing
	 * @return void
	 * @since 2.0.0
	 */
	public function open() {
		$this->callSiteMethod('open');
	}

	/**
	 * Shortcut: Open file in editor
	 * @return void
	 * @since 2.0.0
	 */
	public function open_editor() {
		$this->callSiteMethod('open_editor');
	}

	/**
	 * Shortcut: Get file preview
	 * @return void
	 * @since 2.0.0
	 */
	public function file_preview() {
		$this->callSiteMethod('file_preview');
	}

	/**
	 * Shortcut: Load trash items
	 * @return void
	 * @since 2.0.0
	 */
	public function trash_load() {
		$this->callSiteMethod('trash_load');
	}

	/**
	 * Shortcut: Load all trash
	 * @return void
	 * @since 2.0.0
	 */
	public function load_trash() {
		$this->callSiteMethod('load_trash');
	}

	/**
	 * Shortcut: Clear all trash
	 * @return void
	 * @since 2.0.0
	 */
	public function clear_trash() {
		$this->callSiteMethod('clear_trash');
	}

	/**
	 * Shortcut: Recover item from trash
	 * @return void
	 * @since 2.0.0
	 */
	public function item_recover() {
		$this->callSiteMethod('item_recover');
	}

	/**
	 * Shortcut: Delete item
	 * @return void
	 * @since 2.0.0
	 */
	public function item_delete() {
		$this->callSiteMethod('item_delete');
	}

	/**
	 * Shortcut: Create new file
	 * @return void
	 * @since 2.0.0
	 */
	public function create_new() {
		$this->callSiteMethod('create_new');
	}

	/**
	 * Shortcut: List all articles
	 * @return void
	 * @since 2.0.0
	 */
	public function articles_list() {
		$this->callSiteMethod('articles_list');
	}

	/**
	 * Helper method to call Site Controller methods
	 * 
	 * @param string $method Method name to call
	 * @return void
	 * @since 2.0.0
	 */
	protected function callSiteMethod($method) {
		try {
			$app = Factory::getApplication();
			$input = $app->input;
			
			// Get the MVC factory to properly instantiate the site controller
			$factory = $app->bootComponent('com_cotton')->getMVCFactory('site');
			
			// Create an instance of the site controller with all required parameters
			$siteController = $factory->createController('Cotton', 'Site', [], $app, $input);

			if (!$siteController || !is_object($siteController)) {
            echo new JsonResponse(null, 'Erro: O controller do com_cotton não pôde ser instanciado pelo Joomla. Verifique se o arquivo e a classe existem.', true);
            return;
        	}
			
			if (method_exists($siteController, $method)) {
				$siteController->$method();
			} else {
				echo new JsonResponse(null, 'Method not found: ' . $method, true);
			}
		} catch (\Exception $e) {
			echo new JsonResponse($e);
		}
	}

}