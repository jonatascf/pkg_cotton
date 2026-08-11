<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Site\Model\File;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;

/**
 * Manages business rules for files.
 */
class FileManager
{
    protected $repo;

    public function __construct(FileRepository $repo = null)
    {
        $this->repo = $repo ?? new FileRepository();
    }

    public function load(int $id)
    {
        return $this->repo->getById($id);
    }

    public function listByFolder(int $folderId): array
    {
        return $this->repo->getByFolder($folderId);
    }

    public function listByFolderForUser(int $folderId, int $userId): array
    {
        return $this->repo->getByFolderForUser($folderId, $userId);
    }

    public function loadForOpen(int $fileId): ?\stdClass
    {
        return $this->repo->getForOpen($fileId);
    }

    /**
     * Detects the MIME type from the file name.
     * @param string $fileName
     * @return string
     */
    public function detectMimeType(string $fileName): string
    {
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        
        $mimeTypes = [
            // Imagens
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml',
            'bmp' => 'image/bmp',
            'ico' => 'image/x-icon',
            // Videos
            'mp4' => 'video/mp4',
            'webm' => 'video/webm',
            'ogg' => 'video/ogg',
            'avi' => 'video/avi',
            'mov' => 'video/quicktime',
            'mkv' => 'video/x-matroska',
            // Audio
            'mp3' => 'audio/mpeg',
            'wav' => 'audio/wav',
            'flac' => 'audio/flac',
            'aac' => 'audio/aac',
            'm4a' => 'audio/mp4',
            // Documentos
            'pdf' => 'application/pdf',
            'doc' => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'odt' => 'application/vnd.oasis.opendocument.text',
            'xls' => 'application/vnd.ms-excel',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ods' => 'application/vnd.oasis.opendocument.spreadsheet',
            'ppt' => 'application/vnd.ms-powerpoint',
            'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            // Code/Text
            'txt' => 'text/plain',
            'md' => 'text/markdown',
            'html' => 'text/html',
            'htm' => 'text/html',
            'css' => 'text/css',
            'js' => 'text/javascript',
            'json' => 'application/json',
            'xml' => 'application/xml',
            'php' => 'application/x-httpd-php',
            'csv' => 'text/csv',
            // Arquivos compactados
            'zip' => 'application/zip',
            'rar' => 'application/x-rar-compressed',
            'gz' => 'application/gzip',
            'tar' => 'application/x-tar',
            '7z' => 'application/x-7z-compressed',
        ];
        
        return $mimeTypes[$extension] ?? 'application/octet-stream';
    }

    public function create(int $folderId, string $name, string $content, string $description = ''): array
    {
        $app = Factory::getApplication();
		$app->getLanguage()->load('com_cotton', JPATH_SITE);
        
        $name = trim($name);
        if ($name === '') {
            return ['success' => false, 'message' => Text::_('COM_COTTON_FILE_NAME_REQUIRED')];
        }

        // Generate unique name if needed
        $uniqueName = $this->repo->generateUniqueName($folderId, $name);

        $user = $app->getIdentity();
        $now = (string) Factory::getDate()->toSql();

        $data = [
            'folder_id' => (int) $folderId,
            'owner_id' => (int) ($user->id ?? 0),
            'name' => strip_tags($uniqueName),
            'description' => strip_tags($description),
            'file_data' => $content,
            'size' => strlen($content),
            'date_created' => $now,
            'date_updated' => $now
        ];

        try {
            $id = $this->repo->insert($data);
            return ['success' => true, 'id' => $id, 'name' => strip_tags($uniqueName)];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function saveContent(int $id, string $content): array
    {
        try {
            $size = strlen($content);
            $ok = $this->repo->update($id, ['file_data' => $content, 'size' => $size, 'date_updated' => (string) Factory::getDate()->toSql()]);
            return ['success' => (bool) $ok];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function updateMeta(int $id, array $meta): array
    {
        try {
            $ok = $this->repo->update($id, $meta);
            return ['success' => (bool) $ok];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function delete(int $id): array
    {
        try {
            $ok = $this->repo->delete($id);
            return ['success' => (bool) $ok];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function incrementDownloads(int $id): array
    {
        try {
            $ok = $this->repo->incrementDownloads($id);
            return ['success' => (bool) $ok];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getStorageStats(int $ownerId = 0): array
    {
        return $this->repo->getStorageStats($ownerId);
    }

    public function appendChunk(int $id, string $chunk): array
    {
        try {
            $ok = $this->repo->appendChunkToFile($id, $chunk);
            return $ok ? ['success' => true] : ['success' => false, 'message' => 'Failed to append chunk'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function finalizeUpload(int $id): array
    {
        try {
            $result = $this->repo->finalizeFileFromTemp($id);
            return $result;
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function cancelUpload(int $id): array
    {
        try {
            $this->repo->deleteTempFile($id);
            $ok = $this->repo->delete($id);
            return ['success' => (bool) $ok];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

}
