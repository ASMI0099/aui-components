// Fixture of the applications suite (page: apps.html): two AngularJS applications side by side on one page, started by
// the page (apps.spec.js), and a third one that asks for a message box as it starts. Angular errors are collected.
window.__ngErrors = [];
angular.module('auiTest', ['aui'])
    .config(['$provide', function ($provide) {
        $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
            return function (exception, cause) {
                window.__ngErrors.push(String(exception && exception.message || exception));
                $delegate(exception, cause);
            };
        }]);
    }]);
// an application whose run block asks for a box at its start (an announcement)
angular.module('auiStartup', ['auiTest'])
    .run(['AuiMessageBox', function (AuiMessageBox) {
        AuiMessageBox.alert('Started');
    }]);
