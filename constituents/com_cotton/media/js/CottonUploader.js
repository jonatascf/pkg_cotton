/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

import { CottonAPI } from './CottonAPI.js';
import { CottonStorage } from './CottonStorage.js';

/**
 * CottonUploader - Upload manager with chunk support
 * Implements resumable upload and progress tracking
 * 
 * @class
 * @example
 * const result = await CottonUploader.uploadFile(file, folderId, (progress) => {
 *   console.log(`Progress: ${progress}%`);
 * });
 */
export class CottonUploader {
    static CHUNK_SIZE = 4 * 1024 * 1024; // 4MB (configurable)
    static MAX_FILE_SIZE = 0; // 0 = sem limite
    static AVAILABLE_SPACE = Infinity; // Infinity = sem limite
    static MAX_RETRIES = 3;
    static RETRY_DELAY = 1000; // ms
    static #uploadController = new AbortController();
    static #activeFileIds = new Set();

    /**
     * Configure chunk size (in bytes)
     * @param {number} bytes
     */
    static setChunkSize(bytes) {
        this.CHUNK_SIZE = bytes;
    }

    /**
     * Configure max file size (in bytes)
     * @param {number} bytes
     */
    static setMaxFileSize(bytes) {
        this.MAX_FILE_SIZE = bytes;
    }

    /**
     * Configure available upload space (in bytes)
     * @param {number} bytes
     */
    static setAvailableSpace(bytes) {
        this.AVAILABLE_SPACE = bytes;
    }

