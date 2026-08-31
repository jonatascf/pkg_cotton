<?php
/**
 * @package Tabaoca.Component.Weaver.Administrator
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Weaver\Administrator\Controller;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\Controller\BaseController;

/**
 * General Controller of Weaver Editor administrator component
 *
 * @package     Tabaoca.Component.Weaver.Administrator
 * @subpackage  com_weaver
 * @since       2.0.0
 */
 
class DisplayController extends BaseController {

	protected $default_view = 'weaver';

	public function display($cachable = false, $urlparams = array()) {

		return parent::display($cachable, $urlparams);

	}

}
