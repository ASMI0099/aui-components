// Fixture of the tree-select round suite (page: round.html): lookups and their races, a stale search, known records,
// locks, automatic picks, the page's form (native checks, disabled, fieldset, reset), deferred models and live
// configuration. Every server request waits until the check answers it (answer()).
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
    .controller('TreeRoundCtrl', ['$scope', '$q', function ($scope, $q) {
        const letters = () => [{id: 'A', name: 'Alpha'}, {id: 'B', name: 'Beta'}, {id: 'C', name: 'Gamma'}, {id: 'D', name: 'Delta'}];
        $scope.letters = letters();
        $scope.m = {gn: 7, gs: 7, sw: 9, race: null, st: null, vo: 51, lock: ['A', 'B'], auto1: null, auto2: null, lo: null,
            unl: ['A', 'B'], exp: null, fr: null, fd: 'C', fro: null, fs: 'C', frs: 'C', blur: 'C', deb: 'C', cid: null,
            mtc: [1, 2, 3, 4, 5, 6, 7, 8], open: null, eq: 1};
        $scope.state = {swStore: 'N', autoOn: true, req2: false, showAuto1: false, showAuto2: false, lockOff: false, fsOff: false,
            unlOpts: letters(), voItems: null, cid: 'cat-old', mtc: 2, ngOff: false, eqOpts: [{id: 1, name: 'One'}], eqItems: null};
        $scope.tagOpts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => ({id: i, name: 'Directory ' + i}));
        $scope.manyNodes = Array.from({length: 180}, (x, i) => ({id: i + 1, name: 'Node ' + (i + 1)}));
        $scope.m.tvirt = 2;
        // 14 levels, one node each
        $scope.deepOpts = (function () {
            let node = null;
            for (let level = 14; level >= 1; level -= 1) {
                node = {id: 'd' + level, name: 'Level ' + level + ' category', children: node ? [node] : undefined};
            }
            return [node];
        })();
        // load-children whose branches wait for the check (the top level at once)
        $scope.childAsks = [];
        $scope.kidsAsk = function (node) {
            if (!node) return [{id: 'R', name: 'Root'}, {id: 9, name: 'Alternative', isLeaf: true}];
            const answer = $q.defer();
            $scope.childAsks.push({node: node, answer: answer});
            return answer.promise;
        };
        $scope.m.rev = 7;
        $scope.m.tl = 7;
        $scope.bigOpts = Array.from({length: 2000}, (x, i) => ({id: i + 1, name: 'Item ' + (i + 1)}));
        $scope.m.big = [];
        // children in pages: the branch Root has 65 nodes on its first page, its value 7 on the second
        $scope.m.pg = 7;
        $scope.pages = [];
        $scope.kidsPaged = function (req) {
            if (!req.node) return [{id: 'R', name: 'Root'}];
            $scope.pages.push(req.page);
            if (req.page === 1) {
                return {items: Array.from({length: 65}, (x, i) => ({id: 'F' + (i + 1), name: 'Filler ' + (i + 1), isLeaf: true})), hasMore: true};
            }
            return {items: [{id: 7, name: 'Target', isLeaf: true}], hasMore: false};
        };
        $scope.state.tlOpts = [{id: 7, name: 'Old shelf'}, {id: 8, name: 'Other shelf'}];
        $scope.expOpts = [{id: 1, name: 'Parent', children: [{id: 11, name: 'Child'}]}];
        $scope.apis = {lock: {}, exp: {}};
        $scope.expanded = [];
        // lookup-options: each request waits for the check
        $scope.requests = [];
        $scope.ask = function (req) {
            const answer = $q.defer();
            $scope.requests.push({req: req, answer: answer});
            return answer.promise;
        };
        // remote-search: each search waits for the check too
        $scope.searches = [];
        $scope.search = function (query, tag) {
            const answer = $q.defer();
            $scope.searches.push({query: query, tag: tag, answer: answer});
            return answer.promise;
        };
        // load-children: the top level at once
        $scope.kids = function (node) {
            return node ? [] : [{id: 7, name: 'North shelf', isLeaf: true}, {id: 8, name: 'South shelf', isLeaf: true}];
        };
        $scope.changes = [];
        $scope.changed = function (value, oldValue) { $scope.changes.push({value: value, oldValue: oldValue}); };
    }]);
