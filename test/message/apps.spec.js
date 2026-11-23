// Applications suite (page: apps.html, fixture: apps.fixture.js): the message services when a page has several
// AngularJS applications - each application draws its own toasts, boxes and dialogs (each through hosts of its own);
// a box asked for as an application starts shows without waiting for another digest; an application that ends takes
// its hosts with it, and the dialog it showed settles.
(function () {
    const {sleep, until} = AuiTest;
    const apps = {};
    document.addEventListener('DOMContentLoaded', function () {
        apps.one = angular.bootstrap(document.getElementById('app-one'), ['auiTest']);
        apps.two = angular.bootstrap(document.getElementById('app-two'), ['auiTest']);
    });
    const ownHosts = (tag, injector) => Array.prototype.filter.call(document.querySelectorAll(tag),
        el => el.__auiHostRoot === injector.get('$rootScope'));
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('AP1 two applications on one page: each one\'s toast, message box and dialog show (each through hosts of its own)',
        {hosts: [1, 1, 1], toast: true, box: true, dialog: true},
        async () => {
            const two = apps.two;
            await sleep(100);
            const hosts = ['aui-message-host', 'aui-message-box-host', 'aui-modal-host'].map(tag => ownHosts(tag, two).length);
            two.get('$rootScope').$apply(() => {
                two.get('AuiMessage').show({message: 'Toast of two', duration: 0});
                two.get('AuiMessageBox').alert('Box of two');
            });
            await sleep(400);
            const toast = Array.prototype.some.call(document.querySelectorAll('.aui-message__content'), el => el.textContent.trim() === 'Toast of two');
            const box = Array.prototype.some.call(document.querySelectorAll('aui-message-box-host .aui-message-box__content'),
                el => el.textContent.trim() === 'Box of two');
            const buttons = ownHosts('aui-message-box-host', two)[0].querySelectorAll('.aui-message-box__actions aui-button button');
            if (buttons.length) buttons[buttons.length - 1].click();
            await sleep(300);
            let dialog = false;
            two.get('$rootScope').$apply(() => { two.get('AuiModal').open({title: 'Dialog of two'}); });
            await until(() => !!ownHosts('aui-modal-host', two)[0].querySelector('dialog[open]'), 2000);
            dialog = ownHosts('aui-modal-host', two)[0].querySelector('.aui-imperative-modal__title').textContent.trim() === 'Dialog of two';
            two.get('$rootScope').$apply(() => { two.get('AuiModal').close(); });
            two.get('AuiMessage').clearAll();
            await sleep(400);
            return {hosts, toast, box, dialog};
        });

    T('AP2 a box asked for in an application\'s run block shows as the application starts (no other digest needed)',
        {shown: true},
        async () => {
            const start = angular.bootstrap(document.getElementById('app-start'), ['auiStartup']);
            await until(() => {
                const host = ownHosts('aui-message-box-host', start)[0];
                const content = host && host.querySelector('.aui-message-box__content');
                return !!content && content.textContent.trim() === 'Started';
            }, 1500);
            const host = ownHosts('aui-message-box-host', start)[0];
            const content = host && host.querySelector('.aui-message-box__content');
            const shown = !!content && content.textContent.trim() === 'Started';
            if (host) {
                const buttons = host.querySelectorAll('.aui-message-box__actions aui-button button');
                if (buttons.length) buttons[buttons.length - 1].click();
            }
            await sleep(300);
            return {shown};
        });

    T('AP3 an application that ends while its dialog shows: the dialog settles (close), its hosts leave the page, its toast with them',
        {settled: 'close', hosts: 0, toast: false},
        async () => {
            const one = apps.one;
            const root = one.get('$rootScope');
            let settled = null;
            root.$apply(() => {
                // on-close: told at once (the promise's then waits for a digest of a root that is gone)
                one.get('AuiModal').open({title: 'Dialog of one', onClose: r => { settled = r.reason; }});
                one.get('AuiMessage').show({message: 'Toast of one', duration: 0});
            });
            await until(() => !!ownHosts('aui-modal-host', one)[0].querySelector('dialog[open]'), 2000);
            await sleep(300);
            root.$destroy();
            await sleep(200);
            const hosts = ['aui-message-host', 'aui-message-box-host', 'aui-modal-host']
                .map(tag => ownHosts(tag, one).length).reduce((a, b) => a + b, 0);
            const toast = Array.prototype.some.call(document.querySelectorAll('.aui-message__content'), el => el.textContent.trim() === 'Toast of one');
            return {settled, hosts, toast};
        });

    T('AP99 no Angular errors on the page',
        {errors: []},
        async () => ({errors: window.__ngErrors.slice()}));

    AuiTest.run('aui-* family: the message services in several applications', tests, {delay: 0});
})();
