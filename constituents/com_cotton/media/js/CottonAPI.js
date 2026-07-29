/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * CottonAPI - Camada de requisições ao backend
 * Interface limpa para todas as operações com com_cotton
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
    static timeout = 300000; // 5 minutos (300s) - necessário para finalize de arquivos grandes

    /**
     * Inicializa a API com configurações globais
     * @param {string} siteUrl - URL base do Joomla (ex: http://localhost/)
     * @param {string} token - Token CSRF (ex: 'token123abc')
     */
    static init(siteUrl, admin, token) {
        // Validar e normalizar siteUrl
        if (!siteUrl) {
            throw new Error('[CottonAPI.init] siteUrl é obrigatória');
        }
        
        this.siteUrl = siteUrl;
        this.admin = admin;
        this.token = token;

    }

    /**
     * Helper para fazer requisições POST ao backend
     * @private
     * @param {string} task - Tarefa do controller (ex: 'cotton.file_create')
     * @param {FormData} formData - Dados do formulário
     * @param {AbortSignal} signal - Sinal de aborto opcional
     * @returns {Promise<Object>} Resposta do servidor
     */
     static async _request(task, formData = null, signal = null) {
         const url = `${this.siteUrl}index.php?option=com_cotton&task=${task}&format=json`;
         
         // Preparar FormData
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
                 throw new Error(result.message || 'Erro desconhecido no servidor');
             }

             return result;
         } catch (error) {
             if (error.name === 'AbortError') {
                 const isExternalCancel = signal && signal.aborted;
                 if (isExternalCancel) {
                     console.warn(`[CottonAPI] Upload cancelado pelo usuário em ${task}`);
                     throw new Error('Upload cancelado');
                 }
                 console.error(`[CottonAPI] Timeout após ${this.timeout}ms em ${task}`);
                 throw new Error(`Timeout: operação demorou mais de ${this.timeout / 1000}s`);
             }
             console.error(`[CottonAPI] Erro em ${task}:`, error);
             throw error;
         }
     }

    // ================== FILE OPERATIONS ==================

    /**
      * Faz upload de um chunk de arquivo
      * @param {number} fileId - ID do arquivo (retornado por createFile)
      * @param {Blob} chunk - Pedaço do arquivo
      * @param {number} chunkIndex - Índice do chunk (0-based)
      * @param {number} totalChunks - Total de chunks
      * @param {string} fileName - Nome original do arquivo
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
      * Cancela upload em andamento e remove arquivo temporário
      * @param {number} fileId - ID do arquivo
      * @returns {Promise<Object>} Status do cancelamento
      */
     static async cancelUpload(fileId) {
         const formData = new FormData();
         formData.append('file_id', fileId);

         const result = await this._request('cotton.file_cancel', formData);
         return result.data;
     }

    /**
     * Finaliza upload de arquivo após todos os chunks
     * @param {number} fileId - ID do arquivo
     * @param {AbortSignal} signal - Sinal de aborto opcional
     * @returns {Promise<Object>} Status da finalização
     */
     static async finalizeUpload(fileId, signal = null) {
         const formData = new FormData();
         formData.append('file_id', fileId);

         const result = await this._request('cotton.file_finalize', formData, signal);
         return result.data;
     }

    /**
     * Atualiza metadados de um arquivo
     * @param {number} fileId - ID do arquivo
     * @param {string} fileName - Novo nome
     * @param {string} description - Nova descrição
     * @param {boolean} openLink - Permitir acesso via link
     * @param {string} allowedUsers - JSON com IDs de usuários permitidos
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
     * Salva conteúdo de arquivo de texto
     * @param {number} fileId - ID do arquivo
     * @param {string} content - Novo conteúdo
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
     * Deleta um arquivo (para trash)
     * @param {number} fileId - ID do arquivo
     * @param {boolean} permanently - Se true, deleta permanentemente
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
     * Recupera um arquivo do trash
     * @param {number} fileId - ID do arquivo
     * @param {number} folderId - ID da pasta para restaurar
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
     * Restaura um arquivo da lixeira (alias para recoverFile)
     * @param {number} fileId - ID do arquivo
     * @param {number} folderId - ID da pasta para restaurar
     * @returns {Promise<Object>} Resultado
     */
    static async fileRecover(fileId, folderId) {
        return this.recoverFile(fileId, folderId);
    }

    /**
     * Restaura uma pasta da lixeira
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
     * Cria uma nova pasta
     * @param {number} parentId - ID da pasta pai
     * @param {string} name - Nome da pasta
     * @param {string} description - Descrição
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
     * Carrega conteúdo de uma pasta
     * @param {number} folderId - ID da pasta
     * @returns {Promise<Object>} { folders: [], files: [], list: hierarchy }
     */
    static async loadItems(folderId) {
        const formData = new FormData();
        formData.append('folder_id', folderId);

        const result = await this._request('cotton.items_load', formData);
        return result.data;
    }

/**
      * Carrega itens da lixeira (trash = 1)
      * @returns {Promise<Object>} { folders_trash: [], files_trash: [] }
      */
    static async loadTrash() {
        const result = await this._request('cotton.trash_load', new FormData());
        return result.data;
    }

    /**
     * Atualiza informações da pasta
     * @param {number} folderId - ID da pasta
     * @param {string} name - Novo nome
     * @param {string} description - Nova descrição
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
     * Deleta uma pasta (para trash)
     * @param {number} folderId - ID da pasta
     * @param {boolean} permanently - Se true, deleta permanentemente
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
     * Recupera uma pasta do trash
     * @param {number} folderId - ID da pasta
     * @param {number} parentId - ID da pasta pai para restaurar
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
     * Move uma pasta para outro pai
     * @param {number} folderId - ID da pasta a mover
     * @param {number} newParentId - ID da nova pasta pai
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
     * Move um arquivo para outra pasta
     * @param {number} fileId - ID do arquivo
     * @param {number} folderId - ID da pasta destino
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
     * Obtém URL de preview/abertura de um arquivo
     * @param {number} fileId - ID do arquivo
     * @returns {string} URL para abrir o arquivo inline
     */
    static getFilePreviewUrl(fileId) {
        return `${this.siteUrl}index.php?option=com_cotton&task=cotton.open&file_id=${fileId}`;
    }

/**
      * Obtém URL de download de um arquivo
      * @param {number} fileId - ID do arquivo
      * @returns {string} URL para download do arquivo
      */
    static getFileDownloadUrl(fileId) {
        return `${this.siteUrl}index.php?option=com_cotton&task=cotton.download&file_id=${fileId}&format=raw&${this.token}=1`;
    }

    /**
      * Limpa toda a lixeira
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

    // ================== EDITOR OPERATIONS ==================

    /**
     * Abre um arquivo no editor de texto
     * @param {number} fileId - ID do arquivo
     * @param {string} fileExt - Extensão do arquivo
     * @returns {Promise<Object>} { content: string, mode: 'javascript'|'css'|... }
     */
    static async openEditor(fileId, fileExt) {
        const formData = new FormData();
        formData.append('file_id', fileId);
        formData.append('file_ext', fileExt);

        const result = await this._request('cotton.open_editor', formData);
        return result.data;
    }

}

if (typeof window !== 'undefined') {
    window.CottonAPI = CottonAPI;
}
