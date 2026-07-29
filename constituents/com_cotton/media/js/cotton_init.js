/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

// Arquivo de inicialização do Cotton

import { CottonUIManager } from './CottonUIManager.js';

const config = Joomla.getOptions('cotton_config');
const limits = Joomla.getOptions('cotton_limits');
const tree = Joomla.getOptions('cotton_tree');
const items = Joomla.getOptions('cotton_items');

console.log('[cotton_init] Configurações carregadas:', { config, tree, items, limits });

(function(){
    try {
        const container = document.getElementById('cotton_app');
        if (!container) {
            console.error('[cotton_init] #cotton_app não encontrado');
            return;
        }

        // Instancia e inicializa o manager
        const manager = new CottonUIManager(container, {
            siteUrl: config.siteUrl,
            admin: config.admin,
            token: config.token,
            userName: config.userName,
            treeData: tree,
            itemsData: items,
            limits: limits,
            ux: config.ux
        });

        manager.initialize();

    } catch (err) {
        console.error('[cotton_init] Falha ao inicializar CottonUIManager:', err);
    }
})();
