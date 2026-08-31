<?php
/**
 * @package Tabaoca.Component.Weaver.Administrator
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
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

return new class implements ServiceProviderInterface {

	public function register(Container $container): void {

		$namespace = '\\Tabaoca\\Component\\Weaver';
		
		$container->registerServiceProvider(new MVCFactory($namespace));
		$container->registerServiceProvider(new ComponentDispatcherFactory($namespace));
		$container->set(ComponentInterface::class, function (Container $container) {

														$component = new MVCComponent($container->get(ComponentDispatcherFactoryInterface::class));
														$component->setMVCFactory($container->get(MVCFactoryInterface::class));

														return $component;
													});

	}

};
