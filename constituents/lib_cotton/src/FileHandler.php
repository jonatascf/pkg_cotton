<?php
/**
 * @package Tabaoca.Library.Cotton
 * @subpackage lib_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\LibCotton;

\defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Component\ComponentHelper;

/**
 * Interface for file handlers in Cotton system.
 * Provides common operations like open, save, new, save as.
 * 
 * @since 2.0.0
 */
interface FileHandlerInterface
{
    /**
     * Open a file for editing.
     * @param int $fileId
     * @return array ['success' => bool, 'content' => string, 'mime_type' => string, ...]
     */
    public function openFile(int $fileId): array;

    /**
     * Save content to an existing file.
     * @param int $fileId
     * @param string $content
     * @return array ['success' => bool, 'message' => string]
     */
    public function saveFile(int $fileId, string $content): array;

    /**
     * Create a new file.
     * @param int $folderId
     * @param string $name
     * @param string $content
     * @param string $description
     * @return array ['success' => bool, 'id' => int, 'message' => string]
     */
    public function createNew(int $folderId, string $name, string $content = '', string $description = ''): array;
}

/**
 * Handler for text files (plaintext, code, etc.)
 * 
 * Implements the FileHandlerInterface to provide text file operations:
 * - Opening files for editing
 * - Saving content
 * - Creating new files
 * 
 * This handler uses lib_cotton abstractions and returns standardized responses.
 * 
 * @package Tabaoca.LibCotton
 * @since 2.0.0
 */
class FileHandler implements FileHandlerInterface
{
    /**
     * File manager (from com_cotton)
     * @var object
     */
    protected $fileManager;

    /**
     * Current user
     * @var object
     */
    protected $user;

    /**
     * Supported text file extensions
     * @var array
     */
    protected array $supportedExtensions = [];

    /**
     * Constructor
     * 
     * @param object|null $fileManager Optional file manager instance
     */
    public function __construct($fileManager = null)
    {
        $this->user = Factory::getApplication()->getIdentity();
        
        if ($fileManager) {
            $this->fileManager = $fileManager;
        } else {
            // Lazy load file manager from com_cotton if available
            try {
                $this->fileManager = new \Tabaoca\Component\Cotton\Site\Model\File\FileManager();
            } catch (\Throwable $e) {
                $this->fileManager = null;
            }
        }

        $config = ComponentHelper::getComponent('com_cotton')->getParams();
        $types = $config->get('text_file_types', 'txt,php,html,css,js,json,xml,md');
        $textFileTypes = array_map('trim', explode(',', $types));

        // Load supported extensions from config
        $this->supportedExtensions =  $textFileTypes;
    }

    /**
     * Check if a file extension is supported for editing
     * 
     * @param string $filename
     * @return bool
     */
    private function isEditableExtension(string $filename): bool
    {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return in_array(strtolower($ext), $this->supportedExtensions);
    }

