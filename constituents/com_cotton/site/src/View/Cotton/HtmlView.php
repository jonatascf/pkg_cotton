<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Site\View\Cotton;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\View\HtmlView as BaseHtmlView;
use Joomla\CMS\Factory;
use Joomla\CMS\Uri\Uri;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Component\ComponentHelper;

class HtmlView extends BaseHtmlView {
	
	/**
	 * Display the Cotton Cloud site view.
	 *
	 * @param   string  $tpl  The name of the template file to parse; automatically searches through the template paths.
	 *
	 * @return  void
	 */
	public function display($tpl = null) {

		$this->setDocument(null);

		//Display the site view
		parent::display($tpl);

	}
	
	/**
	 * Setup the Cotton Cloud site view.
	 *
	 * @param   string  $doc  The name of the template file to parse; automatically searches through the template paths.
	 *
	 * @return  string  Setup HTML inserts of Style Sheet, Script files and setup language variables in Javascript.
	 */
	public function setDocument($doc): void {

		$app = Factory::getApplication();
		$currentuser = $app->getIdentity();
		$document = $app->getDocument();

		if (!$currentuser->get("id")) {

			$app->enqueueMessage(Text::_('JERROR_ALERTNOAUTHOR'), 'error');
			$app->setHeader('status', 403, true);

			return;

		}
		
		$document->setTitle(Text::_('COM_COTTON'));

		$wa = $document->getWebAssetManager();

		$wa->useScript('com_cotton.cotton_init');
		$wa->useStyle('com_cotton.cotton');

		$params_cotton = ComponentHelper::getParams('com_cotton');

		$theme = $params_cotton->get('cotton_theme', 0);
		$ux = $params_cotton->get('cotton_ux', 0);

		if ($theme == '0') {
			$wa->useStyle('com_cotton.cotton_'.'light');
		} else {
			$wa->useStyle('com_cotton.cotton_'.'dark');
		}
		
		$config = [
			'siteUrl' => Uri::base(),
            'admin' => $app->isClient('administrator'),
            'token' => $app->getFormToken(),
			'userName' => $currentuser->get('username'),
			'ux' => $ux == '0' ? false : true,
        ];

		$document->addScriptOptions('cotton_config', $config);

		$com = $app->bootComponent('com_cotton');
		$mvc = $com->getMVCFactory();
		$model = $mvc->createModel('Cotton', 'Site');

		$document->addScriptOptions('cotton_tree', $model->tree_load());
		$document->addScriptOptions('cotton_items', $model->items_load());
		$document->addScriptOptions('cotton_limits', $model->limit_file_space());

		Text::script('COM_COTTON_FILE_MANAGER');
		Text::script('COM_COTTON_ARCHIVE');
		Text::script('COM_COTTON_VIEW_INFO');
		Text::script('COM_COTTON_TOGGLE_VIEW');
		Text::script('COM_COTTON_CREATE_FOLDER');
		Text::script('COM_COTTON_CREATE_FILE');
		Text::script('COM_COTTON_CREATE_STREAM');
		Text::script('COM_COTTON_UPLOAD_FILE');
		Text::script('COM_COTTON_UPLOAD_FILES');
		Text::script('COM_COTTON_CREATE');
		Text::script('COM_COTTON_UPDATE');
		Text::script('COM_COTTON_UPLOAD');
		Text::script('COM_COTTON_UPLOADING');
		Text::script('COM_COTTON_UPLOAD_NOFILE');
		Text::script('COM_COTTON_CREATEFOLDER_ERROR');
		Text::script('COM_COTTON_FOLDER_OPTIONS');
		Text::script('COM_COTTON_FOLDER_OPTIONS_ERROR');
		Text::script('COM_COTTON_FOLDER_NAME');
		Text::script('COM_COTTON_FOLDERNAME_EXISTS');
		Text::script('COM_COTTON_ITEMNAME_INVALID');
		Text::script('COM_COTTON_INVALID_CHARS');
		Text::script('COM_COTTON_FOLDERNAME_EMPTY');
		Text::script('COM_COTTON_CREATEFILE_ERROR');
		Text::script('COM_COTTON_FILE_OPTIONS');
		Text::script('COM_COTTON_FILE_NAME');
		Text::script('COM_COTTON_FILENAME_EXISTS');
		Text::script('COM_COTTON_FILENAME_EMPTY');
		Text::script('COM_COTTON_CANCEL');
		Text::script('COM_COTTON_CLOSE');
		Text::script('COM_COTTON_DONE');
		Text::script('COM_COTTON_CLEAR_TRASH');
		Text::script('COM_COTTON_OPTIONS');
		Text::script('COM_COTTON_DELETE');
		Text::script('COM_COTTON_DELETE_FOLDER');
		Text::script('COM_COTTON_DELETE_FILE');
		Text::script('COM_COTTON_DELETE_FOLDER_CONFIRM');
		Text::script('COM_COTTON_DELETE_FILE_CONFIRM');
		Text::script('COM_COTTON_CLEAR');
		Text::script('COM_COTTON_COPY_LINK');
		Text::script('COM_COTTON_DOWNLOAD');
		Text::script('COM_COTTON_TRASH');
		Text::script('COM_COTTON_TRASH_CLEAR');
		Text::script('COM_COTTON_TRASH_CLEAR_ALL');
		Text::script('COM_COTTON_RECOVER');
		Text::script('COM_COTTON_RECOVER_ITEM');
		Text::script('COM_COTTON_RECOVER_SELECT');
		Text::script('COM_COTTON_RECOVER_NOFOLDER');
		Text::script('COM_COTTON_SPECIFIC_USERS_INFO');
		Text::script('COM_COTTON_SPECIFIC_USERS');
		Text::script('COM_COTTON_REGISTERED_USERS');
		Text::script('COM_COTTON_ALL_USERS');
		Text::script('COM_COTTON_FOLDERS');
		Text::script('COM_COTTON_FILES');
		Text::script('COM_COTTON_OPEN_FOLDER');
		Text::script('COM_COTTON_OPEN_FILE');
		Text::script('COM_COTTON_NAME');
		Text::script('COM_COTTON_DESCRIPTION');
		Text::script('COM_COTTON_SHARED_LINK');
		Text::script('COM_COTTON_SIZE');
		Text::script('COM_COTTON_MODIFIED');
		Text::script('COM_COTTON_ITEMS');
		Text::script('COM_COTTON_NO_ITEM');
		Text::script('COM_COTTON_NO');
		Text::script('COM_COTTON_NO_APP');
		Text::script('COM_COTTON_SAVE');
		Text::script('COM_COTTON_OK');
		Text::script('COM_COTTON_ERROR');
		Text::script('COM_COTTON_ERROR_MAX_FILESIZE');
		Text::script('COM_COTTON_ERROR_LIMIT_SPACE');
		Text::script('COM_COTTON_TYPE');
		Text::script('COM_COTTON_CREATED');
		
		Text::script('COM_COTTON_TERMINAL');
		
		// Media viewer strings
		Text::script('COM_COTTON_MEDIA_PREVIEW');
		Text::script('COM_COTTON_MEDIA_IMAGE');
		Text::script('COM_COTTON_MEDIA_VIDEO');
		Text::script('COM_COTTON_MEDIA_AUDIO');
		Text::script('COM_COTTON_MEDIA_PDF');
		Text::script('COM_COTTON_MEDIA_UNSUPPORTED');
		Text::script('COM_COTTON_MEDIA_LOADING');
		Text::script('COM_COTTON_MEDIA_FULLSCREEN');
		Text::script('COM_COTTON_MOVE');
		Text::script('COM_COTTON_MOVE_TO');
		Text::script('COM_COTTON_RENAME');
		Text::script('COM_COTTON_ERROR_MOVE_SELF');
		Text::script('COM_COTTON_ERROR_MOVE_CIRCULAR');
		Text::script('COM_COTTON_ERROR_UPLOAD');
		Text::script('COM_COTTON_FILE_UPLOADED');
		Text::script('COM_COTTON_MORE_FILES');
		Text::script('COM_COTTON_UPLOAD_FAILED');
		
		Text::script('COM_COTTON_TIMEOUT');

		// JS-First Architecture strings
		Text::script('COM_COTTON_REFRESH');
		Text::script('COM_COTTON_LIST_VIEW');
		Text::script('COM_COTTON_GRID_VIEW');
		Text::script('COM_COTTON_TOGGLE_INFO_PANEL');
		Text::script('COM_COTTON_MAXIMIZE_TOOLTIP');
		Text::script('COM_COTTON_FINALIZING');
		Text::script('COM_COTTON_EMPTY');
		Text::script('COM_COTTON_ERROR_LOAD_FOLDER');
		Text::script('COM_COTTON_ERROR_LOAD_TRASH');
		Text::script('COM_COTTON_NO_ITEMS_SEARCH');
		Text::script('COM_COTTON_COLUMN_NAME');
		Text::script('COM_COTTON_COLUMN_SIZE');
		Text::script('COM_COTTON_COLUMN_MODIFIED');
		Text::script('COM_COTTON_DELETE_PERMANENTLY');
		Text::script('COM_COTTON_PROPERTIES');
		Text::script('COM_COTTON_EDIT');
		Text::script('COM_COTTON_ITEM_NOT_OPENABLE');
		Text::script('COM_COTTON_NO_APP_FOR_FILE');
		Text::script('COM_COTTON_LINK_COPIED');
		Text::script('COM_COTTON_ERROR_COPY_LINK');
		Text::script('COM_COTTON_CREATE_FOLDER_SUCCESS');
		Text::script('COM_COTTON_EDIT_FOLDER');
		Text::script('COM_COTTON_EDIT_FILE');
		Text::script('COM_COTTON_ACCESS_PERMISSIONS');
		Text::script('COM_COTTON_USER_OPTIONS');
		Text::script('COM_COTTON_OWNER_ONLY');
		Text::script('COM_COTTON_FOLDER_UPDATED');
		Text::script('COM_COTTON_PERMANENTLY_DELETE');
		Text::script('COM_COTTON_SEND_TO_TRASH');
		Text::script('COM_COTTON_FILE_CONFIGURATION');
		Text::script('COM_COTTON_FILE_UPDATED');
		Text::script('COM_COTTON_SELECT_DESTINATION_FOLDER');
		Text::script('COM_COTTON_RECOVER_FILE');
		Text::script('COM_COTTON_RECOVER_FOLDER');
		Text::script('COM_COTTON_FILE_RESTORED');
		Text::script('COM_COTTON_FOLDER_RESTORED');
		Text::script('COM_COTTON_FILE_DELETED');
		Text::script('COM_COTTON_FOLDER_DELETED');
		Text::script('COM_COTTON_FILE_DELETED_PERMANENT');
		Text::script('COM_COTTON_FOLDER_DELETED_PERMANENT');
		Text::script('COM_COTTON_CONFIRM_DELETE_FILE_PERMANENT');
		Text::script('COM_COTTON_CONFIRM_DELETE_FOLDER_PERMANENT');
		Text::script('COM_COTTON_CONFIRM_DELETE_FOLDER');
		Text::script('COM_COTTON_CONFIRM_DELETE_FILE');
		Text::script('COM_COTTON_RESTORE_FILE');
		Text::script('COM_COTTON_RESTORE_FOLDER');
		Text::script('COM_COTTON_PUBLIC');
		Text::script('COM_COTTON_REFRESH_SUCCESS');
		Text::script('COM_COTTON_UPLOAD_SUCCESS');
		Text::script('COM_COTTON_NO_ITEMS_FOLDER');
		Text::script('COM_COTTON_NO_ITEMS_TRASH');
		Text::script('COM_COTTON_EMPTY_FOLDER_UPLOAD');
		Text::script('COM_COTTON_EMPTY_FOLDER_CREATE');
		Text::script('COM_COTTON_SELECT_ITEM_INFO');
		Text::script('COM_COTTON_FOLDER');
		Text::script('COM_COTTON_FILE');
		Text::script('COM_COTTON_LOADING');
		Text::script('COM_COTTON_ERROR_INIT');
		Text::script('COM_COTTON_READY');
		Text::script('COM_COTTON_OPTIONAL');
		Text::script('COM_COTTON_SEARCH_PLACEHOLDER');
		Text::script('COM_COTTON_SELECT_FILES');
		Text::script('COM_COTTON_USED_SPACE');
		Text::script('COM_COTTON_LIMIT_SPACE');
		Text::script('COM_COTTON_AVAILABLE_SPACE');
		

	}

}
