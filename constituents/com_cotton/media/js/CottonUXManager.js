/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

/**
 * CottonUXManager - UX enhancements for Cotton
 * Adds dragging, resizing, drop-upload, and maximize/restore behavior.
 */
export class CottonUXManager {
    #options = {};
    #draggables = new Map();
    #resizables = new Map();
    #dropUploads = new Map();
    #maximized = false;
    #maximizeState = null;
    #maximizeTrigger = null;
    #maximizeResizeHandler = null;
    #maximizeHandler = null;
    #nextDraggableId = 1;
    #nextResizableId = 1;
    #nextDropUploadId = 1;
    #manager = null;

     /**
      * Creates a new UX manager instance.
      * @param {CottonUIManager|null} manager - Parent UI manager
      * @param {Object} [options={}] - Default options
      */
     constructor(manager = null, options = {}) {
         this.#manager = manager;
         this.#options = {
             ...options
         };
     }

     /**
      * Initializes the manager.
      * @returns {CottonUXManager}
      */
     initialize() {
         return this;
     }

     /**
      * Adds a draggable behavior to an element.
      * @param {Object} options
      * @param {string|HTMLElement} [options.handle] - Drag handle element or selector
      * @param {string|HTMLElement} [options.target] - Target element to drag or selector
      * @param {string} [options.position='fixed'] - CSS positioning mode
      * @param {string} [options.dragClass] - CSS class applied while dragging
      * @param {string} [options.ignoreSelector] - Selector for ignored child elements
      * @param {string} [options.root] - Root element for selector resolution
      * @returns {string|null} Draggable ID
      */
     addDraggable(options = {}) {
        return this.#addDraggable(options);
    }

     /**
      * Removes a draggable behavior by ID.
      * @param {string} id
      * @returns {CottonUXManager}
      */
     removeDraggable(id) {
        const state = this.#draggables.get(id);

        if (!state) {
            return this;
        }

        state.handle.removeEventListener('mousedown', state.handlers.start);
        state.handle.removeEventListener('touchstart', state.handlers.start);

        document.removeEventListener('mousemove', state.handlers.move);
        document.removeEventListener('mouseup', state.handlers.up);
        document.removeEventListener('touchmove', state.handlers.touchMove);
        document.removeEventListener('touchend', state.handlers.touchEnd);
        document.removeEventListener('touchcancel', state.handlers.touchEnd);

        state.target.classList.remove(state.config.dragClass);

        this.#draggables.delete(id);

        return this;
    }

     /**
      * Adds a resizable behavior to an element.
      * @param {Object} options
      * @param {string|HTMLElement} [options.target] - Target element or selector
      * @param {string[]} [options.edges=['right']] - Resizable edges: 'top', 'right', 'bottom', 'left'
      * @param {number} [options.minWidth=160] - Minimum width in px
      * @param {number} [options.maxWidth] - Maximum width in px
      * @param {number} [options.minHeight=80] - Minimum height in px
      * @param {number} [options.maxHeight] - Maximum height in px
      * @param {number} [options.handleSize=8] - Handle size in px
      * @param {string} [options.handleSide] - Handle side alignment
      * @param {string} [options.position] - CSS positioning mode
      * @param {string} [options.resizeClass] - CSS class applied while resizing
      * @param {string} [options.root] - Root element for selector resolution
      * @returns {string|null} Resizable ID
      */
     addResizable(options = {}) {
        return this.#addResizable(options);
    }

     /**
      * Removes a resizable behavior by ID.
      * @param {string} id
      * @returns {CottonUXManager}
      */
     removeResizable(id) {
        const state = this.#resizables.get(id);

        if (!state) {
            return this;
        }

        state.target.classList.remove(state.config.resizeClass);

        state.handles.forEach(handleState => {
            handleState.handle.removeEventListener('mousedown', handleState.handlers.start);
            handleState.handle.removeEventListener('touchstart', handleState.handlers.start);
            handleState.handle.remove();
        });

        this.#resizables.delete(id);

        return this;
    }

     /**
      * Adds drag-and-drop file upload behavior to a zone.
      * @param {Object} options
      * @param {string|HTMLElement} [options.dropZone] - Drop zone element or selector
      * @param {CottonUIManager} [options.manager] - UI manager instance
      * @param {boolean} [options.autoSubmit=true] - Auto-submit after drop
      * @param {string} [options.dropActiveClass] - CSS class for active drop state
      * @param {string} [options.root] - Root element for selector resolution
      * @returns {string|null} Drop upload ID
      */
     addDropUpload(options = {}) {
        return this.#addDropUpload(options);
    }

     /**
      * Removes a drop-upload behavior by ID.
      * @param {string} id
      * @returns {CottonUXManager}
      */
     removeDropUpload(id) {
        const state = this.#dropUploads.get(id);

        if (!state) {
            return this;
        }

        state.dropZone.removeEventListener('dragenter', state.handlers.dragEnter);
        state.dropZone.removeEventListener('dragover', state.handlers.dragOver);
        state.dropZone.removeEventListener('dragleave', state.handlers.dragLeave);
        state.dropZone.removeEventListener('drop', state.handlers.drop);

        this.#setDropActive(state, false);

        this.#dropUploads.delete(id);

        return this;
    }

     /**
      * Enables header dragging using the configured header selector.
      * @returns {CottonUXManager}
      */
     enableHeaderDrag() {
        return this.addDraggable({
            handle: this.#options.headerSelector || null,
            target: this.#options.container || null,
            position: 'fixed'
        });
    }

     /**
      * Enables tree resizing from the right edge.
      * @returns {CottonUXManager}
      */
     enableTreeResize() {
        return this.addResizable({
            target: this.#options.target || null,
            edges: ['right']
        });
    }

     /**
      * Enables drag-and-drop upload on the configured drop zone.
      * @returns {CottonUXManager}
      */
     enableDropUpload() {
        return this.addDropUpload({
            dropZone: this.#options.dropZone || null
        });
    }

     /**
      * Maximizes the target element to fill the viewport.
      * @param {string|HTMLElement} [container] - Element or selector to maximize
      * @param {Object} [options] - Optional overrides
      * @returns {CottonUXManager}
      */
     maximize(container = null, options = {}) {
        const target = this.#resolveElement(container || this.#options.container, this.#options.root || document);

        if (!target || this.#maximized) {
            return this;
        }

        const styleNames = [
            'position',
            'left',
            'top',
            'width',
            'height',
            'right',
            'bottom',
            'transform',
            'minWidth',
            'maxWidth',
            'minHeight',
            'maxHeight',
            'zIndex'
        ];
        const previousStyles = {};

        styleNames.forEach(name => {
            previousStyles[name] = target.style[name];
        });

        this.#maximizeState = {
            target,
            previousStyles
        };

        this.#maximized = true;
        target.classList.add(this.#options.maximizeClass || 'cotton-maximized');
        this.#applyMaximizeStyles(target);

        this.#maximizeResizeHandler = () => this.#applyMaximizeStyles(target);
        window.addEventListener('resize', this.#maximizeResizeHandler);

        this.#notify('success', 'Cotton maximized');

        return this;
    }

     /**
      * Restores a previously maximized element.
      * @param {string|HTMLElement} [container] - Element or selector to restore
      * @returns {CottonUXManager}
      */
     restore(container = null) {
        const target = this.#resolveElement(container || this.#options.container, this.#options.root || document);

        if (!target || !this.#maximized || !this.#maximizeState || this.#maximizeState.target !== target) {
            return this;
        }

        Object.entries(this.#maximizeState.previousStyles).forEach(([name, value]) => {
            if (value) {
                target.style[name] = value;
            } else {
                target.style.removeProperty(this.#camelToKebab(name));
            }
        });

        target.classList.remove(this.#options.maximizeClass || 'cotton-maximized');

        if (this.#maximizeResizeHandler) {
            window.removeEventListener('resize', this.#maximizeResizeHandler);
        }

        this.#maximizeState = null;
        this.#maximized = false;
        this.#updateAllMaximizeIcons();

        this.#notify('success', 'Cotton restored');

        return this;
    }

     /**
      * Toggles maximize/restore for the target element.
      * @param {string|HTMLElement} [container] - Element or selector
      * @returns {CottonUXManager}
      */
     toggleMaximize(container = null) {
        if (this.#maximized) {
            return this.restore(container);
        }

        return this.maximize(container);
    }

     /**
      * Returns whether the target is currently maximized.
      * @returns {boolean}
      */
     isMaximized() {
        return this.#maximized;
    }

     /**
      * Destroys header maximize bindings and restores state if needed.
      * @returns {CottonUXManager}
      */
     destroyHeaderMaximize() {
        if (this.#maximizeTrigger && this.#maximizeHandler) {
            this.#maximizeTrigger.removeEventListener('click', this.#maximizeHandler);
        }

        this.#maximizeTrigger = null;
        this.#maximizeHandler = null;

        if (this.#maximized && this.#maximizeState) {
            this.restore(this.#maximizeState.target);
        }

        return this;
    }

     /**
      * Destroys all UX behaviors and cleans up listeners.
      * @returns {CottonUXManager}
      */
     destroy() {
        this.destroyHeaderMaximize();
        Array.from(this.#draggables.keys()).forEach(id => this.removeDraggable(id));
        Array.from(this.#resizables.keys()).forEach(id => this.removeResizable(id));
        Array.from(this.#dropUploads.keys()).forEach(id => this.removeDropUpload(id));

        return this;
    }

     /**
      * Registers a new draggable behavior.
      * @param {Object} options
      * @param {string|HTMLElement} [options.handle] - Drag handle element or selector
      * @param {string|HTMLElement} [options.target] - Target element to drag or selector
      * @param {string} [options.position='fixed'] - CSS positioning mode
      * @param {string} [options.dragClass] - CSS class applied while dragging
      * @param {string} [options.ignoreSelector] - Selector for ignored child elements
      * @param {string} [options.root] - Root element for selector resolution
      * @returns {string|null} Draggable ID
      * @private
      */
     #addDraggable(options) {
         const config = this.#normalizeDraggableOptions(options);

        if (this.#draggables.has(config.id)) {
            this.removeDraggable(config.id);
        }

        const handle = this.#resolveElement(config.handle, config.root);
        const target = this.#resolveElement(config.target, config.root) || handle;

        if (!handle || !target) {
            return null;
        }

        const state = {
            id: config.id,
            config,
            handle,
            target,
            dragging: false,
            handlers: {}
        };

        state.handlers.start = event => this.#startDraggable(state, event);
        state.handlers.move = event => this.#moveDraggable(state, event);
        state.handlers.up = () => this.#endDraggable(state);
        state.handlers.touchMove = event => this.#moveDraggable(state, event);
        state.handlers.touchEnd = () => this.#endDraggable(state);

        handle.addEventListener('mousedown', state.handlers.start);
        handle.addEventListener('touchstart', state.handlers.start, { passive: false });

        this.#draggables.set(config.id, state);

        return config.id;
    }

     /**
      * Normalizes draggable options and merges defaults.
      * @param {Object} options
      * @returns {Object} Normalized config
      * @private
      */
     #normalizeDraggableOptions(options) {
         const root = this.#resolveRoot(options.root || this.#options.root || document);

        return {
            id: options.id || `cotton-drag-${this.#nextDraggableId++}`,
            root,
            handle: options.handle || options.clickTarget || options.handler || null,
            target: options.target || options.moveTarget || null,
            position: options.position || 'fixed',
            dragClass: options.dragClass || this.#options.dragClass || 'cotton-dragging',
            ignoreSelector: options.ignoreSelector || options.ignore || 'button, a, input, textarea, select, [contenteditable="true"]'
        };
    }

     /**
      * Starts drag interaction on pointer down.
      * @param {Object} state - Draggable state
      * @param {Event} event - Pointer event
      * @private
      */
     #startDraggable(state, event) {
        if (!this.#isPrimaryButton(event) || this.#isIgnoredTarget(event.target, state.config)) {
            return;
        }

        if (this.#maximized && this.#maximizeState && state.target === this.#maximizeState.target) {
            return;
        }

        event.preventDefault();

        const point = this.#getPointerPoint(event);
        const rect = state.target.getBoundingClientRect();

        state.dragging = {
            offsetX: point.x - rect.left,
            offsetY: point.y - rect.top
        };

        if (!state.target.style.width) {
            state.target.style.width = `${rect.width}px`;
        }

        if (!state.target.style.height) {
            state.target.style.height = `${rect.height}px`;
        }

        state.target.style.position = state.config.position;
        state.target.style.left = `${rect.left}px`;
        state.target.style.top = `${rect.top}px`;
        state.target.style.right = 'auto';
        state.target.style.bottom = 'auto';
        state.target.style.transform = 'none';
        state.target.classList.add(state.config.dragClass);

        document.addEventListener('mousemove', state.handlers.move);
        document.addEventListener('mouseup', state.handlers.up);
        document.addEventListener('touchmove', state.handlers.touchMove, { passive: false });
        document.addEventListener('touchend', state.handlers.touchEnd);
        document.addEventListener('touchcancel', state.handlers.touchEnd);
    }

     /**
      * Moves draggable element on pointer move.
      * @param {Object} state - Draggable state
      * @param {Event} event - Pointer event
      * @private
      */
     #moveDraggable(state, event) {
        if (!state.dragging) {
            return;
        }

        if (event.cancelable) {
            event.preventDefault();
        }

        const point = this.#getPointerPoint(event);

        state.target.style.left = `${point.x - state.dragging.offsetX}px`;
        state.target.style.top = `${point.y - state.dragging.offsetY}px`;
    }

     /**
      * Ends drag interaction on pointer up.
      * @param {Object} state - Draggable state
      * @private
      */
     #endDraggable(state) {
        if (!state.dragging) {
            return;
        }

        state.dragging = false;
        state.target.classList.remove(state.config.dragClass);

        document.removeEventListener('mousemove', state.handlers.move);
        document.removeEventListener('mouseup', state.handlers.up);
        document.removeEventListener('touchmove', state.handlers.touchMove);
        document.removeEventListener('touchend', state.handlers.touchEnd);
        document.removeEventListener('touchcancel', state.handlers.touchEnd);
    }

     /**
      * Registers a new resizable behavior.
      * @param {Object} options
      * @param {string|HTMLElement} [options.target] - Target element or selector
      * @param {string[]} [options.edges=['right']] - Resizable edges
      * @param {number} [options.minWidth=160] - Minimum width in px
      * @param {number} [options.maxWidth] - Maximum width in px
      * @param {number} [options.minHeight=80] - Minimum height in px
      * @param {number} [options.maxHeight] - Maximum height in px
      * @param {number} [options.handleSize=8] - Handle size in px
      * @param {string} [options.handleSide] - Handle side alignment
      * @param {string} [options.position] - CSS positioning mode
      * @param {string} [options.resizeClass] - CSS class applied while resizing
      * @param {string} [options.root] - Root element for selector resolution
      * @returns {string|null} Resizable ID
      * @private
      */
     #addResizable(options) {
         const config = this.#normalizeResizableOptions(options);

        if (this.#resizables.has(config.id)) {
            this.removeResizable(config.id);
        }

        const target = this.#resolveElement(config.target, config.root);

        if (!target) {
            return null;
        }

        const edges = this.#normalizeEdges(config.edges);

        if (edges.length === 0) {
            return null;
        }

        if (this.#getComputedStyle(target).position === 'static') {
            target.style.position = 'relative';
        }

        const state = {
            id: config.id,
            config,
            target,
            edges,
            resizing: false,
            handles: new Map()
        };

        edges.forEach(edge => {
            this.#appendResizeHandle(state, edge, [edge], this.#getEdgeCursor(edge));
        });

        this.#getResizeCorners(edges).forEach(corner => {
            this.#appendResizeHandle(state, corner.type, corner.edges, corner.cursor);
        });

        this.#resizables.set(config.id, state);

        return config.id;
    }

     /**
      * Normalizes resizable options and merges defaults.
      * @param {Object} options
      * @returns {Object} Normalized config
      * @private
      */
     #normalizeResizableOptions(options) {
         const root = this.#resolveRoot(options.root || this.#options.root || document);

        return {
            id: options.id || `cotton-resize-${this.#nextResizableId++}`,
            root,
            target: options.target || options.element || null,
            edges: options.edges || ['right'],
            minWidth: this.#toNumber(options.minWidth ?? this.#options.minWidth, 160),
            maxWidth: this.#toNumber(options.maxWidth ?? this.#options.maxWidth, null),
            minHeight: this.#toNumber(options.minHeight ?? this.#options.minHeight, 80),
            maxHeight: this.#toNumber(options.maxHeight ?? this.#options.maxHeight, null),
            handleSize: this.#toNumber(options.handleSize ?? this.#options.resizeHandleWidth, 8),
            handleSide: options.handleSide || null,
            position: options.position || null,
            resizeClass: options.resizeClass || this.#options.resizeClass || 'cotton-resizing'
        };
    }

     /**
      * Appends a resize handle element to the target.
      * @param {Object} state - Resizable state
      * @param {string} type - Handle type
      * @param {string[]} edges - Associated edges
      * @param {string|null} cursor - Cursor style
      * @private
      */
     #appendResizeHandle(state, type, edges, cursor) {
        const handle = document.createElement('div');
        const size = state.config.handleSize;
        const handleId = `${type}-${edges.join('-')}`;

        handle.className = `cotton-resize-handle cotton-resize-handle-${type}`;
        handle.dataset.resizeType = type;
        handle.style.position = 'absolute';
        handle.style.zIndex = '30';
        handle.style.boxSizing = 'border-box';
        handle.style.touchAction = 'none';
        handle.style.userSelect = 'none';

        if (cursor) {
            handle.style.cursor = cursor;
        }

        this.#positionResizeHandle(handle, type, size);
        this.#applyResizeHandleSide(handle, type, size, state.config.handleSide);

        const handlers = {
            start: event => this.#startResizable(state, event, edges, type),
            move: event => this.#moveResizable(state, event),
            up: () => this.#endResizable(state),
            touchMove: event => this.#moveResizable(state, event),
            touchEnd: () => this.#endResizable(state)
        };

        handle.addEventListener('mousedown', handlers.start);
        handle.addEventListener('touchstart', handlers.start, { passive: false });

        state.handles.set(handleId, {
            handle,
            handlers
        });

        state.target.appendChild(handle);
    }

     /**
      * Adjusts resize handle position when handleSide is set.
      * @param {HTMLElement} handle - Handle element
      * @param {string} type - Handle type
      * @param {number} size - Handle size in px
      * @param {string|null} side - Side alignment
      * @private
      */
     #applyResizeHandleSide(handle, type, size, side) {
        if (!side || !['top', 'right', 'bottom', 'left'].includes(type)) {
            return;
        }

        const offset = `${size / -2}px`;

        if (side === 'left' && type === 'right') {
            handle.style.left = offset;
            handle.style.right = 'auto';
            return;
        }

        if (side === 'right' && type === 'left') {
            handle.style.right = offset;
            handle.style.left = 'auto';
            return;
        }

        if (side === 'top' && type === 'bottom') {
            handle.style.top = offset;
            handle.style.bottom = 'auto';
            return;
        }

        if (side === 'bottom' && type === 'top') {
            handle.style.bottom = offset;
            handle.style.top = 'auto';
        }
    }

     /**
      * Positions a resize handle based on its type.
      * @param {HTMLElement} handle - Handle element
      * @param {string} type - Handle type or corner
      * @param {number} size - Handle size in px
      * @private
      */
     #positionResizeHandle(handle, type, size) {
        const half = `${size / -2}px`;

        if (type === 'top') {
            handle.style.left = '0';
            handle.style.right = '0';
            handle.style.top = half;
            handle.style.width = '100%';
            handle.style.height = `${size}px`;
            return;
        }

        if (type === 'right') {
            handle.style.top = '0';
            handle.style.bottom = '0';
            handle.style.right = half;
            handle.style.width = `${size}px`;
            handle.style.height = '100%';
            return;
        }

        if (type === 'bottom') {
            handle.style.left = '0';
            handle.style.right = '0';
            handle.style.bottom = half;
            handle.style.width = '100%';
            handle.style.height = `${size}px`;
            return;
        }

        if (type === 'left') {
            handle.style.top = '0';
            handle.style.bottom = '0';
            handle.style.left = half;
            handle.style.width = `${size}px`;
            handle.style.height = '100%';
            return;
        }

        handle.style.width = `${size}px`;
        handle.style.height = `${size}px`;

        if (type === 'top-right') {
            handle.style.top = half;
            handle.style.right = half;
            return;
        }

        if (type === 'bottom-right') {
            handle.style.bottom = half;
            handle.style.right = half;
            return;
        }

        if (type === 'bottom-left') {
            handle.style.bottom = half;
            handle.style.left = half;
            return;
        }

        if (type === 'top-left') {
            handle.style.top = half;
            handle.style.left = half;
        }
    }

     /**
      * Prepares resizable target positioning before resize starts.
      * @param {Object} state - Resizable state
      * @private
      */
     #prepareResizableTarget(state) {
        if (!state.config.position || state.config.position === 'static') {
            return;
        }

        if (state.target.style.position === state.config.position) {
            return;
        }

        const rect = state.target.getBoundingClientRect();

        state.target.style.position = state.config.position;
        state.target.style.right = 'auto';
        state.target.style.bottom = 'auto';
        state.target.style.inset = 'auto';
        state.target.style.left = `${rect.left}px`;
        state.target.style.top = `${rect.top}px`;
        state.target.style.width = `${rect.width}px`;
        state.target.style.height = `${rect.height}px`;
    }

     /**
      * Starts resize interaction on pointer down.
      * @param {Object} state - Resizable state
      * @param {Event} event - Pointer event
      * @param {string[]} edges - Active edges
      * @param {string} type - Handle type
      * @private
      */
     #startResizable(state, event, edges, type) {
        if (!this.#isPrimaryButton(event)) {
            return;
        }

        this.#prepareResizableTarget(state);

        event.preventDefault();

        const point = this.#getPointerPoint(event);
        const rect = state.target.getBoundingClientRect();
        const minWidth = this.#toNumber(state.config.minWidth, 1);
        const minHeight = this.#toNumber(state.config.minHeight, 1);
        const hasLeft = edges.includes('left');
        const hasRight = edges.includes('right');
        const hasTop = edges.includes('top');
        const hasBottom = edges.includes('bottom');

        state.resizing = {
            edges,
            type,
            startX: point.x,
            startY: point.y,
            startWidth: Math.max(rect.width, minWidth),
            startHeight: Math.max(rect.height, minHeight),
            startLeft: rect.left,
            startTop: rect.top
        };

        state.target.classList.add(state.config.resizeClass);

        document.addEventListener('mousemove', state.handles.get(`${type}-${edges.join('-')}`).handlers.move);
        document.addEventListener('mouseup', state.handles.get(`${type}-${edges.join('-')}`).handlers.up);
        document.addEventListener('touchmove', state.handles.get(`${type}-${edges.join('-')}`).handlers.touchMove, { passive: false });
        document.addEventListener('touchend', state.handles.get(`${type}-${edges.join('-')}`).handlers.touchEnd);
        document.addEventListener('touchcancel', state.handles.get(`${type}-${edges.join('-')}`).handlers.touchEnd);
    }

     /**
      * Moves resizable element on pointer move.
      * @param {Object} state - Resizable state
      * @param {Event} event - Pointer event
      * @private
      */
     #moveResizable(state, event) {
        if (!state.resizing) {
            return;
        }

        if (event.cancelable) {
            event.preventDefault();
        }

        const point = this.#getPointerPoint(event);
        const resizing = state.resizing;
        const edges = resizing.edges;
        const hasLeft = edges.includes('left');
        const hasRight = edges.includes('right');
        const hasTop = edges.includes('top');
        const hasBottom = edges.includes('bottom');
        const deltaX = point.x - resizing.startX;
        const deltaY = point.y - resizing.startY;
        const minWidth = this.#toNumber(state.config.minWidth, 1);
        const minHeight = this.#toNumber(state.config.minHeight, 1);

        if (hasRight && !hasLeft) {
            const width = this.#clampDimension(
                state.config.handleSide === 'left'
                    ? resizing.startWidth - deltaX
                    : resizing.startWidth + deltaX,
                minWidth,
                state.config.maxWidth
            );
            state.target.style.width = `${width}px`;
        }

        if (hasLeft && !hasRight) {
            if (state.config.handleSide === 'right') {
                const width = this.#clampDimension(
                    resizing.startWidth + deltaX,
                    minWidth,
                    state.config.maxWidth
                );
                state.target.style.width = `${width}px`;
            } else {
                const width = this.#clampDimension(
                    resizing.startWidth - deltaX,
                    minWidth,
                    state.config.maxWidth
                );
                state.target.style.left = `${resizing.startLeft + deltaX}px`;
                state.target.style.width = `${width}px`;
            }
        }

        if (hasBottom && !hasTop) {
            const height = this.#clampDimension(
                resizing.startHeight + deltaY,
                minHeight,
                state.config.maxHeight
            );
            state.target.style.height = `${height}px`;
        }

        if (hasTop && !hasBottom) {
            const height = this.#clampDimension(
                resizing.startHeight - deltaY,
                minHeight,
                state.config.maxHeight
            );
            state.target.style.top = `${resizing.startTop + deltaY}px`;
            state.target.style.height = `${height}px`;
        }
    }

     /**
      * Ends resize interaction on pointer up.
      * @param {Object} state - Resizable state
      * @private
      */
     #endResizable(state) {
        if (!state.resizing) {
            return;
        }

        state.resizing = false;
        state.target.classList.remove(state.config.resizeClass);

        state.handles.forEach(handleState => {
            document.removeEventListener('mousemove', handleState.handlers.move);
            document.removeEventListener('mouseup', handleState.handlers.up);
            document.removeEventListener('touchmove', handleState.handlers.touchMove);
            document.removeEventListener('touchend', handleState.handlers.touchEnd);
            document.removeEventListener('touchcancel', handleState.handlers.touchEnd);
        });
    }

     /**
      * Registers a new drag-and-drop upload behavior.
      * @param {Object} options
      * @param {string|HTMLElement} [options.dropZone] - Drop zone element or selector
      * @param {CottonUIManager} [options.manager] - UI manager instance
      * @param {boolean} [options.autoSubmit=true] - Auto-submit after drop
      * @param {string} [options.dropActiveClass] - CSS class for active drop state
      * @param {string} [options.root] - Root element for selector resolution
      * @returns {string|null} Drop upload ID
      * @private
      */
     #addDropUpload(options) {
         const config = this.#normalizeDropUploadOptions(options);

        if (this.#dropUploads.has(config.id)) {
            this.removeDropUpload(config.id);
        }

        const dropZone = this.#resolveElement(config.dropZone, config.root);

        if (!dropZone) {
            return null;
        }

        const state = {
            id: config.id,
            config,
            dropZone,
            depth: 0,
            uploading: false,
            handlers: {}
        };

        state.handlers.dragEnter = event => this.#handleDropUploadDragEnter(state, event);
        state.handlers.dragOver = event => this.#handleDropUploadDragOver(state, event);
        state.handlers.dragLeave = event => this.#handleDropUploadDragLeave(state, event);
        state.handlers.drop = event => this.#handleDropUploadDrop(state, event);

        dropZone.addEventListener('dragenter', state.handlers.dragEnter);
        dropZone.addEventListener('dragover', state.handlers.dragOver);
        dropZone.addEventListener('dragleave', state.handlers.dragLeave);
        dropZone.addEventListener('drop', state.handlers.drop);

        this.#dropUploads.set(config.id, state);

        return config.id;
    }

     /**
      * Normalizes drop-upload options and merges defaults.
      * @param {Object} options
      * @returns {Object} Normalized config
      * @private
      */
     #normalizeDropUploadOptions(options) {
         const root = this.#resolveRoot(options.root || this.#options.root || document);

        return {
            id: options.id || `cotton-drop-${this.#nextDropUploadId++}`,
            root,
            dropZone: options.dropZone || options.target || options.container || null,
            manager: options.manager || this.#manager,
            autoSubmit: options.autoSubmit !== false,
            dropActiveClass: options.dropActiveClass || this.#options.dropActiveClass || 'cotton-drop-active'
        };
    }

     /**
      * Handles dragenter on the drop zone.
      * @param {Object} state - Drop upload state
      * @param {Event} event - Drag event
      * @private
      */
     #handleDropUploadDragEnter(state, event) {
        event.preventDefault();

        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }

        state.depth += 1;
        this.#setDropActive(state, true);
    }

     /**
      * Handles dragover on the drop zone.
      * @param {Object} state - Drop upload state
      * @param {Event} event - Drag event
      * @private
      */
     #handleDropUploadDragOver(state, event) {
        event.preventDefault();

        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
    }

     /**
      * Handles dragleave on the drop zone.
      * @param {Object} state - Drop upload state
      * @param {Event} event - Drag event
      * @private
      */
     #handleDropUploadDragLeave(state, event) {
        event.preventDefault();

        state.depth = Math.max(0, state.depth - 1);

        if (state.depth === 0) {
            this.#setDropActive(state, false);
        }
    }

     /**
      * Handles drop on the drop zone and starts upload.
      * @param {Object} state - Drop upload state
      * @param {Event} event - Drop event
      * @private
      */
     #handleDropUploadDrop(state, event) {
        event.preventDefault();

        state.depth = 0;
        this.#setDropActive(state, false);

        const files = Array.from(event.dataTransfer?.files || []);

        if (files.length === 0 || state.uploading) {
            return;
        }

        state.uploading = true;

        this.#uploadFilesThroughModal(files, state.config)
            .catch(error => this.#notify('error', error.message))
            .finally(() => {
                state.uploading = false;
            });
    }

     /**
      * Toggles active drop-upload styling on the drop zone.
      * @param {Object} state - Drop upload state
      * @param {boolean} active - Whether drop is active
      * @private
      */
     #setDropActive(state, active) {
        state.dropZone.classList.toggle(state.config.dropActiveClass, active);

        if (active) {
            if (!state.originalOutline) {
                state.originalOutline = state.dropZone.style.outline;
                state.originalOutlineOffset = state.dropZone.style.outlineOffset;
            }

            state.dropZone.style.outline = '2px dashed var(--cot-blue)';
            state.dropZone.style.outlineOffset = '-2px';
            return;
        }

        if (state.originalOutline) {
            state.dropZone.style.outline = state.originalOutline;
            state.dropZone.style.outlineOffset = state.originalOutlineOffset;
            state.originalOutline = null;
            state.originalOutlineOffset = null;
            return;
        }

        state.dropZone.style.outline = '';
        state.dropZone.style.outlineOffset = '';
    }

     /**
      * Opens the upload modal through the manager for dropped files.
      * @param {File[]} files - Dropped files
      * @param {Object} config - Drop upload config
      * @private
      */
     async #uploadFilesThroughModal(files, config) {
        const manager = config.manager || this.#manager;

        if (!manager) {
            this.#notify('error', 'CottonUXManager: manager not configured for modal upload');
            return;
        }

        const folderId = this.#getActiveFolderId(manager);

        if (folderId < 0) {
            this.#notify('error', 'Cannot upload files to trash');
            return;
        }

        if (typeof manager.showUploadModal !== 'function') {
            this.#notify('error', 'CottonUXManager: CottonUIManager.showUploadModal is not available');
            return;
        }

        await manager.showUploadModal(files, config.autoSubmit);
    }

     /**
      * Normalizes edge input into an array of allowed edge names.
      * @param {string|string[]} edges - Edges input
      * @returns {string[]} Normalized edges
      * @private
      */
     #normalizeEdges(edges) {
         const allowed = ['top', 'right', 'bottom', 'left'];

        if (!Array.isArray(edges)) {
            edges = String(edges || '').split(/[\s,]+/).filter(Boolean);
        }

        return edges
            .map(edge => String(edge).toLowerCase())
            .filter(edge => allowed.includes(edge));
    }

     /**
      * Returns corner handle configs for the given edges.
      * @param {string[]} edges - Active edges
      * @returns {Array} Corner configurations
      * @private
      */
     #getResizeCorners(edges) {
         const corners = [];

        if (edges.includes('top') && edges.includes('right')) {
            corners.push({ type: 'top-right', edges: ['top', 'right'], cursor: 'nesw-resize' });
        }

        if (edges.includes('right') && edges.includes('bottom')) {
            corners.push({ type: 'bottom-right', edges: ['right', 'bottom'], cursor: 'nwse-resize' });
        }

        if (edges.includes('bottom') && edges.includes('left')) {
            corners.push({ type: 'bottom-left', edges: ['bottom', 'left'], cursor: 'nesw-resize' });
        }

        if (edges.includes('left') && edges.includes('top')) {
            corners.push({ type: 'top-left', edges: ['left', 'top'], cursor: 'nwse-resize' });
        }

        return corners;
    }

     /**
      * Returns the cursor style for a resize edge.
      * @param {string} edge - Edge name
      * @returns {string|null} Cursor CSS value
      * @private
      */
     #getEdgeCursor(edge) {
        if (edge === 'top' || edge === 'bottom') {
            return 'ns-resize';
        }

        if (edge === 'left' || edge === 'right') {
            return 'ew-resize';
        }

        return null;
    }

     /**
      * Clamps a dimension value between min and max.
      * @param {number} value - Value to clamp
      * @param {number} min - Minimum allowed value
      * @param {number|null} max - Maximum allowed value
      * @returns {number} Clamped value
      * @private
      */
     #clampDimension(value, min, max) {
        const number = this.#toNumber(value, min);
        const minValue = this.#toNumber(min, 0);
        const maxValue = max === null || max === undefined || max === '' ? null : this.#toNumber(max, null);
        const clamped = Math.max(number, minValue);

        if (maxValue !== null && Number.isFinite(maxValue)) {
            return Math.min(clamped, maxValue);
        }

        return clamped;
    }

     /**
      * Gets the active folder ID from the manager.
      * @param {CottonUIManager} manager - UI manager instance
      * @returns {number} Active folder ID
      * @private
      */
     #getActiveFolderId(manager) {
        if (manager && typeof manager.getActiveFolderId === 'function') {
            return parseInt(manager.getActiveFolderId() || '0', 10) || 0;
        }

        return 0;
    }

     /**
      * Applies full-viewport maximize styles to the target.
      * @param {HTMLElement} target - Element to style
      * @private
      */
     #applyMaximizeStyles(target) {
        if (typeof window === 'undefined') {
            return;
        }

        target.style.position = 'fixed';
        target.style.left = '0';
        target.style.top = '0';
        target.style.width = `${window.innerWidth}px`;
        target.style.height = `${window.innerHeight}px`;
        target.style.right = 'auto';
        target.style.bottom = 'auto';
        target.style.transform = 'none';
        target.style.zIndex = '1050';
    }

     /**
      * Updates all maximize icons to reflect current maximize state.
      * @private
      */
     #updateAllMaximizeIcons() {
        if (!this.#maximizeTrigger) {
            return;
        }

        this.#updateMaximizeIcon(this.#maximizeTrigger, {
            maximizeClass: this.#options.maximizeClass || 'cotton-maximized',
            iconMaximizeClass: 'fa-maximize',
            iconRestoreClass: 'fa-minimize'
        });
    }

     /**
      * Updates a single maximize trigger icon/title.
      * @param {HTMLElement} trigger - Trigger element
      * @param {Object} config - Icon configuration
      * @private
      */
     #updateMaximizeIcon(trigger, config) {
        if (!trigger) {
            return;
        }

        const icon = trigger.classList.contains(config.iconMaximizeClass) || trigger.classList.contains(config.iconRestoreClass)
            ? trigger
            : trigger.querySelector(`.${config.iconMaximizeClass}, .${config.iconRestoreClass}`);

        if (!icon) {
            return;
        }

        icon.classList.toggle(config.iconMaximizeClass, !this.#maximized);
        icon.classList.toggle(config.iconRestoreClass, this.#maximized);

        if (icon.tagName === 'I') {
            icon.title = this.#maximized ? 'Restore' : 'Maximize';
        }

        if (trigger.title || trigger.tagName === 'BUTTON' || trigger.tagName === 'DIV' || trigger.tagName === 'I') {
            trigger.title = this.#maximized ? 'Restore' : 'Maximize';
        }
    }

     /**
      * Converts camelCase string to kebab-case.
      * @param {string} value - camelCase input
      * @returns {string} kebab-case output
      * @private
      */
     #camelToKebab(value) {
         return value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
     }

     /**
      * Resolves a selector, function, or element into an HTMLElement.
      * @param {string|HTMLElement|Function|null} value - Input to resolve
      * @param {string|HTMLElement|Window} [root] - Root for selector resolution
      * @returns {HTMLElement|null} Resolved element
      * @private
      */
     #resolveElement(value, root) {
        if (!value) {
            return null;
        }

        if (typeof value === 'function') {
            return this.#resolveElement(value(), root);
        }

        const resolvedRoot = this.#resolveRoot(root);

        if (typeof value === 'string') {
            return resolvedRoot ? resolvedRoot.querySelector(value) : null;
        }

        if (this.#isElement(value)) {
            return value;
        }

        return null;
    }

     /**
      * Resolves a root value into a document/element root.
      * @param {string|HTMLElement|Window|null} root - Root input
      * @returns {HTMLElement|null} Resolved root
      * @private
      */
     #resolveRoot(root) {
        if (!root) {
            return typeof document !== 'undefined' ? document : null;
        }

        if (typeof root === 'string') {
            return typeof document !== 'undefined' ? document.querySelector(root) || document : null;
        }

        if (typeof window !== 'undefined' && root === window) {
            return typeof document !== 'undefined' ? document : null;
        }

        if (this.#isElement(root)) {
            return root;
        }

        return typeof document !== 'undefined' ? document : null;
    }

     /**
      * Checks if the event came from the primary button (left mouse or touch).
      * @param {Event} event - Input event
      * @returns {boolean}
      * @private
      */
     #isPrimaryButton(event) {
        return event.type.startsWith('touch') || event.button === 0;
    }

     /**
      * Checks if the event target matches the ignored selector.
      * @param {Element|null} target - Event target
      * @param {Object} config - Behavior config
      * @returns {boolean}
      * @private
      */
     #isIgnoredTarget(target, config) {
        if (!config.ignoreSelector || typeof Element === 'undefined' || !(target instanceof Element)) {
            return false;
        }

        return Boolean(target.closest(config.ignoreSelector));
    }

     /**
      * Extracts pointer coordinates from mouse or touch events.
      * @param {Event} event - Input event
      * @returns {{x: number, y: number}} Pointer coordinates
      * @private
      */
     #getPointerPoint(event) {
        const source = event.touches?.[0] || event.changedTouches?.[0] || event;

        return {
            x: source.clientX || 0,
            y: source.clientY || 0
        };
    }

     /**
      * Gets computed style for an element safely.
      * @param {HTMLElement} element - Target element
      * @returns {CSSStyleDeclaration} Computed style
      * @private
      */
     #getComputedStyle(element) {
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
            return { position: 'static' };
        }

        return window.getComputedStyle(element);
    }

     /**
      * Converts a value to number or returns a fallback.
      * @param {*} value - Value to convert
      * @param {*} fallback - Fallback value
      * @returns {number|*} Number or fallback
      * @private
      */
     #toNumber(value, fallback) {
        const number = Number(value);

        return Number.isFinite(number) ? number : fallback;
    }

     /**
      * Checks if a value is an Element instance.
      * @param {*} value - Value to check
      * @returns {boolean}
      * @private
      */
     #isElement(value) {
        return typeof Element !== 'undefined' && value instanceof Element;
    }

     /**
      * Dispatches a UX status event and logs it.
      * @param {'success'|'error'} type - Message type
      * @param {string} message - Message content
      * @private
      */
     #notify(type, message) {
        const detail = {
            type,
            message
        };

        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cotton:ux:status', { detail }));
        }

        if (type === 'error') {
            console.error('[CottonUXManager]', message);
            return;
        }

        //console.log('[CottonUXManager]', message);
    }
}

if (typeof window !== 'undefined') {
    window.CottonUXManager = CottonUXManager;
}