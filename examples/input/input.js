/**
 * aui-input examples: both styles next to the selects, show-count, numbers with a digit limit, the field's checks
 * in a page form, and the options read as the selects read theirs. No server data: every value is on the page.
 */
(function () {
    'use strict';

    angular.module('auiExamples').controller('InputExampleCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
        const vm = this;

        vm.stores = ['Store 01', 'Store 02', 'Store 03'].map(function (label, i) { return {id: i + 1, label: label}; });
        vm.categories = [
            {id: 'e', label: 'Electronics', children: [{id: 'e1', label: 'Phones'}, {id: 'e2', label: 'Laptops'}]},
            {id: 'h', label: 'Home', children: [{id: 'h1', label: 'Kitchen'}, {id: 'h2', label: 'Garden'}]}
        ];
        vm.extras = {small: 'Small', smallStore: [1], smallCat: 'e1', large: 'Large', largeStore: 2, largeCat: 'h1'};
        vm.notes = {remark: '', address: '', short: ''};
        vm.rows = [{id: 1, name: 'Atlas Active Car Chargers', priority: 120}, {id: 2, name: 'Brightline Desk Lamp', priority: 80},
            {id: 3, name: 'Oakline Coffee Beans', priority: null}];
        vm.find = {query: '', busy: false, log: []};
        // a search that takes a moment, as a server's would: the spinner meanwhile
        vm.runSearch = function (value) {
            vm.find.log.unshift(JSON.stringify(value));
            vm.find.log.length = Math.min(vm.find.log.length, 5);
            vm.find.busy = true;
            $timeout(function () { vm.find.busy = false; }, 600);
        };

        vm.search = {name: '', storeId: null};
        vm.count = {code: 'ITEM-001', note: '', over: 'Running shoes', clear: 'Boots', strict: '', disabled: 'Sandal', readonly: 'Slipper'};
        vm.numbers = {priority: 120, amount: null, fromText: '12', percent: 50, price: 19.9};
        vm.affix = {keyword: '', weight: 1.25, rate: 8, site: '', basic: ''};
        vm.secret = {current: '', next: '', basic: ''};
        vm.events = {value: 'Atlas', api: {}, log: []};
        vm.logEvent = function (name) {
            vm.events.log.unshift(name);
            vm.events.log.length = Math.min(vm.events.log.length, 5);
        };
        vm.checks = {};
        vm.options = {readonly: true, label: true, count: true};
        vm.basic = {name: 'AAAA', note: 'Boots'};

        vm.finished = [];
        vm.onFinish = function ($value, $event) {
            vm.finished.unshift(($event && $event.type) + ': ' + JSON.stringify($value));
            vm.finished.length = Math.min(vm.finished.length, 4);
        };

        /** The page form as a page reads it: form.<name> of each field, and the form itself. */
        vm.formState = function (form) {
            if (!form) return {};
            const fields = {};
            ['title', 'code', 'short', 'qty'].forEach(function (name) {
                const field = form[name];
                if (!field) return;
                fields[name] = {error: Object.keys(field.$error), touched: field.$touched, dirty: field.$dirty};
            });
            return {fields: fields, formInvalid: form.$invalid, formDirty: form.$dirty};
        };

        vm.resetForm = function (form) {
            form.$setPristine();
            form.$setUntouched();
        };
    }]);
})();
