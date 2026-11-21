// Fixture of the label-gap suite: the field kinds with an inline label (aui-select single and multiple, aui-tree-select,
// aui-input with a value and with a placeholder), on the page and inside an open aui-modal (whose box and body are
// scroll areas, .aui-scroll)
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
    .controller('GapCtrl', ['$scope', function ($scope) {
        $scope.options = ['Hall 2 Harbor', 'Riverside', 'Central', 'Lakeside'].map(function (label, i) { return {id: i + 1, label: label}; });
        $scope.tree = [{id: 'c', label: 'Category', children: [{id: 'c1', label: 'Category 1.2'}, {id: 'c2', label: 'Category 2.1'}]}];
        $scope.m = {single: 1, multi: [2, 3], tree: 'c1', code: 'Code', empty: ''};
        $scope.modalOpen = false;
    }]);