    /**
     * Check if editor plugin is enabled
     * 
     * @return bool
     */
    private function isEditorEnabled(): bool
    {
        try {
            $db = Factory::getDbo();
            $query = $db->getQuery(true)
                ->select('COUNT(*)')
                ->from($db->quoteName('#__extensions'))
                ->where($db->quoteName('name') . ' = ' . $db->quote('plg_editors_codemirror'))
                ->where($db->quoteName('enabled') . ' = 1');

            $db->setQuery($query);
            return (int) $db->loadResult() > 0;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Detect MIME type from filename
     * 
     * @param string $filename
     * @return string
     */
    private function detectMimeType(string $filename): string
    {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        
        $mimeMap = [
            'txt' => 'text/plain',
            'md' => 'text/markdown',
            'html' => 'text/html',
            'htm' => 'text/html',
            'xml' => 'text/xml',
            'json' => 'application/json',
            'css' => 'text/css',
            'scss' => 'text/x-scss',
            'sass' => 'text/x-sass',
            'js' => 'application/javascript',
            'mjs' => 'application/javascript',
            'php' => 'application/x-php',
            'py' => 'text/x-python',
            'rb' => 'text/x-ruby',
            'java' => 'text/x-java',
            'cpp' => 'text/x-c++src',
            'c' => 'text/x-csrc',
            'go' => 'text/x-go',
            'rs' => 'text/x-rust',
            'sh' => 'text/x-shellscript',
            'bash' => 'text/x-shellscript',
            'sql' => 'text/x-sql',
            'ini' => 'text/plain',
            'yml' => 'text/x-yaml',
            'yaml' => 'text/x-yaml',
        ];

        return $mimeMap[$ext] ?? 'text/plain';
    }

    /**
     * Open a file for editing
     * 
     * @param int $fileId File ID to open
     * @return array Response array with success flag and file data
     */
    public function openFile(int $fileId): array
    {
        try {
            if (!$this->fileManager) {
                throw new \Exception('File manager not available', 500);
            }

            // Load file from database
            $file = $this->fileManager->loadForOpen($fileId);
            if (!$file) {
                return [
                    'success' => false,
                    'error' => Text::_('COM_COTTON_FILE_NOT_FOUND'),
                    'file_id' => $fileId
                ];
            }

            // Check if file extension is editable
            if (!$this->isEditableExtension($file->name)) {
                return [
                    'success' => false,
                    'error' => Text::sprintf('COM_COTTON_ERROR_FILE_TYPE_NOT_EDITABLE', pathinfo($file->name, PATHINFO_EXTENSION)),
                    'file_id' => $fileId
                ];
            }

            // Check if editor is enabled
            if (!$this->isEditorEnabled()) {
                return [
                    'success' => false,
                    'error' => Text::_('COM_COTTON_ERROR_EDITOR_DISABLED'),
                    'file_id' => $fileId
                ];
            }

            return [
                'success' => true,
                'file_id' => $fileId,
                'content' => $file->file_data ?? '',
                'name' => $file->name,
                'mime_type' => $this->detectMimeType($file->name),
                'folder_id' => $file->folder_id ?? 0,
                'folder_path' => $file->path ?? '',
                'open_link' => $file->open_link ?? 0,
                'size' => strlen($file->file_data ?? ''),
                'created' => $file->created ?? '',
                'modified' => $file->modified ?? '',
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'file_id' => $fileId
            ];
        }
    }

    /**
     * Save content to an existing text file
     * 
     * @param int $fileId File ID to save
     * @param string $content New file content
     * @return array Response array with success flag
     */
    public function saveFile(int $fileId, string $content): array
    {
        try {
            if (!$this->fileManager) {
                throw new \Exception('File manager not available', 500);
            }

            // Load file to verify it exists and is editable
            $file = $this->fileManager->loadForOpen($fileId);
            if (!$file) {
                return [
                    'success' => false,
                    'error' => Text::_('COM_COTTON_FILE_NOT_FOUND'),
                    'file_id' => $fileId
                ];
            }

            // Check if file extension is editable
            if (!$this->isEditableExtension($file->name)) {
                return [
                    'success' => false,
                    'error' => Text::sprintf('COM_COTTON_ERROR_FILE_TYPE_NOT_EDITABLE', pathinfo($file->name, PATHINFO_EXTENSION)),
                    'file_id' => $fileId
                ];
            }

            // Save content
            $result = $this->fileManager->saveContent($fileId, $content);

            if (isset($result['success']) && $result['success']) {
                return [
                    'success' => true,
                    'file_id' => $fileId,
                    'name' => $file->name,
                    'mime_type' => $this->detectMimeType($file->name),
                    'size' => strlen($content),
                    'modified' => date('c'),
                ];
            }

            return [
                'success' => false,
                'error' => $result['message'] ?? $result['error'] ?? 'Save failed',
                'file_id' => $fileId
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'file_id' => $fileId
            ];
        }
    }

    /**
     * Create a new text file
     * 
     * @param int $folderId Target folder ID
     * @param string $name File name
     * @param string $content File content (default empty)
     * @param string $description File description
     * @return array Response array with success flag and file ID
     */
    public function createNew(int $folderId, string $name, string $content = '', string $description = ''): array
    {
        try {
            if (!$this->fileManager) {
                throw new \Exception('File manager not available', 500);
            }

            if (empty($name)) {
                return [
                    'success' => false,
                    'error' => Text::_('COM_COTTON_ERROR_FILE_NAME_REQUIRED')
                ];
            }

            // Check if file extension is supported for text files
            if (!$this->isEditableExtension($name)) {
                return [
                    'success' => false,
                    'error' => Text::sprintf('COM_COTTON_ERROR_FILE_TYPE_NOT_SUPPORTED', pathinfo($name, PATHINFO_EXTENSION))
                ];
            }

            // Create file via manager
            $result = $this->fileManager->create($folderId, $name, $content, $description);

            if (isset($result['success']) && $result['success']) {
                $createdName = $result['name'] ?? $name;
                return [
                    'success' => true,
                    'id' => $result['id'] ?? 0,
                    'file_id' => $result['id'] ?? 0,
                    'name' => $createdName,
                    'mime_type' => $this->detectMimeType($createdName),
                    'size' => strlen($content),
                    'created' => date('c'),
                    'folder_id' => $folderId,
                ];
            }

            return [
                'success' => false,
                'error' => $result['message'] ?? $result['error'] ?? 'Creation failed'
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}
