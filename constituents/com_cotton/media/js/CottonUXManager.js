/**
 * @package Tabaoca.Component.Cotton.Site
 * @subpackage com_cotton
 * @copyright (C) 2026 Jonatas C. Ferreira
 * @license GNU/AGPL v3 https://www.gnu.org/licenses/agpl-3.0.html
 */

export class CottonUXManager {
    #manager = null;
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

    constructor(manager = null, options = {}) {
        this.#manager = manager;
        this.#options = {
            ...options
        };
    }

    initialize() {
        return this;
    }

    addDraggable(options = {}) {
        return this.#addDraggable(options);
    }

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

    addResizable(options = {}) {
        return this.#addResizable(options);
    }

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

    addDropUpload(options = {}) {
        return this.#addDropUpload(options);
    }

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

    enableHeaderDrag() {
        return this.addDraggable({
            handle: this.#options.headerSelector || null,
            target: this.#options.container || null,
            position: 'fixed'
        });
    }

    enableTreeResize() {
        return this.addResizable({
            target: this.#options.target || null,
            edges: ['right']
        });
    }

    enableDropUpload() {
        return this.addDropUpload({
            dropZone: this.#options.dropZone || null
        });
    }

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

        this.#notify('success', 'Cotton maximizado');

        return this;
    }

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

        this.#notify('success', 'Cotton restaurado');

        return this;
    }

    toggleMaximize(container = null) {
        if (this.#maximized) {
            return this.restore(container);
        }

        return this.maximize(container);
    }

    isMaximized() {
        return this.#maximized;
    }

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

    destroy() {
        this.destroyHeaderMaximize();
        Array.from(this.#draggables.keys()).forEach(id => this.removeDraggable(id));
        Array.from(this.#resizables.keys()).forEach(id => this.removeResizable(id));
        Array.from(this.#dropUploads.keys()).forEach(id => this.removeDropUpload(id));

        return this;
    }

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

    #handleDropUploadDragEnter(state, event) {
        event.preventDefault();

        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }

        state.depth += 1;
        this.#setDropActive(state, true);
    }

    #handleDropUploadDragOver(state, event) {
        event.preventDefault();

        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
    }

    #handleDropUploadDragLeave(state, event) {
        event.preventDefault();

        state.depth = Math.max(0, state.depth - 1);

        if (state.depth === 0) {
            this.#setDropActive(state, false);
        }
    }

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

    async #uploadFilesThroughModal(files, config) {
        const manager = config.manager || this.#manager;

        if (!manager) {
            this.#notify('error', 'CottonUXManager: manager não configurado para upload por modal');
            return;
        }

        const folderId = this.#getActiveFolderId(manager);

        if (folderId < 0) {
            this.#notify('error', 'Não é possível enviar arquivos na lixeira');
            return;
        }

        if (typeof manager.showUploadModal !== 'function') {
            this.#notify('error', 'CottonUXManager: CottonUIManager.showUploadModal não está disponível');
            return;
        }

        await manager.showUploadModal(files, config.autoSubmit);
    }

    #normalizeEdges(edges) {
        const allowed = ['top', 'right', 'bottom', 'left'];

        if (!Array.isArray(edges)) {
            edges = String(edges || '').split(/[\s,]+/).filter(Boolean);
        }

        return edges
            .map(edge => String(edge).toLowerCase())
            .filter(edge => allowed.includes(edge));
    }

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

    #getEdgeCursor(edge) {
        if (edge === 'top' || edge === 'bottom') {
            return 'ns-resize';
        }

        if (edge === 'left' || edge === 'right') {
            return 'ew-resize';
        }

        return null;
    }

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

    #getActiveFolderId(manager) {
        if (manager && typeof manager.getActiveFolderId === 'function') {
            return parseInt(manager.getActiveFolderId() || '0', 10) || 0;
        }

        return 0;
    }

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
            icon.title = this.#maximized ? 'Restaurar' : 'Maximizar';
        }

        if (trigger.title || trigger.tagName === 'BUTTON' || trigger.tagName === 'DIV' || trigger.tagName === 'I') {
            trigger.title = this.#maximized ? 'Restaurar' : 'Maximizar';
        }
    }

    #camelToKebab(value) {
        return value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
    }

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

    #isPrimaryButton(event) {
        return event.type.startsWith('touch') || event.button === 0;
    }

    #isIgnoredTarget(target, config) {
        if (!config.ignoreSelector || typeof Element === 'undefined' || !(target instanceof Element)) {
            return false;
        }

        return Boolean(target.closest(config.ignoreSelector));
    }

    #getPointerPoint(event) {
        const source = event.touches?.[0] || event.changedTouches?.[0] || event;

        return {
            x: source.clientX || 0,
            y: source.clientY || 0
        };
    }

    #getComputedStyle(element) {
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
            return { position: 'static' };
        }

        return window.getComputedStyle(element);
    }

    #toNumber(value, fallback) {
        const number = Number(value);

        return Number.isFinite(number) ? number : fallback;
    }

    #isElement(value) {
        return typeof Element !== 'undefined' && value instanceof Element;
    }

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

        console.log('[CottonUXManager]', message);
    }
}

if (typeof window !== 'undefined') {
    window.CottonUXManager = CottonUXManager;
}