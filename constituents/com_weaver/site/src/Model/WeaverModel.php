<?php
/**
 * @package Tabaoca.Component.Weaver.Site
 * @subpackage com_weaver
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Weaver\Site\Model;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\Model\BaseModel;
use Joomla\CMS\Factory;
use Tabaoca\LibCotton\FileHandler;

/**
 * Weaver Model
 * 
 * Handles communication with com_cotton via lib_cotton's CottonApiClient.
 * Provides methods for file/folder operations used by Weaver editor.
 * 
 * This model demonstrates the proper use of lib_cotton as the abstraction layer
 * between com_weaver and com_cotton, following the Single Responsibility Principle.
 * 
 * @package     Tabaoca.Component.Weaver.Site
 * @subpackage  com_weaver
 * @since       2.0.0
 */
class WeaverModel extends BaseModel
{
    
}
