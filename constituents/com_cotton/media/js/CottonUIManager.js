/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

import { CottonAPI } from './CottonAPI.js';
import { CottonUXManager } from './CottonUXManager.js';
import { CottonStorage } from './CottonStorage.js';
import { CottonUploader } from './CottonUploader.js';
import { CottonModal, CottonModalManager } from './CottonModal.js';
import { CottonHelper } from './CottonHelper.js';
import { CottonMediaHandler } from './CottonMediaHandler.js';
import { CottonTree } from './CottonTree.js';
import { CottonTabs } from './CottonTabs.js';


// CottonUIManager - Orchestrates the main Cotton interface


export class CottonUIManager {
    #container = null;
    #options = {};
    #state = null;
    #components = {};
    #listeners = {};
    #tree = null;
    #modalManager = null;
    #statusTimeout = null;

    /**
     * Constructor
     * @param {string|HTMLElement} container - DOM selector or element
     * @param {Object} options - Settings
     *   @param {string} options.siteUrl - Base API URL
     *   @param {boolean} options.admin - Indicates if admin mode
     *   @param {string} options.token - Auth token
     *   @param {Function} options.onReady - Callback when loaded
     */
    constructor(container, options = {}) {
        if (typeof container === 'string') {
            this.#container = document.querySelector(container);
            this.#container.className = 'cotton-container';
        } else {
            this.#container = container;
            this.#container.className = 'cotton-container';
        }

        if (!this.#container) {
            throw new Error('[CottonUIManager] Container not found');
        }

        this.#options = {
            siteUrl: options.siteUrl || window.location.origin + '/',
            admin: options.admin || false,
            token: options.token || null,
            userName: options.userName || '',
            limits: options.limits || {},
            ux: parseInt(options.ux) || 0,
            onReady: options.onReady || null,
            pickMode: options.pickMode || false,
            uxManager: options.uxManager || null,
            ...options
        };

        if (this.#options.limits?.max_filesize && CottonUploader) {
            const safeChunk = Math.floor(this.#options.limits.max_filesize * 0.9);
            const maxChunk = 20 * 1024 * 1024; // 20MB max
            CottonUploader.setChunkSize(Math.min(safeChunk, maxChunk));
            CottonUploader.setMaxFileSize(this.#options.limits.cotton_max_filesize);
        }

        if (this.#options.limits && CottonUploader) {
            const limitSpace = this.#options.limits.limit_space || 0;
            const usedSpace = this.#options.limits.used_space || 0;
            const availableSpace = limitSpace > 0 ? Math.max(0, limitSpace - usedSpace) : Infinity;
            CottonUploader.setAvailableSpace(availableSpace);
        }

        // Initialize state
        this.#state = {
            treeData: options.treeData || null,
            itemsData: options.itemsData || null,
            activeFolderId: 0,
            activeItemId: null,
            config: {},
            viewMode: 'list',
            searchQuery: '',
            expandedFolders: new Set(),  // Stores expanded folder IDs
            itemSort: {
                field: 'name',
                direction: 'asc'
            }
        };

        // Initialize CottonAPI globally
        CottonAPI.init(this.#options.siteUrl, this.#options.admin, this.#options.token);
        
        // Initialize modal manager
        this.#modalManager = new CottonModalManager();

    }

    /**
     * Initializes the interface
     */
async initialize() {
        try {
            this.#renderUI();

            const container = this.#container;
            this.#options.uxManager = new CottonUXManager(null, {container});
            
            this.#tree = new CottonTree(this.#components.tree, {
                onFolderClick: (folder) => {
                    this.#loadItems(folder.id);
                },
                onFileClick: (file, rowElement) => {
                    this.#selectItem(file, rowElement);
                },
                onTrashClick: () => {
                    this.#loadTrash();
                },
                onFolderToggle: (folderId, expanded) => {
                    if (expanded) {
                        this.#state.expandedFolders.add(folderId);
                    } else {
                        this.#state.expandedFolders.delete(folderId);
                    }
                },
                showTrash: !this.#options.pickMode ? true : false,
                getIcon: (mimeType, opts) => CottonHelper.getMimeIcon(mimeType, opts),
                getPermissionIcon: (item) => CottonUIManager.getPermissionIcon(item)
            });
            
            // Ensure root folder (id=0) is expanded by default
            this.#state.expandedFolders.add(0);
            
            // Sync initial expanded folders state
            this.#tree.setExpandedFolders(Array.from(this.#state.expandedFolders));
            
            if (this.#state.treeData === null && this.#state.itemsData === null) {
                await this.#loadTreeFolders();
                await this.#loadItems(0);
            } else {
                this.#tree.render(this.#state.treeData);
                this.#renderItemsList();
            }
            this.#setViewMode(this.#state.viewMode);
            this.#attachEventListeners();
            if (this.#options.ux) this.#initUXManager();

            if (this.#options.onReady) {
                this.#options.onReady();
            }
        } catch (error) {
            this.#showError(Joomla.Text._('COM_COTTON_ERROR_INIT') + ': ' + error.message);
        }
    }

    /**
     * Renders HTML interface
     * @private
     */
    #renderUI() {

        const header = document.createElement('header');
        header.className = 'cotton-header';
        header.innerHTML = `<div class="cotton-header-title">${CottonHelper.getMimeIcon('folder', { size: 'fa-1x', colored: true })}<span>${Joomla.Text._('COM_COTTON_FILE_MANAGER')}</span><span>[ ${this.#options.userName} ]</span></div>
                            ${this.#options.ux ? '<div class="cotton-header-maximize"><i class="icon-expand-2" title="' + Joomla.Text._('COM_COTTON_MAXIMIZE_TOOLTIP') + '"></i></div>' : ''}`;

        const toolBar = document.createElement('nav');
        toolBar.className = 'cotton-toolbar';
        //TODO: Render butttons conditionally based on permissions/config
        toolBar.innerHTML = `<div>
                                <button type="button" class="btn btn-outline-secondary btn-sm active cotton-upload-btn" title="${Joomla.Text._('COM_COTTON_UPLOAD_FILE')}">
                                    <i class="icon-upload"></i> ${Joomla.Text._('COM_COTTON_UPLOAD')}
                                </button>
                                <button type="button" class="btn btn-outline-secondary btn-sm active cotton-create-folder-btn" title="${Joomla.Text._('COM_COTTON_CREATE_FOLDER')}">
                                    <i class="icon-new"></i> ${Joomla.Text._('COM_COTTON_CREATE_FOLDER')}
                                </button>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <input type="text" class="cotton-search-input" style="width: 200px;" placeholder="${Joomla.Text._('COM_COTTON_SEARCH_PLACEHOLDER')}">
                            </div>`;

        const pathBar = document.createElement('nav');
        pathBar.className = 'cotton-pathbar';
        pathBar.innerHTML = `<div>
                                <button type="button" class="btn btn-outline-secondary btn-sm cotton-refresh-btn active" title="${Joomla.Text._('COM_COTTON_REFRESH')}">
                                    <i class="icon-refresh"></i>
                                </button>
                             </div>
                             <div class="cotton-pathbar-path">
                                <input type="text" class="cotton-path-input" readonly disabled value="/">
                             </div>
                             <div>
                                <button type="button" class="btn btn-outline-secondary btn-sm cotton-view-list active" title="${Joomla.Text._('COM_COTTON_LIST_VIEW')}">
                                    <i class="icon-list"></i>
                                </button>
                                <button type="button" class="btn btn-outline-secondary btn-sm cotton-view-grid" title="${Joomla.Text._('COM_COTTON_GRID_VIEW')}">
                                    <i class="icon-grid"></i>
                                </button>
                                <button type="button" class="btn btn-outline-secondary btn-sm cotton-toggle-info-btn" title="${Joomla.Text._('COM_COTTON_TOGGLE_INFO_PANEL')}">
                                    <i class="icon-eye"></i>
                                </button>
                             </div>`;

        const mainContent = document.createElement('section');
        mainContent.className = 'cotton-main';

        const folderTree = document.createElement('aside');
        folderTree.className = 'cotton-tree';
        folderTree.innerHTML = `<div class="cotton-folder-tree"></div>
                                <div class="cotton-trash"></div>`;

        const contentArea = document.createElement('section');
        contentArea.className = 'cotton-items-container';
        contentArea.innerHTML = `<div id="cotton-items-status" class="cotton-items-status"></div>`;
        
        const itemInfo = document.createElement('aside');
        itemInfo.className = 'cotton-item-info-container';
        itemInfo.style.display = 'none';

        mainContent.appendChild(folderTree);
        mainContent.appendChild(contentArea);
        mainContent.appendChild(itemInfo);

        const footer = document.createElement('footer');
        footer.className = 'cotton-footer';
        footer.innerHTML = `
            <div id="cotton-footer-space" class="cotton-footer-space"></div>
            <div id="cotton-footer-items" class="cotton-items-count">0 ${Joomla.Text._('COM_COTTON_ITEMS')}</div>
        `;

        if (!this.#options.pickMode) this.#container.appendChild(header);
        this.#container.appendChild(toolBar);
        this.#container.appendChild(pathBar);
        this.#container.appendChild(mainContent);
        if (!this.#options.pickMode) this.#container.appendChild(footer);
        
        // References to elements
        this.#components = {
            header: this.#container.querySelector('.cotton-header'),
            maximize: this.#container.querySelector('.cotton-header-maximize'),
            tree: this.#container.querySelector('.cotton-tree'),
            trash: this.#container.querySelector('.cotton-trash'),
            items: this.#container.querySelector('.cotton-items-container'),
            searchInput: this.#container.querySelector('.cotton-search-input'),
            itemsCount: this.#container.querySelector('#cotton-footer-items'),
            status: this.#container.querySelector('#cotton-items-status'),
            spaceInfo: this.#container.querySelector('#cotton-footer-space'),
            pathInput: this.#container.querySelector('.cotton-path-input'),
            info: this.#container.querySelector('.cotton-item-info-container')
        };
        this.#resetPanelItemInfo();
        this.#updateSpaceInfo();
    }

    /**
     * Attaches event listeners
     * @private
     */
    #attachEventListeners() {
        // Header action buttons
        this.#container.querySelector('.cotton-upload-btn')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.style.display = 'none';

