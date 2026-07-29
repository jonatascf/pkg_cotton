<?php
/**
 * @package Tabaoca.Component.Cotton.Administrator
 * @subpackage com_cotton
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Administrator\Model;

\defined('_JEXEC') or die;

use stdClass;
use Joomla\CMS\MVC\Model\BaseModel;
use Joomla\CMS\Factory;
use Joomla\Database\ParameterType;

/**
 * Model of Cotton Cloud System administrator component
 *
 * @package     Tabaoca.Component.Cotton.Administrator
 * @subpackage  com_cotton
 * @since       2.0.0
 */
class CottonModel extends BaseModel {

	/**
	* Method to verify changed data on database.
	* 
	* @return  object  Response Data to XHR call.
	* @since   2.0.0
	*/
	public function run ($n_folders, $n_files, $n_size) { 

		$trigger = true;

		$data = new stdClass();
		$data->n_folders = null;
		$data->n_files = null;
		$data->n_size = null;

		do { 

			set_time_limit(20);

			$result = $this->data_cotton();

			if ($result->n_folders != $n_folders) {

				$data->n_folders = $result->n_folders;
				$trigger = false;

			}

			if ($result->n_files != $n_files) {

				$data->n_files = $result->n_files;
				$trigger = false;

			}

			if ($result->n_size != $n_size) {

				$data->n_size = $result->n_size;
				$trigger = false;

			}

			usleep(40);

		} while ($trigger);

		$data->config = $this->cotton_config();

		return $data;

	}

	/**
	* Method to verify number of folders, files and used space.
	* 
	* @return  object  Response Data to XHR call.
	* @since   2.0.0
	*/
	public function data_cotton () {

		$data = new stdClass();

		$db = $this->getDatabase();
		$query_a = $db->getQuery(true);

		$query_a->select('id');
		$query_a->from($db->quoteName('#__cotton_folder'));

		$db->setQuery($query_a);
		$db->execute();
		$data->n_folders = $db->getNumRows();

		$query_b = $db->getQuery(true);

		$query_b->select('id, size');
		$query_b->from($db->quoteName('#__cotton_file'));
		
		$db->setQuery($query_b);
		$db->execute();
		$data->n_files = $db->getNumRows();
		$files_size = $db->loadObjectList();

		$data->n_size = 0;

		for ($i = 0; $i < $data->n_files; $i++) {

			$data->n_size = $data->n_size + intval($files_size[$i]->size);

		}

		return $data;

	}

	/**
	* Method to get same PHP Server and MySQL configuration.
	* 
	* @return  object  Response Data to XHR call.
	* @since   2.0.0
	*/
	private function cotton_config () {

		$data = new stdClass();

		$db = $this->getDatabase();
		$query = $db->getQuery(true);

		$query->select('@@GLOBAL.max_allowed_packet as max_allowed_packet'); //16777216 max 1073741824
		

		$db->setQuery($query);
		$db->execute();

		$value = $db->loadObjectList();

		$data->max_allowed_packet = $value[0]->max_allowed_packet;
		$data->upload_max_filesize = ini_get('upload_max_filesize');
		$data->post_max_size = ini_get('post_max_size');
		$data->memory_limit = ini_get('memory_limit');

		return $data;

	}

	/**
	* Method to get Joomla database driver.
	* 
	* @return  object  DatabaseDriver.
	* @since   2.0.0
	*/
	private function getDatabase () {

		return Factory::getContainer()->get('DatabaseDriver');

	}

}
