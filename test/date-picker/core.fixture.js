// Fixture of the aui-date-picker core suite: the pickers' models, an on-change log, a weekend rule; every digest of
// the whole page is counted (window.__digests).
window.__ngErrors = [];
window.__digests = [];
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                window.__ngErrors.push(String(exception && exception.message || exception));
                $delegate(exception, cause);
            };
        }]);
    }])
    .run(['$rootScope', function ($rootScope) {
        const proto = Object.getPrototypeOf($rootScope);
        const digest = proto.$digest;
        proto.$digest = function () {
            if (this === $rootScope) window.__digests.push(performance.now());
            return digest.apply(this, arguments);
        };
    }])
    .controller('DateCtrl', ['$scope', function ($scope) {
        $scope.f = {
            day: '2026-11-06',
            limited: null,
            week: '2026-11-06',
            range: null,
            stamp: null,
            start: '2026-12-01 08:00:00',
            end: '2026-12-24 18:00:00',
            server: '2026-11-06T06:30:00Z',
            maxr: ['2026-11-01', '2026-11-03'],
            api: null,
            short: null,
            stay: ['2026-11-02', '2026-11-03'],
            narrow: null,
            dur: ['2026-11-01', '2026-11-02'],
            nights: ['2026-11-06', '2026-11-13'],
            tight: null,
            dyn: '2026-11-15',
            dynMin: '',
            req: '2026-11-07',
            tsr: null,
            edge: '9999-12-30',
            parts: '2026-11-07'
        };
        $scope.api = {};
        $scope.changes = [];
        $scope.log = function () {
            $scope.changes.push(Array.prototype.slice.call(arguments));
        };
        $scope.weekend = function (parts) {
            const day = new Date(parts.year, parts.month - 1, parts.day).getDay();
            return day === 0 || day === 6;
        };
    }]);
