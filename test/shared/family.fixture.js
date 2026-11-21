// Fixture of the family suites (shared-ui.html, parity.html): aui-select and aui-tree-select instances and data.
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
    .controller('UnifyCtrl', ['$scope', '$q', '$timeout', function ($scope, $q, $timeout) {
        $scope.fruits = ['Apple', 'Pineapple', 'Grape', 'Banana', 'Cherry', 'Applesauce', 'Mango', 'Melon']
            .map(function (label, i) { return {id: i + 1, label: label}; });
        $scope.many = [];
        for (let i = 1; i <= 220; i++) $scope.many.push({id: i, label: 'Option ' + i});
        // 2 groups x 10 sections x 10 items
        $scope.tree = [];
        for (let r = 0; r < 2; r++) {
            const group = {id: 'r' + r, name: 'Group ' + r, children: []};
            for (let c = 0; c < 10; c++) {
                const section = {id: 'r' + r + '-' + c, name: 'Section ' + r + '-' + c, children: []};
                for (let s = 0; s < 10; s++) section.children.push({id: 'r' + r + '-' + c + '-' + s, name: 'Item ' + r + '-' + c + '-' + s});
                group.children.push(section);
            }
            $scope.tree.push(group);
        }
        $scope.m = {s1: null, s2: null, s3: [], s4: [], s5: null, s6: null, t1: [], t2: [], t3: []};
        $scope.counts = {open: 0, close: 0, close6: 0};
        $scope.show = {s6: true};
        $scope.loadKids = function (node) {
            return $timeout(function () {
                if (!node) return ['Alpha', 'Beta', 'Gamma', 'Delta'].map(function (n) { return {id: n, name: n}; });
                return [1, 2, 3].map(function (i) { return {id: node.id + i, name: node.name + ' ' + i, isLeaf: true}; });
            }, 30);
        };
        window.unifyScope = $scope;
    }]);
