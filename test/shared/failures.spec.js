// Request-failure suite (page: failures.html, fixture: failures.fixture.js), aui-select and aui-tree-select: a failed
// request is never repeated by itself. Only a person asks again (opening the field, Retry); a load function that
// throws at once cannot freeze the page.
(function () {
    const {sleep, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select, #' + id + ' aui-tree-select');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const count = tag => scope().count(tag);
    const reasons = tag => scope().reasons(tag);
    const panelText = id => (host(id).querySelector('.aui-select__panel') || {textContent: ''}).textContent.replace(/\s+/g, ' ').trim();
    const retryEl = id => host(id).querySelector('.aui-select__status--retry, .aui-select__retry-link, .aui-tree-select__retry');
    async function open(id) { trig(id).click(); await sleep(150); }
    async function close() { outside(); await sleep(350); }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('F1 aui-select, load all, a saved value needs its label, server down: one request, never repeated by itself',
        {first: 1, later: 1, reasons: ['values']},
        async () => {
            await sleep(300);
            const first = count('sel');
            await sleep(500);
            return {first, later: count('sel'), reasons: reasons('sel')};
        });

    T('F2 opening asks once more and shows Retry; Retry asks once more; nothing else follows',
        {afterOpen: 2, retryShown: true, afterRetry: 3, later: 3, reasons: ['values', 'open', 'retry']},
        async () => {
            await open('s-sel');
            await sleep(100);
            const afterOpen = count('sel');
            const retry = retryEl('s-sel');
            const retryShown = !!retry && /retry/i.test(panelText('s-sel'));
            if (retry) retry.click();
            await sleep(150);
            const afterRetry = count('sel');
            await sleep(400);
            const r = {afterOpen, retryShown, afterRetry, later: count('sel'), reasons: reasons('sel')};
            await close();
            return r;
        });

    T('F3 aui-select, a load function that throws at once: one call, the page keeps working; opening calls once more',
        {atStart: 1, later: 1, afterOpen: 2},
        async () => {
            const atStart = count('throw');
            await sleep(300);
            const later = count('throw');
            await open('s-throw');
            await sleep(100);
            const r = {atStart, later, afterOpen: count('throw')};
            await close();
            return r;
        });

    T('F4 a failed background refresh waits a whole cache-ttl: no refresh loop while the server is down',
        {loaded: true, afterFailedRefresh: 3, withinTtl: 3, afterTtl: 4, reasons: ['values', 'open', 'refresh', 'refresh']},
        async () => {
            apply(s => { s.server.down = false; });
            await open('s-refresh');            // the failed start ('values') is asked again: open
            await sleep(100);
            const loaded = /Room 1/.test(panelText('s-refresh'));
            await close();
            await sleep(1600);                  // older than the ttl (1500 ms)
            apply(s => { s.server.down = true; });
            await open('s-refresh');            // a background refresh, which fails
            await sleep(100);
            const afterFailedRefresh = count('refresh');
            await close();
            await open('s-refresh');            // within the ttl after the failure: no refresh
            await sleep(50);
            const withinTtl = count('refresh');
            await close();
            await sleep(1600);
            await open('s-refresh');            // a whole ttl later: one more refresh
            await sleep(100);
            const r = {loaded, afterFailedRefresh, withinTtl, afterTtl: count('refresh'), reasons: reasons('refresh')};
            await close();
            return r;
        });

    T('F5 aui-select, paged with lookup-enabled: a failed lookup is not repeated by itself; opening asks again (page 1 + lookup)',
        {first: 1, later: 1, afterOpen: 3, settled: 3},
        async () => {
            const first = count('look');
            await sleep(300);
            const later = count('look');
            await open('s-look');
            await sleep(200);
            const afterOpen = count('look');
            await sleep(400);
            const r = {first, later, afterOpen, settled: count('look')};
            await close();
            return r;
        });

    T('F6 aui-tree-select, load-options, a saved value needs its label, server down: one request; opening asks once more',
        {first: 1, later: 1, afterOpen: 2, settled: 2},
        async () => {
            const first = count('tree');
            await sleep(300);
            const later = count('tree');
            await open('t-tree');
            await sleep(150);
            const afterOpen = count('tree');
            await sleep(400);
            const r = {first, later, afterOpen, settled: count('tree')};
            await close();
            return r;
        });

    T('F7 aui-tree-select, a load function that throws at once: one call; opening calls once more',
        {first: 1, later: 1, afterOpen: 2},
        async () => {
            const first = count('treeThrow');
            await sleep(300);
            const later = count('treeThrow');
            await open('t-throw');
            await sleep(100);
            const r = {first, later, afterOpen: count('treeThrow')};
            await close();
            return r;
        });

    T('F8 aui-tree-select, lazy roots, server down: nothing before the first open; one request per open',
        {before: 0, afterOpen: 1, later: 1, afterReopen: 2},
        async () => {
            const before = count('lazy');
            await open('t-lazy');
            await sleep(100);
            const afterOpen = count('lazy');
            await sleep(400);
            const later = count('lazy');
            await close();
            await open('t-lazy');
            await sleep(100);
            const r = {before, afterOpen, later, afterReopen: count('lazy')};
            await close();
            return r;
        });

    T('F9 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-* family: request failures', tests, {delay: 0});
})();
