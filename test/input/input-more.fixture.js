// Fixture of the input-more suite: aui-textarea, aui-input's search preset and its cell style.
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
    .controller('MoreCtrl', ['$scope', function ($scope) {
        $scope.m = {cellValue: 'Priority 3', bold: 'Bold text'};
        $scope.rows = [{v: 'first'}, {v: ''}];
        $scope.state = {busy: false};
        $scope.finishes = [];
        $scope.searches = [];
        $scope.searches2 = [];
        $scope.finished = function ($event) { $scope.finishes.push($event && $event.type); };
        $scope.searched = function (value) { $scope.searches.push(value); };
        $scope.searched2 = function (value) { $scope.searches2.push(value); };
    }]);
