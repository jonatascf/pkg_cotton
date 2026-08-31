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
use Joomla\CMS\Factory;
use Joomla\CMS\Session\Session;
use Joomla\CMS\Response\JsonResponse;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Uri\Uri;
use Joomla\CMS\Component\ComponentHelper;

/**
 * Controller of Shuttle Editor administrator component
 *
 * @package     Tabaoca.Component.Shuttle.Administrator
 * @subpackage  com_shuttle
 * @since       2.0.0
 */
class ShuttleController extends BaseController {

	/**
	* Method to start the loop to refresh data in Dashboard View.
	* 
	* @return  object  Response JSON encoded object to XHR call.
	* @since   2.0.0
	*/
	public function run () {

		try {

			if (!Session::checkToken()) {

				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);

			} else {

				$input = Factory::getApplication()->input;

				$n_folders = $input->get('n_folders', 0, 'INT');
				$n_files = $input->get('n_files', 0, 'INT');
				$n_size = $input->get('n_size', 0, 'INT');

				$model = $this->getModel();

				$record = $model->run($n_folders, $n_files, $n_size);

				echo new JsonResponse($record);

			}

		} catch (\Exception $e) {

			echo new JsonResponse($e);

		}

	}


}