// Fixture of the modal fallback suite: aui-modals on a page whose browser has no <dialog> (fallback.html removes
// showModal before AngularJS starts) and that loads no jQuery; every Angular error is collected.
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
    .controller('FallbackCtrl', ['$scope', function ($scope) {
        $scope.open = {own: false, tab: false, tall: false, theme: false, lower: false, upper: false};
        $scope.rows = [];
        for (let i = 1; i <= 60; i += 1) $scope.rows.push(i);
    }]);
