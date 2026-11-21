// Fixture of the aui-tree-select remote-data suite: the test module, a mock category server and the
// instances of remote-data.html. Loaded before the library script, which registers the components on that module.
window.__ngErrors = [];
window.__warnings = [];
(function () {
    const warn = console.warn;
    console.warn = function () {
        window.__warnings.push(Array.prototype.map.call(arguments, String).join(' '));
        return warn.apply(console, arguments);
    };
})();
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
     * Categories per room. Room A: Fruit (Citrus: Lemon, Orange, Lime; Berries: Strawberry, Blueberry),
     * Vegetables (Leafy: Lettuce, Spinach), Spices (25 children, served in pages of 10). Room B: Tools (Hammers,
     * Saws). Ids carry the room: 'A-f-c-1' etc.
     */
    .factory('mockCategories', [function () {
        const rooms = {
            A: [
                {id: 'A-f', name: 'Fruit', children: [
                    {id: 'A-f-c', name: 'Citrus', children: [{id: 'A-f-c-1', name: 'Lemon'}, {id: 'A-f-c-2', name: 'Orange'}, {id: 'A-f-c-3', name: 'Lime'}]},
                    {id: 'A-f-b', name: 'Berries', children: [{id: 'A-f-b-1', name: 'Strawberry'}, {id: 'A-f-b-2', name: 'Blueberry'}]}
                ]},
                {id: 'A-v', name: 'Vegetables', children: [
                    {id: 'A-v-l', name: 'Leafy', children: [{id: 'A-v-l-1', name: 'Lettuce'}, {id: 'A-v-l-2', name: 'Spinach'}]}
                ]},
                {id: 'A-s', name: 'Spices', children: Array.from({length: 25}, function (x, i) {
                    return {id: 'A-s-' + (i + 1), name: 'Spice ' + ('0' + (i + 1)).slice(-2)};
                })}
            ],
            B: [
                {id: 'B-t', name: 'Tools', children: [{id: 'B-t-h', name: 'Hammers'}, {id: 'B-t-s', name: 'Saws'}]}
            ],
            // 25 top-level nodes, served in pages of 10
            R: Array.from({length: 25}, function (x, i) { return {id: 'R-' + (i + 1), name: 'Root ' + ('0' + (i + 1)).slice(-2)}; })
        };
        const byId = new Map();
        const parentOf = new Map();
        Object.keys(rooms).forEach(function (room) {
            (function index(list, parent) {
                list.forEach(function (node) {
                    byId.set(node.id, node);
                    parentOf.set(node.id, parent);
                    if (node.children) index(node.children, node);
                });
            })(rooms[room], null);
        });
        const plain = function (node) {
            return {id: node.id, name: node.name, isLeaf: !node.children};
        };
        const copyTree = function (list) {
            return list.map(function (node) {
                const out = {id: node.id, name: node.name};
                if (node.children) out.children = copyTree(node.children);
                return out;
            });
        };
        return {
            tree: function (room) { return copyTree(rooms[room] || []); },
            children: function (room, parentId) {
                const list = parentId === null ? (rooms[room] || []) : ((byId.get(parentId) || {}).children || []);
                return list.map(plain);
            },
            /** Root-to-node chains of the given ids (unknown ids left out). */
            chains: function (ids) {
                return ids.filter(function (id) { return byId.has(String(id)); }).map(function (id) {
                    const chain = [];
                    for (let node = byId.get(String(id)); node; node = parentOf.get(node.id)) chain.unshift(plain(node));
                    return chain;
                });
            },
            search: function (room, query) {
                const q = String(query).toLowerCase();
                return (rooms[room] || []).filter(function (root) { return root.name.toLowerCase().indexOf(q) !== -1; }).map(plain);
            }
        };
    }])

    .controller('TreeRemoteCtrl', ['$scope', '$timeout', '$q', 'mockCategories', function ($scope, $timeout, $q, categories) {
        // ch1: Orange (Fruit > Citrus); ch2: all of Citrus (a fully checked branch) and Spinach (Vegetables > Leafy)
        $scope.m = {ch1: 'A-f-c-2', ch2: ['A-f-c-1', 'A-f-c-2', 'A-f-c-3', 'A-v-l-2']};
        $scope.p = {all: 'A', lazy: 'A', reset: 'A', timeout: 'A', destroy: 'A', allEnabled: true};
        $scope.treeRows = [];
        $scope.show = {destroyable: true};

        /** The mock server. calls: every request ({kind, reason, page, values, params, query, cancelled, aborted}). */
        const server = $scope.server = {
            calls: [],
            reset: function () {
                server.delay = 40;
                server.failNext = 0;
                server.repeatPage = false;   // answer page 1 again for later pages (a server that ignores the page)
                server.calls = [];
            },
            of: function (tag, kind) {
                return server.calls.filter(function (c) { return c.tag === tag && (!kind || c.kind === kind); });
            }
        };
        server.reset();

        function serve(kind, tag, req, answer) {
            const call = {kind: kind, tag: tag, reason: req.reason, page: req.page, pageSize: req.pageSize, values: req.values ? req.values.slice() : null,
                params: angular.copy(req.params), query: req.query, cancelled: false, aborted: false};
            server.calls.push(call);
            if (req.signal) req.signal.addEventListener('abort', function () { call.aborted = true; });
            const fail = server.failNext > 0;
            if (fail) server.failNext -= 1;
            const timer = $timeout(function () {
                if (fail) return $q.reject(new Error('mock server error'));
                return answer();
            }, server.delay);
            if (req.cancel) req.cancel.then(function () { call.cancelled = true; $timeout.cancel(timer); });
            return timer;
        }

        /** load-options: the whole tree of a room; a lookup answers root-to-node chains. */
        $scope.loadTree = function (req, tag) {
            return serve(req.values ? 'lookup' : 'tree', tag, req, function () {
                return req.values ? categories.chains(req.values) : categories.tree(req.params.room);
            });
        };

        /** load-children: children of a node; Spices and the top level of room R come in pages of 10 ({items, hasMore}). */
        $scope.loadKids = function (req, tag) {
            const parentId = req.node ? req.node.id : null;
            return serve('children', tag, {reason: req.reason, page: req.page, params: req.params, signal: req.signal, cancel: req.cancel}, function () {
                const all = categories.children(req.params.room, parentId);
                if (parentId !== 'A-s' && !(parentId === null && req.params.room === 'R')) return all;
                const page = server.repeatPage ? 1 : req.page;
                const items = all.slice((page - 1) * 10, page * 10);
                return {items: items, hasMore: page * 10 < all.length, total: all.length};
            });
        };

        /** lookup-options: root-to-node chains. */
        $scope.lookupChains = function (req, tag) {
            return serve('lookup', tag, req, function () { return categories.chains(req.values); });
        };

        $scope.searchRoots = function (query, params, cancel, tag, signal) {
            return serve('search', tag, {reason: 'search', query: query, params: params, cancel: cancel, signal: signal}, function () {
                return categories.search(params.room, query);
            });
        };
    }]);
