/**
 * AuiMessageBox: alert and confirm dialogs.
 */
angular.module('aui')
    .factory('AuiMessageBox', ['$rootScope', '$timeout', '$exceptionHandler', 'AuiSafeHtml', '$q', 'auiTexts',
        function ($rootScope, $timeout, $exceptionHandler, AuiSafeHtml, $q, texts) {

            // current: the box shown; next: the box whose turn comes once the closed one's element is gone (a box
            // asked for meanwhile waits behind it); queue: the boxes after them, in the order they were asked for
            const state = {current: null, next: null, queue: []};

            function kickDigest() {
                $rootScope.$evalAsync(angular.noop);
            }

            const DEFAULT_TITLE_BY_TYPE = texts.modal.titles;

            const DEFAULTS = {
                type: 'info',
                title: undefined,
                message: '',
                useHtml: false,
                confirmText: texts.modal.ok,
                cancelText: texts.modal.cancel,
                showCancel: false,
                showConfirm: true,
                closeOnEsc: true,
                dangerConfirm: false,
                confirmCallback: null,
                cancelCallback: null,
                closeCallback: null
            };

            function coerce(input) {
                if (input == null) return {};
                return typeof input === 'string' ? {message: input} : input;
            }

            function asFn(v) {
                return typeof v === 'function' ? v : null;
            }

            // title: unset, the type's own ("Error"); empty, null or only spaces, none (the box is named by its type then)
            function resolveTitle(cfg) {
                if (cfg.title === undefined) return DEFAULT_TITLE_BY_TYPE[cfg.type] || null;
                if (cfg.title === null) return null;
                const text = String(cfg.title);
                return text.trim() === '' ? null : text;
            }

            // a button's caption: an empty or blank one (a translation missing) is the default's, never a nameless button
            function caption(value, fallback) {
                return value == null || String(value).trim() === '' ? fallback : String(value);
            }

            // the page's own function failed: told to the application's $exceptionHandler (its error reporting), and
            // the box goes on (its answer is the user's)
            function report(error) {
                try {
                    $exceptionHandler(error);
                } catch (e) { /* a handler that throws itself: nothing more to tell */ }
            }

            function buildItem(input) {
                const cfg = angular.extend({}, DEFAULTS, coerce(input));
                const deferred = $q.defer();
                const item = {
                    isOpen: true,
                    type: cfg.type,
                    title: resolveTitle(cfg),
                    message: cfg.message,
                    useHtml: !!cfg.useHtml,
                    _trustedMessage: null,
                    confirmText: caption(cfg.confirmText, texts.modal.ok),
                    cancelText: caption(cfg.cancelText, texts.modal.cancel),
                    showCancel: !!cfg.showCancel,
                    // a box always has a way out: with neither button its OK shows (no button and no Escape: it stayed,
                    // and every box after it waited for good)
                    showConfirm: cfg.showConfirm !== false || !cfg.showCancel,
                    closeOnEsc: cfg.closeOnEsc !== false,
                    dangerConfirm: !!cfg.dangerConfirm,
                    _onConfirm: asFn(cfg.confirmCallback),
                    _onCancel: asFn(cfg.cancelCallback),
                    _onClose: asFn(cfg.closeCallback),
                    _resolved: false,
                    _resolve: function (value) {
                        if (item._resolved) return;
                        item._resolved = true;
                        deferred.resolve(value);
                        const cb = value ? item._onConfirm : item._onCancel;
                        if (cb) {
                            try {
                                cb();
                            } catch (e) {
                                report(e);
                            }
                        }
                    },
                    _promise: deferred.promise
                };
                return item;
            }

            // The box shown now: its formatted message made only now (a long queue of rich messages is not formatted
            // all at once, while one box at a time can show), and a digest of the page to draw it
            function becomeCurrent(item) {
                if (item.useHtml && item._trustedMessage === null) item._trustedMessage = AuiSafeHtml.trust(item.message);
                state.current = item;
                kickDigest();
            }

            // A box asked for while another shows, or while the next one's turn is kept, waits in the queue: the page
            // shows nothing new, so no digest of it
            function show(input) {
                const item = buildItem(input);
                if (state.current || state.next) state.queue.push(item);
                else becomeCurrent(item);
                return item._promise;
            }

            function confirmCurrent() {
                const cur = state.current;
                if (!cur) return;
                cur._resolve(true);
                cur.isOpen = false;
            }

            function cancelCurrent() {
                const cur = state.current;
                if (!cur) return;
                cur._resolve(false);
                cur.isOpen = false;
            }

            function onAfterClose() {
                const cur = state.current;
                if (!cur) return;
                cur._resolve(false);
                if (cur._onClose) {
                    try {
                        cur._onClose();
                    } catch (e) {
                        report(e);
                    }
                }
                // The box is gone now, in the digest that ends its close (no digest of the page only for that); a queued
                // box follows on the next turn, once this one's element is gone
                if (state.current !== cur) return;
                state.current = null;
                kickDigest();
                handOver();
            }

            // The next box of the queue gets its turn on the next turn of the browser, and keeps it meanwhile: a box
            // asked for in between (by the answer of the one that closed: Escape settles it a step later than its
            // buttons) waits behind it, in the order they were asked for
            function handOver() {
                if (state.next || state.queue.length === 0) return;
                const next = state.queue.shift();
                state.next = next;
                $timeout(function () {
                    if (state.next !== next) return;
                    state.next = null;
                    if (!state.current) becomeCurrent(next);
                    else state.queue.unshift(next);
                }, 0);
            }

            // The host went (its application, or a page that removed it): the box it showed cannot be answered any
            // more - it answers false (on-close runs), and the boxes after it wait for a host
            function hostGone() {
                const cur = state.current;
                if (!cur) return;
                cur.isOpen = false;
                onAfterClose();
            }

            function shortcut(type, presetShowCancel) {
                return function (m, o = {}) {
                    if (m && typeof m === 'object' && !Array.isArray(m)) {
                        return show(angular.extend(
                            {type: type, showCancel: !!presetShowCancel},
                            m
                        ));
                    }
                    return show(angular.extend(
                        {type: type, showCancel: !!presetShowCancel},
                        o,
                        {message: m}
                    ));
                };
            }

            return {
                state: state,
                show: show,
                alert: shortcut('info', false),
                confirm: shortcut('question', true),
                success: shortcut('success', false),
                info: shortcut('info', false),
                warning: shortcut('warning', false),
                error: shortcut('error', false),
                question: shortcut('question', true),
                _confirmCurrent: confirmCurrent,
                _cancelCurrent: cancelCurrent,
                _onAfterClose: onAfterClose,
                _hostGone: hostGone
            };
        }])

    /**
     * aui-scroll-focus="expression": a message that scrolls (more text than its room) can be reached from the keyboard:
     * while it scrolls it has a place in the Tab order (tabindex 0), so that Shift+Tab from the box's buttons goes back to
     * it and the arrow and page keys scroll it (the fallback's focus round skipped it). A message that fits takes none.
     * Checked after the message is drawn (the expression changes) and when the window is resized.
     */
    .directive('auiScrollFocus', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                const el = element[0];
                let frame = 0;
                function check() {
                    frame = 0;
                    if (el.scrollHeight > el.clientHeight + 1) el.setAttribute('tabindex', '0');
                    else el.removeAttribute('tabindex');
                }
                function later() {
                    if (!frame) frame = window.requestAnimationFrame(check);
                }
                scope.$watch(attrs.auiScrollFocus, later);
                window.addEventListener('resize', later);
                scope.$on('$destroy', function () {
                    window.removeEventListener('resize', later);
                    if (frame) window.cancelAnimationFrame(frame);
                });
            }
        };
    })

    .component('auiMessageBoxHost', {
        controller: ['$scope', 'AuiMessageBox', 'auiTexts', function ($scope, AuiMessageBox, texts) {
            const $ctrl = this;
            $ctrl.t = texts.modal;
            $ctrl.svc = AuiMessageBox;
            // the box's message describes it: a screen reader says the question with the box's name, not only "Confirm"
            $ctrl.messageId = 'aui-message-box-text-' + $scope.$id;
            $ctrl.handleConfirm    = function () { AuiMessageBox._confirmCurrent(); };
            $ctrl.handleCancel     = function () { AuiMessageBox._cancelCurrent(); };
            $ctrl.handleAfterClose = function () { AuiMessageBox._onAfterClose(); };
            // the box's name: its title, else its type's ("Error", "Confirm"): a box shown without a heading still says
            // what kind of box it is (it said "Notice" for every type)
            $ctrl.label = function () {
                const cur = AuiMessageBox.state.current;
                if (!cur) return $ctrl.t.titles.info;
                return cur.title || $ctrl.t.titles[cur.type] || $ctrl.t.titles.info;
            };
            $ctrl.$onDestroy = function () { AuiMessageBox._hostGone(); };
        }],
        template: `
            <aui-modal aui-modal-mount="$ctrl.svc.state.current"
                       is-open="$ctrl.svc.state.current.isOpen"
                       on-close="$ctrl.handleAfterClose()"
                       show-header="false"
                       show-footer="false"
                       auto-size="true"
                       content-layout="fill"
                       aria-label="{{ $ctrl.label() }}"
                       aria-describedby="{{ $ctrl.messageId }}"
                       close-on-esc="{{ $ctrl.svc.state.current.closeOnEsc ? 'true' : 'false' }}">
                <content>
                    <div class="aui-message-box aui-message-box--{{$ctrl.svc.state.current.type}}"
                         ng-class="{ 'aui-message-box--with-title': !!$ctrl.svc.state.current.title }">
                        <div class="aui-message-box__body">
                            <span class="aui-message-box__icon" aria-hidden="true"></span>
                            <h3 class="aui-message-box__title"
                                ng-if="$ctrl.svc.state.current.title"
                                ng-bind="$ctrl.svc.state.current.title"></h3>
                            <div class="aui-message-box__content" id="{{ ::$ctrl.messageId }}"
                                 ng-if="!$ctrl.svc.state.current.useHtml"
                                 aui-scroll-focus="$ctrl.svc.state.current.message"
                                 ng-bind="$ctrl.svc.state.current.message"></div>
                            <div class="aui-message-box__content" id="{{ ::$ctrl.messageId }}"
                                 ng-if="$ctrl.svc.state.current.useHtml"
                                 aui-scroll-focus="$ctrl.svc.state.current._trustedMessage"
                                 ng-bind-html="$ctrl.svc.state.current._trustedMessage"></div>
                        </div>
                        <footer class="aui-message-box__actions">
                            <aui-button variant="outline" intent="neutral"
                                        ng-if="$ctrl.svc.state.current.showCancel"
                                        aui-modal-close="$ctrl.handleCancel()">{{ $ctrl.svc.state.current.cancelText }}</aui-button>
                            <aui-button intent="{{ $ctrl.svc.state.current.dangerConfirm ? 'danger' : 'brand' }}"
                                        ng-if="$ctrl.svc.state.current.showConfirm"
                                        aui-modal-close="$ctrl.handleConfirm()">{{ $ctrl.svc.state.current.confirmText }}</aui-button>
                        </footer>
                    </div>
                </content>
            </aui-modal>
        `
    });
