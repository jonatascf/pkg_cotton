<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Cotton\Site\View\Cotton;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\View\JsonView as BaseJsonView;

class JsonView extends BaseJsonView {

	/**
	 * Connect the Cotton Cloud site view in JSON Format to XHR tasks.
	 *
	 * @param   string  $tpl  The name of the template file to parse; automatically searches through the template paths.
	 *
	 * @return  void
	 */
	public function display($tpl = null) {

		parent::display($tpl);

	}

}
