/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * CottonTabs - Tab management for the Cotton UI
 *
 * Provides a tabbed interface with support for:
 * - Creating, switching, and closing tabs
 * - Dirty state tracking for unsaved changes
 * - Custom tab icons and pane rendering
 * - Event emission for tab lifecycle hooks
 */

const escapeHtml = (typeof CottonHelper !== 'undefined' && CottonHelper.escapeHtml)
    ? CottonHelper.escapeHtml.bind(CottonHelper)
    : (text) => text;

export class CottonTabs {
    #tabs = [];
    #activeTabId = null;
    #nextTabId = 1;
    #options = {};
    #listeners = {};
    #tabsContainer = null;
    #panesContainer = null;

     /**
      * Creates a new tabs manager instance.
      * @param {string|HTMLElement} tabsContainer - Tabs container selector or element
      * @param {string|HTMLElement} panesContainer - Panes container selector or element
      * @param {Object} [options={}] - Configuration options
      * @param {Function} [options.onTabChange] - Callback when active tab changes
      * @param {Function} [options.onTabClose] - Callback when a tab is closed
      * @param {Function} [options.onTabCreate] - Callback when a tab is created
      * @param {Function} [options.renderTab] - Custom tab renderer
      * @param {Function} [options.createPane] - Custom pane renderer
      * @param {Function} [options.getTabIcon] - Custom tab icon getter
      */
     constructor(tabsContainer, panesContainer, options = {}) {
        this.#tabsContainer = typeof tabsContainer === 'string'
            ? document.querySelector(tabsContainer)
            : tabsContainer;
        this.#panesContainer = typeof panesContainer === 'string'
            ? document.querySelector(panesContainer)
            : panesContainer;

        if (!this.#tabsContainer) {
            throw new Error('[CottonTabs] Tabs container not found');
        }

        this.#options = {
            onTabChange: options.onTabChange || null,
            onTabClose: options.onTabClose || null,
            onTabCreate: options.onTabCreate || null,
            renderTab: options.renderTab || null,
            createPane: options.createPane || null,
            getTabIcon: options.getTabIcon || null,
            ...options
        };

