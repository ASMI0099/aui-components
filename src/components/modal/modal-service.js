/**
 * AuiModal: dialogs opened from code.
 */
angular.module('aui')
    /*
     * Imperative facade for the declarative <aui-modal> component.
     * `open({content})` renders plain text. For rich content, provide
     * `render(container, controls)` and optionally return a cleanup function.
     * Optional `contentLayout: 'fill'` removes modal padding and outer scrolling.
     * `borderRadius` is in pixels; `initialFocus` is a selector scoped to the modal.
     * Omit these options to retain the standard modal presentation and focus behavior.
     * The returned promise resolves after close and exposes close()/dismiss().
     */
    .factory('AuiModal', ['$rootScope', '$timeout', '$q', '$exceptionHandler', 'auiTexts',
        function ($rootScope, $timeout, $q, $exceptionHandler, texts) {
            const state = {current: null, queue: []};
            let sequence = 0;
            let advancingQueue = false;
            const defaults = {
                title: '',
                ariaLabel: '',
                content: '',
                render: null,
                contentClass: '',
                contentLayout: 'default',
                initialFocus: '',
                borderRadius: null,
                size: 'medium',
                width: null,
                height: null,
                showHeader: true,
                showFooter: true,
                showCancel: true,
                showConfirm: false,
                cancelText: texts.modal.close,
                confirmText: texts.modal.ok,
                closeOnEsc: true,
                autoSize: false,
                displayOnTop: false,
                backgroundOpacity: null,
                onConfirm: null,
                onCancel: null,
                onClose: null
            };

            function kickDigest() {
                $rootScope.$evalAsync(angular.noop);
            }

            function asFunction(value) {
                return typeof value === 'function' ? value : null;
            }

            // the page's own function failed (on-cancel, on-close, render, its cleanup): told to the application's
            // $exceptionHandler (its error reporting); the dialog goes on as it would have
            function report(error) {
                try {
                    $exceptionHandler(error);
                } catch (e) { /* a handler that throws itself: nothing more to tell */ }
            }

            function buildItem(input) {
                const config = angular.extend({}, defaults,
                    typeof input === 'string' ? {content: input} : (input || {}));
                const deferred = $q.defer();
                const item = {
                    id: 'aui-modal-' + (++sequence),
                    isOpen: true,
                    title: String(config.title || ''),
                    ariaLabel: String(config.ariaLabel || ''),
                    content: config.content,
                    render: asFunction(config.render),
                    contentClass: String(config.contentClass || ''),
                    contentLayout: config.contentLayout === 'fill' ? 'fill' : 'default',
                    initialFocus: typeof config.initialFocus === 'string' ? config.initialFocus : '',
                    borderRadius: config.borderRadius == null ? '' : String(config.borderRadius),
                    size: config.size ? String(config.size) : '',
                    width: config.width == null ? '' : String(config.width),
                    height: config.height == null ? '' : String(config.height),
                    showHeader: config.showHeader !== false,
                    showFooter: config.showFooter !== false,
                    showCancel: config.showCancel !== false,
                    showConfirm: config.showConfirm === true,
                    cancelText: String(config.cancelText || texts.modal.close),
                    confirmText: String(config.confirmText || texts.modal.ok),
                    closeOnEsc: config.closeOnEsc !== false,
                    autoSize: config.autoSize === true,
                    displayOnTop: config.displayOnTop === true,
                    backgroundOpacity: config.backgroundOpacity == null
                        ? ''
                        : String(config.backgroundOpacity),
                    confirming: false,
                    closeReason: 'close',
                    result: undefined,
                    _onConfirm: asFunction(config.onConfirm),
                    _onCancel: asFunction(config.onCancel),
                    _onClose: asFunction(config.onClose),
                    _deferred: deferred,
                    _rendered: false,
                    _resolved: false,
                    _promise: deferred.promise
                };
                item._promise.modalId = item.id;
                item._promise.close = function (result) {
                    return dismissItem(item, 'close', result);
                };
                item._promise.dismiss = function (reason, result) {
                    return dismissItem(item, reason || 'close', result);
                };
                return item;
            }

            function open(input) {
                const item = buildItem(input);
                if (state.current || advancingQueue || state.queue.length) {
                    state.queue.push(item);
                    if (!state.current) advanceQueue();
                } else {
                    state.current = item;
                }
                kickDigest();
                return item._promise;
            }

            function dismissItem(item, reason, result) {
                if (!item || item._resolved) return false;
                if (state.current !== item) {
                    const queuedIndex = state.queue.indexOf(item);
                    if (queuedIndex === -1) return false;
                    state.queue.splice(queuedIndex, 1);
                    item.closeReason = reason || 'close';
                    item.result = result;
                    resolveItem(item);
                    return true;
                }
                if (!item.isOpen) return false;
                item.closeReason = reason || 'close';
                item.result = result;
                item.isOpen = false;
                // Unrendered dialogs cannot emit on-close; release their queue slot directly.
                if (!item._rendered) onAfterClose(item);
                kickDigest();
                return true;
            }

            function close(reason, result) {
                return dismissItem(state.current, reason, result);
            }

            function confirmCurrent(item) {
                item = item || state.current;
                if (!item || state.current !== item || !item.isOpen || item.confirming) return;
                item.confirming = true;
                let outcome = true;
                try {
                    outcome = item._onConfirm ? item._onConfirm() : true;
                } catch (error) {
                    outcome = $q.reject(error);
                }

                $q.when(outcome).then(function (result) {
                    if (state.current !== item || !item.isOpen) return;
                    item.confirming = false;
                    if (result !== false) {
                        dismissItem(item, 'confirm', result);
                    }
                }, function () {
                    if (state.current === item) {
                        item.confirming = false;
                    }
                });
            }

            function cancelCurrent(item) {
                item = item || state.current;
                if (!item || state.current !== item || !item.isOpen) return;
                let result;
                if (item._onCancel) {
                    try {
                        result = item._onCancel();
                    } catch (error) {
                        result = undefined;
                        report(error);
                    }
                }
                dismissItem(item, 'cancel', result);
            }

            function resolveItem(item) {
                if (!item || item._resolved) return;
                item._resolved = true;
                item.isOpen = false;
                const resolution = {reason: item.closeReason, value: item.result};
                item._deferred.resolve(resolution);
                const onClose = item._onClose;
                // the dialog is over: what it showed and the page's functions are let go, so that a page that keeps the
                // returned promise (its close() and dismiss() hold this item) does not keep its content alive
                item.content = null;
                item.render = null;
                item._onConfirm = null;
                item._onCancel = null;
                item._onClose = null;
                if (onClose) {
                    try {
                        onClose(resolution);
                    } catch (error) {
                        report(error);
                    }
                }
            }

            // The next turn is reserved (a dialog opened meanwhile waits for it, in order), without a digest of the page
            // of its own: one runs only when a dialog is shown then
            function advanceQueue() {
                if (advancingQueue) return;
                advancingQueue = true;
                $timeout(function () {
                    advancingQueue = false;
                    if (!state.current && state.queue.length) {
                        $rootScope.$apply(function () {
                            if (!state.current && state.queue.length) state.current = state.queue.shift();
                        });
                    }
                }, 0, false);
            }

            function onRendered(item) {
                if (!item || state.current !== item || !item.isOpen) return false;
                item._rendered = true;
                return true;
            }

            function onAfterClose(item) {
                if (!item || state.current !== item || item._resolved) return;
                state.current = null;
                // Reserve the next turn before callbacks can open more dialogs.
                advanceQueue();
                resolveItem(item);
            }

            /*
             * The host went (its application, or a page that removed it): the dialog it showed cannot close itself any
             * more - it is closed now (its promise settles with the reason it had, else close; on-close runs), and the
             * dialogs after it wait for a host (one mounted again shows them).
             */
            function hostGone() {
                const item = state.current;
                if (!item || item._resolved) return;
                item.isOpen = false;
                onAfterClose(item);
            }

            return {
                state: state,
                open: open,
                show: open,
                close: close,
                _confirmCurrent: confirmCurrent,
                _cancelCurrent: cancelCurrent,
                _onRendered: onRendered,
                _onAfterClose: onAfterClose,
                _hostGone: hostGone,
                _report: report
            };
        }])

    .directive('auiModalContentRenderer', ['$parse', 'AuiModal', 'auiTexts', function ($parse, AuiModal, texts) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                const readItem = $parse(attrs.auiModalContentRenderer);
                let disposeContent = null;
                let rendered = false;   // the content is render()'s (page code built it: Angular data may hang on it)

                /*
                 * The content goes: render()'s through jqLite / jQuery, so that what Angular keeps on its elements (data,
                 * scopes, $destroy listeners) goes with them - removed plainly while the dialog closed in its opening
                 * turn, it stayed in Angular's cache for good. A node the page handed over (content) is the page's: only
                 * taken out.
                 */
                function clearContent() {
                    if (disposeContent) {
                        try {
                            disposeContent();
                        } catch (error) {
                            AuiModal._report(error);
                        }
                        disposeContent = null;
                    }
                    if (rendered) angular.element(element[0]).empty();
                    rendered = false;
                    while (element[0].firstChild) {
                        element[0].removeChild(element[0].firstChild);
                    }
                }

                const stopWatching = scope.$watch(function () {
                    return readItem(scope);
                }, function (item) {
                    clearContent();
                    if (!AuiModal._onRendered(item)) return;

                    if (item.render) {
                        const controls = {
                            close: function (value) {
                                scope.$evalAsync(function () {
                                    item._promise.close(value);
                                });
                            },
                            cancel: function () {
                                scope.$evalAsync(function () {
                                    AuiModal._cancelCurrent(item);
                                });
                            },
                            confirm: function () {
                                scope.$evalAsync(function () {
                                    AuiModal._confirmCurrent(item);
                                });
                            }
                        };
                        rendered = true;
                        try {
                            const result = item.render(element[0], controls);
                            disposeContent = typeof result === 'function' ? result : null;
                        } catch (error) {
                            AuiModal._report(error);
                            angular.element(element[0]).empty();
                            element[0].textContent = texts.modal.contentFailed;
                        }
                        return;
                    }

                    if (item.content && typeof item.content.nodeType === 'number') {
                        element[0].appendChild(item.content);
                    } else {
                        element[0].textContent = item.content == null ? '' : String(item.content);
                    }
                });

                scope.$on('$destroy', function () {
                    stopWatching();
                    clearContent();
                });
            }
        };
    }])

    .component('auiModalHost', {
        controller: ['AuiModal', 'auiTexts', function (AuiModal, texts) {
            const $ctrl = this;
            $ctrl.t = texts.modal;
            $ctrl.svc = AuiModal;
            $ctrl.handleConfirm = function (item) { AuiModal._confirmCurrent(item); };
            $ctrl.handleCancel = function (item) { AuiModal._cancelCurrent(item); };
            $ctrl.handleClose = function (item) { item._promise.close(); };
            $ctrl.handleAfterClose = function (item) { AuiModal._onAfterClose(item); };
            $ctrl.$onDestroy = function () { AuiModal._hostGone(); };
        }],
        template: `
            <aui-modal ng-repeat="item in ($ctrl.svc.state.current ? [$ctrl.svc.state.current] : []) track by item.id"
                       is-open="item.isOpen"
                       on-close="$ctrl.handleAfterClose(item)"
                       size="{{item.size}}"
                       width="{{item.width}}"
                       height="{{item.height}}"
                       content-layout="{{item.contentLayout}}"
                       initial-focus="{{item.initialFocus}}"
                       border-radius="{{item.borderRadius}}"
                       show-header="{{item.showHeader ? 'true' : 'false'}}"
                       show-footer="{{item.showFooter ? 'true' : 'false'}}"
                       show-confirm-button="false"
                       auto-size="{{item.autoSize ? 'true' : 'false'}}"
                       display-on-top="{{item.displayOnTop ? 'true' : 'false'}}"
                       close-on-esc="{{item.closeOnEsc ? 'true' : 'false'}}"
                       aria-label="{{(!item.showHeader || !item.title) ? (item.ariaLabel || $ctrl.t.dialog) : undefined}}"
                       aria-labelledby="{{item.showHeader && item.title ? (item.id + '-title') : undefined}}"
                       background-opacity="{{item.backgroundOpacity}}">
                <header class="aui-imperative-modal__header-slot">
                    <div class="aui-imperative-modal__header">
                        <h2 class="aui-imperative-modal__title"
                            id="{{item.id}}-title"
                            ng-bind="item.title"></h2>
                        <button type="button" class="aui-imperative-modal__close"
                                aui-modal-close="$ctrl.handleClose(item)" aria-label="{{ ::$ctrl.t.closeDialog }}" title="{{ ::$ctrl.t.close }}">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                </header>
                <content>
                    <div class="aui-imperative-modal__content"
                         ng-class="item.contentClass"
                         aui-modal-content-renderer="item"></div>
                </content>
                <footer>
                    <div class="aui-imperative-modal__footer">
                        <aui-button variant="outline" intent="neutral"
                                    ng-if="item.showCancel"
                                    disabled="item.confirming"
                                    aui-modal-close="$ctrl.handleCancel(item)">{{item.cancelText}}</aui-button>
                        <aui-button intent="brand"
                                    ng-if="item.showConfirm"
                                    loading="item.confirming"
                                    ng-click="$ctrl.handleConfirm(item)">{{item.confirmText}}</aui-button>
                    </div>
                </footer>
            </aui-modal>
        `
    });
