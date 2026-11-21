// Drives aui-select with a big static option list through typical actions and times each step.
// URL: select-bench.html?n=100000&mode=single|multiple&count=1 (count: instances sharing the same list; the steps
// run on the first one). Run it with scripts/perf.js select (window.gc exposed) or open it in a browser.
// Each step shows the script time (the digest the action runs) and the time until two frames are painted.
(function () {
    const params = new URLSearchParams(location.search);
    const N = Number(params.get('n') || 100000);
    const multiple = params.get('mode') === 'multiple';
    const count = Math.max(1, Number(params.get('count') || 1));
    const out = [];
    const rows = [];

    const now = () => performance.now();
    const frames = n => new Promise(res => { let k = 0; (function f() { if (++k > n) res(); else requestAnimationFrame(f); })(); });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const gc = () => { if (window.gc) { window.gc(); window.gc(); } };
    const heapMB = () => (window.performance && performance.memory) ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null;
    const apply = fn => window.benchScope.$apply(fn);
    const host = () => document.querySelector('aui-select');
    const ctrl = () => angular.element(host()).controller('auiSelect');
    const domOptions = () => document.querySelectorAll('li.aui-select__option').length;
    const list = () => document.querySelector('ul.aui-select__options');

    // ?profile=<step name prefix>: a CPU profile of that step only (console.profile; perf-runner can collect it)
    const profileStep = params.get('profile');

    async function step(name, fn, settle) {
        const profiled = !!profileStep && name.indexOf(profileStep) === 0;
        if (profiled) console.profile(name);
        const t0 = now();
        fn();
        const script = now() - t0;
        if (settle) await settle(); else await frames(2);
        const total = now() - t0;
        if (profiled) console.profileEnd(name);
        rows.push({name: name, script: Math.round(script * 10) / 10, total: Math.round(total)});
    }

    function type(text) {
        const input = document.querySelector('.aui-select__search-input');
        input.value = text;
        input.dispatchEvent(new Event('input'));
    }

    function key(name) {
        const trigger = host().querySelector('.aui-select__trigger');
        trigger.dispatchEvent(new KeyboardEvent('keydown', {key: name, bubbles: true, cancelable: true}));
    }

    function idleDigest(rounds) {
        for (let i = 0; i < 5; i++) apply(angular.noop);
        const t0 = now();
        for (let i = 0; i < rounds; i++) apply(angular.noop);
        return +((now() - t0) / rounds).toFixed(2);
    }

    function firstLabel() {
        const el = document.querySelector('li.aui-select__option');
        return el ? el.textContent.trim() : '';
    }

    async function run() {
        await frames(2);
        const words = ['Downtown', 'Airport', 'Harbor', 'Central Hall', 'North Gate', 'Riverside', 'Old Town'];
        const t0 = now();
        let data = new Array(N);
        for (let i = 0; i < N; i++) data[i] = {id: 100000 + i, name: 'Room ' + i + ' ' + words[i % words.length]};
        const genMs = Math.round(now() - t0);
        gc();
        const heapData = heapMB();
        out.push(`aui-select ${multiple ? 'multiple' : 'single'}, ${N.toLocaleString()} static options, ${count} instance(s) on the list; data built in ${genMs} ms, heap with the data ${heapData} MB`);

        const model = {};
        for (let h = 0; h < count; h++) model['v' + h] = multiple ? [] : '';
        await step('mount (closed)', () => apply(() => {
            const s = window.benchScope;
            s.m = model;
            s.data = data;
            s.cfg = {multiple: multiple};
            s.hosts = Array.from({length: count}, (x, i) => i);
        }));
        gc();
        const heapMounted = heapMB();
        const digestClosed = idleDigest(30);

        await step('open (click)', () => host().querySelector('.aui-select__trigger').click());
        const domOpen = domOptions();
        const digestOpen = idleDigest(30);

        await step('scroll to the middle', () => { const el = list(); el.scrollTop = el.scrollHeight / 2; el.dispatchEvent(new Event('scroll')); }, () => frames(4));
        const middle = firstLabel();
        await step('scroll to the end', () => { const el = list(); el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); }, () => frames(4));
        const items = document.querySelectorAll('li.aui-select__option');
        const last = items.length ? items[items.length - 1].textContent.trim() : '';
        await step('key Home', () => key('Home'), () => frames(3));
        await step('key End', () => key('End'), () => frames(3));

        const target = String(N - 1);
        for (let i = 1; i <= Math.min(target.length, 5); i++) {
            const q = target.slice(0, i);
            await step(`search keystroke "${q}"`, () => type(q));
            rows[rows.length - 1].name += ` (${ctrl().rows.length.toLocaleString()} matches)`;
        }
        await step('search clear', () => type(''));
        await step('search "room" (every option matches)', () => type('room'));
        await step('search clear', () => type(''));

        if (!multiple) {
            await step(`search "Room ${target} "`, () => type('Room ' + target + ' '));
            await step('select (click)', () => document.querySelector('li.aui-select__option').click(), () => frames(3));
            rows[rows.length - 1].name += ` -> model ${window.benchScope.m.v0}`;
            await sleep(300);
            await step('set model (external)', () => apply(() => { window.benchScope.m.v0 = data[Math.floor(N / 2)].id; }));
            await step('open again (selected option scrolled into view)', () => host().querySelector('.aui-select__trigger').click());
            rows[rows.length - 1].name += ` ("${(document.querySelector('li.aui-select__option--selected') || {textContent: ''}).textContent.trim()}" rendered)`;
        } else {
            await step('toggle one option (click)', () => document.querySelector('li.aui-select__option').click());
            for (const k of [1000, 10000]) {
                const ids = data.slice(0, Math.min(k, N)).map(o => o.id);
                await step(`set model: ${ids.length.toLocaleString()} values (external)`, () => apply(() => { window.benchScope.m.v0 = ids; }));
                rows[rows.length - 1].name += ` (${document.querySelectorAll('.aui-select__tag').length} tags in the DOM)`;
                await step(`toggle one option with ${ids.length.toLocaleString()} selected (click)`, () => document.querySelectorAll('li.aui-select__option')[3].click());
            }
            await step('clear all (x)', () => host().querySelector('.aui-control-clear').click());
            rows[rows.length - 1].name += ` -> model length ${window.benchScope.m.v0.length}`;
        }
        await step('close (Escape)', () => key('Escape'), () => sleep(400));
        gc();
        const heapUsed = heapMB();
        const digestAfter = idleDigest(30);

        await step('destroy', () => apply(() => { window.benchScope.hosts = []; }));
        data = null;
        apply(() => { window.benchScope.data = []; window.benchScope.m = {}; });
        await sleep(300);
        await frames(2);
        gc();
        const heapAfter = heapMB();

        rows.forEach(r => out.push(`  ${r.name}: script ${r.script} ms, painted ${r.total} ms`));
        out.push(`  idle digest (whole page, avg of 30): closed ${digestClosed} ms, open ${digestOpen} ms, after use ${digestAfter} ms`);
        out.push(`  DOM options while open: ${domOpen}; middle row "${middle}"; last row "${last}"`);
        out.push(`  heap: data ${heapData} MB, mounted ${heapMounted} MB (+${(heapMounted - heapData).toFixed(1)}), after use ${heapUsed} MB, after destroy and dropping the data ${heapAfter} MB`);
        out.push(`  angular errors: ${window.__ngErrors.length}${window.__ngErrors.length ? ' ' + JSON.stringify(window.__ngErrors.slice(0, 3)) : ''}`);
        window.__bench = {rows: rows, errors: window.__ngErrors.slice(), lines: out};
        document.getElementById('results').textContent = out.join('\n');
    }

    window.addEventListener('load', () => { run().catch(e => { window.__bench = {error: String(e && e.stack || e)}; }); });
})();
