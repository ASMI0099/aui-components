// Fixture of the perf pages (bench.html, leak.html): the test module and large generated trees.
// Loaded before the library script, which registers the components on that module.
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
    .controller('BenchCtrl', ['$scope', function ($scope) {
        $scope.cfg = null;
        $scope.data = [];
        $scope.m = {v: null};
        $scope.api = {};
        window.benchScope = $scope;
    }]);

/** R groups x C sections x L items (+ the group and section nodes). Nested (children) or flat (pid). */
window.makeTree = function (R, C, L, flat) {
    const out = [];
    for (let r = 0; r < R; r++) {
        const group = {id: 'r' + r, name: 'Group ' + r};
        if (flat) out.push(group); else { group.children = []; out.push(group); }
        for (let c = 0; c < C; c++) {
            const section = {id: 'r' + r + '-' + c, name: 'Section ' + r + '-' + c};
            if (flat) { section.pid = group.id; out.push(section); } else { section.children = []; group.children.push(section); }
            for (let l = 0; l < L; l++) {
                const item = {id: 'r' + r + '-' + c + '-' + l, name: 'Item ' + r + '-' + c + '-' + l};
                if (flat) { item.pid = section.id; out.push(item); } else section.children.push(item);
            }
        }
    }
    return out;
};

window.leafIds = function (R, C, L) {
    const ids = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (let l = 0; l < L; l++) ids.push('r' + r + '-' + c + '-' + l);
    return ids;
};
