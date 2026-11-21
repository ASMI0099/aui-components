// Fixture of the button suite: aui-button as pages use it (ng-click on the element, disabled and
// loading bound, type submit in a form, icon classes) and its new parts (on-click with a promise, the family's icons,
// ng-disabled), with a page's span rules and a clickable row. Every click handler of the page writes to its log.
window.__ngErrors = [];
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                window.__ngErrors.push(String(exception && exception.message || exception));
                $delegate(exception, cause);
            };
        }]);
    }])
    .controller('ButtonCtrl', ['$scope', '$q', '$timeout', function ($scope, $q, $timeout) {
        $scope.log = [];
        $scope.state = {off: true, loading: false, submitting: false, lt: false};
        $scope.many = new Array(100);
        $scope.note = function (what) { $scope.log.push(what); };
        // on-click: a save that takes 300 ms
        // expanded: rows' variant lists; loadVariants answers after 150 ms (fails while variantFails)
        $scope.rows = {a: false, b: false, c: false};
        $scope.looks = {chevron: false, more: false, caret: false, plus: false, odd: false, double: false};
        // copy-text: what the page copies, and what on-copy reports
        $scope.copyValue = 'Order 1042';
        $scope.copies = [];
        $scope.copied = function (success, text) { $scope.copies.push([success, text]); };
        $scope.variantCalls = [];
        $scope.variantFails = false;
        $scope.loadVariants = function (expanded) {
            $scope.variantCalls.push(expanded);
            if (!expanded) return undefined;
            return $timeout(function () { if ($scope.variantFails) return $q.reject(new Error('no variants')); }, 150);
        };
        $scope.saves = 0;
        $scope.save = function ($event) {
            $scope.saves += 1;
            $scope.lastEvent = $event && $event.type;
            return $timeout(function () { $scope.note('saved'); }, 300);
        };
    }]);
