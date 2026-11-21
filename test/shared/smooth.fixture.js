// Fixture of the smooth suite: static and loaded fields of both components with on-close / on-change that write a
// page log, a page button for "the next input", page buttons that save and remove fields, a page key handler around
// two fields, a paged list searched on the server, a lazy tree, a tree of 2,130 nodes, aui-inputs with
// ng-model-options, and a count of the digests of the whole page ($rootScope.$digest; a component's own digest is
// not one). (A page watcher would count the passes of the
// digest loop instead: a digest that changes a value runs a second pass.)
window.__ngErrors = [];
window.__pageDigests = 0;
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
        // child scopes reach this own property of $rootScope through their prototype: only the root's own digest counts
        const digest = $rootScope.$digest;
        $rootScope.$digest = function () {
            if (this === $rootScope) window.__pageDigests += 1;
            return digest.apply(this, arguments);
        };
    }])
    .controller('SmoothCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
        const names = ['Zucchini', 'Yam', 'Apple', 'Apricot', 'Grape', 'Papaya', 'Banana', 'Cherry', 'Date', 'Fig'];
        $scope.options = names.map(function (label, i) { return {id: i + 1, label: label}; });
        $scope.nodes = [{id: 'g', label: 'Group', children: names.map(function (label) { return {id: 'n-' + label, label: label}; })}];
        $scope.m = {s: null, t: null, r: null, rt: null, ub: undefined, db: undefined, rms: null, rmt: null, ks: null, kt: null,
            ps: null, lz: null, bt: null, ms: [], mt: []};
        $scope.flat = names.map(function (label) { return {id: 'f-' + label, label: label}; });
        $scope.bigTree = Array.from({length: 30}, function (x, i) {
            return {id: 'b' + i, label: 'Group ' + (i + 1), children: Array.from({length: 70}, function (y, j) {
                return {id: 'b' + i + '-' + j, label: 'Leaf ' + (i * 70 + j + 1)};
            })};
        });
        $scope.show = {rm: true, ex: true};
        $scope.log = [];
        $scope.onClose = function (name) { $scope.log.push('close ' + name); };
        $scope.onChange = function () { $scope.log.push('change s'); };
        $scope.loads = 0;
        $scope.treeLoads = 0;
        $scope.load = function () {
            $scope.loads += 1;
            return $timeout(function () { return $scope.options; }, 20);
        };
        $scope.loadTree = function () {
            $scope.treeLoads += 1;
            return $timeout(function () { return $scope.nodes; }, 20);
        };
        $scope.next = function () {
            $scope.nextAt = window.__pageDigests;   // digests of the page before this handler
            $scope.log.push('next');
        };
        $scope.save = function () { $scope.log.push('save'); };
        $scope.cancel = function () {
            $scope.log.push('cancel');
            $scope.show.rm = false;
        };
        // the page's own key handler around two fields: what it sees of their values at an Enter
        $scope.keyLog = [];
        $scope.onKey = function (event) {
            if (event.key === 'Enter') $scope.keyLog.push({ks: $scope.m.ks, kt: $scope.m.kt});
        };
        $scope.loadPaged = function (request) {
            return $timeout(function () {
                const query = String(request.query || '');
                const items = [];
                for (let i = 1; i <= 500; i++) {
                    if (!query || String(i).indexOf(query) >= 0) items.push({id: i, label: 'Item ' + i});
                }
                return items.slice(request.offset || 0, (request.offset || 0) + request.pageSize);
            }, 20);
        };
        // the passes of the page's digests (each pass evaluates every watcher once; this one never changes anything)
        window.__pagePasses = 0;
        $scope.$watch(function () { window.__pagePasses += 1; });
        // answers after 150 ms; the passes counted when the answer is about to come (before its digest)
        $scope.loadSlow = function () {
            return $timeout(function () { window.__passesAtAnswer = window.__pagePasses; return $scope.options; }, 150);
        };
        $scope.loadSlowTree = function () {
            return $timeout(function () { window.__passesAtAnswer = window.__pagePasses; return $scope.nodes; }, 150);
        };
        $scope.kidLoads = 0;
        $scope.loadKids = function (node) {
            $scope.kidLoads += 1;
            return $timeout(function () {
                const base = node ? node.id : 'z';
                return Array.from({length: 12}, function (x, i) { return {id: base + '-' + i, label: (node ? node.label : 'Folder') + '.' + (i + 1), isLeaf: !!node}; });
            }, 20);
        };
    }]);
