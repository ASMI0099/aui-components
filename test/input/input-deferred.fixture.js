// Fixture of the aui-input deferred-commit suite: each aui-input next to a native AngularJS input with the same rules
// and ng-model-options, so that the field's model, validity, dirty state and ng-change can be compared with Angular's own.
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
    .controller('DeferredCtrl', ['$scope', function ($scope) {
        // a: the aui-input's model, n: the native input's; one pair per case
        $scope.a = {tight: 'AA', relax: 'AA', num: 5, keep: 'LONG', back: 'LONG', numKeep: 25, undef: undefined,
            deb: undefined, debRelax: 'AA', submit: 'AA', same: 'AA', clearKeep: 'LONG'};
        $scope.n = angular.copy($scope.a);
        $scope.rule = {tight: 8, relax: 2, num: 40, keep: 8, back: 8, numKeep: 40, debRelax: 2, submit: 2, clearKeep: 8};
        $scope.changes = [];
        $scope.changed = function (field, value) { $scope.changes.push(field + ':' + String(value)); };
        $scope.submits = [];
        $scope.submitted = function (form) { $scope.submits.push({valid: form.$valid, value: $scope.a.submit}); };
    }]);
