// Fixture of the search-status suite: aui-select and aui-tree-select fields that search on the server, search in the
// browser, or refresh in the background, and a fake server whose delay and failure the checks set.
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
    .controller('SearchStatusCtrl', ['$scope', '$timeout', '$q', function ($scope, $timeout, $q) {
        $scope.server = {delay: 200, fail: false, calls: 0};
        $scope.m = {};
        const products = Array.from({length: 60}, (x, i) => ({id: i + 1, name: (i % 2 ? 'Apple ' : 'Banana ') + (i + 1)}));
        function answer(make) {
            $scope.server.calls += 1;
            return $timeout(function () {
                if ($scope.server.fail) return $q.reject(new Error('502 Bad Gateway'));
                return make();
            }, $scope.server.delay);
        }
        // paged: the server filters (query) and pages
        $scope.loadPaged = function (req) {
            return answer(function () {
                const q = (req.query || '').toLowerCase();
                const hits = products.filter(p => p.name.toLowerCase().indexOf(q) !== -1);
                const from = (req.page - 1) * req.pageSize;
                return {items: hits.slice(from, from + req.pageSize), hasMore: from + req.pageSize < hits.length};
            });
        };
        // load-all: everything at once, searched in the browser
        $scope.loadAll = function () {
            return answer(function () { return products.slice(0, 30); });
        };
        const groups = ['Fruit', 'Vegetables', 'Nuts'].map((g, i) => ({id: 'g' + i, name: g,
            children: [1, 2, 3].map(k => ({id: 'g' + i + '-' + k, name: g + ' ' + k}))}));
        $scope.nodes = groups;
        // tree server search: the matches as a pruned tree
        $scope.searchTree = function (query) {
            return answer(function () {
                const q = String(query).toLowerCase();
                return groups.map(g => ({id: g.id, name: g.name, children: g.children.filter(c => c.name.toLowerCase().indexOf(q) !== -1)}))
                    .filter(g => g.children.length > 0);
            });
        };
        // tree loaded list (load-options), for the background refresh
        $scope.loadTree = function () {
            return answer(function () { return angular.copy(groups); });
        };
    }]);
