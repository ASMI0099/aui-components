// Fixture of the load-disabled-text suite: the test module and a small fake server whose answers
// depend on the hall chosen in the form. Every call is logged; answers come 80 ms later.
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
    .controller('LoadDisabledCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
        const calls = [];
        $scope.calls = calls;
        $scope.delay = 80;
        $scope.form = {hall: null, type: null};
        $scope.m = {room: '', rooms: [], plain: '', cat: '', lazy: '', two: ''};
        $scope.text = {hall: 'Select a hall first'};

        function answer(kind, tag, req, make) {
            const call = {kind: kind, tag: tag, reason: req.reason, params: angular.copy(req.params), answered: false};
            calls.push(call);
            return $timeout(function () {
                call.answered = true;
                return make();
            }, $scope.delay);
        }

        function rooms(hall) {
            const out = [];
            for (let i = 1; i <= 30; i += 1) out.push({id: hall * 100 + i, name: 'Hall ' + hall + ' room ' + i});
            return out;
        }

        $scope.loadRooms = function (req, tag) {
            return answer('rooms', tag, req, function () {
                const list = rooms(req.params.hall).filter(function (s) {
                    return !req.query || s.name.toLowerCase().indexOf(req.query.toLowerCase()) !== -1;
                });
                return req.pageSize ? list.slice(req.offset, req.offset + req.pageSize) : list;
            });
        };

        $scope.loadTree = function (req, tag) {
            return answer('tree', tag, req, function () {
                return [{id: 'f' + req.params.hall, name: 'Floor 1', children: [{id: 'z' + req.params.hall, name: 'Zone A'}]}];
            });
        };

        $scope.loadKids = function (req, tag) {
            return answer(req.node ? 'children' : 'roots', tag, req, function () {
                if (!req.node) return [{id: 'r1', name: 'Root 1'}, {id: 'r2', name: 'Root 2', isLeaf: true}];
                return [{id: req.node.id + '-1', name: req.node.name + ' child', isLeaf: true}];
            });
        };

        $scope.of = function (tag) {
            return calls.filter(function (c) { return c.tag === tag; });
        };
    }]);
