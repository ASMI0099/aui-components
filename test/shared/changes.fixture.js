// Fixture of the changes suite: the three fields with on-change in both forms (a function reference and a call), the
// sources of a change (pointer, keyboard, tag, clear button, api, auto-select, reset-on-params, typing) and a native
// "change" listener; every call is written to a page log.
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
    .controller('ChangesCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
        const names = ['Zucchini', 'Yam', 'Apple', 'Apricot', 'Grape', 'Papaya', 'Banana', 'Cherry', 'Date', 'Fig'];
        $scope.options = names.map(function (label, i) { return {id: i + 1, label: label}; });
        $scope.one = [{id: 7, label: 'Only'}];
        $scope.flat = names.map(function (label) { return {id: 'f-' + label, label: label}; });
        $scope.m = {s: null, sc: null, sm: [3, 7], sa: null, sp: 2, t: null, tc: null, tm: ['f-Apple', 'f-Fig'], i: 'ab', ir: 'xy'};
        $scope.nested = [{id: 'g1', label: 'Group 1', children: [{id: 'g1-a', label: 'A'}, {id: 'g1-b', label: 'B'}]},
            {id: 'g2', label: 'Group 2', children: [{id: 'g2-a', label: 'C'}]}];
        $scope.expandedLog = [];
        $scope.expanded = function (node, isOpen) { $scope.expandedLog.push({id: node && node.id, open: isOpen}); };
        $scope.params = {hall: 1};
        $scope.load = function () { return $timeout(function () { return $scope.options; }, 10); };
        $scope.api = {s: {}, sm: {}, tm: {}, i: {}};
        $scope.log = [];
        // the reference form: one object
        $scope.onRef = function (name) {
            return function (change) { $scope.log.push({name: name, form: 'reference', change: angular.copy(change)}); };
        };
        $scope.refs = {s: $scope.onRef('s'), sm: $scope.onRef('sm'), sa: $scope.onRef('sa'), sp: $scope.onRef('sp'),
            t: $scope.onRef('t'), tm: $scope.onRef('tm'), ir: $scope.onRef('ir')};
        // the call form: named locals
        $scope.onCall = function (name, locals) { $scope.log.push({name: name, form: 'call', locals: angular.copy(locals)}); };
    }]);