            const handler = () => {
                const files = this.#normalizeFiles(input.files);
                if (files.length > 0) {
                    this.showUploadModal(files);
                }
                input.removeEventListener('change', handler);
                document.body.removeChild(input);
            };

            input.addEventListener('change', handler);
            document.body.appendChild(input);
            input.click();
        });

        this.#container.querySelector('.cotton-create-folder-btn')?.addEventListener('click',
            () => this.#handleCreateFolder()
        );

        this.#container.querySelector('.cotton-refresh-btn')?.addEventListener('click',
            () => this.#handleRefresh()
        );

        this.#container.querySelector('.cotton-toggle-info-btn')?.addEventListener('click', () => {
            const panel = this.#components.info;
            if (!panel) return;
            const hidden = panel.style.display === 'none';
            if (hidden) {
                panel.style.display = '';
                this.#container.querySelector('.cotton-toggle-info-btn')?.classList.add('active');
            } else {
                panel.style.display = 'none';
                this.#container.querySelector('.cotton-toggle-info-btn')?.classList.remove('active');
            }
        });

        // View buttons (list/grid)
        this.#container.querySelector('.cotton-view-list')?.addEventListener('click', (e) => {
            this.#container.querySelector('.cotton-view-list')?.classList.add('active');
            this.#container.querySelector('.cotton-view-grid')?.classList.remove('active');
            this.#setViewMode('list');
        });

        this.#container.querySelector('.cotton-view-grid')?.addEventListener('click', (e) => {
            this.#container.querySelector('.cotton-view-grid')?.classList.add('active');
            this.#container.querySelector('.cotton-view-list')?.classList.remove('active');
            this.#setViewMode('grid');
        });

        // Search
        this.#components.searchInput?.addEventListener('input', (e) => {
            this.#state.searchQuery = e.target.value;
            this.#renderItemsList();
        });
        
        if (this.#options.ux) {
            this.#components.maximize?.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                this.#options.uxManager?.toggleMaximize(this.#container);
            });

            this.#components.header?.addEventListener('dblclick', event => {
                event.preventDefault();
                event.stopPropagation();
                this.#options.uxManager?.toggleMaximize(this.#container);
            });
        }

        // Storage listeners
        CottonStorage.onStateChange('foldersSet', () => {
            this.#renderItemsList();
        });
        CottonStorage.onStateChange('filesSet', () => {
             if (this.#tree) {
                 this.#tree.render(this.#state.treeData);
             }
         });
    }

    #initUXManager() {
        const uxManager = this.#options.uxManager;

        if (!uxManager) {
            return;
        }

        const header = this.#components.header;
        const tree = this.#components.tree;
        const info = this.#components.info;
        const dropZone = this.#components.items;

        if (!this.#options.pickMode) {
            uxManager.addDraggable({
                id: 'cotton-header-drag',
                handle: header,
                target: this.#container,
                position: 'fixed'
            });
        }

        uxManager.addResizable({
            id: 'cotton-tree-resize',
            target: tree,
            edges: ['right'],
            minWidth: 160,
            maxWidth: 600
        });

        uxManager.addResizable({
            id: 'cotton-info-resize',
            target: info,
            edges: ['right'],
            handleSide: 'left',
            minWidth: 160,
            maxWidth: 600
        });

        if (!this.#options.pickMode) {
            uxManager.addResizable({
                id: 'cotton-container-resize',
                target: this.#container,
                edges: ['top', 'right', 'bottom', 'left'],
                minWidth: 320,
                minHeight: 240,
                position: 'fixed'
            });
        }

        uxManager.addDropUpload({
            id: 'cotton-items-drop-upload',
            dropZone,
            manager: this
        });
    }

    #setActiveItem(row, itemId) {
         if (this.#components.items) {
             this.#components.items.querySelectorAll('.cotton-row-active').forEach(el => el.classList.remove('cotton-row-active'));
             this.#components.items.querySelectorAll('.cotton-item-card-active').forEach(el => el.classList.remove('cotton-item-card-active'));
         }
         this.#state.activeItemId = itemId;
         if (row) {
             const isCard = row.classList.contains('cotton-item-card');
             const isTreeFile = row.classList.contains('cotton-tree-file-row');
             if (isCard) {
                 row.classList.add('cotton-item-card-active');
             } else if (!isTreeFile) {
                 row.classList.add('cotton-row-active');
             }
         }
         if (this.#container.querySelector('.cotton-toggle-info-btn')?.classList.contains('active')) {
             this.#components.info.style.display = '';
         }
     }

    #resetPanelItemInfo() {
        const panel = this.#components.info;
        if (!panel) return;

        panel.innerHTML = `
            <div class="cotton-file-info-panel">
                <div class="cotton-file-info-icon">${CottonHelper.getMimeIcon('folder', { size: 'fa-2x', colored: true })}</div>
                <div class="cotton-file-info-name">${Joomla.Text._('COM_COTTON_NO_ITEM')}</div>
                <div class="cotton-file-info-details">
                    <span style="font-size: small;">${Joomla.Text._('COM_COTTON_SELECT_ITEM_INFO')}</span>
                </div>
            </div>
        `;
    }

    #updateSpaceInfo() {
        const spaceInfo = this.#components.spaceInfo;
        if (!spaceInfo) return;

        const limits = this.#options.limits || {};
        const limitSpace = limits.limit_space || 0;
        const usedSpace = limits.used_space || 0;

        if (limitSpace > 0) {
            const available = Math.max(0, limitSpace - usedSpace);
            spaceInfo.textContent = `${CottonHelper.formatSize(usedSpace)} / ${CottonHelper.formatSize(limitSpace)}`;
            spaceInfo.title = `${Joomla.Text._('COM_COTTON_USED_SPACE') || 'Used'}: ${CottonHelper.formatSize(usedSpace)}\n${Joomla.Text._('COM_COTTON_LIMIT_SPACE') || 'Limit'}: ${CottonHelper.formatSize(limitSpace)}\n${Joomla.Text._('COM_COTTON_AVAILABLE_SPACE') || 'Available'}: ${CottonHelper.formatSize(available)}`;
        } else {
            spaceInfo.textContent = `${CottonHelper.formatSize(usedSpace)} / \u221E`;
            spaceInfo.title = `${Joomla.Text._('COM_COTTON_USED_SPACE') || 'Used'}: ${CottonHelper.formatSize(usedSpace)}`;
        }
    }

    /**
     * Sets view mode
     * @private
     */
    #setViewMode(mode) {
        this.#state.viewMode = mode;
        const container = this.#components.items;
        
        const table = container.querySelector('.cotton-items-table');
        const grid = container.querySelector('.cotton-items-grid');
        
        if (mode === 'grid') {
            if (table) table.style.display = 'none';
            if (grid) grid.style.display = '';
        } else {
            if (grid) grid.style.display = 'none';
            if (table) table.style.display = '';
        }
    }

    /**
     * Handles file upload
     * @private
     */
    async #handleUpload(files = null) {
        try {
            if (this.#state.activeFolderId < 0) {
                this.#showError('Cannot upload files to trash');
                return null;
            }

            const folderId = this.#state.activeFolderId || 0;
            const filesToUpload = this.#normalizeFiles(files);
            const hasPreSelectedFiles = filesToUpload.length > 0;

            if (!hasPreSelectedFiles) {
                this.#showError('No files selected for upload');
                return null;
            }

            const modal = this.openModal({
                title: 'Upload Files',
                icon: CottonHelper.getMimeIcon('folder-open', { size: 'fa-1x', colored: true }),
                width: '400px',
                height: hasPreSelectedFiles ? 'auto' : '280px',
                body: `<div id="upload-files-list"></div>`,
                showFooter: true,
                showSubmit: false,
                cancelText: Joomla.Text._('COM_COTTON_CANCEL'),
                onCancel: async () => {
                    CottonUploader.cancelAllUploads();
                    modal.close();
                }
            });
            
            const targetFolderId = folderId;
            await this.#startUploads(filesToUpload, targetFolderId, modal);
            
            return modal;

        } catch (error) {
            this.#showError(Joomla.Text._('COM_COTTON_ERROR_UPLOAD') + ': ' + error.message);
            return null;
        }
    }

    async #startUploads(files, targetFolderId, modal) {
        const container = modal.getElement();
        const filesList = container.querySelector('#upload-files-list');
        if (!filesList) return;

        const results = [];
        const failed = [];
        let completed = 0;
        const MAX_PARALLEL = 3;

        const fileElements = files.map((file) => {
            const item = document.createElement('div');
            item.className = 'upload-file-item';
            item.innerHTML = `
                <div class="upload-file-name">${CottonHelper.escapeHtml(file.name)}</div>
                <div class="upload-file-progress">
                    <div class="upload-file-progress-fill" style="width: 0%;"></div>
                </div>
                <div class="upload-file-status">
                    <span class="upload-file-percent">0%</span>
                    <span class="upload-file-finalizing" style="display: none;">
                        <div class="spinner-border spinner-border-sm text-primary" role="status">
                            <span class="visually-hidden">Finalizing</span>
                        </div>
                        <span>Finalizing</span>
                    </span>
                        <span class="upload-file-ready" style="display: none; color: var(--cot-green); font-size: 0.75rem; font-weight: 600;">Ready</span>
                </div>
            `;
            filesList.appendChild(item);

            return {
                file,
                fill: item.querySelector('.upload-file-progress-fill'),
                percentText: item.querySelector('.upload-file-percent'),
                finalizing: item.querySelector('.upload-file-finalizing'),
                readyText: item.querySelector('.upload-file-ready')
            };
        });

        let currentIndex = 0;

        const worker = async () => {
            while (currentIndex < fileElements.length) {
                const index = currentIndex++;
                const { file, fill, percentText, finalizing, readyText } = fileElements[index];
                let finalized = false;

                try {
                    const result = await CottonUploader.uploadFile(file, targetFolderId, (progress) => {
                        if (fill) fill.style.width = `${Math.min(progress, 100)}%`;
                        if (percentText) percentText.textContent = `${Math.round(progress)}%`;
                        if (progress >= 100 && !finalized && finalizing) {
                            finalizing.style.display = 'inline-flex';
                        }
                    });

                    results.push(result);
                    finalized = true;
                    completed++;
                    if (percentText) percentText.textContent = '100%';
                    if (finalizing) finalizing.style.display = 'none';
                    if (readyText) readyText.style.display = 'inline';
                } catch (error) {
                    if (error.message === 'Upload cancelled') {
                        throw error;
                    }
                    console.error('Error uploading:', file.name, error);
                    failed.push(`${file.name}: ${error.message}`);
                    completed++;
                    if (fill) fill.style.width = '0%';
                    if (percentText) percentText.textContent = 'Upload error:' + error.message;
                }
            }
        };

        const workers = [];
        for (let i = 0; i < Math.min(MAX_PARALLEL, fileElements.length); i++) {
            workers.push(worker());
        }

        await Promise.all(workers);

        if (failed.some(item => item.includes('Upload cancelled'))) {
            return;
        }

        if (completed > 0 && results.length > 0) {
            for (const result of results) {
                if (result?.fileId) {
                    try {
                        await CottonAPI.finalizeUpload(result.fileId);
                    } catch (finalizeError) {
                        console.error('[CottonUIManager] Erro ao finalizar upload:', finalizeError);
                    }
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        if (completed > 0) {
            await this.#loadItems(targetFolderId);
            modal.close();
            this.#showSuccess(`${completed}/${files.length} ${Joomla.Text._('COM_COTTON_FILE_UPLOADED')}`);
            this.#updateSpaceInfo();
        }

        if (failed.length > 0) {
            const details = failed.slice(0, 3).map(item => CottonHelper.escapeHtml(item)).join(', ');
            const suffix = failed.length > 3 ? `<br>... ${Joomla.Text._('COM_COTTON_MORE_FILES').replace('{count}', failed.length - 3)}` : '';
            this.#showError(`${Joomla.Text._('COM_COTTON_UPLOAD_FAILED').replace('{count}', failed.length)}: ${details}${suffix}`);
        }
    }

    showUploadModal(files = null) {
        return this.#handleUpload(files);
    }

    #normalizeFiles(files) {
        if (!files) {
            return [];
        }

        if (typeof FileList !== 'undefined' && files instanceof FileList) {
            return Array.from(files);
        }

        if (typeof File !== 'undefined' && files instanceof File) {
            return [files];
        }

        if (Array.isArray(files)) {
            return files.filter(file => typeof File === 'undefined' || file instanceof File);
        }

        return [];
    }

    /**
     * Handles folder creation
     * @private
     */
    async #handleCreateFolder() {
        // Use existing create folder modal
        this.showCreateFolderModal();
    }

    /**
     * Handles refresh
     * @private
     */
    async #handleRefresh() {
        try {
            if (this.#state.activeFolderId === -1) {
                await this.#loadTrash();
            } else {
                await this.#loadItems(this.#state.activeFolderId);
            }
            this.#showSuccess(Joomla.Text._('COM_COTTON_REFRESH_SUCCESS'));
        } catch (error) {
            this.#showError(Joomla.Text._('COM_COTTON_ERROR_LOAD_FOLDER') + ': ' + error.message);
        }
    }

    /**
     * Updates the folder tree list
     * @private
     */
