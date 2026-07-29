/**
 * @package Tabaoca.Component.Weaver.Site
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * Weaver MCP Panel
 * 
 * Interface do painel MCP no Weaver Editor.
 * Integra o cliente MCP com o assistente KILO CODE.
 */

const WeaverMCPPanel = (() => {
	const PANEL_ID = 'weaver_mcp';
	const STORAGE_KEY_MODEL = 'kilo-auto/free';
	const STORAGE_KEY_MODE = 'weaver_mcp_mode';

	let container = null;
	let mcpClient = null;
	let aiAssistant = null;
	let isOpen = false;
	let isProcessing = false;
	let messageHistory = [];
	let mcpContent = null;
	let currentAbortController = null;

	async function init() {
		container = document.getElementById(PANEL_ID);
		if (!container) {
			return false;
		}

		render();
		attachListeners();
		await initMCP();
		return true;
	}

	function render() {
		if (!container) return;

		const inner = document.createElement('div');
		inner.className = 'weaver-mcp-inner';
		inner.innerHTML = `
			<div class="weaver-mcp-header">
				<div class="weaver-mcp-title">
					<span class="weaver-mcp-icon">🤖</span>
					<span>${Joomla.Text._('COM_WEAVER_MCP_ASSISTANT_TITLE')}</span>
				</div>
				<button type="button" class="weaver-mcp-reset-btn" id="weaver_mcp_reset" title="${Joomla.Text._('COM_WEAVER_MCP_RESET_SESSION')}">
					<i class="fas fa-rotate-right"></i>
				</button>
			</div>
			<div class="weaver-mcp-body">
				<div class="weaver-mcp-messages" id="weaver_mcp_messages">
					<div class="weaver-mcp-message weaver-mcp-message--system">
						<div class="weaver-mcp-message-content"><strong>${Joomla.Text._('COM_WEAVER_MCP_WELCOME')}</strong><br>${Joomla.Text._('COM_WEAVER_MCP_WELCOME_DESC')}
						</div>
					</div>
				</div>
				
				<div class="weaver-mcp-status" id="weaver_mcp_status"></div>

				<div class="weaver-mcp-input-area">
					<div class="weaver-mcp-input-wrapper">
						<textarea 
							id="weaver_mcp_input" 
							class="weaver-mcp-input" 
							placeholder="${Joomla.Text._('COM_WEAVER_MCP_INPUT_PLACEHOLDER')}"
							autocomplete="off"
							disabled
							rows="3"
						></textarea>
					</div>
					<div class="weaver-mcp-controls">
						<div class="weaver-mcp-field">
							<label for="weaver_mcp_model">${Joomla.Text._('COM_WEAVER_MCP_LABEL_MODEL')}</label>
							<select id="weaver_mcp_model" class="weaver-mcp-select">
								<option value="">${Joomla.Text._('COM_WEAVER_MCP_MODELS_LOADING')}</option>
							</select>
						</div>
						<div class="weaver-mcp-field">
							<label for="weaver_mcp_mode">${Joomla.Text._('COM_WEAVER_MCP_LABEL_MODE')}</label>
							<select id="weaver_mcp_mode" class="weaver-mcp-select">
								<option value="code">${Joomla.Text._('COM_WEAVER_MCP_MODE_CODE')}</option>
								<option value="ask">${Joomla.Text._('COM_WEAVER_MCP_MODE_ASK')}</option>
								<option value="debug">${Joomla.Text._('COM_WEAVER_MCP_MODE_DEBUG')}</option>
								<option value="plan">${Joomla.Text._('COM_WEAVER_MCP_MODE_PLAN')}</option>
							</select>
						</div>
						<button type="button" class="weaver-mcp-send-btn" id="weaver_mcp_send" disabled>
							<i class="fas fa-paper-plane"></i>
						</button>
					</div>
				</div>
			</div>`;

		const existingInner = container.querySelector('.weaver-mcp-inner');
		if (existingInner) {
			container.replaceChild(inner, existingInner);
		} else {
			container.appendChild(inner);
		}

		loadSettings();
	}

	function attachListeners() {
		const sendBtn = container.querySelector('#weaver_mcp_send');
		const input = container.querySelector('#weaver_mcp_input');
		const resetBtn = container.querySelector('#weaver_mcp_reset');

		if (sendBtn && input) {
			sendBtn.addEventListener('click', () => handleSend());
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					handleSend();
				}
			});
		}

		if (resetBtn) {
			resetBtn.addEventListener('click', () => handleReset());
		}
	}

	function showSettings(show) {
	}

	async function handleReset() {
		if (isProcessing) {
			if (currentAbortController) {
				currentAbortController.abort();
			}
			isProcessing = false;
			updateSendButton();
		}

		clearMessages();
		messageHistory = [];

		const assistant = window.WeaverKiloAssistant;
		if (assistant && typeof assistant.clearHistory === 'function') {
			assistant.clearHistory();
		}

		setStatus(Joomla.Text._('COM_WEAVER_MCP_CONNECTING'));

		try {
			if (mcpClient && typeof mcpClient.reset === 'function') {
				mcpContent = await mcpClient.reset();
			} else if (mcpClient && typeof mcpClient.connect === 'function') {
				mcpContent = await mcpClient.connect();
			}

			const candidate = window.WeaverKiloAssistant;
			if (candidate && typeof candidate.setToolDefinitions === 'function') {
				candidate.setToolDefinitions(mcpContent.tools || []);
			}
			if (candidate && typeof candidate.setResources === 'function') {
				candidate.setResources(mcpContent.resources || []);
			}
			if (candidate && typeof candidate.setPrompts === 'function') {
				candidate.setPrompts(mcpContent.prompts || []);
			}

			loadModelList(mcpContent.models || []);
			loadSettings();
			enableInput(true);
			setStatus('');
			addSystemMessage(Joomla.Text._('COM_WEAVER_MCP_CONNECTED'));
		} catch (error) {
			addSystemMessage(Joomla.Text._('COM_WEAVER_ERROR_MCP_CONNECT_PREFIX') + error.message, true);
			setStatus(Joomla.Text._('COM_WEAVER_MCP_CONNECTION_ERROR'));
			enableInput(false);
		}
	}

	async function initMCP() {
		if (mcpClient && mcpClient.isInitialized()) {
			return;
		}

		setStatus(Joomla.Text._('COM_WEAVER_MCP_CONNECTING'));

		try {
			mcpClient = window.WeaverMCPClient;
			if (!mcpClient) {
				throw new Error(Joomla.Text._('COM_WEAVER_ERROR_MCP_CLIENT_NOT_LOADED'));
			}

			const cfg = window.Joomla?.getOptions?.('cotton_config');
			const csrfToken = cfg?.token || '';
			if (csrfToken && typeof mcpClient.setCsrfToken === 'function') {
				mcpClient.setCsrfToken(csrfToken);
			}

			mcpContent = await mcpClient.connect();

			const maxAttempts = 10;
			const attemptDelay = 300;

			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				const candidate = window.WeaverKiloAssistant;
				if (candidate && typeof candidate.startStream === 'function') {
					aiAssistant = candidate;
					break;
				}

				if (attempt === maxAttempts) {
					throw new Error(Joomla.Text._('COM_WEAVER_ERROR_ASSISTANT_NOT_LOADED'));
				}

				await new Promise(resolve => setTimeout(resolve, attemptDelay));
			}

			if (aiAssistant && typeof aiAssistant.setToolDefinitions === 'function') {
				aiAssistant.setToolDefinitions(mcpContent.tools || []);
			}

			if (aiAssistant && typeof aiAssistant.setResources === 'function') {
				aiAssistant.setResources(mcpContent.resources || []);
			}

			if (aiAssistant && typeof aiAssistant.setPrompts === 'function') {
				aiAssistant.setPrompts(mcpContent.prompts || []);
			}

		loadModelList(mcpContent.models || []);
		loadSettings();

		enableInput(true);
			addSystemMessage(Joomla.Text._('COM_WEAVER_MCP_CONNECTED'));

			setStatus('');
		} catch (error) {
			addSystemMessage(Joomla.Text._('COM_WEAVER_ERROR_MCP_CONNECT_PREFIX') + error.message, true);
			setStatus(Joomla.Text._('COM_WEAVER_MCP_CONNECTION_ERROR'));
			enableInput(false);
		}
	}

	function loadModelList(models) {
		const modelSelect = container.querySelector('#weaver_mcp_model');
		if (!modelSelect || !mcpClient || !mcpClient.isInitialized()) {
			return;
		}

		try {
			modelSelect.innerHTML = '';

			if (models.length === 0) {
				modelSelect.innerHTML = '<option value="kilo-auto/free">' + Joomla.Text._('COM_WEAVER_MCP_MODEL_FALLBACK') + '</option>';
				return;
			}

			models.forEach((model) => {
				const option = document.createElement('option');
				option.value = model.id || '';
				const label = model.name || model.id || Joomla.Text._('COM_WEAVER_MCP_MODEL_NO_NAME');
				const suffix = model.free ? Joomla.Text._('COM_WEAVER_MCP_MODEL_FREE_SUFFIX') : '';
				option.textContent = label + suffix;
				modelSelect.appendChild(option);
			});
		} catch (error) {
			modelSelect.innerHTML = '<option value="kilo-auto/free">' + Joomla.Text._('COM_WEAVER_MCP_MODEL_FALLBACK') + '</option>';
		}
	}

	async function refreshMCPContext() {
		if (!mcpClient || !mcpClient.isInitialized()) {
			return;
		}

		try {
			const [tools, resources, prompts] = await Promise.all([
				mcpClient.listTools(),
				mcpClient.listResources(),
				mcpClient.listPrompts()
			]);

			mcpContent = {
				...mcpContent,
				tools,
				resources,
				prompts
			};

			if (aiAssistant && typeof aiAssistant.setToolDefinitions === 'function') {
				aiAssistant.setToolDefinitions(tools);
			}

			if (aiAssistant && typeof aiAssistant.setResources === 'function') {
				aiAssistant.setResources(resources);
			}

		if (aiAssistant && typeof aiAssistant.setPrompts === 'function') {
			aiAssistant.setPrompts(prompts);
		}
	} catch (error) {
			console.error(Joomla.Text._('COM_WEAVER_MCP_REFRESH_FAILED'), error);
		}
	}

	async function handleSend() {
		const input = container.querySelector('#weaver_mcp_input');
		if (!input || isProcessing) return;

		const text = input.value.trim();
		if (!text) return;

		if (currentAbortController) {
			currentAbortController.abort();
		}
		currentAbortController = new AbortController();

		input.value = '';
		isProcessing = true;
		updateSendButton();

		addUserMessage(text);
		setStatus(Joomla.Text._('COM_WEAVER_MCP_PROCESSING'));

		try {
			if (!mcpClient || !mcpClient.isInitialized()) {
				await initMCP();
			}

			await autoReadWeaverResources();

			const assistant = window.WeaverKiloAssistant;

			if (!assistant || typeof assistant.startStream !== 'function') {
				throw new Error(Joomla.Text._('COM_WEAVER_ERROR_ASSISTANT_UNAVAILABLE'));
			}

		let reasoningId = null;
		let reasoningText = '';
		let assistantId = null;
		let assistantText = '';
		let toolCallStarted = false;
		let isStreaming = true;
		let lastWasToolResult = false;

		function resetAfterTools() {
			reasoningText = '';
			reasoningId = null;
			assistantText = '';
			assistantId = null;
			lastWasToolResult = false;
		}

		function ensureReasoning() {
			if (!reasoningId) {
				reasoningId = addAssistantMessage('', true);
				const el = document.getElementById(reasoningId);
				if (el) {
					const contentEl = el.querySelector('.weaver-mcp-message-content');
					if (contentEl) {
						contentEl.innerHTML = '<strong>' + Joomla.Text._('COM_WEAVER_MCP_REASONING_LABEL') + '</strong><br>';
					}
				}
			}
		}

		function ensureAssistant() {
			if (!assistantId) {
				assistantId = addAssistantMessage('', true);
			}
		}

		function finalizeReasoning() {
			if (reasoningId) {
				const el = document.getElementById(reasoningId);
				if (el) {
					el.classList.add('weaver-mcp-message--reasoning');
					el.style.opacity = '0.85';
				}
			}
			reasoningText = '';
			reasoningId = null;
		}

		const onReasoning = (chunk) => {
			if (!isStreaming) return;
			if (lastWasToolResult) {
				resetAfterTools();
			}
			reasoningText += chunk;
			ensureReasoning();
			const el = document.getElementById(reasoningId);
			if (el) {
				const contentEl = el.querySelector('.weaver-mcp-message-content');
				if (contentEl) {
					contentEl.innerHTML = '<strong>' + Joomla.Text._('COM_WEAVER_MCP_REASONING_LABEL') + '</strong><br>' + escapeHtml(reasoningText);
				}
			}
			scrollToBottom();
		};

		const onMessage = (chunk) => {
			if (!isStreaming) return;
			if (lastWasToolResult) {
				resetAfterTools();
			}
			assistantText += chunk;
			ensureAssistant();
			updateAssistantMessage(assistantId, escapeHtml(assistantText));
			scrollToBottom();
		};

		const onToolCall = (event) => {
			if (!isStreaming) return;
			const type = event.type || 'tool_call';

			if (type === 'tool_call_start') {
				toolCallStarted = true;
				if (lastWasToolResult) {
					resetAfterTools();
				}
				finalizeReasoning();
				const name = event.name || 'unknown';
				const id = event.id || ('tool_' + Date.now());
				const toolMessageId = appendMessage('tool-call', '', false, { name, id, status: 'running' });
				event._messageId = toolMessageId;
			} else if (type === 'tool_call_delta') {
				const name = event.name || '';
				const args = event.arguments || '';
				const toolEl = document.querySelector(`[data-tool-id="${event.id}"] .weaver-mcp-tool-args`);
				if (toolEl) toolEl.textContent = args;
				if (name) {
					const nameEl = document.querySelector(`[data-tool-id="${event.id}"] .weaver-mcp-tool-name`);
					if (nameEl) nameEl.textContent = name;
				}
				scrollToBottom();
			} else if (type === 'tool_call_stop') {
				const toolEl = document.querySelector(`[data-tool-id="${event.id}"]`);
				if (toolEl) toolEl.classList.add('weaver-mcp-tool-call--waiting');
			}
		};

		const onToolResult = async (event) => {
			const success = event.success !== false;
			const output = event.output || '';
			const name = event.name || '';
			const id = event.id || '';

			let messageId = null;
			const existing = document.querySelector(`[data-tool-id="${id}"]`);
			if (existing) {
				existing.classList.remove('weaver-mcp-tool-call--waiting');
				existing.classList.add(success ? 'weaver-mcp-tool-call--success' : 'weaver-mcp-tool-call--error');
				const outputEl = existing.querySelector('.weaver-mcp-tool-output');
				if (outputEl) {
					outputEl.innerHTML = escapeHtml(output);
					outputEl.style.display = 'block';
				}
				const spinnerEl = existing.querySelector('.weaver-mcp-tool-spinner');
				if (spinnerEl) spinnerEl.textContent = success ? '✅' : '❌';
				messageId = existing.id;
			}

			if (!messageId) {
				const statusIcon = success ? '✅' : '❌';
				messageId = appendMessage('tool-result', `${statusIcon} <strong>[${name}]</strong>\n${escapeHtml(output)}`, !success);
			}

		const fileId = event.fileId || event.metadata?.file_id || event.metadata?.fileId || null;

		if (success && fileId && window.WeaverEditor?.refreshOpenTab) {
			const newContent = event.metadata?.content ?? event.content ?? output;
			window.WeaverEditor.refreshOpenTab(fileId, newContent);
		}

			if (success && window.WeaverEditor?.refreshTree) {
				const structuralTools = ['cotton-create', 'cotton-delete', 'mkdir', 'rmdir'];
				if (structuralTools.includes(name)) {
					window.WeaverEditor.refreshTree();
				}
			}

			const frontendCommand = event.metadata?.frontend_command || null;
			if (frontendCommand && window.WeaverMCPPanel?.handleWeaverCommand) {
				const cmdResult = await window.WeaverMCPPanel.handleWeaverCommand(frontendCommand, event.metadata);
				if (cmdResult) {
					const resultText = cmdResult.output || cmdResult.error || '';
					if (resultText) {
						if (existing) {
							const outputEl = existing.querySelector('.weaver-mcp-tool-output');
							if (outputEl) {
								outputEl.innerHTML = escapeHtml(resultText);
								outputEl.style.display = 'block';
							}
						} else {
							appendMessage('tool-result', `${success ? '✅' : '❌'} <strong>[${name}]</strong>\n${escapeHtml(resultText)}`, !success);
						}
					}
				}
				const weaverStructuralCommands = ['weaver:create-file', 'weaver:create-folder', 'weaver-set-content', 'weaver-create-file', 'weaver-create-folder'];
				if (weaverStructuralCommands.includes(frontendCommand) && window.WeaverEditor?.refreshTree) {
					window.WeaverEditor.refreshTree();
				}
			}

			lastWasToolResult = true;
			scrollToBottom();
		};

		const onDone = (result) => {
			isStreaming = false;
			if (reasoningId && reasoningText) {
				const el = document.getElementById(reasoningId);
				if (el) el.classList.add('weaver-mcp-message--reasoning');
			}
			if (!assistantText && !reasoningText && result.success !== false) {
				if (reasoningId) {
					const el = document.getElementById(reasoningId);
					if (el) el.remove();
				}
				if (assistantId) {
					const el = document.getElementById(assistantId);
					if (el) el.remove();
				}
			}
			setStatus('');
		};

			const onError = (message) => {
				isStreaming = false;
				addSystemMessage(Joomla.Text._('COM_WEAVER_ERROR_PREFIX') + message, true);
				setStatus(Joomla.Text._('COM_WEAVER_ERROR'));
			};

		const result = await assistant.startStream(text, mcpClient, {
			onMessage,
			onReasoning,
			onToolCall,
			onToolResult,
			onDone,
			onError,
			signal: currentAbortController.signal
		});
		} catch (error) {
			if (error.name !== 'AbortError') {
				addSystemMessage(Joomla.Text._('COM_WEAVER_ERROR_PREFIX') + error.message, true);
				setStatus(Joomla.Text._('COM_WEAVER_ERROR'));
			} else {
				addSystemMessage(Joomla.Text._('COM_WEAVER_MCP_STREAM_CANCELLED'), true);
			}
		} finally {
			isProcessing = false;
			currentAbortController = null;
			updateSendButton();
			input?.focus();
		}
	}

	async function handleWeaverCommand(text) {
		const parts = text.match(/^\/?([\w:-]+)(?:\s+(.*))?$/);
		if (!parts) return null;

		const [, command, argsStr] = parts;
		const args = argsStr ? argsStr.trim().split(/\s+/) : [];

		switch (command.toLowerCase()) {
			case 'weaver:tabs':
			case 'weaver-tabs':
			case 'tabs': {
				const tabs = await getWeaverOpenTabs();
				if (tabs.length === 0) {
					return { output: Joomla.Text._('COM_WEAVER_CMD_NO_OPEN_TABS') };
				}
				const lines = tabs.map((tab, index) => {
					const active = tab.active ? ' (' + Joomla.Text._('COM_WEAVER_MCP_SESSION_ACTIVE') + ')' : '';
					const dirty = tab.dirty ? ' *' : '';
					return `${index + 1}. ${tab.name}${active}${dirty} (id=${tab.id})`;
				});
				return { output: Joomla.Text._('COM_WEAVER_CMD_TABS_OPENED') + `${tabs.length}):\n${lines.join('\n')}` };
			}

			case 'weaver:active':
			case 'weaver-active':
			case 'active': {
				const tab = await getWeaverActiveTab();
				if (!tab) {
					return { output: Joomla.Text._('COM_WEAVER_CMD_NO_ACTIVE_TAB') };
				}
				return {
					output: Joomla.Text._('COM_WEAVER_CMD_ACTIVE_TAB') + `${tab.name} (id=${tab.id}, dirty=${tab.dirty ? 'sim' : 'não'})`
				};
			}

			case 'weaver:open':
			case 'weaver-open':
			case 'open': {
				const fileId = parseInt(args[0], 10);
				if (isNaN(fileId)) {
					return { error: Joomla.Text._('COM_WEAVER_CMD_USAGE_OPEN') };
				}
				await weaverOpenTab(fileId);
				await refreshMCPContext();
				return { output: Joomla.Text._('COM_WEAVER_CMD_OPENED_TAB') + `${fileId}.` };
			}

			case 'weaver:create-file':
			case 'weaver-create-file':
			case 'create-file': {
				const folderId = parseInt(args[0], 10);
				const fileName = args[1];
				if (isNaN(folderId) || !fileName) {
					return { error: Joomla.Text._('COM_WEAVER_CMD_USAGE_CREATE_FILE') };
				}
				const result = await weaverCreateFile(folderId, fileName, '');
				await refreshMCPContext();
				await weaverRefreshTree();
				return { output: Joomla.Text._('COM_WEAVER_CMD_FILE_CREATED') + `${result.name || fileName} (id=${result.id})` };
			}

			case 'weaver:create-folder':
			case 'weaver-create-folder':
			case 'create-folder': {
				const folderId = parseInt(args[0], 10);
				const folderName = args[1];
				if (isNaN(folderId) || !folderName) {
					return { error: Joomla.Text._('COM_WEAVER_CMD_USAGE_CREATE_FOLDER') };
				}
				const result = await weaverCreateFolder(folderId, folderName);
				await refreshMCPContext();
				await weaverRefreshTree();
				return { output: Joomla.Text._('COM_WEAVER_CMD_FOLDER_CREATED') + `${result.name || folderName} (id=${result.id})` };
			}

			case 'weaver:save':
			case 'weaver-save':
			case 'save': {
				const tab = await getWeaverActiveTab();
				if (!tab) {
					return { error: Joomla.Text._('COM_WEAVER_CMD_NO_ACTIVE_TAB') };
				}
				const weaverApp = getWeaverApp();
				if (!weaverApp || typeof weaverApp.setEditorContent !== 'function') {
					return { error: Joomla.Text._('COM_WEAVER_ERROR_EDITOR_NOT_AVAILABLE') };
				}
				weaverApp.setEditorContent(tab.id, tab.content || '');
				return { output: Joomla.Text._('COM_WEAVER_CMD_SAVE_SUCCESS') + ' ' + Joomla.Text._('COM_WEAVER_CMD_SAVE_MANUAL') };
			}

			case 'weaver:edit':
			case 'weaver-edit':
			case 'edit': {
				const fileId = parseInt(args[0], 10);
				let newContent = args.slice(1).join(' ');
				if (isNaN(fileId) || !newContent) {
					return { error: Joomla.Text._('COM_WEAVER_CMD_USAGE_EDIT') };
				}
				newContent = newContent.replace(/<environment_details>[\s\S]*?<\/environment_details>/g, '').trim();
				if (!newContent) {
					return { error: Joomla.Text._('COM_WEAVER_CMD_USAGE_EDIT') };
				}
				const weaverApp = getWeaverApp();
				if (!weaverApp || typeof weaverApp.setEditorContent !== 'function') {
					return { error: Joomla.Text._('COM_WEAVER_ERROR_EDITOR_NOT_AVAILABLE') };
				}
				const tabs = weaverApp.getOpenTabs ? weaverApp.getOpenTabs() : [];
				const tab = tabs.find(t => t.fileId === fileId || t.id === fileId);
				if (!tab) {
					return { error: Joomla.Text._('COM_WEAVER_ERROR_TAB_NOT_FOUND') + ` ${fileId}` };
				}
				weaverApp.setEditorContent(tab.id, newContent);
				return { output: Joomla.Text._('COM_WEAVER_CMD_EDITED_TAB') + `${fileId}.` };
			}

			case 'weaver:root':
			case 'weaver-root':
			case 'root': {
				const rootId = await getWeaverTreeRootFolderId();
				return { output: Joomla.Text._('COM_WEAVER_CMD_ROOT_FOLDER') + rootId };
			}

			case 'help':
			case 'h': {
				const commands = [
					'weaver:tabs - Lista as abas abertas no editor',
					'weaver:active - Mostra a aba ativa',
					'weaver:open <fileId> - Abre uma aba pelo ID',
					'weaver:create-file <folderId> <name> - Cria um arquivo',
					'weaver:create-folder <folderId> <name> - Cria uma pasta',
					'weaver:save - Salva a aba ativa',
					'weaver:edit <fileId> <content> - Edita o conteudo de uma aba',
					'weaver:root - Mostra o ID da pasta raiz',
					'help - Mostra esta mensagem de ajuda',
				];
				return { output: 'Comandos disponiveis:\n' + commands.join('\n') };
			}

			default:
				return null;
		}
	}

	async function saveSettings() {
		const modelInput = container.querySelector('#weaver_mcp_model');
		const modeInput = container.querySelector('#weaver_mcp_mode');

		const model = modelInput?.value || 'kilo-auto/free';
		const mode = modeInput?.value || 'code';

		if (!model) {
			addSystemMessage(Joomla.Text._('COM_WEAVER_MCP_SELECT_VALID_MODEL'), true);
			return;
		}

		localStorage.setItem(STORAGE_KEY_MODEL, model);
		localStorage.setItem(STORAGE_KEY_MODE, mode);

		if (aiAssistant) {
			aiAssistant.setModel(model);
			aiAssistant.setMode(mode);
		}

		addSystemMessage(Joomla.Text._('COM_WEAVER_MCP_SETTINGS_SAVED'));

		enableInput(true);
	}

	function loadSettings() {
		const modelInput = container.querySelector('#weaver_mcp_model');
		const modeInput = container.querySelector('#weaver_mcp_mode');

		const savedModel = localStorage.getItem(STORAGE_KEY_MODEL) || 'kilo-auto/free';
		const savedMode = localStorage.getItem(STORAGE_KEY_MODE) || 'code';

		if (modeInput) modeInput.value = savedMode;

		if (modelInput) {
			const options = Array.from(modelInput.options || []);
			const exists = options.some((opt) => opt.value === savedModel);
			if (exists) {
				modelInput.value = savedModel;
			} else if (options.length > 0) {
				modelInput.value = options[0].value;
			}
		}

		if (aiAssistant) {
			aiAssistant.setModel(savedModel);
			aiAssistant.setMode(savedMode);
		}

		enableInput(true);
	}

	function addUserMessage(text) {
		messageHistory.push({ role: 'user', text });
		appendMessage('user', text);
	}

	function addAssistantMessage(text, returnId = false) {
		messageHistory.push({ role: 'assistant', text });
		const messageId = appendMessage('assistant', text);
		return returnId ? messageId : undefined;
	}

	function addSystemMessage(text, isError = false) {
		appendMessage('system', text, isError);
	}

	function updateAssistantMessage(messageId, text) {
		const messageEl = document.getElementById(messageId);
		if (!messageEl) return;

		const contentEl = messageEl.querySelector('.weaver-mcp-message-content');
		if (contentEl) {
			contentEl.innerHTML = '<strong>' + Joomla.Text._('COM_WEAVER_MCP_ASSISTANT_LABEL') + '</strong><br>' + text;
		}

		const messagesContainer = container.querySelector('#weaver_mcp_messages');
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	function appendMessage(role, text, isError = false, extra = {}) {
		const messagesContainer = container.querySelector('#weaver_mcp_messages');
		if (!messagesContainer) {
			return null;
		}

		const messageEl = document.createElement('div');
		messageEl.className = 'weaver-mcp-message weaver-mcp-message--' + role;
		if (isError) {
			messageEl.classList.add('weaver-mcp-message--error');
		}

		const messageId = 'weaver-mcp-msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
		messageEl.id = messageId;

		const contentEl = document.createElement('div');
		contentEl.className = 'weaver-mcp-message-content';

		if (role === 'tool-call') {
			const name = escapeHtml(extra.name || 'unknown');
			const id = extra.id || messageId;
			messageEl.setAttribute('data-tool-id', id);
			messageEl.innerHTML = `
				<div class="weaver-mcp-tool-call">
					<div class="weaver-mcp-tool-call-header">
						<span class="weaver-mcp-tool-spinner">⏳</span>
						<span class="weaver-mcp-tool-name">${name}</span>
					</div>
					<div class="weaver-mcp-tool-args" style="display:none;"></div>
					<div class="weaver-mcp-tool-output" style="display:none;"></div>
				</div>
			`;
		} else if (role === 'tool-result') {
			contentEl.innerHTML = escapeHtml(text);
		} else if (role === 'user') {
			contentEl.innerHTML = '<strong>' + Joomla.Text._('COM_WEAVER_MCP_USER_LABEL') + '</strong><br>' + escapeHtml(text);
		} else if (role === 'assistant') {
			contentEl.innerHTML = '<strong>' + Joomla.Text._('COM_WEAVER_MCP_ASSISTANT_LABEL') + '</strong><br>' + text;
		} else {
			contentEl.innerHTML = '<em>' + escapeHtml(text) + '</em>';
		}

		if (role !== 'tool-call') {
			messageEl.appendChild(contentEl);
		}

		messagesContainer.appendChild(messageEl);
		messagesContainer.scrollTop = messagesContainer.scrollHeight;

		return messageId;
	}

	function scrollToBottom() {
		const messagesContainer = container.querySelector('#weaver_mcp_messages');
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	function setStatus(text) {
		const statusEl = container.querySelector('#weaver_mcp_status');
		if (statusEl) {
			statusEl.textContent = text;
		}
	}

	function enableInput(enabled) {
		const input = container.querySelector('#weaver_mcp_input');
		const sendBtn = container.querySelector('#weaver_mcp_send');

		if (input) input.disabled = !enabled;
		if (sendBtn) sendBtn.disabled = !enabled;
	}

	function updateSendButton() {
		const sendBtn = container.querySelector('#weaver_mcp_send');
		if (sendBtn) {
			sendBtn.disabled = isProcessing;
		}
	}

	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML.replace(/\n/g, '<br>');
	}

	function isPanelOpen() {
		return isOpen;
	}

	function getMessageHistory() {
		return messageHistory;
	}

	function clearMessages() {
		messageHistory = [];
		const messagesContainer = container.querySelector('#weaver_mcp_messages');
		if (messagesContainer) {
			messagesContainer.innerHTML = '';
		}
	}

	function getWeaverApp() {
		return window.WeaverEditor || null;
	}

	async function getWeaverTreeRootFolderId() {
		const weaverApp = getWeaverApp();
		if (!weaverApp || typeof weaverApp.getTreeRootFolderId !== 'function') {
			return null;
		}
		return weaverApp.getTreeRootFolderId();
	}

	async function getWeaverOpenTabs() {
		const weaverApp = getWeaverApp();
		if (!weaverApp || typeof weaverApp.getOpenTabs !== 'function') {
			return [];
		}
		return weaverApp.getOpenTabs();
	}

	async function getWeaverActiveTab() {
		const weaverApp = getWeaverApp();
		if (!weaverApp || typeof weaverApp.getActiveTab !== 'function') {
			return null;
		}
		return weaverApp.getActiveTab();
	}

	async function weaverOpenTab(fileId) {
		const weaverApp = getWeaverApp();
		if (!weaverApp || typeof weaverApp.openTab !== 'function') {
			throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_UI_MANAGER'));
		}
		return weaverApp.openTab(fileId);
	}

	async function weaverCreateFile(folderId, fileName, content = '') {
		const weaverApp = getWeaverApp();
		if (!weaverApp || typeof weaverApp.createFile !== 'function') {
			throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_UI_MANAGER'));
		}
		return weaverApp.createFile(folderId, fileName, content);
	}

	async function weaverCreateFolder(folderId, folderName) {
		const weaverApp = getWeaverApp();
		if (!weaverApp || typeof weaverApp.createFolder !== 'function') {
			throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_UI_MANAGER'));
		}
		return weaverApp.createFolder(folderId, folderName);
	}

	async function weaverSaveActiveTab(content) {
		const weaverApp = getWeaverApp();
		if (!weaverApp || typeof weaverApp.saveActiveTab !== 'function') {
			throw new Error(Joomla.Text._('COM_WEAVER_ERROR_COTTON_UI_MANAGER'));
		}
		return weaverApp.saveActiveTab(content);
	}

	async function weaverRefreshTree() {
		const weaverApp = getWeaverApp();
		if (!weaverApp || typeof weaverApp.refreshTree !== 'function') {
			return;
		}
		return weaverApp.refreshTree();
	}

	let weaverResourceContents = {};

	async function autoReadWeaverResources() {
		if (!mcpClient || !mcpClient.isInitialized()) {
			return;
		}

		try {
			const resources = await mcpClient.listResources();
			const weaverResources = (resources || []).filter((r) =>
				r.uri && r.uri.startsWith('shuttle://weaver/')
			);

			if (weaverResources.length === 0) {
				return;
			}

			const results = await Promise.allSettled(
				weaverResources.map(async (resource) => {
					try {
						const result = await mcpClient.readResource(resource.uri);
						return { uri: resource.uri, success: true, data: result };
					} catch (error) {
						return { uri: resource.uri, success: false, error: error.message };
					}
				})
			);

			const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success);

			weaverResourceContents = {};

			for (const r of successful) {
				const data = r.value.data;
				const text = data?.text || '';
				let parsed = null;
				try {
					parsed = JSON.parse(text);
				} catch {
					parsed = { raw: text };
				}
				const key = r.value.uri.replace('shuttle://weaver/', '');
				weaverResourceContents[key] = parsed;
			}
		} catch (error) {
			console.warn('[WeaverMCP] Auto-read resources failed:', error);
		}
	}

	function getWeaverResourceContents() {
		return weaverResourceContents;
	}

	return {
		init,
		showSettings,
		isPanelOpen,
		getMessageHistory,
		clearMessages,
		getMcpClient: () => mcpClient,
		getAiAssistant: () => aiAssistant,
		getMcpContent: () => mcpContent,
		getWeaverApp,
		getWeaverTreeRootFolderId,
		getWeaverOpenTabs,
		getWeaverActiveTab,
		getWeaverResourceContents,
		weaverOpenTab,
		weaverCreateFile,
		weaverCreateFolder,
		weaverSaveActiveTab,
		weaverRefreshTree,
		refreshMCPContext,
		handleWeaverCommand
	};
})();

if (typeof window !== 'undefined') {
    window.WeaverMCPPanel = WeaverMCPPanel;
}
