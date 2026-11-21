// Fixture of the events suite: fields of both components in a page form, a page binding that counts the page's digests,
// an on-open callback that changes the page, a required field without a search box, and a long static list.
window.__ngErrors = [];
window.__pageDigests = 0;
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                window.__ngErrors.push(String(exception && exception.message || exception));
                $delegate(exception, cause);
            };
        }]);
    }])
    .controller('EventsCtrl', ['$scope', function ($scope) {
        const names = ['Zucchini', 'Yam', 'Apple', 'Apricot', 'Grape', 'Papaya', 'Banana', 'Cherry', 'Date', 'Fig'];
        $scope.options = names.map(function (label, i) { return {id: i + 1, label: label}; });
        $scope.nodes = [{id: 'g', label: 'Group', children: names.map(function (label) { return {id: 'n-' + label, label: label}; })}];
        $scope.few = $scope.options.slice(0, 3);
        $scope.m = {single: null, multi: [3, 7], tree: null, treeMulti: ['n-Apple'], hooked: null, few: null};
        $scope.opened = 0;
        $scope.onOpen = function () { $scope.opened += 1; };
        // counts the digests of the whole page (a component's own digest does not run this)
        $scope.$watch(function () { window.__pageDigests += 1; });
    }]);
