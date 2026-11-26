// Fixture of the aui-date-picker round suite (page: round.html): native forms (names,
// required, reset), ranges over disabled days and units, end-only ranges, hour-level time rules, rules that fail, the
// api object replaced, keyboard and screen-reader states, the work of a digest. Angular errors are collected, the ones a
// check provokes on purpose apart; the page rules count their calls.
window.__ngErrors = [];
window.__purposeErrors = [];
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                const text = String(exception && exception.message || exception);
                if (/on purpose/.test(text)) window.__purposeErrors.push(text);
                else window.__ngErrors.push(text);
                $delegate(exception, cause);
            };
        }]);
    }])
    .controller('RoundCtrl', ['$scope', function ($scope) {
        $scope.f = {
            // native forms
            day: '2026-03-10', range: ['2026-03-10', '2026-03-12'], dates: ['2026-03-10', '2026-03-11'], need: '',
            reset: '2026-03-10',
            // ranges over disabled days and units
            far: ['2000-01-01', '2011-01-03'], months: ['2024-01', '2024-03'], quarters: ['2024-Q1', '2024-Q3'],
            years: ['2022', '2024'], pickFar: ['2024-01-01', '2024-01-02'],
            // time rules
            endOnly: ['', '18:15:00'], hourOff: '', night: ['23:15:00', ''], throwsTime: '',
            // rules that fail
            throwsDay: '',
            // keyboard and states
            kbd: '2026-03-10', clock: '', shortcuts: '', multi: ['2026-03-10', '2026-03-12'], hover: ['2026-02-15', '2026-02-18'],
            month: '', reqRange: ['', ''], times: ['09:00:00', '17:00:00'], outside: '2026-02-01',
            // the work of a digest
            count: '2026-03-10', many: [],
            // offsets, weeks, slots
            offset: '', week: '', slots: '', badSlots: ''
        };
        for (let i = 0; i < 300; i += 1) {
            const d = new Date(Date.UTC(2026, 0, 1 + i));
            $scope.f.many.push(d.toISOString().slice(0, 10));
        }
        $scope.calls = {day: 0};
        // range-crosses-disabled: 2011-01-02 and 2025-03-04 off; February 2024, Q2 2024 and the year 2023 off
        $scope.blocked = function (text, unit) {
            if (unit === 'month') return text.slice(0, 7) === '2024-02';
            if (unit === 'quarter') return text === '2024-Q2';
            if (unit === 'year') return text.slice(0, 4) === '2023';
            return text === '2011-01-02' || text === '2025-03-04';
        };
        $scope.countDay = function () {
            $scope.calls.day += 1;
            return false;
        };
        $scope.failDay = function () { throw new Error('day rule failed on purpose'); };
        $scope.failTime = function () { throw new Error('time rule failed on purpose'); };
        // an end's 18:xx is off (the start's is not)
        $scope.endEvening = function (h, end) { return !!end && h === 18; };
        // the hour 12 is off as a whole (asked with the minute and second null)
        $scope.noonOff = function (h, m) { return h === 12 && m === null; };
        // the minute 00 is off in every hour
        $scope.noZero = function (h, m) { return m === 0; };
        $scope.api = {a: {}, b: {}};
        $scope.useA = true;
        $scope.picked = [];
        $scope.shortcutItems = [{label: 'Leap evening', value: '2024-02-29 18:45:15'}];
    }]);
