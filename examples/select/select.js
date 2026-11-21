/**
 * aui-select examples: the products of the mock catalog API (60,000).
 *
 * Product: {id, code, name, brandName, categoryId, storeId, departmentId, price, status, disabled}; disabled is true for
 * products that are not on sale. GET /products answers a page {items, total, hasMore, ...}; the component uses
 * hasMore when an answer has it, else a short page ends the list.
 */
(function () {
    'use strict';

    angular.module('auiExamples').controller('SelectExampleCtrl', ['$scope', 'catalogApi', function ($scope, catalogApi) {
        const vm = this;

        /**
         * One function for the list, the server search and the lookup of saved values: the request says which
         * ($request.values is set only for a lookup). Lookups go by ids only, so values the list leaves out (not on
         * sale, another brand) still get their labels.
         */
        vm.loadProducts = function (req) {
            if (req.values) {
                return catalogApi.get('/products/by-ids', {ids: req.values.join(',')}, {timeout: req.cancel});
            }
            const params = req.params || {};
            return catalogApi.get('/products', {
                keyword: req.query, brand: params.brand, status: params.status, sort: 'name',
                page: req.page, size: req.pageSize
            }, {timeout: req.cancel});
        };

        /** A dedicated lookup: the API's by-ids endpoint. */
        vm.productsByIds = function (req) {
            return catalogApi.get('/products/by-ids', {ids: req.values.join(',')}, {timeout: req.cancel});
        };

        // -------------------------------------------------------------------- paged, server search
        vm.paged = {value: null, items: []};

        // -------------------------------------------------------------------- a field that depends on another
        // The brands come from load-options too (everything at once): the distinct brands of the first 5,000 products.
        vm.loadBrands = function (req) {
            return catalogApi.get('/products', {size: 5000, sort: 'name'}, {timeout: req.cancel}).then(function (page) {
                const seen = new Set();
                return page.items.reduce(function (brands, product) {
                    if (!seen.has(product.brandName)) {
                        seen.add(product.brandName);
                        brands.push({id: product.brandName, name: product.brandName});
                    }
                    return brands;
                }, []).sort(function (a, b) { return a.name.localeCompare(b.name); });
            });
        };
        vm.dependent = {brand: null, products: []};

        // -------------------------------------------------------------------- an edit form: saved values
        // The record holds ids only (the two newest products, far from the first page); the labels come from
        // lookup-options. The record is loaded the way a form does it: after a request.
        vm.saved = {value: null, state: 'loading', error: ''};
        catalogApi.get('/products', {size: 2, sort: 'id', order: 'desc'}).then(function (page) {
            vm.saved.value = page.items.map(function (p) { return p.id; });
            vm.saved.state = 'ready';
        }, function (error) {
            vm.saved.state = 'error';
            vm.saved.error = error.message;
        });

        // -------------------------------------------------------------------- disabled options
        vm.mixed = {value: []};

        // -------------------------------------------------------------------- large static lists
        vm.sizes = [1000, 5000, 20000];
        vm.big = {size: 20000, options: null, value: null, state: '', stats: null, openMs: null, error: ''};
        vm.loadBig = function () {
            vm.big.options = null;
            vm.big.value = null;
            vm.big.stats = null;
            vm.big.openMs = null;
            vm.big.state = 'loading';
            const started = performance.now();
            catalogApi.get('/products/all', {limit: vm.big.size}).then(function (items) {
                const received = performance.now();
                vm.big.options = items;
                vm.big.state = 'ready';
                $scope.$$postDigest(function () {
                    $scope.$applyAsync(function () {
                        vm.big.stats = {
                            count: items.length,
                            downloadMs: Math.round(received - started),
                            readyMs: Math.round(performance.now() - received)
                        };
                    });
                });
            }, function (error) {
                vm.big.state = 'error';
                vm.big.error = error.message;
            });
        };

        /** on-open: time until the open panel has rendered and the browser has painted a frame. */
        vm.bigOpened = function () {
            const started = performance.now();
            $scope.$$postDigest(function () {
                requestAnimationFrame(function () {
                    $scope.$applyAsync(function () {
                        vm.big.openMs = Math.round(performance.now() - started);
                    });
                });
            });
        };
    }]);
})();
