/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
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

    constructor(tabsContainer, panesContainer, options = {}) {
        this.#tabsContainer = typeof tabsContainer === 'string'
            ? document.querySelector(tabsContainer)
            : tabsContainer;
        this.#panesContainer = typeof panesContainer === 'string'
            ? document.querySelector(panesContainer)
            : panesContainer;

        if (!this.#tabsContainer) {
            throw new Error('[CottonTabs] Container de abas não encontrado');
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

    updateTab(tabId, data) {
        const tab = this.#tabs.find(t => t.id === tabId);
        if (!tab) return;

        Object.assign(tab, data);
        this.#renderTabs();
        this.#emit('tab:update', tab);
    }

    setDirty(tabId, dirty) {
        const tab = this.#tabs.find(t => t.id === tabId);
        if (tab) {
            tab.dirty = dirty;
            this.#renderTabs();
        }
    }

    getActiveTab() {
        return this.#activeTabId ? this.getTabById(this.#activeTabId) : null;
    }

    getTabById(tabId) {
        return this.#tabs.find(t => t.id === tabId);
    }

    getTabs() {
        return [...this.#tabs];
    }

    getTabsContainer() {
        return this.#tabsContainer;
    }

    getPanesContainer() {
        return this.#panesContainer;
    }

    getPaneElement(tabId) {
        return this.#panesContainer?.querySelector(`[data-tab-id="${tabId}"]`);
    }

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

    #removeTabElement(tab) {
        if (tab.tabElement?.parentElement) {
            tab.tabElement.remove();
        }
        delete tab.tabElement;
    }

    #createPaneElement(tab) {
        if (this.#panesContainer && this.#options.createPane) {
            const paneElement = this.#options.createPane(tab);
            if (paneElement) {
                tab.paneElement = paneElement;
                this.#panesContainer.appendChild(paneElement);
            }
        }
    }

    #removePaneElement(tab) {
        if (tab.paneElement?.parentElement) {
            tab.paneElement.remove();
        }
        delete tab.paneElement;
    }

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

    #scrollToEnd() {
        if (!this.#tabsContainer) return;
        requestAnimationFrame(() => {
            this.#tabsContainer.scrollTo({
                left: this.#tabsContainer.scrollWidth,
                behavior: 'smooth'
            });
        });
    }

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

    #emit(event, data) {
        if (this.#listeners[event]) {
            this.#listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`[CottonTabs] Erro no listener ${event}:`, err);
                }
            });
        }
    }

    on(event, callback) {
        if (!this.#listeners[event]) {
            this.#listeners[event] = [];
        }
        this.#listeners[event].push(callback);
    }

    off(event, callback) {
        if (this.#listeners[event]) {
            this.#listeners[event] = this.#listeners[event].filter(cb => cb !== callback);
        }
    }

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