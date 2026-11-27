// Fixture of the pagination suite: the new API (current-page, page-size, total, on-change, loading) and the page-model
// form the platform's lists use (a handler that reads the model, one that reads the copy it is given), sizes, layout,
// simple, a narrow place. Angular errors and every change are logged.
window.__ngErrors = [];
// the browser's observer loop error (a fitting that changed the observed width in the same frame)
window.__roErrors = [];
window.addEventListener('error', function (e) { if (/ResizeObserver/.test(String(e.message))) window.__roErrors.push(String(e.message)); });
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                window.__ngErrors.push(String(exception && exception.message || exception));
                $delegate(exception, cause);
            };
        }]);
    }])
    .controller('PageCtrl', ['$scope', '$q', function ($scope, $q) {
        $scope.log = [];
        $scope.v = {page: 5, size: 10, total: 1000, busy: false};
        $scope.go = function (page, size, source) {
            $scope.log.push([page, size, source]);
            $scope.v.page = page;
            $scope.v.size = size;
        };
        // the platform's two handler styles: one reads the model (written before the call), one reads the copy
        $scope.search = {page: {currentPage: 3, pageItemSize: 10, totalItemCount: 236, totalPageCount: 24}, seen: []};
        $scope.search.refreshDataOnPageSizeChange = function () {
            $scope.search.seen.push('model ' + $scope.search.page.currentPage + ' ' + $scope.search.page.pageItemSize);
        };
        $scope.picker = {page: {currentPage: 1, pageItemSize: 5, totalItemCount: 42, totalPageCount: 9}, seen: []};
        $scope.picker.onPageChange = function (page) {
            $scope.picker.seen.push('copy ' + page.currentPage + ' ' + page.pageItemSize + ' ' + (page === $scope.picker.page));
        };
        $scope.loadingModel = {currentPage: 2, pageItemSize: 10, totalItemCount: -1, totalPageCount: 5};
        $scope.emptyModel = {currentPage: 1, pageItemSize: 10, totalItemCount: 0, totalPageCount: 0};
        $scope.noPages = {currentPage: 2, pageItemSize: 10, totalItemCount: 95};
        $scope.single = {page: 1, total: 8};
        $scope.f = {};
        // nothing moves from page to page: 2000 pages; simple with a page of its own; a box just under the whole bar
        $scope.w = {page: 1, total: 20000};
        $scope.sw = {page: 1};
        $scope.lim = {page: 4};
        // the total went down: the bindings (loading too), the page model
        $scope.cl = {page: 44, total: 437, busy: false, log: []};
        $scope.cl.go = function (page, source) { $scope.cl.log.push([page, source]); $scope.cl.page = page; };
        $scope.clm = {page: {currentPage: 5, pageItemSize: 10, totalItemCount: 50, totalPageCount: 5}, seen: []};
        $scope.clm.onPage = function (copy) { $scope.clm.seen.push(copy.currentPage); };
        // total-text
        $scope.r = {page: 1, total: 60000};
        // a promise returned by on-change: $q's, the browser's own
        $scope.pr = {page: 1, d: null, log: []};
        $scope.pr.load = function (page) { $scope.pr.log.push(page); $scope.pr.page = page; $scope.pr.d = $q.defer(); return $scope.pr.d.promise; };
        $scope.nt = {page: 1, done: null};
        $scope.nt.load = function (page) { $scope.nt.page = page; return new Promise(function (resolve) { $scope.nt.done = resolve; }); };
        // search: a search model's function (called as its method), an expression, a search that returns its request
        $scope.sm = {page: {currentPage: 1, pageItemSize: 10, totalItemCount: 300, totalPageCount: 30}, calls: []};
        $scope.sm.search = function (page, size) {
            this.calls.push([page, size, this === $scope.sm, arguments.length, this.page.currentPage, this.page.pageItemSize]);
        };
        $scope.sx = {calls: []};
        $scope.sx.find = function (page, kind) { $scope.sx.calls.push([page, kind]); };
        $scope.ss = {page: {currentPage: 1, pageItemSize: 10, totalItemCount: 300, totalPageCount: 30}, d: null};
        $scope.ss.search = function () { this.d = $q.defer(); return this.d.promise; };
        // scroll-to: a list in a box that scrolls; the page loads after a change
        $scope.sc = {page: 1, busy: false};
        $scope.sc.go = function (page) { $scope.sc.page = page; $scope.sc.busy = true; };
    }]);
