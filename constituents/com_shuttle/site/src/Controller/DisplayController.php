<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Shuttle\Site\Controller;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\Controller\BaseController;

/**
 * General Controller of Shuttle Terminal component
 *
 * @package     Tabaoca.Component.Shuttle.Site
 * @subpackage  com_shuttle
 * @since       2.0.0
 */

class DisplayController extends BaseController {

	public function display($cachable = false, $urlparams = array()) {

		return parent::display($cachable, $urlparams);

	}

}
