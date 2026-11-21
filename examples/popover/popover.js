// aui-popover examples: rows edited in a card, the page's own triggers, is-open and api, the places, a log of the calls.
(function () {
    'use strict';
    window.angular.module('auiExamples').controller('PopoverCtrl', ['$q', '$timeout', function ($q, $timeout) {
        const vm = this;
        vm.rows = [{id: 1, name: 'Green tea', stock: 120}, {id: 2, name: 'Oolong', stock: 35}, {id: 3, name: 'Jasmine', stock: 0, locked: true}];
        vm.picked = null;
        vm.draft = {stock: ''};
        vm.f = {price: '', kind: null, day: null};
        vm.kinds = [{id: 1, name: 'Loose leaf'}, {id: 2, name: 'Tea bags'}, {id: 3, name: 'Gift box'}];
        vm.tags = ['Green tea', 'Oolong', 'Jasmine', 'White peony', 'Dark tea'];
        vm.places = ['bottom-start', 'bottom', 'bottom-end', 'top-start', 'right-start', 'left'];
        vm.icons = ['edit', 'pencil', 'square-pen', 'delete', 'copy', 'info', 'help', 'more', 'filter', 'settings', 'add'];
        vm.showText = true;
        vm.open = false;
        vm.api = {};
        vm.refuse = false;
        vm.lines = [];
        vm.log = function (what, about) {
            vm.lines.unshift(new Date().toLocaleTimeString() + '  ' + what + (about ? '  ' + about : ''));
            if (vm.lines.length > 40) vm.lines.length = 40;
        };
        vm.startEdit = function (row) {
            vm.draft.stock = String(row.stock);
            vm.log('on-open', row.name);
        };
        // false keeps the card open (the box must hold a whole number); then a save that answers 700 ms later: over 9999 it
        // fails (the card stays), otherwise the row takes the value and the card closes
        vm.saveEdit = function (row) {
            const text = String(vm.draft.stock || '').trim();
            if (!/^\d+$/.test(text)) {
                vm.log('on-confirm refused', row.name);
                return false;
            }
            vm.log('saving', row.name + ' = ' + text);
            return $timeout(function () {
                if (Number(text) > 9999) {
                    vm.log('save failed', row.name);
                    return $q.reject('too large');
                }
                row.stock = Number(text);
                vm.log('saved', row.name + ' = ' + row.stock);
                return true;
            }, 700);
        };
        vm.mayOpen = function () {
            vm.log(vm.refuse ? 'on-open refused' : 'on-open', 'bound');
            return !vm.refuse;
        };
    }]);
})();
