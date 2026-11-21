// aui-button examples: variants and intents, sizes and shapes, icons, loading / waiting / disabled, a clickable row, the
// family's accent, a log of the clicks.
(function () {
    'use strict';
    window.angular.module('auiExamples').controller('ButtonCtrl', ['$q', '$timeout', 'AuiMessage', function ($q, $timeout, AuiMessage) {
        const vm = this;
        vm.variants = ['solid', 'soft', 'outline', 'elevated', 'dashed', 'ghost', 'link'];
        vm.intents = ['brand', 'neutral', 'success', 'warning', 'danger'];
        vm.sizes = ['xs', 'sm', 'md', 'lg', 'xl'];
        vm.icons = ['add', 'edit', 'delete', 'copy', 'check', 'close', 'search', 'refresh', 'download', 'upload', 'filter', 'settings', 'more', 'info', 'help'];
        vm.rows = [{name: 'Green tea', stock: 120}, {name: 'Oolong', stock: 0}, {name: 'Jasmine', stock: 35}];
        vm.busy = false;
        vm.lines = [];
        vm.note = function (line) {
            vm.lines.unshift(new Date().toTimeString().slice(0, 8) + '  ' + line);
        };
        vm.toggleBusy = function () {
            vm.busy = true;
            vm.note('loading for 2 s');
            $timeout(function () { vm.busy = false; }, 2000);
        };
        // product rows whose variants load on their first opening ("Desk lamp" fails once)
        vm.products = [
            {id: 1, name: 'Cotton T-shirt', price: '59.00', stock: 120},
            {id: 2, name: 'Running shoes', price: '329.00', stock: 40},
            {id: 3, name: 'Desk lamp', price: '89.00', stock: 15, failOnce: true}
        ];
        vm.loadVariants = function (g, expanded) {
            if (!expanded || g.variants) return undefined;   // closing, or loaded before: at once
            vm.note('loading the variants of ' + g.name);
            return $timeout(function () {
                if (g.failOnce) {
                    g.failOnce = false;
                    vm.note('the variants of ' + g.name + ' did not load (it stays closed); try again');
                    return $q.reject(new Error('not loaded'));   // as a request that failed
                }
                g.variants = [1, 2, 3].map(function (n) { return {name: g.name + ' / variant ' + n, price: g.price, stock: Math.round(g.stock / 3)}; });
            }, 900);
        };
        // a link with text (as a page's own link buttons): the variants of a product, loaded on the first opening
        vm.linkOpen = false;
        vm.looks = {more: false, double: false, caret: false, plus: false};   // the other expand-icon looks
        vm.loadLink = function (expanded) {
            if (!expanded || vm.linkLoaded) return undefined;
            return $timeout(function () { vm.linkLoaded = true; }, 1200);
        };
        vm.expandAll = function (open) {
            vm.products.forEach(function (g) { if (g.variants || !open) g.open = open; });
            vm.note(open ? 'opened the rows whose variants are loaded' : 'closed every row');
        };
        // copy buttons: what they copy; a quiet copy confirmed by the page's own notice
        vm.code = 'ORD-2026-1042';
        vm.link = window.location.href;
        vm.copiedQuietly = function (success) {
            if (success) AuiMessage.success('The code is on the clipboard');
            else AuiMessage.error('The code could not be copied');
        };
        vm.saves = 0;
        vm.save = function () {
            vm.saves += 1;
            vm.note('save #' + vm.saves + ' started');
            return $timeout(function () { vm.note('save #' + vm.saves + ' done'); }, 1500);
        };
    }]);
})();
