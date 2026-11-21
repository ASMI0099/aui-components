// Fixture of the request-failure suite: a fake server that can be switched to failing, and a loader that throws at
// once (a page function with a bug). Every call is counted per field tag. Answers come 20 ms later.
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
    .controller('FailuresCtrl', ['$scope', '$timeout', '$q', function ($scope, $timeout, $q) {
        const calls = [];
        $scope.server = {down: true};
        $scope.m = {sel: 78, thrower: 5, refresh: 999, look: 7, tree: 'n9', lazy: '', treeThrow: 'n1'};

        function answer(tag, req, make) {
            calls.push({tag: tag, reason: req.reason, values: req.values || null});
            return $timeout(function () {
                if ($scope.server.down) return $q.reject(new Error('502 Bad Gateway'));
                return make();
            }, 20);
        }

        const rooms = Array.from({length: 30}, (x, i) => ({id: i + 1, name: 'Room ' + (i + 1)}));
        $scope.loadRooms = function (req, tag) {
            return answer(tag, req, function () {
                return req.values ? rooms.filter(s => req.values.map(String).indexOf(String(s.id)) !== -1) : rooms;
            });
        };
        $scope.throwing = function (req, tag) {
            calls.push({tag: tag, reason: req.reason, values: req.values || null});
            throw new ReferenceError('$q is not defined');   // what a page function with a missing injection does
        };
        $scope.loadTree = function (req, tag) {
            return answer(tag, req, function () {
                return [{id: 'n1', name: 'Node 1', children: [{id: 'n2', name: 'Node 2'}]}];
            });
        };
        $scope.loadKids = function (req, tag) {
            return answer(tag, req, function () {
                return req.node ? [] : [{id: 'r1', name: 'Root 1', isLeaf: true}];
            });
        };
        $scope.count = function (tag) {
            return calls.filter(c => c.tag === tag).length;
        };
        $scope.reasons = function (tag) {
            return calls.filter(c => c.tag === tag).map(c => c.reason);
        };
    }]);
