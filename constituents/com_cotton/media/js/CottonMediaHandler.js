/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * CottonMediaHandler - Gerencia streaming, preview e manipulação de mídia
 * Suporta vídeo, áudio e imagem com resoluções dinâmicas.
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
     * Construtor
     * @param {number|string} fileId - ID do arquivo
     * @param {string} mimeType - Tipo MIME do arquivo
     * @param {string} fileName - Nome do arquivo
     * @param {Object} options - Configurações
     *   @param {string} [options.quality='auto'] - Qualidade: 'low', 'medium', 'high', 'auto'
     *   @param {boolean} [options.autoPlay=false] - Auto-play de mídia
     *   @param {boolean} [options.loop=false] - Loop de mídia
     *   @param {boolean} [options.muted=false] - Iniciar mutado
     *   @param {Object} [options.metadata=null] - Metadados das mídias/versões
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
     * Cria elemento de mídia HTML5 (vídeo, áudio ou imagem)
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

            throw new Error(`Tipo de mídia não suportado: ${this.#mimeType}`);
        } catch (error) {
            console.error('[CottonMediaHandler] Erro ao criar elemento:', error);
            this.#emit('error', error);
            this.#showErrorModal(error.message);
            throw error;
        }
    }

    /**
     * Métodos privados para criação de Vídeo/Áudio (DRY)
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
        element.crossOrigin = 'anonymous'; // Previne problemas de CORS em gravações/canvas

        if (isVideo) {
            element.style.width = '100%';
            element.style.height = 'auto';
            element.style.maxHeight = '100%';
        }

        // Adicionar source
        const source = document.createElement('source');
        source.src = await this.#getMediaUrl();
        source.type = this.#mimeType;
        element.appendChild(source);

        // Fallback seguro usando nó de texto
        const fallbackText = document.createTextNode(
            `Seu navegador não suporta o elemento ${tagName}.`
        );
        element.appendChild(fallbackText);

        // Event Listeners unificados
        this.#bindMediaEvents(element, isVideo);

        this.#mediaElement = element;
        return element;
    }

    /**
     * Registra os eventos no elemento de mídia HTML5
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
            console.error(`[CottonMediaHandler] Erro na mídia (${element.tagName}):`, e);
            this.#emit('error', new Error(`Erro ao reproduzir ${element.tagName.toLowerCase()}`));
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
     * Cria elemento de imagem
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
            console.error('[CottonMediaHandler] Erro ao carregar imagem:', e);
            this.#emit('error', new Error('Erro ao carregar imagem'));
        });

        this.#mediaElement = img;
        return img;
    }

    /**
     * Obtém URL de mídia com qualidade apropriada
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
     * Determina qualidade ideal baseada na conexão do usuário
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
     * Obtém thumbnail da mídia
     * @returns {Promise<string>} URL do thumbnail
     */
    async getThumbnail() {
        try {
            if (this.#metadata?.thumbnail_url) {
                return this.#metadata.thumbnail_url;
            }
            const basePath = typeof Joomla !== 'undefined' && Joomla.getOptions ? Joomla.getOptions('system.paths').rootFull : '';
            return `${basePath}index.php?option=com_cotton&task=cotton.thumbnail&file_id=${this.#fileId}&size=medium`;
        } catch (error) {
            console.error('[CottonMediaHandler] Erro ao obter thumbnail:', error);
            return null;
        }
    }

    /**
     * Extrai frames de vídeo em background sem afetar a reprodução do usuário
     * @param {number} timestamp - Tempo em segundos
     * @param {number} [timeoutMs=5000] - Limite de tempo de espera em milissegundos
     * @returns {Promise<Blob>}
     */
    async extractFrame(timestamp, timeoutMs = 5000) {
        if (!this.#mimeType.startsWith('video/')) {
            throw new Error('Operação só disponível para vídeos');
        }

        // Utiliza um elemento offscreen para não interferir na reprodução atual
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
                            reject(new Error('Falha ao gerar Blob do canvas'));
                        }
                    }, 'image/png');
                } catch (err) {
                    cleanup();
                    reject(err);
                }
            };

            const onError = (e) => {
                cleanup();
                reject(new Error('Erro ao carregar mídia para extração de frame.'));
            };

            timer = setTimeout(() => {
                cleanup();
                reject(new Error('Tempo limite excedido ao buscar frame do vídeo'));
            }, timeoutMs);

            tempVideo.addEventListener('seeked', onSeeked);
            tempVideo.addEventListener('error', onError);
            tempVideo.currentTime = timestamp;
        });
    }

    /**
     * Obtém duração da mídia
     * @returns {number}
     */
    getDuration() {
        return this.#mediaElement?.duration || 0;
    }

    /**
     * Obtém tempo atual de reprodução
     * @returns {number}
     */
    getCurrentTime() {
        return this.#mediaElement?.currentTime || 0;
    }

    /**
     * Define tempo atual de reprodução
     * @param {number} time
     */
    setCurrentTime(time) {
        if (this.#mediaElement && 'currentTime' in this.#mediaElement) {
            this.#mediaElement.currentTime = Math.max(0, Math.min(time, this.getDuration()));
        }
    }

    /**
     * Reproduz mídia
     * @returns {Promise<void>}
     */
    async play() {
        if (this.#mediaElement?.play) {
            return this.#mediaElement.play();
        }
    }

    /**
     * Pausa mídia
     */
    pause() {
        if (this.#mediaElement?.pause) {
            this.#mediaElement.pause();
        }
    }

    /**
     * Define volume (0-1)
     * @param {number} volume
     */
    setVolume(volume) {
        if (this.#mediaElement && 'volume' in this.#mediaElement) {
            this.#mediaElement.volume = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Verifica se está em streaming
     * @returns {boolean}
     */
    isStreaming() {
        return this.#isStreaming;
    }

    /**
     * Emite evento customizado
     * @private
     */
    #emit(event, data) {
        if (this.#listeners[event]) {
            this.#listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`[CottonMediaHandler] Erro em listener de '${event}':`, err);
                }
            });
        }
    }

    #showErrorModal(message) {
        const errorModal = new CottonModal({
            title: 'Erro',
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
     * Adiciona listener de evento
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
     * Remove listener de evento
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback) {
        if (this.#listeners[event]) {
            this.#listeners[event] = this.#listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Destrói a instância e limpa recursos
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