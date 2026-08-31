<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Cotton\Site\Controller;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\Controller\BaseController;

/**
 * General Controller of Cotton Cloud component
 *
 * @package     Tabaoca.Component.Cotton.Site
 * @subpackage  com_cotton
 * @since       2.0.0
 */

class DisplayController extends BaseController {

	public function display($cachable = false, $urlparams = array()) {

		return parent::display($cachable, $urlparams);

	}

}
