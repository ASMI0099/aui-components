// Fixture of the digest-own suite: a page binding (page.note), a counted aui-input, an aui-select and an
// aui-tree-select with a few options, and the toasts' host; every digest of the whole page is counted (window.__digests).
window.__ngErrors = [];
window.__digests = [];
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                window.__ngErrors.push(String(exception && exception.message || exception));
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
    .controller('DigestOwnCtrl', ['$scope', function ($scope) {
        $scope.page = {note: '-'};
        $scope.f = {text: 'abc', pick: null, node: null};
        $scope.options = [1, 2, 3, 4, 5, 6].map(function (i) { return {id: i, name: 'Option ' + i}; });
        $scope.tree = [1, 2, 3].map(function (i) {
            return {id: 'n' + i, name: 'Node ' + i, children: [{id: 'n' + i + 'a', name: 'Node ' + i + 'a'}, {id: 'n' + i + 'b', name: 'Node ' + i + 'b'}]};
        });
    }]);
