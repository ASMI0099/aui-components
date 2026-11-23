// Mount a 90k tree, run only the listed steps, destroy, drop the data. scripts/perf.js leak then measures
// what is left on the heap.
// URL: leak.html?kind=single|multi&steps=open,close,expand,search,check
(function () {
    const params = new URLSearchParams(location.search);
    const kind = params.get('kind') || 'single';
    const steps = (params.get('steps') || '').split(',').filter(Boolean);
    const frames = n => new Promise(res => { let k = 0; (function f() { if (++k > n) res(); else requestAnimationFrame(f); })(); });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const apply = fn => window.benchScope.$apply(fn);

    async function run() {
        if (params.get('mount') === '0') { await sleep(1500); window.__bench = {done: true}; return; }
        await frames(2);
        apply(() => {
            window.benchScope.data = kind === 'select' ? window.makeTree(5, 10, 100, true) : window.makeTree(30, 30, 100, false);
            window.benchScope.m.v = (kind === 'multi' || kind === 'select') ? [] : null;
            window.benchScope.cfg = {kind: kind};
        });
        await frames(2);
        for (const s of steps) {
            if (s === 'open') { if (kind === 'select') document.querySelector('aui-select .aui-select__trigger').click(); else apply(() => window.benchScope.api.open()); }
            if (s === 'close') apply(() => window.benchScope.api.close());
            if (s === 'expand') apply(() => window.benchScope.api.expandAll());
            if (s === 'search') {
                const input = document.querySelector('.aui-select__search-input');
                input.value = 'Item 1-2-3'; input.dispatchEvent(new Event('input'));
                await sleep(400);
                input.value = ''; input.dispatchEvent(new Event('input'));
            }
            if (s === 'check') document.querySelector('li.aui-tree-select__node').click();
            await sleep(400);
            await frames(2);
        }
        apply(() => { window.benchScope.cfg = null; });
        await frames(2);
        apply(() => { window.benchScope.data = []; window.benchScope.m.v = null; });
        await sleep(500);
        // the steps' Angular errors (an api method missing, a failing handler) make the run fail (scripts/perf.js)
        window.__bench = {done: true, kind: kind, steps: steps, errors: (window.__ngErrors || []).slice()};
    }
    window.addEventListener('load', () => { run().catch(e => { window.__bench = {error: String(e && e.stack || e)}; }); });
})();
