// aui-pagination examples: a list loaded page by page (a short delay for the server), a search model, sizes and forms,
// the page model.
(function () {
    'use strict';
    window.angular.module('auiExamples').controller('PaginationCtrl', ['$timeout', function ($timeout) {
        const vm = this;
        const names = ['Green tea', 'Oolong', 'Jasmine', 'White peony', 'Dark tea', 'Yellow tea', 'Pu-erh', 'Black tea', 'Matcha', 'Rooibos'];
        const all = [];
        for (let i = 1; i <= 437; i += 1) all.push({n: i, name: names[i % names.length] + ' ' + i, stock: (i * 37) % 200});
        vm.page = 1;
        vm.size = 10;
        vm.total = all.length;
        vm.rows = all.slice(0, vm.size);
        vm.note = 'Page 1, 10 a page';
        // the request's promise returned: the bar shows the loading look until it comes (no loading flag of its own)
        vm.load = function (page, size, source) {
            vm.page = page;
            vm.size = size;
            vm.note = 'Loading page ' + page + ' (' + source + ')';
            return $timeout(function () {
                vm.rows = all.slice((page - 1) * size, page * size);
                vm.note = 'Page ' + page + ', ' + size + ' a page';
            }, 400);
        };
        // a search model: the bar writes the page into sm.page and calls sm.search(currentPage, pageItemSize) itself
        vm.sm = {page: {currentPage: 1, pageItemSize: 5, totalItemCount: all.length, totalPageCount: Math.ceil(all.length / 5)},
            rows: all.slice(0, 5)};
        vm.sm.search = function (currentPage, pageItemSize) {
            const sm = this;
            return $timeout(function () {
                sm.rows = all.slice((currentPage - 1) * pageItemSize, currentPage * pageItemSize);
                sm.page.totalItemCount = all.length;
                sm.page.totalPageCount = Math.ceil(all.length / pageItemSize);
            }, 300);
        };
        // the fields beside each size (their own values)
        vm.f = {};
        vm.choices = [{label: 'First', value: 1}, {label: 'Second', value: 2}];
        vm.model = {currentPage: 2, pageItemSize: 10, totalItemCount: 236, totalPageCount: 24};
        vm.onPageData = function () { /* the page's search would run here with vm.model.currentPage */ };
    }]);
})();
