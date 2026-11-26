// Modal round suite (page: round.html, fixture: round.fixture.js): native aui-modals and AuiModal - a save promise made
// in another window keeps the dialog open while it runs and on its "no"; errors of the page's functions reach the
// application's $exceptionHandler; header and footer slots take the height they need; aria-describedby describes the
// dialog itself; a tall box on top stays in the window; on-open / onOpen once per opening (a removed host:
// test/message/apps).
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

    T('MR6 on-open: once per opening, as it opens (in the opening digest, is-open true, before its first frame); one on-close after it; opened again while it fades out: neither; closed in the turn it opened: both',
        {first: ['open:true'], firstFrame: false, closed: ['open:true', 'rendered', 'close:false'], turnedBack: [], sameTurn: ['open:true', 'close:false']},
        async () => {
            const s = scope();
            s.events.length = 0;
            apply(x => { x.open.events = true; });
            // read in the same task: the dialog has not had a frame yet
            const first = s.events.slice();
            // on-rendered comes after the first frame: not yet
            const firstFrame = s.events.indexOf('rendered') >= 0;
            await until(() => isShown('m-events'), 2000);
            await sleep(300);
            await closeAndWait('events');
            await sleep(300);
            const closed = s.events.slice();
            // opened again while it still fades out
            s.events.length = 0;
            await openAndWait('events');
            s.events.length = 0;
            apply(x => { x.open.events = false; });
            await sleep(40);
            apply(x => { x.open.events = true; });
            await sleep(400);
            const turnedBack = s.events.slice();
            await closeAndWait('events');
            await sleep(300);
            // opened and closed in one turn
            s.events.length = 0;
            apply(x => { x.open.events = true; });
            apply(x => { x.open.events = false; });
            await sleep(300);
            const sameTurn = s.events.filter(e => e !== 'rendered');
            return {first, firstFrame, closed, turnedBack, sameTurn};
        });

    T('MR7 on-open with defer-render: before the body is built (on-rendered after it); an on-open that fails reaches $exceptionHandler and the dialog opens',
        {bodies: ['open:false', 'rendered:true'], failed: true, opened: true},
        async () => {
            const s = scope();
            s.bodies.length = 0;
            await openAndWait('deferred');
            const bodies = s.bodies.slice();
            await closeAndWait('deferred');
            const before = window.__purposeErrors.length;
            await openAndWait('throws');
            const failed = window.__purposeErrors.length > before;
            const opened = isShown('m-throws');
            await closeAndWait('throws');
            return {bodies, failed, opened};
        });

    T('MR8 AuiModal onOpen: once as the dialog opens; one opened meanwhile waits and gets it when its turn comes; one closed while it waits gets onClose alone',
        {afterFirst: ['A open'], afterQueue: ['A open', 'A close', 'B open'], dropped: ['C close'], all: ['A open', 'A close', 'B open', 'C close', 'B close']},
        async () => {
            const modal = svc('AuiModal');
            const seen = [];
            const one = name => ({title: name, onOpen: () => seen.push(name + ' open'), onClose: () => seen.push(name + ' close')});
            const a = modal.open(one('A'));
            await until(() => !!hostDialog(), 2000);
            await sleep(300);
            const b = modal.open(one('B'));
            const c = modal.open(one('C'));
            await sleep(100);
            const afterFirst = seen.slice();
            apply(() => { a.close(); });
            await until(() => seen.indexOf('B open') >= 0, 3000);
            await sleep(300);
            const afterQueue = seen.slice();
            apply(() => { c.close(); });
            await sleep(50);
            const dropped = seen.filter(e => /^C/.test(e));
            apply(() => { b.close(); });
            await until(() => !hostDialog(), 3000);
            await sleep(100);
            return {afterFirst, afterQueue, dropped, all: seen.slice()};
        });

    T('MR99 no Angular errors other than the ones thrown on purpose',
        {errors: []},
        async () => ({errors: window.__ngErrors.slice()}));

    AuiTest.run('aui-* family: aui-modal and AuiModal, round checks', tests, {delay: 0});
})();
