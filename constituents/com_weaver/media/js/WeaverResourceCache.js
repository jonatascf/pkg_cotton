/**
 * @package Tabaoca.Component.Weaver.Site
 * @subpackage com_weaver
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU Affero General Public License version 3 or later; see LICENSE.md
 */

/**
 * WeaverResourceCache - Caches Weaver MCP resources with dirty-state tracking
 *
 * Reduces latency by only fetching resources that have changed
 * since the last read, using dirty flags and TTL-based expiration.
 */
const WeaverResourceCache = (() => {
	const DEFAULT_TTL_MS = 30000;

	let data = {};
	let timestamps = {};
	let dirtyFlags = {};
	let ttlMs = DEFAULT_TTL_MS;

	function extractKey(uri) {
		return uri.replace('shuttle://weaver/', '');
	}

	function markDirty(resourceKey) {
		dirtyFlags[resourceKey] = true;
	}

	function markAllDirty() {
		Object.keys(data).forEach((key) => {
			dirtyFlags[key] = true;
		});
	}

	function isDirty(resourceKey) {
		if (dirtyFlags[resourceKey]) return true;
		if (!data[resourceKey]) return true;

		const age = Date.now() - (timestamps[resourceKey] || 0);
		return age > ttlMs;
	}

	function getDirtyKeys() {
		return Object.keys(data).filter((key) => isDirty(key));
	}

	function set(resourceKey, resourceData) {
		data[resourceKey] = resourceData;
		timestamps[resourceKey] = Date.now();
		dirtyFlags[resourceKey] = false;
	}

	function get(resourceKey) {
		if (isDirty(resourceKey)) return null;
		return data[resourceKey];
	}

	function getAll() {
		return { ...data };
	}

	function clear() {
		data = {};
		timestamps = {};
		dirtyFlags = {};
	}

	function setTtl(ms) {
		ttlMs = Math.max(1000, ms);
	}

	function getTtl() {
		return ttlMs;
	}

	function getStats() {
		const keys = Object.keys(data);
		return {
			cached: keys.length,
			dirty: keys.filter((k) => isDirty(k)).length,
			keys: keys,
		};
	}

	return {
		markDirty,
		markAllDirty,
		isDirty,
		getDirtyKeys,
		set,
		get,
		getAll,
		clear,
		setTtl,
		getTtl,
		getStats,
		extractKey,
	};
})();

if (typeof window !== 'undefined') {
	window.WeaverResourceCache = WeaverResourceCache;
}
