/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

import { CottonAPI } from './CottonAPI.js';
import { CottonStorage } from './CottonStorage.js';

/**
 * CottonUploader - Gerenciador de upload com suporte a chunks
 * Implementa resumable upload e rastreamento de progresso
 * 
 * @class
 * @example
 * const result = await CottonUploader.uploadFile(file, folderId, (progress) => {
 *   console.log(`Progresso: ${progress}%`);
 * });
 */
export class CottonUploader {
    static CHUNK_SIZE = 4 * 1024 * 1024; // 4MB (configurável)
    static MAX_RETRIES = 3;
    static RETRY_DELAY = 1000; // ms
    static #uploadController = new AbortController();
    static #activeFileIds = new Set();

    /**
     * Configurar tamanho de chunk (em bytes)
     * @param {number} bytes 
     */
    static setChunkSize(bytes) {
        this.CHUNK_SIZE = bytes;
    }

    /**
     * Faz upload de um arquivo com divisão em chunks
     * @param {File} file - Arquivo a fazer upload
     * @param {number} folderId - Pasta destino
     * @param {Function} onProgress - Callback de progresso (0-100)
     * @param {string} description - Descrição do arquivo
     * @returns {Promise<Object>} { fileId, success, totalSize, chunksUploaded }
     */
      static async uploadFile(file, folderId, onProgress = null, description = '') {
          try {
              // Upload direto usando file_upload (não usa file_create)
              console.log(`[CottonUploader] Iniciando upload: ${file.name} (${this.#formatSize(file.size)}) para pasta ${folderId}`);
              
              // Determinar se precisa chunked ou single upload
              if (file.size <= this.CHUNK_SIZE) {
                  // Upload único
                  return await this.#uploadSingleChunk(file, 0, folderId, onProgress);
              } else {
                  // Upload com chunks
                  return await this.#uploadMultipleChunks(file, 0, folderId, onProgress);
              }
          } catch (error) {
              if (error.message !== 'Upload cancelado') {
                  console.error('[CottonUploader] Erro ao fazer upload:', error);
              }
              throw error;
          }
      }

