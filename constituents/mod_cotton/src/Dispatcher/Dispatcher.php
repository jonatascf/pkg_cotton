<?php
/**
 * @package Tabaoca.Module.Cotton.Site
 * @subpackage mod_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Module\Cotton\Site\Dispatcher;

\defined('_JEXEC') or die;

use Joomla\CMS\Dispatcher\DispatcherInterface;
use Joomla\CMS\Helper\ModuleHelper;
use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Uri\Uri;

class Dispatcher implements DispatcherInterface
{
    public function dispatch(): void {

        require ModuleHelper::getLayoutPath('mod_cotton');

        $app = Factory::getApplication();
        $document = $app->getDocument();

        $wa = $document->getWebAssetManager();
        $wa->getRegistry()->addExtensionRegistryFile('mod_cotton');
        $wa->useScript('mod_cotton.cotton_mod');
        $wa->useStyle('mod_cotton.cotton_mod');

        $config = ['baseUrl' => Uri::root()];
        $document->addScriptOptions('mod_cotton', $config);

        $lang = $app->getLanguage();
        $lang->load('mod_cotton', JPATH_BASE . '/modules/mod_cotton');

        Text::script('MOD_COTTON_COTTON');
        Text::script('MOD_COTTON_WEAVER');
        Text::script('MOD_COTTON_SHUTTLE');

    }

}