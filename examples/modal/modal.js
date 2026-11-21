/**
 * aui-modal and the message services: a dialog in the template whose save waits for a promise, dialogs and boxes
 * opened from code, and notices.
 */
(function () {
    'use strict';

    angular.module('auiExamples').controller('ModalExampleCtrl', ['$q', '$timeout', 'AuiModal', 'AuiMessageBox', 'AuiMessage',
        function ($q, $timeout, AuiModal, AuiMessageBox, AuiMessage) {
            const vm = this;

            // ---------------------------------------------------------------- a dialog in the template
            vm.statuses = [{id: 'open', name: 'Open'}, {id: 'progress', name: 'In progress'}, {id: 'done', name: 'Done'}];
            vm.item = {name: 'Quarterly report', status: 'open', due: ''};
            vm.edit = function () {
                vm.draft = angular.copy(vm.item);
                vm.editing = true;
            };
            /** Confirm: false keeps the dialog open; the promise keeps it open (Saving...) until the save is done. */
            vm.save = function () {
                if (vm.editForm && vm.editForm.$invalid) {
                    vm.editForm.$setSubmitted();
                    angular.forEach(vm.editForm, function (field, name) {
                        if (name.charAt(0) !== '$' && field && field.$setTouched) field.$setTouched();
                    });
                    return false;
                }
                const fail = vm.failNext;
                vm.failNext = false;
                return $timeout(function () {
                    if (fail) {
                        AuiMessage.error('The item could not be saved. Try again.');
                        return $q.reject(new Error('not saved'));
                    }
                    vm.item = angular.copy(vm.draft);
                    AuiMessage.success('Saved');
                }, 900);
            };

            // ---------------------------------------------------------------- dialogs from code
            vm.results = [];
            function record(what, result) {
                vm.results.unshift(what + ': ' + JSON.stringify(result));
                vm.results.length = Math.min(vm.results.length, 6);
            }
            vm.openFromCode = function () {
                AuiModal.open({
                    title: 'Export the list',
                    content: 'The list is exported with its current filters. This takes a few seconds.',
                    showConfirm: true,
                    confirmText: 'Export',
                    onConfirm: function () { return $timeout(angular.noop, 800); }
                }).then(function (result) { record('AuiModal.open', result); });
            };
            vm.confirmDelete = function () {
                AuiMessageBox.confirm('Delete the draft? This cannot be undone.', {title: 'Delete the draft', confirmText: 'Delete', dangerConfirm: true})
                    .then(function (confirmed) {
                        record('AuiMessageBox.confirm', confirmed);
                        if (confirmed) AuiMessage.success('The draft was deleted');
                    });
            };
            vm.alert = function () {
                AuiMessageBox.alert('The export has started. You will find the file in your downloads.')
                    .then(function (result) { record('AuiMessageBox.alert', result); });
            };
            vm.queue = function () {
                [1, 2, 3].forEach(function (n) {
                    AuiMessageBox.info('Message ' + n + ' of 3').then(function (result) { record('message ' + n, result); });
                });
            };

            // ---------------------------------------------------------------- notices
            const TEXTS = {success: 'The changes were saved', info: 'A new version of the list is available',
                warning: 'Two rows have no due date', error: 'The file could not be uploaded'};
            vm.notify = function (type) {
                AuiMessage[type](TEXTS[type]);
            };
            vm.upload = function () {
                const notice = AuiMessage.loading('Uploading the file...');
                $timeout(function () {
                    notice.update({type: 'success', message: 'The file was uploaded', duration: 2500});
                }, 1800);
            };
            vm.clearAll = function () {
                AuiMessage.clearAll();
            };
        }]);
})();
