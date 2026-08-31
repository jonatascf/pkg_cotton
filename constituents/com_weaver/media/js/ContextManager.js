/**
 * @package Tabaoca.Component.Weaver.Site
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

/**
 * ContextManager - Token-aware conversation context management
 *
 * Manages conversation history with token-based limits instead of
 * arbitrary message counts, preventing context window overflow.
 */
const ContextManager = (() => {
	const DEFAULT_MAX_TOKENS = 12000;
	const CHARS_PER_TOKEN = 3;
	const TOKENS_PER_MESSAGE_OVERHEAD = 4;

	let maxTokens = DEFAULT_MAX_TOKENS;
	let messages = [];
	let estimatedTotalTokens = 0;

	function estimateTokens(text) {
		if (!text) return 0;
		const length = typeof text === 'string' ? text.length : JSON.stringify(text).length;
		return Math.ceil(length / CHARS_PER_TOKEN);
	}

	function estimateMessageTokens(message) {
		if (!message) return 0;

		let contentLength = 0;
		if (typeof message.content === 'string') {
			contentLength = message.content.length;
		} else if (message.content) {
			contentLength = JSON.stringify(message.content).length;
		}

		if (message.tool_calls) {
			contentLength += JSON.stringify(message.tool_calls).length;
		}

		return Math.ceil(contentLength / CHARS_PER_TOKEN) + TOKENS_PER_MESSAGE_OVERHEAD;
	}

	function calculateTotalTokens() {
		return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
	}

	function trimToFit() {
		while (estimatedTotalTokens > maxTokens && messages.length > 2) {
			let removeIndex = 1;
			const candidate = messages[removeIndex];

			if (candidate.role === 'tool' && removeIndex > 0) {
				for (let i = removeIndex - 1; i >= 1; i--) {
					if (messages[i].role === 'assistant' && messages[i].tool_calls) {
						removeIndex = i;
						break;
					}
				}
			}

			if (candidate.role === 'assistant' && candidate.tool_calls) {
				let lastToolIndex = removeIndex;
				for (let i = removeIndex + 1; i < messages.length; i++) {
					if (messages[i].role === 'tool') {
						lastToolIndex = i;
					} else {
						break;
					}
				}
				const removed = messages.splice(removeIndex, lastToolIndex - removeIndex + 1);
				removed.forEach((msg) => {
					estimatedTotalTokens -= estimateMessageTokens(msg);
				});
			} else {
				const removed = messages.splice(removeIndex, 1)[0];
				estimatedTotalTokens -= estimateMessageTokens(removed);
			}
		}
	}

	function addMessage(message) {
		messages.push(message);
		estimatedTotalTokens += estimateMessageTokens(message);
		trimToFit();
	}

	function setMessages(newMessages) {
		messages = [...newMessages];
		estimatedTotalTokens = calculateTotalTokens();
		trimToFit();
	}

	function getMessages() {
		return messages;
	}

	function clear() {
		messages = [];
		estimatedTotalTokens = 0;
	}

	function setMaxTokens(value) {
		maxTokens = Math.max(1000, value);
		trimToFit();
	}

	function getMaxTokens() {
		return maxTokens;
	}

	function getEstimatedTokens() {
		return estimatedTotalTokens;
	}

	function getStats() {
		return {
			messageCount: messages.length,
			estimatedTokens: estimatedTotalTokens,
			maxTokens: maxTokens,
			utilizationPercent: Math.round((estimatedTotalTokens / maxTokens) * 100),
		};
	}

	function updateFromApiUsage(usage) {
		if (usage && usage.total_tokens) {
			estimatedTotalTokens = usage.total_tokens;
		}
	}

	return {
		addMessage,
		setMessages,
		getMessages,
		clear,
		setMaxTokens,
		getMaxTokens,
		getEstimatedTokens,
		getStats,
		updateFromApiUsage,
	};
})();

if (typeof window !== 'undefined') {
	window.ContextManager = ContextManager;
}
