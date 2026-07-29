/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * CottonTree - Módulo genérico para renderização de árvore de pastas/arquivos
 * 
 * Fornece uma árvore navegável com suporte a:
 * - Expansão/recolhimento de pastas
 * - Renderização de arquivos filhos
 * - Callbacks configuráveis para eventos
 * 
 * @class
 * @example
 * const tree = new CottonTree('#tree-container', {
 *     onFolderClick: (folder) => console.log('Folder clicked:', folder),
 *     onFileClick: (file) => console.log('File clicked:', file)
 * });
 * tree.render(treeData);
 */

import { CottonHelper } from './CottonHelper.js';

export class CottonTree {
    #container = null;
    #treeData = null;
    #expandedFolders = new Set();
    #options = {};
    #state = {
        activeFolderId: 0
    };

    /**
     * Construtor
     * @param {string|HTMLElement} container - Seletor ou elemento DOM
     * @param {Object} options - Configurações
     *   @param {Function} options.onFolderClick - Callback ao clicar em pasta
     *   @param {Function} options.onFileClick - Callback ao clicar em arquivo
     *   @param {Function} options.onTrashClick - Callback ao clicar no botão lixeira
     *   @param {Function} options.getIcon - Função para ícone MIME
     *   @param {Function} options.getPermissionIcon - Função para ícone de permissão
     *   @param {Function} options.onFolderToggle - Callback ao togglear pasta (id, expanded)
     */
    constructor(container, options = {}) {
        if (typeof container === 'string') {
            this.#container = document.querySelector(container);
        } else {
            this.#container = container;
        }

        if (!this.#container) {
            throw new Error('[CottonTree] Container não encontrado');
        }

        this.#options = {
            onFolderClick: options.onFolderClick || (() => {}),
            onFileClick: options.onFileClick || (() => {}),
            onTrashClick: options.onTrashClick || (() => {}),
            onFolderToggle: options.onFolderToggle || (() => {}),
            showTrash: options.showTrash || false,
            getIcon: options.getIcon || ((mimeType, opts) => this.#defaultGetIcon(mimeType, opts)),
            getPermissionIcon: options.getPermissionIcon || ((item) => this.#defaultGetPermissionIcon(item)),
            ...options
        };
    }

    #defaultGetIcon(mimeType, options = {}) {
        return CottonHelper.getMimeIcon(mimeType, options);
    }

    #defaultGetPermissionIcon(item) {
        const openLink = parseInt(item?.open_link ?? 0, 10) || 0;
        if (openLink === 1) {
            return '<span class="cotton-perm-icon cotton-perm-icon-limited" title="Usuários específicos"><i class="fa-solid fa-users"></i></span>';
        }
        if (openLink === 2) {
            return '<span class="cotton-perm-icon cotton-perm-icon-public" title="Público"><i class="fa-solid fa-globe"></i></span>';
        }
        return '';
    }

    setExpandedFolders(ids) {
        this.#expandedFolders = new Set(ids);
    }

    getExpandedFolders() {
        return Array.from(this.#expandedFolders);
    }

    expandAll() {
        const collectIds = (nodes) => {
            nodes.forEach(node => {
                this.#expandedFolders.add(node.id);
                if (node.children) collectIds(node.children);
            });
        };
        const nodes = Array.isArray(this.#treeData) ? this.#treeData : (this.#treeData?.tree || []);
        if (nodes.length > 0) collectIds(nodes);
        this.render(this.#treeData);
    }

    collapseAll() {
        this.#expandedFolders.clear();
        this.render(this.#treeData);
    }

    setActiveFolder(folderId) {
        this.#state.activeFolderId = folderId;
    }

    #findNodeById(treeData, nodeId) {
        for (const node of treeData) {
            if (node.id === nodeId) return node;
            if (node.children && node.children.length > 0) {
                const found = this.#findNodeById(node.children, nodeId);
                if (found) return found;
            }
        }
        return null;
    }

    #toggleFolder(folderId, expandIcon, childrenContainer) {
        const isExpanded = this.#expandedFolders.has(folderId);

        if (isExpanded) {
            this.#expandedFolders.delete(folderId);
            expandIcon.classList.remove('cotton-tree-expand--expanded');
            expandIcon.classList.add('cotton-tree-expand--collapsed');
        } else {
            this.#expandedFolders.add(folderId);
            expandIcon.classList.remove('cotton-tree-expand--collapsed');
            expandIcon.classList.add('cotton-tree-expand--expanded');
        }

        childrenContainer.style.display = this.#expandedFolders.has(folderId) ? 'block' : 'none';
        this.#options.onFolderToggle(folderId, !isExpanded);
    }

    #renderFolderNode(node, level = 0) {
        const container = document.createElement('div');
        container.className = 'cotton-tree-node';
        container.dataset.nodeId = node.id;
        container.dataset.nodeType = 'folder';

        const row = document.createElement('div');
        row.className = 'cotton-tree-folder-row';
        row.dataset.nodeId = node.id;
        row.style.paddingLeft = `${level * 16}px`;

        const hasChildren = node.children && node.children.length > 0;
        const hasFiles = node.files && node.files.length > 0;
        const canExpand = hasChildren || hasFiles;

        const expandIcon = document.createElement('span');
        if (canExpand) {
            const isExpanded = this.#expandedFolders.has(node.id);
            expandIcon.className = `cotton-tree-expand cotton-tree-expand--${isExpanded ? 'expanded' : 'collapsed'}`;
            expandIcon.title = isExpanded ? 'Recolher' : 'Expandir';
        } else {
            expandIcon.className = 'cotton-tree-spacer';
        }

        const icon = document.createElement('span');
        icon.className = 'cotton-tree-icon';
        icon.innerHTML = this.#options.getIcon('folder', { size: 'fa-sm', colored: true });
        row.appendChild(expandIcon);
        row.appendChild(icon);

        const permIcon = this.#options.getPermissionIcon(node);
        if (permIcon) {
            const permIconEl = document.createElement('span');
            permIconEl.className = 'cotton-tree-perm-icon';
            permIconEl.innerHTML = permIcon;
            row.appendChild(permIconEl);
        }

        const name = document.createElement('span');
        name.className = 'cotton-tree-name';
        name.textContent = CottonHelper.truncateName(node.name);
        name.title = node.description || node.name;
        row.appendChild(name);

        container.appendChild(row);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'cotton-tree-children';
        childrenContainer.style.display = this.#expandedFolders.has(node.id) ? 'block' : 'none';

        if (canExpand) {
            expandIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.#toggleFolder(node.id, expandIcon, childrenContainer);
            });
        }

        row.addEventListener('click', (e) => {
            e.stopPropagation();
            this.#setActiveTreeItem(node.id);
            this.#options.onFolderClick(node);

            if (canExpand && !this.#expandedFolders.has(node.id)) {
                this.#toggleFolder(node.id, expandIcon, childrenContainer);
            } else if (canExpand && this.#expandedFolders.has(node.id)) {
                this.#toggleFolder(node.id, expandIcon, childrenContainer);
            }
        });

        if (hasChildren) {
            node.children.forEach(child => {
                childrenContainer.appendChild(this.#renderFolderNode(child, level + 1));
            });
        }

        if (hasFiles) {
            node.files.forEach(file => {
                childrenContainer.appendChild(this.#renderFileNode(file, level + 1));
            });
        }

        container.appendChild(childrenContainer);
        return container;
    }

    #renderFileNode(file, level = 0) {
        const fileRow = document.createElement('div');
        fileRow.className = 'cotton-tree-file-row';
        fileRow.style.paddingLeft = `${(level * 16) + 20}px`;
        fileRow.dataset.fileId = file.id;
        fileRow.dataset.nodeType = 'file';

        const fileIcon = document.createElement('span');
        fileIcon.className = 'cotton-tree-file-icon';
        const mimeType = this.#getMimeTypeForFile(file);
        fileIcon.innerHTML = this.#options.getIcon(mimeType, { size: 'fa-sm', colored: true });

        const fileName = document.createElement('span');
        fileName.className = 'cotton-tree-name';
        fileName.textContent = CottonHelper.truncateName(file.name);
        fileName.title = `${file.name} (${CottonHelper.formatSize(file.size || 0)})`;

        fileRow.appendChild(fileIcon);

        const filePermIcon = this.#options.getPermissionIcon(file);
        if (filePermIcon) {
            const permIconEl = document.createElement('span');
            permIconEl.className = 'cotton-tree-perm-icon';
            permIconEl.innerHTML = filePermIcon;
            fileRow.appendChild(permIconEl);
        }
        
        fileRow.appendChild(fileName);

        fileRow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.#options.onFileClick(file, fileRow);
        });

        return fileRow;
    }

    #setActiveTreeItem(folderId) {
        const tree = this.#container;
        
        tree.querySelectorAll('.cotton-tree-folder-row.active, .cotton-tree-name.active')
            .forEach(el => el.classList.remove('active'));
        tree.querySelectorAll('.cotton-tree-name.inactive')
            .forEach(el => el.classList.remove('inactive'));

        const selector = `.cotton-tree-folder-row[data-node-id="${folderId}"]`;
        const activeItem = tree.querySelector(selector);
        if (activeItem) {
            activeItem.classList.add('active');
            activeItem.classList.remove('inactive');
        }

        tree.querySelectorAll('.cotton-tree-name').forEach(button => {
            button.classList.toggle('inactive', !button.classList.contains('active'));
        });
    }

    #getMimeTypeForFile(file) {
        const ext = CottonHelper.getExtension(file.name);
        return CottonHelper.extensionToMime(ext);
    }

    render(treeData, options = {}) {
        this.#treeData = treeData;
        
        if (options.startNode !== undefined && options.startNode !== null) {
            this.#expandedFolders.add(options.startNode);
        }
        
        const rootNodes = [];
        const nodes = Array.isArray(treeData) ? treeData : (treeData?.tree || []);

        if (options.startNode !== 0 && options.startNode !== undefined) {
            const startNode = nodes.find(f => f.id === options.startNode) || 
                this.#findNodeById(nodes, options.startNode);
            if (startNode) rootNodes.push(startNode);
        } else {
            nodes.forEach(f => rootNodes.push(f));
        }

        let folderTree = this.#container.querySelector('.cotton-folder-tree') || this.#container.querySelector('.weaver-folder-tree');
        if (!folderTree) {
            folderTree = document.createElement('div');
            folderTree.className = 'cotton-folder-tree';
            this.#container.appendChild(folderTree);
        } else {
            folderTree.innerHTML = '';
        }

        rootNodes.forEach(node => {
            folderTree.appendChild(this.#renderFolderNode(node, 0));
        });

        if (this.#options.showTrash) {
        
            let trashContainer = this.#container.querySelector('.cotton-trash');
            if (!trashContainer) {
                trashContainer = document.createElement('div');
                trashContainer.className = 'cotton-trash';
                this.#container.appendChild(trashContainer);
            }
            trashContainer.innerHTML = '';
            const trashBtn = document.createElement('button');
            trashBtn.type = 'button';
            trashBtn.className = 'btn btn-outline-secondary btn-sm active';
            trashBtn.innerHTML = `<i class="icon-trash"></i> ${Joomla.Text._("COM_COTTON_TRASH")}`;
            trashBtn.addEventListener('click', () => {
                this.#options.onTrashClick();
                this.#state.activeFolderId = -1;
                this.#setActiveTreeItem(this.#state.activeFolderId);
            });
            trashContainer.appendChild(trashBtn);

        }

        // Set active folder after render (only if there are nodes to highlight)
        if (this.#state.activeFolderId >= 0 && nodes.length > 0) {
            // Defer to next tick to ensure DOM is ready
            requestAnimationFrame(() => {
                this.#setActiveTreeItem(this.#state.activeFolderId);
            });
        }
    }

    destroy() {
        if (this.#container) {
            this.#container.innerHTML = '';
        }
    }
}

if (typeof window !== 'undefined') {
    window.CottonTree = CottonTree;
}