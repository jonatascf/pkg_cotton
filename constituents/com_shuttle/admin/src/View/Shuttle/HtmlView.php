<?php
/**
 * @package Tabaoca.Component.Shuttle.Administrator
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Shuttle\Administrator\View\Shuttle;

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

		$this->canDo = ContentHelper::getActions('com_shuttle');

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

		ToolBarHelper::title(Text::_('COM_SHUTTLE_DASHBOARD'), 'shuttle');

		if ($this->canDo->get('core.admin')) {

			ToolBarHelper::divider();
			ToolBarHelper::preferences('com_shuttle');

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
		$document->setTitle(Text::_('COM_SHUTTLE'));

	}

}
