// Fixture of the aui-tree-select remote-search suite: the test module, a mock search server and the
// instances of remote-search.html. Loaded before the library script, which registers the components on that module.
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

    /**
     * In-memory catalog with the two calls a real backend offers: children(parentId) for lazy loading and
     * searchTree(query, limit) returning the matches as a pruned tree ({items, total}), as GET /categories/search/tree.
     */
    .factory('mockCatalog', [function () {
        const DATA = [
            {id: 'f', name: 'Fruit', children: [
                {id: 'f-c', name: 'Citrus', children: [{id: 'f-c-1', name: 'Lemon'}, {id: 'f-c-2', name: 'Orange'}, {id: 'f-c-3', name: 'Lime'}]},
                {id: 'f-b', name: 'Berries', children: [{id: 'f-b-1', name: 'Strawberry'}, {id: 'f-b-2', name: 'Blueberry'}]}
            ]},
            {id: 'v', name: 'Vegetables', children: [
                {id: 'v-l', name: 'Leafy', children: [{id: 'v-l-1', name: 'Lettuce'}, {id: 'v-l-2', name: 'Spinach'}]},
                {id: 'v-r', name: 'Roots', children: [{id: 'v-r-1', name: 'Carrot'}, {id: 'v-r-2', name: 'Beetroot'}]}
            ]},
            {id: 'h', name: 'Lemon Grass'}
        ];
        const byId = new Map();
        const order = [];
        (function index(list, parent) {
            list.forEach(function (node) {
                node.parent = parent;
                byId.set(node.id, node);
                order.push(node);
                if (node.children) index(node.children, node);
            });
        })(DATA, null);

        const plain = function (node) {
            return {id: node.id, name: node.name, isLeaf: !node.children};
        };

        return {
            children: function (parentId) {
                const list = parentId === null ? DATA : (byId.get(parentId).children || []);
                return list.map(plain);
            },
            searchTree: function (query, limit) {
                const q = String(query).trim().toLowerCase();
                const matches = order.filter(function (node) { return node.name.toLowerCase().indexOf(q) !== -1; });
                const kept = matches.slice(0, limit);
                const onPath = new Set();
                kept.forEach(function (match) {
                    for (let node = match; node; node = node.parent) onPath.add(node.id);
                });
                const prune = function (node) {
                    const out = plain(node);
                    const kids = (node.children || []).filter(function (kid) { return onPath.has(kid.id); }).map(prune);
                    if (kids.length) out.children = kids;
                    return out;
                };
                return {items: DATA.filter(function (root) { return onPath.has(root.id); }).map(prune), total: matches.length};
            }
        };
    }])

    .controller('RemoteSearchCtrl', ['$scope', '$timeout', '$q', 'mockCatalog', function ($scope, $timeout, $q, catalog) {
        $scope.m = {single: null, singleItems: [], multi: [], multiItems: [], limit: null, gone: null};

        /**
         * The mock server. Every search is recorded in calls: {query, cancelled ($cancel resolved), aborted ($signal
         * aborted), settled}. delay: ms per request; delays: a queue of per-request delays taking precedence;
         * failNext: how many of the next requests fail; ignoreCancel: answer even after a cancel (a server that
         * does not stop), to check that the component drops a stale answer itself.
         */
        const server = $scope.server = {
            delay: 80,
            delays: [],
            failNext: 0,
            ignoreCancel: false,
            calls: [],
            lazyCalls: [],
            reset: function () {
                server.delay = 80;
                server.delays = [];
                server.failNext = 0;
                server.ignoreCancel = false;
                server.calls = [];
                server.lazyCalls = [];
            }
        };

        function search(query, signal, cancel, limit) {
            const call = {query: query, cancelled: false, aborted: false, settled: false};
            server.calls.push(call);
            if (signal) signal.addEventListener('abort', function () { call.aborted = true; });
            const delay = server.delays.length ? server.delays.shift() : server.delay;
            const fail = server.failNext > 0;
            if (fail) server.failNext -= 1;
            const timer = $timeout(function () {
                call.settled = true;
                if (fail) return $q.reject(new Error('mock server error'));
                return catalog.searchTree(query, limit);
            }, delay);
            if (cancel) {
                cancel.then(function () {
                    call.cancelled = true;
                    if (!server.ignoreCancel) $timeout.cancel(timer);
                });
            }
            return timer;
        }

        $scope.remoteSearch = function (query, signal, cancel) {
            return search(query, signal, cancel, 100);
        };
        $scope.remoteSearchLimited = function (query, signal, cancel) {
            return search(query, signal, cancel, 2);
        };

        $scope.loadChildren = function (node) {
            server.lazyCalls.push(node ? node.id : 'root');
            return $timeout(function () { return catalog.children(node ? node.id : null); }, 30);
        };

        $scope.showDestroyable = true;
    }]);
