/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * CottonModal - Class for creating modals in Cotton Cloud
 * 
 * Creates a modal with semi-transparent overlay, containing:
 * - Header with title
 * - Body with form
 * - Footer with Cancel and Submit buttons
 * 
 * @class
 * @example
 * const modal = new CottonModal({
 *     title: 'Create Folder',
 *     body: '<input type="text" name="folder_name" placeholder="Folder name">',
 *     onCancel: () => modal.close(),
 *     onSubmit: (data) => { console.log(data); modal.close(); }
 * });
 * modal.open();
 */
export class CottonModal {
    static zIndexCounter = 1100;
    #options = {};
    #element = null;
    #screen = null;
    #isOpen = false;
    #boundKeydownHandler = null;

    /**
     * Constructor
     * @param {Object} options - Modal options
     *   @param {string} options.title - Modal title
     *   @param {string} options.icon - Modal icon
     *   @param {string} options.body - Form body HTML
     *   @param {Function} options.onCancel - Cancel button callback
     *   @param {Function} options.onOpen - Callback when opening the modal
     *   @param {Function} options.onSubmit - Submit button callback (before action)
     *   @param {Function} options.onClose - Callback when closing (any method)
     *   @param {Object} options.action - AJAX action configuration
     *     @param {string} options.action.url - API URL
     *     @param {string} options.action.method - HTTP method (default: POST)
     *     @param {Function} options.action.onSuccess - Success callback (receives response)
     *     @param {Function} options.action.onError - Error callback (receives error)
     *   @param {string} options.token - CSRF token field name
     *   @param {boolean} options.showFooter - Show footer (default: true)
     *   @param {boolean} options.showCancel - Show Cancel button (default: true)
     *   @param {boolean} options.showSubmit - Show Submit button (default: true)
     *   @param {string} options.cancelText - Cancel button text (default: "Cancel")
     *   @param {string} options.submitText - Submit button text (default: "Submit")
     *   @param {string} options.submitClass - Additional class for Submit button
     *   @param {boolean} options.reloadOnSuccess - Reload page after success (default: false)
     */
    constructor(options = {}) {
        this.#options = {
            title: options.title || '',
            icon: options.icon || '',
            width: options.width || '',
            height: options.height || '',
            body: options.body || '',
            onOpen: options.onOpen || (() => {}),
            onCancel: options.onCancel || (() => {}),
            onSubmit: options.onSubmit || (() => {}),
            onClose: options.onClose || (() => {}),
            action: options.action || null,
            token: options.token || null,
            showFooter: options.showFooter !== false,
            showCancel: options.showCancel !== false,
            showSubmit: options.showSubmit !== false,
            cancelText: options.cancelText || 'Cancel',
            submitText: options.submitText || 'Submit',
            submitClass: options.submitClass || 'cotton-btn-primary',
            reloadOnSuccess: options.reloadOnSuccess || false,
            ...options
        };

