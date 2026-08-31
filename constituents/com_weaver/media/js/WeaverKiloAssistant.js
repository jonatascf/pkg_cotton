/**
 * @package Tabaoca.Component.Weaver.Site
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

/**
 * WeaverKiloAssistant - AI assistant state and configuration
 *
 * Responsible only for:
 * - Storing configuration (model, mode, history).
 * - Keeping references of tools/resources/prompts received from MCP.
 * - Starting the stream via WeaverMCPClient.
 */

const WeaverKiloAssistant = (() => {
	const DEFAULT_BASE_URL = 'https://api.kilo.ai/api/gateway';

	let baseUrl = DEFAULT_BASE_URL;
	let selectedModel = 'kilo-auto/free';
	let selectedMode = 'code';
	let maxTokens = 12000;
	let dynamicToolDefinitions = [];
	let dynamicResources = [];
	let dynamicPrompts = [];

	/**
	 * Builds the stream request payload for the AI gateway.
	 * @param {string} userInput - User message text
	 * @returns {Object} Stream arguments
	 */
	function buildStreamArgs(userInput) {
		return {
			prompt: userInput,
			model: selectedModel,
			mode: selectedMode,
			stream: true,
			tools: dynamicToolDefinitions,
			resources: dynamicResources,
			prompts: dynamicPrompts,
			conversation: window.ContextManager ? window.ContextManager.getMessages() : [],
		};
	}

	/**
	 * Appends a user message to the conversation history.
	 * @param {string} userInput - User message text
	 */
	function pushUserMessage(userInput) {
		if (window.ContextManager) {
			window.ContextManager.addMessage({
				role: 'user',
				content: userInput,
			});
		}
	}

	/**
	 * Appends an assistant message to the conversation history.
	 * @param {string} content - Assistant response text
	 * @param {Array} [toolCalls] - Tool calls made during the response
	 */
	function pushAssistantMessage(content, toolCalls) {
		const entry = {
			role: 'assistant',
			content: content || '',
		};

		if (Array.isArray(toolCalls) && toolCalls.length > 0) {
			entry.tool_calls = toolCalls.map(tc => ({
				id: tc.id || ('call_' + Math.random().toString(36).slice(2)),
				type: 'function',
				function: {
					name: tc.name || tc.tool || '',
					arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments || {}),
				},
			}));
		}

		if (window.ContextManager) {
			window.ContextManager.addMessage(entry);
		}
	}

	/**
	 * Appends a tool result message to the conversation history.
	 * @param {string} toolCallId - Tool call ID
	 * @param {string} content - Tool result content
	 */
	function pushToolMessage(toolCallId, content) {
		if (window.ContextManager) {
			window.ContextManager.addMessage({
				role: 'tool',
				tool_call_id: toolCallId,
				content: content || '',
			});
		}
	}

	/**
	 * Starts an AI stream with the given user input and MCP client.
	 * @param {string} userInput - User message text
	 * @param {Object} mcpClient - MCP client instance
	 * @param {Object} [callbacks={}] - Event callbacks
	 * @param {Function} [callbacks.onMessage] - Called on text chunk
	 * @param {Function} [callbacks.onReasoning] - Called on reasoning chunk
	 * @param {Function} [callbacks.onToolCall] - Called on tool call
	 * @param {Function} [callbacks.onToolResult] - Called on tool result
	 * @param {Function} [callbacks.onDone] - Called when stream completes
	 * @param {Function} [callbacks.onError] - Called on error
	 * @param {AbortSignal} [callbacks.signal] - Abort signal
	 * @returns {Promise<Object>} Stream result
	 */
	async function startStream(userInput, mcpClient, callbacks = {}) {
		const onMessage = typeof callbacks.onMessage === 'function' ? callbacks.onMessage : null;
		const onReasoning = typeof callbacks.onReasoning === 'function' ? callbacks.onReasoning : null;
		const onToolCall = typeof callbacks.onToolCall === 'function' ? callbacks.onToolCall : null;
		const onToolResult = typeof callbacks.onToolResult === 'function' ? callbacks.onToolResult : null;
		const onDone = typeof callbacks.onDone === 'function' ? callbacks.onDone : null;
		const onError = typeof callbacks.onError === 'function' ? callbacks.onError : null;
		const signal = callbacks.signal || null;

		if (!mcpClient || !mcpClient.isInitialized()) {
			try {
				await mcpClient.connect();
			} catch (error) {
				if (onError) onError(Joomla.Text._('COM_WEAVER_ERROR_MCP_CONNECT_PREFIX') + error.message);
				return { success: false, error: Joomla.Text._('COM_WEAVER_ERROR_MCP_CONNECT') };
			}
		}

		pushUserMessage(userInput);

		const streamArgs = buildStreamArgs(userInput);

		const pendingToolCalls = {};

		const wrappedOnToolCall = (event) => {
			if (event.type === 'tool_call_start' && event.id) {
				pendingToolCalls[event.id] = {
					id: event.id,
					type: 'function',
					function: { name: event.name || '', arguments: '' },
				};
			} else if (event.type === 'tool_call_delta' && event.id) {
				const call = pendingToolCalls[event.id];
				if (call) {
					if (event.name) call.function.name += event.name;
					if (event.arguments) call.function.arguments += event.arguments;
				}
			} else if (event.type === 'tool_call_stop' && event.id) {
				const call = pendingToolCalls[event.id];
				if (call && call.function.name) {
					if (window.ContextManager) {
						window.ContextManager.addMessage({
							role: 'assistant',
							content: null,
							tool_calls: [call],
						});
					}
				}
			}
			if (onToolCall) onToolCall(event);
		};

		const wrappedOnToolResult = (event) => {
			if (event.id && pendingToolCalls[event.id]) {
				const callName = pendingToolCalls[event.id].function.name;
				if (window.ContextManager) {
					window.ContextManager.addMessage({
						role: 'tool',
						tool_call_id: event.id,
						content: event.output || event.error?.message || '',
					});
				}
				delete pendingToolCalls[event.id];
			}
			if (onToolResult) onToolResult(event);
		};

		try {
			const result = await mcpClient.executeAiStream(streamArgs, {
				onChunk: onMessage,
				onReasoning: onReasoning,
				onToolCall: wrappedOnToolCall,
				onToolResult: wrappedOnToolResult,
				onError: onError,
				signal,
			});

		if (result && result.success && result.output) {
			const hasToolCalls = result.toolCalls && result.toolCalls.length > 0;
			if (!hasToolCalls) {
				pushAssistantMessage(result.output, []);
			}
		} else if (result && !result.success) {
				if (onError) onError(result.error || Joomla.Text._('COM_WEAVER_ERROR_STREAM_FAILED'));
			}

			if (onDone) onDone(result);
			return result;
		} catch (error) {
			if (onError) onError(error.message || String(error));
			return { success: false, error: error.message || String(error) };
		}
	}

	/**
	 * Sets the selected AI model.
	 * @param {string} model - Model identifier
	 */
	function setModel(model) {
		selectedModel = model;
	}

	/**
	 * Gets the currently selected AI model.
	 * @returns {string} Model identifier
	 */
	function getModel() {
		return selectedModel;
	}

	/**
	 * Sets the assistant mode.
	 * @param {string} mode - Mode identifier
	 */
	function setMode(mode) {
		selectedMode = mode;
	}

	/**
	 * Gets the current assistant mode.
	 * @returns {string} Mode identifier
	 */
	function getMode() {
		return selectedMode;
	}

	/**
	 * Sets the API base URL.
	 * @param {string} url - Base URL
	 */
	function setBaseUrl(url) {
		baseUrl = url.replace(/\/$/, '');
	}

	/**
	 * Gets the current API base URL.
	 * @returns {string} Base URL
	 */
	function getBaseUrl() {
		return baseUrl;
	}

	/**
	 * Sets dynamic tool definitions received from MCP.
	 * @param {Array} tools - Tool definitions
	 */
	function setToolDefinitions(tools) {
		dynamicToolDefinitions = Array.isArray(tools) ? tools : [];
	}

	/**
	 * Gets the current dynamic tool definitions.
	 * @returns {Array} Tool definitions
	 */
	function getToolDefinitions() {
		return dynamicToolDefinitions;
	}

	/**
	 * Sets dynamic resources received from MCP.
	 * @param {Array} resources - Resource definitions
	 */
	function setResources(resources) {
		dynamicResources = Array.isArray(resources) ? resources : [];
	}

	/**
	 * Gets the current dynamic resources.
	 * @returns {Array} Resource definitions
	 */
	function getResources() {
		return dynamicResources;
	}

	/**
	 * Sets dynamic prompts received from MCP.
	 * @param {Array} prompts - Prompt definitions
	 */
	function setPrompts(prompts) {
		dynamicPrompts = Array.isArray(prompts) ? prompts : [];
	}

	/**
	 * Gets the current dynamic prompts.
	 * @returns {Array} Prompt definitions
	 */
	function getPrompts() {
		return dynamicPrompts;
	}

	/**
	 * Clears the conversation history.
	 */
	function clearHistory() {
		if (window.ContextManager) {
			window.ContextManager.clear();
		}
	}

	/**
	 * Gets the current conversation history.
	 * @returns {Array} Conversation messages
	 */
	function getConversationHistory() {
		if (window.ContextManager) {
			return window.ContextManager.getMessages();
		}
		return [];
	}

	/**
	 * Sets the conversation history, trimming to token limit.
	 * @param {Array} history - Conversation messages
	 */
	function setConversationHistory(history) {
		if (window.ContextManager) {
			window.ContextManager.setMessages(Array.isArray(history) ? history : []);
		}
	}

	/**
	 * Gets the maximum token budget for conversation history.
	 * @returns {number} Max tokens
	 */
	function getMaxTokens() {
		if (window.ContextManager) {
			return window.ContextManager.getMaxTokens();
		}
		return maxTokens;
	}

	/**
	 * Sets the maximum token budget for conversation history.
	 * @param {number} value - Max tokens (1000-100000)
	 */
	function setMaxTokens(value) {
		maxTokens = Math.max(1000, Math.min(100000, value));
		if (window.ContextManager) {
			window.ContextManager.setMaxTokens(maxTokens);
		}
	}

	/**
	 * Gets the estimated token usage for the current conversation.
	 * @returns {number} Estimated tokens
	 */
	function getEstimatedTokens() {
		if (window.ContextManager) {
			return window.ContextManager.getEstimatedTokens();
		}
		return 0;
	}

	/**
	 * Gets context utilization statistics.
	 * @returns {Object} Stats including messageCount, estimatedTokens, maxTokens, utilizationPercent
	 */
	function getContextStats() {
		if (window.ContextManager) {
			return window.ContextManager.getStats();
		}
		return { messageCount: 0, estimatedTokens: 0, maxTokens: maxTokens, utilizationPercent: 0 };
	}

	/**
	 * Updates token estimate from API usage data.
	 * @param {Object} usage - Usage data from API response
	 */
	function updateTokenUsage(usage) {
		if (window.ContextManager && usage) {
			window.ContextManager.updateFromApiUsage(usage);
		}
	}

	/**
	 * Gets the list of free model identifiers.
	 * @returns {string[]} Free model identifiers
	 */
	function getFreeModels() {
		return [
			'kilo-auto/free',
			'stepfun/step-3.7-flash:free',
			'poolside/laguna-m.1:free',
			'nvidia/nemotron-3-ultra-550b-a55b:free',
		];
	}

	return {
		startStream,
		setApiKey: () => {},
		getApiKey: () => '',
		setModel,
		getModel,
		setMode,
		getMode,
		setBaseUrl,
		getBaseUrl,
		setToolDefinitions,
		getToolDefinitions,
		setResources,
		getResources,
		setPrompts,
		getPrompts,
		clearHistory,
		getConversationHistory,
		setConversationHistory,
		getMaxTokens,
		setMaxTokens,
		getEstimatedTokens,
		getContextStats,
		updateTokenUsage,
		getFreeModels,
	};
})();

if (typeof window !== 'undefined') {
	window.WeaverKiloAssistant = WeaverKiloAssistant;
}
