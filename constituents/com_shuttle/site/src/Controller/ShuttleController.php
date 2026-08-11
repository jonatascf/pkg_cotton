<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

namespace Tabaoca\Component\Shuttle\Site\Controller;

\defined('_JEXEC') or die;

use Joomla\CMS\MVC\Controller\BaseController;
use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Session\Session;
use Joomla\CMS\Response\JsonResponse;
use Tabaoca\Component\Shuttle\Site\Model\Service\CommandInterpreter;
use Tabaoca\Component\Shuttle\Site\Model\Service\ShuttleMCPServer;
use Tabaoca\Component\Shuttle\Site\Model\Service\ShuttleJwtMiddleware;
use Tabaoca\Component\Shuttle\Site\Model\Service\AiStreamHandler;

/**
 * Controller of Shuttle Terminal component
 * 
 * Handles terminal command execution via AJAX.
 *
 * @package     Tabaoca.Component.Shuttle.Site
 * @subpackage  com_shuttle
 * @since       2.0.0
 */
class ShuttleController extends BaseController {

	/**
	 * Execute a terminal command via AJAX
	 *
	 * @return  void
	 * @since   2.0.0
	 */
		public function exec() {

		try {

			$app = Factory::getApplication();
			$currentuser = $app->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			$input = $app->input;

			$command = $input->get('command', '', 'RAW');
			$options = $input->get('options', [], 'ARRAY');
			$parameters = $input->get('parameters', [], 'ARRAY');
			$cwd = $input->get('cwd', '/', 'RAW');
			$cwd = trim((string) $cwd);
			if ($cwd === '' || !str_starts_with($cwd, '/')) {
				$cwd = '/';
			}
			$cwd = preg_replace('#/+#', '/', $cwd);
			$cwd = rtrim($cwd, '/') ?: '/';

			if (empty($command)) {
				echo new JsonResponse(null, 'Command cannot be empty', true);
				Factory::getApplication()->close();
			}

			$args = !empty($options) || !empty($parameters) ? array_merge($options, $parameters) : [];

		if ($command === 'ai') {
			try {
				\Tabaoca\Component\Shuttle\Site\Model\Service\ShuttleJwtMiddleware::handle();
			} catch (\Exception $e) {
				echo new JsonResponse(null, $e->getMessage(), true);
				$app->close();
			}

			$interpreter = new CommandInterpreter();
			$result = $interpreter->executeAi($args, $cwd);

			if (isset($result['error'])) {
				echo new JsonResponse($result, null, true);
			} else {
				echo new JsonResponse($result);
			}
			$app->close();
		}

			$interpreter = new CommandInterpreter();
			$result = $interpreter->execute($command, $cwd, $options, $parameters);

			if (isset($result['error'])) {
				echo new JsonResponse(null, $result['error'], true);
			} else {
				echo new JsonResponse($result);
			}

		} catch (\Exception $e) {
			echo new JsonResponse(null, $e->getMessage(), true);
		}

		Factory::getApplication()->close();
	}

	public function mcp()
	{
		try {
			$app = Factory::getApplication();
			$input = $app->input;
			$currentuser = $app->getIdentity();
			
			if (!$currentuser->get("id") || !Session::checkToken()) {
				echo new JsonResponse(null, Text::_('JINVALID_TOKEN'), true);
				return;
			}

			if (strtoupper($app->input->getMethod()) !== 'POST') {
				http_response_code(405);
				echo new JsonResponse(null, 'Method Not Allowed', true);
				$app->close();
			}

			$acceptHeader = isset($_SERVER['HTTP_ACCEPT']) ? strtolower($_SERVER['HTTP_ACCEPT']) : '';
			$wantsSse = str_contains($acceptHeader, 'text/event-stream');

			ShuttleJwtMiddleware::handle();

			$rawBody = file_get_contents('php://input');
			$request = json_decode($rawBody, true);

			if (!is_array($request) || !isset($request['method'])) {
				http_response_code(400);
				echo new JsonResponse(null, 'Invalid MCP request', true);
				$app->close();
			}

			$server = new ShuttleMCPServer();
			if ($wantsSse && ($request['method'] === 'ai/stream' || ($request['method'] === 'tools/call' && ($request['params']['name'] ?? '') === 'ai'))) {
				$this->streamSseResponse($server, $request);
				$app->close();
			}

			$response = $server->handleRequest($request);

			if (!isset($response['jsonrpc'])) {
				$response['jsonrpc'] = '2.0';
			}

			if (!isset($response['id'])) {
				$response['id'] = $request['id'] ?? null;
			}

			header('Content-Type: application/json');
			echo new JsonResponse($response);
		} catch (\Exception $e) {
			http_response_code(500);
			echo new JsonResponse(null, $e->getMessage(), true);
		}

		Factory::getApplication()->close();
	}

	private function streamSseResponse(ShuttleMCPServer $server, array $request): void
	{
		$arguments = $request['params']['arguments'] ?? [];
		$prompt = (string) ($arguments['prompt'] ?? '');

		if ($prompt === '') {
			$this->sendSseError('Missing prompt');
			return;
		}

		if (function_exists('set_time_limit')) {
			set_time_limit(300);
		}

		$this->sendSseHeaders();

		$handler = new AiStreamHandler();
		$cwd = '/';

		$flush = function (): void {
			if (ob_get_level() > 0) {
				ob_flush();
			}
			flush();
		};

		$onSseEvent = function (string $event, array $data) use ($flush): void {
			if (connection_aborted()) {
				return;
			}

			echo 'event: ' . $event . "\n";
			echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n\n";
			$flush();
		};

		$shouldStop = function (): bool {
			return connection_aborted();
		};

		try {
			$handler->handleStream($arguments, $cwd, $onSseEvent, $shouldStop);
		} catch (\Throwable $e) {
			$this->sendSseError('Stream error: ' . $e->getMessage());
		}
	}

	private function sendSseHeaders(): void
	{
		header('Content-Type: text/event-stream');
		header('Cache-Control: no-cache');
		header('X-Accel-Buffering: no');

		if (function_exists('apache_setenv')) {
			apache_setenv('no-gzip', '1');
		}

		ob_implicit_flush(true);
		while (ob_get_level() > 0) {
			ob_end_flush();
		}
	}

	private function sendSseError(string $message): void
	{
		echo 'event: error' . "\n";
		echo 'data: ' . json_encode(['error' => ['message' => $message]]) . "\n\n";
		echo 'event: done' . "\n";
		echo 'data: ' . json_encode(['message' => 'Stream completed with error']) . "\n\n";
		flush();
	}
}
