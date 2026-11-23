// Fixture of the fallback round suite (page: fallback-round.html): aui-modals without <dialog> and without jQuery -
// the page behind them, keyboard rounds through richer forms, the toasts over them, sizes and the on-top place.
window.__ngErrors = [];
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                window.__ngErrors.push(String(exception && exception.message || exception));
                $delegate(exception, cause);
            };
        }]);
    }])
    .controller('FallbackRoundCtrl', ['$scope', function ($scope) {
        $scope.open = {bg: false, fs: false, hid: false, radio: false, pos: false, big: false, top: false};
        $scope.panel = {expanded: false, collapsed: false};
    }]);
