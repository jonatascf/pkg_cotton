<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Site\Model\Service;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;

class SpaceCalculator
{
    /**
     * Return storage stats for an owner: ['files' => int, 'total_size' => int]
     */
    public function getOwnerStorage(int $ownerId = 0): array
    {
        $db = Factory::getDbo();
        $query = $db->getQuery(true)
            ->select('COUNT(f.id) AS files, COALESCE(SUM(f.size),0) AS total_size')
            ->from($db->quoteName('#__cotton_file', 'f'))
            ->where($db->quoteName('f.trash') . ' = 0');

        if ($ownerId) {
            $query->where($db->quoteName('f.owner_id') . ' = ' . $db->quote($ownerId));
        }

        $db->setQuery($query);
        $row = $db->loadAssoc();

        return $row ?: ['files' => 0, 'total_size' => 0];
    }
}
