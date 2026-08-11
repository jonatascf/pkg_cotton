<?php
/**
 * @package Tabaoca.Component.Weaver.Site
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Weaver\Site\View\Weaver;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\View\HtmlView as BaseHtmlView;
use Joomla\CMS\Factory;
use Joomla\CMS\Uri\Uri;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Component\ComponentHelper;

class HtmlView extends BaseHtmlView {

    /**
     * Display the Weaver site view.
     *
     * @param   string  $tpl  The name of the template file to parse.
     *
     * @return  void
     */
    public function display($tpl = null) {

        $this->setDocument(null);
        parent::display($tpl);

    }

    /**
     * Setup the Weaver site view.
     *
     * @return  void
     */
    public function setDocument($doc): void {

        $currentuser = Factory::getApplication()->getIdentity();
        $app = Factory::getApplication();
        $document = $app->getDocument();

        if (!$currentuser->get('id')) {

            $app->enqueueMessage(Text::_('JERROR_ALERTNOAUTHOR'), 'error');
            $app->setHeader('status', 403, true);

            return;
        }

        $document->setTitle(Text::_('COM_WEAVER'));

        $wa = $document->getWebAssetManager();
        $wa->useStyle('com_weaver.weaver');
        $wa->useScript('com_weaver.weaver_app');
        $wa->useScript('com_weaver.mcp_client');
        $wa->useScript('com_weaver.kilo_assistant');
        $wa->useScript('com_weaver.mcp_panel');
        
        
        $wa->getRegistry()->addExtensionRegistryFile('plg_editors_codemirror');
        $wa->useScript('webcomponent.editor-codemirror');
        $wa->useStyle('plg_editors_codemirror');

        $wa->getRegistry()->addExtensionRegistryFile('com_cotton');
        $wa->useScript('com_cotton.cotton_uimanager');
        $wa->useStyle('com_cotton.cotton');

        $params_cotton = ComponentHelper::getParams('com_cotton');
        $params_weaver = ComponentHelper::getParams('com_weaver');

        $formats = explode(',', $params_weaver->get('weaver_text_formats', 'txt,md,ini,htm,html,xhtml,xml,js,mjs,php,svg,css,sass,scss,less,csv,ics,json,jsonld,xul'));

		for ($i = 0; $i < count($formats); $i++) {

			$formats[$i] = trim($formats[$i]);
			$formats[$i] = strtolower($formats[$i]);

		}

        $th = $params_cotton->get('cotton_theme', 0);
        $ux = $params_cotton->get('cotton_ux', 0);

		if ($th == '0') {
			$wa->useStyle('com_cotton.cotton_'.'light');
		} else {
			$wa->useStyle('com_cotton.cotton_'.'dark');
		}

        $input = $app->input;

        $config = [
            'siteUrl' => Uri::base(),
            'admin' => $app->isClient('administrator'),
            'token' => $app->getFormToken(),
            'file_id' => $input->getInt('file_id', 0),
            'text_formats' => $formats,
            'userName' => $currentuser->get('username'),
            'ux' => $ux == '0' ? false : true,
        ];

        $document->addScriptOptions('cotton_config', $config);

        $com = $app->bootComponent('com_cotton');
		$mvc = $com->getMVCFactory();
		$model = $mvc->createModel('Cotton', 'Site');

		$document->addScriptOptions('cotton_tree', $model->tree_load(0, true));

        // Load the com_cotton language file
		$lang = Factory::getLanguage();
		$lang->load('com_cotton');

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

        Text::script('COM_WEAVER_APP_TITLE');
        Text::script('COM_WEAVER_WELCOME_TITLE');
        Text::script('COM_WEAVER_WELCOME_SUBTITLE_1');
        Text::script('COM_WEAVER_WELCOME_SUBTITLE_2');
        Text::script('COM_WEAVER_STATUS_STATS');
        Text::script('COM_WEAVER_TOOLTIP_TOGGLE_TREE');
        Text::script('COM_WEAVER_STATUS_FILE_ALREADY_OPEN');
        Text::script('COM_WEAVER_STATUS_FILE_LOADED');
        Text::script('COM_WEAVER_STATUS_OPENING_FOLDER');
        Text::script('COM_WEAVER_STATUS_FOLDER_LOADED');
        Text::script('COM_WEAVER_FOLDER_ROOT');
        Text::script('COM_WEAVER_MODAL_TITLE_NEW_FILE');
        Text::script('COM_WEAVER_MODAL_TITLE_SAVE_AS');
        Text::script('COM_WEAVER_MODAL_TITLE_OPEN_FOLDER');
        Text::script('COM_WEAVER_MODAL_TITLE_OPEN_FILE');
        Text::script('COM_WEAVER_MODAL_TITLE_SAVE_CLOSE');
        Text::script('COM_WEAVER_LABEL_FILE_NAME');
        Text::script('COM_WEAVER_LABEL_DESCRIPTION');
        Text::script('COM_WEAVER_LABEL_OPTIONAL');
        Text::script('COM_WEAVER_BUTTON_CREATE');
        Text::script('COM_WEAVER_BUTTON_SAVE');
        Text::script('COM_WEAVER_BUTTON_DONT_SAVE');
        Text::script('COM_WEAVER_BUTTON_CANCEL');
        Text::script('COM_WEAVER_BUTTON_OPEN');
        Text::script('COM_WEAVER_BUTTON_SELECT');
        Text::script('COM_WEAVER_PROMPT_SAVE_CHANGES_PREFIX');
        Text::script('COM_WEAVER_ERROR_SELECT_FILE_FIRST');
        Text::script('COM_WEAVER_ERROR_SELECT_VALID_FOLDER_CREATE');
        Text::script('COM_WEAVER_ERROR_SELECT_VALID_FOLDER_SAVE');
        Text::script('COM_WEAVER_ERROR_SELECT_VALID_FOLDER_OPEN');
        Text::script('COM_WEAVER_ERROR_FILENAME_REQUIRED');
        Text::script('COM_WEAVER_ERROR_FILE_REQUIRES_EXTENSION');
        Text::script('COM_WEAVER_ERROR_EXTENSION_NOT_ALLOWED');
        Text::script('COM_WEAVER_ERROR_CREATE_FOLDER_FAILED');
        Text::script('COM_WEAVER_ERROR_NO_ACTIVE_TAB_SAVE');
        Text::script('COM_WEAVER_ERROR_MCP_CONNECT');
        Text::script('COM_WEAVER_ERROR_MCP_CONNECT_PREFIX');
        Text::script('COM_WEAVER_ERROR_STREAM_FAILED');
        Text::script('COM_WEAVER_ERROR_COTTON_API');
        Text::script('COM_WEAVER_ERROR_COTTON_MODAL');
        Text::script('COM_WEAVER_ERROR_COTTON_UI_MANAGER');
        Text::script('COM_WEAVER_ERROR_CREATE_FAILED');
        Text::script('COM_WEAVER_ERROR_SAVE_FAILED');
        Text::script('COM_WEAVER_FILENAME_DEFAULT');
        Text::script('COM_WEAVER_FILE_NEW');
        Text::script('COM_WEAVER_FILE_OPEN');
        Text::script('COM_WEAVER_FILE_SAVE');
        Text::script('COM_WEAVER_FILE_SAVE_AS');
        Text::script('COM_WEAVER_OPEN_FOLDER');
        Text::script('COM_WEAVER_POWERED');
        Text::script('COM_WEAVER_STATUS_COPY_SAVED');
        Text::script('COM_WEAVER_STATUS_CREATED');
        Text::script('COM_WEAVER_STATUS_CREATING');
        Text::script('COM_WEAVER_STATUS_LOADING');
        Text::script('COM_WEAVER_STATUS_OPENING');
        Text::script('COM_WEAVER_STATUS_SAVED');
        Text::script('COM_WEAVER_STATUS_SAVING');
        Text::script('COM_WEAVER_STATUS_SAVING_COPY');
        Text::script('COM_WEAVER_ERROR_FILE_TYPE_NOT_ALLOWED');
        Text::script('COM_WEAVER_BUTTON_OK');

        Text::script('COM_WEAVER_MCP_ASSISTANT_TITLE');
        Text::script('COM_WEAVER_MCP_SETTINGS');
        Text::script('COM_WEAVER_MCP_SETTINGS_HEADER');
        Text::script('COM_WEAVER_MCP_LABEL_MODEL');
        Text::script('COM_WEAVER_MCP_LABEL_MODE');
        Text::script('COM_WEAVER_MCP_MODELS_LOADING');
        Text::script('COM_WEAVER_MCP_MODE_CODE');
        Text::script('COM_WEAVER_MCP_MODE_ASK');
        Text::script('COM_WEAVER_MCP_MODE_DEBUG');
        Text::script('COM_WEAVER_MCP_MODE_PLAN');
        Text::script('COM_WEAVER_MCP_SAVE_SETTINGS');
        Text::script('COM_WEAVER_MCP_WELCOME');
        Text::script('COM_WEAVER_MCP_WELCOME_DESC');
        Text::script('COM_WEAVER_MCP_INPUT_PLACEHOLDER');
        Text::script('COM_WEAVER_MCP_USER_LABEL');
        Text::script('COM_WEAVER_MCP_ASSISTANT_LABEL');
        Text::script('COM_WEAVER_MCP_REASONING_LABEL');
        Text::script('COM_WEAVER_MCP_CONNECTING');
        Text::script('COM_WEAVER_MCP_CONNECTED');
        Text::script('COM_WEAVER_MCP_CONNECTION_ERROR');
        Text::script('COM_WEAVER_MCP_PROCESSING');
        Text::script('COM_WEAVER_MCP_STREAM_CANCELLED');
        Text::script('COM_WEAVER_MCP_STATUS_BAR');
        Text::script('COM_WEAVER_MCP_SESSION_ACTIVE');
        Text::script('COM_WEAVER_MCP_SESSION_INACTIVE');
        Text::script('COM_WEAVER_MCP_RESET_SESSION');
        Text::script('COM_WEAVER_MCP_REFRESH_FAILED');
        Text::script('COM_WEAVER_MCP_SELECT_VALID_MODEL');
        Text::script('COM_WEAVER_MCP_SETTINGS_SAVED');
        Text::script('COM_WEAVER_MCP_MODEL_FALLBACK');
        Text::script('COM_WEAVER_MCP_MODEL_NO_NAME');
        Text::script('COM_WEAVER_MCP_MODEL_FREE_SUFFIX');
        Text::script('COM_WEAVER_ERROR_MCP_CLIENT_NOT_LOADED');
        Text::script('COM_WEAVER_ERROR_ASSISTANT_NOT_LOADED');
        Text::script('COM_WEAVER_ERROR_ASSISTANT_UNAVAILABLE');
        Text::script('COM_WEAVER_ERROR_PREFIX');
        Text::script('COM_WEAVER_ERROR');
        Text::script('COM_WEAVER_ERROR_MCP_INIT');
        Text::script('COM_WEAVER_ERROR_FETCH_FAILED');
        Text::script('COM_WEAVER_ERROR_STREAM_READER');
        Text::script('COM_WEAVER_ERROR_STREAM_INTERRUPTED');
        Text::script('COM_WEAVER_ERROR_NETWORK_CONSOLE');
        Text::script('COM_WEAVER_ERROR_UNKNOWN_RESOURCE');
        Text::script('COM_WEAVER_CMD_NO_OPEN_TABS');
        Text::script('COM_WEAVER_CMD_NO_ACTIVE_TAB');
        Text::script('COM_WEAVER_CMD_OPENED_TAB');
        Text::script('COM_WEAVER_CMD_SAVE_SUCCESS');
        Text::script('COM_WEAVER_CMD_ROOT_FOLDER');
        Text::script('COM_WEAVER_CMD_TABS_OPENED');
        Text::script('COM_WEAVER_CMD_ACTIVE_TAB');
        Text::script('COM_WEAVER_CMD_FILE_CREATED');
        Text::script('COM_WEAVER_CMD_FOLDER_CREATED');
        Text::script('COM_WEAVER_CMD_USAGE_OPEN');
        Text::script('COM_WEAVER_CMD_USAGE_CREATE_FILE');
        Text::script('COM_WEAVER_CMD_USAGE_CREATE_FOLDER');

    }

}
