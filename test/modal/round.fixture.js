// Fixture of the modal round suite (page: round.html): native aui-modals and AuiModal - a save promise made in
// another window, a removed host, errors of page functions, tall header and footer slots, a description, the on-top
// place of a tall box. Angular errors are collected, the ones a check throws on purpose apart.
window.__ngErrors = [];
window.__purposeErrors = [];
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                const text = String(exception && exception.message || exception);
                if (/on purpose/.test(text)) window.__purposeErrors.push(text);
                else window.__ngErrors.push(text);
                $delegate(exception, cause);
            };
        }]);
    }])
    .controller('ModalRoundCtrl', ['$scope', function ($scope) {
        $scope.open = {frame: false, slots: false, desc: false, top: false, events: false, deferred: false, throws: false};
        // on-open / on-rendered / on-close: what was called, with is-open at that moment
        $scope.events = [];
        $scope.note = function (what, isOpen) { $scope.events.push(isOpen === undefined ? what : what + ':' + isOpen); };
        // defer-render: whether the body was there at on-open and at on-rendered
        $scope.bodies = [];
        $scope.noteBody = function (what) { $scope.bodies.push(what + ':' + !!document.getElementById('deferred-body')); };
        $scope.failOpen = function () { throw new Error('on-open failed on purpose'); };
        $scope.saves = 0;
        // on-confirm: a promise made in the frame's window (an editor in an iframe), answering false after a moment
        $scope.saveInFrame = function () {
            $scope.saves += 1;
            const win = document.getElementById('editor-frame').contentWindow;
            return new win.Promise(function (resolve) { setTimeout(function () { resolve(false); }, 150); });
        };
    }]);
