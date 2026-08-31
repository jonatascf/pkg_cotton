<?php
/**
 * @package Tabaoca.Component.Shuttle.Administrator
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Shuttle\Administrator\Controller;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\Controller\BaseController;

/**
 * General Controller of Shuttle Editor administrator component
 *
 * @package     Tabaoca.Component.Shuttle.Administrator
 * @subpackage  com_shuttle
 * @since       2.0.0
 */
 
class DisplayController extends BaseController {

	protected $default_view = 'shuttle';

	public function display($cachable = false, $urlparams = array()) {

		return parent::display($cachable, $urlparams);

	}

}
