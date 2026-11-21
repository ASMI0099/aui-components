// Fixture of the html-flags suite: the test module, a list, a small tree, and the models. The scope has no
// "disabled" or "readonly" of its own, as on a page that writes the flags the HTML way.
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
    .controller('HtmlFlagsCtrl', ['$scope', function ($scope) {
        $scope.vm = {};
        $scope.pressed = 0;
        $scope.list = [{id: 1, name: 'Item 1'}, {id: 2, name: 'Item 2'}];
        $scope.tree = [{id: 'a', name: 'Group A', children: [{id: 'a1', name: 'Item A1'}]}];
        $scope.m = {text: 'Text', pick: 1, node: 'a1', day: '2026-01-15', agree: false, picks: [], many: [1]};
    }]);
