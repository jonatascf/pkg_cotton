<?php
/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Cotton\Site\Model\Service;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Tabaoca\Component\Cotton\Site\Model\Folder\FolderRepository;
use Tabaoca\Component\Cotton\Site\Model\File\FileRepository;

/**
 * Security service for Cotton Cloud items (folders and files).
 *
 * Responsibilities:
 * - Verify ownership (owner_id).
 * - Evaluate read/access permissions (open_link + allowed_users).
 * - Gate create / edit / delete / move operations.
 */
class ItemSecurity
{
	/** @var \JDatabaseDriver */
	protected $db;

	/** @var FolderRepository */
	protected $folderRepo;

	/** @var FileRepository */
	protected $fileRepo;

	/** @var \Joomla\CMS\Application\CMSApplication */
	protected $app;

	/** @var \Joomla\CMS\User\User|null */
	protected $currentUser = null;

	/**
	 * ItemSecurity constructor.
	 *
	 * @param   \JDatabaseDriver|null  $db
	 * @param   FolderRepository|null  $folderRepo
	 * @param   FileRepository|null    $fileRepo
	 */
	public function __construct($db = null, FolderRepository $folderRepo = null, FileRepository $fileRepo = null)
	{
		$this->db = $db ?? Factory::getDbo();
		$this->folderRepo = $folderRepo ?? new FolderRepository($this->db);
		$this->fileRepo = $fileRepo ?? new FileRepository($this->db);
		$this->app = Factory::getApplication();
	}

	/**
	 * Return the current logged-in user id.
	 *
	 * @return  int
	 * @since   2.2.0
	 */
	public function getUserId(): int
	{
		$user = $this->getUser();
		return (int) ($user->id ?? 0);
	}

	/**
	 * Return the current logged-in user object.
	 *
	 * @return  \Joomla\CMS\User\User|null
	 * @since   2.2.0
	 */
	public function getUser()
	{
		if ($this->currentUser === null) {
			$this->currentUser = $this->app->getIdentity();
		}

		return $this->currentUser;
	}

	/**
	 * Check if a given user is the owner of an item.
	 *
	 * @param   \stdClass  $item   Item object with owner_id property.
	 * @param   int        $userId User id to check.
	 *
	 * @return  bool
	 * @since   2.2.0
	 */
	public function isOwner(\stdClass $item, int $userId): bool
	{
		return isset($item->owner_id) && (int) $item->owner_id === $userId;
	}

	/**
	 * Check if a user can read / view an item.
	 *
	 * Rules:
	 * - Owner always allowed.
	 * - Explicitly allowed users (allowed_users JSON array) are allowed.
	 * - Otherwise fallback to open_link:
	 *   0 = private, 1 = registered users, 2 = anyone.
	 *
	 * @param   \stdClass  $item   Item object with allowed_users, open_link, owner_id.
	 * @param   int        $userId User id to check. Use 0 for guests.
	 *
	 * @return  bool
	 * @since   2.2.0
	 */
	public function canRead(\stdClass $item, int $userId): bool
	{
		if ($this->isOwner($item, $userId)) {
			return true;
		}

		$allowed = json_decode((string) ($item->allowed_users ?? '')) ?: [];

		if (in_array($userId, $allowed, true)) {
			return true;
		}

		$openLink = (int) ($item->open_link ?? 0);

		switch ($openLink) {
			case 1:
				// Registered users only
				return $userId > 0;

			case 2:
				// Public link
				return true;

			case 0:
			default:
				return false;
		}
	}

	/**
	 * Check if a user can edit an item.
	 *
	 * @param   \stdClass  $item   Item object.
	 * @param   int        $userId User id to check.
	 *
	 * @return  bool
	 * @since   2.2.0
	 */
	public function canEdit(\stdClass $item, int $userId): bool
	{
		return $this->isOwner($item, $userId);
	}

	/**
	 * Check if a user can delete an item.
	 *
	 * @param   \stdClass  $item   Item object.
	 * @param   int        $userId User id to check.
	 *
	 * @return  bool
	 * @since   2.2.0
	 */
	public function canDelete(\stdClass $item, int $userId): bool
	{
		return $this->isOwner($item, $userId);
	}

