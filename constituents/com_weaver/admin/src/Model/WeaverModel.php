<?php
/**
 * @package Tabaoca.Component.Weaver.Administrator
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Weaver\Administrator\Model;

\defined('_JEXEC') or die;

use stdClass;
use Joomla\CMS\MVC\Model\BaseModel;
use Joomla\CMS\Factory;
use Joomla\Database\ParameterType;

/**
 * Model of Weaver Editor administrator component
 *
 * @package     Tabaoca.Component.Weaver.Administrator
 * @subpackage  com_weaver
 * @since       2.0.0
 */
class WeaverModel extends BaseModel {

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


}
