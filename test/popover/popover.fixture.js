// Fixture of the popover suite: aui-popovers as pages use them (the edit icon with a title and the card's own footer;
// a trigger of the page's own, no title, an empty footer; a read-only box in a label as the trigger, kept open; bound
// to the page with is-open and api; open from the start; places near the screen's edges; in a row that counts its
// clicks; with an aui-select inside; in an aui-modal; one that the page takes away; ten more, closed). Every on-open,
// on-close and on-confirm is written to the page's log, every digest of the whole page counted (window.__digests).
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
    .controller('PopCtrl', ['$scope', '$q', function ($scope, $q) {
        $scope.log = [];
        $scope.note = function (what) { $scope.log.push(what); };
        // what the page's on-open and on-confirm answer: false cancels the opening / keeps the card open
        $scope.allow = {open: true, confirm: true};
        $scope.opening = function (id) {
            $scope.log.push('open ' + id);
            return $scope.allow.open;
        };
        $scope.confirming = function (id) {
            $scope.log.push('confirm ' + id);
            return $scope.allow.confirm ? undefined : false;
        };
        // on-confirm of p-save: a save that answers when the check says (save.deferred)
        $scope.save = {deferred: null};
        $scope.saving = function () {
            $scope.log.push('confirm save');
            $scope.save.deferred = $q.defer();
            return $scope.save.deferred.promise;
        };
        $scope.flags = {off: true};
        $scope.icons = ['edit', 'pencil', 'square-pen', 'delete', 'copy', 'info', 'help', 'more', 'filter', 'settings', 'add', 'unknown'];
        $scope.trig = {text: 'Change the price', show: true, pos: '', tone: '', showTitle: true};
        $scope.computed = {id: 0};
        $scope.layout = {padding: '', width: ''};
        $scope.late = {api: null};
        $scope.longNote = new Array(40).join('The stock counts what can be sold today. ');
        $scope.open = {bound: false, start: true};
        $scope.api = {bound: {}, save: {}, off: {}};
        $scope.rowClicks = 0;
        $scope.many = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        $scope.show = {gone: true};
        $scope.modal = {open: false};
        $scope.f = {pick: null};
        $scope.options = [{id: 1, name: 'One'}, {id: 2, name: 'Two'}, {id: 3, name: 'Three'}];
    }]);
