// Fixture of the texts suite: the page defines a language of its own and uses it (auiTextsProvider.define / use),
// changes one text, sends a patch that must be ignored (a number for a text, an unknown key, a list too short), and sets
// one field message through auiFieldMessagesProvider (the same table). The language's texts are marked, so that the
// checks see which table a text came from.
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
    .config(['auiTextsProvider', 'auiFieldMessagesProvider', function (texts, fieldMessages) {
        texts.define('marked', {
            list: {placeholder: 'Pick one', search: 'Find...'},
            input: {clear: 'Wipe'},
            modal: {close: 'Shut', confirm: 'Accept', ok: 'Fine', titles: {warning: 'Careful'}},
            date: {
                weekdays: ['S0', 'M1', 'T2', 'W3', 'T4', 'F5', 'S6'],
                header: 'Year {year}, {month}', placeholder: 'Pick a date', am: 'morn', pm: 'eve', toEnd: 'On to the end time'
            }
        });
        texts.use('marked');
        texts.use('unknown');
        texts.set({list: {empty: 'Nothing here'}});
        texts.set({list: {search: 42, nope: 'x'}, date: {weekdays: ['a']}, modal: 'flat'});
        fieldMessages.set({required: 'Fill it in'});
    }])
    .controller('TextsCtrl', ['$scope', function ($scope) {
        $scope.options = [{id: 1, label: 'Option A'}, {id: 2, label: 'Option B'}];
        $scope.nodes = [{id: 'g', label: 'Electronics', children: [{id: 'n1', label: 'Phones'}]}];
        $scope.m = {i: 'some text', d12: '2026-11-07 15:00:00', dtr: null};
        $scope.open = {modal: false};
    }]);
