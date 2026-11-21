// aui-date-picker examples: the values of each example and a log of on-change (and api) calls.
(function () {
    'use strict';
    window.angular.module('auiExamples').controller('DatePickerCtrl', ['AuiDate', function (AuiDate) {
        const vm = this;
        vm.f = {
            day: null,
            limited: null,
            shortcuts: null,
            stamp: null,
            week0: AuiDate.today(),
            server: '2026-11-06T06:30:00Z',
            range: null,
            promotionStartTime: null,
            promotionEndTime: null,
            required: null,
            stay: null,
            small: null,
            large: null,
            ro: '2026-11-06',
            off: '2026-11-06',
            api: null,
            dt: null,
            dtLimited: null,
            dt12: '2026-11-06 14:30:00',
            endsAt: null,
            campaign: null,
            promotionStart: null,
            promotionEnd: null,
            orders: null,
            t: null,
            tStep: '09:30',
            slot: null,
            hours: ['09:00', '18:00'],
            month: null,
            reportFrom: null,
            reportTo: null,
            quarter: null,
            quarters: null,
            year: null,
            years: null,
            week: null,
            dates: null
        };
        vm.api = {};
        vm.lines = [];
        vm.log = function () {
            const parts = Array.prototype.slice.call(arguments).map(v => (typeof v === 'string' ? v : JSON.stringify(v)));
            vm.lines.unshift(new Date().toTimeString().slice(0, 8) + '  ' + parts.join('  '));
            if (vm.lines.length > 60) vm.lines.length = 60;
        };
        // opening hours: 09:00 to 17:59
        vm.outsideHours = function (hour) {
            return hour < 9 || hour > 17;
        };
        // weekends cannot be picked
        vm.weekend = function (parts) {
            const day = new Date(parts.year, parts.month - 1, parts.day).getDay();
            return day === 0 || day === 6;
        };
    }]);
})();
