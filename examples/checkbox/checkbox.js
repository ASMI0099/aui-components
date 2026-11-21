// aui-checkbox examples: states and sizes, a page form, a table with a select-all, aui-checkbox-group, a log of on-change.
(function () {
    'use strict';
    window.angular.module('auiExamples').controller('CheckboxCtrl', [function () {
        const vm = this;
        vm.f = {a: false, b: true, c: false, agree: false, perm: 'no'};
        vm.rows = [{name: 'Green tea', stock: 120, picked: true}, {name: 'Oolong', stock: 35, picked: false}, {name: 'Jasmine', stock: 0, picked: false},
            {name: 'White peony', stock: 18, picked: false}, {name: 'Dark tea', stock: 64, picked: true}, {name: 'Yellow tea', stock: 9, picked: false},
            {name: 'Pu-erh', stock: 40, picked: false}, {name: 'Black tea', stock: 77, picked: false}, {name: 'Matcha', stock: 12, picked: false},
            {name: 'Rooibos', stock: 5, picked: false}, {name: 'Chamomile', stock: 31, picked: true}];
        vm.someRows = () => vm.rows.some(r => r.picked) && !vm.rows.every(r => r.picked);
        vm.allRows = false;
        vm.syncAll = () => { vm.allRows = vm.rows.every(r => r.picked); };
        vm.setAll = checked => { vm.rows.forEach(r => { r.picked = checked; }); };
        // as a product list does it: a click on the row checks it, except from inside its checkbox (or another control)
        vm.toggleRow = function (row, $event) {
            if ($event && $event.target && $event.target.closest('aui-checkbox, aui-button, button, a, img, input')) return;
            row.picked = !row.picked;
            vm.syncAll();
        };
        vm.syncAll();
        vm.permOptions = [{id: 'read', name: 'Read'}, {id: 'write', name: 'Write'}, {id: 'delete', name: 'Delete', locked: true},
            {id: 'audit', name: 'Audit'}, {id: 'export', name: 'Export'}];
        vm.perms = ['read'];
        vm.layout = 'row';
        vm.pageOptions = [{value: 'p1', label: 'Product list'}, {value: 'p2', label: 'Product detail'}, {value: 'p3', label: 'Orders'},
            {value: 'p4', label: 'Refunds'}, {value: 'p5', label: 'Members'}, {value: 'p6', label: 'Reports'}];
        vm.pages = ['p2'];
        vm.lines = [];
        vm.log = function (what, value, oldValue, source) {
            vm.lines.unshift(new Date().toLocaleTimeString() + '  ' + what + '  ' + JSON.stringify(oldValue) + ' -> ' + JSON.stringify(value) + '  (' + source + ')');
            if (vm.lines.length > 30) vm.lines.length = 30;
        };
    }]);
})();
