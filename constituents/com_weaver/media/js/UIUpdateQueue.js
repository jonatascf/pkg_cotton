/**
 * @package Tabaoca.Component.Weaver.Site
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

/**
 * UIUpdateQueue - Serializes async UI updates to prevent race conditions
 *
 * Ensures that tool result updates are processed sequentially,
 * preventing DOM conflicts and duplicate tree refreshes.
 */
const UIUpdateQueue = (() => {
	let queue = [];
	let processing = false;

	async function process() {
		if (processing) return;
		processing = true;

		while (queue.length > 0) {
			const update = queue.shift();
			try {
				await update();
			} catch (error) {
				console.error('[UIUpdateQueue] Update failed:', error);
			}
		}

		processing = false;
	}

	function enqueue(updateFn) {
		queue.push(updateFn);
		process();
	}

	function clear() {
		queue = [];
	}

	function size() {
		return queue.length;
	}

	return {
		enqueue,
		clear,
		size,
	};
})();

/**
 * TreeRefreshBatcher - Deduplicates tree refresh requests
 *
 * Batches multiple tree refresh requests into a single refresh
 * on the next animation frame, preventing redundant API calls.
 */
const TreeRefreshBatcher = (() => {
	let pending = false;
	let scheduled = false;

	function request() {
		pending = true;
		if (!scheduled) {
			scheduled = true;
			requestAnimationFrame(() => {
				if (pending && window.WeaverEditor?.refreshTree) {
					window.WeaverEditor.refreshTree();
				}
				pending = false;
				scheduled = false;
			});
		}
	}

	function reset() {
		pending = false;
		scheduled = false;
	}

	return {
		request,
		reset,
	};
})();

/**
 * DOMUtils - Helper functions for DOM operations
 */
const DOMUtils = ((() => {
	function isElementValid(element) {
		return element && document.contains(element);
	}

	function safeQuerySelector(selector) {
		try {
			return document.querySelector(selector);
		} catch {
			return null;
		}
	}

	return {
		isElementValid,
		safeQuerySelector,
	};
})());

if (typeof window !== 'undefined') {
	window.UIUpdateQueue = UIUpdateQueue;
	window.TreeRefreshBatcher = TreeRefreshBatcher;
	window.DOMUtils = DOMUtils;
}
