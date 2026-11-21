// Digest-own suite (page: digest-own.html, fixture: digest-own.fixture.js): page code asks for a digest of the page
// ($evalAsync outside a digest: its work waits in Angular's queue), and before that digest comes a component digests
// itself (kit.digestOwn: the count of an aui-input, the list of an aui-select or an aui-tree-select, the toasts'
// host). The page shows the work at once: its digest runs instead of the component's own, which would have run the
// work and left the page's bindings undone (the page's digest then finds the queue empty and never comes). With
// nothing waiting, a component's own digest stays its own (no digest of the page).
(function () {
    const {sleep} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const svc = name => angular.element(document.body).injector().get(name);
    const note = () => document.getElementById('page-note').textContent.trim();
    const digestsSince = t => window.__digests.filter(x => x >= t).length;
    // page code that asks for a digest of the page, outside a digest
    const pageAsks = value => { scope().$evalAsync(s => { s.page.note = value; }); };
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', {key: k, code: k, bubbles: true, cancelable: true}));
    const trig = id => document.querySelector('#' + id + ' .aui-select__trigger');
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('D1 kit.digestOwn: with a digest of the page waiting, that digest runs (the page shows the work at once); with none, only the own scope is digested',
        {waiting: 'D1', ownOnly: {pageDigests: 0, ownDigested: true}},
        async () => {
            const own = scope().$new();
            let ownRuns = 0;
            own.$watch(() => { ownRuns += 1; });
            await sleep(50);
            pageAsks('D1');
            svc('auiControlKit').digestOwn(own);
            const waiting = note();
            await sleep(50);
            const t = performance.now();
            const before = ownRuns;
            svc('auiControlKit').digestOwn(own);
            const r = {waiting, ownOnly: {pageDigests: digestsSince(t), ownDigested: ownRuns > before}};
            own.$destroy();
            return r;
        });

    T('D2 aui-input: a space typed at the end of a counted field (only the count changes: its own digest), a digest of the page waiting: the page shows its work at once, the count the space',
        {note: 'D2', count: '4/20'},
        async () => {
            const box = document.querySelector('#f-input input');
            await sleep(50);
            pageAsks('D2');
            box.value = 'abc ';
            box.dispatchEvent(new Event('input', {bubbles: true}));
            const r = {note: note(), count: document.querySelector('#f-input .aui-input__count').textContent.trim()};
            await sleep(100);
            return r;
        });

    T('D3 aui-select: a key moving in its open list (its own digest), a digest of the page waiting: the page shows its work at once',
        {note: 'D3'},
        async () => {
            trig('f-select').click();
            await sleep(300);
            pageAsks('D3');
            key(trig('f-select'), 'ArrowDown');
            const r = {note: note()};
            key(trig('f-select'), 'Escape');
            await sleep(300);
            return r;
        });

    T('D4 aui-tree-select: a key moving in its open list (its own digest), a digest of the page waiting: the page shows its work at once',
        {note: 'D4'},
        async () => {
            trig('f-tree').click();
            await sleep(400);
            pageAsks('D4');
            key(trig('f-tree'), 'ArrowDown');
            const r = {note: note()};
            key(trig('f-tree'), 'Escape');
            await sleep(300);
            return r;
        });

    T('D5 the toasts\' host: a toast added outside a digest (the host\'s own digest), a digest of the page waiting: the page shows its work at once, the toast too',
        {note: 'D5', toast: true},
        async () => {
            await sleep(50);
            pageAsks('D5');
            svc('AuiMessage').info('A toast', {duration: 0});
            const r = {note: note(), toast: !!document.querySelector('.aui-message')};
            svc('AuiMessage').clearAll();
            await sleep(400);
            return r;
        });

    T('D6 with nothing waiting, a key in an open list stays the component\'s own digest (no digest of the page)',
        {pageDigests: 0},
        async () => {
            trig('f-select').click();
            await sleep(400);
            const t = performance.now();
            key(trig('f-select'), 'ArrowDown');
            key(trig('f-select'), 'ArrowDown');
            await sleep(30);
            const r = {pageDigests: digestsSince(t)};
            key(trig('f-select'), 'Escape');
            await sleep(300);
            return r;
        });

    T('D7 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('aui-* family: a component\'s own digest and the page\'s', tests);
})();
