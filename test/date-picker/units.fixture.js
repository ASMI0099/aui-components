// Fixture of the aui-date-picker units suite: the month, quarter, year, week and dates types' models, an on-change log,
// a rule refusing August; every digest of the whole page is counted (window.__digests).
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
    .controller('UnitsCtrl', ['$scope', function ($scope) {
        $scope.f = {
            month: '2026-11',
            mr: ['2026-01', '2026-03'],
            ms: null,
            me: null,
            q: '2026-Q4',
            qr: null,
            y: '2026',
            yr: null,
            wk: '2026-W45',
            wk0: '2026-11-01',
            dates: ['2026-11-03', '2026-11-10'],
            mlim: null,
            mstamp: null,
            mend: '2026-11-30 23:59:59'
        };
        $scope.changes = [];
        $scope.log = function () {
            $scope.changes.push(Array.prototype.slice.call(arguments));
        };
        // August cannot be picked (asked once for each month)
        $scope.noAugust = function (unit, parts) {
            $scope.askedUnit = unit;
            return unit === 'month' && parts.month === 8;
        };
    }]);
