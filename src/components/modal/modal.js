/**
 * aui-modal: a dialog over the page, with its stack of open dialogs.
 */
angular.module('aui')
    .factory('auiModalRegistry', [function () {
        let _useNativeMemo = null;

        function useNativeDialog() {
            if (_useNativeMemo !== null) return _useNativeMemo;
            try {
                const probe = document.createElement('dialog');
                _useNativeMemo = !!(probe && typeof probe.showModal === 'function');
            } catch (e) {
                _useNativeMemo = false;
            }
            return _useNativeMemo;
        }

        const BASE_Z = 2000;
        const STEP = 20;
        // The open modals, the last opened on top (native dialogs and the fallback's boxes alike): Escape goes to the
        // top one; the fallback's overlays are stacked by z-index.
        const stackArr = [];

        function findIndex(id) {
            for (let i = stackArr.length - 1; i >= 0; i -= 1) {
                if (stackArr[i].id === id) return i;
            }
            return -1;
        }

        function rebalanceZ() {
            for (let i = 0; i < stackArr.length; i += 1) {
                const e = stackArr[i];
                e.z = BASE_Z + STEP * i;
                if (e.overlayEl) e.overlayEl.style.zIndex = String(e.z);
            }
        }

        /**
         * A modal over another open one dims the page less (its own backdrop "stacked"): told again whenever one opens,
         * starts to close or turns back, so that a modal left alone (the one under it closed first) dims the page as a
         * single one does - its backdrop's colour changes as the other's fades out (the stylesheet's transition).
         */
        function restack() {
            let openBelow = false;
            for (let i = 0; i < stackArr.length; i += 1) {
                const e = stackArr[i];
                if (e.setStacked) e.setStacked(openBelow);
                if (e.isOpen && e.isOpen()) openBelow = true;
            }
        }

        /**
         * The fallback's page behind it: a native modal dialog makes everything outside it inert; the fallback's box is
         * only drawn over the page, so while one is open the body's other children are hidden from assistive
         * technology (aria-hidden) and made inert where the browser knows inert (no pointer, no focus: a page control
         * raised above the overlay took clicks). The toasts' host stays: its notices show over the modals.
         * The page goes on meanwhile, and the fallback follows it: a child added to the body while it is open is hidden
         * as well, and a value of aria-hidden the page sets on a hidden one (a panel shown or folded) is kept to be
         * given back - the page's latest, not the one it had when the fallback opened - while the child stays hidden.
         */
        const hiddenBehind = [];
        let behindObserver = null;
        const canInert = typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;

        function topOverlayEl() {
            for (let i = stackArr.length - 1; i >= 0; i -= 1) {
                if (stackArr[i].overlayEl) return stackArr[i].overlayEl;
            }
            return null;
        }

        function hideOne(el, topOverlay) {
            if (el.nodeType !== 1 || el === topOverlay || /^(SCRIPT|STYLE|LINK|AUI-MESSAGE-HOST)$/.test(el.tagName)) return;
            for (let i = 0; i < hiddenBehind.length; i += 1) {
                if (hiddenBehind[i].el === el) return;
            }
            hiddenBehind.push({el: el, value: el.getAttribute('aria-hidden'), inert: canInert && !el.hasAttribute('inert')});
            el.setAttribute('aria-hidden', 'true');
            if (canInert && !el.hasAttribute('inert')) el.setAttribute('inert', '');
            if (behindObserver) behindObserver.observe(el, {attributes: true, attributeFilter: ['aria-hidden']});
        }

        function hideBehind() {
            const topOverlay = topOverlayEl();
            showBehind();
            if (!topOverlay || !document.body) return;
            if (typeof MutationObserver === 'function') {
                behindObserver = new MutationObserver(function (records) {
                    const top = topOverlayEl();
                    records.forEach(function (record) {
                        if (record.type === 'childList') {
                            Array.prototype.forEach.call(record.addedNodes, function (node) {
                                if (node.parentNode === document.body) hideOne(node, top);
                            });
                            return;
                        }
                        // the page's own aria-hidden: kept to give back; the child stays hidden while the fallback is open
                        for (let i = 0; i < hiddenBehind.length; i += 1) {
                            const hidden = hiddenBehind[i];
                            if (hidden.el !== record.target) continue;
                            hidden.value = hidden.el.getAttribute('aria-hidden');
                            if (hidden.value !== 'true') hidden.el.setAttribute('aria-hidden', 'true');
                        }
                    });
                    // this callback's own writes are not the page's
                    behindObserver.takeRecords();
                });
                behindObserver.observe(document.body, {childList: true});
            }
            Array.prototype.forEach.call(document.body.children, function (el) { hideOne(el, topOverlay); });
            if (behindObserver) behindObserver.takeRecords();
        }

        function showBehind() {
            if (behindObserver) {
                behindObserver.disconnect();
                behindObserver = null;
            }
            hiddenBehind.splice(0).forEach(function (hidden) {
                if (hidden.value === null) hidden.el.removeAttribute('aria-hidden');
                else hidden.el.setAttribute('aria-hidden', hidden.value);
                if (hidden.inert) hidden.el.removeAttribute('inert');
            });
        }

        const stack = {
            push: function (entry) {
                stackArr.push(entry);
                rebalanceZ();
                restack();
                hideBehind();
                layer.changed(null);
                return entry;
            },
            pop: function (id) {
                const idx = findIndex(id);
                if (idx >= 0) {
                    stackArr.splice(idx, 1);
                    rebalanceZ();
                    restack();
                    hideBehind();
                    layer.changed(null);
                }
            },
            restack: restack,
            top: function () {
                return stackArr.length ? stackArr[stackArr.length - 1] : null;
            },
            // another modal open (not fading out) in the stack
            anyOpen: function () {
                for (let i = 0; i < stackArr.length; i += 1) {
                    if (stackArr[i].isOpen && stackArr[i].isOpen()) return true;
                }
                return false;
            },
            size: function () {
                return stackArr.length;
            }
        };

        function isModalDialog(el) {
            if (!el || el.tagName !== 'DIALOG' || !el.open) return false;
            try {
                return el.matches(':modal');
            } catch (e) {
                return true;    // no :modal (older browsers): an open dialog of the stack is a modal one
            }
        }

        /**
         * The layers that must stay usable over the open modal dialogs (the toasts' host, aui-message-host): every
         * node outside an open modal dialog is inert, so such a layer goes inside the topmost one. Told when a modal
         * opens (pushed), before a native dialog closes (leaving: the dialog, not a place any more) and once it is
         * out (popped). topDialog(leaving): the topmost open modal dialog - the last opened of the stack still open,
         * else the page's own last one - or null.
         */
        const layerListeners = [];
        const layer = {
            subscribe: function (fn) {
                layerListeners.push(fn);
                return function () {
                    const idx = layerListeners.indexOf(fn);
                    if (idx >= 0) layerListeners.splice(idx, 1);
                };
            },
            changed: function (leaving) {
                layerListeners.slice().forEach(function (fn) {
                    try {
                        fn(leaving || null);
                    } catch (e) {
                    }
                });
            },
            /**
             * topOverlay(leaving): the topmost open fallback's overlay, or null. Its focus is kept inside it, so the
             * toasts' host goes into it (after the box): Tab reaches the notices shown over the box, as in a native
             * dialog, where the host goes inside the dialog.
             */
            topOverlay: function (leaving) {
                for (let i = stackArr.length - 1; i >= 0; i -= 1) {
                    const el = stackArr[i].overlayEl;
                    if (el && el !== leaving && el.parentNode) return el;
                }
                return null;
            },
            topDialog: function (leaving) {
                for (let i = stackArr.length - 1; i >= 0; i -= 1) {
                    const el = stackArr[i].modalEl;
                    if (el !== leaving && isModalDialog(el)) return el;
                }
                const open = document.querySelectorAll('dialog[open]');
                for (let i = open.length - 1; i >= 0; i -= 1) {
                    if (open[i] !== leaving && isModalDialog(open[i])) return open[i];
                }
                return null;
            }
        };

        const FOCUSABLE_SELECTOR = 'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),iframe,object,embed,[tabindex]:not([tabindex="-1"]),[contenteditable=""],[contenteditable="true"]';

        function firstFocusable(root) {
            if (!root) return null;
            const candidates = root.querySelectorAll(FOCUSABLE_SELECTOR);
            for (let i = 0; i < candidates.length; i += 1) {
                const el = candidates[i];
                if (el.offsetParent !== null) return el;
            }
            return null;
        }

        /*
         * The controls Tab reaches in a box, in the order the browser takes them: not disabled (also through a
         * disabled fieldset), not inert, drawn and visible, not taken out of the tab order; of a group of radio
         * buttons, the checked one; the ones with a positive tabindex first (in its order), then the others. The
         * fallback goes round between the first and the last of them: a control the browser skips (one in a disabled
         * fieldset, a hidden one) taken as the first or the last held the focus in place, or let it out of the box.
         */
        function tabbable(el) {
            if (el.tabIndex < 0 || el.disabled) return false;
            try {
                if (el.matches(':disabled')) return false;
            } catch (e) { /* no :disabled (a very old browser): its own disabled was read */ }
            if (el.closest && el.closest('[inert]')) return false;
            if (el.getClientRects().length === 0) return false;
            return window.getComputedStyle(el).visibility === 'visible';
        }

        function tabStops(root) {
            const all = Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE_SELECTOR), tabbable);
            const groups = {};
            const stops = all.filter(function (el) {
                if (el.type !== 'radio' || !el.name) return true;
                const key = (el.form ? 'f' : 'd') + ':' + el.name;
                const group = groups[key] || (groups[key] = all.filter(function (other) {
                    return other.type === 'radio' && other.name === el.name && other.form === el.form;
                }));
                const checked = group.filter(function (other) { return other.checked; })[0];
                return checked ? el === checked : true;
            });
            const raised = stops.filter(function (el) { return el.tabIndex > 0; })
                .sort(function (a, b) { return a.tabIndex - b.tabIndex; });
            return raised.concat(stops.filter(function (el) { return el.tabIndex === 0; }));
        }

        // inside the top fallback, or in the toasts' host (its notices are above the box and can take the focus)
        function focusAllowed(top, el) {
            if (top.overlayEl.contains(el)) return true;
            return !!(el && el.closest && el.closest('.aui-message-host, aui-message-host'));
        }

        let lastTabBack = false;   // the last Tab went backwards (Shift+Tab)

        let focusinHandler = null;
        let tabHandler = null;

        /**
         * Tab and Shift+Tab go round inside the fallback's top box: from its last control to its first, from its first
         * (or the box itself) to its last. Between them the browser moves the focus as usual; focusin brings back a
         * focus that got out some other way.
         */
        function onTab(event) {
            if ((event.key !== 'Tab' && event.keyCode !== 9) || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
            const top = stack.top();
            if (!top || !top.overlayEl) return;
            lastTabBack = !!event.shiftKey;
            const box = top.modalEl;
            const active = document.activeElement;
            // in a toast over the box: the browser moves on from there (out of it, the focus comes back: focusin)
            if (!top.overlayEl.contains(active) && focusAllowed(top, active)) return;
            // the box's controls, and those of the toasts' host placed in its overlay after it
            const stops = tabStops(top.overlayEl);
            const inside = top.overlayEl.contains(active);
            let target = null;
            if (!stops.length) target = box;
            else if (event.shiftKey && (!inside || active === box || active === stops[0])) target = stops[stops.length - 1];
            else if (!event.shiftKey && (!inside || active === stops[stops.length - 1])) target = stops[0];
            if (!target) return;
            event.preventDefault();
            try {
                target.focus();
            } catch (e) {
            }
        }

        // The fallback's focus trap (a native modal dialog keeps the focus inside itself)
        const focus = {
            activate: function (entry) {
                entry.prevFocus = document.activeElement;
                const target = entry.modalEl.querySelector('[autofocus]') || firstFocusable(entry.modalEl) || entry.modalEl;
                if (target === entry.modalEl && !entry.modalEl.hasAttribute('tabindex')) {
                    entry.modalEl.setAttribute('tabindex', '-1');
                }
                try {
                    target.focus();
                } catch (e) {
                }
                if (!focusinHandler) {
                    // a focus that got out of the box some other way comes back to it: to its last control after a
                    // Shift+Tab, else to its first
                    focusinHandler = function (event) {
                        const top = stack.top();
                        if (!top || !top.overlayEl) return;
                        if (focusAllowed(top, event.target)) return;
                        const stops = tabStops(top.modalEl);
                        const redirect = (lastTabBack ? stops[stops.length - 1] : stops[0]) || top.modalEl;
                        try {
                            redirect.focus();
                        } catch (err) {
                        }
                    };
                    document.addEventListener('focusin', focusinHandler, true);
                }
                if (!tabHandler) {
                    tabHandler = onTab;
                    document.addEventListener('keydown', tabHandler);
                }
            },
            deactivate: function (entry) {
                const isTop = (stack.top() === entry);
                if (isTop && entry.prevFocus && document.contains(entry.prevFocus)) {
                    try {
                        entry.prevFocus.focus();
                    } catch (e) {
                    }
                }
                if (stack.size() <= 1 && focusinHandler) {
                    document.removeEventListener('focusin', focusinHandler, true);
                    focusinHandler = null;
                }
                if (stack.size() <= 1 && tabHandler) {
                    document.removeEventListener('keydown', tabHandler);
                    tabHandler = null;
                }
            }
        };

        let keydownHandler = null;

        /**
         * Escape, for the top modal, after the page's own handlers (bubble phase): a key that a control inside used
         * already (an open dropdown closing itself calls preventDefault) or that belongs to an IME composition is left
         * alone, and so is a key in another (the page's own) open dialog. Otherwise its default is prevented: no close
         * request reaches a native dialog, so the browser never closes it on its own (it would at a second Escape in a
         * row, in the middle of the fade, as a close request can be cancelled only once without new input), and the
         * modal closes itself, with its fade, when close-on-esc. A held key (repeat) closes one modal, not the ones
         * under it.
         */
        const keys = {
            ensureBinding: function () {
                if (keydownHandler) return;
                keydownHandler = function (event) {
                    if (event.key !== 'Escape' && event.keyCode !== 27) return;
                    if (event.defaultPrevented || event.isComposing) return;
                    const top = stack.top();
                    if (!top) return;
                    const inDialog = event.target && event.target.closest ? event.target.closest('dialog[open]') : null;
                    if (inDialog && inDialog !== top.modalEl && !inDialog.classList.contains('aui-modal')) return;
                    event.preventDefault();
                    if (event.repeat) return;
                    if (top.getCloseOnEsc && top.getCloseOnEsc()) {
                        top.dismiss();
                    }
                };
                document.addEventListener('keydown', keydownHandler);
            },
            maybeReleaseBinding: function () {
                if (!keydownHandler) return;
                if (stack.size() > 0) return;
                document.removeEventListener('keydown', keydownHandler);
                keydownHandler = null;
            }
        };

        /**
         * Whether the browser itself keeps the page still under an open modal dialog: Chromium 144+ honours
         * overscroll-behavior: contain on the dialog and on its backdrop even where they do not scroll (the stylesheet
         * sets both), so the page is left untouched - its scrollbar, its layout, its fixed elements. That cannot be
         * feature-detected (a scroll is a user gesture), so the engine's version is read: from
         * navigator.userAgentData's Chromium brand, else from the user agent's Chrome/NNN (Edge, Opera and the other
         * Chromium browsers give their engine's version there; the old EdgeHTML Edge also says Chrome/ and is not
         * trusted). Anything else - an older Chromium, another engine, no version found - answers false, and the modal
         * locks the page's scroll itself (aui-modal _acquireBodyScrollLock). Read once.
         */
        let _cssHoldsPageMemo = null;

        function cssHoldsPage() {
            if (_cssHoldsPageMemo !== null) return _cssHoldsPageMemo;
            let version = 0;
            try {
                const data = window.navigator.userAgentData;
                if (data && Array.isArray(data.brands)) {
                    data.brands.forEach(function (entry) {
                        if (entry && entry.brand === 'Chromium') version = parseInt(entry.version, 10) || 0;
                    });
                }
                const agent = String(window.navigator.userAgent || '');
                if (!version && !/\bEdge\/\d/.test(agent)) {
                    const match = /\bChrome\/(\d+)\./.exec(agent);
                    if (match) version = parseInt(match[1], 10) || 0;
                }
            } catch (e) {
                version = 0;
            }
            _cssHoldsPageMemo = version >= 144;
            return _cssHoldsPageMemo;
        }

        return {
            useNativeDialog: useNativeDialog,
            cssHoldsPage: cssHoldsPage,
            stack: stack,
            layer: layer,
            focus: focus,
            keys: keys
        };
    }])

    /**
     * aui-modal: a native modal <dialog> (showModal: in the top layer, the page under it inert), or where the browser
     * has none, a fixed box over an overlay (auiModalRegistry: stacking, focus trap).
     * - Opening (is-open true, or openModal()): the dialog is shown, its closed look taken (a style read) and is-open
     *   set, so that its fade starts with the next frame. The body is built in the same digest; with
     *   defer-render="true" it is built right after the fade's first frame, in a digest of the page of its own (the
     *   header and the footer show at once, the body's place is kept): a large body then no longer holds the modal
     *   back, it fills in while the modal fades in (the fade runs on the compositor). The page under it is held still
     *   as it opens, before its first frame (see _acquireBodyScrollLock); initial-focus is focused after that frame.
     * - Closing: the fade starts at once. At its end the dialog is shut and the close finished in one digest of the
     *   page: the body destroyed, the scroll unlocked, on-close, is-open false. A close from inside the modal (its
     *   Close button, a button with aui-modal-close, Escape) comes outside any digest: the page learns of it (the
     *   button's action, then is-open false) in one digest of the page right after the fade's first frame, or first
     *   thing at the user's next input (kit.createPageDigest), so a press on the opener during the fade opens the
     *   modal again (the fade turns back). A modal closed before any frame of it was drawn is shut at once.
     * - Escape: auiModalRegistry.keys. background-opacity="OPAQUE_LIKE": a translucent, blurred box (as the select's
     *   panel); otherwise opaque.
     * - on-open: once per opening, as it opens (is-open true, before its first frame), in a digest of the page; opened
     *   again while it still fades out: no new call (the close is taken back, it has no on-close either).
     * - on-rendered: once per opening, when the body is built and linked (after the open digest, or with defer-render
     *   after the deferred one), in a digest of the page: where page code sets up the body (a broadcast to it, a
     *   drag-sort on its table). A timer started at the opening does not know when a deferred body is there.
     */
    .component('auiModal', {
        bindings: {
            isOpen: '=?',
            onOpen: '&?',                // once per opening, as it opens (see _reportOpen)
            onClose: '&?',
            onConfirm: '&?',
            size: '@?',
            width: '@?',
            height: '@?',
            contentLayout: '@?',
            initialFocus: '@?',
            borderRadius: '@?',
            showHeader: '@?',
            showFooter: '@?',
            showConfirmButton: '@?',
            confirmText: '@?',
            confirmLoadingText: '@?',
            displayOnTop: '@?',
            closeOnEsc: '@?',
            autoSize: '@?',
            deferRender: '@?',           // "true": the body is built right after the modal's first frame
            onRendered: '&?',            // once per opening, the body built: page code that sets it up (see _onFirstFrame)
            backgroundOpacity: '@?',     // "OPAQUE_LIKE": a translucent, blurred box; otherwise ("FULL") opaque
            ariaLabel: '@?',
            ariaLabelledby: '@?',
            ariaDescribedby: '@?'        // the dialog's description (the element read with its name), on the dialog itself
        },
        transclude: {
            header: '?header', content: '?content', footer: '?footer'
        },
        controller: ['$element', '$document', '$scope', '$timeout', '$q', '$exceptionHandler', '$transclude', 'auiModalRegistry', 'auiControlKit', 'auiTexts',
            function ($element, $document, $scope, $timeout, $q, $exceptionHandler, $transclude, auiModalRegistry, kit, texts) {
                const $ctrl = this;
                $ctrl.t = texts.modal;
                $ctrl.componentId = 'aui-modal-' + $scope.$id;
                // the page gives a <footer> of its own: the default Close / Confirm buttons are not built at all (built
                // and then replaced by it, the Confirm button's ng-if went on and threw without jQuery)
                $ctrl.ownFooter = $transclude.isSlotFilled('footer');

                $ctrl.state = 'closed';
                $ctrl.contentMounted = false;
                $ctrl.bodyMounted = false;
                $ctrl.confirmInFlight = false;
                $ctrl.shouldDisplayOnTop = false;
                $ctrl.bodyLockActive = false;
                $ctrl.useNative = true;

                let dialogEl = null;
                let fbModalEl = null;
                let fbOverlayEl = null;
                let stackEntry = null;
                let transitionToken = 0;
                let closeTimer = null;
                let cancelEnter = null;
                let shown = false;           // a frame of this opening has been drawn: its fade is on screen
                let opening = 0;             // the openings so far: a confirm's answer belongs to the one it started in
                let owedActions = [];
                let isDestroyed = false;
                // the digest of the page that a close from inside owes it (runOwed first)
                const pageDigest = kit.createPageDigest($scope, null, runOwed);

                const DEFAULT_WIDTH = '85vw';
                const DEFAULT_HEIGHT = '85vh';
                const MODAL_SIZES = {
                    fullScreen: {width: 'calc(100% - 2em - 6px)', height: 'calc(100% - 2em - 6px)'},
                    large:      {width: '80vw', height: 'calc(80vh - 40px)'},
                    medium:     {width: '60vw', height: 'calc(60vh - 40px)'},
                    small:      {width: '40vw', height: 'calc(40vh - 40px)'},
                };

                $ctrl.effectiveWidth = DEFAULT_WIDTH;
                $ctrl.effectiveHeight = DEFAULT_HEIGHT;

                $ctrl.$onInit = function () {
                    $ctrl.useNative = auiModalRegistry.useNativeDialog();
                    _applyConfig();
                };

                $ctrl.$onChanges = function () {
                    _applyConfig();
                };

                $ctrl.$postLink = function () {
                    if ($ctrl.useNative) {
                        dialogEl = _getDialogEl();
                        if (dialogEl) {
                            dialogEl.addEventListener('close', $ctrl.onModalClose);
                            dialogEl.addEventListener('cancel', $ctrl.onModalCancel);
                        }
                    } else {
                        fbModalEl = $element[0].querySelector('div.aui-modal--fallback');
                        if (fbModalEl) {
                            fbOverlayEl = document.createElement('div');
                            fbOverlayEl.className = 'aui-modal--fallback-overlay';
                            if (fbModalEl.parentNode) {
                                fbModalEl.parentNode.removeChild(fbModalEl);
                            }
                            fbOverlayEl.appendChild(fbModalEl);
                            // moved out of the component's element: its controller stays reachable from inside
                            // (aui-modal-close, require: '^^auiModal')
                            angular.element(fbModalEl).data('$auiModalController', $ctrl);
                        }
                    }
                    if ($ctrl.isOpen) {
                        $ctrl.openModal();
                    }
                };

                $scope.$watch(() => $ctrl.isOpen, (newVal) => {
                    if (newVal) {
                        $ctrl.openModal();
                    } else if ($ctrl.state === 'open') {
                        $ctrl.closeModal();
                    }
                });

                $ctrl.$onDestroy = function () {
                    runOwed();
                    isDestroyed = true;
                    pageDigest.forget();
                    _cancelCloseTimer();
                    _cancelEnter();
                    if ($ctrl.useNative) {
                        if (dialogEl) {
                            dialogEl.removeEventListener('close', $ctrl.onModalClose);
                            dialogEl.removeEventListener('cancel', $ctrl.onModalCancel);
                        }
                        _shut();
                    } else {
                        _shut();
                        // the box was moved out of the component's element, so AngularJS's own removal of that element
                        // never reaches it: removed here the same way, its data (scopes, controllers, bindings) let go -
                        // without jQuery that data stays in AngularJS's cache for good otherwise
                        if (fbOverlayEl) angular.element(fbOverlayEl).remove();
                        fbOverlayEl = null;
                        fbModalEl = null;
                    }
                    _popStack();
                    if ($ctrl.bodyLockActive) {
                        _releaseBodyScrollLock();
                    }
                };

                $ctrl.openModal = function () {
                    if ($ctrl.state === 'open' || isDestroyed) return;

                    transitionToken += 1;
                    _cancelCloseTimer();

                    if ($ctrl.useNative) {
                        _openNative();
                    } else {
                        _openFallback();
                    }
                };

                function _openNative() {
                    if (!dialogEl) dialogEl = _getDialogEl();
                    if (!(dialogEl && dialogEl.showModal instanceof Function)) {
                        $timeout(() => {
                            if (!isDestroyed && $ctrl.isOpen && $ctrl.state !== 'open') $ctrl.openModal();
                        }, 0);
                        return;
                    }

                    const shownBefore = dialogEl.open;    // opened again while it fades out: still shown
                    if (!shownBefore) {
                        dialogEl.style.transition = '';   // set when it was shut (see _shut)
                        try {
                            dialogEl.showModal();
                        } catch (e) {
                            $ctrl.state = 'closed';
                            $ctrl.isOpen = false;
                            return;
                        }
                    }
                    _enter(shownBefore);
                }

                function _openFallback() {
                    if (!fbModalEl || !fbOverlayEl) {
                        $timeout(() => {
                            if (!isDestroyed && $ctrl.isOpen && $ctrl.state !== 'open') $ctrl.openModal();
                        }, 0);
                        return;
                    }

                    const shownBefore = !!fbOverlayEl.parentNode;
                    if (!shownBefore) {
                        // under the body, the overlay no longer inherits from the modal's place in the page: the
                        // backdrop colour set there (on a section, a form) is taken along
                        const backdrop = window.getComputedStyle($element[0]).getPropertyValue('--aui-modal-backdrop-color').trim();
                        if (backdrop) fbOverlayEl.style.setProperty('--aui-modal-backdrop-color', backdrop);
                        else fbOverlayEl.style.removeProperty('--aui-modal-backdrop-color');
                        document.body.appendChild(fbOverlayEl);
                    }
                    _enter(shownBefore);
                }

                /**
                 * The opening, once the modal is shown: is-open set after its closed look was taken (a style read), so
                 * that the fade starts with the next frame; the body now (in this digest), or with defer-render after
                 * that frame. shownBefore: it was still shown, fading out (opened again): the fade turns back from
                 * where it is; the body, the focus and the scroll lock are kept.
                 */
                function _enter(shownBefore) {
                    const token = transitionToken;
                    $ctrl.state = 'open';
                    opening += 1;
                    $ctrl.confirmInFlight = false;    // a confirm of an opening before (closed while it saved) is not this one's
                    _modalEl().classList.remove('aui-modal--closing');
                    if (!shownBefore) {
                        shown = false;
                        // the page held still now, before the box's first frame: where the lock takes the page's
                        // scrollbar away, the page widens by it, and the box, centred in the page, is drawn where it stays
                        // (locked after that frame, the box jumped sideways and grew, and the whole page was laid out and
                        // drawn again in the middle of the fade, which stalled it)
                        _acquireBodyScrollLock();
                        // over another open modal: its backdrop dims less (two would darken the page twice)
                        const stacked = !stackEntry && auiModalRegistry.stack.anyOpen();
                        _motionEls().forEach(el => el.classList.toggle('aui-modal--stacked', stacked));
                        void window.getComputedStyle(_modalEl()).opacity;
                    }
                    _motionEls().forEach(el => el.classList.add('is-open'));
                    _pushStack();
                    // opened again while it faded out: the modals over it dim less again
                    if (shownBefore) auiModalRegistry.stack.restack();
                    $ctrl.contentMounted = true;
                    if (!$ctrl.deferRender) $ctrl.bodyMounted = true;
                    if ($ctrl.isOpen !== true) $ctrl.isOpen = true;
                    _cancelEnter();
                    cancelEnter = kit.afterFrame(() => _onFirstFrame(token, shownBefore));
                    if (!shownBefore) _reportOpen(token);
                }

                /**
                 * on-open: once per opening, as it opens - is-open true, in the page's digest, before the modal's first
                 * frame (the body is built in this digest; with defer-render after that frame: on-rendered says when).
                 * Opened again while it still fades out, the modal turns back: no new call (and no on-close for the close
                 * it took back), so each on-open is followed by one on-close when the modal closes. An error of the
                 * page's function goes to $exceptionHandler; the opening goes on.
                 */
                function _reportOpen(token) {
                    if (!($ctrl.onOpen instanceof Function)) return;
                    const call = function () {
                        if (token !== transitionToken || isDestroyed || $ctrl.state !== 'open') return;
                        try {
                            $ctrl.onOpen();
                        } catch (e) {
                            $exceptionHandler(e);
                        }
                    };
                    if ($scope.$root.$$phase) call();
                    else $scope.$apply(call);
                }

                // The opening's first frame is drawn (its fade goes on from there on the compositor, whatever the main
                // thread does): the deferred body (a digest of the page of its own), initial-focus, and on-rendered once
                // the body is built (opened again while it faded out: the body was kept, none of it)
                function _onFirstFrame(token, shownBefore) {
                    cancelEnter = null;
                    if (token !== transitionToken || isDestroyed || $ctrl.state !== 'open') return;
                    shown = true;
                    if (!$ctrl.bodyMounted) {
                        _digestPage(function () {
                            $ctrl.bodyMounted = true;
                            // once that digest has built and linked the body
                            if (!shownBefore) $scope.$$postDigest(function () { _reportRendered(token); });
                        });
                    } else if (!shownBefore) {
                        _reportRendered(token);
                    }
                    if (!shownBefore) _focusInitialElement();
                }

                // on-rendered, in a digest of the page of its own (only a modal that has it pays for that digest)
                function _reportRendered(token) {
                    if (!($ctrl.onRendered instanceof Function)) return;
                    if (token !== transitionToken || isDestroyed || $ctrl.state !== 'open' || !$ctrl.bodyMounted) return;
                    _digestPage(function () { $ctrl.onRendered(); });
                }

                function _focusInitialElement() {
                    if (!$ctrl.initialFocus) return;
                    if (!$ctrl.useNative && auiModalRegistry.stack.top() !== stackEntry) return;
                    const modalEl = _modalEl();
                    if (!modalEl) return;
                    // A selector is scoped to this modal; missing or invalid targets keep normal focus.
                    try {
                        const target = modalEl.querySelector($ctrl.initialFocus);
                        if (target && !target.matches(':disabled') && target.getClientRects().length > 0) {
                            target.focus({preventScroll: true});
                        }
                    } catch (e) { }
                }

                function _cancelEnter() {
                    if (cancelEnter) {
                        cancelEnter();
                        cancelEnter = null;
                    }
                }

                /** Closes the modal, with its fade (page code, in a digest or not). */
                $ctrl.closeModal = function () {
                    _close(null);
                };

                /**
                 * Closes the modal from inside it (aui-modal-close): the same, and action (the button's, page code) runs
                 * in the digest of the page that the close owes, before is-open turns false there. Not for an action
                 * that may keep the modal open (a save that can fail): that one closes it through is-open.
                 */
                $ctrl.dismiss = function (action) {
                    _close(typeof action === 'function' ? action : null);
                };

                function _close(action) {
                    if ($ctrl.state !== 'open' || isDestroyed) return;
                    const inDigest = !!$scope.$root.$$phase;
                    if (action) owedActions.push(action);
                    const token = ++transitionToken;
                    _cancelCloseTimer();
                    _cancelEnter();
                    if (!shown) {
                        // nothing of it drawn yet (closed in the turn it opened): shut at once, nothing to fade
                        _shut();
                        if (inDigest) _finalize();
                        else $scope.$apply(_finalize);
                        return;
                    }
                    $ctrl.state = 'closing';
                    _motionEls().forEach(el => el.classList.remove('is-open'));
                    _modalEl().classList.add('aui-modal--closing');
                    // a modal over this one now dims the page alone: its backdrop darkens as this one's fades out
                    auiModalRegistry.stack.restack();
                    closeTimer = setTimeout(function () {
                        closeTimer = null;
                        if (token !== transitionToken || isDestroyed) return;
                        _shut();
                        _digestPage(_finalize);
                    }, _exitDurationMs());
                    if (inDigest) runOwed();
                    else pageDigest.owe();
                }

                // The close's actions (page code), then is-open false: in a digest of the page
                function runOwed() {
                    const actions = owedActions;
                    owedActions = [];
                    actions.forEach(function (action) {
                        try {
                            action();
                        } catch (e) {
                            $exceptionHandler(e);
                        }
                    });
                    if ($ctrl.state !== 'open' && $ctrl.isOpen !== false) $ctrl.isOpen = false;
                }

                /**
                 * Off the screen and out of the way at once (its fade has ended, or nothing of it showed): the dialog
                 * closed without the stylesheet's display / overlay transitions (they keep a dialog that other code
                 * closes on screen for its fade; here they would leave an invisible layer over the page, taking its
                 * clicks); the fallback's overlay out of the page.
                 */
                function _shut() {
                    if ($ctrl.useNative) {
                        if (!dialogEl) return;
                        if (dialogEl.open) {
                            auiModalRegistry.layer.changed(dialogEl);
                            dialogEl.style.transition = 'none';
                            try {
                                dialogEl.close();
                            } catch (e) { }
                        }
                        dialogEl.classList.remove('is-open', 'aui-modal--closing');
                        return;
                    }
                    if (fbOverlayEl) {
                        if (fbOverlayEl.parentNode) auiModalRegistry.layer.changed(fbOverlayEl);
                        fbOverlayEl.classList.remove('is-open');
                        fbOverlayEl.style.zIndex = '';
                        if (fbOverlayEl.parentNode) fbOverlayEl.parentNode.removeChild(fbOverlayEl);
                    }
                    if (fbModalEl) fbModalEl.classList.remove('is-open', 'aui-modal--closing');
                }

                /** The close's end, in a digest of the page: the close's actions, the body destroyed, on-close. */
                function _finalize() {
                    pageDigest.forget();
                    runOwed();
                    transitionToken += 1;
                    _cancelCloseTimer();
                    _cancelEnter();

                    $ctrl.state = 'closed';
                    $ctrl.contentMounted = false;
                    $ctrl.bodyMounted = false;
                    $ctrl.confirmInFlight = false;
                    shown = false;
                    _popStack();
                    _releaseBodyScrollLock();

                    if ($ctrl.onClose instanceof Function) {
                        $ctrl.onClose();
                    }
                    if ($ctrl.isOpen !== false) {
                        $ctrl.isOpen = false;
                    }
                }

                function _pushStack() {
                    if (stackEntry) return;
                    stackEntry = auiModalRegistry.stack.push({
                        id: $ctrl.componentId,
                        overlayEl: $ctrl.useNative ? null : fbOverlayEl,
                        modalEl: _modalEl(),
                        isOpen: function () { return $ctrl.state === 'open'; },
                        setStacked: function (stacked) {
                            _motionEls().forEach(el => { if (el) el.classList.toggle('aui-modal--stacked', stacked); });
                        },
                        getCloseOnEsc: function () { return !!$ctrl.closeOnEsc; },
                        dismiss: function () { _close(null); }
                    });
                    if (!$ctrl.useNative) auiModalRegistry.focus.activate(stackEntry);
                    auiModalRegistry.keys.ensureBinding();
                }

                function _popStack() {
                    if (!stackEntry) return;
                    if (!$ctrl.useNative) auiModalRegistry.focus.deactivate(stackEntry);
                    auiModalRegistry.stack.pop(stackEntry.id);
                    auiModalRegistry.keys.maybeReleaseBinding();
                    stackEntry = null;
                }

                function _digestPage(fn) {
                    if ($scope.$root.$$phase) $scope.$applyAsync(fn);
                    else $scope.$apply(fn);
                }

                $ctrl.handleConfirm = function (event) {
                    if (event && event.stopPropagation) event.stopPropagation();
                    if ($ctrl.confirmInFlight) return;

                    if (!($ctrl.onConfirm instanceof Function)) {
                        $ctrl.closeModal();
                        return;
                    }

                    const result = $ctrl.onConfirm();
                    if (result === false) return;

                    // a promise (also one made in another window, an editor in a frame: its Function is that window's)
                    if (result && typeof result.then === 'function') {
                        // the answer of this opening's confirm: one that comes after the modal was closed and opened
                        // again belongs to the opening before, and neither closes this one nor ends its loading. Through
                        // $q: a promise of the browser's own (an async function, fetch) settles outside AngularJS's
                        // digest, and the Confirm button would stay busy after a failed save until some other digest.
                        const own = opening;
                        $ctrl.confirmInFlight = true;
                        $q.when(result).then(
                            (value) => {
                                if (own !== opening) return;
                                $ctrl.confirmInFlight = false;
                                if (value !== false) {
                                    $scope.$evalAsync(() => {
                                        if (own === opening) $ctrl.closeModal();
                                    });
                                }
                            },
                            () => {
                                if (own === opening) $ctrl.confirmInFlight = false;
                            }
                        );
                        return;
                    }

                    $ctrl.closeModal();
                };

                // Closed by other code (dialog.close(), a form with method="dialog"): the close, as if asked (the
                // stylesheet's display / overlay transitions keep the dialog on screen for the fade). Its own shut, and
                // a close while it fades out (the fade's timer ends it), are left alone.
                // A close event that arrives while the dialog is shown again belongs to a close before this opening (the
                // browser sends it a task later: the page opened the modal again from on-close in the meantime): left
                // alone, or it would close the new opening.
                $ctrl.onModalClose = function (event) {
                    if (event && event.target !== dialogEl) return;
                    if ($ctrl.state !== 'open' || isDestroyed) return;
                    if (dialogEl && dialogEl.open) return;
                    _close(null);
                };

                // A close request that the keys did not take (another source): the modal closes itself, with its fade.
                // A cancel event from inside (a file input's) is not the dialog's.
                $ctrl.onModalCancel = function (event) {
                    if (event.target !== dialogEl) return;
                    event.preventDefault();
                    if ($ctrl.closeOnEsc) _close(null);
                };

                function _cancelCloseTimer() {
                    if (closeTimer) {
                        clearTimeout(closeTimer);
                        closeTimer = null;
                    }
                }

                // The closing motion's length: the longest transition (duration and delay) of the box and of its
                // backdrop, taken once is-open is off (no transitions: 0); at most 1 s, so that a stylesheet never keeps
                // the page blocked
                function _exitDurationMs() {
                    const el = _modalEl();
                    if (!el) return 0;
                    const styles = [window.getComputedStyle(el)];
                    if ($ctrl.useNative) styles.push(window.getComputedStyle(el, '::backdrop'));
                    else if (fbOverlayEl) styles.push(window.getComputedStyle(fbOverlayEl, '::before'));
                    let longest = 0;
                    styles.forEach(function (style) {
                        const durations = String(style.transitionDuration || '').split(',');
                        const delays = String(style.transitionDelay || '').split(',');
                        durations.forEach(function (duration, i) {
                            const ms = _toMs(duration) + _toMs(delays[i % delays.length]);
                            if (ms > longest) longest = ms;
                        });
                    });
                    return Math.min(Math.round(longest), 1000);
                }

                function _toMs(value) {
                    const text = String(value || '').trim();
                    const number = parseFloat(text);
                    if (!Number.isFinite(number) || number < 0) return 0;
                    return /ms$/.test(text) ? number : number * 1000;
                }

                function _modalEl() {
                    return $ctrl.useNative ? dialogEl : fbModalEl;
                }

                function _motionEls() {
                    return $ctrl.useNative ? [dialogEl] : [fbOverlayEl, fbModalEl];
                }

                function _applyConfig() {
                    $ctrl.showHeader = _normalizeBoolean($ctrl.showHeader, true);
                    $ctrl.showFooter = _normalizeBoolean($ctrl.showFooter, true);
                    $ctrl.showConfirmButton = _normalizeBoolean($ctrl.showConfirmButton, false);
                    $ctrl.displayOnTop = _normalizeBoolean($ctrl.displayOnTop, false);
                    $ctrl.closeOnEsc = _normalizeBoolean($ctrl.closeOnEsc, false);
                    $ctrl.autoSize = _normalizeBoolean($ctrl.autoSize, false);
                    $ctrl.deferRender = _normalizeBoolean($ctrl.deferRender, false);

                    $ctrl.fillContent = $ctrl.contentLayout === 'fill';
                    const radius = $ctrl.borderRadius == null || String($ctrl.borderRadius).trim() === ''
                        ? NaN : Number($ctrl.borderRadius);
                    $ctrl.effectiveBorderRadius = Number.isFinite(radius) && radius >= 0 ? radius + 'px' : undefined;
                    $ctrl.shouldDisplayOnTop = $ctrl.displayOnTop && $ctrl.size === 'medium';
                    $ctrl.background = kit.panelBackgroundStyle($ctrl.backgroundOpacity) || {};
                    _setSize();
                }

                function _normalizeBoolean(value, defaultValue) {
                    if (value === true || value === 'true') return true;
                    if (value === false || value === 'false') return false;
                    return defaultValue;
                }

                function _getDialogEl() {
                    if (!$ctrl.useNative) return null;
                    return dialogEl || $element[0].querySelector('dialog.aui-modal');
                }

                /**
                 * width / height: each on its own; the other one comes from size (or the default). A number is a share
                 * of the window (55: 55vw, 55vh; from 5 to 100), anything else a CSS length (480px, 30rem, 50%,
                 * calc(...)) the browser accepts. A preset dimension keeps a minimum on a small window (the stylesheet:
                 * aui-modal--preset-width / -height).
                 */
                function _setSize() {
                    const preset = Object.prototype.hasOwnProperty.call(MODAL_SIZES, $ctrl.size)
                        ? MODAL_SIZES[$ctrl.size] : {width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT};
                    const width = _lengthOf($ctrl.width, 'vw');
                    const height = _lengthOf($ctrl.height, 'vh');
                    $ctrl.effectiveWidth = width || preset.width;
                    $ctrl.effectiveHeight = height || preset.height;
                    $ctrl.presetWidth = !width;
                    $ctrl.presetHeight = !height;
                    // display-on-top: 16vh higher than centred (a native dialog: its bottom inset; the fallback: its
                    // top), but never so far that the box leaves the window - a tall one (98vh) lost its heading above
                    // the window, or its footer below it. The room left by its height, else the box's auto-size cap.
                    const tall = $ctrl.autoSize ? '88vh' : $ctrl.effectiveHeight;
                    $ctrl.topOffset = 'max(0px, min(16vh, calc(100vh - (' + tall + ') - 2em - 6px)))';
                }

                function _lengthOf(value, unit) {
                    const text = String(value == null ? '' : value).trim();
                    if (!text) return null;
                    if (/^\d+(\.\d+)?$/.test(text)) {
                        const share = Number(text);
                        return share >= 5 && share <= 100 ? share + unit : null;
                    }
                    try {
                        return window.CSS && CSS.supports('width', text) ? text : null;
                    } catch (e) {
                        return null;
                    }
                }


                /**
                 * The page under the open modal held still. Where the browser does that itself
                 * (auiModalRegistry.cssHoldsPage(): the stylesheet's overscroll-behavior on the dialog and its backdrop)
                 * nothing on the page is touched. Elsewhere the page's scroll is locked: taken before the modal's first
                 * frame (_enter), given back once the modal is shut (_finalize), one lock for the modals open at once (a
                 * count on the body). The page scrolls through its root element when that has an overflow of its own
                 * (html { overflow-y: scroll }, or overflow-x hidden, which makes the other axis auto), through the body
                 * otherwise (the body's overflow is the page's then): that one is set to hidden, so that neither a wheel
                 * nor a key moves the page - locking only the body would leave such a page scrolling. The scrollbar that
                 * goes is given back as padding on the body, so that the page's content does not move, unless the page
                 * keeps the scrollbar's place itself (scrollbar-gutter: stable: the place stays, padding would double it).
                 * The page's own inline values are put back exactly.
                 */
                function _acquireBodyScrollLock() {
                    if ($ctrl.bodyLockActive) return;
                    if ($ctrl.useNative && auiModalRegistry.cssHoldsPage()) return;
                    $ctrl.bodyLockActive = true;

                    const bodyEl = $document[0].body;
                    const rootEl = $document[0].documentElement;
                    const lockState = _getBodyLockState(bodyEl);
                    lockState.count += 1;
                    if (lockState.count > 1) return;

                    const rootStyle = window.getComputedStyle(rootEl);
                    const scroller = rootStyle.overflowX !== 'visible' || rootStyle.overflowY !== 'visible' ? rootEl : bodyEl;
                    const scrollbarWidth = Math.max(0, window.innerWidth - rootEl.clientWidth);
                    const gutterKept = /stable/.test(rootStyle.scrollbarGutter || '');
                    lockState.snapshot = {
                        scroller: scroller,
                        overflow: _inlineOf(scroller, 'overflow'),
                        overflowX: _inlineOf(scroller, 'overflow-x'),
                        overflowY: _inlineOf(scroller, 'overflow-y'),
                        paddingRight: _inlineOf(bodyEl, 'padding-right')
                    };

                    scroller.style.overflow = 'hidden';
                    scroller.style.overflowX = 'hidden';
                    scroller.style.overflowY = 'hidden';

                    if (scrollbarWidth > 0 && !gutterKept) {
                        const originalPadding = parseFloat(window.getComputedStyle(bodyEl).paddingRight) || 0;
                        bodyEl.style.paddingRight = `${originalPadding + scrollbarWidth}px`;
                    }
                }

                function _releaseBodyScrollLock() {
                    if (!$ctrl.bodyLockActive) return;
                    $ctrl.bodyLockActive = false;

                    const bodyEl = $document[0].body;
                    const lockState = _getBodyLockState(bodyEl);
                    lockState.count = Math.max(0, lockState.count - 1);
                    if (lockState.count > 0 || !lockState.snapshot) return;

                    const snapshot = lockState.snapshot;
                    const scroller = snapshot.scroller || bodyEl;
                    // the shorthand first: putting it back (or taking it away) sets both of its parts
                    _putInline(scroller, 'overflow', snapshot.overflow);
                    _putInline(scroller, 'overflow-x', snapshot.overflowX);
                    _putInline(scroller, 'overflow-y', snapshot.overflowY);
                    _putInline(bodyEl, 'padding-right', snapshot.paddingRight);
                    lockState.snapshot = null;
                }

                // a page's own inline value with its priority (!important), put back as it was
                function _inlineOf(el, name) {
                    return {value: el.style.getPropertyValue(name), priority: el.style.getPropertyPriority(name)};
                }

                function _putInline(el, name, saved) {
                    if (saved && saved.value) el.style.setProperty(name, saved.value, saved.priority);
                    else el.style.removeProperty(name);
                }

                function _getBodyLockState(bodyEl) {
                    if (!bodyEl.__auiModalScrollLockState) {
                        bodyEl.__auiModalScrollLockState = { count: 0, snapshot: null };
                    }
                    return bodyEl.__auiModalScrollLockState;
                }
            }
        ],
        template: ['auiModalRegistry', function (auiModalRegistry) {
            // the footer: the page's own <footer>, or the default buttons - never both built (see ownFooter). Its actions
            // wrap to a second line where the box is too narrow for one. The Confirm button shows confirm-loading-text
            // while on-confirm's promise runs (the button's own loading-text: a label is hidden while it loads). The
            // header's and the footer's layout and spacing are in the stylesheet (.aui-modal__header, .aui-modal__footer),
            // where a page can change them; inline, they could only be overridden with !important.
            const FOOTER = 'class="aui-modal__footer"';
            // the body's place while defer-render waits for the first frame: aui-modal__content--pending
            const INNER = `
                        <div class="aui-modal__container" aui-modal-mount="$ctrl.contentMounted"
                             style="width: 100%;height: 100%;display: flex;flex-direction: column;">
                            <div class="aui-modal__header" ng-if="$ctrl.showHeader" ng-transclude="header"></div>
                            <div class="aui-modal__content" aui-modal-mount="$ctrl.bodyMounted" ng-transclude="content"
                                 style="display: flex;flex-direction: row;flex: 1;overflow-y: auto;"></div>
                            <div class="aui-modal__content aui-modal__content--pending" aui-modal-mount="!$ctrl.bodyMounted" aria-busy="true"
                                 style="display: flex;flex-direction: row;flex: 1;overflow-y: auto;"></div>
                            <div ${FOOTER} ng-if="$ctrl.showFooter && $ctrl.ownFooter" ng-transclude="footer"></div>
                            <div ${FOOTER} ng-if="$ctrl.showFooter && !$ctrl.ownFooter">
                                <aui-button variant="outline" intent="neutral" aui-modal-close>{{ ::$ctrl.t.close }}</aui-button>
                                <aui-button intent="brand"
                                            ng-if="$ctrl.showConfirmButton"
                                            loading="$ctrl.confirmInFlight"
                                            loading-text="{{ $ctrl.confirmLoadingText }}"
                                            ng-click="$ctrl.handleConfirm($event)">{{ $ctrl.confirmText || $ctrl.t.confirm }}</aui-button>
                            </div>
                        </div>`;

            if (auiModalRegistry.useNativeDialog()) {
                return `
                    <dialog closedby="{{ $ctrl.closeOnEsc ? 'closerequest' : 'none' }}"
                            class="aui-modal aui-scroll" id="{{$ctrl.componentId}}"
                            role="dialog" aria-modal="true"
                            ng-attr-aria-label="{{$ctrl.ariaLabel || (!$ctrl.ariaLabelledby ? $ctrl.t.dialog : undefined)}}"
                            ng-attr-aria-labelledby="{{$ctrl.ariaLabelledby || undefined}}"
                            ng-attr-aria-describedby="{{$ctrl.ariaDescribedby || undefined}}"
                            ng-class="{
                                'aui-modal--full-screen': $ctrl.size === 'fullScreen',
                                'aui-modal--auto':        $ctrl.autoSize,
                                'aui-modal--content-fill': $ctrl.fillContent,
                                'aui-modal--deferred':    $ctrl.deferRender,
                                'aui-modal--preset-width':  $ctrl.presetWidth,
                                'aui-modal--preset-height': $ctrl.presetHeight
                            }"
                            ng-style="{
                                'width': $ctrl.effectiveWidth,
                                'height': $ctrl.effectiveHeight,
                                'border-radius': $ctrl.effectiveBorderRadius,
                                'bottom': $ctrl.shouldDisplayOnTop ? $ctrl.topOffset : undefined,
                                'background-color': $ctrl.background['background-color'],
                                'backdrop-filter': $ctrl.background['backdrop-filter'],
                                '-webkit-backdrop-filter': $ctrl.background['-webkit-backdrop-filter']
                            }">${INNER}
                    </dialog>
                `;
            }
            return `
                    <div class="aui-modal aui-modal--fallback aui-scroll" id="{{$ctrl.componentId}}"
                         role="dialog" aria-modal="true"
                         ng-attr-aria-label="{{$ctrl.ariaLabel || (!$ctrl.ariaLabelledby ? $ctrl.t.dialog : undefined)}}"
                         ng-attr-aria-labelledby="{{$ctrl.ariaLabelledby || undefined}}"
                         ng-attr-aria-describedby="{{$ctrl.ariaDescribedby || undefined}}"
                         ng-class="{
                             'aui-modal--full-screen': $ctrl.size === 'fullScreen',
                             'aui-modal--display-top': $ctrl.shouldDisplayOnTop,
                             'aui-modal--auto':        $ctrl.autoSize,
                             'aui-modal--content-fill': $ctrl.fillContent,
                             'aui-modal--deferred':    $ctrl.deferRender,
                             'aui-modal--preset-width':  $ctrl.presetWidth,
                             'aui-modal--preset-height': $ctrl.presetHeight
                         }"
                         ng-style="{
                             'width': $ctrl.effectiveWidth,
                             'height': $ctrl.effectiveHeight,
                             'top': $ctrl.shouldDisplayOnTop ? $ctrl.topOffset : undefined,
                             'border-radius': $ctrl.effectiveBorderRadius,
                             'background-color': $ctrl.background['background-color'],
                             'backdrop-filter': $ctrl.background['backdrop-filter'],
                             '-webkit-backdrop-filter': $ctrl.background['-webkit-backdrop-filter']
                         }">${INNER}
                    </div>
                `;
        }]
    })

    /**
     * aui-modal-close: on a button inside an aui-modal (its own Close, the buttons of the message box and of
     * AuiModal.open, or a page's): a press closes the modal at once, with its fade, outside any digest; the attribute's
     * expression (if any, page code) runs right after the fade's first frame, in the one digest of the page that the
     * close owes. For actions that cannot keep the modal open (cancel, close, an OK that only answers); one that may
     * (a save that can fail) keeps ng-click and closes the modal through is-open. A disabled button does nothing.
     */
    .directive('auiModalClose', [function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                const onClick = function (event) {
                    const button = event.target && event.target.closest ? event.target.closest('button') : null;
                    if (button && button.disabled) return;
                    const modal = element.controller('auiModal');
                    if (!modal || !(modal.dismiss instanceof Function)) return;
                    const expression = attrs.auiModalClose;
                    modal.dismiss(expression ? function () { scope.$eval(expression, {$event: event}); } : null);
                };
                element[0].addEventListener('click', onClick);
                scope.$on('$destroy', function () {
                    element[0].removeEventListener('click', onClick);
                });
            }
        };
    }])

    /**
     * aui-modal-mount: ng-if for the modals' parts (their body, and the message box itself) and the toasts', without $animate. ng-if
     * removes its element through $animate.leave() and waits on its promise, which digests the whole page once more a
     * frame later: after every close of a modal and every deferred body. Here the part is built, or destroyed and
     * removed, in the digest that changes the value, and nothing follows.
     */
    .directive('auiModalMount', [function () {
        return {
            transclude: 'element',
            priority: 600,
            terminal: true,
            restrict: 'A',
            $$tlb: true,
            link: function (scope, element, attrs, ctrl, transclude) {
                let part = null;
                let partScope = null;
                scope.$watch(attrs.auiModalMount, function (value) {
                    if (value && !partScope) {
                        transclude(function (clone, newScope) {
                            partScope = newScope;
                            part = clone;
                            element.after(clone);
                        });
                    } else if (!value && partScope) {
                        partScope.$destroy();
                        partScope = null;
                        part.remove();
                        part = null;
                    }
                });
            }
        };
    }]);