async #loadTreeFolders() {
        try {
            const folders = await CottonAPI.loadTree();
            this.#state.treeData = folders || [];
            CottonStorage.setTreeFolders(this.#state.treeData?.tree || []);
            this.#tree.render(this.#state.treeData);
        } catch (error) {
            console.error('[CottonUIManager] Error updating folder tree:', error);
            this.#showError(Joomla.Text._('COM_COTTON_ERROR_LOAD_FOLDER') + ': ' + error.message);
        }
    }

    /**
     * Loads folder
     * @private
     */
    async #loadItems(folderId) {
         try {
             this.#state.activeItemId = null;
             this.#resetPanelItemInfo();
             const infoBtnActive = this.#container.querySelector('.cotton-toggle-info-btn')?.classList.contains('active');
             if (!infoBtnActive) {
                 this.#components.info.style.display = 'none';
             } else {
                 this.#components.info.style.display = '';
             }
             const data = await CottonAPI.loadItems(folderId);
            this.#state.activeFolderId = folderId;
            this.#emit('folder:selected', {
                id: folderId,
                path: data?.path_folder || '/'
            });

            if (data.n_folders !== undefined && Array.isArray(data.folders) && 'n_files' in data) {
                this.#state.itemsData = data;
                this.#options.limits = data.limits || this.#options.limits;
            }

            CottonStorage.sync(data);
            this.#renderItemsList();
            this.#updatePathInput();
            this.#updateSpaceInfo();
            this.#setViewMode(this.#state.viewMode);
        } catch (error) {
            console.error('[CottonUIManager] Error loading folder:', error);
            this.#showError(Joomla.Text._('COM_COTTON_ERROR_LOAD_FOLDER') + ': ' + error.message);
        }
    }

    #updatePathInput() {
        if (!this.#components.pathInput) return;

        if (this.#state.activeFolderId === -1) {
            this.#components.pathInput.value = Joomla.Text._('COM_COTTON_TRASH');
        } else {
            this.#components.pathInput.value = this.#state.itemsData?.path_folder ? ('/' + this.#state.itemsData?.path_folder + '/') : '/';
        }
    }

    /**
     * Loads trash
     * @private
     */
    async #loadTrash() {
         try {
             this.#state.activeItemId = null;
             this.#resetPanelItemInfo();
             const infoBtnActive = this.#container.querySelector('.cotton-toggle-info-btn')?.classList.contains('active');
             if (!infoBtnActive) {
                 this.#components.info.style.display = 'none';
             } else {
                 this.#components.info.style.display = '';
             }
             const data = await CottonAPI.loadTrash();
            this.#state.activeFolderId = -1;  // -1 indicates trash mode
            this.#emit('folder:selected', {
                id: -1,
                path: Joomla.Text._('COM_COTTON_TRASH')
            });
            
            if (data.n_folders_trash !== undefined && Array.isArray(data.folders_trash) && Array.isArray(data.files_trash)) {
                this.#state.itemsData = {
                    n_folders: data.n_folders_trash,
                    folders: data.folders_trash,
                    n_files: data.n_files_trash,
                    files: data.files_trash,
                    n: (data.n_folders_trash || 0) + (data.n_files_trash || 0)
                };
            } else {
                this.#state.itemsData = {
                    folders: data.folders_trash || [],
                    files: data.files_trash || []
                };
            }
            CottonStorage.sync(data);
            this.#renderItemsList();
            this.#setViewMode(this.#state.viewMode);
            this.#updatePathInput();
            this.#updateSpaceInfo();
        } catch (error) {
            console.error('[CottonUIManager] Error loading trash:', error);
            this.#showError(Joomla.Text._('COM_COTTON_ERROR_LOAD_TRASH') + ': ' + error.message);
        }
    }

    /**
     * Renders folders and files list
     * @private
     */
    #renderItemsList() {
        const container = this.#components.items;
        const status = this.#components.status;

        container.innerHTML = '';
        if (status) {
            container.appendChild(status);
        }

        const folders = this.#filterItems(this.#state.itemsData?.folders || [], this.#state.searchQuery);
        const files = this.#filterItems(this.#state.itemsData?.files || [], this.#state.searchQuery);

        const isTrashMode = this.#state.activeFolderId === -1;
        const hasActiveSearch = this.#state.searchQuery.trim().length > 0;

        const totalFolders = folders.length;
        const totalFiles = files.length;
        const totalItems = totalFolders + totalFiles;

        if (this.#components.itemsCount) {
            const parts = [];
            if (totalFolders > 0) parts.push(`${totalFolders} ${totalFolders === 1 ? Joomla.Text._('COM_COTTON_FOLDER') : Joomla.Text._('COM_COTTON_FOLDERS')}`);
            if (totalFiles > 0) parts.push(`${totalFiles} ${totalFiles === 1 ? Joomla.Text._('COM_COTTON_FILE') : Joomla.Text._('COM_COTTON_FILES')}`);
            this.#components.itemsCount.textContent = parts.length > 0 ? parts.join(', ') : `0 ${Joomla.Text._('COM_COTTON_ITEMS')}`;
        }

        if (totalItems === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <span>${hasActiveSearch ? `${Joomla.Text._('COM_COTTON_NO_ITEMS_SEARCH')} "${CottonHelper.escapeHtml(this.#state.searchQuery.trim())}"` : (isTrashMode ? Joomla.Text._('COM_COTTON_NO_ITEMS_TRASH') : Joomla.Text._('COM_COTTON_NO_ITEMS_FOLDER'))}</span>
                </div>
            `;
            if (status) {
                container.appendChild(status);
            }
            return;
        }

            container.appendChild(this.#createTableItems(folders, files, isTrashMode));
            container.appendChild(this.#createGridItems(folders, files, isTrashMode));

        this.#setViewMode(this.#state.viewMode);

    }

    #createTableItems(folders, files, isTrashMode) {
        const table = document.createElement('table');
        table.className = 'cotton-items-table';

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th data-sort="name">${this.#buildSortHeader(Joomla.Text._('COM_COTTON_COLUMN_NAME'), 'name')}</th>
                <th data-sort="size">${this.#buildSortHeader(Joomla.Text._('COM_COTTON_COLUMN_SIZE'), 'size')}</th>
                <th data-sort="date">${this.#buildSortHeader(Joomla.Text._('COM_COTTON_COLUMN_MODIFIED'), 'date')}</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        const sortedFolders = this.#sortItems(folders, this.#getCurrentSortField(), this.#getCurrentSortDirection());
        const sortedFiles = this.#sortItems(files, this.#getCurrentSortField(), this.#getCurrentSortDirection());

        sortedFolders.forEach(folder => {
            tbody.appendChild(this.#createItemRow(folder, 'folder', isTrashMode));
        });

        sortedFiles.forEach(file => {
            tbody.appendChild(this.#createItemRow(file, 'file', isTrashMode));
        });

        table.appendChild(tbody);
        this.#bindTableEvents(table, isTrashMode);
        return table;
    }

    #createGridItems(folders, files, isTrashMode) {
        const grid = document.createElement('div');
        grid.className = 'cotton-items-grid';

        const sortedFolders = this.#sortItems(folders, this.#getCurrentSortField(), this.#getCurrentSortDirection());
        const sortedFiles = this.#sortItems(files, this.#getCurrentSortField(), this.#getCurrentSortDirection());

        const renderCard = (item, type) => {
            const card = document.createElement('div');
            card.className = 'cotton-item-card';
            if (this.#state.activeItemId === item.id) {
                card.classList.add('cotton-item-card-active');
            }
            card.dataset.itemType = type;
            card.dataset[type === 'folder' ? 'folderId' : 'fileId'] = item.id;

            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'cotton-item-card-icon-wrapper';
            const icon = document.createElement('div');
            icon.className = 'cotton-item-card-icon';
            icon.innerHTML = type === 'folder'
                ? CottonHelper.getMimeIcon('folder', { size: 'fa-2x', colored: true })
                : this.#getMimeIcon( this.#getMimeTypeForFile(item), { size: 'fa-2x', colored: true });
            iconWrapper.appendChild(icon);

            const name = document.createElement('div');
            name.className = 'cotton-item-card-name';
            name.textContent = CottonHelper.truncateName(item.name);
            name.title = item.name;

            card.appendChild(iconWrapper);
            card.appendChild(name);

            const actionsWrap = document.createElement('div');
            actionsWrap.className = 'cotton-item-card-actions';
            actionsWrap.appendChild(this.#renderItemActions(type, item, isTrashMode, this.#getMimeTypeForFile(item)));
            card.appendChild(actionsWrap);

            card.addEventListener('click', (e) => {
                e.stopPropagation();
                this.#selectItem(item, card);
            });

            if (type === 'folder') {
                card.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                        if (!isTrashMode) {
                            this.#loadItems(item.id);
                        }
                });
            
             } else {
                if (!this.#options.pickMode || this.#options.pickMode === 'file') {
                    card.addEventListener('dblclick', async (e) => {
                        e.stopPropagation();
                        if (this.#options.pickMode === 'file') {
                                this.#emit('file:doubleClicked', item);
                            } else {
                                this.#selectItem(item, card);
                                try {
                                    await this.#handleItemOpen(item);
                                } catch (error) {
                                    console.error('[CottonUIManager] Erro ao abrir arquivo (duplo clique card):', error);
                                    this.#showError('Erro ao abrir arquivo: ' + error.message);
                                }
                            }
                    });
                }
            }

            return card;
        };

        sortedFolders.forEach(folder => {
            grid.appendChild(renderCard(folder, 'folder'));
        });

        sortedFiles.forEach(file => {
            grid.appendChild(renderCard(file, 'file'));
        });

        return grid;
    }

    #buildSortHeader(label, field) {
        const icon = this.#getSortIcon(field);
        return `${label} <span class="cotton-sort-icon">${icon}</span>`;
    }

    #renderItemActions(type, item, isTrashMode, mimeType = 'application/octet-stream') {
        const wrap = document.createElement('div');
        wrap.className = 'cotton-item-actions';

        if (isTrashMode) {
            const restoreBtn = document.createElement('button');
            restoreBtn.type = 'button';
            restoreBtn.className = `btn btn-outline-secondary btn-sm active cotton-btn-restore-${type}`;
            restoreBtn.title = Joomla.Text._('COM_COTTON_RECOVER');
            restoreBtn.innerHTML = '<i class="fa-solid fa-trash-arrow-up"></i>';
            restoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (type === 'folder') {
                    this.showRestoreFolderModal(item);
                } else {
                    this.showRestoreFileModal(item);
                }
            });
            wrap.appendChild(restoreBtn);

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = `btn btn-outline-danger btn-sm active cotton-btn-delete-${type}`;
            delBtn.title = Joomla.Text._('COM_COTTON_DELETE_PERMANENTLY');
            delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            delBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (type === 'folder') {
                    this.showDeletePermanentFolderModal(item);
                } else {
                    this.showDeletePermanentFileModal(item);
                }
            });
            wrap.appendChild(delBtn);
            return wrap;
        }

        if (type === 'folder') {

            const propsBtn = document.createElement('button');
            propsBtn.type = 'button';
            propsBtn.className = 'btn btn-outline-secondary btn-sm active';
            propsBtn.title = Joomla.Text._('COM_COTTON_EDIT');
            propsBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
            propsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showEditFolderModal(item);
            });
            wrap.appendChild(propsBtn);

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn-outline-danger btn-sm active';
            delBtn.title = Joomla.Text._('COM_COTTON_DELETE');
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showDeleteFolderModal(item);
            });
            wrap.appendChild(delBtn);
            return wrap;
        }

        const propsBtn = document.createElement('button');
        propsBtn.type = 'button';
        propsBtn.className = 'btn btn-outline-secondary btn-sm active';
        propsBtn.title = Joomla.Text._('COM_COTTON_PROPERTIES');
        propsBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
        propsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showEditFileModal(item);
        });
        wrap.appendChild(propsBtn);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn-outline-secondary btn-sm active';
        copyBtn.title = Joomla.Text._('COM_COTTON_COPY_LINK');
        copyBtn.innerHTML = '<i class="fa-solid fa-link"></i>';
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.#copyLink(item);
        });
        wrap.appendChild(copyBtn);

        const downloadBtn = document.createElement('button');
        downloadBtn.type = 'button';
        downloadBtn.className = 'btn btn-outline-secondary btn-sm active cotton-btn-download';
        downloadBtn.title = Joomla.Text._('COM_COTTON_DOWNLOAD');
        downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i>';
        downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.#downloadFile(item);
        });
        wrap.appendChild(downloadBtn);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-outline-danger btn-sm active';
        delBtn.title = Joomla.Text._('COM_COTTON_DELETE');
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showDeleteFileModal(item);
        });
        wrap.appendChild(delBtn);

        return wrap;
    }

    #createItemRow(item, type, isTrashMode) {
        const row = document.createElement('tr');
        row.className = `cotton-row-${type}`;
        if (this.#state.activeItemId === item.id) {
            row.classList.add('cotton-row-active');
        }
        row.dataset.itemType = type;
        row.dataset[type === 'folder' ? 'folderId' : 'fileId'] = item.id;

        const nameCell = document.createElement('td');
        nameCell.className = 'cotton-col-name';

        let mimeType = 'application/octet-stream';
        if (type === 'folder') {
            const permIcon = this.getPermissionIcon(item);
            nameCell.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <div>${CottonHelper.getMimeIcon('folder', { size: 'fa-lg', colored: true })}${permIcon}</div>
                    <div class="flex-grow-1">
                        <div class="cotton-folder-name" title="${CottonHelper.escapeHtml(item.name)}">${CottonHelper.escapeHtml(CottonHelper.truncateName(item.name))}</div>
                    </div>
                </div>
            `;

            row.addEventListener('click', (e) => {
                e.stopPropagation();
                this.#selectItem(item, row);
            });

            row.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (!isTrashMode) {
                    this.#loadItems(item.id);
                }
            });
        } else {
            const ext = CottonHelper.getExtension(item.name);
            mimeType = typeof this.#getMimeTypeForFile(item) === 'string' ? this.#getMimeTypeForFile(item) : CottonHelper.extensionToMime(ext);
            const permIcon = this.getPermissionIcon(item);

            nameCell.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <div>${this.#getMimeIcon(mimeType, { size: 'fa-lg', colored: true })}${permIcon}</div>
                    <div class="flex-grow-1">
                        <div class="cotton-file-name" title="${CottonHelper.escapeHtml(item.name)}">${CottonHelper.escapeHtml(CottonHelper.truncateName(item.name))}</div>
                    </div>
                </div>
            `;

            row.addEventListener('click', (e) => {
                e.stopPropagation();
                this.#selectItem(item, row);
            });

            if (!this.#options.pickMode || this.#options.pickMode === 'file') {
                row.addEventListener('dblclick', async (e) => {
                    e.stopPropagation();
                    if (this.#options.pickMode === 'file') {
                            this.#emit('file:doubleClicked', item);
                    } else {
                        this.#selectItem(item, row);
                        try {
                            await this.#handleItemOpen(item);
                        } catch (error) {
                            console.error('[CottonUIManager] Erro ao abrir arquivo (duplo clique):', error);
                            this.#showError('Erro ao abrir arquivo: ' + error.message);
                        }
                    }
                });
            }
        }

        const sizeCell = document.createElement('td');
        sizeCell.className = 'cotton-col-size';
        if (type === 'folder') {
            const folderCount = (item.n_folders || 0) + (item.n_files || 0);
            const sizeText = folderCount > 0 ? `${item.n_folders || 0} folder${((item.n_folders || 0) !== 1 ? 's' : '')}, ${item.n_files || 0} file${((item.n_files || 0) !== 1 ? 's' : '')}` : 'Empty';
            sizeCell.textContent = sizeText;
        } else {
            sizeCell.textContent = CottonHelper.formatSize(this.#getFileSize(item));
        }

        const dateCell = document.createElement('td');
        dateCell.className = 'cotton-col-date';

        const dateWrapper = document.createElement('div');
        dateWrapper.className = 'cotton-date-wrapper';
        const dateText = document.createElement('span');
        dateText.textContent = CottonHelper.formatDate(item.date_updated || item.date_created);
        dateWrapper.appendChild(dateText);
        dateWrapper.appendChild(this.#renderItemActions(type, item, isTrashMode, mimeType));
        dateCell.appendChild(dateWrapper);

        row.appendChild(nameCell);
        row.appendChild(sizeCell);
        row.appendChild(dateCell);

        return row;
    }

    #bindTableEvents(table, isTrashMode) {
        table.querySelectorAll('thead th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                this.#toggleSort(th.dataset.sort);
            });
        });
    }

    /**
     * Handles item opening on double click
     * @private
     */
    async #handleItemOpen(item) {
        const mimeType = this.#getMimeTypeForFile(item);
        const ext = CottonHelper.getExtension(item.name);

        if (CottonHelper.isEditable(mimeType) || ['txt','md','js','json','css','html','php','ini','xml','yaml','yml'].includes(ext)) {
            const url = `${this.#options.siteUrl}index.php?option=com_weaver&view=weaver&file_id=${item.id}`;
            window.open(url, '_blank');
            return;
        }

        if (CottonHelper.isPreviewable(mimeType)) {
            await this.#openMediaViewer(item);
            return;
        }

            const modal = this.openModal({
                title: Joomla.Text._('COM_COTTON_ITEM_NOT_OPENABLE'),
                icon: CottonHelper.getMimeIcon('folder-open', { size: 'fa-1x', colored: true }),
                width: '400px',
                height: '240px',
                body: `<p>${Joomla.Text._('COM_COTTON_NO_APP_FOR_FILE').replace('{name}', CottonHelper.escapeHtml(item.name))}</p>`,
                showFooter: true,
                showCancel: false,
                showSubmit: true,
                submitText: Joomla.Text._('COM_COTTON_OK'),
                onSubmit: () => modal.close()
            });
    }
    async #openMediaViewer(file) {
        const mimeType = this.#getMimeTypeForFile(file);
        const previewType = CottonHelper.getPreviewType(mimeType);
        const fileUrl = `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.open&file_id=${file.id}`;

        let mediaContent = '';
        let mediaHandler = null;

        if (previewType === 'pdf') {
            mediaContent = `
                <div class="cotton-media-viewer-content" style="height: 70vh;">
                    <iframe src="${fileUrl}"
                            class="cotton-preview-pdf"
                            style="width: 100%; height: 100%; border: none; border-radius: 4px;"
                            title="${CottonHelper.escapeHtml(file.name)}">
                    </iframe>
                </div>
            `;
        } else if (['video', 'audio', 'image'].includes(previewType)) {
            try {
                mediaHandler = new CottonMediaHandler(file.id, mimeType, file.name, {
                    autoPlay: false,
                    quality: 'auto',
                    muted: previewType === 'video',
                    loop: false
                });

                mediaHandler.on('loaded', null);
                mediaHandler.on('error', (error) => console.error('[CottonMediaHandler] Error:', error));

                const mediaElement = await mediaHandler.createMediaElement();
                mediaContent = `
                    <div class="cotton-media-viewer-content ${previewType === 'audio' ? 'text-center py-4' : ''}" style="max-height: 70vh; overflow: auto;">
                        ${mediaElement.outerHTML}
                    </div>
                `;
            } catch (error) {
                mediaContent = `
                    <div class="cotton-media-viewer-content text-center py-5">
                        ${CottonHelper.getMimeIcon(mimeType, { size: 'fa-4x', colored: true })}
                        <p class="mt-3 text-danger">Error loading preview: ${CottonHelper.escapeHtml(error.message)}</p>
                    </div>
                `;
                mediaHandler = null;
            }
        } else {
            mediaContent = `
                <div class="cotton-media-viewer-content text-center py-5">
                    ${CottonHelper.getMimeIcon(mimeType, { size: 'fa-4x', colored: true })}
                    <p class="mt-3 text-muted">Preview not available for this file type.</p>
                </div>
            `;
        }

        const modal = this.openModal({
            title: `${CottonHelper.escapeHtml(file.name)}`,
            icon: '<i class="icon-eye"></i>',
            width: '800px',
            height: 'auto',
            body: `
                <div class="cotton-media-viewer">
                    ${mediaContent}
                </div>
            `,
            showFooter: true,
            showSubmit: false,
            showCancel: true,
            cancelText: Joomla.Text._('COM_COTTON_CLOSE'),
            onCancel: () => modal.close(),
            onClose: () => {
                if (mediaHandler) {
                    mediaHandler.destroy();
                    mediaHandler = null;
                }
            }
        });
    }

    /**
     * Copia link do arquivo
     * @private
     */
    async #copyLink(file) {
        try {
            const link = `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.open&file_id=${file.id}&format=raw`;
            await navigator.clipboard.writeText(link);
            this.#showSuccess('Link copied to clipboard!');
        } catch (err) {
            this.#showError('Error copying link');
        }
    }

    /**
     * Filters items by name, description, path, or extension
     * @private
     */
    #filterItems(items, query) {
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return items;
        }

        return items.filter(item => this.#matchesSearch(item, normalizedQuery));
    }

    #matchesSearch(item, normalizedQuery) {
        const searchableText = [
            item.name,
            item.description,
            item.path,
            item.path_folder,
            item.type,
            item.extension,
            CottonHelper.getExtension(item.name)
        ].filter(Boolean).join(' ').toLowerCase();

        return searchableText.includes(normalizedQuery);
    }

    /**
     * Selects file
     * @private
     */
