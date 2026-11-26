// Fixture of the checkbox round suite (page: round.html): group limits with values the options do not show, models
// changed in place, a group disabled, options edited in place, options of one value, invalid groups, deferred models,
// native forms (data, required, reset), external names, tabindex, focus and high-contrast rules, boxes side by side,
// many values, fonts changed later, a disabled fieldset. Angular errors are collected; on-change calls are logged.
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
    .controller('RoundCtrl', ['$scope', function ($scope) {
        $scope.abc = ['A', 'B', 'C'];
        $scope.m = {
            limited: ['saved', 'A'], overfull: ['A', 'B', 'C'], lockedAll: ['L'],
            inPlace: ['A', 'B'], disabledGroup: ['A', 'B'], live: [], twins: [], invalid: [],
            debounced: false, blurSingle: false, blurGroup: [], required: false,
            named: 'YES', namedGroup: ['read'], needGroup: [], resetMe: 'NO',
            labelled: false, tabbed: false, checkedFocus: true, left: false, right: false,
            many: [], font: false, fieldset: true, fieldsetGroup: ['A']
        };
        $scope.withLocked = [{label: 'Locked', value: 'L', off: true}, {label: 'A', value: 'A'}, {label: 'B', value: 'B'}];
        $scope.liveOptions = [{label: 'One', value: 1, off: false}, {label: 'Two', value: 2, off: false}];
        $scope.twinOptions = [{label: 'First', value: 5}, {label: 'Second', value: 5}, {label: 'Other', value: 6}];
        $scope.perms = ['read', 'write'];
        $scope.manyOptions = [];
        for (let i = 0; i < 400; i += 1) {
            $scope.manyOptions.push({label: 'Item ' + i, value: i});
            $scope.m.many.push(i);
        }
        $scope.calls = [];
        $scope.changed = function (name, value, oldValue) { $scope.calls.push([name, value, oldValue]); };
        $scope.off = {group: false, fieldset: false};
        $scope.hint = 'A hint';
    }]);
