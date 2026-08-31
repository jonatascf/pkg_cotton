/**
 * @package Tabaoca.Module.Cotton.Site
 * @subpackage mod_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

/**
 * mod_cotton - Dock module for launching Cotton, Weaver, and Shuttle
 *
 * Builds a small dock with app icons and labels on DOMContentLoaded.
 */

const MOD_COTTON_CONFIG = Joomla.getOptions('mod_cotton') || {};
const MOD_COTTON_BASE_URL = MOD_COTTON_CONFIG.baseUrl || '';

const MOD_COTTON_LABELS = {
  cotton: Joomla.Text._('MOD_COTTON_COTTON'),
  weaver: Joomla.Text._('MOD_COTTON_WEAVER'),
  shuttle: Joomla.Text._('MOD_COTTON_SHUTTLE')
};

document.addEventListener('DOMContentLoaded', function () {
  const container = document.getElementById('cotton_mod');

  if (!container) return;

  // Clear the container to avoid duplicates and apply the Dock class
  container.innerHTML = '';
  container.className = 'cotton-dock-container';

  const links = [
    { key: 'cotton', path: 'index.php?option=com_cotton&view=cotton', img: 'cotton.png' },
    { key: 'weaver', path: 'index.php?option=com_weaver&view=weaver', img: 'weaver.png' },
    { key: 'shuttle', path: 'index.php?option=com_shuttle&view=shuttle', img: 'shuttle.png' }
  ];

  links.forEach(function (item) {
    const anchor = document.createElement('a');
    anchor.className = 'cotton-dock-item';
    anchor.setAttribute('href', MOD_COTTON_BASE_URL + item.path);

    // 1. Creates the square icon (PNG)
    const icon = document.createElement('img');
    // Adjust the image folder path according to your module structure
    icon.src = MOD_COTTON_BASE_URL + 'media/mod_cotton/images/' + item.img;
    icon.className = 'cotton-dock-icon';
    icon.alt = MOD_COTTON_LABELS[item.key];

    // 2. Creates the floating text label (iOS style)
    const label = document.createElement('span');
    label.className = 'cotton-dock-label';
    label.textContent = MOD_COTTON_LABELS[item.key] || item.key;

    // Assemble the structure
    anchor.appendChild(label);
    anchor.appendChild(icon);
    container.appendChild(anchor);
  });
});
