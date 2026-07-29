<?php
/**
 * @package Tabaoca.Component.Cotton.Administrator
 * @subpackage com_cotton
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Administrator\Table;

\defined('_JEXEC') or die;

use Joomla\CMS\Table\Table; 

class FolderTable extends Table {

	/**
	 * Constructor
	 *
	 * @param   JDatabaseDriver  &$db  A database connector object
	 */
	function __construct(&$db) {

		parent::__construct('#__cotton_folder', 'id', $db);

	}

}
