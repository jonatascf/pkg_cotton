/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * CottonStorage - Gerenciador de estado centralizado
 * Implementa padrão Observer para reatividade
 * 
 * @class
 * @example
 * CottonStorage.init();
 * CottonStorage.onStateChange('fileAdded', (file) => console.log('Arquivo adicionado:', file));
 * CottonStorage.addFile(fileObj);
 */
export class CottonStorage {
    static #state = {
        activeFolderId: 0,
        folders: {},        // id -> { id, name, parent_id, description, date_created, ... }
        files: {},          // id -> { id, name, size, mime_type, folder_id, date_created, ... }
        uploads: {},        // fileId -> { progress: 0-100, status: 'pending'|'uploading'|'done'|'error', error?: string }
        selectedFile: null,
        selectedFolder: null,
        trash: {},          // deleted items (type -> id -> object)
        lastSync: null,
        isInitialized: false,
    };

    static #listeners = new Map(); // event -> [callback1, callback2, ...]
    static #isNotifying = false;   // previne recursão de notificações

    /**
     * Inicializa o storage
     */
    static init() {
        this.#state.isInitialized = true;
        this.#notifyListeners('initialized', null);
    }

    // ================== GETTERS ==================

    /**
     * Retorna estado completo (somente leitura)
     * @returns {Object} Estado congelado
     */
    static getState() {
        return Object.freeze({ ...this.#state });
    }

    /**
     * Obtém pasta pelo ID
     * @param {number} folderId 
     * @returns {Object|null}
     */
    static getFolder(folderId) {
        return this.#state.folders[folderId] || null;
    }

    /**
     * Obtém arquivo pelo ID
     * @param {number} fileId 
     * @returns {Object|null}
     */
    static getFile(fileId) {
        return this.#state.files[fileId] || null;
    }

    /**
     * Lista todas as pastas
     * @returns {Array}
     */
    static getAllFolders() {
        return Object.values(this.#state.folders);
    }

    /**
     * Lista todos os arquivos
     * @returns {Array}
     */
    static getAllFiles() {
        return Object.values(this.#state.files);
    }

    /**
     * Lista arquivos de uma pasta específica
     * @param {number} folderId 
     * @returns {Array}
     */
    static getFilesInFolder(folderId) {
        return Object.values(this.#state.files).filter(f => f.folder_id === folderId);
    }

    /**
     * Obtém subpastas de uma pasta
     * @param {number} parentId 
     * @returns {Array}
     */
    static getSubfolders(parentId) {
        return Object.values(this.#state.folders).filter(f => f.parent_id === parentId);
    }

    /**
     * Obtém pasta ativa
     * @returns {Object|null}
     */
    static getActiveFolder() {
        return this.#state.folders[this.#state.activeFolderId] || null;
    }

    /**
     * Obtém arquivo selecionado
     * @returns {Object|null}
     */
    static getSelectedFile() {
        return this.#state.selectedFile ? this.#state.files[this.#state.selectedFile] : null;
    }

    /**
     * Obtém progresso de upload
     * @param {number} fileId 
     * @returns {Object} { progress, status, error? }
     */
    static getUploadProgress(fileId) {
        return this.#state.uploads[fileId] || { progress: 0, status: 'pending' };
    }

    // ================== SETTERS ==================

    /**
     * Define pasta ativa
     * @param {number} folderId 
     */
    static setActiveFolder(folderId) {
        if (this.#state.activeFolderId !== folderId) {
            this.#state.activeFolderId = folderId;
            this.#state.selectedFile = null; // Limpar seleção ao mudar pasta
            this.#notifyListeners('activeFolderChanged', folderId);
        }
    }

    /**
     * Define arquivo selecionado
     * @param {number|null} fileId 
     */
    static setSelectedFile(fileId) {
        if (this.#state.selectedFile !== fileId) {
            this.#state.selectedFile = fileId;
            this.#notifyListeners('selectedFileChanged', fileId);
        }
    }

    /**
     * Define pasta selecionada
     * @param {number|null} folderId 
     */
    static setSelectedFolder(folderId) {
        if (this.#state.selectedFolder !== folderId) {
            this.#state.selectedFolder = folderId;
            this.#notifyListeners('selectedFolderChanged', folderId);
        }
    }

    static setFolders(folders) {
        this.#state.folders = {};
        folders.forEach(f => this.#state.folders[f.id] = f);
        this.#notifyListeners('foldersSet', folders);
    }

    static setFiles(files) {
        this.#state.files = {};
        files.forEach(f => this.#state.files[f.id] = f);
        this.#notifyListeners('filesSet', files);
    }

    static setTreeFolders(treeFolders) {
        const flatten = (folders, parentId = 0) => {
            let result = [];
            folders.forEach(f => {
                const { children, ...folderData } = f;
                result.push({ ...folderData, parent_id: parentId });
                if (children && children.length > 0) {
                    result = result.concat(flatten(children, f.id));
                }
            });
            return result;
        };
        const flatFolders = flatten(treeFolders);
        this.setFolders(flatFolders);
    }

    // ================== FOLDER OPERATIONS ==================

    /**
     * Adiciona pasta ao storage
     * @param {Object} folder 
     */
    static addFolder(folder) {
        this.#state.folders[folder.id] = folder;
        this.#notifyListeners('folderAdded', folder);
    }

    /**
     * Atualiza pasta
     * @param {number} folderId 
     * @param {Object} updates - campos a atualizar
     */
    static updateFolder(folderId, updates) {
        if (this.#state.folders[folderId]) {
            this.#state.folders[folderId] = {
                ...this.#state.folders[folderId],
                ...updates
            };
            this.#notifyListeners('folderUpdated', this.#state.folders[folderId]);
        }
    }

    /**
     * Remove pasta
     * @param {number} folderId 
     */
    static removeFolder(folderId) {
        const folder = this.#state.folders[folderId];
        delete this.#state.folders[folderId];
        this.#notifyListeners('folderRemoved', folder);
    }

    /**
     * Carrega múltiplas pastas
     * @param {Array} folders 
     */
    static loadItemss(folders) {
        this.#state.folders = {};
        folders.forEach(f => this.addFolder(f));
        this.#notifyListeners('foldersLoaded', folders);
    }

    // ================== FILE OPERATIONS ==================

    /**
     * Adiciona arquivo ao storage
     * @param {Object} file 
     */
    static addFile(file) {
        this.#state.files[file.id] = file;
        this.#notifyListeners('fileAdded', file);
    }

    /**
     * Atualiza arquivo
     * @param {number} fileId 
     * @param {Object} updates 
     */
    static updateFile(fileId, updates) {
        if (this.#state.files[fileId]) {
            this.#state.files[fileId] = {
                ...this.#state.files[fileId],
                ...updates
            };
            this.#notifyListeners('fileUpdated', this.#state.files[fileId]);
        }
    }

    /**
     * Remove arquivo
     * @param {number} fileId 
     */
    static removeFile(fileId) {
        const file = this.#state.files[fileId];
        delete this.#state.files[fileId];
        delete this.#state.uploads[fileId];
        this.#notifyListeners('fileRemoved', file);
    }

    /**
     * Carrega múltiplos arquivos
     * @param {Array} files 
     */
    static loadFiles(files) {
        this.#state.files = {};
        files.forEach(f => this.addFile(f));
        this.#notifyListeners('filesLoaded', files);
    }

    /**
     * Move arquivo para outra pasta
     * @param {number} fileId 
     * @param {number} newFolderId 
     */
    static moveFile(fileId, newFolderId) {
        if (this.#state.files[fileId]) {
            this.#state.files[fileId].folder_id = newFolderId;
            this.#notifyListeners('fileMoved', {
                fileId,
                newFolderId,
                file: this.#state.files[fileId]
            });
        }
    }

    // ================== UPLOAD OPERATIONS ==================

    /**
     * Define progresso de upload
     * @param {number} fileId 
     * @param {number} progress - 0-100
     * @param {string} status - 'pending'|'uploading'|'done'|'error'
     * @param {string} error - mensagem de erro (opcional)
     */
    static setUploadProgress(fileId, progress, status = 'uploading', error = null) {
        this.#state.uploads[fileId] = {
            progress: Math.min(100, Math.max(0, progress)),
            status,
            error: error || undefined
        };
        this.#notifyListeners('uploadProgress', {
            fileId,
            progress: this.#state.uploads[fileId].progress,
            status,
            error
        });
    }

    /**
     * Marca upload como completo
     * @param {number} fileId 
     */
    static completeUpload(fileId) {
        this.setUploadProgress(fileId, 100, 'done');
    }

    /**
     * Marca upload como erro
     * @param {number} fileId 
     * @param {string} errorMessage 
     */
    static failUpload(fileId, errorMessage) {
        this.setUploadProgress(fileId, 0, 'error', errorMessage);
    }

    /**
     * Limpa upload do registro
     * @param {number} fileId 
     */
    static clearUpload(fileId) {
        delete this.#state.uploads[fileId];
    }

    /**
     * Obtém todos os uploads em andamento
     * @returns {Object}
     */
    static getPendingUploads() {
        const pending = {};
        Object.entries(this.#state.uploads).forEach(([fileId, upload]) => {
            if (upload.status === 'uploading' || upload.status === 'pending') {
                pending[fileId] = upload;
            }
        });
        return pending;
    }

    // ================== TRASH OPERATIONS ==================

    /**
     * Move item para trash
     * @param {string} type - 'file'|'folder'
     * @param {number} id 
     * @param {Object} item - objeto a guardar
     */
    static moveToTrash(type, id, item) {
        if (!this.#state.trash[type]) {
            this.#state.trash[type] = {};
        }
        this.#state.trash[type][id] = item;
        this.#notifyListeners('itemMovedToTrash', { type, id, item });
    }

    /**
     * Recupera item do trash
     * @param {string} type 
     * @param {number} id 
     * @returns {Object|null}
     */
    static restoreFromTrash(type, id) {
        if (this.#state.trash[type] && this.#state.trash[type][id]) {
            const item = this.#state.trash[type][id];
            delete this.#state.trash[type][id];
            this.#notifyListeners('itemRestoredFromTrash', { type, id, item });
            return item;
        }
        return null;
    }

    /**
     * Limpa trash
     * @param {string} type - 'file'|'folder'|'all'
     */
    static emptyTrash(type = 'all') {
        if (type === 'all') {
            this.#state.trash = {};
        } else {
            delete this.#state.trash[type];
        }
        this.#notifyListeners('trashEmptied', type);
    }

    /**
     * Obtém itens no trash
     * @param {string} type - 'file'|'folder'|'all'
     * @returns {Object}
     */
    static getTrash(type = 'all') {
        if (type === 'all') {
            return this.#state.trash;
        }
        return this.#state.trash[type] || {};
    }

    // ================== OBSERVERS ==================

    /**
     * Registra listener para mudanças de estado
     * @param {string} event - nome do evento
     * @param {Function} callback - função a executar
     */
    static onStateChange(event, callback) {
        if (typeof callback !== 'function') {
            console.error('[CottonStorage] Callback deve ser uma função');
            return;
        }

        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, []);
        }

        this.#listeners.get(event).push(callback);

        // Retornar função para unsubscribe
        return () => {
            const callbacks = this.#listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Remove um listener específico
     * @param {string} event 
     * @param {Function} callback 
     */
    static removeListener(event, callback) {
        if (this.#listeners.has(event)) {
            const callbacks = this.#listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Remove todos os listeners de um evento
     * @param {string} event 
     */
    static clearEvent(event) {
        this.#listeners.delete(event);
    }

    /**
     * Remove todos os listeners
     */
    static clearAllListeners() {
        this.#listeners.clear();
    }

    /**
     * Notifica listeners (privado)
     * @private
     */
    static #notifyListeners(event, data) {
        if (this.#isNotifying) {
            return; // Previne notificações recursivas
        }

        this.#isNotifying = true;

        if (this.#listeners.has(event)) {
            this.#listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[CottonStorage] Erro ao notificar evento "${event}":`, error);
                }
            });
        }

        this.#isNotifying = false;
    }

    /**
     * Sincroniza estado com dados do backend
     * @param {Object} data - dados retornados do servidor
     */
    static sync(data) {
        if (data.folders) {
            this.loadItemss(data.folders);
        }
        if (data.files) {
            this.loadFiles(data.files);
        }
        if (data.active_folder_id !== undefined) {
            this.#state.activeFolderId = data.active_folder_id;
        }
        this.#state.lastSync = new Date().getTime();
        this.#notifyListeners('synced', data);
    }

    /**
     * Reseta storage para estado inicial
     */
    static reset() {
        this.#state = {
            activeFolderId: 0,
            folders: {},
            files: {},
            uploads: {},
            selectedFile: null,
            selectedFolder: null,
            trash: {},
            lastSync: null,
            isInitialized: false,
        };
        this.#notifyListeners('reset', null);
    }
}
