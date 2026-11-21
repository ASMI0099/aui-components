/**
 * A search form: store, department, categories and products that depend on each other, all from the mock catalog
 * API; and every product handed to one aui-select as a static list.
 */
(function () {
    'use strict';

    angular.module('auiExamples').controller('SearchFormExampleCtrl', ['$scope', 'catalogApi', function ($scope, catalogApi) {
        const vm = this;
        vm.filter = {};

        /** Stores: about 40, so the whole list at once; a lookup ($request.values) asks for those ids only. */
        vm.loadStores = function ($request) {
            return catalogApi.get('/stores/list', {ids: $request.values ? $request.values.join(',') : null}, {timeout: $request.cancel});
        };

        /** The departments of the chosen store; a lookup asks by id, whatever the store. */
        vm.loadDepartments = function ($request) {
            if ($request.values) return catalogApi.get('/departments/list', {ids: $request.values.join(',')}, {timeout: $request.cancel});
            return catalogApi.get('/departments/list', {storeId: $request.params.storeId}, {timeout: $request.cancel});
        };

        /** The whole category tree, flat (parentId), once; a lookup answers root-to-node chains. */
        vm.loadCategories = function ($request) {
            if ($request.values) return catalogApi.get('/categories/paths', {ids: $request.values.join(',')}, {timeout: $request.cancel});
            return catalogApi.get('/categories/flat', {}, {timeout: $request.cancel});
        };

        /** Products of the chosen store, department and categories, 20 per page, searched on the server. */
        vm.loadProducts = function ($request) {
            if ($request.values) return catalogApi.get('/products/by-ids', {ids: $request.values.join(',')}, {timeout: $request.cancel});
            const p = $request.params;
            const keyword = [p.keyword, $request.query].filter(Boolean).join(' ').trim();
            return catalogApi.get('/products', {
                storeId: p.storeId, departmentId: p.departmentId,
                categoryIds: p.categoryIds && p.categoryIds.length ? p.categoryIds.join(',') : null,
                keyword: keyword || null, page: $request.page, size: $request.pageSize
            }, {timeout: $request.cancel});
        };

        vm.productsReady = function () {
            return !!(vm.filter.storeId && vm.filter.departmentId);
        };
        vm.productsHint = function () {
            if (!vm.filter.storeId) return 'Choose a store first';
            if (!vm.filter.departmentId) return 'Choose a department of the store first';
            return '';
        };

        /** Saved values, as an edit form has them: ids only, taken from the newest product on sale. */
        vm.fillSaved = function () {
            catalogApi.get('/products', {status: 1, size: 1, sort: 'id', order: 'desc'}).then(function (page) {
                const product = page.items[0];
                if (!product) return;
                vm.filter = {
                    keyword: '',
                    storeId: product.storeId,
                    departmentId: product.departmentId,
                    categoryIds: [product.categoryId],
                    productId: product.id
                };
            });
        };
        vm.reset = function () {
            vm.filter = {};
        };

        // -------------------------------------------------------------------- every product as static options
        vm.all = {products: null, value: null, selected: [], state: '', error: '', loadMs: null, openMs: null};
        vm.loadAll = function () {
            const started = performance.now();
            vm.all.state = 'loading';
            vm.all.products = null;
            catalogApi.get('/products/all').then(function (products) {
                vm.all.products = products;
                vm.all.state = 'ready';
                vm.all.loadMs = Math.round(performance.now() - started);
            }, function (error) {
                vm.all.state = 'error';
                vm.all.error = error.message;
            });
        };
        /** How long the panel took to open: from the press until the frame after the list was drawn. */
        vm.measureOpen = function () {
            const started = performance.now();
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    $scope.$applyAsync(function () { vm.all.openMs = Math.round(performance.now() - started); });
                });
            });
        };
        vm.loadAll();
    }]);
})();
