/**
 * AuiMessageBox: alert and confirm dialogs.
 */
angular.module('aui')
    .factory('AuiMessageBox', ['$rootScope', '$timeout', 'AuiSafeHtml', '$q', 'auiTexts',
        function ($rootScope, $timeout, AuiSafeHtml, $q, texts) {

            const state = {current: null, queue: []};

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

            function trust(value) {
                return AuiSafeHtml.trust(value);
            }

            function asFn(v) {
                return typeof v === 'function' ? v : null;
            }

            function resolveTitle(cfg) {
                if (cfg.title === undefined) return DEFAULT_TITLE_BY_TYPE[cfg.type] || null;
                return cfg.title === '' ? null : cfg.title;
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
                    confirmText: cfg.confirmText,
                    cancelText: cfg.cancelText,
                    showCancel: !!cfg.showCancel,
                    showConfirm: cfg.showConfirm !== false,
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
                            }
                        }
                    },
                    _promise: deferred.promise
                };
                if (item.useHtml) item._trustedMessage = trust(item.message);
                return item;
            }

            function show(input) {
                const item = buildItem(input);
                if (state.current) state.queue.push(item);
                else state.current = item;
                kickDigest();
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
                    }
                }
                // The box is gone now, in the digest that ends its close (no digest of the page only for that); a queued
                // box follows on the next turn, once this one's element is gone
                if (state.current !== cur) return;
                state.current = null;
                kickDigest();
                if (state.queue.length > 0) {
                    const next = state.queue.shift();
                    $timeout(function () {
                        if (!state.current) state.current = next;
                        else state.queue.unshift(next);
                    }, 0);
                }
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
                _onAfterClose: onAfterClose
            };
        }])

    .component('auiMessageBoxHost', {
        controller: ['AuiMessageBox', 'auiTexts', function (AuiMessageBox, texts) {
            const $ctrl = this;
            $ctrl.t = texts.modal;
            $ctrl.svc = AuiMessageBox;
            $ctrl.handleConfirm    = function () { AuiMessageBox._confirmCurrent(); };
            $ctrl.handleCancel     = function () { AuiMessageBox._cancelCurrent(); };
            $ctrl.handleAfterClose = function () { AuiMessageBox._onAfterClose(); };
        }],
        template: `
            <aui-modal aui-modal-mount="$ctrl.svc.state.current"
                       is-open="$ctrl.svc.state.current.isOpen"
                       on-close="$ctrl.handleAfterClose()"
                       show-header="false"
                       show-footer="false"
                       auto-size="true"
                       aria-label="{{$ctrl.svc.state.current.title || $ctrl.t.titles.info}}"
                       close-on-esc="{{ $ctrl.svc.state.current.closeOnEsc ? 'true' : 'false' }}">
                <content>
                    <div class="aui-message-box aui-message-box--{{$ctrl.svc.state.current.type}}"
                         ng-class="{ 'aui-message-box--with-title': !!$ctrl.svc.state.current.title }">
                        <div class="aui-message-box__body">
                            <span class="aui-message-box__icon" aria-hidden="true"></span>
                            <h3 class="aui-message-box__title"
                                ng-if="$ctrl.svc.state.current.title"
                                ng-bind="$ctrl.svc.state.current.title"></h3>
                            <div class="aui-message-box__content"
                                 ng-if="!$ctrl.svc.state.current.useHtml"
                                 ng-bind="$ctrl.svc.state.current.message"></div>
                            <div class="aui-message-box__content"
                                 ng-if="$ctrl.svc.state.current.useHtml"
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
