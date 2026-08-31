/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

/**
 * CottonMediaHandler - Manages streaming, preview, and media handling
 * Supports video, audio, and images with dynamic resolutions.
 * 
 * @class
 * @example
 * const handler = new CottonMediaHandler(fileId, 'video/mp4', 'exemplo.mp4', {
 *   quality: 'auto',
 *   autoPlay: false,
 *   onProgress: (metadata) => console.log(metadata)
 * });
 * 
 * const mediaElement = await handler.createMediaElement();
 */
import { CottonModal } from './CottonModal.js';

export class CottonMediaHandler {
    #fileId = null;
    #fileName = null;
    #mimeType = null;
    #options = {};
    #mediaElement = null;
    #metadata = null;
    #isStreaming = false;
    #listeners = {};

    /**
     * Constructor
     * @param {number|string} fileId - File ID
     * @param {string} mimeType - File MIME type
     * @param {string} fileName - File name
     * @param {Object} options - Settings
     *   @param {string} [options.quality='auto'] - Quality: 'low', 'medium', 'high', 'auto'
     *   @param {boolean} [options.autoPlay=false] - Auto-play media
     *   @param {boolean} [options.loop=false] - Media loop
     *   @param {boolean} [options.muted=false] - Start muted
     *   @param {Object} [options.metadata=null] - Media/version metadata
     */
    constructor(fileId, mimeType, fileName, options = {}) {
        this.#fileId = fileId;
        this.#mimeType = mimeType;
        this.#fileName = fileName;
        this.#metadata = options.metadata || null;
        
        this.#options = {
            quality: 'auto',
            autoPlay: false,
            loop: false,
            muted: false,
            ...options
        };
    }

    /**
     * Creates HTML5 media element (video, audio, or image)
     * @returns {Promise<HTMLElement>}
     */
    async createMediaElement() {
        try {
            if (this.#mimeType.startsWith('video/')) {
                return await this.#createPlayerElement('video');
            } else if (this.#mimeType.startsWith('audio/')) {
                return await this.#createPlayerElement('audio');
            } else if (this.#mimeType.startsWith('image/')) {
                return await this.#createImageElement();
            }

            throw new Error(`Unsupported media type: ${this.#mimeType}`);
        } catch (error) {
            console.error('[CottonMediaHandler] Error creating element:', error);
            this.#emit('error', error);
            this.#showErrorModal(error.message);
            throw error;
        }
    }

    /**
     * Private methods for Video/Audio creation (DRY)
     * @private
     */
    async #createPlayerElement(tagName) {
        const isVideo = tagName === 'video';
        const element = document.createElement(tagName);
        
        element.className = isVideo ? 'cotton-video-player' : 'cotton-audio-player';
        element.controls = true;
        element.autoplay = this.#options.autoPlay;
        element.loop = this.#options.loop;
        element.muted = this.#options.muted;
        element.crossOrigin = 'anonymous'; // Prevents CORS issues in recordings/canvas

        if (isVideo) {
            element.style.width = '100%';
            element.style.height = 'auto';
            element.style.maxHeight = '100%';
        }

        // Add source
        const source = document.createElement('source');
        source.src = await this.#getMediaUrl();
        source.type = this.#mimeType;
        element.appendChild(source);

        // Safe fallback using text node
        const fallbackText = document.createTextNode(
            `Your browser does not support the ${tagName} element.`
        );
        element.appendChild(fallbackText);

        // Unified event listeners
        this.#bindMediaEvents(element, isVideo);

        this.#mediaElement = element;
        return element;
    }

    /**
     * Registers events on the HTML5 media element
     * @private
     */
    #bindMediaEvents(element, isVideo) {
        element.addEventListener('play', () => {
            this.#isStreaming = true;
            this.#emit('play');
        });

        element.addEventListener('pause', () => {
            this.#isStreaming = false;
            this.#emit('pause');
        });

        element.addEventListener('ended', () => {
            this.#isStreaming = false;
            this.#emit('ended');
        });

        element.addEventListener('timeupdate', () => {
            this.#emit('timeupdate', {
                currentTime: element.currentTime,
                duration: element.duration || 0
            });
        });

        element.addEventListener('error', (e) => {
            console.error(`[CottonMediaHandler] Media error (${element.tagName}):`, e);
            this.#emit('error', new Error(`Error playing ${element.tagName.toLowerCase()}`));
        });

        element.addEventListener('loadedmetadata', () => {
            const payload = { duration: element.duration };
            if (isVideo) {
                payload.width = element.videoWidth;
                payload.height = element.videoHeight;
            }
            this.#emit('loaded', payload);
        });
    }

    /**
     * Creates image element
     * @private
     */
    async #createImageElement() {
        const img = document.createElement('img');
        img.className = 'cotton-image-viewer';
        img.alt = this.#fileName;
        img.src = await this.#getMediaUrl();

        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';

        img.addEventListener('load', () => {
            this.#emit('loaded', {
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        });

        img.addEventListener('error', (e) => {
            console.error('[CottonMediaHandler] Error loading image:', e);
            this.#emit('error', new Error('Error loading image'));
        });

        this.#mediaElement = img;
        return img;
    }

    /**
     * Gets media URL with appropriate quality
     * @private
     */
    async #getMediaUrl() {
        const basePath = typeof Joomla !== 'undefined' && Joomla.getOptions ? Joomla.getOptions('system.paths').rootFull : '';
        let url = `${basePath}index.php?option=com_cotton&task=cotton.open&file_id=${this.#fileId}&format=raw`;

        if (this.#metadata?.versions) {
            const quality = this.#determineQuality();
            if (this.#metadata.versions[quality]) {
                url += `&version=${quality}`;
            }
        }

        return url;
    }

    /**
     * Determines ideal quality based on user connection
     * @private
     */
    #determineQuality() {
        if (this.#options.quality !== 'auto') {
            return this.#options.quality;
        }

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!connection) return 'medium';

        const { effectiveType, downlink } = connection;
        const speed = downlink || 10;

        if (effectiveType === '4g' && speed > 5) return 'high';
        if (effectiveType === '3g' || speed > 1) return 'medium';
        return 'low';
    }

    /**
     * Gets media thumbnail
     * @returns {Promise<string>} Thumbnail URL
     */
    async getThumbnail() {
        try {
            if (this.#metadata?.thumbnail_url) {
                return this.#metadata.thumbnail_url;
            }
            const basePath = typeof Joomla !== 'undefined' && Joomla.getOptions ? Joomla.getOptions('system.paths').rootFull : '';
            return `${basePath}index.php?option=com_cotton&task=cotton.thumbnail&file_id=${this.#fileId}&size=medium`;
        } catch (error) {
            console.error('[CottonMediaHandler] Error getting thumbnail:', error);
            return null;
        }
    }

    /**
     * Extracts video frames in background without affecting playback
     * @param {number} timestamp - Time in seconds
     * @param {number} [timeoutMs=5000] - Timeout limit in milliseconds
     * @returns {Promise<Blob>}
     */
    async extractFrame(timestamp, timeoutMs = 5000) {
        if (!this.#mimeType.startsWith('video/')) {
            throw new Error('Operation only available for videos');
        }

        // Uses an offscreen element to avoid interfering with current playback
        const tempVideo = document.createElement('video');
        tempVideo.crossOrigin = 'anonymous';
        tempVideo.src = await this.#getMediaUrl();

        return new Promise((resolve, reject) => {
            let timer = null;

            const cleanup = () => {
                clearTimeout(timer);
                tempVideo.removeEventListener('seeked', onSeeked);
                tempVideo.removeEventListener('error', onError);
                tempVideo.src = '';
                tempVideo.load();
            };

            const onSeeked = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = tempVideo.videoWidth;
                    canvas.height = tempVideo.videoHeight;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(tempVideo, 0, 0);

                    canvas.toBlob((blob) => {
                        cleanup();
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to generate canvas Blob'));
                        }
                    }, 'image/png');
                } catch (err) {
                    cleanup();
                    reject(err);
                }
            };

            const onError = (e) => {
                cleanup();
                reject(new Error('Error loading media for frame extraction.'));
            };

            timer = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout exceeded while fetching video frame'));
            }, timeoutMs);

            tempVideo.addEventListener('seeked', onSeeked);
            tempVideo.addEventListener('error', onError);
            tempVideo.currentTime = timestamp;
        });
    }

    /**
     * Gets media duration
     * @returns {number}
     */
    getDuration() {
        return this.#mediaElement?.duration || 0;
    }

    /**
     * Gets current playback time
     * @returns {number}
     */
    getCurrentTime() {
        return this.#mediaElement?.currentTime || 0;
    }

    /**
     * Sets current playback time
     * @param {number} time
     */
    setCurrentTime(time) {
        if (this.#mediaElement && 'currentTime' in this.#mediaElement) {
            this.#mediaElement.currentTime = Math.max(0, Math.min(time, this.getDuration()));
        }
    }

    /**
     * Plays media
     * @returns {Promise<void>}
     */
    async play() {
        if (this.#mediaElement?.play) {
            return this.#mediaElement.play();
        }
    }

    /**
     * Pauses media
     */
    pause() {
        if (this.#mediaElement?.pause) {
            this.#mediaElement.pause();
        }
    }

    /**
     * Sets volume (0-1)
     * @param {number} volume
     */
    setVolume(volume) {
        if (this.#mediaElement && 'volume' in this.#mediaElement) {
            this.#mediaElement.volume = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Checks if streaming
     * @returns {boolean}
     */
    isStreaming() {
        return this.#isStreaming;
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
                    console.error(`[CottonMediaHandler] Error in '${event}' listener:`, err);
                }
            });
        }
    }

    #showErrorModal(message) {
        const errorModal = new CottonModal({
            title: 'Error',
            icon: 'icon-cancel',
            width: '420px',
            height: '200px',
            body: `<span style="color: var(--cot-red); margin: 10px; font-size: small;">${message}</span>`,
            showFooter: true,
            showCancel: false,
            showSubmit: true,
            submitText: 'OK',
            submitClass: 'cotton-btn-primary',
            onSubmit: () => errorModal.close()
        });
        errorModal.open();
    }

    /**
     * Adds event listener
     * @param {string} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (typeof callback !== 'function') return;
        if (!this.#listeners[event]) {
            this.#listeners[event] = [];
        }
        this.#listeners[event].push(callback);
    }

    /**
     * Removes event listener
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback) {
        if (this.#listeners[event]) {
            this.#listeners[event] = this.#listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Destroys the instance and cleans up resources
     */
    destroy() {
        if (this.#mediaElement) {
            if ('pause' in this.#mediaElement) {
                this.#mediaElement.pause();
            }
            this.#mediaElement.src = '';
            if ('load' in this.#mediaElement) {
                this.#mediaElement.load();
            }
            this.#mediaElement = null;
        }
        this.#listeners = {};
        this.#isStreaming = false;
    }
}

if (typeof window !== 'undefined') {
    window.CottonMediaHandler = CottonMediaHandler;
}