// Fixture of the busy / page-function suite: fields with the loading attribute, and page functions written without
// their call (load-options="fnRef"), which give back a function instead of data. console.warn is recorded.
window.__ngErrors = [];
window.__warnings = [];
(function () {
    const warn = console.warn.bind(console);
    console.warn = function () {
        window.__warnings.push(Array.prototype.map.call(arguments, String).join(' '));
        warn.apply(null, arguments);
    };
})();
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                window.__ngErrors.push(String(exception && exception.message || exception));
                $delegate(exception, cause);
            };
        }]);
    }])
    .controller('BusyCtrl', ['$scope', function ($scope) {
        $scope.state = {loading: true, disabled: false};
        $scope.m = {sel: '', tree: '', look: 7};
        $scope.options = [{id: 1, label: 'One'}, {id: 2, label: 'Two'}];
        $scope.nodes = [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}];
        // Page functions; the fields below name them without calling them
        $scope.loadList = function () { return [{id: 1, label: 'One'}]; };
        $scope.loadKids = function () { return [{id: 'r', label: 'Root', isLeaf: true}]; };
        $scope.lookupList = function () { return []; };
    }]);
