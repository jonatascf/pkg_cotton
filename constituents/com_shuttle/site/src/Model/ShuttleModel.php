<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Shuttle\Site\Model;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\Model\BaseModel;
use Joomla\CMS\Factory;
use Tabaoca\LibCotton\FileHandler;

/**
 * Shuttle Model
 * 
 * Handles communication with com_cotton via lib_cotton's CottonApiClient.
 * Provides methods for commands used by Shuttle terminal.
 * 
 * This model demonstrates the proper use of lib_cotton as the abstraction layer
 * between com_shuttle and com_cotton, following the Single Responsibility Principle.
 * 
 * @package     Tabaoca.Component.Shuttle.Site
 * @subpackage  com_shuttle
 * @since       2.0.0
 */
class ShuttleModel extends BaseModel
{

}
