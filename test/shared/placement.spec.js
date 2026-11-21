// Dropdown placement suite (page: placement.html, fixture: placement.fixture.js), aui-select and aui-tree-select:
// the panel's side is chosen on open by the height it will need and kept while it is open (loading, searching and
// content changes never flip it); it changes only when scrolling leaves too little room; it never runs off the screen.
(function () {
    const {sleep, type, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select, #' + id + ' aui-tree-select');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const panel = id => host(id).querySelector('.aui-select__panel');
    const searchBox = id => host(id).querySelector('.aui-select__search-input');
    const frames = n => new Promise(res => { let k = 0; (function f() { if (++k > n) res(); else requestAnimationFrame(f); })(); });

    /** Where the panel is: its side, whether it touches its field (1px), whether it is fully on the screen (8px margin). */
    function where(id) {
        const t = trig(id).getBoundingClientRect();
        const p = panel(id).getBoundingClientRect();
        const side = p.top >= t.top ? 'bottom' : 'top';
        const gap = side === 'bottom' ? p.top - t.bottom : t.top - p.bottom;
        return {side: side, attached: Math.abs(gap) <= 1, onScreen: p.top >= 7 && p.bottom <= window.innerHeight - 7};
    }
    async function open(id) { trig(id).click(); await sleep(60); await frames(2); }
    async function close() { outside(); await sleep(350); }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});
    const top = {side: 'top', attached: true, onScreen: true};
    const bottom = {side: 'bottom', attached: true, onScreen: true};

    T('M1 tree loading near the bottom (292px below): it opens above at once, while loading, and stays there with the data',
        {loading: top, loaded: top},
        async () => {
            await open('p-tree-low');
            const loading = where('p-tree-low');
            await sleep(400);
            const r = {loading, loaded: where('p-tree-low')};
            await close();
            return r;
        });

    T('M2 tree loading with room below (432px): it opens below and stays below with the data, fully on the screen',
        {loading: bottom, loaded: bottom},
        async () => {
            await open('p-tree-high');
            const loading = where('p-tree-high');
            await sleep(400);
            const r = {loading, loaded: where('p-tree-high')};
            await close();
            return r;
        });

    T('M3 a long static list near the bottom opens above; searching to a few matches and clearing never moves it',
        {opened: top, few: top, none: top, cleared: top},
        async () => {
            await open('p-search');
            const opened = where('p-search');
            type(searchBox('p-search'), 'Option 7');     // 11 matches: would fit below
            await frames(3);
            const few = where('p-search');
            type(searchBox('p-search'), 'nothing like this');
            await frames(3);
            const none = where('p-search');
            type(searchBox('p-search'), '');
            await frames(3);
            const r = {opened, few, none, cleared: where('p-search')};
            await close();
            return r;
        });

    T('M4 a short static list that fits below opens below',
        {opened: bottom},
        async () => {
            await open('p-few');
            const r = {opened: where('p-few')};
            await close();
            return r;
        });

    T('M5 a server list near the bottom (262px below): above at once while loading, above with the data',
        {loading: top, loaded: top},
        async () => {
            await open('p-remote');
            const loading = where('p-remote');
            await sleep(400);
            const r = {loading, loaded: where('p-remote')};
            await close();
            return r;
        });

    T('M6 a list taller than either side: the side with more room, and the list is shortened so the panel stays on the screen',
        {attached: true, onScreen: true, listShortened: true},
        async () => {
            await open('p-tall');
            await frames(3);
            const w = where('p-tall');
            const list = panel('p-tall').querySelector('.aui-select__options');
            const r = {attached: w.attached, onScreen: w.onScreen, listShortened: list.scrollHeight > list.clientHeight + 100};
            await close();
            return r;
        });

    T('M7 scrolling: the side changes only when its room drops under 160px, and does not change back at once (no flapping)',
        {opened: 'bottom', squeezed: 'top', alittleBack: 'top', farBack: 'bottom', alwaysAttached: true},
        async () => {
            const field = document.getElementById('p-scroll');
            const docTop = field.getBoundingClientRect().top + window.scrollY;
            const scrollToRoomBelow = async function (room) {   // scroll so that `room` px are left below the field
                window.scrollTo(0, docTop + 38 + room - window.innerHeight);
                await frames(3);
            };
            await scrollToRoomBelow(500);
            await open('p-scroll');
            const states = [where('p-scroll')];
            await scrollToRoomBelow(120);     // too little room below: moves above
            states.push(where('p-scroll'));
            await scrollToRoomBelow(240);     // room below again, but above still has plenty: stays above
            states.push(where('p-scroll'));
            await scrollToRoomBelow(window.innerHeight - 38 - 120);   // little room above now: back below
            states.push(where('p-scroll'));
            await close();
            window.scrollTo(0, 0);
            await frames(2);
            return {opened: states[0].side, squeezed: states[1].side, alittleBack: states[2].side, farBack: states[3].side,
                alwaysAttached: states.every(s => s.attached && s.onScreen)};
        });

    T('M8 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    T('M9 a field at a fractional position: the panel is placed on whole device pixels (its own layer is not moved onto them by the browser: on a fraction it was drawn soft), its edges where those of the trigger are drawn',
        {left: true, right: true, top: true, linedUp: true},
        async () => {
            await open('p-half');
            await sleep(300);
            const d = window.devicePixelRatio || 1;
            const t = trig('p-half').getBoundingClientRect();
            const p = panel('p-half').getBoundingClientRect();
            const whole = v => Math.abs(v * d - Math.round(v * d)) < 0.05;
            const drawn = v => Math.round(v * d) / d;
            const out = {left: whole(p.left), right: whole(p.right), top: whole(p.top),
                linedUp: Math.abs(p.left - drawn(t.left)) < 0.05 && Math.abs(p.right - drawn(t.right)) < 0.05};
            await close();
            return out;
        });

    AuiTest.run('aui-* family: dropdown placement', tests, {delay: 0});
})();
