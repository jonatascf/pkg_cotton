<?php
/**
 * @package Tabaoca.Component.Weaver.Administrator
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Weaver\Administrator\View\Weaver;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\View\HtmlView as BaseHtmlView;
use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Toolbar\ToolbarHelper;
use Joomla\CMS\Helper\ContentHelper;

class HtmlView extends BaseHtmlView {

	/**
	 * Display the Cotton Cloud administrator view
	 *
	 * @param   string  $tpl  The name of the template file to parse; automatically searches through the template paths.
	 *
	 * @return  void
	 */
	public function display($tpl = null) {

		$this->canDo = ContentHelper::getActions('com_weaver');

		// Set the toolbar
		$this->addToolBar();

		// Set the document
		$this->setDocument(null);

		// Display the template
		parent::display($tpl);

	}

	/**
	 * Method to add the page title and toolbar in the administrator view.
	 *
	 * @return  void
	 */
	protected function addToolBar() {

		ToolBarHelper::title(Text::_('COM_WEAVER_DASHBOARD'), 'weaver');

		if ($this->canDo->get('core.admin')) {

			ToolBarHelper::divider();
			ToolBarHelper::preferences('com_weaver');

		}

	}

	/**
	 * Setup the Cotton Cloud site view.
	 *
	 * @param   string  $doc  The name of the template file to parse; automatically searches through the template paths.
	 *
	 * @return  string  Setup HTML inserts of Style Sheet, Script files and setup language variables in Javascript.
	 */
	public function setDocument($doc): void {

		$document = Factory::getDocument();
		$document->setTitle(Text::_('COM_WEAVER'));

	}

}