	/**
	 * Check if a user can create an item inside a folder.
	 *
	 * @param   int  $parentId Parent folder id. 0 means root.
	 * @param   int  $userId   User id to check.
	 *
	 * @return  bool
	 * @since   2.2.0
	 */
	public function canCreateInFolder(int $parentId, int $userId): bool
	{
		$parentId = (int) $parentId;

		if ($parentId <= 0) {
			// Root: any authenticated user can create.
			return $userId > 0;
		}

		$folder = $this->folderRepo->getById($parentId);

		if (!$folder) {
			return false;
		}

		return $this->isOwner($folder, $userId);
	}

	/**
	 * Check if a user can move an item to a new parent folder.
	 *
	 * Rules:
	 * - User must own the item.
	 * - User must own the destination folder (unless moving to root).
	 *
	 * @param   \stdClass  $item       Item object (file or folder) to be moved.
	 * @param   int        $newParentId New parent folder id.
	 * @param   int        $userId     User id to check.
	 *
	 * @return  bool
	 * @since   2.2.0
	 */
	public function canMove(\stdClass $item, int $newParentId, int $userId): bool
	{
		if (!$this->isOwner($item, $userId)) {
			return false;
		}

		$newParentId = (int) $newParentId;

		if ($newParentId <= 0) {
			// Moving to root is always allowed for owner.
			return true;
		}

		$parent = $this->folderRepo->getById($newParentId);

		if (!$parent) {
			return false;
		}

		return $this->isOwner($parent, $userId);
	}

	/**
	 * Build a standard error response object when access is denied.
	 *
	 * @param   string|null  $error  Optional error message key.
	 *
	 * @return  \stdClass
	 * @since   2.2.0
	 */
	public function accessDeniedResponse(string $error = null): \stdClass
	{
		$data = new \stdClass();
		$data->success = false;
		$data->error = $error ?? Text::_('COM_COTTON_ERROR_NOACCESS');
		return $data;
	}

	/**
	 * Assert that a user can read an item. Returns the item or an error response.
	 *
	 * @param   \stdClass  $item
	 * @param   int        $userId
	 *
	 * @return  \stdClass|\stdClass  The item on success or error object on failure.
	 * @since   2.2.0
	 */
	public function assertCanRead(\stdClass $item, int $userId)
	{
		if ($this->canRead($item, $userId)) {
			return $item;
		}

		return $this->accessDeniedResponse();
	}

	/**
	 * Assert that a user can edit an item. Returns true or an error response.
	 *
	 * @param   \stdClass  $item
	 * @param   int        $userId
	 *
	 * @return  bool|\stdClass  True on success or error object on failure.
	 * @since   2.2.0
	 */
	public function assertCanEdit(\stdClass $item, int $userId)
	{
		if ($this->canEdit($item, $userId)) {
			return true;
		}

		return $this->accessDeniedResponse();
	}

	/**
	 * Assert that a user can delete an item. Returns true or an error response.
	 *
	 * @param   \stdClass  $item
	 * @param   int        $userId
	 *
	 * @return  bool|\stdClass  True on success or error object on failure.
	 * @since   2.2.0
	 */
	public function assertCanDelete(\stdClass $item, int $userId)
	{
		if ($this->canDelete($item, $userId)) {
			return true;
		}

		return $this->accessDeniedResponse();
	}

	/**
	 * Assert that a user can create inside a folder. Returns true or an error response.
	 *
	 * @param   int  $parentId
	 * @param   int  $userId
	 *
	 * @return  bool|\stdClass  True on success or error object on failure.
	 * @since   2.2.0
	 */
	public function assertCanCreateInFolder(int $parentId, int $userId)
	{
		if ($this->canCreateInFolder($parentId, $userId)) {
			return true;
		}

		return $this->accessDeniedResponse();
	}

	/**
	 * Assert that a user can move an item to a new parent. Returns true or an error response.
	 *
	 * @param   \stdClass  $item
	 * @param   int        $newParentId
	 * @param   int        $userId
	 *
	 * @return  bool|\stdClass  True on success or error object on failure.
	 * @since   2.2.0
	 */
	public function assertCanMove(\stdClass $item, int $newParentId, int $userId)
	{
		if ($this->canMove($item, $newParentId, $userId)) {
			return true;
		}

		return $this->accessDeniedResponse();
	}
}
