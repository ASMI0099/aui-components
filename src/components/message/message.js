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
    .factory('AuiMessage', ['$rootScope', '$timeout', '$exceptionHandler', 'AuiSafeHtml',
        function ($rootScope, $timeout, $exceptionHandler, AuiSafeHtml) {

            // the exit's length in the stylesheet (.aui-message--leaving): removed when it has ended
            const EXIT_MS = 300;
            const ENTER_MS = 240;
            // the longest wait a browser's timer keeps (about 24.8 days): a longer duration overflowed it and the
            // message left at once
            const MAX_DELAY_MS = 2147483647;
            const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
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
                }, Math.min(ms, MAX_DELAY_MS), false);
            }

            function cancelAutoDismiss(item) {
                if (item && item._timer) {
                    $timeout.cancel(item._timer);
                    item._timer = null;
                }
            }

            // The whole countdown from its start: a new message, an update with a duration, a message brought back.
            // Held by the pointer: it starts when the pointer leaves.
            // Held by the pointer or by the keyboard's focus (also while it had no countdown: one given by an update
            // starts when it is let go)
            function restartCountdown(item) {
                if (!(item.duration > 0)) {
                    cancelAutoDismiss(item);
                    item._paused = false;
                    return;
                }
                if (item._paused || item._hover || item._focus) {
                    cancelAutoDismiss(item);
                    item._paused = true;
                    item._left = item.duration;
                    return;
                }
                startCountdown(item, item.duration);
            }

            // the page's own function failed (on-close): told to the application's $exceptionHandler
            function report(error) {
                try {
                    $exceptionHandler(error);
                } catch (e) { /* a handler that throws itself: nothing more to tell */ }
            }

            function beginExit(item, quiet) {
                if (!item || item.state !== 'visible') return false;
                cancelAutoDismiss(item);
                item._paused = false;
                item.state = 'leaving';
                if (!quiet) {
                    item._removeTimer = $timeout(function () {
                        item._removeTimer = null;
                        remove(item);
                    }, EXIT_MS, false);
                    notify();
                }
                return true;
            }

            /*
             * Out of its stack (the host draws it gone, unless quiet: several at once draw once). What it showed is let
             * go: a page that keeps the returned handle (its close and update hold the item) does not keep its message
             * alive - the handle does nothing any more.
             */
            function remove(item, quiet) {
                const list = state[item.position];
                const idx = list.indexOf(item);
                if (idx >= 0) list.splice(idx, 1);
                item.state = 'gone';
                if (!quiet) notify();
                const onClose = item.onClose;
                item.onClose = null;
                item.message = '';
                item.title = null;
                item._trustedMessage = null;
                if (typeof onClose === 'function') {
                    try {
                        onClose();
                    } catch (e) {
                        report(e);
                    }
                    // page code: the page shows what it changed (one digest of the page for messages that close together)
                    $rootScope.$applyAsync();
                }
            }

            function add(input) {
                const given = coerce(input);
                // an option given as undefined (passed along by a helper of the page) is not given: its default holds
                const raw = {};
                Object.keys(given).forEach(function (key) {
                    if (given[key] !== undefined) raw[key] = given[key];
                });
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
                    _hover: false,             // the pointer is on it
                    _focus: false,             // the keyboard's focus is in it
                    _deadline: 0,
                    _left: 0,
                    _barCycle: 0,              // the countdown started over: its bar drawn again from full
                    _pulse: 0,                 // updated: a short highlight
                    _handleClose: null
                };
                if (item.useHtml) item._trustedMessage = AuiSafeHtml.trust(item.message);

                // its close: the Close button's and the handle's (late calls, after it is gone, do nothing)
                const close = function () {
                    beginExit(item);
                };
                item._handleClose = close;

                state[position].push(item);
                restartCountdown(item);
                // the enter animation's class off once it has run, without a digest of its own: the host's next digest
                // shows it, at the latest the one that starts the exit
                $timeout(function () { item.entered = true; }, ENTER_MS, false);
                notify();

                return {
                    id: item.id,
                    close: close,
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
                    // its own removal timer is cancelled; one shared with others (clearAll) only forgets it
                    if (item._removeTimer && !isShared(item._removeTimer)) $timeout.cancel(item._removeTimer);
                    item._removeTimer = null;
                    item.state = 'visible';
                }
                const before = {message: item.message, useHtml: item.useHtml};
                if (has(patch, 'type') && patch.type !== undefined) item.type = patch.type;
                if (has(patch, 'title')) item.title = patch.title;
                if (has(patch, 'useHtml')) item.useHtml = !!patch.useHtml;
                if (has(patch, 'message')) item.message = patch.message;
                if (has(patch, 'dismissible')) item.dismissible = patch.dismissible !== false;
                // formatted again only when its message or its kind changed (a title or a duration alone: kept)
                if (item.message !== before.message || item.useHtml !== before.useHtml || (item.useHtml && item._trustedMessage === null)) {
                    item._trustedMessage = item.useHtml ? AuiSafeHtml.trust(item.message) : null;
                }
                item._pulse += 1;

                const hasDuration = has(patch, 'duration');
                if (hasDuration && typeof patch.duration === 'number' && patch.duration >= 0) {
                    item.duration = patch.duration;
                }
                if (hasDuration || revived) {
                    item._barCycle += 1;
                    restartCountdown(item);
                }
                notify();
            }

            /*
             * Held by the pointer (hover) and by the keyboard's focus (focus): its countdown waits while either holds
             * it. Returns whether its countdown changed (a notice that has none changes nothing: no drawing).
             */
            function hold(item, by, on) {
                if (!item || item.state !== 'visible') return false;
                const key = by === 'focus' ? '_focus' : '_hover';
                if (item[key] === on) return false;
                item[key] = on;
                if (on) return pause(item);
                return item._hover || item._focus ? false : resume(item);
            }

            function pause(item) {
                if (!item || item.state !== 'visible' || item._paused || !(item.duration > 0)) return false;
                item._paused = true;
                item._left = Math.max(0, item._deadline - now());
                cancelAutoDismiss(item);
                return true;
            }

            function resume(item) {
                if (!item || item.state !== 'visible' || !item._paused) return false;
                item._paused = false;
                if (!(item.duration > 0)) return true;
                // the time it had left; none (held just as its time ran out, before its timer came): it leaves now,
                // never with its whole time again
                if (item._left > 0) startCountdown(item, item._left);
                else beginExit(item);
                return true;
            }

            // All at once: one drawing for their exit and one for their removal (each drew twice of its own)
            function clearAll() {
                const leaving = [];
                Object.keys(state).forEach(function (pos) {
                    state[pos].slice().forEach(function (item) {
                        if (beginExit(item, true)) leaving.push(item);
                    });
                });
                if (!leaving.length) return;
                notify();
                const timer = $timeout(function () {
                    leaving.forEach(function (item) {
                        if (item._removeTimer === timer && item.state === 'leaving') {
                            item._removeTimer = null;
                            remove(item, true);
                        }
                    });
                    notify();
                }, EXIT_MS, false);
                leaving.forEach(function (item) { item._removeTimer = timer; });
            }

            function isShared(timer) {
                let count = 0;
                Object.keys(state).forEach(function (pos) {
                    state[pos].forEach(function (other) { if (other._removeTimer === timer) count += 1; });
                });
                return count > 1;
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
                _hold: hold,
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
            // a notice without a title says its kind as text (the icon is a picture only): "Error: ..."
            $ctrl.typeText = function (type) {
                return texts.modal.titles[type] || (type === 'loading' ? texts.list.loading : '');
            };

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
                const mark = focusMark();
                const places = glideMark();
                if ($scope.$root.$$phase) {
                    $scope.$evalAsync(angular.noop);
                    $scope.$$postDigest(function () {
                        if (mark) focusBack(mark);
                        // after this digest's classes (ng-class puts them on in a turn of its own, queued before
                        // this one): the notices' new places
                        if (places) $scope.$$postDigest(function () { glide(places); });
                    });
                } else {
                    kit.digestOwn($scope);
                    if (mark) focusBack(mark);
                    glide(places);
                }
                place(null);
            }

            /*
             * A notice removed: the ones after it close the gap by gliding up into their new places (they jumped there
             * in one frame). Each one's place on the screen is measured before the change and after it, and it moves
             * from the first to the second by a transform, added to an entrance or an exit still running. A notice
             * still gliding when another goes adds the new glide to the one it has: it moves on from where it is drawn.
             * A browser that cannot add animations: the new glide takes over from where it is drawn, and a notice
             * still coming in or leaving (its own motion is a transform too, which a glide would replace) does not
             * glide. The same when a notice comes and moves others (a phone's column: the notices under it go down).
             * Not with reduced motion.
             */
            const GLIDE_MS = 220;
            const GLIDE_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
            const additive = typeof window.KeyframeEffect === 'function' && 'composite' in window.KeyframeEffect.prototype;
            const glides = new Map();   // where animations cannot add: each notice's running glide

            function cards() {
                return hostEl ? Array.prototype.slice.call(hostEl.querySelectorAll('.aui-message-host__stack > .aui-message')) : [];
            }

            // The notices that stay, each with its place, when the change about to be drawn adds or removes one; else
            // null (a countdown, a hold, an update: nothing moves, nothing is measured)
            function glideMark() {
                if (destroyed || !hostEl) return null;
                const list = cards();
                if (!list.length || typeof list[0].animate !== 'function') return null;
                const ids = {};
                let count = 0;
                $ctrl.positions.forEach(function (pos) {
                    AuiMessage.state[pos].forEach(function (item) {
                        ids[item.id] = true;
                        count += 1;
                    });
                });
                const staying = list.filter(function (el) { return ids[el.getAttribute('data-aui-message-id')] === true; });
                if (staying.length === list.length && list.length === count) return null;
                if (!staying.length || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return null;
                const places = new Map();
                staying.forEach(function (el) { places.set(el, el.getBoundingClientRect().top); });
                return places;
            }

            function glide(places) {
                if (!places || destroyed || !hostEl) return;
                if (!additive) {
                    // the glides running: they took the notices to where they are drawn now (measured as their places)
                    glides.forEach(function (animation) { animation.cancel(); });
                    glides.clear();
                }
                // every place measured before the first glide starts (one layout)
                const moves = [];
                cards().forEach(function (el) {
                    if (!places.has(el)) return;
                    if (!additive && (el.classList.contains('aui-message--leaving') || el.classList.contains('aui-message--enter'))) return;
                    const dy = places.get(el) - el.getBoundingClientRect().top;
                    if (Math.abs(dy) > 0.5) moves.push({el: el, dy: dy});
                });
                moves.forEach(function (move) {
                    const options = {duration: GLIDE_MS, easing: GLIDE_EASING};
                    if (additive) options.composite = 'add';
                    try {
                        const animation = move.el.animate([
                            {transform: 'translateY(' + move.dy + 'px)'},
                            {transform: 'translateY(0)'}
                        ], options);
                        if (!additive) {
                            glides.set(move.el, animation);
                            animation.onfinish = function () {
                                if (glides.get(move.el) === animation) glides.delete(move.el);
                            };
                        }
                    } catch (e) { /* no glide: the notice stands in its new place at once */ }
                });
            }

            /*
             * A link in a notice's message has the focus while the notice is updated (its progress, a count): the new
             * message replaces the old one's elements, and the focus fell to the page. It goes to the same link in the
             * new message (the same address and text, else the one at the same place); none there, the notice no
             * longer holds its countdown for the focus.
             */
            function focusMark() {
                const active = document.activeElement;
                if (!active || !hostEl || !hostEl.contains(active) || !active.closest) return null;
                const content = active.closest('.aui-message__content');
                const card = active.closest('.aui-message');
                if (!content || !card) return null;
                return {
                    id: card.getAttribute('data-aui-message-id'), el: active, tag: active.tagName,
                    href: active.getAttribute('href'), text: active.textContent,
                    index: Array.prototype.indexOf.call(content.querySelectorAll(active.tagName), active)
                };
            }

            function focusBack(mark) {
                if (destroyed || !hostEl || document.contains(mark.el)) return;
                const active = document.activeElement;
                if (active && active !== document.body && active !== document.documentElement) return;
                const card = hostEl.querySelector('.aui-message[data-aui-message-id="' + mark.id + '"]');
                const content = card ? card.querySelector('.aui-message__content') : null;
                const same = content ? Array.prototype.slice.call(content.querySelectorAll(mark.tag)) : [];
                const match = same.filter(function (el) {
                    return el.getAttribute('href') === mark.href && el.textContent === mark.text;
                })[0] || same[mark.index];
                if (match && typeof match.focus === 'function') {
                    kit.focusQuietly(match);
                    if (document.activeElement === match) return;
                }
                const item = AuiMessage._find(Number(mark.id));
                if (item && AuiMessage._hold(item, 'focus', false)) render();
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
                if (destroyed || !hostEl) return;
                // a native modal dialog (with popovers), else a fallback's overlay (its focus is kept inside it: the
                // notices go in, after its box, where Tab reaches them), else home
                const target = (supportsPopover ? registry.layer.topDialog(leaving) : null) ||
                    registry.layer.topOverlay(leaving) || $element[0];
                let running = null;
                if (hostEl.parentNode !== target) {
                    running = animationsNow();
                    target.appendChild(hostEl);
                    popoverShown = false;
                }
                if (!supportsPopover) {
                    if (running) resumeAnimations(running);
                    return;
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
                // looked up by element (each has one or two): matched in one pass, not a search of all per animation
                const byTarget = new Map();
                before.forEach(function (w) {
                    const list = byTarget.get(w.target);
                    if (list) list.push(w);
                    else byTarget.set(w.target, [w]);
                });
                hostEl.getAnimations({subtree: true}).forEach(function (a) {
                    if (!a.animationName || !a.effect) return;
                    const was = (byTarget.get(a.effect.target) || []).filter(w => w.pseudo === a.effect.pseudoElement && w.name === a.animationName)[0];
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
                // The pointer on a message holds its countdown - a mouse's or a pen's: a touch taps it and is lifted (a
                // tap left it held as if hovered, for good). The keyboard's focus in it holds it too (a link being
                // read, its Close). Drawn only when its countdown changed (a notice without one changes nothing).
                // Its close button closes it (no digest of the page).
                const pointer = typeof window.PointerEvent === 'function';
                const onCard = event => !!(event.target.classList && event.target.classList.contains('aui-message'));
                listen(pointer ? 'pointerenter' : 'mouseenter', function (event) {
                    if (event.pointerType === 'touch' || !onCard(event)) return;
                    const item = itemAt(event.target);
                    if (item && AuiMessage._hold(item, 'hover', true)) render();
                }, true);
                listen(pointer ? 'pointerleave' : 'mouseleave', function (event) {
                    if (event.pointerType === 'touch' || !onCard(event)) return;
                    const item = itemAt(event.target);
                    if (item && AuiMessage._hold(item, 'hover', false)) render();
                }, true);
                listen('focusin', function (event) {
                    const item = itemAt(event.target);
                    if (item && AuiMessage._hold(item, 'focus', true)) render();
                });
                listen('focusout', function (event) {
                    const card = event.target.closest ? event.target.closest('.aui-message') : null;
                    if (!card || (event.relatedTarget && card.contains(event.relatedTarget))) return;
                    const item = itemAt(card);
                    if (item && AuiMessage._hold(item, 'focus', false)) render();
                });
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
                glides.forEach(function (animation) { animation.cancel(); });
                glides.clear();
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
                         ng-repeat="m in $ctrl.svc.state[pos]">
                        <span class="aui-message__pulse" aria-hidden="true"
                              ng-repeat="p in [m._pulse]" aui-modal-mount="m._pulse > 0"></span>
                        <span class="aui-message__icon" aria-hidden="true"></span>
                        <div class="aui-message__body">
                            <span class="aui-message__type" aui-modal-mount="!m.title && $ctrl.typeText(m.type)">{{ $ctrl.typeText(m.type) }}: </span>
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
                             ng-repeat="c in [m._barCycle]"
                             aui-modal-mount="m.duration > 0 && m.state !== 'leaving'"
                             ng-style="{ 'animation-duration': m.duration + 'ms', 'animation-play-state': m._paused ? 'paused' : 'running' }"></div>
                    </div>
                </div>
            </div>
        `
    });
