/**
 * aui-tree-select examples: the categories of the mock catalog API (about 23,700 nodes; a chain twelve levels deep,
 * a node with 20,000 children), and larger generated trees of up to 100,000 nodes.
 *
 * Node fields: {id, parentId, code, name, level, leaf, childCount, selectable, disabled, children?}. A node with
 * leaf: false and no children is not loaded yet; the component asks load-children for it.
 */
(function () {
    'use strict';

    const CHILDREN_PAGE_SIZE = 200;

    angular.module('auiExamples').controller('TreeSelectExampleCtrl', ['$scope', '$q', 'catalogApi', function ($scope, $q, catalogApi) {
        const vm = this;

        /**
         * Lazy loading: the children of a node (the roots for none), 200 per page. The API answers
         * {items, total, hasMore}: a node with more children gets a "Load more" row.
         */
        vm.loadChildren = function (req) {
            return catalogApi.get('/categories/children', {
                parentId: req.node ? req.node.id : undefined, page: req.page, size: CHILDREN_PAGE_SIZE
            }, {timeout: req.cancel});
        };

        /**
         * Server-side search: the matches as a pruned tree ({items, total}). The component resolves `cancel` when the
         * query changes or the panel closes; as the $http timeout it aborts the request.
         */
        vm.searchLimit = 100;
        vm.searchDelay = 300;
        vm.remoteSearch = function (query, cancel) {
            return catalogApi.get('/categories/search/tree', {keyword: query, limit: vm.searchLimit}, {timeout: cancel});
        };

        /** Lookup of selected values the tree has not loaded: their root-to-node chains, all in one request. */
        vm.categoryPaths = function (req) {
            return catalogApi.get('/categories/paths', {ids: req.values.join(',')}, {timeout: req.cancel});
        };

        /** The first category with exactly this name. */
        function findCategory(name) {
            return catalogApi.get('/categories/search', {keyword: name, size: 20}).then(function (page) {
                const hit = page.items.filter(function (item) { return item.name === name; })[0];
                return hit || $q.reject(new Error('category "' + name + '" not found'));
            });
        }

        // -------------------------------------------------------------------- lazy loading + server-side search
        vm.single = {value: null, items: []};

        vm.strategies = ['all', 'parent', 'child'];
        vm.multi = {strategy: 'all', value: [], items: []};
        vm.setStrategy = function (strategy) {
            vm.multi = {strategy: strategy, value: [], items: []};
        };

        // -------------------------------------------------------------------- a saved value the tree has not loaded
        // As in an edit form: the model holds an id from saved data (here "Nesting Level 12", found by name first).
        // The component looks up its path itself; reveal-selected opens the branches down to it on open.
        vm.saved = {value: null, state: 'loading', error: ''};
        findCategory('Nesting Level 12').then(function (hit) {
            vm.saved.value = hit.id;
            vm.saved.state = 'ready';
        }, function (error) {
            vm.saved.state = 'error';
            vm.saved.error = error.message;
        });

        // -------------------------------------------------------------------- a tree that depends on another field
        // The top-level categories (everything at once), then the tree of the one picked (load-options per rootId).
        vm.loadRoots = function (req) {
            return catalogApi.get('/categories/children', {}, {timeout: req.cancel});
        };
        vm.loadSubtree = function (req) {
            if (req.values) return vm.categoryPaths(req);   // a lookup goes through the same function
            return catalogApi.get('/categories/tree', {rootId: req.params.rootId, maxDepth: 3}, {timeout: req.cancel});
        };
        vm.dependent = {root: null, value: []};

        // -------------------------------------------------------------------- the whole tree, local search
        vm.depths = [
            {value: 2, text: '2 levels (97 nodes)'},
            {value: 3, text: '3 levels (about 20,700 nodes)'},
            {value: 0, text: 'every level (about 23,700 nodes)'}
        ];
        vm.whole = {depth: 3, options: null, value: [], state: '', stats: null, error: ''};
        vm.loadWhole = function () {
            const depth = vm.whole.depth;
            vm.whole.options = null;
            vm.whole.value = [];
            vm.whole.stats = null;
            vm.whole.state = 'loading';
            const started = performance.now();
            catalogApi.get('/categories/tree', {maxDepth: depth || undefined}).then(function (items) {
                const received = performance.now();
                vm.whole.options = items;
                vm.whole.state = 'ready';
                // the component indexes the data in this digest; measure until it has finished
                $scope.$$postDigest(function () {
                    $scope.$applyAsync(function () {
                        vm.whole.stats = {
                            nodes: countNodes(items),
                            downloadMs: Math.round(received - started),
                            indexMs: Math.round(performance.now() - received)
                        };
                    });
                });
            }, function (error) {
                vm.whole.state = 'error';
                vm.whole.error = error.message;
            });
        };

        function countNodes(items) {
            let count = 0;
            const stack = items.slice();
            while (stack.length) {
                const node = stack.pop();
                count += 1;
                if (node.children) for (let i = 0; i < node.children.length; i += 1) stack.push(node.children[i]);
            }
            return count;
        }

        // -------------------------------------------------------------------- the whole tree by load-options, no paging
        // As a form's category field: one request for every node, a flat list with parentId (ordered by id: a parent
        // always before its children, so a smaller limit keeps whole branches), on the first open.
        vm.flatSizes = [
            {value: 20000, text: '20,000 nodes of the catalog'},
            {value: 50000, text: '50,000 generated nodes'},
            {value: 100000, text: '100,000 generated nodes'}
        ];
        vm.flat = {size: 100000, single: null, multi: [], error: ''};
        vm.loadFlat = function (req) {
            if (req.values) return vm.categoryPaths(req);   // a lookup goes through the same function
            return catalogApi.get('/categories/flat', {limit: req.params.size}, {timeout: req.cancel});
        };
        // saved values, as an edit form has them: one of 20,000 children, and a node twelve levels down
        vm.setFlatSaved = function () {
            vm.flat.error = '';
            $q.all([findCategory('Spare Part 12345'), findCategory('Nesting Level 12')]).then(function (hits) {
                vm.flat.single = hits[1].id;
                vm.flat.multi = [hits[0].id, hits[1].id];
            }, function (error) {
                vm.flat.error = error.message;
            });
        };
        vm.clearFlat = function () {
            vm.flat.single = null;
            vm.flat.multi = [];
        };

        // -------------------------------------------------------------------- edge cases subtree, fully expanded
        vm.edge = {options: null, value: null, error: ''};
        findCategory('Edge Cases').then(function (hit) {
            return catalogApi.get('/categories/tree', {rootId: hit.id});
        }).then(function (items) {
            vm.edge.options = items;
        }).catch(function (error) {
            vm.edge.error = error.message;
        });

        // -------------------------------------------------------------------- one node with 20,000 children, in pages
        const wideRoot = findCategory('Spare Parts');
        vm.wide = {value: []};
        vm.loadWide = function (req) {
            if (req.node) return vm.loadChildren(req);
            return wideRoot.then(function (parts) { return [parts]; });
        };
    }]);
})();