async #selectItem(item, rowElement = null) {
         this.#setActiveItem(rowElement, item.id);
         this.#emit('file:selected', {file: item, pickMode: this.#options.pickMode});

          // Render info
         await this.#renderFileInfo(item);

     }

    /**
     * Renders item information (file or folder)
     * @private
     */
    async #renderFileInfo(item) {
        const panel = this.#components.info;
        const isFolder = item.n_folders !== undefined || item.n_files !== undefined || item.type === 'folder';
        const icon = this.#getMimeIcon(isFolder ? 'folder' : this.#getMimeTypeForFile(item), { size: 'fa-2x', colored: true });

        const sizeInfo = isFolder 
            ? `${item.n_folders || 0} folder${(item.n_folders || 0) !== 1 ? 's' : ''}, ${item.n_files || 0} file${(item.n_files || 0) !== 1 ? 's' : ''}`
            : this.#formatSize(item.size);

        panel.innerHTML = `
            <div class="cotton-file-info-panel">
                <div class="cotton-file-info-icon">${icon}</div>
                <div class="cotton-file-info-name">${this.#escapeHtml(item.name)}</div>
                <div class="cotton-file-info-details">
                    <div>
                        <div style="font-size: x-small; font-weight: bold;">ID</div>
                        <div style="font-size: small;">${item.id}</div>
                    </div>
                    <div>
                        <div style="font-size: x-small; font-weight: bold;">${Joomla.Text._('COM_COTTON_SIZE')}</div>
                        <div style="font-size: small;">${sizeInfo}</div>
                    </div>
                    <div>
                        <div style="font-size: x-small; font-weight: bold;">${Joomla.Text._('COM_COTTON_TYPE')}</div>
                        ${isFolder ? '' : `<div style="font-size: small;">${this.#getMimeTypeForFile(item)}</div>`}
                    </div>
                    <div>
                        <div style="font-size: x-small; font-weight: bold;">${Joomla.Text._('COM_COTTON_CREATED')}</div>
                        <div style="font-size: small;">${new Date(item.created_date || item.date_created).toLocaleString()}</div>
                    </div>
                </div>
                <div class="cotton-file-info-actions">
                    ${isFolder 
                        ? `<button type="button" class="btn btn-outline-secondary btn-sm active" data-action="open-folder" title="${Joomla.Text._('COM_COTTON_OPEN_FOLDER')}">
                                <i class="icon-folder"></i>
                            </button>
                            <button type="button" class="btn btn-outline-secondary btn-sm active" data-action="edit-folder" title="${Joomla.Text._('COM_COTTON_EDIT')}">
                                <i class="icon-options"></i>
                            </button>`
                        : `<button type="button" class="btn btn-outline-secondary btn-sm active" data-action="open-file" title="${Joomla.Text._('COM_COTTON_OPEN_FILE')}">
                                <i class="icon-file-2"></i>
                            </button>
                            <button type="button" class="btn btn-outline-secondary btn-sm active" data-action="edit-file" title="${Joomla.Text._('COM_COTTON_EDIT')}">
                                <i class="icon-options"></i>
                            </button>
                            <button type="button" class="btn btn-outline-secondary btn-sm active" data-action="copy-link" title="${Joomla.Text._('COM_COTTON_COPY_LINK')}">
                                <i class="icon-link"></i>
                            </button>
                            <button type="button" class="btn btn-outline-secondary btn-sm active" data-action="download" title="${Joomla.Text._('COM_COTTON_DOWNLOAD')}">
                                <i class="icon-download"></i>
                            </button>`
                    }
                    <button type="button" class="btn btn-outline-danger btn-sm active" data-action="delete" title="${Joomla.Text._('COM_COTTON_DELETE')}">
                        <i class="icon-trash"></i>
                    </button>
                </div>
            </div>
        `;

        // Event listeners
        if (!isFolder) {
            panel.querySelector('[data-action="open-file"]')?.addEventListener('click', () => {
                this.#handleItemOpen(item);
            });

            panel.querySelector('[data-action="edit-file"]')?.addEventListener('click', () => {
                this.showEditFileModal(item);
            });

            panel.querySelector('[data-action="download"]')?.addEventListener('click', () => {
                this.#downloadFile(item);
            });

            panel.querySelector('[data-action="copy-link"]')?.addEventListener('click', () => {
                this.#copyFileLink(item);
            });
        } else {
            panel.querySelector('[data-action="open-folder"]')?.addEventListener('click', () => {
                this.#handleItemOpen(item);
            });

            panel.querySelector('[data-action="edit-folder"]')?.addEventListener('click', () => {
                this.showEditFolderModal(item);
            });
        }

        panel.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
            if (isFolder) {
                this.showDeleteFolderModal(item);
            } else {
                this.showDeleteFileModal(item);
            }
        });
    }

    /**
     * Loads file in editor
     * @private
     */
    async #loadFileInEditor(file) {
        const panel = this.#components.panelEditor;
        panel.innerHTML = '';

        const editor = new CottonEditor(panel, {
            fileId: file.id,
            fileName: file.name,
            readOnly: false,
            onSave: () => {
                this.#showSuccess('File saved successfully');
            }
        });

        try {
            await editor.load();
            editor.focus();
        } catch (error) {
            panel.innerHTML = `<div class="cotton-error">Error loading editor: ${error.message}</div>`;
        }
    }

    /**
     * Loads file preview
     * @private
     */
    async #loadFilePreview(file) {
        const panel = this.#components.panelPreview;
        const mimeType = this.#getMimeTypeForFile(file);
        panel.innerHTML = '';

        if (mimeType.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.open&file_id=${file.id}`;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.alt = file.name;
            panel.appendChild(img);
        } else if (mimeType.startsWith('video/')) {
            const video = document.createElement('video');
            video.controls = true;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            const source = document.createElement('source');
            source.src = `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.open&file_id=${file.id}`;
            source.type = mimeType;
            video.appendChild(source);
            panel.appendChild(video);
        }
    }

    /**
     * Downloads file
     * @private
     */
    #downloadFile(file) {
        const link = document.createElement('a');
        link.href = `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.download&file_id=${file.id}&format=raw&${this.#options.token}=1`;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Copia link do arquivo
     * @private
     */
    async #copyFileLink(file) {
        const link = `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.open&file_id=${file.id}`;
        try {
            await navigator.clipboard.writeText(link);
            this.#showSuccess('Link copied to clipboard');
        } catch (error) {
            this.#showError('Error copying: ' + error.message);
        }
    }

    /**
     * Toggles right panel
     * @private
     */
    #switchPanel(tabName) {
        // Remove active
        this.#container.querySelectorAll('.cotton-panel-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Add active
        this.#container.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        // Show corresponding panel
        this.#components.panelInfo.style.display = tabName === 'info' ? '' : 'none';
        this.#components.panelEditor.style.display = tabName === 'editor' ? '' : 'none';
        this.#components.panelPreview.style.display = tabName === 'preview' ? '' : 'none';
    }

    /**
     * Gets FontAwesome icon for file type via CottonHelper
     * @private
     * @param {string} mimeType - File MIME type
     * @returns {string} FontAwesome icon HTML
     */
    #getMimeIcon(mimeType, options = {}) {
        return CottonUIManager.getMimeIcon(mimeType, options);
    }

    static getMimeIcon(mimeTypeOrExt, options = {}) {
        return CottonHelper.getMimeIcon(mimeTypeOrExt, options);
    }

    static getMimeTypeForFile(file) {
        const ext = CottonHelper.getExtension(file.name);
        return CottonHelper.extensionToMime(ext);
    }

    static getPermissionIcon(item) {
        const openLink = parseInt(item?.open_link ?? 0, 10) || 0;
        if (openLink === 1) {
            return '<span class="cotton-perm-icon cotton-perm-icon-limited" title="Specific users"><i class="fa-solid fa-users"></i></span>';
        }
        if (openLink === 2) {
            return '<span class="cotton-perm-icon cotton-perm-icon-public" title="Public"><i class="fa-solid fa-globe"></i></span>';
        }
        return '';
    }

    getPermissionIcon(item) {
        return CottonUIManager.getPermissionIcon(item);
    }

    #getFileSize(file) {
        if (typeof file.size === 'number') return file.size;
        if (typeof file.file_data === 'string') return file.file_data.length;
        return 0;
    }

    #getFileDate(file) {
        const date = file.date_updated || file.date_created;
        return date ? new Date(date).getTime() : 0;
    }

    #getMimeTypeForFile(file) {
        return CottonUIManager.getMimeTypeForFile(file);
    }

    #getCurrentSortField() {
        return this.#state.itemSort.field;
    }

    #getCurrentSortDirection() {
        return this.#state.itemSort.direction;
    }

    #toggleSort(field) {
        if (this.#state.itemSort.field === field) {
            this.#state.itemSort.direction = this.#state.itemSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.#state.itemSort.field = field;
            this.#state.itemSort.direction = 'asc';
        }
        this.#renderItemsList();
    }

    #sortItems(items, field, direction) {
        const sorted = [...items];
        const multiplier = direction === 'asc' ? 1 : -1;

        if (field === 'name') {
            sorted.sort((a, b) => multiplier * a.name.localeCompare(b.name));
        } else if (field === 'size') {
            sorted.sort((a, b) => multiplier * (this.#getFileSize(a) - this.#getFileSize(b)));
        } else if (field === 'date') {
            sorted.sort((a, b) => multiplier * (this.#getFileDate(a) - this.#getFileDate(b)));
        }

        return sorted;
    }

    #getSortIcon(field) {
        if (this.#state.itemSort.field !== field) return '<i class="fa-solid fa-sort text-muted"></i>';
        return this.#state.itemSort.direction === 'asc' ? '<i class="fa-solid fa-sort-up text-primary"></i>' : '<i class="fa-solid fa-sort-down text-primary"></i>';
    }

    /**
     * Formats file size (delegates to CottonHelper)
     * @private
     */
    #formatSize(bytes) {
        return CottonHelper.formatSize(bytes);
    }

    /**
     * Escapes HTML characters (delegates to CottonHelper)
     * @private
     */
    #escapeHtml(text) {
        return CottonHelper.escapeHtml(text);
    }

    #validateItemName(name) {
        name = String(name ?? '').trim();
        const invalidChars = /[\/\\:*?"<>|]/g;
        const match = name.match(invalidChars);
        if (match) {
            const message = Joomla.Text._('COM_COTTON_ITEMNAME_INVALID') + ': ' + Joomla.Text._('COM_COTTON_INVALID_CHARS');
            this.#showErrorModal(message);
            return { valid: false, message };
        }
        if (name === '') {
            const message = Joomla.Text._('COM_COTTON_FOLDERNAME_EMPTY');
            this.#showErrorModal(message);
            return { valid: false, message };
        }
        return { valid: true };
    }

    #showErrorModal(message) {
        const errorModal = new CottonModal({
            title: Joomla.Text._('COM_COTTON_ERROR'),
            icon: '<i class="icon-cancel"></i>',
            width: '420px',
            height: '200px',
            body: `<span style="color: var(--cot-red); margin: 10px; font-size: small;">${this.#escapeHtml(message)}</span>`,
            showFooter: true,
            showCancel: false,
            showSubmit: true,
            submitText: Joomla.Text._('COM_COTTON_OK'),
            submitClass: 'cotton-btn-primary',
            onSubmit: () => errorModal.close()
        });
        errorModal.open();
    }

    /**
     * Shows success message
     * @private
     */
    #showSuccess(message) {
        const status = this.#components.status;
        if (!status) return;
        if (this.#statusTimeout) {
            clearTimeout(this.#statusTimeout);
        }
        status.textContent = message;
        status.className = 'cotton-items-status cotton-items-status--success cotton-items-status--visible';
        this.#statusTimeout = setTimeout(() => {
            status.classList.remove('cotton-items-status--visible');
        }, 3000);
    }

    /**
     * Shows error message
     * @private
     */
    #showError(message) {
        console.error('❌', message);
        const status = this.#components.status;
        if (!status) return;
        if (this.#statusTimeout) {
            clearTimeout(this.#statusTimeout);
        }
        status.textContent = message;
        status.className = 'cotton-items-status cotton-items-status--error cotton-items-status--visible';
        this.#statusTimeout = setTimeout(() => {
            status.classList.remove('cotton-items-status--visible');
        }, 5000);
    }

    /**
     * Emits custom event
     * @private
     */
    #emit(event, data) {
        if (this.#listeners[event]) {
            this.#listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`[CottonUIManager] Error in listener for ${event}:`, err);
                }
            });
        }
    }

    /**
     * Adds listener
     * @param {string} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this.#listeners[event]) {
            this.#listeners[event] = [];
        }
        this.#listeners[event].push(callback);
    }

    /**
     * Removes listener
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback) {
        if (this.#listeners[event]) {
            this.#listeners[event] = this.#listeners[event].filter(cb => cb !== callback);
        }
    }

    getActiveFolderId() {
        return this.#state.activeFolderId;
    }

    async setActiveFolder(folderId = 0) {
        const normalizedFolderId = parseInt(folderId || '0', 10) || 0;
        await this.#loadItems(normalizedFolderId);
        if (this.#tree) {
            this.#tree.setActiveFolder(normalizedFolderId);
            this.#tree.render(this.#state.treeData);
        }
        this.#state.activeFolderId = normalizedFolderId;
        return normalizedFolderId;
    }

    getTreeData() {
        return this.#state.treeData;
    }

    /**
      * Opens a modal
     * @param {Object} options - CottonModal options
     * @returns {CottonModal}
     */
    openModal(options) {
        const modal = new CottonModal(options);
        modal.open();
        return modal;
    }

    /**
     * Creates a registered modal (can be opened by name)
     * @param {string} name - Identifier name
     * @param {Object} options - CottonModal options
     * @returns {CottonModal}
     */
    createModal(name, options) {
        return this.#modalManager.create(name, options);
    }

    /**
     * Opens a registered modal by name
     * @param {string} name
     */
    showModal(name) {
        this.#modalManager.open(name);
    }

    /**
     * Closes a registered modal by name
     * @param {string} name
     */
    hideModal(name) {
        this.#modalManager.close(name);
    }

    /**
     * Gets the modal manager
     * @returns {CottonModalManager}
     */
    getModalManager() {
        return this.#modalManager;
    }

    /**
     * Shows modal to create new folder
     */
    showCreateFolderModal() {
        const parentId = this.#state.activeFolderId || 0;
        // Ensure parent folder is expanded
        this.#state.expandedFolders.add(parentId);
        
        const modal = this.openModal({
            title: Joomla.Text._('COM_COTTON_CREATE_FOLDER'),
            icon: CottonHelper.getMimeIcon('folder', { size: 'fa-1x', colored: true }),
            width: '400px',
            height: '240px',
            body: `
                <form id="cotton-form-folder" class="cotton-form">
                    <input type="hidden" name="parent_id" value="${parentId}">
                    <div class="form-group-file">
                        <label for="folder_name">${Joomla.Text._('COM_COTTON_FOLDER_NAME')}</label>
                        <input type="text" id="folder_name" name="folder_name" placeholder="${Joomla.Text._('COM_COTTON_FOLDER_NAME')}" required>
                    </div>
                    <div class="form-group-file">
                        <label for="folder_description">${Joomla.Text._('COM_COTTON_DESCRIPTION')}</label>
                        <textarea id="folder_description" name="folder_description" placeholder="${Joomla.Text._('COM_COTTON_OPTIONAL')}" rows="3"></textarea>
                    </div>
                </form>
            `,
            token: this.#options.token,
            onSubmit: (data, form) => {
                const validation = this.#validateItemName(data.folder_name);
                if (!validation.valid) {
                    return false;
                }
            },
            action: {
                url: `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.folder_create&format=json`,
                method: 'POST',
                onSuccess: async (response) => {
                    this.#showSuccess(Joomla.Text._('COM_COTTON_CREATE_FOLDER_SUCCESS'));
                    const newFolderId = response.data?.id || response.id;
                    await this.#loadTreeFolders();
                    this.#state.expandedFolders.add(parentId);
                    if (newFolderId) {
                        this.#state.activeFolderId = newFolderId;
                        await this.#loadItems(newFolderId);
                    } else {
                        await this.#loadItems(parentId);
                    }
                    if (this.#tree) {
                        this.#tree.render(this.#state.treeData);
                    }
                 }
            }
        });
        return modal;
    }

    /**
     * Shows modal to edit folder
     * @param {Object} folder - Folder data { id, name, description, open_link, allowed_users }
     */
    showEditFolderModal(folder) {
        const currentOpenLink = folder.open_link || 0;
        const currentAllowedUsers = folder.allowed_users || '';
        const isLimited = currentOpenLink === 1;
        const isAllUsers = isLimited && (!currentAllowedUsers || currentAllowedUsers === 'all');
        
        const modal = this.openModal({
            title: Joomla.Text._('COM_COTTON_EDIT_FOLDER'),
            icon: CottonHelper.getMimeIcon('folder', { size: 'fa-1x', colored: true }),
            width: '400px',
            height: '400px',
            body: `
                <form id="cotton-form-folder" class="cotton-form">
                    <input type="hidden" name="folder_id" value="${folder.id}">
                    <div class="form-group-file">
                        <label for="folder_name">${Joomla.Text._('COM_COTTON_FOLDER_NAME')}</label>
                        <input type="text" id="folder_name" name="folder_name" value="${this.#escapeHtml(folder.name)}" required>
                    </div>
                    <div class="form-group-file">
                        <label for="folder_description">${Joomla.Text._('COM_COTTON_DESCRIPTION')}</label>
                        <textarea id="folder_description" name="folder_description" rows="3">${this.#escapeHtml(folder.description || '')}</textarea>
                    </div>
                    <div class="form-group-file">
                        <label>${Joomla.Text._('COM_COTTON_ACCESS_PERMISSIONS')}</label>
                        <div class="cotton-permissions-options">
                            <select class="cotton-permissions-select" id="open_link" name="open_link">
                                <option value="0" ${currentOpenLink === 0 ? 'selected' : ''}>${Joomla.Text._('COM_COTTON_OWNER_ONLY')}</option>
                                <option value="1" ${currentOpenLink === 1 ? 'selected' : ''}>${Joomla.Text._('COM_COTTON_SPECIFIC_USERS')}</option>
                                <option value="2" ${currentOpenLink === 2 ? 'selected' : ''}>${Joomla.Text._('COM_COTTON_PUBLIC')}</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group-file cotton-users-section" style="display: ${isLimited ? 'block' : 'none'};">
                        <label>${Joomla.Text._('COM_COTTON_USER_OPTIONS')}</label>
                        <div class="cotton-users-type-select-wrapper" style="margin-top: 8px;">
                            <select class="cotton-form-select" id="users_type" name="users_type">
                                <option value="all" ${isAllUsers ? 'selected' : ''}>${Joomla.Text._('COM_COTTON_ALL_USERS')}</option>
                                <option value="specific" ${isLimited && !isAllUsers ? 'selected' : ''}>${Joomla.Text._('COM_COTTON_SPECIFIC_USERS')}</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group-file cotton-users-input" style="display: ${isLimited && !isAllUsers ? 'block' : 'none'};">
                        <label for="allowed_users">${Joomla.Text._('COM_COTTON_SPECIFIC_USERS_INFO')}</label>
                        <input type="text" id="allowed_users" name="allowed_users" value="${isAllUsers ? '' : this.#escapeHtml(currentAllowedUsers)}" placeholder="${Joomla.Text._('COM_COTTON_SPECIFIC_USERS_INFO')}">
                    </div>
                </form>
            `,
            token: this.#options.token,
            onSubmit: (data, form) => {
                const validation = this.#validateItemName(data.folder_name);
                if (!validation.valid) {
                    return false;
                }
            },
            action: {
                url: `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.folder_update&format=json`,
                method: 'POST',
                onSuccess: async (response) => {
                    this.#showSuccess(Joomla.Text._('COM_COTTON_FOLDER_UPDATED'));
                    await this.#loadItems(this.#state.activeFolderId);
                }
            },
            onOpen: () => {
                const permSelect = document.querySelector('#cotton-form-folder select[name="open_link"]');
                const usersSection = document.querySelector('.cotton-users-section');
                const usersInput = document.querySelector('.cotton-users-input');
                const usersTypeSelect = document.querySelector('#cotton-form-folder select[name="users_type"]');

                const updateUsersVisibility = () => {
                    const openLink = parseInt(permSelect.value, 10);
                    if (openLink === 1) {
                        usersSection.style.display = 'block';
                        if (usersTypeSelect && usersTypeSelect.value === 'specific') {
                            usersInput.style.display = 'block';
                        } else {
                            usersInput.style.display = 'none';
                        }
                    } else {
                        usersSection.style.display = 'none';
                        usersInput.style.display = 'none';
                    }
                };

                permSelect.addEventListener('change', updateUsersVisibility);
                updateUsersVisibility();

                if (usersTypeSelect) {
                    usersTypeSelect.addEventListener('change', (e) => {
                        if (e.target.value === 'specific') {
                            usersInput.style.display = 'block';
                        } else {
                            usersInput.style.display = 'none';
                        }
                    });
                }
            },
            onCancel: () => modal.close()
        });
        return modal;
    }

    /**
     * Shows modal to delete folder
     * @param {Object} folder - Folder data { id, name }
     */
    showDeleteFolderModal(folder) {
        const modal = this.openModal({
            title: Joomla.Text._('COM_COTTON_DELETE_FOLDER'),
            icon: CottonHelper.getMimeIcon('folder', { size: 'fa-1x', colored: true }),
            width: '400px',
            height: '200px',
            body: `
                <form id="cotton-form-delete" class="cotton-form">
                    <input type="hidden" name="folder_id" value="${folder.id}">
                    <span>${Joomla.Text._('COM_COTTON_CONFIRM_DELETE_FOLDER').replace('{name}', this.#escapeHtml(folder.name))}</span>
                    <div class="form-group-file" style="flex-direction: row; align-items: center; gap: 8px; margin-top: 8px;">
                        <input type="checkbox" id="trash" name="trash" value="1" checked>
                        <label style="display: flex; align-items: center; gap: 8px;">
                            ${Joomla.Text._('COM_COTTON_SEND_TO_TRASH')}
                        </label>
                    </div>
                </form>
            `,
            token: this.#options.token,
            action: {
                url: `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.folder_delete&format=json`,
                method: 'POST',
                onSuccess: async (response) => {
                    this.#showSuccess(Joomla.Text._('COM_COTTON_FOLDER_DELETED'));
                    await this.#loadItems(this.#state.activeFolderId);
                    this.#updateSpaceInfo();
                }
            }
        });
        return modal;
    }

    /**
     * Shows modal to edit file
     * @param {Object} file - File data { id, name, description, open_link, allowed_users }
     */
    showEditFileModal(file) {
        const currentOpenLink = file.open_link || 0;
        const currentAllowedUsers = file.allowed_users || '';
        const isLimited = currentOpenLink === 1;
        const isAllUsers = isLimited && (!currentAllowedUsers || currentAllowedUsers === 'all');
        
        const modal = this.openModal({
            title: Joomla.Text._('COM_COTTON_FILE_CONFIGURATION'),
            icon: CottonHelper.getMimeIcon('folder-open', { size: 'fa-1x', colored: true }),
            width: '400px',
            height: '400px',
            body: `
                <form id="cotton-form-file" class="cotton-form">
                    <input type="hidden" name="file_id" value="${file.id}">
                    <div class="form-group-file">
                        <label for="file_name">${Joomla.Text._('COM_COTTON_FILE_NAME')}</label>
                        <input type="text" id="file_name" name="file_name" value="${this.#escapeHtml(file.name)}" required>
                    </div>
                    <div class="form-group-file">
                        <label for="file_description">${Joomla.Text._('COM_COTTON_DESCRIPTION')}</label>
                        <textarea id="file_description" name="file_description" rows="3">${this.#escapeHtml(file.description || '')}</textarea>
                    </div>
                    <div class="form-group-file">
                        <label>${Joomla.Text._('COM_COTTON_ACCESS_PERMISSIONS')}</label>
                        <div class="cotton-permissions-options">
                            <select class="cotton-permissions-select" id="open_link" name="open_link">
                                <option value="0" ${currentOpenLink === 0 ? 'selected' : ''}>${Joomla.Text._('COM_COTTON_OWNER_ONLY')}</option>
                                <option value="1" ${currentOpenLink === 1 ? 'selected' : ''}>${Joomla.Text._('COM_COTTON_SPECIFIC_USERS')}</option>
                                <option value="2" ${currentOpenLink === 2 ? 'selected' : ''}>${Joomla.Text._('COM_COTTON_PUBLIC')}</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group-file cotton-users-section" style="display: ${isLimited ? 'block' : 'none'};">
                        <label>${Joomla.Text._('COM_COTTON_USER_OPTIONS')}</label>
                        <div class="cotton-users-type-select-wrapper" style="margin-top: 8px;">
                            <select class="cotton-form-select" id="users_type" name="users_type">
                                <option value="all" ${isAllUsers ? 'selected' : ''}>${Joomla.Text._('COM_COTTON_ALL_USERS')}</option>
                                <option value="specific" ${isLimited && !isAllUsers ? 'selected' : ''}>${Joomla.Text._('COM_COTTON_SPECIFIC_USERS')}</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group-file cotton-users-input" style="display: ${isLimited && !isAllUsers ? 'block' : 'none'};">
                        <label for="allowed_users">${Joomla.Text._('COM_COTTON_SPECIFIC_USERS_INFO')}</label>
                        <input type="text" id="allowed_users" name="allowed_users" value="${isAllUsers ? '' : this.#escapeHtml(currentAllowedUsers)}" placeholder="${Joomla.Text._('COM_COTTON_SPECIFIC_USERS_INFO')}">
                    </div>
                </form>
            `,
            token: this.#options.token,
            onSubmit: (data, form) => {
                const validation = this.#validateItemName(data.file_name);
                if (!validation.valid) {
                    return false;
                }
            },
            action: {
                url: `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.file_update&format=json`,
                method: 'POST',
                onSuccess: async (response) => {
                    this.#showSuccess(Joomla.Text._('COM_COTTON_FILE_UPDATED'));
                    await this.#loadItems(this.#state.activeFolderId);
                }
            },
            onOpen: () => {
                const permSelect = document.querySelector('#cotton-form-file select[name="open_link"]');
                const usersSection = document.querySelector('.cotton-users-section');
                const usersInput = document.querySelector('.cotton-users-input');
                const usersTypeSelect = document.querySelector('#cotton-form-file select[name="users_type"]');

                const updateUsersVisibility = () => {
                    const openLink = parseInt(permSelect.value, 10);
                    if (openLink === 1) {
                        usersSection.style.display = 'block';
                        if (usersTypeSelect && usersTypeSelect.value === 'specific') {
                            usersInput.style.display = 'block';
                        } else {
                            usersInput.style.display = 'none';
                        }
                    } else {
                        usersSection.style.display = 'none';
                        usersInput.style.display = 'none';
                    }
                };

                permSelect.addEventListener('change', updateUsersVisibility);
                updateUsersVisibility();

                if (usersTypeSelect) {
                    usersTypeSelect.addEventListener('change', (e) => {
                        if (e.target.value === 'specific') {
                            usersInput.style.display = 'block';
                        } else {
                            usersInput.style.display = 'none';
                        }
                    });
                }
            },
            onCancel: () => modal.close()
        });
        return modal;
    }

    /**
     * Shows modal to delete file
     * @param {Object} file - File data { id, name }
     */
    showDeleteFileModal(file) {
        const modal = this.openModal({
            title: Joomla.Text._('COM_COTTON_DELETE_FILE'),
            icon: CottonHelper.getMimeIcon('folder-open', { size: 'fa-1x', colored: true }),
            width: '400px',
            height: '200px',
            body: `
                <form id="cotton-form-delete" class="cotton-form">
                    <input type="hidden" name="file_id" value="${file.id}">
                    <span>${Joomla.Text._('COM_COTTON_CONFIRM_DELETE_FILE').replace('{name}', this.#escapeHtml(file.name))}</span>
                    <div class="form-group-file" style="flex-direction: row; align-items: center; gap: 8px; margin-top: 8px;">
                        <input type="checkbox" id="trash" name="trash" value="1" checked>
                        <label style="display: flex; align-items: center; gap: 8px;">
                            ${Joomla.Text._('COM_COTTON_SEND_TO_TRASH')}
                        </label>
                    </div>
                </form>
            `,
            token: this.#options.token,
            action: {
                url: `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.file_delete&format=json`,
                method: 'POST',
                onSuccess: async (response) => {
                    this.#showSuccess(Joomla.Text._('COM_COTTON_FILE_DELETED'));
                    await this.#loadItems(this.#state.activeFolderId);
                    this.#updateSpaceInfo();
                }
            }
        });
        return modal;
    }

    /**
     * Shows modal to restore file from trash
     * @param {Object} file - File data { id, name, folder_id }
     */
    showRestoreFileModal(file) {
        let selectedFolderId = file.folder_id || 0;
        
        const modal = this.openModal({
            title: Joomla.Text._('COM_COTTON_RECOVER_FILE'),
            icon: CottonHelper.getMimeIcon('folder-open', { size: 'fa-1x', colored: true }),
            width: '400px',
            height: '420px',
            body: `
                <form id="cotton-form-restore">
                    <input type="hidden" name="item_id" value="${file.id}">
                    <input type="hidden" name="item_type" value="file">
                    <input type="hidden" name="item_name" value="${file.name}">
                    <input type="hidden" name="folder_id" value="${selectedFolderId}">
                    <p>${Joomla.Text._('COM_COTTON_RESTORE_FILE')} <strong>"${this.#escapeHtml(file.name)}"</strong></p>
                    <div class="form-group-file">
                        <label>${Joomla.Text._('COM_COTTON_SELECT_DESTINATION_FOLDER')}</label>
                        <div id="restore-tree-container" class="cotton-restore-tree"></div>
                    </div>
                </form>
            `,
            token: this.#options.token,
            action: {
                url: `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.item_recover&format=json`,
                method: 'POST',
                onSuccess: async (response) => {
                    this.#showSuccess(Joomla.Text._('COM_COTTON_FILE_RESTORED'));
                    await this.#loadTrash();
                    this.#updateSpaceInfo();
                }
            }
        });
        
        const initTree = async () => {
            const treeContainer = modal.getElement().querySelector('#restore-tree-container');
            if (!treeContainer) return;
            
            const treeData = this.#state.treeData || await CottonAPI.loadTree();
            if (!this.#state.treeData) {
                this.#state.treeData = treeData;
            }
            
            const tree = new CottonTree(treeContainer, {
                onFolderClick: (folder) => {
                    selectedFolderId = folder.id;
                    const hiddenInput = modal.getElement().querySelector('input[name="folder_id"]');
                    if (hiddenInput) hiddenInput.value = folder.id;
                    tree.setActiveFolder(folder.id);
                }
            });
            tree.render(treeData, { startNode: 0 });
            tree.setActiveFolder(selectedFolderId);
        };
        
        initTree();
        return modal;
    }

    /**
     * Shows modal to permanently delete file
     * @param {Object} file - File data { id, name }
     */
    showDeletePermanentFileModal(file) {
        const modal = this.openModal({
            title: Joomla.Text._('COM_COTTON_DELETE_PERMANENTLY'),
            icon: '<i class="icon-cancel"></i>',
            width: '400px',
            height: '240px',
            body: `
                <form id="cotton-form-delete-permanent" class="cotton-form">
                    <input type="hidden" name="file_id" value="${file.id}">
                    <input type="hidden" name="trash" value="0">
                    <p class="text-danger">${Joomla.Text._('COM_COTTON_PERMANENTLY_DELETE')}</p>
                    <p>${Joomla.Text._('COM_COTTON_CONFIRM_DELETE_FILE_PERMANENT').replace('{name}', this.#escapeHtml(file.name))}</p>
                </form>
            `,
            token: this.#options.token,
            action: {
                url: `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.file_delete&format=json`,
                method: 'POST',
                onSuccess: async (response) => {
                    this.#showSuccess(Joomla.Text._('COM_COTTON_FILE_DELETED_PERMANENT'));
                    await this.#loadTrash();
                    this.#updateSpaceInfo();
                }
            }
        });
        return modal;
    }

    /**
     * Shows modal to restore folder from trash
     * @param {Object} folder - Folder data { id, name, parent_id }
     */
    showRestoreFolderModal(folder) {
        let selectedFolderId = folder.parent_id || 0;
        
        const modal = this.openModal({
            title: Joomla.Text._('COM_COTTON_RECOVER_FOLDER'),
            icon: CottonHelper.getMimeIcon('folder-open', { size: 'fa-1x', colored: true }),
            width: '400px',
            height: '420px',
            body: `
                <form id="cotton-form-restore-folder" class="cotton-form">
                    <input type="hidden" name="item_id" value="${folder.id}">
                    <input type="hidden" name="item_type" value="folder">
                    <input type="hidden" name="item_name" value="${folder.name}">
                    <input type="hidden" name="folder_id" value="${selectedFolderId}">
                    <p>${Joomla.Text._('COM_COTTON_RESTORE_FOLDER')} <strong>"${this.#escapeHtml(folder.name)}"</strong></p>
                    <div class="form-group-file">
                        <label>${Joomla.Text._('COM_COTTON_SELECT_DESTINATION_FOLDER')}</label>
                        <div id="restore-tree-container" class="cotton-restore-tree"></div>
                    </div>
                </form>
            `,
            token: this.#options.token,
            action: {
                url: `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.item_recover&format=json`,
                method: 'POST',
                onSuccess: async (response) => {
                    this.#showSuccess(Joomla.Text._('COM_COTTON_FOLDER_RESTORED'));
                    await this.#loadTrash();
                    this.#updateSpaceInfo();
                }
            }
        });
        
        const initTree = async () => {
            const treeContainer = modal.getElement().querySelector('#restore-tree-container');
            if (!treeContainer) return;
            
            const treeData = this.#state.treeData || await CottonAPI.loadTree();
            if (!this.#state.treeData) {
                this.#state.treeData = treeData;
            }
            
            const tree = new CottonTree(treeContainer, {
                onFolderClick: (folder) => {
                    selectedFolderId = folder.id;
                    const hiddenInput = modal.getElement().querySelector('input[name="folder_id"]');
                    if (hiddenInput) hiddenInput.value = folder.id;
                    tree.setActiveFolder(folder.id);
                }
            });
            tree.render(treeData, { startNode: 0 });
            tree.setActiveFolder(selectedFolderId);
        };
        
        initTree();
        return modal;
    }

    /**
     * Shows modal to permanently delete folder
     * @param {Object} folder - Folder data { id, name }
     */
    showDeletePermanentFolderModal(folder) {
        const modal = this.openModal({
            title: Joomla.Text._('COM_COTTON_DELETE_PERMANENTLY'),
            icon: CottonHelper.getMimeIcon('folder-open', { size: 'fa-1x', colored: true }),
            width: '400px',
            height: '240px',
            body: `
                    <input type="hidden" name="folder_id" value="${folder.id}">
                    <input type="hidden" name="trash" value="0">
                    <p class="text-danger">${Joomla.Text._('COM_COTTON_PERMANENTLY_DELETE')}</p>
                    <p>${Joomla.Text._('COM_COTTON_CONFIRM_DELETE_FOLDER_PERMANENT').replace('{name}', this.#escapeHtml(folder.name))}</p>
                `,
            token: this.#options.token,
            action: {
                url: `${this.#options.siteUrl}index.php?option=com_cotton&task=cotton.folder_delete&format=json`,
                method: 'POST',
                onSuccess: async (response) => {
                    this.#showSuccess(Joomla.Text._('COM_COTTON_FOLDER_DELETED_PERMANENT'));
                    await this.#loadTrash();
                    this.#updateSpaceInfo();
                }
            }
        });
        return modal;
    }

    /**
     * Destroys manager
     */
    destroy() {
        this.#listeners = {};
        if (this.#tree) {
            this.#tree.destroy();
        }
        if (this.#container) {
            this.#container.innerHTML = '';
        }
    }
}

if (typeof window !== 'undefined') {
    window.CottonUIManager = CottonUIManager;
}