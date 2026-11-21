// Fixture of the tree label suite: a tree that depends on the hall (load-params). Hall A has the phones, hall B
// other categories, so a value picked in A is not in B's tree. Answers come 80 ms later.
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
    .controller('LabelsCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
        $scope.p = {hall: 'A'};
        $scope.m = {single: '', multi: [], model: ''};
        $scope.items = {multi: []};
        function tree(hall) {
            if (hall === 'A' || hall === 'A2') {   // A2: the same tree as A, with a renamed node
                return [{id: 'g1', name: 'Electronics', children: [
                    {id: 'a11', name: hall === 'A2' ? 'Smartphones 2026' : 'Smartphones'},
                    {id: 'a12', name: 'Feature phones'},
                    {id: 'a13', name: 'Chargers'}
                ]}];
            }
            return [{id: 'g2', name: 'Books', children: [{id: 'b21', name: 'Fiction'}, {id: 'b22', name: 'Science'}]}];
        }
        $scope.loadTree = function (req) {
            return $timeout(function () { return tree(req.params.hall); }, 80);
        };
    }]);
