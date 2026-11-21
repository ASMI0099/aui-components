// Fixture of the aui-tree-select selectable-field suite: the test module and category data with groups
// (selectable: false), as the backend sends them. Loaded before the library script.
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
    .controller('SelectableCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
        // Groups: Electronics and Phones (nested), Science shelf (under the selectable Books), and two groups
        // without children (Empty group, Archive).
        function categories() {
            return [
                {id: 1, name: 'Electronics', selectable: false, children: [
                    {id: 11, name: 'Phones', selectable: false, children: [
                        {id: 111, name: 'Smartphones'},
                        {id: 112, name: 'Feature phones'}
                    ]},
                    {id: 12, name: 'Laptops', children: [{id: 121, name: 'Ultrabooks'}, {id: 122, name: 'Gaming laptops'}]},
                    {id: 13, name: 'Empty group', selectable: false, children: []}
                ]},
                {id: 2, name: 'Books', children: [
                    {id: 21, name: 'Fiction'},
                    {id: 22, name: 'Science shelf', selectable: false, children: [{id: 221, name: 'Physics'}, {id: 222, name: 'Biology'}]},
                    {id: 23, name: 'Archive', selectable: false, children: []}
                ]},
                {id: 3, name: 'Garden'}
            ];
        }
        const byId = {};
        (function walk(nodes) {
            nodes.forEach(function (node) {
                byId[node.id] = node;
                if (node.children) walk(node.children);
            });
        })(categories());

        $scope.data = {};
        ['off', 'single', 'strict', 'all', 'parent', 'child', 'mLinked', 'mInert', 'mSingle', 'mStrict', 'dis', 'toggle']
            .forEach(function (name) { $scope.data[name] = categories(); });
        $scope.data.auto = [{id: 9, name: 'Only group', selectable: false, children: [{id: 91, name: 'Only child'}]}];
        $scope.m = {
            off: '', single: '', strict: [], all: [], parent: [], child: [], auto: '',
            mLinked: [11], mInert: [23], mSingle: 11, mStrict: [11], dis: [], toggle: '', lazy: '', remote: []
        };
        $scope.p = {sf: ''};
        $scope.disabledValues = [];
        $scope.changes = 0;
        $scope.onChange = function () { $scope.changes += 1; };

        // Lazy tree: children come from the same data, 60 ms later. Nodes without children are marked as leaves.
        function lazyCopy(node) {
            const copy = {id: node.id, name: node.name};
            if (node.selectable === false) copy.selectable = false;
            if (!node.children || node.children.length === 0) copy.isLeaf = true;
            return copy;
        }
        $scope.loadKids = function (node) {
            return $timeout(function () {
                const list = node ? (byId[node.id].children || []) : categories();
                return list.map(lazyCopy);
            }, 60);
        };
        // Server search: the branches down to the matching nodes (a pruned tree), 40 ms later.
        $scope.searchTree = function (query) {
            const q = String(query).toLowerCase();
            function prune(nodes) {
                const out = [];
                nodes.forEach(function (node) {
                    const kids = node.children ? prune(node.children) : [];
                    if (node.name.toLowerCase().indexOf(q) !== -1 || kids.length > 0) {
                        const copy = lazyCopy(node);
                        if (kids.length > 0) {
                            copy.children = kids;
                            delete copy.isLeaf;
                        }
                        out.push(copy);
                    }
                });
                return out;
            }
            return $timeout(function () { return prune(categories()); }, 40);
        };
    }]);
