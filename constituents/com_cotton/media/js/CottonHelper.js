/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * CottonHelper - Utilitários para o Cotton Cloud
 * 
 * Fornece funções auxiliares para:
 * - Reconhecimento MIME e ícones visuais (FontAwesome)
 * - Formatação de tamanhos de arquivo
 * - Detecção de tipo de mídia
 * - Cores por categoria de arquivo
 * 
 * @class
 * @example
 * import { CottonHelper } from './CottonHelper.js';
 * 
 * const icon = CottonHelper.getMimeIcon('image/png');
 * // Returns: '<i class="fa-regular fa-file-image cotton-icon-image"></i>'
 * 
 * const category = CottonHelper.getFileCategory('video/mp4');
 * // Returns: 'video'
 */
export class CottonHelper {

    /**
     * Mapa de tipos MIME para classes de ícone FontAwesome
     * @private
     * @type {Object}
     */
    static #mimeIconMap = {
        // Folders
        'folder':           { icon: 'fa-solid fa-folder',           color: '#f0c040', category: 'folder' },
        'folder-open':      { icon: 'fa-solid fa-folder-open',      color: '#f0c040', category: 'folder' },

        // Images
        'image/jpeg':       { icon: 'fa-regular fa-file-image',     color: '#4caf50', category: 'image' },
        'image/jpg':        { icon: 'fa-regular fa-file-image',     color: '#4caf50', category: 'image' },
        'image/png':        { icon: 'fa-regular fa-file-image',     color: '#4caf50', category: 'image' },
        'image/gif':        { icon: 'fa-regular fa-file-image',     color: '#4caf50', category: 'image' },
        'image/webp':       { icon: 'fa-regular fa-file-image',     color: '#4caf50', category: 'image' },
        'image/svg+xml':    { icon: 'fa-regular fa-file-image',     color: '#ff9800', category: 'image' },
        'image/bmp':        { icon: 'fa-regular fa-file-image',     color: '#4caf50', category: 'image' },
        'image/tiff':       { icon: 'fa-regular fa-file-image',     color: '#4caf50', category: 'image' },

        // Videos
        'video/mp4':        { icon: 'fa-regular fa-file-video',     color: '#e91e63', category: 'video' },
        'video/webm':       { icon: 'fa-regular fa-file-video',     color: '#e91e63', category: 'video' },
        'video/ogg':        { icon: 'fa-regular fa-file-video',     color: '#e91e63', category: 'video' },
        'video/avi':        { icon: 'fa-regular fa-file-video',     color: '#e91e63', category: 'video' },
        'video/quicktime':  { icon: 'fa-regular fa-file-video',     color: '#e91e63', category: 'video' },

        // Audio
        'audio/mpeg':       { icon: 'fa-regular fa-file-audio',     color: '#9c27b0', category: 'audio' },
        'audio/mp3':        { icon: 'fa-regular fa-file-audio',     color: '#9c27b0', category: 'audio' },
        'audio/wav':        { icon: 'fa-regular fa-file-audio',     color: '#9c27b0', category: 'audio' },
        'audio/ogg':        { icon: 'fa-regular fa-file-audio',     color: '#9c27b0', category: 'audio' },
        'audio/webm':       { icon: 'fa-regular fa-file-audio',     color: '#9c27b0', category: 'audio' },

        // PDF
        'application/pdf':  { icon: 'fa-regular fa-file-pdf',       color: '#f44336', category: 'pdf' },

        // Text / Code
        'text/plain':       { icon: 'fa-regular fa-file-lines',     color: '#607d8b', category: 'text' },
        'text/html':        { icon: 'fa-regular fa-file-code',      color: '#ff5722', category: 'code' },
        'text/css':         { icon: 'fa-regular fa-file-code',      color: '#2196f3', category: 'code' },
        'text/javascript':  { icon: 'fa-regular fa-file-code',      color: '#ffc107', category: 'code' },
        'application/javascript': { icon: 'fa-regular fa-file-code', color: '#ffc107', category: 'code' },
        'application/json': { icon: 'fa-regular fa-file-code',      color: '#8bc34a', category: 'code' },
        'application/xml':  { icon: 'fa-regular fa-file-code',      color: '#ff9800', category: 'code' },
        'text/xml':         { icon: 'fa-regular fa-file-code',      color: '#ff9800', category: 'code' },
        'text/csv':         { icon: 'fa-regular fa-file-csv',       color: '#4caf50', category: 'spreadsheet' },
        'text/markdown':    { icon: 'fa-regular fa-file-lines',     color: '#607d8b', category: 'text' },
        'application/x-httpd-php': { icon: 'fa-regular fa-file-code', color: '#7b1fa2', category: 'code' },

