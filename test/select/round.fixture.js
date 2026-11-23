// Fixture of the select round suite (page: round.html): fields for lookups and their races, a stale search, plain
// values, known records, locks, automatic picks, the page's form (native checks, disabled, fieldset, reset) and
// deferred models. Every server request waits until the check answers it (answer()).
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
    .controller('RoundCtrl', ['$scope', '$q', function ($scope, $q) {
        $scope.m = {gn: 4, gs: 4, sw: 9, race: null, st: null, plain: null, vo: 51, lock: [1, 2], auto1: null, auto2: null,
            fr: null, fd: 'C', fro: null, fs: 'C', frs: 'C', blur: 'C', deb: 'C', nul: null, rl: 7};
        $scope.state = {swStore: 'N', autoOn: true, req2: false, showAuto1: false, showAuto2: false, fsOff: false,
            voItems: null, nullOpts: [{id: 1, label: 'One'}, {id: 2, label: 'Two'}],
            lockOpts: [{id: 1, label: 'One'}, {id: 2, label: 'Two'}, {id: 3, label: 'Three'}]};
        $scope.letters = [{id: 'A', label: 'Alpha'}, {id: 'B', label: 'Beta'}, {id: 'C', label: 'Gamma'}, {id: 'D', label: 'Delta'}];
        $scope.api = {};
        // live configuration: tags switched to responsive, searchable and label-field bound
        $scope.tagOpts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => ({id: i, label: 'Directory ' + i}));
        angular.extend($scope.m, {mtc: [1, 2, 3, 4, 5, 6, 7, 8], srch: null, lf: 1});
        angular.extend($scope.state, {mtc: 2, srch: false, lf: 'label'});
        $scope.manyOpts = Array.from({length: 120}, (x, i) => ({id: i + 1, label: 'Row ' + (i + 1)}));
        $scope.m.virt = 2;
        $scope.lfOpts = [{id: 1, label: 'One', alt: 'Uno'}, {id: 2, label: 'Two', alt: 'Dos'}];
        // lookup-options and load-options: each request waits for the check
        $scope.requests = [];
        $scope.ask = function (req) {
            const answer = $q.defer();
            $scope.requests.push({req: req, answer: answer});
            return answer.promise;
        };
        $scope.changes = [];
        $scope.changed = function (value, oldValue) { $scope.changes.push({value: value, oldValue: oldValue}); };
    }]);
