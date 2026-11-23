// Modal round suite (page: round.html, fixture: round.fixture.js): native aui-modals and AuiModal - a save promise made
// in another window keeps the dialog open while it runs and on its "no"; errors of the page's functions reach the
// application's $exceptionHandler; header and footer slots take the height they need; aria-describedby describes the
// dialog itself; a tall box on top stays in the window (a removed host: test/message/apps).
(function () {
    const {sleep, until} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const svc = name => angular.element(document.body).injector().get(name);
    const dialog = id => document.querySelector('#' + id + ' dialog');
    const isShown = id => !!dialog(id) && dialog(id).open && dialog(id).classList.contains('is-open');
    const ctrlOf = id => angular.element(document.getElementById(id)).isolateScope().$ctrl;
    const hostDialog = () => document.querySelector('aui-modal-host dialog[open]');
    async function openAndWait(name) {
        apply(s => { s.open[name] = true; });
        await until(() => isShown('m-' + name), 2000);
        await sleep(300);
    }
    async function closeAndWait(name) {
        apply(s => { s.open[name] = false; });
        await until(() => !dialog('m-' + name) || !dialog('m-' + name).open, 2000);
        await sleep(50);
    }
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('MR1 a save promise made in another window (an editor in a frame): the dialog waits busy, and stays open on its "no"',
        {waiting: {open: true, busy: true}, after: {open: true, busy: false}},
        async () => {
            await openAndWait('frame');
            const buttons = dialog('m-frame').querySelectorAll('.aui-modal__footer aui-button button');
            buttons[buttons.length - 1].click();
            await sleep(60);
            const waiting = {open: isShown('m-frame'), busy: !!ctrlOf('m-frame').confirmInFlight};
            await sleep(400);
            const after = {open: isShown('m-frame'), busy: !!ctrlOf('m-frame').confirmInFlight};
            await closeAndWait('frame');
            return {waiting, after};
        });

    T('MR2 an on-cancel and a render() of the page that fail reach the application\'s $exceptionHandler',
        {cancel: true, render: true, settled: 'cancel'},
        async () => {
            const modal = svc('AuiModal');
            let before = window.__purposeErrors.length;
            let settled = null;
            modal.open({title: 'Cancel me', onCancel: () => { throw new Error('on-cancel failed on purpose'); }})
                .then(r => { settled = r.reason; });
            await until(() => !!hostDialog(), 2000);
            await sleep(300);
            hostDialog().querySelector('.aui-imperative-modal__footer aui-button button').click();
            await until(() => settled !== null, 2000);
            const cancel = window.__purposeErrors.length > before;
            before = window.__purposeErrors.length;
            const handle = modal.open({title: 'Broken', render: () => { throw new Error('render failed on purpose'); }});
            await until(() => !!hostDialog(), 2000);
            await sleep(300);
            const render = window.__purposeErrors.length > before;
            apply(() => { handle.close(); });
            await until(() => !hostDialog(), 2000);
            await sleep(100);
            return {cancel, render, settled};
        });

    T('MR3 a header and a footer slot of several lines take the height they need: nothing of them is cut, the footer\'s button is in the box',
        {header: true, footer: true, button: true},
        async () => {
            await openAndWait('slots');
            const h = dialog('m-slots').querySelector('.aui-modal__header');
            const f = dialog('m-slots').querySelector('.aui-modal__footer');
            const box = dialog('m-slots').getBoundingClientRect();
            const b = document.getElementById('slot-approve').getBoundingClientRect();
            const r = {header: h.scrollHeight <= h.clientHeight + 1, footer: f.scrollHeight <= f.clientHeight + 1,
                button: b.bottom <= box.bottom + 1 && b.top >= box.top - 1};
            await closeAndWait('slots');
            return r;
        });

    T('MR4 aria-describedby on aui-modal describes the dialog itself',
        {describedby: 'terms'},
        async () => {
            await openAndWait('desc');
            const describedby = dialog('m-desc').getAttribute('aria-describedby');
            await closeAndWait('desc');
            return {describedby};
        });

    T('MR5 display-on-top with a tall height (98vh): the dialog stays inside the window',
        {inside: true},
        async () => {
            await openAndWait('top');
            const r = dialog('m-top').getBoundingClientRect();
            const inside = r.top >= -1 && r.bottom <= window.innerHeight + 1;
            await closeAndWait('top');
            return {inside};
        });

    T('MR99 no Angular errors other than the ones thrown on purpose',
        {errors: []},
        async () => ({errors: window.__ngErrors.slice()}));

    AuiTest.run('aui-* family: aui-modal and AuiModal, round checks', tests, {delay: 0});
})();
