// Fixture of the checkbox suite: aui-checkbox as forms and tables use it (a page form with name and
// ng-required, true-value strings, ng-disabled, a select-all with indeterminate, rows without labels, sizes,
// container-border) and aui-checkbox-group (objects and plain values, select-all, min / max, required, disabled
// options, layouts). Every on-change and ng-change is written to the page's log, every digest of the page counted.
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
    .controller('CheckCtrl', ['$scope', function ($scope) {
        $scope.log = [];
        $scope.m = {agree: false, perm: 'no', plain: false, off: true, flag: false, all: false, part: true, row1: true, row2: false,
            sized: true, boxed: false};
        $scope.changed = function (what, $value, $oldValue, $checked, $triggerSource, $byUser) {
            $scope.log.push({what: what, value: $value, oldValue: $oldValue, checked: $checked, source: $triggerSource, byUser: $byUser});
        };
        $scope.ngChanged = function () { $scope.log.push({what: 'ng-change'}); };
        $scope.g = {roles: ['read'], nums: [], limited: ['a'], req: [], kept: ['b', 'gone']};
        $scope.roles = [{id: 'read', name: 'Read'}, {id: 'write', name: 'Write'}, {id: 'admin', name: 'Admin', locked: true}, {id: 'audit', name: 'Audit'}];
        $scope.nums = [1, 2, 3];
        $scope.letters = [{label: 'A', value: 'a'}, {label: 'B', value: 'b'}, {label: 'C', value: 'c'}, {label: 'D', value: 'd'}];
        $scope.flags = {groupOff: false};
        $scope.layout = {name: 'row', columns: 3};
    }]);
