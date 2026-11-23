// Fixture of the message round suite (page: round.html): AuiMessageBox and AuiMessage on an empty page; every digest
// of the whole page is counted (window.__digests); Angular errors are collected, the ones a check throws on purpose
// (marked "on purpose") apart from the others.
window.__ngErrors = [];
window.__purposeErrors = [];
window.__digests = [];
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                const text = String(exception && exception.message || exception);
                if (/on purpose/.test(text)) window.__purposeErrors.push(text);
                else window.__ngErrors.push(text);
                $delegate(exception, cause);
            };
        }]);
    }])
    .run(['$rootScope', function ($rootScope) {
        const proto = Object.getPrototypeOf($rootScope);
        const digest = proto.$digest;
        proto.$digest = function () {
            if (this === $rootScope) window.__digests.push(performance.now());
            return digest.apply(this, arguments);
        };
    }])
    .controller('RoundCtrl', ['$scope', function ($scope) {
        $scope.log = [];
    }]);