        this.#init();
    }

    /**
     * Initializes the modal
     * @private
     */
    #init() {
        this.#screen = document.createElement('div');
        this.#screen.className = 'cotton-modal-screen';
        (document.body || document.documentElement).appendChild(this.#screen);

        this.#element = document.createElement('div');
        this.#element.className = 'cotton-modal';
        this.#element.appendChild(this.#buildHTML());

        this.#attachEvents();
    }

    /**
     * Builds the modal HTML
     * @private
     * @returns {HTMLElement}
     */
    #buildHTML() {
        const dialog = document.createElement('main');
        dialog.className = 'cotton-modal-dialog';
        dialog.style.width = this.#options.width;
        dialog.style.height = this.#options.height;

        const header = document.createElement('header');
        header.className = 'cotton-modal-header';

        const title = document.createElement('div');
        title.className = 'cotton-modal-title';
        title.innerHTML = `${this.#options.icon}<spam>${this.#options.title}</spam>`;

        const closeBtn = document.createElement('div');
        closeBtn.className = 'cotton-modal-close';
        closeBtn.title = 'Close';
        closeBtn.innerHTML = `<i class="icon-remove"></i>`;

        header.append(title, closeBtn);

        const body = document.createElement('section');
        body.className = 'cotton-modal-body';
        this.#appendBody(body);

        dialog.append(header, body);

        if (this.#options.showFooter) {
            const footer = document.createElement('footer');
            footer.className = 'cotton-modal-footer';

            if (this.#options.showCancel) {
                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'btn btn-outline-secondary btn-sm active cotton-modal-cancel';
                cancelBtn.textContent = this.#options.cancelText;
                footer.appendChild(cancelBtn);
            }

            if (this.#options.showSubmit) {
                const submitBtn = document.createElement('button');
                submitBtn.type = 'button';
                submitBtn.className = `btn btn-outline-secondary btn-sm active  ${this.#options.submitClass} cotton-modal-submit`;
                submitBtn.textContent = this.#options.submitText;
                footer.appendChild(submitBtn);
            }

            dialog.appendChild(footer);
        }

        return dialog;
    }

    /**
     * Adds the modal body
     * @private
     * @param {HTMLElement} body
     */
    #appendBody(body) {
        if (!this.#options.body) {
            return;
        }

        if (typeof this.#options.body === 'string') {
            body.innerHTML = this.#options.body;
            return;
        }

        body.appendChild(this.#options.body);
    }

    /**
     * Escapes HTML to prevent XSS
     * @private
     * @param {string} text
     * @returns {string}
     */
    #escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Adds event listeners
     * @private
     */
    #attachEvents() {
        // Close button (X)
        const closeBtn = this.#element.querySelector('.cotton-modal-close');
        closeBtn.addEventListener('click', () => this.close());

        // Cancel button
        const cancelBtn = this.#element.querySelector('.cotton-modal-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Calls the onCancel callback if it exists, or closes the modal
                if (this.#options.onCancel) {
                    this.#options.onCancel();
                }
                this.close();
            });
        }

        // Submit button
        const submitBtn = this.#element.querySelector('.cotton-modal-submit');

        if (submitBtn) {
            submitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                
                const form = this.#element.querySelector('.cotton-modal-body form');
                let data = {};
                let formData = null;
                
                if (form) {
                    formData = new FormData(form);
                    data = Object.fromEntries(formData.entries());
                    
                    // Process checkboxes: ensure they always have a value (0 or 1)
                    // This fixes the issue where unchecked checkboxes don't send any value
                    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                        const name = checkbox.name;
                        if (name) {
                            // If checkbox is not in data, it means it's unchecked
                            // Set value to 0
                            if (!(name in data)) {
                                data[name] = '0';
                            }
                            // Always update formData to include checkbox value
                            formData.set(name, checkbox.checked ? '1' : '0');
                        }
                    });
                    
                    // Process allowed_users field: convert comma-separated IDs to JSON array
                    if (data.allowed_users && typeof data.allowed_users === 'string') {
                        const usersArray = data.allowed_users.split(',').map(id => {
                            const trimmed = id.trim();
                            return trimmed === '' ? null : parseInt(trimmed, 10);
                        }).filter(id => id !== null && !isNaN(id));
                        data.allowed_users = JSON.stringify(usersArray);
                        formData.set('allowed_users', data.allowed_users);
                    }
                }
                
                // Call callback before action
                const continueSubmit = await Promise.resolve(this.#options.onSubmit(data, form, formData));
                
                // If onSubmit returns false, do not continue
                if (continueSubmit === false) {
                    console.log('[CottonModal] onSubmit returned false, stopping');
                    return;
                }
                
                // If action is configured, execute AJAX
                if (this.#options.action) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Submitting...';
                    
                    try {
                        const response = await this.#executeAction(data, formData);
                        
                        const hasDataSuccess = response?.data?.hasOwnProperty('success');
                        const success = hasDataSuccess ? response.data.success : response?.success;
                        const errorMsg = response?.error ?? response?.data?.error ?? response?.message;
                        
                        if (hasDataSuccess) {
                            if (response.data.success === false) {
                                this.#showErrorModal(errorMsg || response.data.message || 'Unknown error');
                            } else if (response.data.success === true) {
                                if (this.#options.action.onSuccess) {
                                    this.#options.action.onSuccess(response);
                                }
                                this.close();
                                if (this.#options.reloadOnSuccess) {
                                    window.location.reload();
                                }
                            }
                        } else if (response && (errorMsg || success === false)) {
                            this.#showErrorModal(errorMsg || 'Unknown error');
                        } else {
                            if (this.#options.action.onSuccess) {
                                this.#options.action.onSuccess(response);
                            }
                            this.close();
                            if (this.#options.reloadOnSuccess) {
                                window.location.reload();
                            }
                        }
                    } catch (error) {
                        this.#showErrorModal(error.message || 'Communication error');
                    }
                    
                    submitBtn.disabled = false;
                    submitBtn.textContent = this.#options.submitText;
                } else {
                    this.close();
                }
            });
        }

        // Close when clicking overlay
        /*this.#screen.addEventListener('click', (e) => {
            if (e.target === this.#screen) {
                this.close();
            }
        });*/

        // Close with ESC
        this.#boundKeydownHandler = this.#handleKeydown.bind(this);
        document.addEventListener('keydown', this.#boundKeydownHandler);
    }

    /**
     * ESC key handler
     * @private
     */
    #handleKeydown(e) {
        if (e.key === 'Escape' && this.#isOpen) {
            const topModal = CottonModal.getTopModal();
            if (topModal === this.#element) {
                this.close();
            }
        }
    }

    static getTopModal() {
        const modals = document.querySelectorAll('.cotton-modal-show');
        if (modals.length === 0) return null;
        return modals[modals.length - 1];
    }

    /**
     * Executes the AJAX action
     * @private
     * @param {Object} data - Form data
     * @param {FormData} formData - Form data
     * @returns {Promise<Object>}
     */
    async #executeAction(data, formData) {
        const { url, method = 'POST' } = this.#options.action;
        
        const options = {
            method: method,
            credentials: 'same-origin',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        
        if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
            if (formData) {
                // Add CSRF token to FormData
                if (this.#options.token) {
                    formData.append(this.#options.token, 1);
                }
                options.body = formData;
            } else {
                options.body = JSON.stringify(data);
                options.headers['Content-Type'] = 'application/json';
            }
        }
        
        const response = await fetch(url, options);
        
        // Try parsing JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        // If not JSON, return text
        const text = await response.text();
        return { success: response.ok, message: text };
    }

    /**
     * Shows error modal
     * @private
     * @param {string} message - Error message
     */
    #showErrorModal(message) {
        const errorModal = new CottonModal({
            title: 'Error',
            icon: 'icon-cancel',
            width: '420px',
            height: '200px',
            body: `<span style="color: var(--cot-red); margin: 10px; font-size: small;">${this.#escapeHTML(message)}</span>`,
            showFooter: true,
            showCancel: false,
            showSubmit: true,
            submitText: 'OK',
            submitClass: 'cotton-btn-primary',
            onSubmit: () => errorModal.close()
        });
        errorModal.open();
    }

    /**
     * Opens the modal
     */
    open() {
        if (this.#isOpen) return;

        this.#screen.style.zIndex = CottonModal.zIndexCounter++;
        this.#element.style.zIndex = CottonModal.zIndexCounter++;
        
        this.#screen.appendChild(this.#element);
        this.#screen.style.display = 'grid';
        this.#element.classList.add('cotton-modal-show');
        
        this.#isOpen = true;

        if (typeof this.#options.onOpen === 'function') {
            this.#options.onOpen();
        }

        setTimeout(() => {
            const firstInput = this.#element.querySelector('input, textarea, select');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }

    /**
     * Closes the modal
     */
    close() {
        if (!this.#isOpen) return;

        this.#element.classList.remove('cotton-modal-show');
        this.#element.style.zIndex = '';
        
        setTimeout(() => {
            if (this.#element.parentNode) {
                this.#element.parentNode.removeChild(this.#element);
            }
            if (this.#screen.parentNode) {
                this.#screen.parentNode.removeChild(this.#screen);
            }
        }, 200);

        this.#options.onClose();
        this.#isOpen = false;
    }

    /**
     * Updates the modal title
     * @param {string} title
     */
    setTitle(title) {
        this.#options.title = title;
        const titleEl = this.#element.querySelector('.cotton-modal-title');
        if (titleEl) {
            titleEl.textContent = title;
        }
    }

    /**
     * Updates the modal body
     * @param {string} bodyHTML
     */
    setBody(bodyHTML) {
        this.#options.body = bodyHTML;
        const bodyEl = this.#element.querySelector('.cotton-modal-body');
        if (bodyEl) {
            bodyEl.innerHTML = bodyHTML;
        }
    }

    /**
     * Gets the modal element
     * @returns {HTMLElement}
     */
    getElement() {
        return this.#element;
    }

    /**
     * Checks if the modal is open
     * @returns {boolean}
     */
    isOpen() {
        return this.#isOpen;
    }

    /**
     * Destroys the modal
     */
    destroy() {
        this.close();
        if (this.#boundKeydownHandler) {
            document.removeEventListener('keydown', this.#boundKeydownHandler);
        }
        if (this.#screen && this.#element.parentNode === this.#screen) {
            this.#screen.removeChild(this.#element);
        }
        if (this.#screen && this.#screen.parentNode) {
            this.#screen.parentNode.removeChild(this.#screen);
        }
    }
}

if (typeof window !== 'undefined') {
    window.CottonModal = CottonModal;
}

/**
 * CottonModalManager - Manager for multiple modals
 * @class
 */
export class CottonModalManager {
    #modals = {};

    /**
     * Creates and registers a modal
     * @param {string} name - Modal identifier name
     * @param {Object} options - CottonModal options
     * @returns {CottonModal}
     */
    create(name, options) {
        if (this.#modals[name]) {
            this.#modals[name].destroy();
        }
        this.#modals[name] = new CottonModal(options);
        return this.#modals[name];
    }

    /**
     * Gets a modal by name
     * @param {string} name
     * @returns {CottonModal|null}
     */
    get(name) {
        return this.#modals[name] || null;
    }

    /**
     * Opens a modal by name
     * @param {string} name
     */
    open(name) {
        if (this.#modals[name]) {
            this.#modals[name].open();
        }
    }

    /**
     * Closes a modal by name
     * @param {string} name
     */
    close(name) {
        if (this.#modals[name]) {
            this.#modals[name].close();
        }
    }

    /**
     * Closes all modals
     */
    closeAll() {
        Object.values(this.#modals).forEach(modal => modal.close());
    }

    /**
     * Removes a modal
     * @param {string} name
     */
    remove(name) {
        if (this.#modals[name]) {
            this.#modals[name].destroy();
            delete this.#modals[name];
        }
    }
}
