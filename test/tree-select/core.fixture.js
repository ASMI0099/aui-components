// Fixture of the aui-tree-select core suite: the test module and the data of core.html.
// Loaded before the library script, which registers the components on that module.
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
    .controller('TreeCtrl', ['$scope', '$timeout', '$q', function ($scope, $timeout, $q) {
        function categories() {
            return [
                {id: 1, name: 'Electronics', children: [
                    {id: 11, name: 'Phones', children: [
                        {id: 111, name: 'Android'},
                        {id: 112, name: 'iOS'},
                        {id: 113, name: 'Accessories', children: [{id: 1131, name: 'Cases'}, {id: 1132, name: 'Chargers'}]}
                    ]},
                    {id: 12, name: 'Laptops', children: [{id: 121, name: 'Ultrabooks'}, {id: 122, name: 'Gaming laptops'}]},
                    {id: 13, name: 'Cameras'}
                ]},
                {id: 2, name: 'Books', children: [
                    {id: 21, name: 'Fiction'},
                    {id: 22, name: 'Science', children: [{id: 221, name: 'Physics'}, {id: 222, name: 'Biology'}]}
                ]},
                {id: 3, name: 'Garden'},
                {id: 4, name: 'Home & Kitchen', children: [{id: 41, name: 'Cookware', disabled: true}, {id: 42, name: 'Bedroom'}]},
                {id: 5, name: 'A very long category name that does not fit into the dropdown width at all'}
            ];
        }
        function flatten(nodes, parentId, out) {
            nodes.forEach(function (node) {
                out.push({id: node.id, name: node.name, pid: parentId, disabled: node.disabled});
                if (node.children) flatten(node.children, node.id, out);
            });
            return out;
        }
        function big() {
            const data = [];
            let id = 100000;
            for (let a = 0; a < 20; a += 1) {
                const top = {id: ++id, name: 'Group ' + a, children: []};
                for (let b = 0; b < 50; b += 1) {
                    const mid = {id: ++id, name: 'Category ' + a + '-' + b, children: []};
                    for (let c = 0; c < 19; c += 1) mid.children.push({id: ++id, name: 'Item ' + a + '-' + b + '-' + c});
                    top.children.push(mid);
                }
                data.push(top);
            }
            return data;
        }

        $scope.cats = categories();
        $scope.cats2 = categories();
        $scope.cats3 = categories();
        $scope.cats4 = categories();
        $scope.catsReq = categories();
        $scope.catsDis = categories();
        $scope.catsModal = categories();
        $scope.flat = flatten(categories(), null, []);
        $scope.big = big();
        $scope.m = {
            single: 112, multi: [], strict: [], leaf: '', flat: '', lazy: [], req: '', dis: [41, 3], big: [],
            modal: '', parent: [], child: [], unknown: 999, labels: [7777]
        };
        $scope.labelsMap = {'7777': 'Archived category'};
        $scope.disabledValues = [3];
        $scope.changes = [];
        $scope.exprChanges = [];
        $scope.onChangeRef = function (payload) { $scope.changes.push(payload); };
        $scope.onChangeExpr = function (value, nodes, node) { $scope.exprChanges.push({value: value, count: nodes.length, node: node}); };
        $scope.counts = {open: 0, close: 0, expand: 0};
        $scope.show = {destroyable: true};
        $scope.api = {};
        $scope.bigApi = {};
        $scope.lazyApi = {};
        $scope.modal = {open: false};

        // Lazy children: roots and children arrive after 150 ms; node 'flaky' fails the first time.
        let flakyFailed = false;
        $scope.lazyDelay = 150;   // tests change it to check fast and slow loads
        $scope.lazyCalls = [];
        $scope.loadChildren = function (node, level) {
            $scope.lazyCalls.push(node ? node.id : 'root');
            return $timeout(function () {
                if (!node) return [{id: 'a', name: 'Alpha'}, {id: 'b', name: 'Beta'}, {id: 'flaky', name: 'Flaky'}, {id: 'leaf', name: 'Leaf', isLeaf: true}];
                if (node.id === 'flaky' && !flakyFailed) {
                    flakyFailed = true;
                    return $q.reject(new Error('demo failure'));
                }
                return [1, 2, 3].map(function (i) {
                    return {id: node.id + '-' + i, name: node.name + ' ' + i, isLeaf: level >= 2};
                });
            }, $scope.lazyDelay);
        };
    }]);
