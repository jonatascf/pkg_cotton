/**
 * @package Tabaoca.Component.Weaver.Site
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * Shuttle AI Assistant - Estado e configuracao
 *
 * Responsavel apenas por:
 * - Armazenar configuracao (modelo, modo, historico).
 * - Manter referencias de tools/resources/prompts recebidas do MCP.
 * - Iniciar o stream via WeaverMCPClient.
 */

const WeaverKiloAssistant = (() => {
	const DEFAULT_BASE_URL = 'https://api.kilo.ai/api/gateway';

	let baseUrl = DEFAULT_BASE_URL;
	let selectedModel = 'kilo-auto/free';
	let selectedMode = 'code';
	let conversationHistory = [];
	let maxHistory = 20;
	let dynamicToolDefinitions = [];
	let dynamicResources = [];
	let dynamicPrompts = [];

	function buildStreamArgs(userInput) {
		return {
			prompt: userInput,
			model: selectedModel,
			mode: selectedMode,
			stream: true,
			tools: dynamicToolDefinitions,
			resources: dynamicResources,
			prompts: dynamicPrompts,
			conversation: conversationHistory,
		};
	}

	function pushUserMessage(userInput) {
		conversationHistory.push({
			role: 'user',
			content: userInput,
		});

		if (conversationHistory.length > maxHistory) {
			conversationHistory = conversationHistory.slice(-maxHistory);
		}
	}

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

		conversationHistory.push(entry);

		if (conversationHistory.length > maxHistory) {
			conversationHistory = conversationHistory.slice(-maxHistory);
		}
	}

	function pushToolMessage(toolCallId, content) {
		conversationHistory.push({
			role: 'tool',
			tool_call_id: toolCallId,
			content: content || '',
		});

		if (conversationHistory.length > maxHistory) {
			conversationHistory = conversationHistory.slice(-maxHistory);
		}
	}

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

		try {
			const result = await mcpClient.executeAiStream(streamArgs, {
				onChunk: onMessage,
				onReasoning: onReasoning,
				onToolCall: onToolCall,
				onToolResult: onToolResult,
				onError: onError,
				signal,
			});

			if (result && result.success && result.output) {
				pushAssistantMessage(result.output, result.toolCalls || []);
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

	function setModel(model) {
		selectedModel = model;
	}

	function getModel() {
		return selectedModel;
	}

	function setMode(mode) {
		selectedMode = mode;
	}

	function getMode() {
		return selectedMode;
	}

	function setBaseUrl(url) {
		baseUrl = url.replace(/\/$/, '');
	}

	function getBaseUrl() {
		return baseUrl;
	}

	function setToolDefinitions(tools) {
		dynamicToolDefinitions = Array.isArray(tools) ? tools : [];
	}

	function getToolDefinitions() {
		return dynamicToolDefinitions;
	}

	function setResources(resources) {
		dynamicResources = Array.isArray(resources) ? resources : [];
	}

	function getResources() {
		return dynamicResources;
	}

	function setPrompts(prompts) {
		dynamicPrompts = Array.isArray(prompts) ? prompts : [];
	}

	function getPrompts() {
		return dynamicPrompts;
	}

	function clearHistory() {
		conversationHistory = [];
	}

	function getConversationHistory() {
		return conversationHistory;
	}

	function setConversationHistory(history) {
		conversationHistory = Array.isArray(history) ? history.slice(-maxHistory) : [];
	}

	function getMaxHistory() {
		return maxHistory;
	}

	function setMaxHistory(value) {
		maxHistory = Math.max(1, Math.min(100, value));
	}

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
		getMaxHistory,
		setMaxHistory,
		getFreeModels,
	};
})();

if (typeof window !== 'undefined') {
	window.WeaverKiloAssistant = WeaverKiloAssistant;
}