        this.#attachEventListeners();
    }

     /**
      * Adds a new tab.
      * @param {Object} tabData - Tab data
      * @param {string|number} [tabData.id] - Tab ID
      * @param {string} [tabData.title] - Tab title
      * @param {string} [tabData.name] - Tab name (fallback for title)
      * @param {string} [tabData.content] - Tab content HTML
      * @param {boolean} [tabData.dirty] - Whether the tab has unsaved changes
      * @returns {string|number} Tab ID
      */
     addTab(tabData) {
        const tabId = tabData.id || this.#nextTabId++;
        const tab = {
            id: tabId,
            title: tabData.title || tabData.name || 'Untitled',
            content: tabData.content || '',
            dirty: tabData.dirty || false,
            ...tabData
        };

        this.#tabs.push(tab);
        this.#activeTabId = tab.id;

        this.#createTabElement(tab);
        this.#createPaneElement(tab);
        this.#renderTabs();
        this.#showActivePane();
        this.#scrollToEnd();

        if (this.#options.onTabCreate) {
            this.#options.onTabCreate(tab);
        }

        this.#emit('tab:create', tab);

        return tab.id;
    }

     /**
      * Switches to the specified tab.
      * @param {string|number} tabId - Tab ID to activate
      */
     switchToTab(tabId) {
        const tab = this.#tabs.find(t => t.id === tabId);
        if (!tab) return;

        const previousTab = this.#activeTabId ? this.getTabById(this.#activeTabId) : null;
        this.#activeTabId = tabId;

        this.#renderTabs();
        this.#showActivePane();
        this.#scrollTabIntoView(tabId);
        this.#emit('tab:change', { tab, previousTab });

        if (this.#options.onTabChange) {
            this.#options.onTabChange(tab, previousTab);
        }
    }

     /**
      * Closes the specified tab.
      * @param {string|number} tabId - Tab ID to close
      */
     async closeTab(tabId) {
        const index = this.#tabs.findIndex(t => t.id === tabId);
        if (index === -1) return;

        const tab = this.#tabs[index];
        const wasActive = this.#activeTabId === tabId;

        this.#emit('tab:close', tab);

        if (this.#options.onTabClose) {
            const result = await this.#options.onTabClose(tab);
            if (result === false) return;
        }

        this.#removePaneElement(tab);
        this.#removeTabElement(tab);

        this.#tabs.splice(index, 1);

        if (wasActive && this.#tabs.length > 0) {
            const newActiveIndex = Math.min(index, this.#tabs.length - 1);
            const newActive = this.#tabs[newActiveIndex];
            this.switchToTab(newActive.id);
        } else if (wasActive) {
            this.#activeTabId = null;
            this.#showActivePane();
        }

        this.#scrollToEnd();
    }

     /**
      * Updates tab data by ID.
      * @param {string|number} tabId - Tab ID
      * @param {Object} data - Data to merge into the tab
      */
     updateTab(tabId, data) {
        const tab = this.#tabs.find(t => t.id === tabId);
        if (!tab) return;

        Object.assign(tab, data);
        this.#renderTabs();
        this.#emit('tab:update', tab);
    }

     /**
      * Sets the dirty state for a tab.
      * @param {string|number} tabId - Tab ID
      * @param {boolean} dirty - Whether the tab has unsaved changes
      */
     setDirty(tabId, dirty) {
        const tab = this.#tabs.find(t => t.id === tabId);
        if (tab) {
            tab.dirty = dirty;
            this.#renderTabs();
        }
    }

     /**
      * Gets the currently active tab.
      * @returns {Object|null} Active tab object
      */
     getActiveTab() {
        return this.#activeTabId ? this.getTabById(this.#activeTabId) : null;
    }

     /**
      * Gets a tab by its ID.
      * @param {string|number} tabId - Tab ID
      * @returns {Object|undefined} Tab object
      */
     getTabById(tabId) {
        return this.#tabs.find(t => t.id === tabId);
    }

     /**
      * Gets all registered tabs.
      * @returns {Object[]} Array of tab objects
      */
     getTabs() {
        return [...this.#tabs];
    }

     /**
      * Gets the tabs container element.
      * @returns {HTMLElement|null} Tabs container element
      */
     getTabsContainer() {
        return this.#tabsContainer;
    }

     /**
      * Gets the panes container element.
      * @returns {HTMLElement|null} Panes container element
      */
     getPanesContainer() {
        return this.#panesContainer;
    }

     /**
      * Gets the pane element for a specific tab.
      * @param {string|number} tabId - Tab ID
      * @returns {HTMLElement|null} Pane element
      */
     getPaneElement(tabId) {
        return this.#panesContainer?.querySelector(`[data-tab-id="${tabId}"]`);
    }

     /**
      * Creates the DOM element for a tab.
      * @param {Object} tab - Tab object
      * @private
      */
     #createTabElement(tab) {
        const name = tab.name || tab.title || 'Untitled';
        const truncatedTitle = CottonHelper.truncateName(name, 18);

        const displayTitle = typeof truncatedTitle === 'string' ? truncatedTitle : (truncatedTitle.display || name);
        const fullTitle = typeof truncatedTitle === 'string' ? name : (truncatedTitle.full || name);

        const dirtyIndicator = tab.dirty
            ? '<span class="cotton-tab-dirty-indicator" title="Unsaved changes"></span>'
            : '';

        const icon = this.#options.getTabIcon
            ? this.#options.getTabIcon(tab)
            : '';

        const tabElement = document.createElement('div');
        tabElement.className = 'cotton-tab';
        tabElement.dataset.tabId = tab.id;
        tabElement.innerHTML = `
            ${dirtyIndicator}
            <span class="cotton-tab-title" title="${escapeHtml(fullTitle)}">
                ${icon}<span>${escapeHtml(displayTitle)}</span>
            </span>
            <button class="cotton-tab-close" data-tab-id="${tab.id}" title="Close tab">&times;</button>
        `;

        tab.tabElement = tabElement;
    }

     /**
      * Removes the DOM element for a tab.
      * @param {Object} tab - Tab object
      * @private
      */
     #removeTabElement(tab) {
        if (tab.tabElement?.parentElement) {
            tab.tabElement.remove();
        }
        delete tab.tabElement;
    }

     /**
      * Creates the DOM element for a tab pane.
      * @param {Object} tab - Tab object
      * @private
      */
     #createPaneElement(tab) {
        if (this.#panesContainer && this.#options.createPane) {
            const paneElement = this.#options.createPane(tab);
            if (paneElement) {
                tab.paneElement = paneElement;
                this.#panesContainer.appendChild(paneElement);
            }
        }
    }

     /**
      * Removes the DOM element for a tab pane.
      * @param {Object} tab - Tab object
      * @private
      */
     #removePaneElement(tab) {
        if (tab.paneElement?.parentElement) {
            tab.paneElement.remove();
        }
        delete tab.paneElement;
    }

     /**
      * Shows the active tab pane and hides others.
      * @private
      */
     #showActivePane() {
        if (!this.#panesContainer) return;

        this.#panesContainer.querySelectorAll('.cotton-pane').forEach(pane => {
            pane.style.display = 'none';
        });

        const welcomeContent = this.#panesContainer.querySelector('.weaver-welcome-content');
        if (welcomeContent) {
            welcomeContent.style.display = 'none';
        }

        if (this.#activeTabId) {
            const activeTab = this.getTabById(this.#activeTabId);
            if (activeTab?.paneElement) {
                activeTab.paneElement.style.display = '';
            }
        } else {
            const welcomeContent = this.#panesContainer.querySelector('.weaver-welcome-content');
            if (welcomeContent) {
                welcomeContent.style.display = '';
            }
        }
    }

     /**
      * Re-renders all tab elements in the tabs container.
      * @private
      */
     #renderTabs() {
        if (!this.#tabsContainer) return;

        this.#tabsContainer.innerHTML = '';

        this.#tabs.forEach(tab => {
            this.#createTabElement(tab);

            const isActive = tab.id === this.#activeTabId;
            tab.tabElement.className = `cotton-tab${isActive ? ' active' : ''}`;
            this.#tabsContainer.appendChild(tab.tabElement);
        });
    }

     /**
      * Scrolls the tabs container to the end.
      * @private
      */
     #scrollToEnd() {
        if (!this.#tabsContainer) return;
        requestAnimationFrame(() => {
            this.#tabsContainer.scrollTo({
                left: this.#tabsContainer.scrollWidth,
                behavior: 'smooth'
            });
        });
    }

     /**
      * Scrolls a specific tab into view within the tabs container.
      * @param {string|number} tabId - Tab ID to scroll into view
      * @private
      */
     #scrollTabIntoView(tabId) {
        if (!this.#tabsContainer) return;

        requestAnimationFrame(() => {
            const tabElement = this.#tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
            if (!tabElement) return;

            const containerRect = this.#tabsContainer.getBoundingClientRect();
            const tabRect = tabElement.getBoundingClientRect();
            const tabLeft = tabRect.left - containerRect.left + this.#tabsContainer.scrollLeft;
            const tabRight = tabRect.right - containerRect.left + this.#tabsContainer.scrollLeft;
            const visibleLeft = this.#tabsContainer.scrollLeft;
            const visibleRight = this.#tabsContainer.scrollLeft + this.#tabsContainer.clientWidth;
            const margin = 8;

            if (tabLeft < visibleLeft) {
                this.#tabsContainer.scrollLeft = Math.max(0, tabLeft - margin);
                return;
            }

            if (tabRight > visibleRight) {
                this.#tabsContainer.scrollLeft = Math.min(
                    this.#tabsContainer.scrollWidth - this.#tabsContainer.clientWidth,
                    tabRight - this.#tabsContainer.clientWidth + margin
                );
            }
        });
    }

     /**
      * Attaches click event listeners to the tabs container.
      * @private
      */
     #attachEventListeners() {
        this.#tabsContainer.addEventListener('click', (event) => {
            const tabTitle = event.target.closest('.cotton-tab-title');
            if (tabTitle) {
                const tab = tabTitle.closest('.cotton-tab');
                const tabId = parseInt(tab?.dataset.tabId, 10);
                if (tabId) this.switchToTab(tabId);
                return;
            }

            if (event.target.classList.contains('cotton-tab-close')) {
                const tabId = parseInt(event.target.dataset.tabId, 10);
                if (tabId) this.closeTab(tabId);
            }
        });
    }

     /**
      * Emits a custom event to registered listeners.
      * @param {string} event - Event name
      * @param {*} data - Event data
      * @private
      */
     #emit(event, data) {
        if (this.#listeners[event]) {
            this.#listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`[CottonTabs] Error in listener ${event}:`, err);
                }
            });
        }
    }

     /**
      * Registers an event listener.
      * @param {string} event - Event name
      * @param {Function} callback - Callback function
      */
     on(event, callback) {
        if (!this.#listeners[event]) {
            this.#listeners[event] = [];
        }
        this.#listeners[event].push(callback);
    }

     /**
      * Removes an event listener.
      * @param {string} event - Event name
      * @param {Function} callback - Callback function to remove
      */
     off(event, callback) {
        if (this.#listeners[event]) {
            this.#listeners[event] = this.#listeners[event].filter(cb => cb !== callback);
        }
    }

     /**
      * Destroys the tabs manager and cleans up DOM and listeners.
      */
     destroy() {
        this.#listeners = {};
        if (this.#tabsContainer) {
            this.#tabsContainer.innerHTML = '';
        }
        if (this.#panesContainer) {
            this.#panesContainer.innerHTML = '';
        }
        this.#tabs = [];
        this.#activeTabId = null;
    }
}

if (typeof window !== 'undefined') {
    window.CottonTabs = CottonTabs;
}