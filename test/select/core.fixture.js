// Fixture of the aui-select core suite: the test module and the data of core.html.
window.__ngErrors = [];
window.__rootEvents = 0;
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
        $rootScope.$on('auiSelect:userInteracted', function () { window.__rootEvents += 1; });
    }])
    .controller('TestCtrl', ['$scope', function ($scope) {
        const letters = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf hotel', 'Indigo'];
        $scope.strOptions = letters.map((label, i) => ({id: i + 1, label: label}));
        $scope.numOptions = [
            {id: 1, label: 101}, {id: 2, label: 202}, {id: 3, label: 'abc 10'}, {id: 4, label: 0},
            {id: 5, label: 'x'}, {id: 6, label: 310}, {id: 7, label: null}, {id: 8, label: true}
        ];
        $scope.singleOption = [{id: 'only', label: 'Only option'}];
        $scope.treeOptions = [{label: 'Root', value: 'r', children: [{label: 'Leaf', value: 'l'}]}];
        $scope.longOptions = Array.from({length: 1000}, (x, i) => ({id: i + 1, label: 'Option ' + (i + 1)}));
        $scope.m = {s1: '', s2: '', req: '', multi: [], s5: '', auto1: '', auto2: '', dv: '',
            tags: [1, 2, 3, 4, 5], tags0: [1, 2], tagsDyn: [1, 2, 3, 4], tagsNeg: [1, 2, 3], singleLimit: 2};
        $scope.tagLimit = 1;
        $scope.disabledVals = [2, 3];
        $scope.show5 = true;
        $scope.showAuto1 = true;
        $scope.opens = {s1: 0, s5: 0};
        $scope.closes = {s1: 0, s5: 0};
        $scope.changes = [];
        $scope.submits = 0;
        $scope.onChange1 = function (payload) { $scope.changes.push(payload); };
        $scope.autoChanges = 0;
        $scope.onAutoChange = function () { $scope.autoChanges += 1; };
        $scope.onSubmit = function () { $scope.submits += 1; };
    }]);
