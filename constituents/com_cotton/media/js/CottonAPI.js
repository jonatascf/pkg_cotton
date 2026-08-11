/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * CottonAPI - Backend request layer
 * Clean interface for all com_cotton operations
 * 
 * @class
 * @example
 * CottonAPI.init(siteUrl,  token);
 * const file = await CottonAPI.createFile(folderId, fileObj, 'description');
 */
export class CottonAPI {
    static siteUrl = null;
    static admin = false;
    static token = null;
    static timeout = 300000; // 5 minutes (300s) - required for large file finalization

    /**
     * Initializes the API with global settings
     * @param {string} siteUrl - URL base do Joomla (ex: http://localhost/)
     * @param {string} token - Token CSRF (ex: 'token123abc')
     */
    static init(siteUrl, admin, token) {
        // Validar e normalizar siteUrl
        if (!siteUrl) {
            throw new Error('[CottonAPI.init] siteUrl is required');
        }
        
        this.siteUrl = siteUrl;
        this.admin = admin;
        this.token = token;

    }

    /**
     * Helper for making POST requests to the backend
     * @private
     * @param {string} task - Controller task (ex: 'cotton.file_create')
     * @param {FormData} formData - Form data
     * @param {AbortSignal} signal - Sinal de aborto opcional
     * @returns {Promise<Object>} Resposta do servidor
     */
     static async _request(task, formData = null, signal = null) {
         const url = `${this.siteUrl}index.php?option=com_cotton&task=${task}&format=json`;
         
          // Prepare FormData
         const data = formData || new FormData();
         if (!data.has(this.token)) {
             data.append(this.token, '1');
         }

         try {
             const controller = new AbortController();
             const timeoutId = setTimeout(() => controller.abort(), this.timeout);

             const response = await fetch(url, {
                 method: 'POST',
                 credentials: 'same-origin',
                 body: data,
                 headers: { 'X-Requested-With': 'XMLHttpRequest' },
                 signal: signal || controller.signal
             });

             clearTimeout(timeoutId);

             if (!response.ok) {
                 throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }

             const result = await response.json();
             
              if (!result.success) {
                   throw new Error(result.message || result.error || 'Unknown server error');
              }

             return result;
         } catch (error) {
             if (error.name === 'AbortError') {
                 const isExternalCancel = signal && signal.aborted;
                 if (isExternalCancel) {
                      console.warn(`[CottonAPI] Upload cancelled by user in ${task}`);
                      throw new Error('Upload cancelled');
                  }
                  console.error(`[CottonAPI] Timeout after ${this.timeout}ms in ${task}`);
                  throw new Error(`Timeout: operation took longer than ${this.timeout / 1000}s`);
              }
              console.error(`[CottonAPI] Error in ${task}:`, error);
             throw error;
         }
     }

    // ================== FILE OPERATIONS ==================

    /**
      * Uploads a file chunk
      * @param {number} fileId - File ID (returned by createFile)
      * @param {Blob} chunk - File chunk
      * @param {number} chunkIndex - Chunk index (0-based)
      * @param {number} totalChunks - Total chunks
      * @param {string} fileName - Original file name
      * @param {AbortSignal} signal - Sinal de aborto opcional
      * @returns {Promise<Object>} Status do upload
      */
     static async uploadChunk(fileId, chunk, chunkIndex, totalChunks, fileName, folderId = 0, signal = null) {
         const formData = new FormData();
         formData.append('file_id', fileId);
         formData.append('folder_id', folderId);
         formData.append('file', chunk, fileName);
         formData.append('index', chunkIndex);
         formData.append('chunk_index', chunkIndex);
         formData.append('total_chunks', totalChunks);

 const result = await this._request('cotton.file_upload', formData, signal);
         return result.data;
     }

      /**
       * Cancels an ongoing upload and removes the temporary file
       * @param {number} fileId - File ID
      * @returns {Promise<Object>} Status do cancelamento
      */
     static async cancelUpload(fileId) {
         const formData = new FormData();
         formData.append('file_id', fileId);

         const result = await this._request('cotton.file_cancel', formData);
         return result.data;
     }

