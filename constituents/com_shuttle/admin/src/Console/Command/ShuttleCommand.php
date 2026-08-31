<?php
/**
 * @package     Tabaoca.Component.Shuttle.Administrator
 * @subpackage  com_shuttle
 * @copyright   (C) 2026 Jonatas C. Ferreira
 * @license     GNU Affero General Public License version 3 or later; see LICENSE.md
 */

namespace Tabaoca\Component\Shuttle\Administrator\Console\Command;

\defined('_JEXEC') or die;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Tabaoca\Component\Shuttle\Site\Model\Service\CommandInterpreter;

/**
 * Shuttle CLI command for Joomla.
 *
 * @package     Tabaoca.Component.Shuttle.Administrator
 * @subpackage  com_shuttle
 * @since       2.0.0
 */
class ShuttleCommand extends Command
{
	protected static $defaultName = 'shuttle:exec';
	protected static $defaultDescription = 'Execute Shuttle terminal commands from Joomla CLI.';

	protected function configure(): void
	{
		$this->setDescription(static::$defaultDescription)
			->addArgument('command', InputArgument::IS_ARRAY | InputArgument::REQUIRED, 'The Shuttle command to execute')
			->addOption('cwd', null, InputOption::VALUE_OPTIONAL, 'Working directory', '~')
			->addOption('json', null, InputOption::VALUE_NONE, 'Output raw JSON result');
	}

	protected function execute(InputInterface $input, OutputInterface $output): int
	{
		$commandParts = $input->getArgument('command');
		$command = implode(' ', $commandParts);
		$cwd = $input->getOption('cwd') ?: '~';
		$json = (bool) $input->getOption('json');

		$interpreter = new CommandInterpreter();
		$result = $interpreter->execute($command, $cwd);

		if (isset($result['error'])) {
			$output->writeln('<error>' . $result['error'] . '</error>');
			if ($json) {
				$output->writeln(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
			}
			return Command::FAILURE;
		}

		if ($json) {
			$output->writeln(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
			return Command::SUCCESS;
		}

		if (isset($result['output'])) {
			$output->writeln($result['output']);
		}

		if (isset($result['data']) && !empty($result['data'])) {
			$output->writeln('---');
			$output->writeln(json_encode($result['data'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
		}

		return Command::SUCCESS;
	}
}
