// Fixture of the keys suite: multiple fields of both components, static and with server search (answers 300 ms
// later), to check that Enter / Space / Backspace never change a selection the user cannot see being changed.
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
    .controller('KeysCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
        const names = ['Zucchini', 'Yam', 'Apple', 'Apricot', 'Grape', 'Papaya', 'Banana', 'Cherry', 'Date', 'Fig'];
        $scope.options = names.map(function (label, i) { return {id: i + 1, label: label}; });
        $scope.nodes = [{id: 'g', label: 'Group', children: names.map(function (label) { return {id: 'n-' + label, label: label}; })}];
        $scope.m = {sel: [], remote: [], tree: [], rtree: []};
        $scope.requests = {remote: 0, tree: 0};
        $scope.loadRemote = function (req) {
            $scope.requests.remote += 1;
            return $timeout(function () {
                const q = String(req.query || '').toLowerCase();
                return $scope.options.filter(function (o) { return !q || o.label.toLowerCase().indexOf(q) !== -1; })
                    .slice(req.offset, req.offset + req.pageSize);
            }, 300);
        };
        $scope.searchTree = function (q) {
            $scope.requests.tree += 1;
            return $timeout(function () {
                const k = String(q || '').toLowerCase();
                return [{id: 'g', label: 'Group', children: names.filter(function (n) { return n.toLowerCase().indexOf(k) !== -1; })
                    .map(function (label) { return {id: 'n-' + label, label: label}; })}];
            }, 300);
        };
    }]);
