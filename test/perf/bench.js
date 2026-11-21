// Drives one aui-tree-select through typical actions on a big generated tree and times each step.
// URL: bench.html?kind=single|single-flat|multi|multi-strict|multi-strict-limited&size=RxCxL (default 30x30x100,
// 90,930 nodes). Run it with scripts/perf.js (window.gc exposed) or open it in a browser.
(function () {
    const params = new URLSearchParams(location.search);
    const kind = params.get('kind') || 'single';
    const [R, C, L] = (params.get('size') || '30x30x100').split('x').map(Number);
    const multi = kind.indexOf('multi') === 0;
    const out = [];
    const timings = {};
    const durations = new Set();   // keys of timings that are milliseconds (the rest are counts and values)

    const now = () => performance.now();
    const frames = n => new Promise(res => { let k = 0; (function f() { if (++k > n) res(); else requestAnimationFrame(f); })(); });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const heapMB = () => (window.performance && performance.memory) ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
    const gc = () => { if (window.gc) { window.gc(); window.gc(); } };
    const ctrl = () => angular.element(document.querySelector('aui-tree-select')).controller('auiTreeSelect');
    const domRows = () => document.querySelectorAll('li.aui-tree-select__node').length;

    async function step(name, fn, settle) {
        const t0 = now();
        fn();
        if (settle) await settle(); else await frames(2);
        const ms = Math.round(now() - t0);
        timings[name] = ms;
        durations.add(name);
        return ms;
    }

    async function until(cond, timeout) {
        const t0 = now();
        while (!cond()) {
            if (now() - t0 > (timeout || 10000)) return false;
            await sleep(5);
        }
        await frames(2);
        return true;
    }

    function apply(fn) { window.benchScope.$apply(fn); }

    async function run() {
        await frames(2);
        gc();
        const heap0 = heapMB();
        const t0 = now();
        let data = window.makeTree(R, C, L, kind === 'single-flat');
        const genMs = Math.round(now() - t0);
        const nodes = R + R * C + R * C * L;
        out.push(`kind=${kind} nodes=${nodes.toLocaleString()} (${R} x ${C} x ${L}${kind === 'single-flat' ? ', flat' : ', nested'}); data generated in ${genMs} ms`);

        await step('mount (index build + first render)', () => apply(() => {
            const s = window.benchScope;
            s.data = data;
            s.m.v = multi ? [] : null;
            s.cfg = {kind: kind};
        }));
        await step('open', () => apply(() => window.benchScope.api.open()));
        const rowsAfterOpen = ctrl().rows.length;
        await step('expand all', () => apply(() => window.benchScope.api.expandAll()));
        const visibleAfterExpand = ctrl().rows.length;
        const domAfterExpand = domRows();

        let list = document.querySelector('ul.aui-tree-select__tree');
        await step('scroll to the end', () => { list.scrollTop = list.scrollHeight; list.dispatchEvent(new Event('scroll')); }, () => frames(4));
        let lastLabel = (document.querySelectorAll('li.aui-tree-select__node .aui-tree-select__label') || []);
        const lastText = lastLabel.length ? lastLabel[lastLabel.length - 1].textContent.trim() : '';

        let input = document.querySelector('.aui-select__search-input');
        const target = 'Store ' + (R - 1) + '-' + (C - 1) + '-' + (L - 1);
        if (input) {
            await step('search (incl. 120 ms debounce)', () => { input.value = target; input.dispatchEvent(new Event('input')); },
                () => until(() => ctrl().rows.length > 0 && ctrl().rows.length < 10));
            timings.searchRows = ctrl().rows.length;
            await step('clear search', () => { input.value = ''; input.dispatchEvent(new Event('input')); },
                () => until(() => ctrl().rows.length === visibleAfterExpand));
        }

        if (multi) {
            const firstRoot = document.querySelector('li.aui-tree-select__node');
            await step('check one group (click)', () => firstRoot.click());
            timings.modelAfterGroup = window.benchScope.m.v.length;
            timings.tagsAfterGroup = ctrl().tags.length;
            let all = window.leafIds(R, C, L);
            await step('set model: all ' + all.length.toLocaleString() + ' stores (external)', () => apply(() => { window.benchScope.m.v = all; }));
            timings.tagsAll = ctrl().tags.length;
            timings.domTagsAll = document.querySelectorAll('.aui-select__tag').length;
            timings.modelAll = window.benchScope.m.v.length;
            all = null;
            await step('uncheck one group (click)', () => document.querySelector('li.aui-tree-select__node').click());
            timings.modelAfterUncheck = window.benchScope.m.v.length;
            await step('clear all', () => apply(() => ctrl().clearSelection()));
            timings.modelAfterClear = window.benchScope.m.v.length;
        } else {
            const rowEls = document.querySelectorAll('li.aui-tree-select__node');
            await step('select (click)', () => rowEls[rowEls.length - 1].click());
            timings.selected = window.benchScope.m.v;
            await step('open again', () => apply(() => window.benchScope.api.open()));
        }

        // a digest with the component idle (what every other page interaction pays)
        const d0 = now();
        for (let i = 0; i < 20; i++) apply(angular.noop);
        timings['idle digest (avg of 20)'] = +((now() - d0) / 20).toFixed(2);
        durations.add('idle digest (avg of 20)');

        gc();
        const heapLoaded = heapMB();
        await step('destroy', () => apply(() => { window.benchScope.cfg = null; }));
        data = null;
        list = null; input = null; lastLabel = null;
        apply(() => { window.benchScope.data = []; window.benchScope.m.v = null; });
        await sleep(300);
        await frames(2);
        gc();
        const heapAfter = heapMB();

        out.push(`rows: after open ${rowsAfterOpen}, after expand all ${visibleAfterExpand.toLocaleString()} (DOM rows ${domAfterExpand}); last row at the end: "${lastText}"`);
        Object.keys(timings).forEach(k => out.push(`  ${k}: ${timings[k]}${durations.has(k) ? ' ms' : ''}`));
        out.push(`heap: start ${heap0} MB, loaded ${heapLoaded} MB (+${heapLoaded - heap0} MB incl. the data), after destroy ${heapAfter} MB`);
        out.push(`angular errors: ${window.__ngErrors.length}${window.__ngErrors.length ? ' ' + JSON.stringify(window.__ngErrors.slice(0, 3)) : ''}`);
        window.__bench = {kind, nodes, timings, rowsAfterOpen, visibleAfterExpand, domAfterExpand, lastText, heap0, heapLoaded, heapAfter, errors: window.__ngErrors.slice(), lines: out};
        document.getElementById('results').textContent = out.join('\n');
    }

    window.addEventListener('load', () => { run().catch(e => { window.__bench = {error: String(e && e.stack || e)}; }); });
})();