    /**
     * Finalizes file upload after all chunks
     * @param {number} fileId - File ID
     * @param {AbortSignal} signal - Sinal de aborto opcional
     * @returns {Promise<Object>} Finalization status
     */
     static async finalizeUpload(fileId, signal = null) {
         const formData = new FormData();
         formData.append('file_id', fileId);

         const result = await this._request('cotton.file_finalize', formData, signal);
         return result.data;
     }

    /**
     * Updates file metadata
     * @param {number} fileId - File ID
     * @param {string} fileName - New name
     * @param {string} description - New description
     * @param {boolean} openLink - Allow access via link
     * @param {string} allowedUsers - JSON with allowed user IDs
     * @returns {Promise<Object>} Dados atualizados
     */
    static async updateFile(fileId, fileName, description = '', openLink = false, allowedUsers = '') {
        const formData = new FormData();
        formData.append('file_id', fileId);
        formData.append('file_name', fileName);
        formData.append('file_description', description);
        formData.append('file_open_link', openLink ? 1 : 0);
        formData.append('file_allowed_users', allowedUsers);

        const result = await this._request('cotton.file_update', formData);
        return result.data;
    }

    /**
     * Saves text file content
     * @param {number} fileId - File ID
     * @param {string} content - New content
     * @returns {Promise<Object>} Resultado
     */
    static async saveFileContent(fileId, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file_id', fileId);
        formData.append('file', blob, 'temp.txt');

        const result = await this._request('cotton.file_save', formData);
        return result.data;
    }

    /**
     * Deletes a file (to trash)
     * @param {number} fileId - File ID
     * @param {boolean} permanently - If true, deletes permanently
     * @returns {Promise<Object>} Resultado
     */
    static async deleteFile(fileId, permanently = false) {
        const formData = new FormData();
        formData.append('item_id', fileId);
        formData.append('item_type', 'file');
        formData.append('trash', permanently ? 1 : 0);

        const result = await this._request('cotton.item_delete', formData);
        return result.data;
    }

    /**
     * Recovers a file from trash
     * @param {number} fileId - File ID
     * @param {number} folderId - Folder ID to restore to
     * @returns {Promise<Object>} Resultado
     */
    static async recoverFile(fileId, folderId) {
        const formData = new FormData();
        formData.append('item_id', fileId);
        formData.append('item_type', 'file');
        formData.append('folder_id', folderId);

        const result = await this._request('cotton.item_recover', formData);
        return result.data;
    }

      /**
       * Restores a file from trash (alias for recoverFile)
     * @param {number} fileId - ID do arquivo
     * @param {number} folderId - ID da pasta para restaurar
     * @returns {Promise<Object>} Resultado
     */
    static async fileRecover(fileId, folderId) {
        return this.recoverFile(fileId, folderId);
    }

      /**
       * Restores a folder from trash
     * @param {number} folderId - ID da pasta
     * @param {number} parentId - ID da pasta pai para restaurar
     * @returns {Promise<Object>} Resultado
     */
    static async folderRecover(folderId, parentId) {
        const formData = new FormData();
        formData.append('item_id', folderId);
        formData.append('item_type', 'folder');
        formData.append('folder_id', parentId);

        const result = await this._request('cotton.item_recover', formData);
        return result.data;
    }

    // ================== FOLDER OPERATIONS ==================

    /**
     * Creates a new folder
     * @param {number} parentId - Parent folder ID
     * @param {string} name - Folder name
     * @param {string} description - Description
     * @returns {Promise<Object>} { id, name, parent_id, ... }
     */
    static async createFolder(parentId, name, description = '') {
        const formData = new FormData();
        formData.append('parent_id', parentId);
        formData.append('name', name);
        formData.append('description', description);

        const result = await this._request('cotton.folder_create', formData);
        return result.data;
    }

