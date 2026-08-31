/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

/**
 * CottonStorage - Centralized state manager
 * Implements Observer pattern for reactivity
 * 
 * @class
 * @example
 * CottonStorage.init();
 * CottonStorage.onStateChange('fileAdded', (file) => console.log('File added:', file));
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
    static #isNotifying = false;   // prevents recursive notifications

    /**
     * Initializes storage
     */
    static init() {
        this.#state.isInitialized = true;
        this.#notifyListeners('initialized', null);
    }

    // ================== GETTERS ==================

    /**
     * Returns full state (read-only)
     * @returns {Object} Frozen state
     */
    static getState() {
        return Object.freeze({ ...this.#state });
    }

    /**
     * Gets folder by ID
     * @param {number} folderId
     * @returns {Object|null}
     */
    static getFolder(folderId) {
        return this.#state.folders[folderId] || null;
    }

    /**
     * Gets file by ID
     * @param {number} fileId
     * @returns {Object|null}
     */
    static getFile(fileId) {
        return this.#state.files[fileId] || null;
    }

    /**
     * Lists all folders
     * @returns {Array}
     */
    static getAllFolders() {
        return Object.values(this.#state.folders);
    }

    /**
     * Lists all files
     * @returns {Array}
     */
    static getAllFiles() {
        return Object.values(this.#state.files);
    }

    /**
     * Lists files in a specific folder
     * @param {number} folderId
     * @returns {Array}
     */
    static getFilesInFolder(folderId) {
        return Object.values(this.#state.files).filter(f => f.folder_id === folderId);
    }

    /**
     * Gets subfolders of a folder
     * @param {number} parentId
     * @returns {Array}
     */
    static getSubfolders(parentId) {
        return Object.values(this.#state.folders).filter(f => f.parent_id === parentId);
    }

    /**
     * Gets active folder
     * @returns {Object|null}
     */
    static getActiveFolder() {
        return this.#state.folders[this.#state.activeFolderId] || null;
    }

    /**
     * Gets selected file
     * @returns {Object|null}
     */
    static getSelectedFile() {
        return this.#state.selectedFile ? this.#state.files[this.#state.selectedFile] : null;
    }

    /**
     * Gets upload progress
     * @param {number} fileId
     * @returns {Object} { progress, status, error? }
     */
    static getUploadProgress(fileId) {
        return this.#state.uploads[fileId] || { progress: 0, status: 'pending' };
    }

    // ================== SETTERS ==================

    /**
     * Sets active folder
     * @param {number} folderId
     */
    static setActiveFolder(folderId) {
        if (this.#state.activeFolderId !== folderId) {
            this.#state.activeFolderId = folderId;
            this.#state.selectedFile = null; // Clear selection when changing folder
            this.#notifyListeners('activeFolderChanged', folderId);
        }
    }

    /**
     * Sets selected file
     * @param {number|null} fileId
     */
    static setSelectedFile(fileId) {
        if (this.#state.selectedFile !== fileId) {
            this.#state.selectedFile = fileId;
            this.#notifyListeners('selectedFileChanged', fileId);
        }
    }

    /**
     * Sets selected folder
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
     * Adds folder to storage
     * @param {Object} folder
     */
    static addFolder(folder) {
        this.#state.folders[folder.id] = folder;
        this.#notifyListeners('folderAdded', folder);
    }

    /**
     * Updates folder
     * @param {number} folderId
     * @param {Object} updates - fields to update
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
     * Removes folder
     * @param {number} folderId
     */
    static removeFolder(folderId) {
        const folder = this.#state.folders[folderId];
        delete this.#state.folders[folderId];
        this.#notifyListeners('folderRemoved', folder);
    }

    /**
     * Loads multiple folders
     * @param {Array} folders
     */
    static loadItemss(folders) {
        this.#state.folders = {};
        folders.forEach(f => this.addFolder(f));
        this.#notifyListeners('foldersLoaded', folders);
    }

    // ================== FILE OPERATIONS ==================

    /**
     * Adds file to storage
     * @param {Object} file
     */
    static addFile(file) {
        this.#state.files[file.id] = file;
        this.#notifyListeners('fileAdded', file);
    }

    /**
     * Updates file
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
     * Removes file
     * @param {number} fileId
     */
    static removeFile(fileId) {
        const file = this.#state.files[fileId];
        delete this.#state.files[fileId];
        delete this.#state.uploads[fileId];
        this.#notifyListeners('fileRemoved', file);
    }

    /**
     * Loads multiple files
     * @param {Array} files
     */
    static loadFiles(files) {
        this.#state.files = {};
        files.forEach(f => this.addFile(f));
        this.#notifyListeners('filesLoaded', files);
    }

    /**
     * Moves file to another folder
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
     * Sets upload progress
     * @param {number} fileId
     * @param {number} progress - 0-100
     * @param {string} status - 'pending'|'uploading'|'done'|'error'
     * @param {string} error - error message (optional)
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
     * Marks upload as complete
     * @param {number} fileId
     */
    static completeUpload(fileId) {
        this.setUploadProgress(fileId, 100, 'done');
    }

    /**
     * Marks upload as error
     * @param {number} fileId
     * @param {string} errorMessage
     */
    static failUpload(fileId, errorMessage) {
        this.setUploadProgress(fileId, 0, 'error', errorMessage);
    }

    /**
     * Clears upload from registry
     * @param {number} fileId
     */
    static clearUpload(fileId) {
        delete this.#state.uploads[fileId];
    }

    /**
     * Gets all ongoing uploads
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
     * Moves item to trash
     * @param {string} type - 'file'|'folder'
     * @param {number} id
     * @param {Object} item - object to store
     */
    static moveToTrash(type, id, item) {
        if (!this.#state.trash[type]) {
            this.#state.trash[type] = {};
        }
        this.#state.trash[type][id] = item;
        this.#notifyListeners('itemMovedToTrash', { type, id, item });
    }

    /**
     * Restores item from trash
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
     * Empties trash
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
     * Gets items in trash
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
     * Registers listener for state changes
     * @param {string} event - event name
     * @param {Function} callback - function to execute
     */
    static onStateChange(event, callback) {
        if (typeof callback !== 'function') {
            console.error('[CottonStorage] Callback must be a function');
            return;
        }

        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, []);
        }

        this.#listeners.get(event).push(callback);

         // Return function to unsubscribe
        return () => {
            const callbacks = this.#listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Removes a specific listener
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
     * Removes all listeners for an event
     * @param {string} event
     */
    static clearEvent(event) {
        this.#listeners.delete(event);
    }

    /**
     * Removes all listeners
     */
    static clearAllListeners() {
        this.#listeners.clear();
    }

    /**
     * Notifies listeners (private)
     * @private
     */
    static #notifyListeners(event, data) {
        if (this.#isNotifying) {
            return; // Prevents recursive notifications
        }

        this.#isNotifying = true;

        if (this.#listeners.has(event)) {
            this.#listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[CottonStorage] Error notifying event "${event}":`, error);
                }
            });
        }

        this.#isNotifying = false;
    }

    /**
     * Syncs state with backend data
     * @param {Object} data - data returned from server
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
     * Resets storage to initial state
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
