<?php
/**
 * @package Tabaoca.Component.Shuttle.Administrator
 * @subpackage com_shuttle
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

\defined('_JEXEC') or die;

use Joomla\CMS\Dispatcher\ComponentDispatcherFactoryInterface;
use Joomla\CMS\Extension\ComponentInterface;
use Joomla\CMS\Extension\MVCComponent;
use Joomla\CMS\Extension\Service\Provider\ComponentDispatcherFactory;
use Joomla\CMS\Extension\Service\Provider\MVCFactory;
use Joomla\CMS\MVC\Factory\MVCFactoryInterface;
use Joomla\DI\Container;
use Joomla\DI\ServiceProviderInterface;

use Symfony\Component\Console\Application as ConsoleApplication;
use Tabaoca\Component\Shuttle\Administrator\Console\Command\ShuttleCommand;

return new class implements ServiceProviderInterface {

	public function register(Container $container): void {

		$namespace = '\\Tabaoca\\Component\\Shuttle';
		
		$container->registerServiceProvider(new MVCFactory($namespace));
		$container->registerServiceProvider(new ComponentDispatcherFactory($namespace));
		$container->set(ComponentInterface::class, function (Container $container) {

			$component = new MVCComponent($container->get(ComponentDispatcherFactoryInterface::class));
			$component->setMVCFactory($container->get(MVCFactoryInterface::class));

			return $component;
		});

		if (class_exists(ConsoleApplication::class)) {
			$container->set(ShuttleCommand::class, function () {
				return new ShuttleCommand();
			});
		}
	}

};
