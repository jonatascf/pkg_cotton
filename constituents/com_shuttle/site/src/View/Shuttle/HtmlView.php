<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Shuttle\Site\View\Shuttle;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\View\HtmlView as BaseHtmlView;
use Joomla\CMS\Factory;
use Joomla\CMS\Uri\Uri;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Component\ComponentHelper;

class HtmlView extends BaseHtmlView {

    /**
     * Display the Shuttle site view.
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
     * Setup the Shuttle site view.
     *
     * @return  void
     */
    public function setDocument($doc): void {

        $currentuser = Factory::getApplication()->getIdentity();
        $app = Factory::getApplication();
        $session = $app->getSession();
        $document = $app->getDocument();
        $document->setTitle(Text::_('COM_SHUTTLE'));

        if (!$currentuser->get('id')) {

            $app->enqueueMessage(Text::_('JERROR_ALERTNOAUTHOR'), 'error');
            $app->setHeader('status', 403, true);

            return;
        }

        $wa = $document->getWebAssetManager();
        $wa->useScript('com_shuttle.shuttle_app');
        
        $wa->getRegistry()->addExtensionRegistryFile('com_cotton');
        $wa->useStyle('com_cotton.cotton');
        $wa->useScript('com_cotton.cotton_uxmanager');

        $params_cotton = ComponentHelper::getParams('com_cotton');
        $theme = $params_cotton->get('cotton_theme', 0);
        $ux = $params_cotton->get('cotton_ux', 0);

        if ($theme == '0') {
            $wa->useStyle('com_cotton.cotton_light');
        } else {
            $wa->useStyle('com_cotton.cotton_dark');
        }

        if (!$currentuser->get('id')) {
        $app->enqueueMessage(Text::_('JERROR_ALERTNOAUTHOR'), 'error');
        $app->setHeader('status', 403, true);
        return;
        }

        $config = [
            'siteUrl' => Uri::base(),
            'admin' => $app->isClient('administrator'),
            'token' => $app->getFormToken(),
			'userName' => $currentuser->get('username'),
			'ux' => $ux == '0' ? false : true
        ];

        $document->addScriptOptions('com_shuttle', $config);

        Text::script('COM_SHUTTLE_CONTAINER_NOT_FOUND');
		Text::script('COM_SHUTTLE_TERMINAL_TITLE');
		Text::script('COM_SHUTTLE_MAXIMIZE');
		Text::script('COM_SHUTTLE_FOOTER_HINT');
		Text::script('COM_SHUTTLE_ERROR_UNEXPECTED');
		Text::script('COM_SHUTTLE_CANCEL');
		Text::script('COM_SHUTTLE_SERVER_RETURNED');
		Text::script('COM_SHUTTLE_REMOTE_ERROR');
		Text::script('COM_SHUTTLE_COMMAND_EMPTY');
		Text::script('COM_SHUTTLE_COMMAND_INVALID_OPTION');
		Text::script('COM_SHUTTLE_COMMAND_NOT_FOUND_VALIDATE');
		Text::script('COM_SHUTTLE_COMMAND_NOT_FOUND');
		Text::script('COM_SHUTTLE_COMMAND_PARAM_MIN');
		Text::script('COM_SHUTTLE_COMMAND_PARAM_MAX');
		Text::script('COM_SHUTTLE_REQUIRES_MIN');
		Text::script('COM_SHUTTLE_ACCEPTS_MAX');
		Text::script('COM_SHUTTLE_API_MEDIA_NOT_SUPPORTED');
		Text::script('COM_SHUTTLE_NO_MEDIA_DEVICES');
		Text::script('COM_SHUTTLE_ERROR_LISTING_MEDIA');
		Text::script('COM_SHUTTLE_NAV_BROWSER_INFO');
		Text::script('COM_SHUTTLE_API_USB_NOT_SUPPORTED');
		Text::script('COM_SHUTTLE_USB_SELECTED');
		Text::script('COM_SHUTTLE_ERROR_USB_CONNECT');
		Text::script('COM_SHUTTLE_NO_USB_DEVICES');
		Text::script('COM_SHUTTLE_USB_CONNECT_HINT');
		Text::script('COM_SHUTTLE_ERROR_LISTING_USB');
		Text::script('COM_SHUTTLE_API_GAMEPAD_NOT_SUPPORTED');
		Text::script('COM_SHUTTLE_NO_GAMEPAD');
		Text::script('COM_SHUTTLE_API_GPU_NOT_SUPPORTED');
		Text::script('COM_SHUTTLE_GPU_INFO');
		Text::script('COM_SHUTTLE_NO_GPU_ADAPTER');
		Text::script('COM_SHUTTLE_ERROR_GPU_INFO');
		Text::script('COM_SHUTTLE_API_GEO_NOT_SUPPORTED');
		Text::script('COM_SHUTTLE_GEO_INFO');
		Text::script('COM_SHUTTLE_ERROR_GEO');
		Text::script('COM_SHUTTLE_API_NETWORK_NOT_SUPPORTED');
		Text::script('COM_SHUTTLE_API_MEMORY_NOT_SUPPORTED');
		Text::script('COM_SHUTTLE_API_STORAGE_NOT_SUPPORTED');
		Text::script('COM_SHUTTLE_ERROR_STORAGE');
		Text::script('COM_SHUTTLE_REQUEST_FAILED');
		Text::script('COM_SHUTTLE_ERROR_IP');
		Text::script('COM_SHUTTLE_MEMORY_INFO');
		Text::script('COM_SHUTTLE_WELCOME_TITLE');
		Text::script('COM_SHUTTLE_WELCOME_HINT');
		Text::script('COM_SHUTTLE_HELP_AVAILABLE_HEADER');
		Text::script('COM_SHUTTLE_HELP_USE_HELP');
		Text::script('COM_SHUTTLE_HELP_COMMAND_HEADER');
		Text::script('COM_SHUTTLE_HELP_OPTIONS');
		Text::script('COM_SHUTTLE_HELP_PARAMETERS');
		Text::script('COM_SHUTTLE_ERROR_REQUEST_FAILED');
		Text::script('COM_SHUTTLE_NAV_BROWSER_NAME');
		Text::script('COM_SHUTTLE_NAV_BROWSER_VERSION');
		Text::script('COM_SHUTTLE_NAV_USER_AGENT');
		Text::script('COM_SHUTTLE_NAV_PLATFORM');
		Text::script('COM_SHUTTLE_NAV_LANGUAGE');
		Text::script('COM_SHUTTLE_NAV_PREFERRED_LANGUAGES');
		Text::script('COM_SHUTTLE_NAV_ONLINE');
		Text::script('COM_SHUTTLE_NAV_CPU_CORES');
		Text::script('COM_SHUTTLE_NAV_DEVICE_MEMORY');
		Text::script('COM_SHUTTLE_MEDIA_TYPE');
		Text::script('COM_SHUTTLE_MEDIA_ID');
		Text::script('COM_SHUTTLE_MEDIA_NAME');
		Text::script('COM_SHUTTLE_USB_NAME');
		Text::script('COM_SHUTTLE_USB_MANUFACTURER');
		Text::script('COM_SHUTTLE_USB_PRODUCT_ID');
		Text::script('COM_SHUTTLE_USB_VENDOR_ID');
		Text::script('COM_SHUTTLE_GAMEPAD_NAME');
		Text::script('COM_SHUTTLE_GAMEPAD_INDEX');
		Text::script('COM_SHUTTLE_GAMEPAD_BUTTONS');
		Text::script('COM_SHUTTLE_GAMEPAD_AXES');
		Text::script('COM_SHUTTLE_GPU_NAME');
		Text::script('COM_SHUTTLE_GPU_PLATFORM');
		Text::script('COM_SHUTTLE_GPU_LIMITS');
		Text::script('COM_SHUTTLE_GPU_FEATURES');
		Text::script('COM_SHUTTLE_GEO_LATITUDE');
		Text::script('COM_SHUTTLE_GEO_LONGITUDE');
		Text::script('COM_SHUTTLE_GEO_ALTITUDE');
		Text::script('COM_SHUTTLE_GEO_ALTITUDE_ACC');
		Text::script('COM_SHUTTLE_GEO_HEADING');
		Text::script('COM_SHUTTLE_GEO_SPEED');
		Text::script('COM_SHUTTLE_CONNECTION_TYPE');
		Text::script('COM_SHUTTLE_CONNECTION_BANDWIDTH');
		Text::script('COM_SHUTTLE_CONNECTION_LATENCY');
		Text::script('COM_SHUTTLE_CONNECTION_SAVER');
		Text::script('COM_SHUTTLE_CONNECTION_NETWORK_TYPE');
		Text::script('COM_SHUTTLE_STORAGE_USAGE');
		Text::script('COM_SHUTTLE_STORAGE_QUOTA');
		Text::script('COM_SHUTTLE_IP_ADDRESS');


    }

}
