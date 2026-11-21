// Fixture of the aui-input suite: the field in a page form, its options, show-count.
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
    .controller('InputCtrl', ['$scope', function ($scope) {
        $scope.m = {flags: 'Read only', off: 'Editable', dis: 'Disabled', cb: 'abc', ntext: '12', price: 12, rate: 5, apiv: 'Hello', amtp: 1.234};
        $scope.apiObj = {};
        $scope.events = [];
        $scope.state = {label: false, ro: false, count: false, enforce: false};
        $scope.finishes = [];
        $scope.finished = function ($event) { $scope.finishes.push($event && $event.type); };
    }]);
