/**
 * @package     Tabaoca.Plugin.Cotton
 * @subpackage  Editors-xtd.cotton
 *
 * @copyright   (C) 2024 Tabaoca Soft.
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 */

/**
 * Cotton Media Button Handler
 *
 * Opens CottonUIManager inside a CottonModal to pick a file,
 * then uses CottonMediaHandler to generate the appropriate HTML
 * and inserts it into the active editor.
 *
 * @namespace   CottonMediaButton
 * @since       1.0
 */
const CottonMediaButton = {
    /**
     * Current editor field being populated
     *
     * @type {string}
     */
    currentFieldName: null,

    /**
     * Open the Cotton modal with the UI Manager to select a file
     * and insert the generated media HTML into the editor.
     *
     * @param   {string}  fieldName  The name of the editor field
     * @return  {void}
     * @since   1.0
     */
    openPicker: async function (fieldName) {
        if (!window.CottonModal) {
            alert(Joomla.Text._('PLG_EDITORS_XTD_COTTON_ERROR_MODAL_NOT_AVAILABLE'));
            console.error('[CottonMediaButton] CottonModal is not available');
            return;
        }

        this.currentFieldName = fieldName;

        let selectedFile = null;
        let pickerManager = null;

        try {
            const config = Joomla.getOptions('cotton_config');
            const limits = Joomla.getOptions('cotton_limits');
            const tree = Joomla.getOptions('cotton_tree');
            const items = Joomla.getOptions('cotton_items');

            const modal = new CottonModal({
                title: Joomla.Text._('PLG_EDITORS_XTD_COTTON_PICKER_TITLE'),
                icon: window.CottonUIManager.getMimeIcon('image', { size: 'fa-1x', colored: true }),
                width: '800px',
                height: '480px',
                body: `<div id="cotton_picker_container"></div>`,
                showFooter: true,
                showCancel: true,
                showSubmit: true,
                submitText: Joomla.Text._('PLG_EDITORS_XTD_COTTON_BUTTON_INSERT'),
                onOpen: async () => {
                    const pickerContainer = document.getElementById('cotton_picker_container');
                    if (!pickerContainer) {
                        return;
                    }

                    pickerManager = new window.CottonUIManager(pickerContainer, {
                        siteUrl: config.siteUrl,
                        admin: config.admin,
                        token: config.token,
                        treeData: tree,
                        itemsData: items,
                        limits: limits,
                        pickMode: 'file',
                        autoOpenFile: false
                    });

                    pickerManager.on('file:doubleClicked', (file) => {
                        selectedFile = file;
                        const modalEl = modal.getElement();
                        const submitBtn = modalEl ? modalEl.querySelector('.cotton-modal-submit') : null;
                        if (submitBtn) {
                            submitBtn.click();
                        }
                    });

                    pickerManager.on('file:selected', (data) => {
                        selectedFile = data.file;
                    });

                    await pickerManager.initialize();
                },
                onSubmit: async () => {
                    if (!selectedFile) {
                        alert(Joomla.Text._('PLG_EDITORS_XTD_COTTON_ERROR_SELECT_FILE'));
                        return false;
                    }

                    const htmlElement = await this.generateMediaElement(selectedFile);

                    if (!htmlElement) {
                        alert(Joomla.Text._('PLG_EDITORS_XTD_COTTON_ERROR_GENERATE_MEDIA'));
                        return false;
                    }

                    this.insertIntoEditor(fieldName, htmlElement);
                },
                onClose: () => {
                    if (pickerManager) {
                        pickerManager.destroy();
                        pickerManager = null;
                    }
                    selectedFile = null;
                }
            });

            modal.open();
        } catch (error) {
            console.error('[CottonMediaButton] Error:', error);
            alert(Joomla.Text._('PLG_EDITORS_XTD_COTTON_ERROR_PICKER') + ': ' + error.message);
        }
    },

    /**
     * Generate HTML for the selected media using CottonMediaHandler
     *
     * @param   {Object}  mediaFile  The file object from CottonUIManager
     * @return  {string}  HTML element as string
     * @since   1.0
     */
    generateMediaElement: async function (mediaFile) {
        const name = mediaFile.name || '';
        const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

        const mimeType =
            mediaFile.mime_type ||
            mediaFile.mimeType ||
            (typeof window.CottonHelper !== 'undefined' && window.CottonHelper.extensionToMime
                ? window.CottonHelper.extensionToMime(ext)
                : ext
                    ? 'application/' + ext
                    : 'application/octet-stream');

        if (!window.CottonMediaHandler) {
            return this.generateLegacyElement(mediaFile);
        }

        try {
            const mediaHandler = new window.CottonMediaHandler(
                mediaFile.id,
                mimeType,
                name,
                {
                    autoPlay: false
                }
            );

            const mediaElement = await mediaHandler.createMediaElement();
            return mediaElement.outerHTML;
        } catch (error) {
            console.warn('[CottonMediaButton] CottonMediaHandler failed, falling back:', error);
            return this.generateLegacyElement(mediaFile);
        }
    },

    /**
     * Legacy fallback generator for unsupported media types
     *
     * @param   {Object}  mediaFile  The file object from CottonUIManager
     * @return  {string}  HTML element as string
     * @since   1.0
     */
    generateLegacyElement: function (mediaFile) {
        const { name, mime_type: mimeType, url } = mediaFile;
        const type = (mimeType || '').split('/')[0];

        switch (type) {
            case 'image':
                return this.generateImageElement(name, url);

            case 'video':
                return this.generateVideoElement(name, url);

            case 'audio':
                return this.generateAudioElement(name, url);

            case 'application':
                if (mimeType === 'application/pdf') {
                    return this.generatePdfElement(name, url);
                }
                return this.generateDownloadLink(name, url);

            default:
                return this.generateDownloadLink(name, url);
        }
    },

    /**
     * Generate an <img> element for images
     *
     * @param   {string}  fileName  The file name
     * @param   {string}  url       The file URL
     * @return  {string}  HTML element
     * @since   1.0
     */
    generateImageElement: function (fileName, url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = this.sanitizeAlt(fileName);
        img.style.maxWidth = '100%';
        img.style.height = 'auto';

        return img.outerHTML;
    },

    /**
     * Generate a <video> element for videos
     *
     * @param   {string}  fileName  The file name
     * @param   {string}  url       The file URL
     * @return  {string}  HTML element
     * @since   1.0
     */
    generateVideoElement: function (fileName, url) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.style.maxWidth = '100%';
        video.style.height = 'auto';

        const source = document.createElement('source');
        source.src = url;
        source.type = this.getMimeTypeForExtension(fileName);

        video.appendChild(source);

        const fallback = document.createTextNode(
            Joomla.Text._('PLG_EDITORS_XTD_COTTON_VIDEO_NOT_SUPPORTED')
        );
        video.appendChild(fallback);

        return video.outerHTML;
    },

    /**
     * Generate an <audio> element for audio files
     *
     * @param   {string}  fileName  The file name
     * @param   {string}  url       The file URL
     * @return  {string}  HTML element
     * @since   1.0
     */
    generateAudioElement: function (fileName, url) {
        const audio = document.createElement('audio');
        audio.src = url;
        audio.controls = true;
        audio.style.width = '100%';

        const source = document.createElement('source');
        source.src = url;
        source.type = this.getMimeTypeForExtension(fileName);

        audio.appendChild(source);

        const fallback = document.createTextNode(
            Joomla.Text._('PLG_EDITORS_XTD_COTTON_AUDIO_NOT_SUPPORTED')
        );
        audio.appendChild(fallback);

        return audio.outerHTML;
    },

    /**
     * Generate an <embed> element for PDFs
     *
     * @param   {string}  fileName  The file name
     * @param   {string}  url       The file URL
     * @return  {string}  HTML element
     * @since   1.0
     */
    generatePdfElement: function (fileName, url) {
        const container = document.createElement('div');
        container.style.maxWidth = '100%';
        container.style.margin = '20px 0';

        const embed = document.createElement('embed');
        embed.src = url;
        embed.type = 'application/pdf';
        embed.width = '100%';
        embed.height = '600px';

        container.appendChild(embed);

        return container.outerHTML;
    },

    /**
     * Generate a download link for unsupported file types
     *
     * @param   {string}  fileName  The file name
     * @param   {string}  url       The file URL
     * @return  {string}  HTML element
     * @since   1.0
     */
    generateDownloadLink: function (fileName, url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.textContent = fileName;
        link.title = Joomla.Text._('PLG_EDITORS_XTD_COTTON_DOWNLOAD_FILE') + ': ' + fileName;

        return link.outerHTML;
    },

    /**
     * Sanitize text for use as alt attribute
     *
     * @param   {string}  text  The text to sanitize
     * @return  {string}  Sanitized text
     * @since   1.0
     */
    sanitizeAlt: function (text) {
        const withoutExt = text.replace(/\.[^/.]+$/, '');
        const withSpaces = withoutExt.replace(/[-_]/g, ' ');
        return withSpaces
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    },

    /**
     * Get MIME type based on file extension
     *
     * @param   {string}  fileName  The file name
     * @return  {string}  MIME type
     * @since   1.0
     */
    getMimeTypeForExtension: function (fileName) {
        const ext = fileName.split('.').pop().toLowerCase();

        const mimeMap = {
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',
            'mov': 'video/quicktime',
            'mpeg': 'video/mpeg',

            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'm4a': 'audio/mp4',
            'flac': 'audio/flac',

            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml'
        };

        return mimeMap[ext] || 'application/octet-stream';
    },

    /**
     * Insert HTML element into editor
     *
     * Supports TinyMCE, Joomla editor API, and plain textarea.
     *
     * @param   {string}  fieldName     The editor field name
     * @param   {string}  htmlElement   The HTML to insert
     * @return  {boolean} True if successfully inserted
     * @since   1.0
     */
    insertIntoEditor: function (fieldName, htmlElement) {
        if (typeof tinymce !== 'undefined') {
            const editor = tinymce.get(fieldName);
            if (editor) {
                editor.insertContent(htmlElement);
                return true;
            }
        }

        if (typeof Joomla.editors !== 'undefined' && Joomla.editors.instances) {
            const editorInstance = Joomla.editors.instances[fieldName];
            if (editorInstance && typeof editorInstance.insertText === 'function') {
                editorInstance.insertText(htmlElement);
                return true;
            }
        }

        const textareaElement = document.getElementById(fieldName);
        if (textareaElement && textareaElement.tagName === 'TEXTAREA') {
            const cursorPosition = textareaElement.selectionStart || textareaElement.value.length;
            const beforeText = textareaElement.value.substring(0, cursorPosition);
            const afterText = textareaElement.value.substring(cursorPosition);

            textareaElement.value = beforeText + htmlElement + afterText;
            textareaElement.selectionStart = cursorPosition + htmlElement.length;
            textareaElement.selectionEnd = textareaElement.selectionStart;

            textareaElement.dispatchEvent(new Event('change', { bubbles: true }));

            return true;
        }

        console.error('Could not find editor instance for field: ' + fieldName);
        alert(Joomla.Text._('PLG_EDITORS_XTD_COTTON_ERROR_EDITOR_NOT_FOUND'));

        return false;
    }
};

window.CottonMediaButton = CottonMediaButton;
