/**
 * Mounts the hosts of AuiMessage, AuiMessageBox and AuiModal once the page is ready.
 */
angular.module('aui')
    .run(['$compile', '$rootScope', '$document', 'AuiMessage', 'AuiMessageBox', 'AuiModal',
        function ($compile, $rootScope, $document, AuiMessage, AuiMessageBox, AuiModal) {
            if (typeof window !== 'undefined') {
                window.AuiMessage = AuiMessage;
                window.AuiMessageBox = AuiMessageBox;
                window.AuiModal = AuiModal;
            }
            $document.ready(function () {
                const body = $document[0] && $document[0].body;
                if (!body) return;

                function mountOnce(tagName) {
                    if (body.querySelector(tagName)) return;
                    const el = document.createElement(tagName);
                    body.appendChild(el);
                    $compile(el)($rootScope);
                }

                mountOnce('aui-message-host');
                mountOnce('aui-message-box-host');
                mountOnce('aui-modal-host');
            });
        }]);
