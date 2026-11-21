// Fixture of the aui-date-picker time suite: the time types' models, an on-change log, a lunch-hour rule; every digest
// of the whole page is counted (window.__digests).
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
    .controller('TimeCtrl', ['$scope', function ($scope) {
        $scope.f = {
            dt: '2026-11-06 14:30:00',
            dtr: ['2026-11-10 09:00:00', '2026-11-12 18:00:00'],
            ps: null,
            pe: null,
            t: '08:15',
            tr: ['09:00:00', '18:00:00'],
            d12: '2026-11-06 14:30:00',
            slot: null,
            lim: null,
            nc: '2026-11-06 10:00:00',
            stamp: null,
            hm: null,
            dmax: ['2026-11-10 08:30:00', '2026-11-11 18:00:00'],
            dend: '2026-11-06 18:00:00',
            deft: '',
            defr: ['', '']
        };
        $scope.changes = [];
        $scope.log = function () {
            $scope.changes.push(Array.prototype.slice.call(arguments));
        };
        // 12:00 to 12:59 cannot be set
        $scope.lunch = function (hour) {
            return hour === 12;
        };
    }]);
