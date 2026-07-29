<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Shuttle\Site\Model\Service;

\defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Session\Session;
use Joomla\Event\DispatcherInterface;
use InvalidArgumentException;

/**
 * Gerencia os buffers do Weaver Editor para comandos weaver-buf.
 *
 * @package     Tabaoca.Component.Shuttle.Site
 * @subpackage  com_shuttle
 * @since       2.0.0
 */
class WeaverBufferManager
{
	protected DispatcherInterface $dispatcher;

	public function __construct(DispatcherInterface $dispatcher = null)
	{
		$this->dispatcher = $dispatcher ?? Factory::getContainer()->get(DispatcherInterface::class);
	}

	public function listBuffers(): array
	{
		$session = Factory::getSession();
		$buffers = $session->get('weaver_buffers', []);
		if (!is_array($buffers)) {
			$buffers = [];
		}

		return array_values($buffers);
	}

	public function getBuffer(string $bufferId): ?array
	{
		$buffers = $this->listBuffers();
		foreach ($buffers as $buffer) {
			if (($buffer['id'] ?? null) === $bufferId) {
				return $buffer;
			}
		}

		return null;
	}

	public function patchBuffer(string $bufferId, string $content = '', ?string $diff = null): array
	{
		$currentuser = Factory::getApplication()->getIdentity();
	
		$buffer = $this->getBuffer($bufferId);
		if ($buffer === null) {
			throw new InvalidArgumentException(sprintf('Buffer "%s" not found', $bufferId));
		}

		if ($content === '' && $diff === null) {
			throw new InvalidArgumentException('Either content or diff must be provided');
		}

		$payload = [
			'buffer_id' => $bufferId,
			'content' => $content,
			'diff' => $diff,
			'modified_by' => $currentuser->get('id'),
			'source' => 'shuttle',
			'timestamp' => time(),
		];

		$this->dispatcher->dispatch('onShuttleWeaverBufferPatch', [$payload]);

		return $payload;
	}

	public function deleteBuffer(string $bufferId): bool
	{
		$buffers = $this->listBuffers();
		$found = false;
		$updated = [];

		foreach ($buffers as $buffer) {
			if (($buffer['id'] ?? null) === $bufferId) {
				$found = true;
				continue;
			}
			$updated[] = $buffer;
		}

		if (!$found) {
			return false;
		}

		$session = Factory::getSession();
		$session->set('weaver_buffers', $updated);

		return true;
	}

	public function clearBuffers(): int
	{
		$session = Factory::getSession();
		$count = count($this->listBuffers());
		$session->set('weaver_buffers', []);
		return $count;
	}
}
