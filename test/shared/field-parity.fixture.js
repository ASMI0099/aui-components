// Fixture of the field-parity suite: aui-input (form style), aui-select and aui-tree-select in the same states.
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
    .controller('ParityCtrl', ['$scope', function ($scope) {
        $scope.options = ['Riverside Plaza', 'Harbor Hall', 'Basic Lab'].map(function (label, i) { return {id: i + 1, label: label}; });
        $scope.one = [{id: 9, label: 'The only one'}];
        $scope.nodes = [{id: 'g', label: 'Electronics', children: [{id: 'n1', label: 'Riverside Plaza'}, {id: 'n2', label: 'Harbor Hall'}]}];
        $scope.oneNode = [{id: 'only', label: 'The only node'}];
        $scope.state = {ro: true, dis: true};
        $scope.m = {sro: 1, smro: [1, 2], tro: 'n1', tmro: ['n1', 'n2']};
    }]);
