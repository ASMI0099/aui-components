// Fixture of the aui-input edges suite: names, rule changes, leaving the field, search, sizes.
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
    .controller('EdgesCtrl', ['$scope', function ($scope) {
        $scope.m = {ns: 12345, npp: 1.2345, pdyn: 1.23, rdyn: 25, bd: 'old', fc: 'Text', pw: 'secret', ta: '',
            long: 'One short first line, then some words to wrap repeatedly as the panel around it gets narrower. ' +
                'This second sentence makes sure the text needs several lines at a narrow width.'};
        $scope.state = {places: 2, max: 40, afShown: false, w: 220, auto: true};
        $scope.changes = [];
        $scope.changed = function (value, oldValue, source, byUser) {
            $scope.changes.push({value: value, oldValue: oldValue, source: source, byUser: byUser});
        };
        $scope.finishes = [];
        $scope.searches = [];
        $scope.searched = function (field, value) { $scope.searches.push(field + ':' + value); };
    }]);
