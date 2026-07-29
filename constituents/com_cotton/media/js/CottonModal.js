/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * CottonModal - Classe para criar modais no Cotton Cloud
 * 
 * Cria um modal com overlay semi-transparente, contendo:
 * - Header com título
 * - Body com formulário
 * - Footer com botões Cancelar e Enviar
 * 
 * @class
 * @example
 * const modal = new CottonModal({
 *     title: 'Criar Pasta',
 *     body: '<input type="text" name="folder_name" placeholder="Nome da pasta">',
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
     * Construtor
     * @param {Object} options - Opções do modal
     *   @param {string} options.title - Título do modal
     *   @param {string} options.icon - Icone do modal
     *   @param {string} options.body - HTML do corpo do formulário
     *   @param {Function} options.onCancel - Callback do botão Cancelar
     *   @param {Function} options.onOpen - Callback ao abrir o modal
     *   @param {Function} options.onSubmit - Callback do botão Enviar (antes da action)
     *   @param {Function} options.onClose - Callback ao fechar (qualquer forma)
     *   @param {Object} options.action - Configuração de ação AJAX
     *     @param {string} options.action.url - URL da API
     *     @param {string} options.action.method - Método HTTP (padrão: POST)
     *     @param {Function} options.action.onSuccess - Callback em caso de sucesso (recebe response)
     *     @param {Function} options.action.onError - Callback em caso de erro (recebe error)
     *   @param {string} options.token - Nome do campo do token CSRF
     *   @param {boolean} options.showFooter - Mostrar rodapé (padrão: true)
     *   @param {boolean} options.showCancel - Mostrar botão Cancelar (padrão: true)
     *   @param {boolean} options.showSubmit - Mostrar botão Enviar (padrão: true)
     *   @param {string} options.cancelText - Texto do botão Cancelar (padrão: "Cancelar")
     *   @param {string} options.submitText - Texto do botão Enviar (padrão: "Enviar")
     *   @param {string} options.submitClass - Classe adicional do botão Enviar
     *   @param {boolean} options.reloadOnSuccess - Recarregar página após sucesso (padrão: false)
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
            cancelText: options.cancelText || 'Cancelar',
            submitText: options.submitText || 'Enviar',
            submitClass: options.submitClass || 'cotton-btn-primary',
            reloadOnSuccess: options.reloadOnSuccess || false,
            ...options
        };

        this.#init();
    }

    /**
     * Inicializa o modal
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
     * Constrói o HTML do modal
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
        closeBtn.title = 'Fechar';
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
     * Adiciona o corpo do modal
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
     * Escapa HTML para evitar XSS
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
     * Adiciona event listeners
     * @private
     */
    #attachEvents() {
        // Botão fechar (X)
        const closeBtn = this.#element.querySelector('.cotton-modal-close');
        closeBtn.addEventListener('click', () => this.close());

        // Botão Cancelar
        const cancelBtn = this.#element.querySelector('.cotton-modal-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Chama o callback onCancel se existir, ou fecha o modal
                if (this.#options.onCancel) {
                    this.#options.onCancel();
                }
                this.close();
            });
        }

        // Botão Enviar
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
                
                // Chamar callback antes da action
                const continueSubmit = await Promise.resolve(this.#options.onSubmit(data, form, formData));
                
                // Se onSubmit retornar false, não continuar
                if (continueSubmit === false) {
                    console.log('[CottonModal] onSubmit returned false, stopping');
                    return;
                }
                
                // Se há configuração de action, executar AJAX
                if (this.#options.action) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Enviando...';
                    
                    try {
                        const response = await this.#executeAction(data, formData);
                        
                        const hasDataSuccess = response?.data?.hasOwnProperty('success');
                        const success = hasDataSuccess ? response.data.success : response?.success;
                        const errorMsg = response?.error ?? response?.data?.error ?? response?.message;
                        
                        if (hasDataSuccess) {
                            if (response.data.success === false) {
                                this.#showErrorModal(errorMsg || response.data.message || 'Erro desconhecido');
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
                            this.#showErrorModal(errorMsg || 'Erro desconhecido');
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
                        this.#showErrorModal(error.message || 'Erro de comunicação');
                    }
                    
                    submitBtn.disabled = false;
                    submitBtn.textContent = this.#options.submitText;
                } else {
                    this.close();
                }
            });
        }

        // Fechar ao clicar no overlay
        /*this.#screen.addEventListener('click', (e) => {
            if (e.target === this.#screen) {
                this.close();
            }
        });*/

        // Fechar com ESC
        this.#boundKeydownHandler = this.#handleKeydown.bind(this);
        document.addEventListener('keydown', this.#boundKeydownHandler);
    }

    /**
     * Handler para tecla ESC
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
     * Executa a ação AJAX
     * @private
     * @param {Object} data - Dados do formulário
     * @param {FormData} formData - Dados do formulário
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
                // Adicionar token CSRF ao FormData
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
        
        // Tentar parsear JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        // Se não for JSON, retornar texto
        const text = await response.text();
        return { success: response.ok, message: text };
    }

    /**
     * Mostra modal de erro
     * @private
     * @param {string} message - Mensagem de erro
     */
    #showErrorModal(message) {
        const errorModal = new CottonModal({
            title: 'Erro',
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
     * Abre o modal
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
     * Fecha o modal
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
     * Atualiza o título do modal
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
     * Atualiza o corpo do modal
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
     * Obtém o elemento do modal
     * @returns {HTMLElement}
     */
    getElement() {
        return this.#element;
    }

    /**
     * Verifica se o modal está aberto
     * @returns {boolean}
     */
    isOpen() {
        return this.#isOpen;
    }

    /**
     * Destrói o modal
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
 * CottonModalManager - Gerenciador de múltiplos modais
 * @class
 */
export class CottonModalManager {
    #modals = {};

    /**
     * Cria e registra um modal
     * @param {string} name - Nome identificador do modal
     * @param {Object} options - Opções do CottonModal
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
     * Obtém um modal pelo nome
     * @param {string} name
     * @returns {CottonModal|null}
     */
    get(name) {
        return this.#modals[name] || null;
    }

    /**
     * Abre um modal pelo nome
     * @param {string} name
     */
    open(name) {
        if (this.#modals[name]) {
            this.#modals[name].open();
        }
    }

    /**
     * Fecha um modal pelo nome
     * @param {string} name
     */
    close(name) {
        if (this.#modals[name]) {
            this.#modals[name].close();
        }
    }

    /**
     * Fecha todos os modais
     */
    closeAll() {
        Object.values(this.#modals).forEach(modal => modal.close());
    }

    /**
     * Remove um modal
     * @param {string} name
     */
    remove(name) {
        if (this.#modals[name]) {
            this.#modals[name].destroy();
            delete this.#modals[name];
        }
    }
}
