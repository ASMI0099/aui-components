// Fixture of the dropdown placement suite: fields placed at fixed distances from the bottom of the screen, static
// and server lists, and a tree. Server answers come 150 ms later (long enough to see where a loading panel opens).
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
    .controller('PlacementCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
        $scope.m = {};
        $scope.many = Array.from({length: 100}, (x, i) => ({id: i + 1, label: 'Option ' + (i + 1)}));
        $scope.few = [{id: 1, label: 'One'}, {id: 2, label: 'Two'}, {id: 3, label: 'Three'}];
        $scope.loadList = function () {
            return $timeout(function () { return Array.from({length: 60}, (x, i) => ({id: i + 1, label: 'Item ' + (i + 1)})); }, 150);
        };
        $scope.loadTree = function () {
            return $timeout(function () {
                return Array.from({length: 30}, (x, i) => ({id: 'n' + i, label: 'Category ' + i, children: [{id: 'c' + i, label: 'Child ' + i}]}));
            }, 150);
        };
    }]);
