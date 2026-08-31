<?php
/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Shuttle\Site\Model\Service;

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Session\Session;
use Joomla\CMS\Response\JsonResponse;
use Joomla\Component\Fields\Administrator\Helper\FieldsHelper;

class ShuttleJwtMiddleware
{
	public static function handle(): void
	{
		$app = Factory::getApplication();
		$method = strtoupper($app->input->getMethod());

		if ($method !== 'POST') {
			return;
		}

		$authorization = self::getAuthorizationHeader();

		if ($authorization === null) {
			return;
		}

		if (!str_starts_with($authorization, 'Bearer ')) {
			return;
		}

		$token = substr($authorization, 7);

		if ($token === '' || $token === 'anônimo' || $token === 'anonymous') {
			return;
		}

		$payload = self::decodeJwt($token);

		if ($payload === null) {
			http_response_code(401);
			echo new JsonResponse(null, 'Invalid or expired token', true);
			$app->close();
		}

		if (isset($payload['user_id'])) {
			$userId = (int) $payload['user_id'];

			$session = Session::getInstance('none');
			$session->set('user_id', $userId);

			$user = Factory::getUser($userId);

			if ($user->id > 0) {
				$app->loadIdentity($user);
			}
		}
	}

	public static function getUserApiKey(): string
	{
		return (string) self::getUserField('kilocode-api-key');
	}

	private static function getUserField(string $fieldName)
	{
		$user = Factory::getApplication()->getIdentity();

		if (!$user || $user->id <= 0) {
			return '';
		}

		$fields = FieldsHelper::getFields('com_users.user', $user, true);

		foreach ($fields as $field) {
			if ($field->name === $fieldName) {
				return $field->value ?? '';
			}
		}

		return '';
	}

	private static function getAuthorizationHeader(): ?string
	{
		$headers = null;

		if (function_exists('getallheaders')) {
			$headers = getallheaders();
		} elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
			$headers = ['Authorization' => $_SERVER['HTTP_AUTHORIZATION']];
		}

		if ($headers && isset($headers['Authorization'])) {
			return $headers['Authorization'];
		}

		return null;
	}

	private static function decodeJwt(string $token): ?array
	{
		$parts = explode('.', $token);

		if (count($parts) !== 3) {
			return null;
		}

		[$headerB64, $payloadB64, $signature] = $parts;

		$header = json_decode(self::base64UrlDecode($headerB64), true);
		if (!$header || !isset($header['alg'])) {
			return null;
		}

		$payload = json_decode(self::base64UrlDecode($payloadB64), true);

		if (!is_array($payload)) {
			return null;
		}

		if (isset($payload['exp']) && time() >= $payload['exp']) {
			return null;
		}

		$secret = self::getJwtSecret();

		if ($secret === null) {
			return null;
		}

		$expectedSignature = hash_hmac('sha256', $headerB64 . '.' . $payloadB64, $secret, true);
		$expectedSignatureB64 = rtrim(strtr(base64_encode($expectedSignature), '+/', '-_'), '=');

		if (!hash_equals($expectedSignatureB64, $signature)) {
			return null;
		}

		return $payload;
	}

	private static function base64UrlDecode(string $data): string
	{
		$remainder = strlen($data) % 4;
		if ($remainder) {
			$padLength = 4 - $remainder;
			$data .= str_repeat('=', $padLength);
		}

		return base64_decode(strtr($data, '-_', '+/'));
	}

	private static function getJwtSecret(): ?string
	{
		$secret = $_ENV['SHUTTLE_JWT_SECRET'] ?? null;

		if ($secret === null) {
			$secret = $_SERVER['SHUTTLE_JWT_SECRET'] ?? null;
		}

		if ($secret === null) {
			$config = Factory::getApplication()->get('secret') ?? null;
		}

		return $secret ?: null;
	}
}
