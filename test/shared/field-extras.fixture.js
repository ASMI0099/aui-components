// Fixture of the field-extras suite: the message line, size and label-position of aui-input, aui-select and
// aui-tree-select. One shared text is set by the page (auiFieldMessagesProvider), as an app would set its own.
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
    .config(['auiFieldMessagesProvider', function (texts) {
        texts.set({pattern: 'Digits only, please'});
    }])
    .controller('ExtrasCtrl', ['$scope', function ($scope) {
        $scope.options = ['Riverside Plaza', 'Harbor Hall', 'Basic Lab'].map(function (label, i) { return {id: i + 1, label: label}; });
        $scope.nodes = [{id: 'g', label: 'Electronics', children: [{id: 'n1', label: 'Phones'}, {id: 'n2', label: 'Laptops'}]}];
        $scope.m = {smallMulti: [1, 2], is: 'Small', il: 'Large', ss: 1, sl: 1, ts: 'n1', tl: 'n1', pws: 'secret', pwl: 'secret', ws: 2, wl: 2};
        $scope.inputMessages = {required: 'Name is needed', maxlength: 'Up to {length} letters'};
        $scope.treeMessages = {required: 'Pick a category'};
    }]);
