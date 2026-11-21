// Search status suite (page: search-status.html, fixture: search-status.fixture.js), aui-select and aui-tree-select:
// while a server search is under way (from the first keystroke, through the typing pause and the request, until the
// rows of the typed text are shown) the search box shows its spinner, the progress line runs and the old rows are
// dimmed; never for a search in the browser, below search-min-length, after a failure, or once the box is cleared;
// the progress line alone marks a background refresh.
(function () {
    const {sleep, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select, #' + id + ' aui-tree-select');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const box = id => host(id).querySelector('.aui-select__search-input');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const mouse = (el, name) => el.dispatchEvent(new MouseEvent(name, {bubbles: true, cancelable: true, button: 0}));
    async function open(id, wait) { ['mousedown', 'mouseup', 'click'].forEach(n => mouse(trig(id), n)); await sleep(wait === undefined ? 400 : wait); }
    async function close() { outside(); await sleep(450); }
    function type(id, text) { const input = box(id); input.value = text; input.dispatchEvent(new Event('input', {bubbles: true})); }
    const rowTexts = id => Array.prototype.map.call(host(id).querySelectorAll('li.aui-select__option'),
        li => (li.querySelector('.aui-tree-select__label') || li).textContent.replace(/\s+/g, ' ').trim());
    function state(id) {
        const h = host(id);
        return {
            S: !!h.querySelector('.aui-select__search--busy .aui-select__search-spinner'),
            L: !!h.querySelector('.aui-select__progress'),
            D: !!h.querySelector('.aui-select__options--stale'),
            R: !!h.querySelector('li.aui-select__searching, li.aui-tree-select__searching'),
            E: !!h.querySelector('.aui-select__status--retry, .aui-tree-select__retry')
        };
    }
    /** The state of a field after every frame, with done() (the rows answer the typed text) at that frame. */
    function sampler(id, done) {
        const out = [];
        let on = true;
        (function frame() {
            requestAnimationFrame(() => setTimeout(() => {
                out.push(Object.assign(state(id), {done: done ? !!done() : false}));
                if (on) frame();
            }, 0));
        })();
        return {out, stop: () => { on = false; }};
    }
    /** From the first frame until the rows answer: every frame searching (S and L); from then on: none. */
    function judge(out) {
        const first = out.findIndex(f => f.done);
        const before = first === -1 ? out : out.slice(0, first);
        const after = first === -1 ? [] : out.slice(first);
        return {answered: first !== -1, spinnerAndLineUntil: before.length > 0 && before.every(f => f.S && f.L),
            dimmedUntil: before.length > 0 && before.every(f => f.D || f.R), offAfter: after.length > 0 && after.every(f => !f.S && !f.L && !f.D)};
    }
    const matching = (id, q) => () => { const t = rowTexts(id); return t.length > 0 && t.every(x => x.toLowerCase().indexOf(q.toLowerCase()) !== -1); };

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});
    const RUN = {answered: true, spinnerAndLineUntil: true, dimmedUntil: true, offAfter: true};

    T('SS1 aui-select server search: spinner and progress line from the first keystroke until the rows of the text arrive (old rows dimmed); none after',
        RUN, async () => {
            apply(s => { s.server.delay = 200; s.server.fail = false; });
            await open('s');
            const rec = sampler('s', matching('s', 'Apple 1'));
            type('s', 'Apple 1');
            await sleep(100 + 200 + 250);
            rec.stop();
            await close();
            return judge(rec.out);
        });

    T('SS2 typing on (three keystrokes in the typing pause): the spinner and the line stay, without a gap, until the last text is answered',
        RUN, async () => {
            await open('s');
            const rec = sampler('s', matching('s', 'Apple 12'));
            type('s', 'Apple');
            await sleep(70);
            type('s', 'Apple 1');
            await sleep(70);
            type('s', 'Apple 12');
            await sleep(100 + 200 + 250);
            rec.stop();
            await close();
            return judge(rec.out);
        });

    T('SS3 clearing the box ends the search status at once (the plain rows are back)',
        {searchingBefore: true, offAtOnce: true, plainRows: true}, async () => {
            apply(s => { s.server.delay = 400; });
            await open('s', 700);
            type('s', 'Banana');
            await sleep(150);
            const searchingBefore = state('s').S && state('s').L;
            type('s', '');
            await sleep(60);
            const now = state('s');
            const r = {searchingBefore, offAtOnce: !now.S && !now.L && !now.D, plainRows: rowTexts('s').length > 0 && rowTexts('s').some(t => t.indexOf('Apple') === 0)};
            apply(s => { s.server.delay = 200; });
            await sleep(450);
            await close();
            return r;
        });

    T('SS4 a failed search ends the search status and shows its retry row (no endless spinner)',
        {searchingWhileWaiting: true, retry: true, off: true}, async () => {
            await open('s');
            apply(s => { s.server.fail = true; });
            type('s', 'Apple 2');
            await sleep(150);
            const searchingWhileWaiting = state('s').S;
            await sleep(100 + 200 + 150);
            const st = state('s');
            apply(s => { s.server.fail = false; });
            await close();
            return {searchingWhileWaiting, retry: st.E, off: !st.S && !st.L};
        });

    T('SS5 below search-min-length: no search status, the hint shows',
        {neverSearching: true, hint: true}, async () => {
            await open('sm');
            const rec = sampler('sm');
            type('sm', 'A');
            await sleep(450);
            rec.stop();
            const hint = /at least 2/.test(host('sm').querySelector('.aui-select__panel').textContent);
            await close();
            return {neverSearching: rec.out.every(f => !f.S && !f.L), hint};
        });

    T('SS6 aui-select searching its loaded list in the browser: never a search status',
        {neverSearching: true, filtered: true}, async () => {
            await open('sa', 600);
            const rec = sampler('sa');
            type('sa', 'Apple');
            await sleep(400);
            rec.stop();
            const r = {neverSearching: rec.out.every(f => !f.S && !f.L && !f.D), filtered: matching('sa', 'Apple')()};
            await close();
            return r;
        });

    T('SS7 aui-tree-select server search: spinner and progress line from the first keystroke until its results arrive; none after',
        RUN, async () => {
            apply(s => { s.server.delay = 200; s.server.fail = false; });
            await open('t');
            const rec = sampler('t', () => { const t = rowTexts('t'); return t.indexOf('Fruit 2') !== -1 && t.indexOf('Nuts 1') === -1; });
            type('t', 'Fruit 2');
            await sleep(100 + 200 + 250);
            rec.stop();
            await close();
            return judge(rec.out);
        });

    T('SS8 aui-tree-select: a failed search ends the search status and shows its retry row; clearing the box ends it at once',
        {retry: true, offAfterFailure: true, searchingAgain: true, offOnClear: true}, async () => {
            await open('t');
            apply(s => { s.server.fail = true; });
            type('t', 'Nuts');
            await sleep(100 + 200 + 150);
            const st = state('t');
            apply(s => { s.server.fail = false; s.server.delay = 400; });
            type('t', 'Nuts 3');
            await sleep(150);
            const searchingAgain = state('t').S;
            type('t', '');
            await sleep(60);
            const cleared = state('t');
            apply(s => { s.server.delay = 200; });
            await sleep(450);
            await close();
            return {retry: st.E, offAfterFailure: !st.S && !st.L, searchingAgain, offOnClear: !cleared.S && !cleared.L && !cleared.D};
        });

    T('SS9 aui-tree-select searching its loaded tree in the browser: never a search status',
        {neverSearching: true}, async () => {
            await open('tl');
            const rec = sampler('tl');
            type('tl', 'Fruit');
            await sleep(400);
            rec.stop();
            await close();
            return {neverSearching: rec.out.every(f => !f.S && !f.L)};
        });

    T('SS10 a background refresh (after cache-ttl) shows the progress line alone, in both components, until it is done',
        {select: {line: true, noSpinner: true, ends: true}, tree: {line: true, noSpinner: true, ends: true}}, async () => {
            const out = {};
            for (const [name, id] of [['select', 'sr'], ['tree', 'tr']]) {
                apply(s => { s.server.delay = 250; });
                await open(id, 700);
                await close();
                await sleep(400);   // past cache-ttl (300)
                const rec = sampler(id);
                await open(id, 120);
                const during = state(id);
                await sleep(500);
                rec.stop();
                const end = state(id);
                out[name] = {line: during.L, noSpinner: rec.out.every(f => !f.S), ends: !end.L};
                await close();
            }
            apply(s => { s.server.delay = 200; });
            return out;
        });

    T('E1 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-* family: search status', tests, {delay: 0});
})();