        // Documents
        'application/msword': { icon: 'fa-regular fa-file-word',    color: '#2196f3', category: 'document' },
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 
                            { icon: 'fa-regular fa-file-word',      color: '#2196f3', category: 'document' },
        'application/vnd.oasis.opendocument.text': 
                            { icon: 'fa-regular fa-file-word',      color: '#2196f3', category: 'document' },

        // Spreadsheets
        'application/vnd.ms-excel': { icon: 'fa-regular fa-file-excel', color: '#4caf50', category: 'spreadsheet' },
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 
                            { icon: 'fa-regular fa-file-excel',     color: '#4caf50', category: 'spreadsheet' },
        'application/vnd.oasis.opendocument.spreadsheet': 
                            { icon: 'fa-regular fa-file-excel',     color: '#4caf50', category: 'spreadsheet' },

        // Presentations
        'application/vnd.ms-powerpoint': { icon: 'fa-regular fa-file-powerpoint', color: '#ff5722', category: 'presentation' },
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 
                            { icon: 'fa-regular fa-file-powerpoint', color: '#ff5722', category: 'presentation' },

        // Archives
        'application/zip':  { icon: 'fa-regular fa-file-zipper',    color: '#795548', category: 'archive' },
        'application/x-rar-compressed': { icon: 'fa-regular fa-file-zipper', color: '#795548', category: 'archive' },
        'application/gzip': { icon: 'fa-regular fa-file-zipper',    color: '#795548', category: 'archive' },
        'application/x-tar': { icon: 'fa-regular fa-file-zipper',   color: '#795548', category: 'archive' },
        'application/x-7z-compressed': { icon: 'fa-regular fa-file-zipper', color: '#795548', category: 'archive' },
    };

    /**
     * Mapa de extensões para tipos MIME (fallback)
     * @private
     * @type {Object}
     */
    static #extensionMap = {
        // Images
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'jfif': 'image/jpeg',
        'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
        'svg': 'image/svg+xml', 'bmp': 'image/bmp', 'tiff': 'image/tiff',
        'ico': 'image/x-icon', 'apng': 'image/apng',

        // Videos
        'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg',
        'avi': 'video/avi', 'mov': 'video/quicktime', 'mkv': 'video/x-matroska',

        // Audio
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'flac': 'audio/flac',
        'aac': 'audio/aac', 'm4a': 'audio/mp4',

        // Documents
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'odt': 'application/vnd.oasis.opendocument.text',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ods': 'application/vnd.oasis.opendocument.spreadsheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

        // Code / Text
        'txt': 'text/plain', 'md': 'text/markdown', 'ini': 'text/plain',
        'html': 'text/html', 'htm': 'text/html', 'xhtml': 'text/html',
        'css': 'text/css', 'scss': 'text/css', 'less': 'text/css', 'sass': 'text/css',
        'js': 'text/javascript', 'mjs': 'text/javascript', 'ts': 'text/javascript',
        'json': 'application/json', 'xml': 'application/xml',
        'php': 'application/x-httpd-php', 'py': 'text/plain', 'rb': 'text/plain',
        'java': 'text/plain', 'c': 'text/plain', 'cpp': 'text/plain',
        'csv': 'text/csv', 'sql': 'text/plain', 'sh': 'text/plain',

        // Archives
        'zip': 'application/zip', 'rar': 'application/x-rar-compressed',
        'gz': 'application/gzip', 'tar': 'application/x-tar',
        '7z': 'application/x-7z-compressed',
    };

    /**
     * Retorna o HTML do ícone FontAwesome para um tipo MIME ou extensão.
     * 
     * @param {string} mimeTypeOrExt - Tipo MIME (ex: 'image/png') ou extensão (ex: 'png')
     * @param {Object} options - Opções adicionais
     *   @param {string} options.size - Tamanho FA: 'fa-xs', 'fa-sm', 'fa-lg', 'fa-xl', 'fa-2x'
     *   @param {boolean} options.colored - Se deve aplicar cor (padrão: true)
     *   @param {string} options.extraClass - Classes CSS adicionais
     * @returns {string} HTML do ícone
     */
    static getMimeIcon(mimeTypeOrExt, options = {}) {
        const { size = '', colored = true, extraClass = '' } = options;
        const info = this.#resolveIconInfo(mimeTypeOrExt);
        
        const colorStyle = colored && info.color ? ` style="color: ${info.color}"` : '';
        const sizeClass = size ? ` ${size}` : '';
        const extra = extraClass ? ` ${extraClass}` : '';
        const categoryClass = ` cotton-icon-${info.category}`;

        return `<i class="${info.icon}${sizeClass}${categoryClass}${extra}"${colorStyle}></i>`;
    }

    /**
     * Retorna apenas a classe do ícone FontAwesome para um tipo MIME.
     * 
     * @param {string} mimeTypeOrExt - Tipo MIME ou extensão
     * @returns {string} Classe FontAwesome (ex: 'fa-regular fa-file-image')
     */
    static getMimeIconClass(mimeTypeOrExt) {
        return this.#resolveIconInfo(mimeTypeOrExt).icon;
    }

    /**
     * Retorna a cor associada ao tipo MIME.
     * 
     * @param {string} mimeTypeOrExt - Tipo MIME ou extensão
     * @returns {string} Cor hexadecimal
     */
    static getMimeColor(mimeTypeOrExt) {
        return this.#resolveIconInfo(mimeTypeOrExt).color;
    }

    /**
     * Retorna a categoria do arquivo baseada no tipo MIME.
     * 
     * @param {string} mimeTypeOrExt - Tipo MIME ou extensão
     * @returns {string} Categoria: 'folder', 'image', 'video', 'audio', 'pdf', 'text', 'code', 
     *                   'document', 'spreadsheet', 'presentation', 'archive', 'unknown'
     */
    static getFileCategory(mimeTypeOrExt) {
        return this.#resolveIconInfo(mimeTypeOrExt).category;
    }

    /**
     * Verifica se o tipo MIME é previewável no navegador.
     * 
     * @param {string} mimeType - Tipo MIME
     * @returns {boolean}
     */
    static isPreviewable(mimeType) {
        if (!mimeType) return false;
        const mt = mimeType.toLowerCase();
        return mt.startsWith('image/') || 
               mt.startsWith('video/') || 
               mt.startsWith('audio/') || 
               mt === 'application/pdf';
    }

    /**
     * Verifica se o tipo MIME é editável no CodeMirror.
     * 
     * @param {string} mimeType - Tipo MIME
     * @returns {boolean}
     */
    static isEditable(mimeType) {
        if (!mimeType) return false;
        const mt = mimeType.toLowerCase();
        return mt.startsWith('text/') || 
               mt === 'application/json' || 
               mt === 'application/xml' || 
               mt === 'application/javascript' ||
               mt === 'application/x-httpd-php';
    }

    /**
     * Retorna o tipo de preview para um tipo MIME.
     * 
     * @param {string} mimeType - Tipo MIME
     * @returns {string} 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'none'
     */
    static getPreviewType(mimeType) {
        if (!mimeType) return 'none';
        const mt = mimeType.toLowerCase();
        if (mt.startsWith('image/')) return 'image';
        if (mt.startsWith('video/')) return 'video';
        if (mt.startsWith('audio/')) return 'audio';
        if (mt === 'application/pdf') return 'pdf';
        if (this.isEditable(mt)) return 'text';
        return 'none';
    }

    /**
     * Obtém a extensão de um nome de arquivo.
     * 
     * @param {string} fileName - Nome do arquivo
     * @returns {string} Extensão em minúsculas (sem ponto)
     */
    static getExtension(fileName) {
        if (!fileName) return '';
        const parts = fileName.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    }

    /**
     * Converte extensão para tipo MIME.
     * 
     * @param {string} ext - Extensão do arquivo
     * @returns {string} Tipo MIME ou 'application/octet-stream'
     */
    static extensionToMime(ext) {
        if (!ext) return 'application/octet-stream';
        return this.#extensionMap[ext.toLowerCase()] || 'application/octet-stream';
    }

    /**
     * Formata tamanho de arquivo em formato legível.
     * 
     * @param {number} bytes - Tamanho em bytes
     * @param {number} decimals - Casas decimais (padrão: 1)
     * @returns {string} Tamanho formatado (ex: '2.5 MB')
     */
    static formatSize(bytes, decimals = 1) {
        if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = Math.abs(bytes);
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        const formattedSize = unitIndex === 0 ? size.toFixed(0) : size.toFixed(decimals);

        return `${formattedSize} ${units[unitIndex]}`;
    }

    /**
     * Formata data para exibição.
     * 
     * @param {string} dateStr - Data em formato ISO ou MySQL
     * @returns {string} Data formatada
     */
    static formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Escapa caracteres HTML para prevenir XSS.
     * 
     * @param {string} text - Texto a escapar
     * @returns {string} Texto escapado
     */
    static escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Trunca um nome de item quando excede o comprimento máximo,
     * preservando a extensão do arquivo e os últimos 3 caracteres do nome base.
     * 
     * @param {string} name - Nome do item
     * @param {number} maxLength - Comprimento máximo (padrão: 30)
     * @returns {string} Nome truncado com reticências se necessário
     */
    static truncateName(name, maxLength = 30) {
        const str = String(name ?? '');
        if (str.length <= maxLength) return str;
        const dotIndex = str.lastIndexOf('.');
        if (dotIndex > 0) {
            const ext = str.slice(dotIndex);
            const baseEnd = str.slice(0, dotIndex);
            const last3 = baseEnd.slice(-3);
            const baseMaxLength = maxLength - ext.length - 4;
            if (baseMaxLength > 0) {
                return str.slice(0, baseMaxLength) + '\u2026' + last3 + ext;
            }
        }
        return str.slice(0, maxLength - 1) + '\u2026';
    }

    /**
     * Resolve informações do ícone a partir de MIME type ou extensão.
     * @private
     * @param {string} input - Tipo MIME ou extensão
     * @returns {Object} { icon, color, category }
     */
    static #resolveIconInfo(input) {
        if (!input) {
            return { icon: 'fa-regular fa-file', color: '#9e9e9e', category: 'unknown' };
        }

        const lower = input.toLowerCase().trim();

        // Check direct MIME match
        if (this.#mimeIconMap[lower]) {
            return this.#mimeIconMap[lower];
        }

        // Check if it's a folder type
        if (lower === 'folder' || lower === 'folder-open') {
            return this.#mimeIconMap[lower] || this.#mimeIconMap['folder'];
        }

        // Check by MIME prefix (e.g., 'image/*')
        if (lower.includes('/')) {
            const prefix = lower.split('/')[0];
            const prefixMap = {
                'image':  { icon: 'fa-regular fa-file-image',  color: '#4caf50', category: 'image' },
                'video':  { icon: 'fa-regular fa-file-video',  color: '#e91e63', category: 'video' },
                'audio':  { icon: 'fa-regular fa-file-audio',  color: '#9c27b0', category: 'audio' },
                'text':   { icon: 'fa-regular fa-file-lines',  color: '#607d8b', category: 'text' },
            };
            if (prefixMap[prefix]) {
                return prefixMap[prefix];
            }
        }

        // Check by extension
        if (!lower.includes('/') && lower.length <= 10) {
            const ext = lower.replace(/^\./, '');
            const mime = this.#extensionMap[ext];
            if (mime && this.#mimeIconMap[mime]) {
                return this.#mimeIconMap[mime];
            }
        }

        // Default
        return { icon: 'fa-regular fa-file', color: '#9e9e9e', category: 'unknown' };
    }
}

if (typeof window !== 'undefined') {
    window.CottonHelper = CottonHelper;
}
