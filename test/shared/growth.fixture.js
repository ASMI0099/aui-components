// Fixture of the growth suite: a remote aui-tree-select and a remote aui-select whose fake server answers after a
// delay the checks set (delay < 0: the answer is at hand at once, in the same digest). load-params carries a round
// number: a new round makes the next opening load again.
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
    .controller('GrowthCtrl', ['$scope', '$timeout', '$q', function ($scope, $timeout, $q) {
        $scope.delay = {tree: 150, select: 150};
        $scope.round = {tree: 1, select: 1};
        $scope.m = {tree: null, room: null};

        function answer(delay, make) {
            if (delay < 0) return $q.when(make());
            return $timeout(make, delay);
        }

        const groups = Array.from({length: 12}, (x, g) => ({
            id: 'g' + g, name: 'Group ' + g,
            children: [1, 2, 3].map(i => ({id: 'g' + g + '-' + i, name: 'Node ' + g + '.' + i}))
        }));
        $scope.loadTree = function () {
            return answer($scope.delay.tree, () => angular.copy(groups));
        };
        const rooms = Array.from({length: 30}, (x, i) => ({id: i + 1, name: 'Room ' + (i + 1)}));
        $scope.loadRooms = function (req) {
            return answer($scope.delay.select, () => (req.values ? rooms.filter(s => req.values.map(String).indexOf(String(s.id)) !== -1) : rooms));
        };
    }]);
