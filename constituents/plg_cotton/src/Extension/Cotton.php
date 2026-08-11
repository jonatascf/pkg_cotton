<?php
/**
 * @package Tabaoca.Plugin.Cotton
 * @subpackage plg_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Plugin\EditorsXtd\Cotton\Extension;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Object\CMSObject;
use Joomla\CMS\Plugin\CMSPlugin;
use Joomla\CMS\Uri\Uri;
use Joomla\CMS\Component\ComponentHelper;

\defined('_JEXEC') or die;

/**
 * Editor Cotton Media Picker Button
 *
 * Opens a CottonModal with CottonUIManager to pick a file,
 * uses CottonMediaHandler to generate the HTML element,
 * and inserts it into the editor content.
 * Supports images, videos, audio and other media types from Cotton file storage.
 *
 * @since  1.0
 */
final class Cotton extends CMSPlugin
{
    /**
     * Load the language file on instantiation.
     *
     * @var    boolean
     * @since  1.0
     */
    protected $autoloadLanguage = true;

    /**
     * Display the button.
     *
     * @param   string   $name    The name of the button to display (editor field ID).
     * @param   string   $asset   The name of the asset being edited.
     * @param   integer  $author  The id of the author owning the asset being edited.
     *
     * @return  CMSObject|false  Button object or false if user not authorized.
     *
     * @since   1.0
     */
    public function onDisplay($name, $asset, $author)
    {
        $user      = $this->getApplication()->getIdentity();
        $extension = $this->getApplication()->getInput()->get('option');

        // For categories, check the extension (ex: component.section)
        if ($extension === 'com_categories') {
            $parts     = explode('.', $this->getApplication()->getInput()->get('extension', 'com_content'));
            $extension = $parts[0];
        }

        $asset = $asset !== '' ? $asset : $extension;

        // Check user authorization
        if (!$this->isUserAuthorized($user, $asset, $author, $extension)) {
            return false;
        }

        // Enqueue Cotton assets
        $this->enqueueAssets();

        // Create and configure the button
        $button = $this->createButton($name);

        return $button;
    }

    /**
     * Check if user is authorized to use this feature.
     *
     * @param   object   $user       The user object.
     * @param   string   $asset      The asset name.
     * @param   integer  $author     The author ID.
     * @param   string   $extension  The component extension.
     *
     * @return  boolean
     *
     * @since   1.0
     */
    private function isUserAuthorized($user, $asset, $author, $extension)
    {
        return $user->authorise('core.edit', $asset)
            || $user->authorise('core.create', $asset)
            || (\count($user->getAuthorisedCategories($asset, 'core.create')) > 0)
            || ($user->authorise('core.edit.own', $asset) && $author === $user->id)
            || (\count($user->getAuthorisedCategories($extension, 'core.edit')) > 0)
            || (\count($user->getAuthorisedCategories($extension, 'core.edit.own')) > 0 && $author === $user->id);
    }

    /**
     * Enqueue necessary assets for Cotton integration.
     * 
     * Uses Joomla's Web Asset Manager to register and enqueue assets.
     * Dependencies are managed through joomla.asset.json files.
     * 
     * Injected Configuration (JavaScript):
     * - cotton_config: { baseUrl, rootUrl, siteUrl, admin, token }
     * - Available to all scripts via Joomla.getOptions()
     *
     * @param   object  $doc  The document object.
     *
     * @return  void
     *
     * @since   1.0
     */
    private function enqueueAssets() {

		$app = Factory::getApplication();
		$document = $app->getDocument();
        $wa = $this->getApplication()->getDocument()->getWebAssetManager();

        $wa->getRegistry()->addExtensionRegistryFile('com_cotton');
        $wa->useScript('com_cotton.cotton_uimanager');
        $wa->useStyle('com_cotton.cotton');

        $params_cotton = ComponentHelper::getParams('com_cotton');

		$theme = $params_cotton->get('cotton_theme', 0);

        if ($theme == '0') {
			$wa->useStyle('com_cotton.cotton_'.'light');
		} else {
			$wa->useStyle('com_cotton.cotton_'.'dark');
		}


        $doc = $this->getApplication()->getDocument();
        if ($doc && method_exists($doc, 'addScript')) {
            $doc->addScript(Uri::root() . 'media/plg_editors-xtd_cotton/js/cotton_button.js', ['defer' => true]);
        }

        $config = [
            'siteUrl' => Uri::base(),
            'admin' => $this->getApplication()->isClient('administrator'),
            'token' => $this->getApplication()->getFormToken(),
        ];

        $document->addScriptOptions('cotton_config', $config);

		$com = $app->bootComponent('com_cotton');
		$mvc = $com->getMVCFactory();
		$model = $mvc->createModel('Cotton', 'Site');

		$document->addScriptOptions('cotton_tree', $model->tree_load());
		$document->addScriptOptions('cotton_items', $model->items_load());
		$document->addScriptOptions('cotton_limits', $model->limit_file_space());

        $lang = Factory::getLanguage();
        $lang->load('com_cotton', JPATH_SITE);
        
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

		Text::script('PLG_EDITORS_XTD_COTTON_PICKER_TITLE');
		Text::script('PLG_EDITORS_XTD_COTTON_ERROR_MODAL_NOT_AVAILABLE');
		Text::script('PLG_EDITORS_XTD_COTTON_BUTTON_INSERT');
		Text::script('PLG_EDITORS_XTD_COTTON_ERROR_SELECT_FILE');
		Text::script('PLG_EDITORS_XTD_COTTON_ERROR_GENERATE_MEDIA');
		Text::script('PLG_EDITORS_XTD_COTTON_ERROR_PICKER');
		Text::script('PLG_EDITORS_XTD_COTTON_ERROR_EDITOR_NOT_FOUND');
		Text::script('PLG_EDITORS_XTD_COTTON_VIDEO_NOT_SUPPORTED');
		Text::script('PLG_EDITORS_XTD_COTTON_AUDIO_NOT_SUPPORTED');
		Text::script('PLG_EDITORS_XTD_COTTON_DOWNLOAD_FILE');
    }