    /**
     * Upload de arquivo único (sem chunks)
     * @private
     */
     static async #uploadSingleChunk(file, chunkIndex, folderId, onProgress) {
         try {
             CottonStorage.setUploadProgress(0, 50, 'uploading');
             
             const result = await CottonAPI.uploadChunk(
                 0,  // fileId = 0 para criar novo arquivo
                 file,
                 chunkIndex,
                 1,
                 file.name,
                 folderId,
                 CottonUploader.#uploadController.signal
             );

             if (result?.success === false) {
                 throw new Error(result?.error || 'Erro ao enviar arquivo');
             }

             const fileId = result?.file_id || result?.file?.[0]?.id || result?.id;
             if (!fileId) {
                 throw new Error('Erro ao obter o ID do arquivo enviado');
             }

              CottonUploader.#activeFileIds.add(fileId);
              CottonStorage.completeUpload(fileId);
              CottonStorage.updateFile(fileId, result);

              onProgress?.(100);

              return {
                  fileId,
                  success: true,
                  totalSize: file.size,
                  chunksUploaded: 1,
                  result
              };
         } catch (error) {
             CottonStorage.failUpload(0, error.message);
             throw error;
         }
     }

    /**
     * Upload com múltiplos chunks
     * @private
     */
    static async #uploadMultipleChunks(file, chunkIndex, folderId, onProgress) {
        const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
        let chunksUploaded = 0;
        let fileId = 0;  // 0 = criar novo arquivo

        console.log(`[CottonUploader] Dividindo em ${totalChunks} chunks`);

        try {
            for (let i = 0; i < totalChunks; i++) {
                const start = i * this.CHUNK_SIZE;
                const end = Math.min(start + this.CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                
                // Upload com retry - captura o fileId da primeira execução
                const result = await this.#uploadChunkWithRetry(
                    fileId,
                    chunk,
                    i,
                    totalChunks,
                    file.name,
                    folderId,
                    CottonUploader.#uploadController.signal
                );

                // Na primeira execução, obter o fileId criado
                const uploadedFileId = result?.file_id || result?.file?.[0]?.id || result?.id;
                if (uploadedFileId) {
                    fileId = uploadedFileId;
                    CottonUploader.#activeFileIds.add(fileId);
                }

                if (!fileId) {
                    throw new Error('Erro ao obter o ID do arquivo enviado');
                }

                chunksUploaded++;
                const progress = Math.round((chunksUploaded / totalChunks) * 100);
                
                CottonStorage.setUploadProgress(fileId || 0, progress, 'uploading');
                onProgress?.(progress);

            }

            CottonStorage.completeUpload(fileId);
            onProgress?.(100);

            return {
                fileId,
                success: true,
                totalSize: file.size,
                chunksUploaded,
                chunkSize: this.CHUNK_SIZE
            };
        } catch (error) {
            CottonStorage.failUpload(fileId || 0, `Erro no chunk ${chunksUploaded + 1}/${totalChunks}`);
            throw error;
        } finally {
            if (fileId) {
                CottonUploader.#activeFileIds.delete(fileId);
            }
        }
    }

    /**
     * Upload de chunk com retry automático
     * @private
     */
     static async #uploadChunkWithRetry(fileId, chunk, chunkIndex, totalChunks, fileName, folderId, signal, attempt = 0) {
         try {
             return await CottonAPI.uploadChunk(
                 fileId,
                 chunk,
                 chunkIndex,
                 totalChunks,
                 fileName,
                 folderId,
                 signal
             ).then(result => {
                 if (result?.success === false) {
                     throw new Error(result?.error || 'Erro ao enviar chunk');
                 }
                 return result;
             });
         } catch (error) {
             if (error.message === 'Upload cancelado') {
                 throw error;
             }
             if (attempt < this.MAX_RETRIES) {
                 console.warn(
                     `[CottonUploader] Tentativa ${attempt + 1}/${this.MAX_RETRIES} falhou, retry em ${this.RETRY_DELAY}ms`,
                     error.message
                 );
                 
                 await this.#delay(this.RETRY_DELAY);
                 return await this.#uploadChunkWithRetry(
                     fileId,
                     chunk,
                     chunkIndex,
                     totalChunks,
                     fileName,
                     folderId,
                     signal,
                     attempt + 1
                 );
             } else {
                 throw new Error(`Falha no chunk ${chunkIndex}/${totalChunks} após ${this.MAX_RETRIES} tentativas`);
             }
         }
     }

    /**
     * Pausa um upload (placeholder para futura implementação)
     * @param {number} fileId 
     */
    static pauseUpload(fileId) {
        // TODO: Implementar pausa via AbortController
        const upload = CottonStorage.getUploadProgress(fileId);
        if (upload.status === 'uploading') {
            CottonStorage.setUploadProgress(fileId, upload.progress, 'paused');
        }
    }

    /**
     * Retoma um upload pausado
     * @param {number} fileId 
     */
    static resumeUpload(fileId) {
        // TODO: Implementar retomada
        const upload = CottonStorage.getUploadProgress(fileId);
        if (upload.status === 'paused') {
            CottonStorage.setUploadProgress(fileId, upload.progress, 'uploading');
        }
    }

    /**
      * Cancela um upload
      * @param {number} fileId 
      */
     static cancelUpload(fileId) {
         CottonUploader.#abortUploadController();
         CottonStorage.clearUpload(fileId);
         console.log(`[CottonUploader] Upload ${fileId} cancelado`);
     }

     /**
      * Cancela todos os uploads em andamento
      */
      static async cancelAllUploads() {
          CottonUploader.#abortUploadController();
          
          const fileIds = Array.from(CottonUploader.#activeFileIds);
          CottonUploader.#activeFileIds.clear();
          
          for (const fileId of fileIds) {
              CottonStorage.clearUpload(fileId);
              try {
                  await CottonAPI.cancelUpload(fileId);
              } catch (e) {
                  console.warn('[CottonUploader] Falha ao cancelar upload no servidor:', fileId, e);
              }
          }
          
          console.log('[CottonUploader] Todos os uploads cancelados');
      }

     static #abortUploadController() {
         if (CottonUploader.#uploadController && !CottonUploader.#uploadController.signal.aborted) {
             CottonUploader.#uploadController.abort();
         }
         CottonUploader.#uploadController = new AbortController();
     }

    /**
     * Faz upload de múltiplos arquivos em paralelo
     * @param {File[]} files - Array de arquivos
     * @param {number} folderId - Pasta destino
     * @param {Function} onProgress - Callback com progresso total
     * @param {number} maxParallel - Máximo de uploads simultâneos (padrão 3)
     * @returns {Promise<Array>} Array de resultados
     */
    static async uploadMultiple(files, folderId, onProgress = null, maxParallel = 3) {
        const results = [];
        let completed = 0;
        const total = files.length;

        // Fila de uploads
        const queue = [...files];
        let activeUploads = 0;

        return new Promise((resolve, reject) => {
            const processQueue = async () => {
                while (queue.length > 0 && activeUploads < maxParallel) {
                    activeUploads++;
                    const file = queue.shift();

                    try {
                        const result = await this.uploadFile(
                            file,
                            folderId,
                            null, // não usar progresso individual
                            ''
                        );
                        results.push(result);
                        completed++;
                        onProgress?.((completed / total) * 100);
                    } catch (error) {
                        results.push({
                            file: file.name,
                            success: false,
                            error: error.message
                        });
                        completed++;
                        onProgress?.((completed / total) * 100);
                    } finally {
                        activeUploads--;
                        if (queue.length > 0) {
                            processQueue();
                        } else if (activeUploads === 0) {
                            resolve(results);
                        }
                    }
                }
            };

            processQueue();
        });
    }

    /**
     * Retoma uploads interrompidos (placeholder)
     * @param {number} folderId 
     * @returns {Promise<Array>}
     */
    static async resumePendingUploads(folderId) {
        const pending = CottonStorage.getPendingUploads();
        const results = [];

        for (const [fileId, upload] of Object.entries(pending)) {
            // TODO: Implementar lógica de retomada
            console.log(`[CottonUploader] Retomando upload ${fileId}`);
        }

        return results;
    }

    /**
     * Formata tamanho de arquivo
     * @private
     */
    static #formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Delay helper
     * @private
     */
    static #delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obter estimativa de tempo restante
     * @param {number} fileSize - Tamanho do arquivo em bytes
     * @param {number} uploadedSize - Tamanho já enviado
     * @param {number} startTime - Timestamp inicial
     * @returns {string} Tempo estimado (ex: "2m 30s")
     */
    static estimateTimeRemaining(fileSize, uploadedSize, startTime) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = uploadedSize / elapsed; // bytes/s
        const remaining = fileSize - uploadedSize;
        const timeRemaining = remaining / speed; // segundos

        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);

        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }

    /**
     * Calcular velocidade de upload
     * @param {number} uploadedSize - Bytes enviados
     * @param {number} startTime - Timestamp inicial
     * @returns {string} Velocidade (ex: "2.5 MB/s")
     */
    static calculateSpeed(uploadedSize, startTime) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speedBps = uploadedSize / elapsed;
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        let speed = speedBps;
        let unitIndex = 0;

        while (speed >= 1024 && unitIndex < units.length - 1) {
            speed /= 1024;
            unitIndex++;
        }

        return `${speed.toFixed(2)} ${units[unitIndex]}`;
    }
}
