// Fixture of the modal suite: aui-modals as pages use them (plain, defer-render, on-rendered, a footer with
// aui-modal-close actions, background-opacity, close-on-esc off) with the message services for a stacked box; every
// on-close, on-rendered and action is written to a page log, every digest of the whole page counted (window.__digests).
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
    .controller('ModalCtrl', ['$scope', '$q', '$timeout', function ($scope, $q, $timeout) {
        $scope.open = {plain: false, deferred: false, rendered: false, actions: false, glass: false, noesc: false, confirm: false};
        // on-confirm of m-confirm: a save that answers saveMs later (true: saved)
        $scope.saveMs = 600;
        $scope.saveSlow = function () {
            const answer = $q.defer();
            $scope.log.push({what: 'save started', at: performance.now()});
            $timeout(function () {
                $scope.log.push({what: 'save answered', at: performance.now()});
                answer.resolve(true);
            }, $scope.saveMs);
            return answer.promise;
        };
        $scope.log = [];
        $scope.note = function (what) { $scope.log.push({what: what, at: performance.now()}); };
        // what a body looks like when on-rendered runs: is the body there
        $scope.rendered = function (name) {
            const body = document.querySelector('#' + name + '-body');
            $scope.log.push({what: 'rendered ' + name, at: performance.now(), body: !!body});
        };
        // an action of aui-modal-close: the model as the action sees it
        $scope.cancelAction = function () {
            $scope.log.push({what: 'cancel action', at: performance.now(), modelThen: $scope.open.actions});
        };
        // A page that starts its deferred body's search with a broadcast (as businessHelp.js tableMultiSelectV1 does):
        // the old way, a timer of 300 ms from the opening; the new way, from on-rendered. busy: ms the opening's own
        // code takes (a heavy page's digest)
        $scope.openSearch = function (way, busy) {
            $scope.open.search = true;
            $scope.searchWay = way;
            if (way === 'timer') setTimeout(function () { $scope.$broadcast('startSearch', way); }, 300);
            const until = performance.now() + (busy || 0);
            while (performance.now() < until) { /* the page is busy */ }
        };
        $scope.searchRendered = function () {
            if ($scope.searchWay !== 'rendered') return;
            setTimeout(function () { $scope.$broadcast('startSearch', 'rendered'); }, 0);
        };
    }])
    // In the deferred body: listens for the page's broadcast that starts its search
    .directive('searchListener', [function () {
        return {
            restrict: 'A',
            link: function (scope) {
                scope.$on('startSearch', function (event, way) {
                    const s = angular.element(document.body).scope();
                    s.log.push({what: 'search started', way: way, at: performance.now()});
                });
            }
        };
    }]);
