/**
 * @package Tabaoca.Component.Cotton.Administrator
 * @subpackage com_cotton
 * @copyright (C) 2024 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

var uri_root, uri_base,	tk, wsocket,
	n_folders = 0,
	n_files = 0,
	n_size = 0;

function setup_admin () {

	uri_root = document.getElementById('uri_root').value;
	uri_base = document.getElementById('uri_base').value;
	tk = document.getElementById('token').value;

	run_admin();

}

function run_admin () {

	var myForm = new FormData();
	var xhr = new XMLHttpRequest(); 
	var url = uri_base + 'index.php?option=com_cotton&view=cotton&task=cotton.run&format=json';

	myForm.append(tk, 1);

	myForm.append('n_folders', n_folders);
	myForm.append('n_files', n_files);
	myForm.append('n_size', n_size);

	xhr.open("POST", url, true);

	xhr.onreadystatechange = function () {

								if (this.readyState == 4 && this.status == 200) {

									Jxhr = JSON.parse(xhr.response);

									if (Jxhr.data !== null) {

										if (Jxhr.data.n_folders !== null) {

											document.getElementById('n_folders').innerHTML = Jxhr.data.n_folders;
											n_folders = Jxhr.data.n_folders;

										}

										if (Jxhr.data.n_files !== null) {

											document.getElementById('n_files').innerHTML = Jxhr.data.n_files;
											n_files = Jxhr.data.n_files;

										}

										if (Jxhr.data.n_size !== null) {

											let data_size = mount_file_size(Jxhr.data.n_size);

											document.getElementById('n_size').innerHTML = `<span>${Jxhr.data.n_size} Bytes (${data_size})</span>`;
											n_size = Jxhr.data.n_size;

										}

										document.getElementById('post_max_size').innerHTML = Jxhr.data.config.post_max_size;
										document.getElementById('upload_max_filesize').innerHTML = Jxhr.data.config.upload_max_filesize;
										document.getElementById('memory_limit').innerHTML = Jxhr.data.config.memory_limit;
										document.getElementById('max_allowed_packet').innerHTML = Jxhr.data.config.max_allowed_packet + ' Bytes (' + mount_file_size(Jxhr.data.config.max_allowed_packet) + ')';

										setTimeout(function () { run_admin();}, 0);

									} else {

										alert(Joomla.JText._('COM_COTTON_TIMEOUT'));
										location.reload();

									}

								}

							}

	xhr.send(myForm);

}

function mount_file_size (file_size) {

	const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	let l = 0, n = parseInt(file_size, 10) || 0;

	while( n >= 1024 && ++l) {
	
		n = n/1024;
	
	}

	return(n.toFixed(n < 10 && l > 0 ? 1 : 0) + ' ' + units[l]);

}