    /**
     * Uploads a file with chunk splitting
     * @param {File} file - File to upload
     * @param {number} folderId - Destination folder
     * @param {Function} onProgress - Progress callback (0-100)
     * @param {string} description - File description
     * @returns {Promise<Object>} { fileId, success, totalSize, chunksUploaded }
     */
      static async uploadFile(file, folderId, onProgress = null, description = '') {
          try {
              if (this.MAX_FILE_SIZE > 0 && file.size > this.MAX_FILE_SIZE) {
                  throw new Error(Joomla.Text._('COM_COTTON_ERROR_MAX_FILESIZE') + ' [' + this.#formatSize(this.MAX_FILE_SIZE) + ']');
              }

              if (this.AVAILABLE_SPACE !== Infinity && file.size > this.AVAILABLE_SPACE) {
                  throw new Error(Joomla.Text._('COM_COTTON_ERROR_LIMIT_SPACE') + ' [' + this.#formatSize(this.AVAILABLE_SPACE) + ']');
              }

               // Determine if chunked or single upload is needed
              if (file.size <= this.CHUNK_SIZE) {
                   // Single upload
                  return await this.#uploadSingleChunk(file, 0, folderId, onProgress);
              } else {
                   // Chunked upload
                  return await this.#uploadMultipleChunks(file, 0, folderId, onProgress);
              }
          } catch (error) {
               if (error.message !== 'Upload cancelled') {
                   console.error('[CottonUploader] Error uploading:', error);
              }
              throw error;
          }
      }

    /**
     * Single file upload (no chunks)
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
                  throw new Error(result?.error || 'Error uploading file');
             }

             const fileId = result?.file_id || result?.file?.[0]?.id || result?.id;
             if (!fileId) {
                 throw new Error('Error getting uploaded file ID');
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
     * Upload with multiple chunks
     * @private
     */
    static async #uploadMultipleChunks(file, chunkIndex, folderId, onProgress) {
        const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
        let chunksUploaded = 0;
        let fileId = 0;  // 0 = criar novo arquivo

        //console.log(`[CottonUploader] Splitting into ${totalChunks} chunks`);

        try {
            for (let i = 0; i < totalChunks; i++) {
                const start = i * this.CHUNK_SIZE;
                const end = Math.min(start + this.CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                
                 // Upload with retry - captures fileId from first execution
                const result = await this.#uploadChunkWithRetry(
                    fileId,
                    chunk,
                    i,
                    totalChunks,
                    file.name,
                    folderId,
                    CottonUploader.#uploadController.signal
                );

                 // On first execution, get the created fileId
                const uploadedFileId = result?.file_id || result?.file?.[0]?.id || result?.id;
                if (uploadedFileId) {
                    fileId = uploadedFileId;
                    CottonUploader.#activeFileIds.add(fileId);
                }

                if (!fileId) {
                    throw new Error('Error getting uploaded file ID');
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
            CottonStorage.failUpload(fileId || 0, `Error in chunk ${chunksUploaded + 1}/${totalChunks}`);
            throw error;
        } finally {
            if (fileId) {
                CottonUploader.#activeFileIds.delete(fileId);
            }
        }
    }

    /**
     * Chunk upload with automatic retry
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
                      throw new Error(result?.error || 'Error uploading chunk');
                 }
                 return result;
             });
         } catch (error) {
             if (error.message === 'Upload cancelado') {
                 throw error;
             }
             if (attempt < this.MAX_RETRIES) {
                  console.warn(
                      `[CottonUploader] Attempt ${attempt + 1}/${this.MAX_RETRIES} failed, retry in ${this.RETRY_DELAY}ms`,
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
                  throw new Error(`Chunk ${chunkIndex}/${totalChunks} failed after ${this.MAX_RETRIES} attempts`);
             }
         }
     }

    /**
     * Pauses an upload (placeholder for future implementation)
     * @param {number} fileId
     */
    static pauseUpload(fileId) {
         // TODO: Implement pause via AbortController
        const upload = CottonStorage.getUploadProgress(fileId);
        if (upload.status === 'uploading') {
            CottonStorage.setUploadProgress(fileId, upload.progress, 'paused');
        }
    }

    /**
     * Resumes a paused upload
     * @param {number} fileId
     */
    static resumeUpload(fileId) {
         // TODO: Implement resume
        const upload = CottonStorage.getUploadProgress(fileId);
        if (upload.status === 'paused') {
            CottonStorage.setUploadProgress(fileId, upload.progress, 'uploading');
        }
    }

    /**
     * Cancels an upload
     * @param {number} fileId
      */
     static cancelUpload(fileId) {
         CottonUploader.#abortUploadController();
         CottonStorage.clearUpload(fileId);
          //console.log(`[CottonUploader] Upload ${fileId} cancelled`);
     }

     /**
      * Cancels all ongoing uploads
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
                  console.warn('[CottonUploader] Failed to cancel upload on server:', fileId, e);
              }
          }
          
          //console.log('[CottonUploader] All uploads cancelled');
      }

     static #abortUploadController() {
         if (CottonUploader.#uploadController && !CottonUploader.#uploadController.signal.aborted) {
             CottonUploader.#uploadController.abort();
         }
         CottonUploader.#uploadController = new AbortController();
     }

    /**
     * Uploads multiple files in parallel
     * @param {File[]} files - Array of files
     * @param {number} folderId - Destination folder
     * @param {Function} onProgress - Callback with total progress
     * @param {number} maxParallel - Max simultaneous uploads (default 3)
     * @returns {Promise<Array>} Array of results
     */
    static async uploadMultiple(files, folderId, onProgress = null, maxParallel = 3) {
        const results = [];
        let completed = 0;
        const total = files.length;

         // Upload queue
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
                             null, // do not use individual progress
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
     * Resumes interrupted uploads (placeholder)
     * @param {number} folderId
     * @returns {Promise<Array>}
     */
    static async resumePendingUploads(folderId) {
        const pending = CottonStorage.getPendingUploads();
        const results = [];

        for (const [fileId, upload] of Object.entries(pending)) {
             // TODO: Implement resume logic
             //console.log(`[CottonUploader] Resuming upload ${fileId}`);
        }

        return results;
    }

    /**
     * Formats file size
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
     * Get estimated time remaining
     * @param {number} fileSize - File size in bytes
     * @param {number} uploadedSize - Size already uploaded
     * @param {number} startTime - Initial timestamp
     * @returns {string} Estimated time (ex: "2m 30s")
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
     * Calculate upload speed
     * @param {number} uploadedSize - Bytes uploaded
     * @param {number} startTime - Initial timestamp
     * @returns {string} Speed (ex: "2.5 MB/s")
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
