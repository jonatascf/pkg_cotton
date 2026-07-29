/**
 * @package Tabaoca.Module.Cotton.Site
 * @subpackage mod_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
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

  // Limpa o container para evitar duplicações e aplica a classe do Dock
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

    // 1. Cria o Ícone Quadrado (PNG)
    const icon = document.createElement('img');
    // Ajuste o caminho da pasta de imagens conforme a estrutura do seu módulo
    icon.src = MOD_COTTON_BASE_URL + 'media/mod_cotton/images/' + item.img;
    icon.className = 'cotton-dock-icon';
    icon.alt = MOD_COTTON_LABELS[item.key];

    // 2. Cria a etiqueta de texto flutuante (Estilo iOS)
    const label = document.createElement('span');
    label.className = 'cotton-dock-label';
    label.textContent = MOD_COTTON_LABELS[item.key] || item.key;

    // Monta a estrutura
    anchor.appendChild(label);
    anchor.appendChild(icon);
    container.appendChild(anchor);
  });
});