    /**
     * Create the button object for the editor.
     *
     * @param   string  $fieldName  The name of the editor field.
     *
     * @return  CMSObject  The button configuration.
     *
     * @since   1.0
     */
    private function createButton($fieldName)
    {
        $button = new CMSObject();

        $button->text    = Text::_('PLG_EDITORS_XTD_COTTON_BUTTON_LABEL');
        $button->icon    = 'image';
        $button->name    = $this->_type . '_' . $this->_name;
        $button->onclick = 'CottonMediaButton.openPicker(\'' . $fieldName . '\')';

        $button->iconSVG = '<svg
								width="24px"
								height="24px"
								viewBox="0 0 139.99998 140"
								version="1.1"
								id="svg1178"
								sodipodi:docname="logo-cottoncloud.svg"
								inkscape:export-filename="logo-cottoncloud.svg"
								inkscape:export-xdpi="96"
								inkscape:export-ydpi="96"
								inkscape:version="1.2.2 (b0a8486541, 2022-12-01)"
								xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
								xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
								xmlns="http://www.w3.org/2000/svg"
								xmlns:svg="http://www.w3.org/2000/svg">
								<sodipodi:namedview
									id="namedview19"
									pagecolor="#ffffff"
									bordercolor="#000000"
									borderopacity="0.25"
									inkscape:showpageshadow="2"
									inkscape:pageopacity="0.0"
									inkscape:pagecheckerboard="0"
									inkscape:deskcolor="#d1d1d1"
									inkscape:document-units="mm"
									showgrid="false"
									inkscape:zoom="1.4778869"
									inkscape:cx="264.56693"
									inkscape:cy="264.56693"
									inkscape:window-width="1920"
									inkscape:window-height="1043"
									inkscape:window-x="0"
									inkscape:window-y="0"
									inkscape:window-maximized="1"
									inkscape:current-layer="svg1178" />
								<defs
									id="defs1175" />
								<g
									id="g332">
									<circle
									style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:14.189;stroke-linecap:square;stroke-linejoin:round;stroke-dasharray:28.3779, 14.189;stroke-dashoffset:65.2695"
									id="path1351"
									cx="32.991764"
									cy="50.941532"
									r="23.005808" />
									<circle
									style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:14.189;stroke-linecap:square;stroke-linejoin:round;stroke-dasharray:28.3779, 14.189;stroke-dashoffset:65.2695"
									id="path1351-6"
									cx="65.832184"
									cy="57.969242"
									r="23.005808" />
									<circle
									style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:14.189;stroke-linecap:square;stroke-linejoin:round;stroke-dasharray:28.3779, 14.189;stroke-dashoffset:65.2695"
									id="path1351-7"
									cx="103.5699"
									cy="43.915325"
									r="23.005808" />
									<circle
									style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:14.189;stroke-linecap:square;stroke-linejoin:round;stroke-dasharray:28.3779, 14.189;stroke-dashoffset:65.2695"
									id="path1351-5"
									cx="104.45709"
									cy="70.595947"
									r="23.005808" />
									<circle
									style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:14.189;stroke-linecap:square;stroke-linejoin:round;stroke-dasharray:28.3779, 14.189;stroke-dashoffset:65.2695"
									id="path1351-3"
									cx="60.811764"
									cy="95.175827"
									r="23.005808" />
									<circle
									style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:14.189;stroke-linecap:square;stroke-linejoin:round;stroke-dasharray:28.3779, 14.189;stroke-dashoffset:65.2695"
									id="path1351-56"
									cx="37.031536"
									cy="84.247833"
									r="23.005808" />
									<circle
									style="fill:#000000;fill-opacity:1;stroke:none;stroke-width:14.189;stroke-linecap:square;stroke-linejoin:round;stroke-dasharray:28.3779, 14.189;stroke-dashoffset:65.2695"
									id="path1351-2"
									cx="83.841309"
									cy="87.395966"
									r="23.005808" />
								</g>
								<g
									id="g323"
									transform="translate(-0.18836346)">
									<path
									d="m 86.541529,62.072772 v 0.132551 h -0.371125 v 0.927825 h -0.132559 v -0.927825 h -0.344614 v -0.132551 z"
									id="path216"
									style="fill:#ffffff;stroke-width:0.265093" />
									<path
									d="m 86.647569,62.072772 h 0.21207 l 0.291599,0.87481 0.291613,-0.87481 h 0.212071 v 1.033865 h -0.132543 v -0.609716 -0.106032 -0.159055 l -0.291606,0.874803 h -0.132544 l -0.291598,-0.874803 v 0.848299 h -0.132558 v -1.007361 z"
									id="path218"
									style="fill:#ffffff;stroke-width:0.265093" />
									<g
									id="g228"
									transform="matrix(0.26509387,0,0,0.26509387,25.941656,148.43137)">
									<path
										d="m 114.19781,-292.26605 -2.9,-2.9 c -8.9,-8.9 -11.700001,-21.7 -8.3,-33 -8.900001,-2 -15.600001,-10 -15.600001,-19.5 0,-11.1 9,-20 20.000001,-20 10,0 18.2,7.3 19.8,16.8 10.8,-2.5 22.6,0.4 31.1,8.8 l 1.2,1.2 -14.9,14.7 -1.1,-1.2 c -4.8,-4.8 -12.6,-4.8 -17.4,0 -4.8,4.8 -4.8,12.6 0,17.4 l 2.9,2.9 14.8,14.8 15.6,15.6 -14.8,14.8 -15.6,-15.7 z"
										id="path220"
										style="fill:#ffffff" />
									<path
										d="m 130.69781,-308.86605 15.6,-15.6 14.8,-14.8 2.9,-2.9 c 8.9,-8.9 21.6,-11.7 32.8,-8.4 1.4,-9.7 9.8,-17.2 19.9,-17.2 11.1,0 20,9 20,20 0,10.2 -7.6,18.6 -17.4,19.9 3.2,11.2 0.4,23.8 -8.4,32.7 l -1.2,1.2 -14.8,-14.8 1.1,-1.1 c 4.8,-4.8 4.8,-12.6 0,-17.4 -4.8,-4.8 -12.5,-4.8 -17.4,0 l -2.9,2.9 -14.6,14.7 -15.6,15.6 z"
										id="path222"
										style="fill:#ffffff" />
									<path
										d="m 197.29781,-234.26605 c -11.4,3.5 -24.2,0.7 -33.2,-8.3 l -1.1,-1.1 14.8,-14.8 1.1,1.1 c 4.8,4.8 12.6,4.8 17.4,0 4.8,-4.8 4.8,-12.5 0,-17.4 l -2.9,-2.9 -14.9,-14.6 -15.6,-15.7 14.8,-14.8 15.6,15.6 14.8,14.8 2.9,2.9 c 8.5,8.5 11.4,20.5 8.8,31.3 9.7,1.4 17.2,9.7 17.2,19.8 0,11.1 -9,20 -20,20 -9.8,0.2 -17.9,-6.7 -19.7,-15.9 z"
										id="path224"
										style="fill:#ffffff" />
									<path
										d="m 191.49781,-275.76605 -15.6,15.6 -14.8,14.8 -2.9,2.9 c -8.5,8.5 -20.6,11.4 -31.5,8.7 -2,8.9 -10,15.5 -19.5,15.5 -11.100001,0 -20.000001,-9 -20.000001,-20 0,-9.5 6.6,-17.4 15.400001,-19.5 -2.800001,-11 0.1,-23.1 8.7,-31.7 l 1.1,-1.1 14.8,14.8 -1.1,1.1 c -4.8,4.8 -4.8,12.6 0,17.4 4.8,4.8 12.6,4.8 17.4,0 l 2.9,-2.9 14.8,-14.8 15.6,-15.6 z"
										id="path226"
										style="fill:#ffffff" />
									</g>
								</g>
							</svg>';

        return $button;
    }
}
