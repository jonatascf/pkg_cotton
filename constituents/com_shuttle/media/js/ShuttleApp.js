/**
 * @package Tabaoca.Component.Shuttle.Site
 * @subpackage com_shuttle
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * ShuttleApp - Terminal-style interface for Shuttle commands
 *
 * Provides a browser-based shell with command parsing, history navigation,
 * remote execution, and hardware/system inspection commands.
 */

class ShuttleApp {
    #container = null;
    #config = {};
    #commandRules = {};
    #input = null;
    #prompt = null;
    #prompt_text = '';
    #output = null;
    #history = [];
    #historyIndex = -1;
    #path = '/';
    #active_folder_id = 0;
    #parent_id = null;
    #uxManager = new window.CottonUXManager() || null;

     /**
      * Creates a new ShuttleApp instance.
      */
     constructor() {
        this.#config = Joomla.getOptions('com_shuttle') || {};
        this.#container = document.getElementById('shuttle_app');

        if (!this.#container) {
            console.error('COM_SHUTTLE_CONTAINER_NOT_FOUND');
            return;
        }

        this.#prompt_text = `${this.#config.userName}:${this.#path}§`;

        this.#init();
    }

     /**
      * Initializes the app: DOM, events, UX, welcome message, and command rules.
      * @private
      */
     async #init() {
        this.#buildDOM();
        this.#attachEvents();
        if (this.#config.ux) {
            this.#initUXManager();
        }
        this.#printWelcome();
        await this.#loadCommandRules();
    }

     /**
      * Builds the terminal DOM structure.
      * @private
      */
     #buildDOM() {
        this.#container.innerHTML = '';
        this.#container.className = 'cotton-container';


        const header = document.createElement('header');
        header.id = 'shuttle_header';
        header.className = 'cotton-header';
        const headerTitle = document.createElement('div');
        headerTitle.className = 'cotton-header-title';
        headerTitle.innerHTML = '<i class="icon-joomla fa-1x"></i><span>' + Joomla.Text._('COM_SHUTTLE_TERMINAL_TITLE') + '</span><span>[ ' + this.#config.userName + ' ]</span>';
        header.appendChild(headerTitle);

        const maximizeDiv = this.#config.ux ? document.createElement('div') : null;
        if (maximizeDiv) {
            maximizeDiv.id = 'shuttle_maximize';
            maximizeDiv.className = 'cotton-header-maximize';
            maximizeDiv.innerHTML = '<i class="icon-expand-2" title="' + Joomla.Text._('COM_SHUTTLE_MAXIMIZE') + '"></i>';
            header.appendChild(maximizeDiv);
        }

        this.#output = document.createElement('div');
        this.#output.className = 'shuttle-output';

        const body = document.createElement('section');
        body.className = 'shuttle-body';
        body.appendChild(this.#output);

        const footer = document.createElement('footer');
        footer.className = 'cotton-footer';
        footer.textContent = Joomla.Text._('COM_SHUTTLE_FOOTER_HINT');

        this.#container.appendChild(header);
        this.#container.appendChild(body);
        this.#container.appendChild(footer);

        this.#buildInputLine();
    }


     /**
      * Builds the input line with prompt and text input.
      * @private
      */
     #buildInputLine() {
        const existingInputLine = this.#container.querySelector('.shuttle-inputline');
        if (existingInputLine) {
            existingInputLine.remove();
        }

        const body = this.#container.querySelector('.shuttle-body');

        const inputline = document.createElement('div');
        inputline.className = 'shuttle-inputline';

        this.#prompt = document.createElement('span');
        this.#prompt.className = 'shuttle-prompt';
        this.#prompt.textContent = this.#prompt_text;

        this.#input = document.createElement('input');
        this.#input.type = 'text';
        this.#input.className = 'shuttle-input';
        this.#input.autocomplete = 'off';
        this.#input.spellcheck = false;
        this.#input.setAttribute('autofocus', '');

        inputline.appendChild(this.#prompt);
        inputline.appendChild(this.#input);
        body.appendChild(inputline);

        this.#attachInputEvents();
        this.#input.focus();
    }

     /**
      * Initializes UX behaviors when enabled.
      * @private
      */
     #initUXManager() {

        if (!this.#uxManager) {
            return;
        }

        const header = this.#container.querySelector('#shuttle_header');

        this.#uxManager.addDraggable({
            id: 'shuttle-header-drag',
            handle: header,
            target: this.#container,
            position: 'fixed'
        });

        this.#uxManager.addResizable({
            id: 'shuttle-container-resize',
            target: this.#container,
            edges: ['top', 'right', 'bottom', 'left'],
            minWidth: 320,
            minHeight: 240,
            position: 'fixed'
        });


    }

     /**
      * Attaches global container events.
      * @private
      */
     #attachEvents() {
        this.#attachOutputEvents();

        if (this.#config.ux) {
            this.#container.querySelector('#shuttle_maximize')?.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                this.#uxManager?.toggleMaximize(this.#container);
            });

            this.#container.querySelector('#shuttle_header')?.addEventListener('dblclick', event => {
                event.preventDefault();
                event.stopPropagation();
                this.#uxManager?.toggleMaximize(this.#container);
            });
        }
    }

     /**
      * Attaches output click-to-focus behavior.
      * @private
      */
     #attachOutputEvents() {
        this.#output.addEventListener('click', () => {
            if (this.#input) {
                this.#input.focus();
            }
        });
    }

     /**
      * Attaches keyboard handlers to the terminal input.
      * @private
      */
     #attachInputEvents() {
        this.#input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const command = this.#input.value.trim();
                if (!command) {
                    const emptyMsg = Joomla.Text._('COM_SHUTTLE_COMMAND_EMPTY');
                    this.#printLine(emptyMsg, 'error');
                    return;
                }
                this.#history.push(command);
                this.#historyIndex = this.#history.length;

                const promptSpan = document.createElement('span');
                promptSpan.className = 'shuttle-prompt';
                promptSpan.textContent = this.#prompt_text;
                
                const cmdSpan = document.createElement('span');
                cmdSpan.className = 'shuttle-terminal__line shuttle-terminal__line--command';
                cmdSpan.textContent = command;
                
                this.#output.appendChild(promptSpan);
                this.#output.appendChild(cmdSpan);
                this.#input.value = '';

                const parsed = this.#parseCommand(command);
                const validationError = this.#validateCommand(parsed);

                if (parsed.options.includes('-h') || parsed.options.includes('--help')) {
                    if (this.#commandRules[parsed.command]) {
                        this.#displayHelp(parsed.command);
                    } else {
                         this.#displayError(Joomla.Text._('COM_SHUTTLE_COMMAND_NOT_FOUND') + ' ' + parsed.command);
                    }
                    this.#scrollToBottom();
                    return;
                }

                if (validationError) {
                    this.#displayError(validationError);
                    this.#scrollToBottom();
                    return;
                }

                this.#executeCommand(parsed).catch(() => {
                    this.#displayError(Joomla.Text._('COM_SHUTTLE_ERROR_UNEXPECTED'));
                    this.#scrollToBottom();
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.#navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.#navigateHistory(1);
            } else if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                this.#printLine(Joomla.Text._('COM_SHUTTLE_CANCEL'), 'error');
                this.#input.value = '';
            } else if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                this.#cmdClear();
            }
        });
    }

     /**
      * Sends a parsed command to the backend for remote execution.
      * @param {Object} parsedCommand - Parsed command structure
      * @returns {Promise<Object|null>} Server result
      * @private
      */
     async #executeRemoteCommand(parsedCommand) {
        const commandString = [parsedCommand.command, ...parsedCommand.options, ...parsedCommand.parameters].join(' ').trim();
        if (!commandString) {
                    this.#displayError(Joomla.Text._('COM_SHUTTLE_COMMAND_EMPTY'));
                    return null;
                }

        const url = `${this.#config.siteUrl}index.php?option=com_shuttle&view=shuttle&task=shuttle.exec&format=json`;
        const form = new FormData();
        form.append(this.#config.token, 1);
        form.append('command', parsedCommand.command);
        parsedCommand.options.forEach(option => form.append('options[]', option));
        parsedCommand.parameters.forEach(parameter => form.append('parameters[]', parameter));
        form.append('cwd', this.#path);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: form,
            });

            if (!response.ok) {
                throw new Error(Joomla.Text._('COM_SHUTTLE_SERVER_RETURNED') + ': ' + response.status);
            }

            const result = await response.json();

            if (!result.success) {
                this.#displayError(Joomla.Text._('COM_SHUTTLE_REMOTE_ERROR') + ' ' + (result.message || Joomla.Text._('COM_SHUTTLE_UNKNOWN_ERROR')));
                return null;
            }

            if (result.data.command === 'cd' && typeof result.data.path === 'string') {
                this.#path = result.data.path;
                this.#prompt_text = `${this.#config.userName}:${this.#path}§`;

                this.#buildInputLine();

                if (result.data.id !== undefined && result.data.id !== null) {
                    this.#active_folder_id = result.data.id;
                }
                if (result.data.parent_id !== undefined) {
                    this.#parent_id = result.data.parent_id;
                }
            }

            this.#renderRemoteResult(result, parsedCommand);
            return result;
        } catch (error) {
            this.#displayError(Joomla.Text._('COM_SHUTTLE_SERVER_ERROR') + ': ' + error.message);
            return null;
        }
    }

     /**
      * Renders the remote command result into the terminal output.
      * @param {Object} result - Backend result
      * @param {Object} [parsedCommand] - Parsed command
      * @private
      */
     #renderRemoteResult(result, parsedCommand = null) {
        const command = parsedCommand?.command || result.command;
        const rawOutput = this.#commandShouldReturnRawJson(command, parsedCommand);

        if (result.data && this.#shouldRenderTable(command, result.data, rawOutput)) {
            this.#renderResultData(result.data, false, command);
            return;
        }

        if (result.data.output) {
            this.#renderRemoteOutput(result.data.output, rawOutput);
        }

        if (result.data && !this.#isSilentDataCommand(command)) {
            this.#renderResultData(result.data.data, rawOutput, command);
        }
    }

     /**
      * Renders raw or structured remote output.
      * @param {*} output - Output value
      * @param {boolean} rawOutput - Whether to render as raw JSON
      * @private
      */
     #renderRemoteOutput(output, rawOutput) {
        if (typeof output === 'string') {
            this.#printLine(output, 'output');
            return;
        }

        this.#printLine(JSON.stringify(output, null, 2), 'output');
    }

     /**
      * Renders result data as a table or formatted JSON.
      * @param {*} data - Result data
      * @param {boolean} rawOutput - Whether to render as raw JSON
      * @param {string} [command] - Command name
      * @private
      */
     #renderResultData(data, rawOutput, command = null) {
        if (rawOutput) {
            const obj = document.createElement('pre');
            obj.textContent = JSON.stringify(data, null, 2);
            this.#output.appendChild(obj);
            return;
        }

        if (Array.isArray(data)) {
            if (data.length > 0 && typeof data[0] === 'object') {
                this.#printTable(data);
            }
            return;
        }

        if (typeof data === 'object') {
            const obj = document.createElement('pre');
            obj.textContent = JSON.stringify(data, null, 2);
            this.#output.appendChild(obj);
        }
    }

     /**
      * Renders an array of objects as an HTML table.
      * @param {Array} items - Array of objects
      * @private
      */
     #printTable(items) {
        const table = document.createElement('table');
        table.className = 'shuttle-terminal__table';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        const columns = Array.from(items.reduce((cols, item) => {
            Object.keys(item).forEach(key => cols.add(key));
            return cols;
        }, new Set()));

        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = this.#humanizeHeader(col);
            headerRow.appendChild(th);
        });

        const tbody = table.createTBody();
        items.forEach(item => {
            const row = tbody.insertRow();
            columns.forEach(col => {
                const cell = row.insertCell();
                const value = item[col];
                cell.textContent = value !== undefined && value !== null ? String(value) : '';
            });
        });

        this.#output.appendChild(table);
    }

     /**
      * Converts a camelCase or snake_case key to a human-readable header.
      * @param {string} key - Property name
      * @returns {string} Humanized header
      * @private
      */
     #humanizeHeader(key) {
        return key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase())
            .replace(/Id\b/, 'ID');
    }

     /**
      * Determines whether a command should return raw JSON output.
      * @param {string} command - Command name
      * @param {Object} [parsedCommand] - Parsed command
      * @returns {boolean}
      * @private
      */
     #commandShouldReturnRawJson(command, parsedCommand) {
        const rawJsonCommands = new Set(['cc-resolve']);
        if (!command) {
            return false;
        }

        const options = parsedCommand?.options || [];
        if (options.includes('--json') || options.includes('-j')) {
            return true;
        }

        return rawJsonCommands.has(command);
    }

     /**
      * Determines whether result data should be rendered as a table.
      * @param {string} command - Command name
      * @param {*} data - Result data
      * @param {boolean} rawOutput - Whether raw JSON output is requested
      * @returns {boolean}
      * @private
      */
     #shouldRenderTable(command, data, rawOutput) {
        if (rawOutput) {
            return false;
        }

        const tableCommands = new Set(['find', 'grep', 'joomla', 'ls']);
        return tableCommands.has(command) && Array.isArray(data) && data.length > 0 && typeof data[0] === 'object';
    }

     /**
      * Determines whether a command should suppress data rendering.
      * @param {string} command - Command name
      * @returns {boolean}
      * @private
      */
     #isSilentDataCommand(command) {
        const silentCommands = new Set(['cd', 'mkdir', 'rmdir', 'mv', 'cp', 'cotton-create', 'cotton-save', 'cotton-delete']);
        return silentCommands.has(command);
    }

     /**
      * Escapes HTML special characters for safe output.
      * @param {string} value - Input text
      * @returns {string} Escaped text
      * @private
      */
     #escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

     /**
      * Prints the welcome banner to the terminal.
      * @private
      */
     #printWelcome() {
        const art = [
            '░█▀▀░█▀█░▀█▀░▀█▀░█▀█░█▀█░░░█▀▀░█░░░█▀█░█░█░█▀▄',
            '░█░░░█░█░░█░░░█░░█░█░█░█░░░█░░░█░░░█░█░█░█░█░█',
            '░▀▀▀░▀▀▀░░▀░░░▀░░▀▀▀░▀░▀░░░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀▀░',
            '',
            Joomla.Text._('COM_SHUTTLE_WELCOME_TITLE'),
            Joomla.Text._('COM_SHUTTLE_WELCOME_HINT'),
            ''
        ];
        art.forEach(line => this.#printLine(line, 'info'));
    }

     /**
      * Loads command rules from CommandRules.json.
      * @private
      */
     async #loadCommandRules() {
        const url = `${this.#config.siteUrl}media/com_shuttle/js/CommandRules.json`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to load command rules.');
            }
            this.#commandRules = await response.json();
        } catch (error) {
            console.error('Command rules load error:', error);
        }
    }

     /**
      * Parses a command string into command, options, and parameters.
      * @param {string} commandString - Raw command input
      * @returns {Object} Parsed command structure
      * @private
      */
     #parseCommand(commandString) {
        const tokens = [];
        let current = '';
        let quote = null;

        for (let i = 0; i < commandString.length; i++) {
            const char = commandString[i];

            if (quote) {
                if (char === quote) {
                    quote = null;
                    continue;
                }

                if (char === '\\' && i + 1 < commandString.length) {
                    i += 1;
                    current += commandString[i];
                    continue;
                }

                current += char;
                continue;
            }

            if (char === '"' || char === "'") {
                quote = char;
                continue;
            }

            if (char === ' ' || char === '\t') {
                if (current !== '') {
                    tokens.push(current);
                    current = '';
                }
                continue;
            }

            current += char;
        }

        if (current !== '') {
            tokens.push(current);
        }

        const command = tokens.shift() || '';
        const options = [];
        const parameters = [];

        tokens.forEach(token => {
            if (token.startsWith('--')) {
                options.push(token);
            } else if (token.startsWith('-') && token.length > 2 && token.includes('=')) {
                options.push(token);
            } else if (token.startsWith('-') && token.length > 2 && !token.startsWith('--')) {
                token.substring(1).split('').forEach(flag => options.push(`-${flag}`));
            } else if (token.startsWith('-')) {
                options.push(token);
            } else {
                parameters.push(token);
            }
        });

        return { command, options, parameters };
    }

     /**
      * Validates a parsed command against loaded command rules.
      * @param {Object} parsedCommand - Parsed command structure
      * @returns {string|null} Validation error or null
      * @private
      */
     #validateCommand(parsedCommand) {
        const { command, options, parameters } = parsedCommand;

        if (!this.#commandRules[command]) {
                    return Joomla.Text._('COM_SHUTTLE_COMMAND_NOT_FOUND_VALIDATE') + ' ' + command;
                }

        const rule = this.#commandRules[command];
        const validOptions = rule.options.map(opt => opt.name);
        const validAliases = rule.options.map(opt => opt.alias).filter(Boolean);
        const allValidOptions = [...validOptions, ...validAliases];

        const invalidOptions = options.filter(opt => !allValidOptions.includes(opt));
        if (invalidOptions.length > 0) {
            return Joomla.Text._('COM_SHUTTLE_COMMAND_INVALID_OPTION') + ' ' + invalidOptions[0] + ' - ' + command;
        }

        if (parameters.length < rule.parameters.min) {
                        return Joomla.Text._('COM_SHUTTLE_COMMAND_PARAM_MIN') + ' ' + command + ' ' + rule.parameters.min + ' parameter(s)';
        }
        if (parameters.length > rule.parameters.max) {
            return Joomla.Text._('COM_SHUTTLE_COMMAND_PARAM_MAX') + ' ' + command + ' ' + rule.parameters.max + ' parameter(s)';
        }

        return null;
    }

     /**
      * Executes a validated parsed command.
      * @param {Object} parsedCommand - Parsed command structure
      * @private
      */
     async #executeCommand(parsedCommand) {
        const { command, options, parameters } = parsedCommand;

        switch (command) {
            case 'help':
                this.#displayHelp(parameters[0] || null);
                break;

            case 'clear':
                this.#cmdClear();
                break;

            case 'find':
            case 'grep':
            case 'cc-resolve':
            case 'cat':
            case 'head':
            case 'tail':
            case 'mkdir':
            case 'rmdir':
            case 'sed':
            case 'mv':
            case 'cp':
            case 'run':
            case 'joomla':
            case 'ai':
                await this.#executeRemoteCommand(parsedCommand);
                break;

            case 'ls':
                await this.#executeLs(parsedCommand);
                break;

            case 'lsmedia':
                this.#cmdLsMedia();
                break;

            case 'nav':
                this.#cmdNav();
                break;

            case 'lsusb':
                this.#cmdLsUsb(options);
                break;

            case 'lsgamepad':
                this.#cmdLsGamepad();
                break;

            case 'lsgpu':
                this.#cmdLsGpu();
                break;

            case 'geo':
                this.#cmdGeo();
                break;

            case 'connection':
                this.#cmdConnection();
                break;

            case 'ip':
                this.#cmdIp();
                break;

            case 'memory':
                this.#cmdMemory();
                break;

            case 'storage':
                this.#cmdStorage();
                break;

            case 'cd':
            case 'cotton-create':
            case 'cotton-save':
            case 'cotton-delete':
            case 'weaver-set-content':
            case 'weaver:tabs':
            case 'weaver:active':
            case 'weaver:open':
            case 'weaver:create-file':
            case 'weaver:create-folder':
            case 'weaver:save':
            case 'weaver:edit':
            case 'weaver:root':
                await this.#executeRemoteCommand(parsedCommand);
                break;

            default:
                if (this.#commandRules[command]) {
                        this.#displayError(Joomla.Text._('COM_SHUTTLE_COMMAND_NOT_FOUND') + ' ' + command);
                } else {
                    this.#displayError(Joomla.Text._('COM_SHUTTLE_COMMAND_NOT_FOUND_VALIDATE') + '- ' + command);
                }
                break;
        }

        this.#scrollToBottom();
    }

     /**
      * Executes the `ls` command, defaulting to the active folder when no target is given.
      * @param {Object} parsedCommand - Parsed command structure
      * @private
      */
     async #executeLs(parsedCommand) {
        const hasTarget = parsedCommand.parameters.length > 0
            || parsedCommand.options.includes('-i')
            || parsedCommand.options.includes('--id');

        if (!hasTarget) {
            parsedCommand.options.push('-i');
            parsedCommand.parameters.push(String(this.#active_folder_id));
        }

        await this.#executeRemoteCommand(parsedCommand);
    }

     /**
      * Lists available media input/output devices.
      * @private
      */
     #cmdLsMedia() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            this.#displayError(Joomla.Text._('COM_SHUTTLE_API_MEDIA_NOT_SUPPORTED'));
            return;
        }

        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                let text = '';
                if (devices.length === 0) {
                    text = Joomla.Text._('COM_SHUTTLE_NO_MEDIA_DEVICES');
                } else {
                    devices.forEach((device, index) => {
                        text += `Device ${index + 1}:\n`;
                        text += Joomla.Text._('COM_SHUTTLE_MEDIA_TYPE') + ` ${device.kind}\n`;
                        text += Joomla.Text._('COM_SHUTTLE_MEDIA_ID') + ` ${device.deviceId}\n`;
                        text += Joomla.Text._('COM_SHUTTLE_MEDIA_NAME') + ` ${device.label || 'Unavailable'}\n\n`;
                    });
                }
                this.#printLine(text, 'output');
            })
            .catch(err => {
                this.#displayError(Joomla.Text._('COM_SHUTTLE_ERROR_LISTING_MEDIA') + '- ' + err.name);
            });
    }

     /**
      * Prints browser and navigation information.
      * @private
      */
     #cmdNav() {
        const text = [
            Joomla.Text._('COM_SHUTTLE_NAV_BROWSER_INFO'),
            '',
            Joomla.Text._('COM_SHUTTLE_NAV_BROWSER_NAME') + ` ${navigator.appName}`,
            Joomla.Text._('COM_SHUTTLE_NAV_BROWSER_VERSION') + ` ${navigator.appVersion}`,
            `User Agent: ${navigator.userAgent}`,
            Joomla.Text._('COM_SHUTTLE_NAV_PLATFORM') + ` ${navigator.platform}`,
            Joomla.Text._('COM_SHUTTLE_NAV_LANGUAGE') + ` ${navigator.language}`,
            Joomla.Text._('COM_SHUTTLE_NAV_PREFERRED_LANGUAGES') + ` ${navigator.languages.join(', ')}`,
            Joomla.Text._('COM_SHUTTLE_NAV_ONLINE') + ` ${navigator.onLine ? 'Yes' : 'No'}`,
            Joomla.Text._('COM_SHUTTLE_NAV_CPU_CORES') + ` ${navigator.hardwareConcurrency || 'Unavailable'}`,
            Joomla.Text._('COM_SHUTTLE_NAV_DEVICE_MEMORY') + ` ${navigator.deviceMemory || 'Unavailable'}`,
        ].join('\n');
        this.#printLine(text, 'output');
    }

     /**
      * Lists USB devices or requests device selection.
      * @param {string[]} options - Parsed command options
      * @private
      */
     #cmdLsUsb(options) {
        const connect = options.includes('c') || options.includes('--connect');

        if (!navigator.usb) {
            this.#displayError(Joomla.Text._('COM_SHUTTLE_API_USB_NOT_SUPPORTED'));
            return;
        }

        if (connect) {
            navigator.usb.requestDevice({ filters: [] })
                .then(device => {
                    this.#printLine(Joomla.Text._('COM_SHUTTLE_USB_SELECTED') + ': ' + device.productName);
                })
                .catch(err => {
                    this.#displayError(Joomla.Text._('COM_SHUTTLE_ERROR_USB_CONNECT') + ': ' + err.name);
                });
        } else {
            navigator.usb.getDevices()
                .then(devices => {
                    let text = '';
                    if (devices.length === 0) {
                        text = Joomla.Text._('COM_SHUTTLE_NO_USB_DEVICES');
                    } else {
                        devices.forEach((device, index) => {
                            text += `Device ${index + 1}:\n`;
                            text += Joomla.Text._('COM_SHUTTLE_USB_NAME') + ` ${device.productName || 'Unavailable'}\n`;
                            text += Joomla.Text._('COM_SHUTTLE_USB_MANUFACTURER') + ` ${device.manufacturerName || 'Unavailable'}\n`;
                            text += Joomla.Text._('COM_SHUTTLE_USB_PRODUCT_ID') + ` ${device.productId}\n`;
                            text += Joomla.Text._('COM_SHUTTLE_USB_VENDOR_ID') + ` ${device.vendorId}\n\n`;
                        });
                    }
                    text += Joomla.Text._('COM_SHUTTLE_USB_CONNECT_HINT');
                    this.#printLine(text, 'output');
                })
                .catch(err => {
                    this.#displayError(Joomla.Text._('COM_SHUTTLE_ERROR_LISTING_USB') + ': ' + err.name);
                });
        }
    }

     /**
      * Lists connected gamepads.
      * @private
      */
     #cmdLsGamepad() {
        if (!navigator.getGamepads) {
            this.#displayError(Joomla.Text._('COM_SHUTTLE_API_GAMEPAD_NOT_SUPPORTED'));
            return;
        }

        const gamepads = navigator.getGamepads();
        let text = '';
        if (!gamepads.length || !gamepads[0]) {
            text = Joomla.Text._('COM_SHUTTLE_NO_GAMEPAD');
        } else {
            for (let i = 0; i < gamepads.length; i++) {
                const gp = gamepads[i];
                if (gp) {
                    text += `Gamepad ${i + 1}:\n`;
                    text += Joomla.Text._('COM_SHUTTLE_GAMEPAD_NAME') + ` ${gp.id}\n`;
                    text += Joomla.Text._('COM_SHUTTLE_GAMEPAD_INDEX') + ` ${gp.index}\n`;
                    text += Joomla.Text._('COM_SHUTTLE_GAMEPAD_BUTTONS') + ` ${gp.buttons.length}\n`;
                    text += Joomla.Text._('COM_SHUTTLE_GAMEPAD_AXES') + ` ${gp.axes.length}\n\n`;
                }
            }
        }
        this.#printLine(text, 'output');
    }

     /**
      * Lists GPU adapter information via WebGPU.
      * @private
      */
     async #cmdLsGpu() {
        if (!navigator.gpu) {
            this.#displayError(Joomla.Text._('COM_SHUTTLE_API_GPU_NOT_SUPPORTED'));
            return;
        }

        let text = '';

        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
                text = [
                    Joomla.Text._('COM_SHUTTLE_GPU_INFO'),
                    '',
                    Joomla.Text._('COM_SHUTTLE_GPU_NAME') + ` ${adapter.name || 'Unavailable'}`,
                    Joomla.Text._('COM_SHUTTLE_GPU_PLATFORM') + ` ${adapter.platform || 'Unavailable'}`,
                    Joomla.Text._('COM_SHUTTLE_GPU_LIMITS') + ` ${adapter.limits ? JSON.stringify(adapter.limits) : 'Unavailable'}`,
                    Joomla.Text._('COM_SHUTTLE_GPU_FEATURES') + ` ${adapter.features ? Array.from(adapter.features).join(', ') : 'Unavailable'}`,
                ].join('\n');
            } else {
                text = Joomla.Text._('COM_SHUTTLE_NO_GPU_ADAPTER');
            }
        } catch (err) {
            text = Joomla.Text._('COM_SHUTTLE_ERROR_GPU_INFO') + ': ' + err.message;
        }

        this.#printLine(text, 'output');
    }

     /**
      * Prints geolocation information.
      * @private
      */
     #cmdGeo() {
        if (!navigator.geolocation) {
            this.#displayError(Joomla.Text._('COM_SHUTTLE_API_GEO_NOT_SUPPORTED'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                const text = [
                    Joomla.Text._('COM_SHUTTLE_GEO_INFO'),
                    '',
                    Joomla.Text._('COM_SHUTTLE_GEO_LATITUDE') + `: ${position.coords.latitude}`,
                    Joomla.Text._('COM_SHUTTLE_GEO_LONGITUDE') + `: ${position.coords.longitude}`,
                    Joomla.Text._('COM_SHUTTLE_GEO_ALTITUDE') + `: ${position.coords.altitude || 'Unavailable'}`,
                    Joomla.Text._('COM_SHUTTLE_GEO_ALTITUDE_ACC') + `: ${position.coords.altitudeAccuracy || 'Unavailable'}`,
                    Joomla.Text._('COM_SHUTTLE_GEO_HEADING') + `: ${position.coords.heading || 'Unavailable'}`,
                    Joomla.Text._('COM_SHUTTLE_GEO_SPEED') + `: ${position.coords.speed || 'Unavailable'}`,
                ].join('\n');
                this.#printLine(text, 'output');
            },
            error => {
                this.#displayError(Joomla.Text._('COM_SHUTTLE_ERROR_GEO') + ': ' + error.message);
            }
        );
    }

     /**
      * Prints network connection information.
      * @private
      */
     #cmdConnection() {
        if (!navigator.connection) {
            this.#displayError(Joomla.Text._('COM_SHUTTLE_API_NETWORK_NOT_SUPPORTED'));
            return;
        }

        const connection = navigator.connection;
        const text = [
            Joomla.Text._('COM_SHUTTLE_CONNECTION_TYPE') + ` ${connection.effectiveType}`,
            Joomla.Text._('COM_SHUTTLE_CONNECTION_BANDWIDTH') + ` ${connection.downlink} Mbps`,
            Joomla.Text._('COM_SHUTTLE_CONNECTION_LATENCY') + ` ${connection.rtt} ms`,
            Joomla.Text._('COM_SHUTTLE_CONNECTION_SAVER') + ` ${connection.saveData ? 'Yes' : 'No'}`,
            Joomla.Text._('COM_SHUTTLE_CONNECTION_NETWORK_TYPE') + ` ${connection.type}`,
        ].join('\n');
        this.#printLine(text, 'output');
    }

     /**
      * Prints the public IP address.
      * @private
      */
     #cmdIp() {
        fetch('https://api.ipify.org?format=json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(Joomla.Text._('COM_SHUTTLE_REQUEST_FAILED'));
                }
                return response.json();
            })
            .then(data => {
                this.#printLine(Joomla.Text._('COM_SHUTTLE_IP_ADDRESS') + ': ' + data.ip);
            })
            .catch(error => {
                this.#displayError(Joomla.Text._('COM_SHUTTLE_ERROR_IP') + ': ' + error.message);
            });
    }

     /**
      * Prints device memory information.
      * @private
      */
     #cmdMemory() {
        if (navigator.deviceMemory) {
            this.#printLine(Joomla.Text._('COM_SHUTTLE_MEMORY_INFO') + ': ' + navigator.deviceMemory);
        } else {
            this.#displayError(Joomla.Text._('COM_SHUTTLE_API_MEMORY_NOT_SUPPORTED'));
        }
    }

     /**
      * Prints storage usage and quota information.
      * @private
      */
     #cmdStorage() {
        if (!navigator.storage || !navigator.storage.estimate) {
            this.#displayError(Joomla.Text._('COM_SHUTTLE_API_STORAGE_NOT_SUPPORTED'));
            return;
        }

        navigator.storage.estimate().then(estimate => {
            const used = estimate.usage ? this.#formatFileSize(estimate.usage) : 'Unavailable';
            const quota = estimate.quota ? this.#formatFileSize(estimate.quota) : 'Unavailable';
            const text = Joomla.Text._('COM_SHUTTLE_STORAGE_USAGE') + ` ${used}\n` + Joomla.Text._('COM_SHUTTLE_STORAGE_QUOTA') + ` ${quota}`;
            this.#printLine(text, 'output');
        }).catch(() => {
            this.#displayError(Joomla.Text._('COM_SHUTTLE_ERROR_STORAGE'));
        });
    }

     /**
      * Fetches the folder list from Cotton.
      * @param {number} folderId - Folder ID
      * @returns {Promise<Array>} Folder list
      * @private
      */
     async #fetchFolderList(folderId) {
        const url = `${this.#config.siteUrl}index.php?option=com_cotton&view=cotton&task=cotton.items_load&format=json`;
        const form = new FormData();
        form.append(this.#config.token, 1);
        form.append('folder_id', folderId);

        const response = await fetch(url, { method: 'POST', body: form });
        if (!response.ok) {
            throw new Error(Joomla.Text._('COM_SHUTTLE_REQUEST_FAILED'));
        }
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        return data.data.list || [];
    }

     /**
      * Normalizes a path string into segments and resolves `.` and `..`.
      * @param {string} rawPath - Raw path input
      * @returns {Object} Normalized path result
      * @private
      */
     #normalizePath(rawPath) {
        if (typeof rawPath !== 'string') {
            return { error: 'Invalid path.' };
        }

        let path = rawPath.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
        const isAbsolute = path.startsWith('/');

        if (path === '' || path === '.') {
            return { path: '.', isAbsolute };
        }
        if (path === '/') {
            return { path: '/', isAbsolute: true };
        }

        if (isAbsolute) {
            path = path.slice(1);
        }

        const segments = [];
        if (!isAbsolute) {
            if (this.#path && this.#path !== '/') {
                this.#path.split('/').filter(Boolean).forEach(seg => segments.push(seg));
            }
        }

        for (const part of path.split('/')) {
            if (part === '' || part === '.') {
                continue;
            }
            if (part === '..') {
                if (segments.length === 0) {
                    return { path: '/', isAbsolute: true };
                }
                segments.pop();
                continue;
            }
            segments.push(part);
        }

        return { path: segments.length ? segments.join('/') : '/', isAbsolute };
    }

     /**
      * Displays help text for a command or all commands.
      * @param {string} [commandName] - Command name
      * @private
      */
     #displayHelp(commandName) {
        let helpText = '';

        if (commandName && this.#commandRules[commandName]) {
            const rule = this.#commandRules[commandName];
            helpText += Joomla.Text._('COM_SHUTTLE_HELP_COMMAND_HEADER') + '- ' + commandName + ': ' + rule.description;
            helpText += '\n';

            if (rule.options.length > 0) {
                helpText += Joomla.Text._('COM_SHUTTLE_HELP_OPTIONS');
                helpText += '\n';

                for (let i = 0; i < rule.options.length; i++) {
                    const opt = rule.options[i];
                    helpText += opt.name + ' (' + opt.alias + '): ' + opt.description;
                    helpText += '\n';
                }
            }

            helpText += Joomla.Text._('COM_SHUTTLE_HELP_PARAMETERS') + Joomla.Text._('COM_SHUTTLE_REQUIRES_MIN') + ': ' + rule.parameters.min + '\n' + Joomla.Text._('COM_SHUTTLE_ACCEPTS_MAX') + ': ' +  rule.parameters.max + '\n' + rule.parameters.description;
            helpText += '\n';
        } else {
            helpText += Joomla.Text._('COM_SHUTTLE_HELP_AVAILABLE_HEADER');
            helpText += '\n';

            for (const cmd in this.#commandRules) {
                helpText += '  ' + cmd + ': ' + this.#commandRules[cmd].description + '\n';
            }

            helpText += Joomla.Text._('COM_SHUTTLE_HELP_USE_HELP');
            helpText += '\n';
        }

        this.#printLine(helpText, 'info');
    }

     /**
      * Prints a line to the terminal output.
      * @param {string} text - Text to print
      * @param {string} [type='output'] - Line type
      * @param {Object} [options] - Print options
      * @param {boolean} [options.html=false] - Whether text is HTML
      * @private
      */
     #printLine(text, type = 'output', { html = false } = {}) {
        const line = document.createElement('div');
        line.className = `shuttle-terminal__line shuttle-terminal__line--${type}`;

        if (html) {
            line.innerHTML = text;
        } else if (typeof text === 'string' && text.includes('\n')) {
            const pre = document.createElement('pre');
            pre.textContent = text;
            line.appendChild(pre);
        } else {
            line.textContent = text;
        }

        this.#output.appendChild(line);
        this.#scrollToBottom();
    }

     /**
      * Prints an error line to the terminal output.
      * @param {string} text - Error text
      * @private
      */
     #displayError(text) {
        this.#printLine(text, 'error');
    }

     /**
      * Scrolls the terminal output to the bottom.
      * @private
      */
     #scrollToBottom() {
        this.#output.scrollTop = this.#output.scrollHeight;
    }

     /**
      * Validates a folder name.
      * @param {string} name - Folder name
      * @returns {boolean}
      * @private
      */
     #isValidFolderName(name) {
        return /^[a-zA-Z0-9_-]+$/.test(name);
    }

     /**
      * Formats a byte count into a human-readable size string.
      * @param {number} bytes - Size in bytes
      * @returns {string} Formatted size
      * @private
      */
     #formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

     /**
      * Clears the terminal output and reprints the welcome banner.
      * @private
      */
     #cmdClear() {
        this.#output.innerHTML = '';
        this.#printWelcome();
    }

     /**
      * Navigates the command history by direction.
      * @param {number} direction - History direction (-1 or 1)
      * @private
      */
     #navigateHistory(direction) {
        if (this.#history.length === 0) {
            this.#input.value = '';
            return;
        }

        this.#historyIndex += direction;

        if (this.#historyIndex < -1) {
            this.#historyIndex = -1;
        } else if (this.#historyIndex >= this.#history.length) {
            this.#historyIndex = this.#history.length;
        }

        if (this.#historyIndex >= 0 && this.#historyIndex < this.#history.length) {
            this.#input.value = this.#history[this.#historyIndex];
        } else {
            this.#input.value = '';
        }
    }

}

document.addEventListener('DOMContentLoaded', () => {
    const app = new ShuttleApp();
});
