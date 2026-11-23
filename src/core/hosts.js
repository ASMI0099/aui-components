/**
 * Mounts the hosts of AuiMessage, AuiMessageBox and AuiModal once the page is ready.
 */
angular.module('aui')
    .run(['$compile', '$rootScope', '$document', '$injector', 'AuiMessage', 'AuiMessageBox', 'AuiModal',
        function ($compile, $rootScope, $document, $injector, AuiMessage, AuiMessageBox, AuiModal) {
            // the services of the application started last (a page with several AngularJS applications: each one's own
            // services are the ones it injects)
            if (typeof window !== 'undefined') {
                window.AuiMessage = AuiMessage;
                window.AuiMessageBox = AuiMessageBox;
                window.AuiModal = AuiModal;
            }
            $document.ready(function () {
                const body = $document[0] && $document[0].body;
                if (!body) return;
                const mounted = [];

                /*
                 * One host of each kind per application: its services draw only through a host linked to its own root
                 * scope. A host already in the page belongs to another application (two side by side, or one that went
                 * and left it): it is not this one's, which mounts its own (it waited for a host that never drew it).
                 * A host the page wrote into this application's own markup is its own as well.
                 */
                function ownHost(el) {
                    if (el.__auiHostRoot !== undefined) return el.__auiHostRoot === $rootScope;
                    try {
                        return angular.element(el).injector() === $injector;
                    } catch (e) {
                        return false;
                    }
                }

                function mountOnce(tagName) {
                    const own = Array.prototype.some.call(body.querySelectorAll(tagName), ownHost);
                    if (own) return;
                    const el = document.createElement(tagName);
                    el.__auiHostRoot = $rootScope;
                    body.appendChild(el);
                    $compile(el)($rootScope);
                    mounted.push(el);
                }

                mountOnce('aui-message-host');
                mountOnce('aui-message-box-host');
                mountOnce('aui-modal-host');
                // a box or a dialog asked for before the hosts were there (in a run block, at the application's start)
                // shows now: the hosts are linked outside a digest, and nothing else may start one on an idle page
                $rootScope.$evalAsync(angular.noop);
                // the application ends (its root scope destroyed): its hosts go with it, and what they showed
                $rootScope.$on('$destroy', function () {
                    mounted.splice(0).forEach(function (el) {
                        el.__auiHostRoot = null;
                        angular.element(el).remove();
                    });
                });
            });
        }]);
