/**
 * @package Tabaoca.Component.Weaver.Site
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

// Weaver Text Editor - A lightweight code editor for Joomla

const escapeHtml = (typeof CottonHelper !== 'undefined' && CottonHelper.escapeHtml)
    ? CottonHelper.escapeHtml.bind(CottonHelper)
    : (text) => text;

const WeaverEditor = (() => {
	const config = Joomla.getOptions('cotton_config');
	const tree = Joomla.getOptions('cotton_tree');

	const mainEl = document.getElementById('weaver_app');
	const state = {
		tabsModule: null,
		treeData: null,
		treeRootFolderId: 0,
		treeInstance: null,
		statusTimeoutId: null,
		ux: config.ux || false
	};

	const uxManager = new window.CottonUXManager();

	const DEFAULT_MODE_MAP = {
		'txt': 'markdown',
		'md': 'markdown',
		'js': 'javascript',
		'mjs': 'javascript',
		'json': 'json',
		'svg' : 'xml',
		'css': 'css',
		'scss': 'css',
		'sass': 'css',
		'html': 'htmlmixed',
		'htm': 'htmlmixed',
		'xml': 'xml',
		'php': 'php',
		'ini': 'properties',
		'less': 'css',
		'csv': 'markdown',
		'ics': 'markdown',
		'jsonld': 'json',
		'xul': 'htmlmixed'
	};

	const modeMap = (() => {
		const formats = Array.isArray(config?.text_formats) ? config.text_formats : [];
		const map = {};
		formats.forEach(ext => {
			const key = String(ext).toLowerCase().trim();
			if (key) {
				map[key] = DEFAULT_MODE_MAP[key] || 'markdown';
			}
		});
		return map;
	})();

	function getMode(fileName) {
		const extension = String(fileName).split('.').pop().toLowerCase();
		return modeMap[extension] || 'markdown';
	}

	function setStatus(message, level = 'info') {
		const status = mainEl.querySelector('#weaver_status');
		if (!status) return;
		if (state.statusTimeoutId) {
			clearTimeout(state.statusTimeoutId);
		}
		status.textContent = message;
		status.className = `weaver-status weaver-status--${level} weaver-status--visible`;
		state.statusTimeoutId = setTimeout(() => {
			status.classList.remove('weaver-status--visible');
		}, 3000);
	}

	function setActionState(enabled) {
		mainEl.querySelectorAll('.weaver-action').forEach((button) => {
			button.disabled = !enabled;
		});
	}

	function getQueryParam(name) {
		const params = new URLSearchParams(window.location.search);
		return params.get(name);
	}

	function getEditor() {
		const targetId = state.tabsModule?.getActiveTab()?.id;
		if (!targetId) return null;
		return mainEl.querySelector(`#weaver_editor_${targetId}`);
	}

	function getTextarea() {
		const targetId = state.tabsModule?.getActiveTab()?.id;
		if (!targetId) return null;
		return mainEl.querySelector(`#weaver_content_${targetId}`);
	}

	function getEditorValue() {
		const editor = getEditor();
		return editor?.jEditor?.getValue() ?? getTextarea()?.value ?? '';
	}

	function isMarkdownMode(mode) {
		return mode === 'markdown';
	}

	function hideWeaverTree() {
		const treeContainer = document.getElementById('weaver_tree');
		if (!treeContainer) return;
		treeContainer.classList.remove('is-open');
		treeContainer.setAttribute('aria-hidden', 'true');
		const toggleBtn = mainEl.querySelector('#weaver_toggle_tree_btn');
		if (toggleBtn) toggleBtn.classList.remove('active');
	}

	function toggleWeaverTree() {
		if (isWeaverTreeOpen()) {
			hideWeaverTree();
		} else {
			if (!state.treeData) {
				openFolder(0);
			} else {
				showWeaverTree();
			}
		}
	}

	function showWeaverTree() {
		const treeContainer = document.getElementById('weaver_tree');
		if (!treeContainer) return;
		treeContainer.classList.add('is-open');
		treeContainer.setAttribute('aria-hidden', 'false');
		const toggleBtn = mainEl.querySelector('#weaver_toggle_tree_btn');
		if (toggleBtn) toggleBtn.classList.add('active');

		if (state.treeInstance && state.treeData) {
			state.treeInstance.render(state.treeData, { startNode: state.treeRootFolderId || 0 });
		}
	}

	function isWeaverTreeOpen() {
		const treeContainer = document.getElementById('weaver_tree');
		return treeContainer?.classList.contains('is-open') || false;
	}

	function toggleWeaverMcp() {
		if (isWeaverMcpOpen()) {
			hideWeaverMcp();
		} else {
			showWeaverMcp();
		}
	}

	function showWeaverMcp() {
		const mcpContainer = document.getElementById('weaver_mcp');
		if (!mcpContainer) return;
		mcpContainer.classList.add('is-open');
		mcpContainer.setAttribute('aria-hidden', 'false');
		const toggleBtn = mainEl.querySelector('#weaver_toggle_mcp_btn');
		if (toggleBtn) toggleBtn.classList.add('active');
	}

	function hideWeaverMcp() {
		const mcpContainer = document.getElementById('weaver_mcp');
		if (!mcpContainer) return;
		mcpContainer.classList.remove('is-open');
		mcpContainer.setAttribute('aria-hidden', 'true');
		const toggleBtn = mainEl.querySelector('#weaver_toggle_mcp_btn');
		if (toggleBtn) toggleBtn.classList.remove('active');
	}

	function isWeaverMcpOpen() {
		const mcpContainer = document.getElementById('weaver_mcp');
		return mcpContainer?.classList.contains('is-open') || false;
	}

	function updateDirtyState(dirty) {
		const activeTab = state.tabsModule?.getActiveTab();
		if (activeTab) {
			state.tabsModule.setDirty(activeTab.id, dirty);
		}
		const saveButton = mainEl.querySelector('#weaver_save_btn');
		if (saveButton) saveButton.disabled = !dirty;
		updateSaveAsButtonState();
	}

	function buildHeader() {

		const maximize = state.ux ? '<div id="weaver_maximize" class="cotton-header-maximize"><i class="icon-expand-2"></i></div>' : '';
		const header = document.createElement('header');
		header.id = 'weaver_header';
		header.className = 'cotton-header';
		header.innerHTML = `<div class="cotton-header-title">
								<i class="icon-file-2 fa-1x"></i><span>${Joomla.Text._('COM_WEAVER_APP_TITLE')}</span><span>[ ${config.userName} ]</span>
							</div>
							${maximize}`;
		return header;
	}

		function buildTopBar() {
			const topbar = document.createElement('nav');
			topbar.className = 'weaver-topbar';
			topbar.innerHTML = `<div class="weaver-actions">
								<button id="weaver_toggle_tree_btn" class="btn btn-outline-secondary btn-sm weaver-action" type="button" title="${Joomla.Text._('COM_WEAVER_TOOLTIP_TOGGLE_TREE')}">
									<i class="fa-solid fa-folder"></i>
								</button>
								<button id="weaver_open_folder_btn" class="btn btn-outline-secondary btn-sm active weaver-action" type="button">${Joomla.Text._('COM_WEAVER_OPEN_FOLDER')}</button>
								<button id="weaver_open_btn" class="btn btn-outline-secondary btn-sm active weaver-action" type="button">${Joomla.Text._('COM_WEAVER_FILE_OPEN')}</button>
								<button id="weaver_new_btn" class="btn btn-outline-secondary btn-sm active weaver-action" type="button">${Joomla.Text._('COM_WEAVER_FILE_NEW')}</button>
								<button id="weaver_save_btn" class="btn btn-outline-secondary btn-sm active weaver-action" type="button" disabled style="display: none;">${Joomla.Text._('COM_WEAVER_FILE_SAVE')}</button>
								<button id="weaver_save_as_btn" class="btn btn-outline-secondary btn-sm active weaver-action" type="button" style="display: none;">${Joomla.Text._('COM_WEAVER_FILE_SAVE_AS')}</button>
							</div>
							<div class="weaver-actions">
								<button id="weaver_toggle_mcp_btn" class="btn btn-outline-secondary btn-sm weaver-action" type="button" title="${Joomla.Text._('COM_WEAVER_TOOLTIP_TOGGLE_MCP')}">
									<i class="fa-solid fa-robot"></i>
								</button>
							</div>`;
			return topbar;
		}

	function buildMain() {
		const main = document.createElement('section');
		main.className = 'cotton-main';
		main.innerHTML = `<aside id="weaver_tree" class="weaver-tree" aria-hidden="true">
							</aside>
							<section class="weaver-editor-pane">
								<div id="weaver_tabs" class="weaver-tabs"></div>
								<div id="weaver_editor_container" class="weaver-editor-container">
									<div id="weaver_status" class="weaver-status weaver-status--info"></div>
								</div>
							</section>
							<aside id="weaver_mcp" class="weaver-mcp" aria-hidden="true">
							</aside>`;
		return main;
	}
	
	function buildFooter() {
		const footer = document.createElement('footer');
		footer.className = 'weaver-footer';
		
		const stats = document.createElement('div');
		stats.id = 'weaver_stats';
		stats.className = 'weaver-stats';
		stats.innerHTML = `<span>${Joomla.Text._('COM_WEAVER_POWERED')} <a href="https://tabaoca.org" target="_blank">Tabaoca.org</a></span>`;

		footer.appendChild(stats);
		return footer;
	}

	function getTabIcons(tab) {
		if (!window.CottonUIManager) return '';
		const mimeIcon = window.CottonUIManager.getMimeIcon(window.CottonUIManager.getMimeTypeForFile({ name: tab.name }), { size: 'fa-1x', colored: true });
		const permissionIcon = window.CottonUIManager.getPermissionIcon({ open_link: tab.openLink ?? tab.open_link ?? 0 });
		return `${mimeIcon}${permissionIcon ? `<span class="weaver-tab-perm-icon">${permissionIcon}</span>` : ''}`;
	}

	function createEditorPane(tab) {
		const mode = getMode(tab.name);
		const options = JSON.stringify({
			width: '100%',
			height: '100vh',
			lineNumbers: true,
			lineWrapping: isMarkdownMode(mode),
			activeLine: true,
			highlightSelection: true,
			autoCloseBrackets: true,
			keyMap: '',
			mode,
			customExtensions: []
		});

		const section = document.createElement('section');
		section.className = 'cotton-pane weaver-editor-pane';
		section.dataset.tabId = tab.id;
		section.id = `weaver_pane_${tab.id}`;

		const editor = document.createElement('joomla-editor-codemirror');
		editor.id = `weaver_editor_${tab.id}`;
		editor.name = `weaver_content_${tab.id}`;
		editor.setAttribute('options', options);
		editor.setAttribute('buttons', 'false');

		const textarea = document.createElement('textarea');
		textarea.id = `weaver_content_${tab.id}`;
		textarea.name = 'content';
		textarea.style.display = 'none';
		textarea.value = tab.content;

		editor.appendChild(textarea);
		section.appendChild(editor);
		return section;
	}

	function attachEditorHooks(tabId) {
		const editor = mainEl.querySelector(`#weaver_editor_${tabId}`);
		if (!editor) return;
		editor.onkeyup = () => handleEditorChange(tabId);
	}

	function handleEditorChange(tabId) {
		const activeTab = state.tabsModule?.getActiveTab();
		if (!activeTab || activeTab.id !== tabId) return;
		const textarea = getTextarea(tabId);
		const dirty = getEditorValue() !== (textarea?.value ?? '');
		updateDirtyState(dirty);
		updateStats();
	}

	function updateSaveAsButtonState() {
		const saveAsButton = mainEl.querySelector('#weaver_save_as_btn');
		if (saveAsButton) saveAsButton.disabled = state.tabsModule?.getTabs().length === 0;
	}

	function updateActionButtonsVisibility() {
		const tabs = state.tabsModule?.getTabs() || [];
		const hasTabs = tabs.length > 0;

		const saveBtn = mainEl.querySelector('#weaver_save_btn');
		const saveAsBtn = mainEl.querySelector('#weaver_save_as_btn');

		if (saveBtn) saveBtn.style.display = hasTabs ? '' : 'none';
		if (saveAsBtn) saveAsBtn.style.display = hasTabs ? '' : 'none';
	}

	function updateStats() {
		const statsEl = mainEl.querySelector('#weaver_stats');
		if (!statsEl) return;

		const activeTab = state.tabsModule?.getActiveTab();
		if (activeTab) {
			const value = getEditorValue();
			const lines = value ? value.split('\n').length : 0;
			const chars = value.length;
			statsEl.innerHTML = `<span>${Joomla.Text._('COM_WEAVER_STATUS_STATS').replace('%s', lines).replace('%s', chars)}</span>`;
		} else {
			statsEl.innerHTML = '';
		}
	}

	function renderWelcomePane() {
		const editorContainer = mainEl.querySelector('#weaver_editor_container');
		if (!editorContainer) return;
		
		const welcomeContent = editorContainer.querySelector('.weaver-welcome-content');
		if (welcomeContent) return;
		
		editorContainer.insertAdjacentHTML('afterbegin', `
			<div class="weaver-welcome-content">
				<div class="weaver-welcome-icon">📝</div>
				<h1 class="weaver-welcome-title">${Joomla.Text._('COM_WEAVER_WELCOME_TITLE')}</h1>
				<p class="weaver-welcome-subtitle">${Joomla.Text._('COM_WEAVER_WELCOME_SUBTITLE_1')}</p>
				<p class="weaver-welcome-subtitle">${Joomla.Text._('COM_WEAVER_WELCOME_SUBTITLE_2')}</p>
			</div>
`);
	}

	function initTabsModule() {
		const tabsContainer = mainEl.querySelector('#weaver_tabs');
		const editorContainer = mainEl.querySelector('#weaver_editor_container');
		
		state.tabsModule = new window.CottonTabs(tabsContainer, editorContainer, {
			onTabClose: async (tab) => {
				const shouldClose = !tab.dirty || await promptSaveBeforeClose(tab);
				if (shouldClose) {
					return true;
				}
			},
			onTabChange: (tab) => {
				focusEditor();
				updateStats();
				updateDirtyState(tab.dirty);
			},
			onTabCreate: (tab) => {
				attachEditorHooks(tab.id);
			},
			createPane: (tab) => createEditorPane(tab),
			getTabIcon: (tab) => getTabIcons(tab)
		});

		state.tabsModule.on('tab:create', () => updateActionButtonsVisibility());
		state.tabsModule.on('tab:close', () => updateActionButtonsVisibility());
	}

	function renderUI() {
		mainEl.appendChild(buildHeader());
		mainEl.appendChild(buildTopBar());
		mainEl.appendChild(buildMain());
		mainEl.appendChild(buildFooter());
		
		initTabsModule();

		if (state.ux) {
			initUXManager();
		}

		renderWelcomePane();
		bindActions();
		updateActionButtonsVisibility();
	}

	function bindActions() {
		mainEl.querySelector('#weaver_toggle_tree_btn')?.addEventListener('click', toggleWeaverTree);
		mainEl.querySelector('#weaver_toggle_mcp_btn')?.addEventListener('click', toggleWeaverMcp);
		mainEl.querySelector('#weaver_open_btn')?.addEventListener('click', openFileById);
		mainEl.querySelector('#weaver_open_folder_btn')?.addEventListener('click', openFolderById);
		mainEl.querySelector('#weaver_new_btn')?.addEventListener('click', createNewFile);
		mainEl.querySelector('#weaver_save_btn')?.addEventListener('click', saveCurrentFile);
		mainEl.querySelector('#weaver_save_as_btn')?.addEventListener('click', saveAsFile);

		if (state.ux) {
            mainEl.querySelector('#weaver_maximize')?.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                uxManager?.toggleMaximize(mainEl);
            });

            mainEl.querySelector('#weaver_header')?.addEventListener('dblclick', event => {
                event.preventDefault();
                event.stopPropagation();
                uxManager?.toggleMaximize(mainEl);
            });
        }
	}

    function initUXManager() {

        if (!uxManager) {
            return;
        }

        const header = mainEl.querySelector('#weaver_header');
        const tree = mainEl.querySelector('#weaver_tree');
        const mcp = mainEl.querySelector('#weaver_mcp');

		uxManager.addDraggable({
			id: 'weaver-header-drag',
			handle: header,
			target: mainEl,
			position: 'fixed'
		});

        uxManager.addResizable({
            id: 'weaver-tree-resize',
            target: tree,
            edges: ['right'],
            minWidth: 160,
            maxWidth: 600
        });

        uxManager.addResizable({
            id: 'weaver-mcp-resize',
            target: mcp,
            edges: ['right'],
            handleSide: 'left',
            minWidth: 160,
            maxWidth: 600
        });

		uxManager.addResizable({
			id: 'weaver-container-resize',
			target: mainEl,
			edges: ['top', 'right', 'bottom', 'left'],
			minWidth: 320,
			minHeight: 240,
			position: 'fixed'
		});

    }

	function focusEditor() {
		const editor = getEditor();
		if (editor) {
			const editorView = editor.querySelector('.cm-editor');
			const contentDOM = editor.querySelector('.cm-content');
			if (editorView && contentDOM) {
				editorView.focus();
				contentDOM.focus();
			}
		}
	}

	const getFolderPath = async (folderId) => {
		try {
			if (!folderId || folderId === 0) return '';
			const payload = await apiRequest('items_load', { folder_id: folderId });
			if (payload && payload.path) {
				return payload.path;
			}
			return '';
		} catch (error) {
			return '';
		}
	}

	const apiRequest = async (task, data = {}) => {
		if (!window.CottonAPI) {
			throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_API'));
		}

		if (!CottonAPI.siteUrl) {
			CottonAPI.init(config.siteUrl, config.admin, config.token);
		}

		const formData = new FormData();
		for (const key in data) {
			if (data[key] !== null && data[key] !== undefined) {
				formData.append(key, data[key]);
			}
		}

		const result = await CottonAPI._request(`cotton.${task}`, formData);
		return result.data ?? result;
	}

	const openFile = async (fileId) => {
		try {
			const tabs = state.tabsModule?.getTabs() || [];
			const existingTab = tabs.find(tab => tab.id === fileId);
			if (existingTab) {
				state.tabsModule.switchToTab(existingTab.id);
				updateStats();
				setStatus(Joomla.Text._('COM_WEAVER_STATUS_FILE_ALREADY_OPEN'), 'info');
				return;
			}

			setStatus(Joomla.Text._('COM_WEAVER_STATUS_OPENING'), 'info');
			const payload = await apiRequest('open_editor', { file_id: fileId });

			if (payload.success === false) {
				const errorMessage = payload.error || Joomla.Text._('COM_WEAVER_ERROR_OPEN_FAILED');
				console.error('[Weaver] openFile blocked:', errorMessage);
				setStatus(errorMessage, 'error');
				if (window.CottonModal) {
					const errorModal = new CottonModal({
						title: Joomla.Text._('COM_WEAVER_ERROR_FILE_TYPE_NOT_ALLOWED'),
						icon: window.CottonUIManager.getMimeIcon('text/plain', { size: 'fa-1x', colored: true }),
						width: '420px',
						height: '200px',
						body: `<span style="color: var(--cot-red, #d93025); margin: 10px; font-size: small;">${escapeHtml(errorMessage)}</span>`,
						showFooter: true,
						showCancel: false,
						showSubmit: true,
						submitText: Joomla.Text._('COM_WEAVER_BUTTON_OK'),
						submitClass: 'cotton-btn-primary',
						onSubmit: () => errorModal.close()
					});
					errorModal.open();
				}
				return;
			}

			const name = payload.name || `file-${payload.file_id}`;
			const content = payload.content || '';
			const ext = getMode(name);
			const folderId = payload.folder_id || 0;
			const folderPath = payload.folder_path || '';
			const openLink = payload.open_link || 0;
		state.tabsModule.addTab({
			id: payload.file_id || fileId,
			fileId: payload.file_id || fileId,
			name: name,
			content: content,
			ext: ext,
			folderId: folderId,
			folderPath: folderPath,
			openLink: openLink
		});
			updateStats();
			setStatus(Joomla.Text._('COM_WEAVER_STATUS_FILE_LOADED'), 'success');
		} catch (error) {
			console.error('[Weaver] openFile error:', error);
			setStatus(error.message, 'error');
		}
	}

	const saveCurrentFile = async () => {
		const activeTab = state.tabsModule?.getActiveTab();
		if (!activeTab || !(activeTab.fileId || activeTab.id)) {
			return saveAsFile();
		}
		try {
			setStatus(Joomla.Text._('COM_WEAVER_STATUS_SAVING'), 'info');
			const content = getEditorValue();
			const result = await apiRequest('file_save', { file_id: activeTab.fileId || activeTab.id, content });

			if (result.success === false) {
				throw new Error(result.error || Joomla.Text._('COM_WEAVER_ERROR_SAVE_FAILED'));
			}

			state.tabsModule.setDirty(activeTab.id, false);
			activeTab.content = content;
			const textarea = getTextarea(activeTab.id);
			if (textarea) textarea.value = content;
			updateDirtyState(false);
			updateStats();
			setStatus(Joomla.Text._('COM_WEAVER_STATUS_SAVED'), 'success');
			if (result.name) {
				activeTab.name = result.name;
			}
			focusEditor();
		} catch (error) {
			setStatus(error.message, 'error');
		}
	}

	const createNewFile = async () => {
		let modal = null;
		let pickerManager = null;
		let selectedFolderId = 0;

		try {
			if (!window.CottonModal) {
				throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_MODAL'));
			}
			if (!window.CottonUIManager) {
				throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_UI_MANAGER'));
			}

			const updateSelectedFolder = (folderId, folderPath = '/') => {
				selectedFolderId = parseInt(folderId || '0', 10) || 0;

				const folderInput = document.getElementById('weaver_new_file_folder_id');
				if (folderInput) {
					folderInput.value = selectedFolderId;
				}

				const folderLabel = document.getElementById('weaver_new_file_selected_folder');
				if (folderLabel) {
					folderLabel.textContent = selectedFolderId === 0 ? Joomla.Text._('COM_WEAVER_FOLDER_ROOT') : folderPath;
				}
			};

			modal = new CottonModal({
				title: Joomla.Text._('COM_WEAVER_MODAL_TITLE_NEW_FILE'),
				icon: window.CottonUIManager.getMimeIcon('text/plain', { size: 'fa-1x', colored: true }),
				width: '800px',
				height: '530px',
				body: `
					<form id="weaver-new-file-form">
						<div>
							<div id="weaver_new_file_picker" style="height: 360px;"></div>
							<input type="hidden" id="weaver_new_file_folder_id" name="folder_id" value="0">
						</div>
						<div class="weaver-new-file-fields">
							<div class="form-group-file">
								<label for="weaver_new_file_name">${Joomla.Text._('COM_WEAVER_LABEL_FILE_NAME')}</label>
								<input class="cotton-search-input" type="text" id="weaver_new_file_name" name="file_name" placeholder="${Joomla.Text._('COM_WEAVER_FILENAME_DEFAULT')}" required>
							</div>
							<div class="form-group-file">
								<label for="weaver_new_file_desc">${Joomla.Text._('COM_WEAVER_LABEL_DESCRIPTION')}</label>
								<input class="cotton-search-input" type="text" id="weaver_new_file_desc" name="file_description" placeholder="${Joomla.Text._('COM_WEAVER_LABEL_OPTIONAL')}">
							</div>
						</div>
					</form>
				`,
				showFooter: true,
				showCancel: true,
				showSubmit: true,
				submitText: Joomla.Text._('COM_WEAVER_BUTTON_CREATE'),
				onOpen: async () => {
					const pickerContainer = document.getElementById('weaver_new_file_picker');
					if (!pickerContainer) return;

					pickerManager = new window.CottonUIManager(pickerContainer, {
						siteUrl: config.siteUrl,
						admin: config.admin,
						token: config.token,
						treeData: null,
						itemsData: null,
						autoOpenFile: false,
						pickMode: 'folder',
					});

					pickerManager.on('folder:selected', (folder) => {
						updateSelectedFolder(folder.id, folder.path);
					});

					updateSelectedFolder(0, '/');
					await pickerManager.initialize();
					updateSelectedFolder(pickerManager.getActiveFolderId(), '/');
				},
				onSubmit: async (data) => {
					const fileName = data.file_name?.trim();
					if (!fileName) {
						alert(Joomla.Text._('COM_WEAVER_ERROR_FILENAME_REQUIRED'));
						return false;
					}

					if (!fileName.includes('.') || fileName.split('.').pop() === '') {
						if (modal) {
							modal.close();
						}
						if (window.CottonModal) {
							const errorModal = new CottonModal({
								title: Joomla.Text._('COM_WEAVER_ERROR_FILE_TYPE_NOT_ALLOWED'),
								icon: window.CottonUIManager.getMimeIcon('text/plain', { size: 'fa-1x', colored: true }),
								width: '420px',
								height: '200px',
								body: `<span style="color: var(--cot-red, #d93025); margin: 10px; font-size: small;">${escapeHtml(Joomla.Text._('COM_WEAVER_ERROR_FILE_REQUIRES_EXTENSION'))}</span>`,
								showFooter: true,
								showCancel: false,
								showSubmit: true,
								submitText: Joomla.Text._('COM_WEAVER_BUTTON_OK'),
								submitClass: 'cotton-btn-primary',
								onSubmit: () => errorModal.close()
							});
							errorModal.open();
						}
						return false;
					}

					const fileExtension = fileName.split('.').pop().toLowerCase();
					if (!modeMap[fileExtension]) {
						if (modal) {
							modal.close();
						}
						if (window.CottonModal) {
							const allowedExtensions = Object.keys(modeMap).sort().join(', ');
							const errorModal = new CottonModal({
								title: Joomla.Text._('COM_WEAVER_ERROR_FILE_TYPE_NOT_ALLOWED'),
								icon: window.CottonUIManager.getMimeIcon('text/plain', { size: 'fa-1x', colored: true }),
								width: '500px',
								height: '240px',
								body: `<span style="color: var(--cot-red, #d93025); margin: 10px; font-size: small;">${escapeHtml(Joomla.Text._('COM_WEAVER_ERROR_EXTENSION_NOT_ALLOWED').replace('%s', allowedExtensions))}</span>`,
								showFooter: true,
								showCancel: false,
								showSubmit: true,
								submitText: Joomla.Text._('COM_WEAVER_BUTTON_OK'),
								submitClass: 'cotton-btn-primary',
								onSubmit: () => errorModal.close()
							});
							errorModal.open();
						}
						return false;
					}

					const folderId = parseInt(document.getElementById('weaver_new_file_folder_id')?.value ?? selectedFolderId, 10) || 0;
					if (folderId < 0) {
						alert(Joomla.Text._('COM_WEAVER_ERROR_SELECT_VALID_FOLDER_CREATE'));
						return false;
					}

					setStatus(Joomla.Text._('COM_WEAVER_STATUS_CREATING'), 'info');
					const createResult = await apiRequest('file_create', {
						folder_id: folderId,
						file_name: fileName,
						content: '',
						file_description: data.file_description?.trim() || ''
					});

					if (createResult.success === false) {
						throw new Error(createResult.message || Joomla.Text._('COM_WEAVER_ERROR_CREATE_FAILED'));
					}

					const actualFileName = createResult.name || fileName;
					const folderPath = await getFolderPath(folderId);
					const openLink = parseInt(createResult.open_link ?? 0, 10) || 0;
					state.tabsModule.addTab({
						id: createResult.id,
						fileId: createResult.id,
						name: actualFileName,
						content: '',
						ext: getMode(actualFileName),
						folderId: folderId,
						folderPath: folderPath,
						openLink: openLink
					});
					updateStats();
					if (isWeaverTreeOpen()) {
						await openFolder(folderId);
					}
					setStatus(Joomla.Text._('COM_WEAVER_STATUS_CREATED'), 'success');
				},
				onClose: () => {
					if (pickerManager) {
						pickerManager.destroy();
						pickerManager = null;
					}
				}
			});
			modal.open();
		} catch (error) {
			if (modal) {
				modal.close();
			}
			setStatus(error.message, 'error');
		}
	}

	const saveAsFile = async () => {
		let modal = null;
		let pickerManager = null;
		const activeTab = state.tabsModule?.getActiveTab();
		const defaultName = activeTab ? activeTab.name : 'untitled.txt';
		const defaultFolder = activeTab ? (activeTab.folderId || 0) : 0;
		let selectedFolderId = defaultFolder;

		try {
			if (!window.CottonModal) {
				throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_MODAL'));
			}
			if (!window.CottonUIManager) {
				throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_UI_MANAGER'));
			}

			const updateSelectedFolder = (folderId, folderPath = '/') => {
				selectedFolderId = parseInt(folderId || '0', 10) || 0;

				const folderInput = document.getElementById('weaver_save_as_folder_id');
				if (folderInput) {
					folderInput.value = selectedFolderId;
				}

				const folderLabel = document.getElementById('weaver_save_as_selected_folder');
				if (folderLabel) {
					folderLabel.textContent = selectedFolderId === 0 ? Joomla.Text._('COM_WEAVER_FOLDER_ROOT') : folderPath;
				}
			};

			modal = new CottonModal({
				title: Joomla.Text._('COM_WEAVER_MODAL_TITLE_SAVE_AS'),
				icon: window.CottonUIManager.getMimeIcon('text/plain', { size: 'fa-1x', colored: true }),
				width: '800px',
				height: '530px',
				body: `
					<form id="weaver-save-as-form">
						<div>
							<div id="weaver_save_as_picker" style="height: 360px;"></div>
							<input type="hidden" id="weaver_save_as_folder_id" name="folder_id" value="${defaultFolder}">
						</div>
						<div class="weaver-new-file-fields">
							<div class="form-group-file">
								<label for="weaver_save_as_name">${Joomla.Text._('COM_WEAVER_LABEL_FILE_NAME')}</label>
								<input class="cotton-search-input" type="text" id="weaver_save_as_name" name="file_name" value="${escapeHtml(defaultName)}" required>
							</div>
							<div class="form-group-file">
								<label for="weaver_save_as_desc">${Joomla.Text._('COM_WEAVER_LABEL_DESCRIPTION')}</label>
								<input class="cotton-search-input" type="text" id="weaver_save_as_desc" name="file_description" placeholder="${Joomla.Text._('COM_WEAVER_LABEL_OPTIONAL')}">
							</div>
						</div>
					</form>
				`,
				showFooter: true,
				showCancel: true,
				showSubmit: true,
				submitText: Joomla.Text._('COM_WEAVER_BUTTON_SAVE'),
				onOpen: async () => {
					const pickerContainer = document.getElementById('weaver_save_as_picker');
					if (!pickerContainer) return;

					pickerManager = new window.CottonUIManager(pickerContainer, {
						siteUrl: config.siteUrl,
						admin: config.admin,
						token: config.token,
						treeData: null,
						itemsData: null,
						autoOpenFile: false,
						pickMode: 'folder',
					});

					pickerManager.on('folder:selected', (folder) => {
						updateSelectedFolder(folder.id, folder.path);
					});

					updateSelectedFolder(defaultFolder, defaultFolder === 0 ? '/' : Joomla.Text._('COM_WEAVER_STATUS_LOADING'));
					await pickerManager.initialize();

					if (defaultFolder > 0) {
						await pickerManager.setActiveFolder(defaultFolder);
					} else {
						updateSelectedFolder(pickerManager.getActiveFolderId(), '/');
					}
				},
				onSubmit: async (data) => {
					const newName = data.file_name?.trim();
					if (!newName) {
						alert(Joomla.Text._('COM_WEAVER_ERROR_FILENAME_REQUIRED'));
						return false;
					}

					if (!newName.includes('.') || newName.split('.').pop() === '') {
						if (modal) {
							modal.close();
						}
						if (window.CottonModal) {
							const errorModal = new CottonModal({
								title: Joomla.Text._('COM_WEAVER_ERROR_FILE_TYPE_NOT_ALLOWED'),
								icon: window.CottonUIManager.getMimeIcon('text/plain', { size: 'fa-1x', colored: true }),
								width: '420px',
								height: '200px',
								body: `<span style="color: var(--cot-red, #d93025); margin: 10px; font-size: small;">${escapeHtml(Joomla.Text._('COM_WEAVER_ERROR_FILE_REQUIRES_EXTENSION'))}</span>`,
								showFooter: true,
								showCancel: false,
								showSubmit: true,
								submitText: Joomla.Text._('COM_WEAVER_BUTTON_OK'),
								submitClass: 'cotton-btn-primary',
								onSubmit: () => errorModal.close()
							});
							errorModal.open();
						}
						return false;
					}

					const fileExtension = newName.split('.').pop().toLowerCase();
					if (!modeMap[fileExtension]) {
						if (modal) {
							modal.close();
						}
						if (window.CottonModal) {
							const allowedExtensions = Object.keys(modeMap).sort().join(', ');
							const errorModal = new CottonModal({
								title: Joomla.Text._('COM_WEAVER_ERROR_FILE_TYPE_NOT_ALLOWED'),
								icon: window.CottonUIManager.getMimeIcon('text/plain', { size: 'fa-1x', colored: true }),
								width: '500px',
								height: '240px',
								body: `<span style="color: var(--cot-red, #d93025); margin: 10px; font-size: small;">${escapeHtml(Joomla.Text._('COM_WEAVER_ERROR_EXTENSION_NOT_ALLOWED').replace('%s', allowedExtensions))}</span>`,
								showFooter: true,
								showCancel: false,
								showSubmit: true,
								submitText: Joomla.Text._('COM_WEAVER_BUTTON_OK'),
								submitClass: 'cotton-btn-primary',
								onSubmit: () => errorModal.close()
							});
							errorModal.open();
						}
						return false;
					}

					const folderId = parseInt(document.getElementById('weaver_save_as_folder_id')?.value ?? selectedFolderId, 10) || 0;
					if (folderId < 0) {
						alert(Joomla.Text._('COM_WEAVER_ERROR_SELECT_VALID_FOLDER_SAVE'));
						return false;
					}

					const content = getEditorValue();
					setStatus(Joomla.Text._('COM_WEAVER_STATUS_SAVING_COPY'), 'info');
					const saveResult = await apiRequest('file_create', {
						folder_id: folderId,
						file_name: newName,
						content,
						file_description: data.file_description?.trim() || ''
					});

					if (saveResult.success === false) {
						throw new Error(saveResult.message || Joomla.Text._('COM_WEAVER_ERROR_SAVE_FAILED'));
					}

					const actualFileName = saveResult.name || newName;
					const folderPath = await getFolderPath(folderId);
					const openLink = parseInt(saveResult.open_link ?? 0, 10) || 0;
					if (activeTab) {
						activeTab.fileId = saveResult.id;
						activeTab.name = actualFileName;
						activeTab.dirty = false;
						activeTab.content = content;
						activeTab.folderId = folderId;
						activeTab.folderPath = folderPath;
						activeTab.openLink = openLink;
						const textarea = getTextarea(activeTab.id);
						if (textarea) textarea.value = content;

					updateDirtyState(false);
					updateStats();
				} else {
						state.tabsModule.addTab({
							id: saveResult.id,
							fileId: saveResult.id,
							name: actualFileName,
							content: content,
							ext: getMode(actualFileName),
							folderId: folderId,
							folderPath: folderPath,
							openLink: openLink
						});
					}
					if (isWeaverTreeOpen()) {
						await openFolder(folderId);
					}
					setStatus(Joomla.Text._('COM_WEAVER_STATUS_COPY_SAVED'), 'success');
				},
				onClose: () => {
					if (pickerManager) {
						pickerManager.destroy();
						pickerManager = null;
					}
				}
			});
			modal.open();
		} catch (error) {
			if (modal) {
				modal.close();
			}
			setStatus(error.message, 'error');
		}
	}

	const openFolder = async (folderId = 0) => {
		try {
			setStatus(Joomla.Text._('COM_WEAVER_STATUS_OPENING_FOLDER'), 'info');
			const treePayload = await apiRequest('tree_load', {
				folder_id: folderId,
				with_files: 1
			});

			state.treeData = treePayload;
			state.treeRootFolderId = folderId;
			
			const treeContainer = document.getElementById('weaver_tree');
			if (treeContainer && window.CottonTree) {
				if (!state.treeInstance) {
					state.treeInstance = new window.CottonTree(treeContainer, {
						onFileClick: (file) => openFile(file.id),
						onFolderClick: (folder) => {
							state.treeRootFolderId = folder.id;
						},
						getIcon: (mimeType, opts) => window.CottonUIManager?.getMimeIcon(mimeType, opts) || '',
						getPermissionIcon: (item) => window.CottonUIManager?.getPermissionIcon(item) || ''
					});
				}
				state.treeInstance.render(treePayload, { startNode: folderId });
			}
			showWeaverTree();
			setStatus(Joomla.Text._('COM_WEAVER_STATUS_FOLDER_LOADED'), 'success');
		} catch (error) {
			console.error('[Weaver] openFolder error:', error);
			setStatus(error.message, 'error');
		}
	}

	const openFolderById = async () => {
		let modal = null;
		let pickerManager = null;
		let selectedFolderId = 0;

		try {
			if (!window.CottonModal) {
				throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_MODAL'));
			}
			if (!window.CottonUIManager) {
				throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_UI_MANAGER'));
			}

			const updateSelectedFolder = (folderIdValue, folderPath = '/') => {
				selectedFolderId = parseInt(folderIdValue || '0', 10) || 0;

				const folderInput = document.getElementById('weaver_open_folder_id');
				if (folderInput) {
					folderInput.value = selectedFolderId;
				}

				const folderLabel = document.getElementById('weaver_open_folder_selected');
				if (folderLabel) {
					folderLabel.textContent = selectedFolderId === 0 ? Joomla.Text._('COM_WEAVER_FOLDER_ROOT') : folderPath;
				}
			};

			modal = new CottonModal({
				title: Joomla.Text._('COM_WEAVER_MODAL_TITLE_OPEN_FOLDER'),
				icon: window.CottonUIManager.getMimeIcon('folder', { size: 'fa-1x', colored: true }),
				width: '800px',
				height: '480px',
				body: `<div id="weaver_open_folder_picker"></div>`,
				showFooter: true,
				showCancel: true,
				showSubmit: true,
				submitText: Joomla.Text._('COM_WEAVER_BUTTON_OPEN'),
				onOpen: async () => {
					const pickerContainer = document.getElementById('weaver_open_folder_picker');
					if (!pickerContainer) return;

					pickerManager = new window.CottonUIManager(pickerContainer, {
						siteUrl: config.siteUrl,
						admin: config.admin,
						token: config.token,
						treeData: null,
						itemsData: null,
						autoOpenFile: false,
						pickMode: 'folder',
					});

					pickerManager.on('folder:selected', (folder) => {
						updateSelectedFolder(folder.id, folder.path);
					});

					updateSelectedFolder(0, '/');
					await pickerManager.initialize();
					updateSelectedFolder(pickerManager.getActiveFolderId(), '/');
				},
				onSubmit: async () => {
					const folderId = selectedFolderId || 0;
					if (folderId < 0) {
						alert(Joomla.Text._('COM_WEAVER_ERROR_SELECT_VALID_FOLDER_OPEN'));
						return false;
					}
					await openFolder(folderId);
				},
				onClose: () => {
					if (pickerManager) {
						pickerManager.destroy();
						pickerManager = null;
					}
				}
			});
			modal.open();
		} catch (error) {
			if (modal) {
				modal.close();
			}
			setStatus(error.message, 'error');
		}
	}

	const openFileById = async () => {
		try {
			if (!window.CottonModal) {
				throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_MODAL'));
			}

			let selectedFile = null;

			const modal = new CottonModal({
				title: Joomla.Text._('COM_WEAVER_MODAL_TITLE_OPEN_FILE'),
				icon: window.CottonUIManager.getMimeIcon('text/plain', { size: 'fa-1x', colored: true }),
				width: '800px',
				height: '480px',
				body: `<div id="weaver_open_file"></div>`,
				showFooter: true,
				showCancel: true,
				showSubmit: true,
				submitText: Joomla.Text._('COM_WEAVER_BUTTON_SELECT'),
				onOpen: async () => {
					const fileContainer = document.getElementById('weaver_open_file');
					if (!fileContainer) return;

					if (!window.CottonUIManager) {
						console.warn('[Weaver] CottonUIManager not available for open file modal');
						return;
					}

					const pickerManager = new window.CottonUIManager(fileContainer, {
						siteUrl: config.siteUrl,
						admin: config.admin,
						token: config.token,
						pickMode: 'file'
					});

					pickerManager.on('file:doubleClicked', (file) => {
						selectedFile = file;
						const modalEl = modal.getElement?.();
						const submitBtn = modalEl ? modalEl.querySelector('.cotton-modal-submit') : null;
						if (submitBtn) {
							submitBtn.click();
						}
					});

				pickerManager.on('file:selected', (data) => {
					selectedFile = data.file;
				});

					await pickerManager.initialize();
				},
				onSubmit: async () => {
					if (!selectedFile) {
						alert(Joomla.Text._('COM_WEAVER_ERROR_SELECT_FILE_FIRST'));
						return false;
					}
					await openFile(selectedFile.id);
					modal.close();
				},
				onCancel: () => modal.close()
			});
			modal.open();
		} catch (error) {
			console.error('[Weaver] openFileById error:', error);
			setStatus(error.message, 'error');
		}
	}

	const promptSaveBeforeClose = async (tab) => {
		if (!window.CottonModal) return false;

		return new Promise((resolve) => {
			const modal = new CottonModal({
				title: Joomla.Text._('COM_WEAVER_MODAL_TITLE_SAVE_CLOSE'),
				icon: window.CottonUIManager.getMimeIcon('text/plain', { size: 'fa-1x', colored: true }),
				width: '300px',
				height: '180px',
				body: `
					<p>${Joomla.Text._('COM_WEAVER_PROMPT_SAVE_CHANGES_PREFIX')}<strong>${escapeHtml(tab.name)}</strong>?</p>
					<div class="cotton-modal-footer">
						<button type="button" id="weaver_close_dont_save" class="btn btn-outline-secondary btn-sm">${Joomla.Text._('COM_WEAVER_BUTTON_DONT_SAVE')}</button>
						<button type="button" id="weaver_close_cancel" class="btn btn-outline-secondary btn-sm">${Joomla.Text._('COM_WEAVER_BUTTON_CANCEL')}</button>
						<button type="button" id="weaver_close_save" class="btn btn-outline-secondary btn-sm active">${Joomla.Text._('COM_WEAVER_BUTTON_SAVE')}</button>
					</div>
				`,
				showFooter: false,
				showCancel: false,
				showSubmit: false,
				onOpen: () => {
					document.getElementById('weaver_close_dont_save')?.addEventListener('click', () => {
						modal.close();
						resolve(true);
					});
					document.getElementById('weaver_close_cancel')?.addEventListener('click', () => {
						modal.close();
						resolve(false);
					});
					document.getElementById('weaver_close_save')?.addEventListener('click', async () => {
						modal.close();
						await saveCurrentFile();
						resolve(true);
					});
				}
			});
			modal.open();
		});
	}

	const initialize = async () => {
		renderUI();

		if (config.file_id) openFile(config.file_id);

		if (window.WeaverMCPPanel) {
			window.WeaverMCPPanel.init(config.siteUrl);
		}
	};

	function getTreeRootFolderId() {
		return state.treeRootFolderId || 0;
	}

	async function refreshTree() {
		const folderId = state.treeRootFolderId || 0;
		await openFolder(folderId);
	}

	function getOpenTabs() {
		return state.tabsModule?.getTabs() || [];
	}

	function getActiveTab() {
		return state.tabsModule?.getActiveTab() || null;
	}

	async function openTab(fileId) {
		return openFile(fileId);
	}

	async function createFile(folderId, fileName, content = '') {
		const result = await apiRequest('file_create', {
			folder_id: folderId,
			file_name: fileName,
			content: content,
			file_description: ''
		});
		if (result.success === false) {
			throw new Error(result.message || Joomla.Text._('COM_WEAVER_ERROR_CREATE_FAILED'));
		}
		return result;
	}

	async function createFolder(folderId, folderName) {
		const result = await apiRequest('folder_create', {
			folder_id: folderId,
			folder_name: folderName
		});
		if (result.success === false) {
			throw new Error(result.message || Joomla.Text._('COM_WEAVER_ERROR_CREATE_FOLDER_FAILED'));
		}
		return result;
	}

	async function saveActiveTab(content) {
		const activeTab = state.tabsModule?.getActiveTab();
		if (!activeTab || !(activeTab.fileId || activeTab.id)) {
			throw new Error(Joomla.Text._('COM_WEAVER_ERROR_NO_ACTIVE_TAB_SAVE'));
		}
		const result = await apiRequest('file_save', {
			file_id: activeTab.fileId || activeTab.id,
			content: content
		});
		if (result.success === false) {
			throw new Error(result.message || Joomla.Text._('COM_WEAVER_ERROR_SAVE_FAILED'));
		}
		state.tabsModule.setDirty(activeTab.id, false);
		activeTab.content = content;
		const textarea = getTextarea(activeTab.id);
		if (textarea) textarea.value = content;
		updateDirtyState(false);
		updateStats();
		return result;
	}

	function setEditorContent(tabId, content) {
		const editor = mainEl.querySelector(`#weaver_editor_${tabId}`);
		const textarea = mainEl.querySelector(`#weaver_content_${tabId}`);
		if (editor && editor.jEditor && typeof editor.jEditor.setValue === 'function') {
			editor.jEditor.setValue(content);
		} else if (textarea) {
			textarea.value = content;
		}
		const tab = state.tabsModule?.getTabById(tabId);
		if (tab) {
			tab.content = content;
		}
		updateDirtyState(true);
		updateStats();
	}

	function refreshOpenTab(fileId, newContent) {
		const tabs = state.tabsModule?.getTabs() || [];
		const tab = tabs.find(t => t.fileId === fileId || t.id === fileId);
		if (!tab) return false;

		setEditorContent(tab.id, newContent);
		state.tabsModule.setDirty(tab.id, false);
		updateDirtyState(false);
		updateStats();
		return true;
	}

	return {
		initialize,
		getTreeRootFolderId,
		getOpenTabs,
		getActiveTab,
		openTab,
		createFile,
		createFolder,
		saveActiveTab,
		refreshOpenTab,
		setEditorContent,
		refreshTree
	};

})();

window.WeaverEditor = WeaverEditor;

window.addEventListener('DOMContentLoaded', () => {
	WeaverEditor.initialize();
});