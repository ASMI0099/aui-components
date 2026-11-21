/**
 * AuiMessage: short notices (toasts) at the top of the page.
 */
angular.module('aui')
    /**
     * The message services, shown by the hosts below: AuiMessage (toasts), AuiMessageBox (message and confirm boxes),
     * AuiModal (dialogs opened from code). The run block mounts the three hosts once in the page's body and puts the
     * services on window as well (window.AuiMessage, window.AuiMessageBox, window.AuiModal: page code calls them
     * there too).
     */
    .factory('AuiMessage', ['$rootScope', '$timeout', 'AuiSafeHtml',
        function ($rootScope, $timeout, AuiSafeHtml) {

            const EXIT_MS = 180;
            const ENTER_MS = 240;
            const POSITIONS = {'top-right': true, 'top-center': true};

            let nextId = 1;
            const state = {
                'top-right': [],
                'top-center': []
            };

            // The host (aui-message-host) draws a change with a digest of its own: a message's countdown, its leaving
            // and the pointer on it change nothing else on the page. Before the host is there (page code that runs
            // before it is mounted), a digest of the page.
            let renderHost = null;

            function kickDigest() {
                $rootScope.$evalAsync(angular.noop);
            }

            function notify() {
                if (renderHost) renderHost();
                else kickDigest();
            }

            function now() {
                return window.performance && typeof window.performance.now === 'function'
                    ? window.performance.now() : Date.now();
            }

            const DEFAULTS = {
                type: 'info',
                title: null,
                message: '',
                useHtml: false,
                duration: 3500,
                dismissible: true,
                position: 'top-right',
                onClose: null
            };

            function coerce(input) {
                if (input == null) return {};
                return typeof input === 'string' ? {message: input} : input;
            }

            function trust(value) {
                return AuiSafeHtml.trust(value);
            }

            function normPosition(p) {
                return POSITIONS[p] ? p : 'top-right';
            }

            /*
             * The countdown: its end as a time (_deadline) while it runs, the time it has left (_left) while the pointer
             * holds it (_paused). Its bar (the host's progress line) is drawn again from full whenever the countdown
             * starts over (_barCycle), so that the two always end together.
             */
            function startCountdown(item, ms) {
                cancelAutoDismiss(item);
                item._deadline = now() + ms;
                item._timer = $timeout(function () {
                    item._timer = null;
                    beginExit(item);
                }, ms, false);
            }

            function cancelAutoDismiss(item) {
                if (item && item._timer) {
                    $timeout.cancel(item._timer);
                    item._timer = null;
                }
            }

            // The whole countdown from its start: a new message, an update with a duration, a message brought back.
            // Held by the pointer: it starts when the pointer leaves.
            function restartCountdown(item) {
                cancelAutoDismiss(item);
                if (!(item.duration > 0)) {
                    item._paused = false;
                    return;
                }
                if (item._paused) {
                    item._left = item.duration;
                    return;
                }
                startCountdown(item, item.duration);
            }

            function beginExit(item) {
                if (!item || item.state !== 'visible') return;
                cancelAutoDismiss(item);
                item._paused = false;
                item.state = 'leaving';
                item._removeTimer = $timeout(function () {
                    item._removeTimer = null;
                    remove(item);
                }, EXIT_MS, false);
                notify();
            }

            function remove(item) {
                const list = state[item.position];
                const idx = list.indexOf(item);
                if (idx >= 0) list.splice(idx, 1);
                item.state = 'gone';
                notify();
                const onClose = item.onClose;
                item._handleClose = null;
                item.onClose = null;
                if (typeof onClose === 'function') {
                    try {
                        onClose();
                    } catch (e) { /* user code must never break us */
                    }
                    // page code: the page shows what it changed (one digest of the page for messages that close together)
                    $rootScope.$applyAsync();
                }
            }

            function add(input) {
                const raw = coerce(input);
                const cfg = angular.extend({}, DEFAULTS, raw);

                // Type-specific implicit defaults (only when the caller didn't set them).
                if (cfg.type === 'loading') {
                    if (raw.duration === undefined) cfg.duration = 0;
                    if (raw.dismissible === undefined) cfg.dismissible = false;
                } else if (cfg.type === 'error') {
                    if (raw.duration === undefined) cfg.duration = 5000;
                }

                const position = normPosition(cfg.position);
                const item = {
                    id: nextId++,
                    type: cfg.type,
                    title: cfg.title,
                    message: cfg.message,
                    useHtml: !!cfg.useHtml,
                    _trustedMessage: null,
                    dismissible: cfg.dismissible !== false,
                    duration: (typeof cfg.duration === 'number' && cfg.duration >= 0)
                        ? cfg.duration : DEFAULTS.duration,
                    onClose: (typeof cfg.onClose === 'function') ? cfg.onClose : null,
                    position: position,
                    state: 'visible',          // 'visible', 'leaving' (its exit), 'gone'
                    entered: false,
                    _timer: null,
                    _removeTimer: null,
                    _paused: false,
                    _deadline: 0,
                    _left: 0,
                    _barCycle: 0,              // the countdown started over: its bar drawn again from full
                    _pulse: 0,                 // updated: a short highlight
                    _handleClose: null
                };
                if (item.useHtml) item._trustedMessage = trust(item.message);

                item._handleClose = function () {
                    beginExit(item);
                };

                state[position].push(item);
                restartCountdown(item);
                // the enter animation's class off once it has run, without a digest of its own: the host's next digest
                // shows it, at the latest the one that starts the exit
                $timeout(function () { item.entered = true; }, ENTER_MS, false);
                notify();

                return {
                    id: item.id,
                    close: function () {
                        beginExit(item);
                    },
                    update: function (patch) {
                        update(item, patch);
                    }
                };
            }

            function update(item, patch) {
                if (!item || item.state === 'gone' || !patch) return;
                // updated while it leaves (its time ran out a moment ago, or it was closed): it stays, with the new
                // content, and its countdown starts over; on-close does not run
                const revived = item.state === 'leaving';
                if (revived) {
                    if (item._removeTimer) $timeout.cancel(item._removeTimer);
                    item._removeTimer = null;
                    item.state = 'visible';
                }
                if (patch.hasOwnProperty('type')) item.type = patch.type;
                if (patch.hasOwnProperty('title')) item.title = patch.title;
                if (patch.hasOwnProperty('useHtml')) item.useHtml = !!patch.useHtml;
                if (patch.hasOwnProperty('message')) item.message = patch.message;
                if (patch.hasOwnProperty('dismissible')) item.dismissible = patch.dismissible !== false;
                item._trustedMessage = item.useHtml ? trust(item.message) : null;
                item._pulse += 1;

                const hasDuration = patch.hasOwnProperty('duration');
                if (hasDuration && typeof patch.duration === 'number' && patch.duration >= 0) {
                    item.duration = patch.duration;
                }
                if (hasDuration || revived) {
                    item._barCycle += 1;
                    restartCountdown(item);
                }
                notify();
            }

            function pause(item) {
                if (!item || item.state !== 'visible' || item._paused || !(item.duration > 0)) return;
                item._paused = true;
                item._left = Math.max(0, item._deadline - now());
                cancelAutoDismiss(item);
            }

            function resume(item) {
                if (!item || item.state !== 'visible' || !item._paused) return;
                item._paused = false;
                if (!(item.duration > 0)) return;
                // the time it had left; none (held just as its time ran out, before its timer came): it leaves now,
                // never with its whole time again
                if (item._left > 0) startCountdown(item, item._left);
                else beginExit(item);
            }

            function clearAll() {
                Object.keys(state).forEach(function (pos) {
                    const snap = state[pos].slice();
                    for (let i = 0; i < snap.length; i++) beginExit(snap[i]);
                });
            }

            function find(id) {
                const positions = Object.keys(state);
                for (let p = 0; p < positions.length; p += 1) {
                    const list = state[positions[p]];
                    for (let i = 0; i < list.length; i += 1) {
                        if (list[i].id === id) return list[i];
                    }
                }
                return null;
            }

            // the host tells how it draws a change; returns how to stop
            function attach(render) {
                renderHost = render;
                return function () {
                    if (renderHost === render) renderHost = null;
                };
            }

            function shortcut(type) {
                return function (m, o = {}) {
                    if (m && typeof m === 'object' && !Array.isArray(m)) {
                        return add(angular.extend({}, m, {type: type}));
                    }
                    return add(angular.extend({}, o, {type: type, message: m}));
                };
            }

            return {
                state: state,
                show: add,
                success: shortcut('success'),
                info: shortcut('info'),
                warning: shortcut('warning'),
                error: shortcut('error'),
                loading: shortcut('loading'),
                clearAll: clearAll,
                _pause: pause,
                _resume: resume,
                _find: find,
                _attach: attach
            };
        }])

    .component('auiMessageHost', {
        controller: ['$element', '$scope', 'AuiMessage', 'auiModalRegistry', 'auiControlKit', 'auiTexts',
            function ($element, $scope, AuiMessage, registry, kit, texts) {
            const $ctrl = this;
            $ctrl.t = texts.modal;
            $ctrl.svc = AuiMessage;
            $ctrl.positions = ['top-right', 'top-center'];

            let hostEl = null;
            let supportsPopover = false;
            let popoverShown = false;
            let destroyed = false;
            const cleanups = [];

            function totalCount() {
                return AuiMessage.state['top-right'].length + AuiMessage.state['top-center'].length;
            }

            // Digest this host only (the messages change nothing else on the page; a digest the page waits for runs
            // instead: see kit.digestOwn), then its place
            function render() {
                if (destroyed) return;
                if ($scope.$root.$$phase) $scope.$evalAsync(angular.noop);
                else kit.digestOwn($scope);
                place(null);
            }

            /**
             * Where the messages are shown, as a popover (the top layer, above everything): while a modal dialog is open,
             * inside the topmost one, else in the host's own element. Every node outside an open modal dialog is inert:
             * drawn, but neither the pointer nor the keyboard reaches it (a message could not be held or closed). A
             * popover's place in the page does not move it on the screen: the top layer is laid out against the window,
             * whatever the transforms and the overflow of its ancestors. Moved, it is shown again (a popover taken out of
             * the page is hidden), on top. leaving: a dialog about to close (a place no more). Without popovers (older
             * browsers) the stacks' z-index keeps them above the fallback's overlays, and nothing is inert there.
             */
            function place(leaving) {
                if (destroyed || !hostEl || !supportsPopover) return;
                const target = registry.layer.topDialog(leaving) || $element[0];
                let running = null;
                if (hostEl.parentNode !== target) {
                    running = animationsNow();
                    target.appendChild(hostEl);
                    popoverShown = false;
                }
                if (totalCount() === 0) {
                    if (popoverShown) {
                        try { hostEl.hidePopover(); } catch (e) { }
                    }
                    popoverShown = false;
                    return;
                }
                if (!popoverShown) {
                    try { hostEl.showPopover(); popoverShown = true; } catch (e) { }
                }
                if (running) resumeAnimations(running);
            }

            // A node moved in the page starts its CSS animations over: a message that had come in would come in again
            // (shown while a dialog closed, it moves out of it), its countdown bar fill up again. Each animation running
            // before the move goes on from where it was; one that had ended stays ended.
            function animationsNow() {
                if (typeof hostEl.getAnimations !== 'function') return null;
                return hostEl.getAnimations({subtree: true}).filter(a => a.animationName).map(a => ({
                    target: a.effect && a.effect.target, pseudo: a.effect && a.effect.pseudoElement, name: a.animationName, time: a.currentTime
                }));
            }

            function resumeAnimations(before) {
                hostEl.getAnimations({subtree: true}).forEach(function (a) {
                    if (!a.animationName || !a.effect) return;
                    const was = before.find(w => w.target === a.effect.target && w.pseudo === a.effect.pseudoElement && w.name === a.animationName);
                    try {
                        if (!was) a.finish();
                        else if (was.time !== null) a.currentTime = was.time;
                    } catch (e) { /* an endless one (a spinner) has no end to finish at */ }
                });
            }

            function itemAt(el) {
                const box = el && el.closest ? el.closest('.aui-message') : null;
                return box ? AuiMessage._find(Number(box.getAttribute('data-aui-message-id'))) : null;
            }

            function listen(type, fn, capture) {
                hostEl.addEventListener(type, fn, capture);
                cleanups.push(function () { hostEl.removeEventListener(type, fn, capture); });
            }

            $ctrl.$postLink = function () {
                hostEl = $element[0].querySelector('.aui-message-host');
                if (!hostEl) return;
                supportsPopover = typeof hostEl.showPopover === 'function';
                if (supportsPopover) hostEl.setAttribute('popover', 'manual');
                // the pointer on a message holds its countdown; its close button closes it (no digest of the page)
                listen('mouseenter', function (event) {
                    if (!event.target.classList || !event.target.classList.contains('aui-message')) return;
                    const item = itemAt(event.target);
                    if (!item) return;
                    AuiMessage._pause(item);
                    render();
                }, true);
                listen('mouseleave', function (event) {
                    if (!event.target.classList || !event.target.classList.contains('aui-message')) return;
                    const item = itemAt(event.target);
                    if (!item) return;
                    AuiMessage._resume(item);
                    render();
                }, true);
                listen('click', function (event) {
                    const button = event.target && event.target.closest ? event.target.closest('.aui-message__close') : null;
                    const item = button ? itemAt(button) : null;
                    if (item && item._handleClose) item._handleClose();
                });
                cleanups.push(AuiMessage._attach(render));
                cleanups.push(registry.layer.subscribe(place));
                render();    // messages added before the host was there
            };

            $ctrl.$onDestroy = function () {
                destroyed = true;
                cleanups.forEach(function (fn) { fn(); });
                if (!hostEl) return;
                if (popoverShown) {
                    try { hostEl.hidePopover(); } catch (e) { }
                }
                if (hostEl.parentNode && hostEl.parentNode !== $element[0]) hostEl.parentNode.removeChild(hostEl);
            };
        }],
        template: `
            <div class="aui-message-host">
                <div class="aui-message-host__stack aui-message-host__stack--{{pos}}"
                     ng-repeat="pos in $ctrl.positions"
                     aria-live="polite">
                    <div class="aui-message aui-message--{{m.type}}"
                         data-aui-message-id="{{m.id}}"
                         ng-class="{
                             'aui-message--enter':      !m.entered,
                             'aui-message--leaving':    m.state === 'leaving',
                             'aui-message--with-title': !!m.title
                         }"
                         ng-repeat="m in $ctrl.svc.state[pos] track by m.id">
                        <span class="aui-message__pulse" aria-hidden="true"
                              ng-repeat="p in [m._pulse] track by p" aui-modal-mount="m._pulse > 0"></span>
                        <span class="aui-message__icon" aria-hidden="true"></span>
                        <div class="aui-message__body">
                            <div class="aui-message__title"
                                 aui-modal-mount="m.title"
                                 ng-bind="m.title"></div>
                            <div class="aui-message__content"
                                 aui-modal-mount="!m.useHtml"
                                 ng-bind="m.message"></div>
                            <div class="aui-message__content"
                                 aui-modal-mount="m.useHtml"
                                 ng-bind-html="m._trustedMessage"></div>
                        </div>
                        <button type="button" class="aui-message__close"
                                aui-modal-mount="m.dismissible"
                                aria-label="{{ ::$ctrl.t.close }}">&times;</button>
                        <div class="aui-message__progress"
                             ng-repeat="c in [m._barCycle] track by c"
                             aui-modal-mount="m.duration > 0 && m.state !== 'leaving'"
                             ng-style="{ 'animation-duration': m.duration + 'ms', 'animation-play-state': m._paused ? 'paused' : 'running' }"></div>
                    </div>
                </div>
            </div>
        `
    });