    /**
     * Loads folder contents
     * @param {number} folderId - Folder ID
     * @returns {Promise<Object>} { folders: [], files: [], list: hierarchy }
     */
    static async loadItems(folderId) {
        const formData = new FormData();
        formData.append('folder_id', folderId);

        const result = await this._request('cotton.items_load', formData);
        return result.data;
    }

/**
      * Loads trash items (trash = 1)
      * @returns {Promise<Object>} { folders_trash: [], files_trash: [] }
      */
    static async loadTrash() {
        const result = await this._request('cotton.trash_load', new FormData());
        return result.data;
    }

    /**
     * Updates folder information
     * @param {number} folderId - Folder ID
     * @param {string} name - New name
     * @param {string} description - New description
     * @returns {Promise<Object>} Dados atualizados
     */
    static async updateFolder(folderId, name, description = '') {
        const formData = new FormData();
        formData.append('folder_id', folderId);
        formData.append('folder_name', name);
        formData.append('folder_description', description);

        const result = await this._request('cotton.folder_update', formData);
        return result.data;
    }

    /**
     * Deletes a folder (to trash)
     * @param {number} folderId - Folder ID
     * @param {boolean} permanently - If true, deletes permanently
     * @returns {Promise<Object>} Resultado
     */
    static async deleteFolder(folderId, permanently = false) {
        const formData = new FormData();
        formData.append('item_id', folderId);
        formData.append('item_type', 'folder');
        formData.append('trash', permanently ? 1 : 0);

        const result = await this._request('cotton.item_delete', formData);
        return result.data;
    }

    /**
     * Recovers a folder from trash
     * @param {number} folderId - Folder ID
     * @param {number} parentId - Parent folder ID to restore to
     * @returns {Promise<Object>} Resultado
     */
    static async recoverFolder(folderId, parentId) {
        const formData = new FormData();
        formData.append('item_id', folderId);
        formData.append('item_type', 'folder');
        formData.append('item_name', '');
        formData.append('folder_id', parentId);

        const result = await this._request('cotton.item_recover', formData);
        return result.data;
    }

    /**
     * Moves a folder to another parent
     * @param {number} folderId - Folder ID to move
     * @param {number} newParentId - New parent folder ID
     * @returns {Promise<Object>} Resultado
     */
    static async moveFolder(folderId, newParentId) {
        const formData = new FormData();
        formData.append('folder_id', folderId);
        formData.append('new_parent_id', newParentId);

        const result = await this._request('cotton.folder_move', formData);
        return result.data;
    }

    /**
     * Moves a file to another folder
     * @param {number} fileId - File ID
     * @param {number} folderId - Destination folder ID
     * @returns {Promise<Object>} Resultado
     */
    static async moveFile(fileId, folderId) {
        const formData = new FormData();
        formData.append('file_id', fileId);
        formData.append('folder_id', folderId);

        const result = await this._request('cotton.file_move', formData);
        return result.data;
    }

    /**
     * Gets a file preview/open URL
     * @param {number} fileId - File ID
     * @returns {string} URL to open the file inline
     */
    static getFilePreviewUrl(fileId) {
        return `${this.siteUrl}index.php?option=com_cotton&task=cotton.open&file_id=${fileId}`;
    }

/**
      * Gets a file download URL
      * @param {number} fileId - File ID
      * @returns {string} URL to download the file
      */
    static getFileDownloadUrl(fileId) {
        return `${this.siteUrl}index.php?option=com_cotton&task=cotton.download&file_id=${fileId}&format=raw&${this.token}=1`;
    }

    /**
     * Clears the entire trash
      * @returns {Promise<Object>} Resultado
      */
    static async clearTrash() {
        const result = await this._request('cotton.clear_trash');
        return result.data;
    }

    static async loadTree() {
        const result = await this._request('cotton.tree_load');
        return result.data;
    }

}

if (typeof window !== 'undefined') {
    window.CottonAPI = CottonAPI;
}
