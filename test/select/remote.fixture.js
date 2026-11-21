// Fixture of the aui-select remote suite: the test module, a mock product server and the instances of
// remote.html. Loaded before the library script, which registers the components on that module.
window.__ngErrors = [];
window.__warnings = [];
(function () {
    // Record warnings (the component reports API mistakes this way) and still print them.
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
     * Products by brand. Brand A: 230 (ids 1-230), brand B: 15 (ids 1001-1015), brand C: 1 (id 2001), brand D: 300
     * (ids 3001-3300). Every 97th product is inactive: the list never shows it, a lookup by id still finds it.
     * Every 50th + 7 is disabled.
     */
    .factory('mockProducts', [function () {
        const all = [];
        const add = function (brand, from, count) {
            for (let i = 0; i < count; i += 1) {
                const id = from + i;
                all.push({id: id, name: 'Product ' + brand + '-' + ('000' + id).slice(-4), brand: brand,
                    disabled: id % 50 === 7, active: id % 97 !== 0});
            }
        };
        add('A', 1, 230);
        add('B', 1001, 15);
        add('C', 2001, 1);
        add('D', 3001, 300);
        const plain = function (p) {
            return {id: p.id, name: p.name, brand: p.brand, disabled: p.disabled};
        };
        return {
            list: function (brand, query) {
                const q = String(query || '').toLowerCase();
                return all.filter(function (p) {
                    return p.brand === brand && p.active && (q === '' || p.name.toLowerCase().indexOf(q) !== -1);
                }).map(plain);
            },
            byIds: function (values) {
                const keys = new Set(values.map(String));
                return all.filter(function (p) { return keys.has(String(p.id)); }).map(plain);
            }
        };
    }])

    .controller('RemoteSelectCtrl', ['$scope', '$timeout', '$q', 'mockProducts', function ($scope, $timeout, $q, products) {
        $scope.m = {};
        $scope.p = {single: 'A', multi: 'A', small: 'A', all: 'B', dedicated: false, min: 'A', timeout: 'A', reset: 'A',
            vo: 'A', auto: 'C', ttl: 'A', api: 'A', preload: false, many: 'D', destroy: 'A', group: 'A'};
        $scope.sApi = {};
        $scope.changes = [];
        $scope.onChange = function (payload) { $scope.changes.push(payload); };
        $scope.groupRows = [];
        $scope.staticOptions = products.list('A', '').slice(0, 5);   // a static list; other values come by lookup-options
        $scope.show = {destroyable: true};

        /**
         * The mock server. calls / lookupCalls record every request: what was asked, and whether its $cancel was
         * resolved and its $signal aborted. Settings (reset() restores them):
         *   delay, delays (a queue of per-request delays), failNext, failPage (page number that fails once),
         *   ignoreCancel (answer anyway), ignorePage (always page 1: a common API mistake), maxPageSize (server cap),
         *   mode: 'array' | 'total' | 'hasMore' | 'cursor', invalidNext (answer {rows} instead), shift (items that
         *   moved between pages: page 2+ starts this many items earlier), suffix (added to every name: changed data).
         */
        const server = $scope.server = {
            calls: [],
            lookupCalls: [],
            reset: function () {
                server.delay = 40;
                server.delays = [];
                server.failNext = 0;
                server.failPage = 0;
                server.ignoreCancel = false;
                server.ignorePage = false;
                server.maxPageSize = 0;
                server.mode = 'array';
                server.invalidNext = 0;
                server.shift = 0;
                server.suffix = '';
                server.calls = [];
                server.lookupCalls = [];
            },
            /** Calls of one instance (its load-params carry a tag). */
            of: function (tag, log) {
                return (log || server.calls).filter(function (call) { return call.params && call.params.tag === tag; });
            }
        };
        server.reset();

        function answer(req) {
            if (req.values) return products.byIds(req.values);   // a lookup: by ids only, inactive products too
            const list = products.list(req.params.brand, req.query).map(function (p) {
                return server.suffix ? angular.extend({}, p, {name: p.name + server.suffix}) : p;
            });
            if (!req.pageSize) return list;
            const size = server.maxPageSize ? Math.min(req.pageSize, server.maxPageSize) : req.pageSize;
            let start = server.ignorePage ? 0 : req.offset;
            if (server.mode === 'cursor') start = req.cursor ? Number(String(req.cursor).slice(1)) : 0;
            if (start > 0 && server.shift) start = Math.max(0, start - server.shift);
            const items = list.slice(start, start + size);
            if (server.mode === 'total') return {items: items, total: list.length};
            if (server.mode === 'hasMore') return {items: items, hasMore: start + items.length < list.length};
            if (server.mode === 'cursor') return {items: items, nextCursor: start + size < list.length ? 'c' + (start + size) : null};
            return items;
        }

        function serve(req, log) {
            const call = {
                reason: req.reason, query: req.query, page: req.page, pageSize: req.pageSize, offset: req.offset,
                cursor: req.cursor, values: req.values ? req.values.slice() : null, params: angular.copy(req.params),
                hasSignal: !!req.signal, hasCancel: !!(req.cancel && typeof req.cancel.then === 'function'),
                cancelled: false, aborted: false, settled: false
            };
            log.push(call);
            if (req.signal) req.signal.addEventListener('abort', function () { call.aborted = true; });
            const delay = server.delays.length ? server.delays.shift() : server.delay;
            let fail = false;
            if (server.failNext > 0) {
                server.failNext -= 1;
                fail = true;
            } else if (server.failPage && server.failPage === req.page && !req.values) {
                server.failPage = 0;
                fail = true;
            }
            let invalid = false;
            if (server.invalidNext > 0) {
                server.invalidNext -= 1;
                invalid = true;
            }
            const timer = $timeout(function () {
                call.settled = true;
                if (fail) return $q.reject(new Error('mock server error'));
                if (invalid) return {rows: []};
                return answer(req);
            }, delay);
            if (req.cancel) {
                req.cancel.then(function () {
                    call.cancelled = true;
                    if (!server.ignoreCancel) $timeout.cancel(timer);
                });
            }
            return timer;
        }

        $scope.loadProducts = function (req) {
            return serve(req, server.calls);
        };
        $scope.m.choice = 350;
        $scope.loadChoice = function () {
            return $timeout(function () {
                return Array.from({length: 400}, function (x, i) { return {id: i + 1, name: 'Choice ' + (i + 1)}; });
            }, 60);
        };
        $scope.lookupProducts = function (req) {
            return serve(req, server.lookupCalls);
        };
    }]);
