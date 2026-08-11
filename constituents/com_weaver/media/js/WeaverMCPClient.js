/**
 * @package Tabaoca.Component.Weaver.Site
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * Shuttle MCP Client
 *
 * MCP client for communication with the Shuttle MCP Server.
 * Forwards structured SSE events from backend to frontend.
 */

const WeaverMCPClient = (() => {
	/**
	 * Resolves the default base URL from Joomla config or current origin.
	 * @returns {string} Base URL
	 */
	const DEFAULT_BASE_URL = () => {
		const cfg = window.Joomla?.getOptions?.('cotton_config');
		return cfg?.siteUrl || window.location.origin;
	};

	let baseUrl = DEFAULT_BASE_URL();
	let sessionId = null;
	let tools = [];
	let resources = [];
	let prompts = [];
	let models = [];
	let initialized = false;
	let csrfToken = '';

	/**
	 * Gets the current CSRF token.
	 * @returns {string} CSRF token
	 */
	function getCsrfToken() {
		return csrfToken || '';
	}

	/**
	 * Initializes the MCP session and loads tools, resources, prompts, and models.
	 * @returns {Promise<Object>} Initialization result
	 */
	async function connect() {
		const initResponse = await sendRequest('initialize', {
			protocolVersion: '2024-11-05',
			capabilities: {},
			clientInfo: { name: 'weaver-mcp-client', version: '2.0.0' }
		});

		if (initResponse.error) {
			throw new Error(initResponse.error.message || Joomla.Text._('COM_WEAVER_ERROR_MCP_INIT'));
		}

		sessionId = initResponse.data.id || null;
		initialized = true;

		const [toolsData, resourcesData, promptsData, modelsData] = await Promise.all([
			listTools(),
			listResources(),
			listPrompts(),
			listModels()
		]);

		tools = toolsData;
		resources = resourcesData;
		prompts = promptsData;
		models = modelsData;

		return {
			tools,
			resources,
			prompts,
			models,
			sessionId
		};
	}

	/**
	 * Resets the MCP session and reinitializes.
	 * @returns {Promise<Object>} Initialization result
	 */
	async function reset() {
		initialized = false;
		sessionId = null;
		tools = [];
		resources = [];
		prompts = [];
		models = [];
		return connect();
	}

	/**
	 * Lists available tools from the MCP server.
	 * @returns {Promise<Array>} Tools list
	 */
	async function listTools() {
		const response = await sendRequest('tools/list', {});
		if (response.data?.result) {
			tools = response.data.result.tools || [];
		}
		return tools;
	}

	/**
	 * Lists available resources from the MCP server.
	 * @returns {Promise<Array>} Resources list
	 */
	async function listResources() {
		const response = await sendRequest('resources/list', {});
		if (response.data?.result) {
			resources = response.data.result.resources || [];
		}
		return resources;
	}

	/**
	 * Lists available prompts from the MCP server.
	 * @returns {Promise<Array>} Prompts list
	 */
	async function listPrompts() {
		const response = await sendRequest('prompts/list', {});
		if (response.data?.result) {
			prompts = response.data.result.prompts || [];
		}
		return prompts;
	}

	/**
	 * Lists available models from the MCP server.
	 * @returns {Promise<Array>} Models list
	 */
	async function listModels() {
		const response = await sendRequest('models/list', {});
		if (response.data?.result) {
			models = response.data.result.models || [];
		}
		return models;
	}

	/**
	 * Calls an MCP tool by name.
	 * @param {string} name - Tool name
	 * @param {Object} [args={}] - Tool arguments
	 * @returns {Promise<Object>} Tool result
	 */
	async function callTool(name, args = {}) {
		if (!initialized) {
			await connect();
		}

		const response = await sendRequest('tools/call', {
			name,
			arguments: args
		});

		return parseToolResult(response);
	}

	/**
	 * Reads an MCP resource by URI.
	 * @param {string} uri - Resource URI
	 * @returns {Promise<Object>} Resource result
	 */
	async function readResource(uri) {
		if (!initialized) {
			await connect();
		}

		if (uri.startsWith('shuttle://weaver/')) {
			return resolveWeaverResource(uri);
		}

		const response = await sendRequest('resources/read', {
			uri
		});

		return parseResourceResult(response);
	}

	/**
	 * Resolves Weaver-specific MCP resources from the frontend state.
	 * @param {string} uri - Resource URI
	 * @returns {Object} Resolved resource data
	 * @private
	 */
	function resolveWeaverResource(uri) {
		const weaver = window.WeaverEditor || {};
		const panels = window.WeaverMCPPanel || {};
		const mcpContent = panels.getMcpContent ? panels.getMcpContent() : null;

		const data = {
			uri,
			resolvedAt: new Date().toISOString(),
		};

		switch (uri) {
			case 'shuttle://weaver/tabs': {
				const tabs = weaver.getOpenTabs ? weaver.getOpenTabs() : [];
				data.tabs = tabs.map(tab => ({
					id: tab.id,
					fileId: tab.fileId,
					name: tab.name,
					ext: tab.ext,
					folderId: tab.folderId,
					folderPath: tab.folderPath,
					active: tab.active,
					dirty: tab.dirty,
					openLink: tab.openLink,
				}));
				break;
			}
			case 'shuttle://weaver/active-tab': {
				const tab = weaver.getActiveTab ? weaver.getActiveTab() : null;
				data.activeTab = tab ? {
					id: tab.id,
					fileId: tab.fileId,
					name: tab.name,
					ext: tab.ext,
					folderId: tab.folderId,
					folderPath: tab.folderPath,
					dirty: tab.dirty,
					openLink: tab.openLink,
				} : null;
				break;
			}
			case 'shuttle://weaver/tree-root': {
				data.treeRootFolderId = weaver.getTreeRootFolderId ? weaver.getTreeRootFolderId() : 0;
				break;
			}
			case 'shuttle://weaver/resources': {
				const tabs = weaver.getOpenTabs ? weaver.getOpenTabs() : [];
				const activeTab = weaver.getActiveTab ? weaver.getActiveTab() : null;
				const treeRootFolderId = weaver.getTreeRootFolderId ? weaver.getTreeRootFolderId() : 0;

				data.resources = {
					tabs: tabs.map(tab => ({
						id: tab.id,
						fileId: tab.fileId,
						name: tab.name,
						active: tab.active,
						dirty: tab.dirty,
					})),
					activeTab: activeTab ? {
						id: activeTab.id,
						fileId: activeTab.fileId,
						name: activeTab.name,
						dirty: activeTab.dirty,
					} : null,
					treeRootFolderId,
				};
				break;
			}
			case 'shuttle://weaver/editor-content': {
				const tabs = weaver.getOpenTabs ? weaver.getOpenTabs() : [];
				const activeTab = weaver.getActiveTab ? weaver.getActiveTab() : null;
				data.editorContent = {
					tabs: tabs.map(tab => ({
						id: tab.id,
						fileId: tab.fileId,
						name: tab.name,
						content: tab.content || '',
						active: tab.active,
						dirty: tab.dirty,
					})),
					activeTab: activeTab ? {
						id: activeTab.id,
						fileId: activeTab.fileId,
						name: activeTab.name,
						content: activeTab.content || '',
						dirty: activeTab.dirty,
					} : null,
				};
				break;
			}
			default:
				return {
					success: false,
					error: Joomla.Text._('COM_WEAVER_ERROR_UNKNOWN_RESOURCE') + uri,
					code: -32601,
				};
		}

		return {
			success: true,
			uri,
			mimeType: 'application/json',
			text: JSON.stringify(data, null, 2),
			data,
		};
	}

	/**
	 * Executes an AI streaming request with callbacks for chunks, reasoning, tools, and completion.
	 * @param {Object} args - Stream arguments
	 * @param {string} args.prompt - User prompt
	 * @param {string} args.model - Model identifier
	 * @param {string} args.mode - Assistant mode
	 * @param {Array} [args.tools] - Tool definitions
	 * @param {Array} [args.resources] - Resource definitions
	 * @param {Array} [args.prompts] - Prompt definitions
	 * @param {Array} [args.conversation] - Conversation history
	 * @param {Object} [callbacks={}] - Event callbacks
	 * @param {Function} [callbacks.onChunk] - Called on text chunk
	 * @param {Function} [callbacks.onReasoning] - Called on reasoning chunk
	 * @param {Function} [callbacks.onToolCall] - Called on tool call
	 * @param {Function} [callbacks.onToolResult] - Called on tool result
	 * @param {Function} [callbacks.onDone] - Called when stream completes
	 * @param {Function} [callbacks.onError] - Called on error
	 * @param {AbortSignal} [callbacks.signal] - Abort signal
	 * @returns {Promise<Object>} Stream result
	 */
	async function executeAiStream(args = {}, callbacks = {}) {
		const prompt = args.prompt || '';
		const model = args.model || '';
		const mode = args.mode || '';
		const tools = Array.isArray(args.tools) ? args.tools : [];
		const resources = Array.isArray(args.resources) ? args.resources : [];
		const prompts = Array.isArray(args.prompts) ? args.prompts : [];
		const conversation = Array.isArray(args.conversation) ? args.conversation : [];

		const onChunk = typeof callbacks.onChunk === 'function' ? callbacks.onChunk : null;
		const onReasoning = typeof callbacks.onReasoning === 'function' ? callbacks.onReasoning : null;
		const onToolCall = typeof callbacks.onToolCall === 'function' ? callbacks.onToolCall : null;
		const onToolResult = typeof callbacks.onToolResult === 'function' ? callbacks.onToolResult : null;
		const onDone = typeof callbacks.onDone === 'function' ? callbacks.onDone : null;
		const onError = typeof callbacks.onError === 'function' ? callbacks.onError : null;
		const signal = callbacks.signal || null;

		const csrfToken = getCsrfToken();
		const headers = {
			'Content-Type': 'application/json',
			'Accept': 'text/event-stream',
		};

		if (csrfToken) {
			headers['X-CSRF-Token'] = csrfToken;
		}

		if (sessionId) {
			headers['mcp-session-id'] = sessionId;
		}

		const requestPayload = {
			jsonrpc: '2.0',
			method: 'ai/stream',
			params: {
				arguments: {
					prompt,
					model,
					mode,
					stream: true,
					'mcp-tools': tools,
					'mcp-resources': resources,
					'mcp-prompts': prompts,
					conversation,
				}
			},
			id: generateId()
		};

		const url = `${baseUrl}index.php?option=com_shuttle&view=shuttle&task=shuttle.mcp&format=json`;

		let response;
		try {
			response = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(requestPayload),
				credentials: 'same-origin',
				signal,
			});
		} catch (fetchError) {
			const errorMsg = Joomla.Text._('COM_WEAVER_ERROR_FETCH_FAILED') + (fetchError.message || fetchError);
			if (onError) onError(errorMsg);
			if (onDone) onDone({ success: false, error: errorMsg, output: '', toolCalls: [], toolResults: [] });
			return { success: false, error: errorMsg, output: '', toolCalls: [], toolResults: [] };
		}

		if (!response.ok) {
			let text = '';
			try {
				text = await response.text();
			} catch (textError) {
				text = '';
			}
			let errorResult;
			try {
				errorResult = JSON.parse(text);
			} catch {
				errorResult = { error: text };
			}
			const errorMsg = errorResult.error?.message || errorResult.message || `HTTP ${response.status}`;
			if (onError) onError(errorMsg);
			if (onDone) onDone({ success: false, error: errorMsg, output: '', toolCalls: [], toolResults: [] });
			return { success: false, error: errorMsg, output: '', toolCalls: [], toolResults: [] };
		}

		let reader;
		try {
			reader = response.body.getReader();
		} catch (readerError) {
			const errorMsg = Joomla.Text._('COM_WEAVER_ERROR_STREAM_READER') + (readerError.message || readerError);
			if (onError) onError(errorMsg);
			if (onDone) onDone({ success: false, error: errorMsg, output: '', toolCalls: [], toolResults: [] });
			return { success: false, error: errorMsg, output: '', toolCalls: [], toolResults: [] };
		}

		const decoder = new TextDecoder();
		let fullOutput = '';
		let toolCalls = [];
		let toolResults = [];
		let error = null;
		let buffer = '';
		let currentEvent = 'message';

		const processLine = (line) => {
			const trimmed = line.trim();

			if (trimmed === '') {
				currentEvent = 'message';
				return;
			}

			if (trimmed.startsWith(':')) {
				return;
			}

			if (trimmed.startsWith('event:')) {
				currentEvent = trimmed.slice(6).trim();
				return;
			}

			if (trimmed.startsWith('data:')) {
				const data = trimmed.slice(5);
				const payload = data.startsWith(' ') ? data.slice(1) : data;
				if (payload === '[DONE]') {
					return;
				}

				let parsed;
				try {
					parsed = JSON.parse(payload);
				} catch {
					return;
				}

				if (parsed.error) {
					const message = typeof parsed.error === 'string' ? parsed.error : (parsed.error.message || JSON.stringify(parsed.error));
					error = message;
					if (onError) onError(message);
					return;
				}

				const eventType = currentEvent;

				switch (eventType) {
					case 'message':
						if (typeof parsed.content === 'string') {
							fullOutput += parsed.content;
							if (onChunk) onChunk(parsed.content);
						}
						break;

					case 'reasoning':
						if (typeof parsed.content === 'string') {
							if (onReasoning) {
								onReasoning(parsed.content);
							} else {
								fullOutput += parsed.content;
								if (onChunk) onChunk(parsed.content);
							}
						}
						break;

					case 'tool_call':
						if (onToolCall) onToolCall(parsed);
						break;

					case 'tool_result':
						if (onToolResult) onToolResult(parsed);
						if (Array.isArray(parsed.tool_results)) {
							toolResults = parsed.tool_results;
						} else if (parsed.id) {
							const metadata = parsed.metadata || {};
							toolResults.push({
								id: parsed.id,
								name: parsed.name,
								result: {
									success: parsed.success,
									output: parsed.output,
									error: parsed.error,
								},
								metadata: metadata,
								fileId: metadata.file_id || metadata.fileId || null,
								content: metadata.content ?? null,
							});
						}
						break;

					case 'done':
						if (Array.isArray(parsed.tool_calls)) {
							toolCalls = parsed.tool_calls;
						}
						if (Array.isArray(parsed.tool_results)) {
							toolResults = parsed.tool_results;
						}
						break;

					case 'usage':
						break;

					default:
						break;
				}
			}
		};

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					processLine(line);
				}
			}
		} catch (streamError) {
			error = error || (streamError.message || Joomla.Text._('COM_WEAVER_ERROR_STREAM_INTERRUPTED'));
			if (onError) onError(error);
		}

		const finalResult = {
			success: !error,
			output: fullOutput,
			error,
			toolCalls,
			toolResults,
		};

		if (onDone) onDone(finalResult);
		return finalResult;
	}

	/**
	 * Sends a generic JSON-RPC request to the MCP backend.
	 * @param {string} method - JSON-RPC method
	 * @param {Object} [params={}] - Request params
	 * @returns {Promise<Object>} Response payload
	 */
	async function sendRequest(method, params = {}) {
		const payload = {
			jsonrpc: '2.0',
			method,
			params,
			id: generateId()
		};

		const headers = {
			'Content-Type': 'application/json',
			'Accept': 'application/json, text/event-stream'
		};

		if (sessionId) {
			headers['mcp-session-id'] = sessionId;
		}

		const csrfToken = getCsrfToken();
		if (csrfToken) {
			headers['X-CSRF-Token'] = csrfToken;
		}

		const url = `${baseUrl}index.php?option=com_shuttle&view=shuttle&task=shuttle.mcp&format=json`;

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(payload),
				credentials: 'same-origin'
			});

			if (response.headers.get('mcp-session-id')) {
				sessionId = response.headers.get('mcp-session-id');
			}

			const text = await response.text();

			if (!response.ok) {
				return {
					error: {
						code: response.status,
						message: text || response.statusText
					}
				};
			}

			try {
				return JSON.parse(text);
			} catch {
				return {
					result: {
						content: [{ type: 'text', text }]
					}
				};
			}
		} catch (error) {
			return {
				error: {
					code: -32603,
					message: Joomla.Text._('COM_WEAVER_ERROR_NETWORK_CONSOLE')
				}
			};
		}
	}

	/**
	 * Parses a tool call response into a normalized result.
	 * @param {Object} response - Raw response object
	 * @returns {Object} Parsed tool result
	 */
	function parseToolResult(response) {
		if (response.error) {
			return {
				success: false,
				error: response.error.message,
				code: response.error.code
			};
		}

		const result = response.data?.result || {};
		const content = result.content || [];
		const text = content
			.filter(c => c.type === 'text')
			.map(c => c.text)
			.join('\n');

		let parsedMetadata = {};
		try {
			parsedMetadata = JSON.parse(text);
		} catch {
			parsedMetadata = { raw: text };
		}

		return {
			success: !result.isError,
			output: text,
			metadata: result.metadata || parsedMetadata,
			isError: result.isError || false
		};
	}

	/**
	 * Parses a resource read response into a normalized result.
	 * @param {Object} response - Raw response object
	 * @returns {Object} Parsed resource result
	 */
	function parseResourceResult(response) {
		if (response.error) {
			return {
				success: false,
				error: response.error.message,
				code: response.error.code
			};
		}

		const result = response.data?.result || {};
		const contents = result.contents || [];
		const text = contents
			.filter(c => c.type === 'text')
			.map(c => c.text)
			.join('\n');

		let parsedData = {};
		try {
			parsedData = JSON.parse(text);
		} catch {
			parsedData = { raw: text };
		}

		return {
			success: true,
			uri: contents[0]?.uri || '',
			mimeType: contents[0]?.mimeType || 'text/plain',
			text,
			data: parsedData
		};
	}

	/**
	 * Generates a unique request ID.
	 * @returns {string} Unique ID
	 */
	function generateId() {
		return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
	}

	/**
	 * Gets the currently loaded tools.
	 * @returns {Array} Tools
	 */
	function getTools() {
		return tools;
	}

	/**
	 * Gets the names of currently loaded tools.
	 * @returns {string[]} Tool names
	 */
	function getToolNames() {
		return tools.map(t => t.name);
	}

	/**
	 * Gets the currently loaded resources.
	 * @returns {Array} Resources
	 */
	function getResources() {
		return resources;
	}

	/**
	 * Gets the currently loaded prompts.
	 * @returns {Array} Prompts
	 */
	function getPrompts() {
		return prompts;
	}

	/**
	 * Gets the currently loaded models.
	 * @returns {Array} Models
	 */
	function getModels() {
		return models;
	}

	/**
	 * Gets the current MCP session ID.
	 * @returns {string|null} Session ID
	 */
	function getSessionId() {
		return sessionId;
	}

	/**
	 * Checks if the MCP client is initialized.
	 * @returns {boolean}
	 */
	function isInitialized() {
		return initialized;
	}

	/**
	 * Sets the API base URL.
	 * @param {string} url - Base URL
	 */
	function setBaseUrl(url) {
		baseUrl = url.replace(/\/$/, '');
	}

	/**
	 * Sets the CSRF token for requests.
	 * @param {string} token - CSRF token
	 */
	function setCsrfToken(token) {
		csrfToken = typeof token === 'string' ? token.trim() : '';
	}

	/**
	 * Gets the current API base URL.
	 * @returns {string} Base URL
	 */
	function getBaseUrl() {
		return baseUrl;
	}

	return {
		connect,
		reset,
		callTool,
		readResource,
		executeAiStream,
		listTools,
		listResources,
		listPrompts,
		listModels,
		sendRequest,
		getTools,
		getToolNames,
		getResources,
		getPrompts,
		getModels,
		getSessionId,
		isInitialized,
		setBaseUrl,
		getBaseUrl,
		setCsrfToken
	};
})();

if (typeof window !== 'undefined') {
	window.WeaverMCPClient = WeaverMCPClient;
}
