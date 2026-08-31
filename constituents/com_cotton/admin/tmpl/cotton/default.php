<?php
/**
 * @package Tabaoca.Administrator
 * @subpackage com_cotton
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

\defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Uri\Uri;
use Joomla\CMS\Component\ComponentHelper;

$app = Factory::getApplication();
$document = Factory::getDocument();
$session = $app->getSession();
$config = ComponentHelper::getParams('com_cotton');

?>

<script language="JavaScript">

function cotton_addLoadEvent(func) {

	var oldonload = window.onload;
	
	if (typeof window.onload != 'function') {
		
		window.onload = func;
	
	} else {
			
		window.onload = function() { if (oldonload) { oldonload();}
									 func();
									}
	}

}

cotton_addLoadEvent(function(){setup_admin();});

</script>

<div id="data_cotton" class="row">

	<div class="col-md-3">

		<div class="row">

			<div class="box_data">
				<span><i class="icon-folder"></i><b> <?php echo Text::_('COM_COTTON_FOLDERS');?></b></span>
				<div class="field_data">
					<span id="n_folders"></span>
				</div>
			</div>

			<div class="box_data">
				<span><i class="icon-file"></i><b> <?php echo Text::_('COM_COTTON_FILES');?></b></span>
				<div class="field_data">
					<span id="n_files"></span>
				</div>
			</div>

			<div class="box_data">
				<span><i class="icon-database"></i><b> <?php echo Text::_('COM_COTTON_DATASIZE');?></b></span>
				<div class="field_data">
					<span id="n_size"></span>
				</div>
			</div>

		</div>

	</div>

	<div class="col-md-4">

		<strong><?php echo Text::_('COM_COTTON_SERVER_CONFIG');?></strong>
			<table class="cotton-config">
				<thead>
					<tr>
						<th>PHP Server</th>
						<th><?php echo Text::_('COM_COTTON_CURRENT');?></th>
						<th><?php echo Text::_('COM_COTTON_RECOMMENDED');?></th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>post_max_size</td>
						<td id="post_max_size"></td>
						<td>32MB</td>
					</tr>
					<tr>
						<td>upload_max_filesize</td>
						<td id="upload_max_filesize"></td>
						<td>32MB</td>
					</tr>
					<tr>
						<td>memory_limit</td>
						<td id="memory_limit"></td>
						<td>256MB</td>
					</tr>
				</tbody>
			</table>

			<table class="cotton-config">
				<thead>
					<tr>
						<th>MySQL Server</th>
						<th><?php echo Text::_('COM_COTTON_CURRENT');?></th>
						<th><?php echo Text::_('COM_COTTON_RECOMMENDED');?></th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>max_allowed_packet</td>
						<td id="max_allowed_packet"></td>
						<td>268435456 Bytes (256MB)</td>
					</tr>
				</tbody>
			</table>

	</div>

	<div class="col-md-5">
	
		<div>
			<img src="<?php echo Uri::root(); ?>/media/com_cotton/images/com_cotton.svg" class="cotton-logo">
		</div>
		<div>
			<span class="cotton-name"><?php echo Text::_('COM_COTTON');?></span>
		</div>

	</div>

</div>

<input type="hidden" id="uri_root" value="<?php echo Uri::root(); ?>">
<input type="hidden" id="uri_base" value="<?php echo Uri::base(); ?>">
<input type="hidden" id="token" value="<?php echo $session->getFormToken(); ?>">

<p style="text-align:left;" ><?php echo Text::_('COM_COTTON_POWERED');?> <a href="https://tabaoca.org">Tabaoca</a></p>
