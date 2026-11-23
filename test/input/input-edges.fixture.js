// Fixture of the aui-input edges suite: names, rule changes, leaving the field, search, sizes.
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
    .controller('EdgesCtrl', ['$scope', function ($scope) {
        $scope.m = {ns: 12345, npp: 1.2345, pdyn: 1.23, rdyn: 25, bd: 'old', fc: 'Text', pw: 'secret', ta: '',
            long: 'One short first line, then some words to wrap repeatedly as the panel around it gets narrower. ' +
                'This second sentence makes sure the text needs several lines at a narrow width.',
            fsText: 'Locked', fsPw: 'secret', dark: 'Typed text', rb: 'old', bc: 'Text', narrow: 123.45, fo: 'Start'};
        $scope.state = {places: 2, max: 40, afShown: false, w: 220, auto: true, style: 'form', dlLimit: 8, fsLook: false,
            fsSearch: false, tsz: 'small', lateDesc: undefined};
        angular.extend($scope.m, {dl: 'AA', dp: 'GOOD', fl: '', fsq: '', bl: '', n2w: 123.45, nz: 2, afv: '', lad: '', rs: 'kept',
            un: 'free', tsz: new Array(5).join('one two three four five six seven eight nine ten '),
            n95: 123.45, b55: 123.45, tfont: new Array(5).join('one two three four five six seven eight nine ten ')});
        $scope.fsApi = {};
        $scope.foApi = {};
        $scope.ceApi = {};
        $scope.calls = [];
        $scope.changes = [];
        $scope.changed = function (value, oldValue, source, byUser) {
            $scope.changes.push({value: value, oldValue: oldValue, source: source, byUser: byUser});
        };
        $scope.finishes = [];
        $scope.searches = [];
        $scope.searched = function (field, value) { $scope.searches.push(field + ':' + value); };
    }]);
