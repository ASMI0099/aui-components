// Select round suite (page: round.html, fixture: round.fixture.js): lookups of several data sets and their races, a
// stale search, plain values, known records at mount, locks, automatic picks, the page's form and deferred models.
(function () {
    const {sleep, until} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const shown = id => trig(id).querySelector('.aui-select__display-text, .aui-select__tags, .aui-select__placeholder');
    const text = id => (trig(id).textContent || '').replace(/\s+/g, ' ').trim();
    const lis = id => Array.prototype.slice.call(host(id).querySelectorAll('li.aui-select__option'));
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const outside = () => document.getElementById('outside');
    const reqs = f => scope().requests.filter(r => r.req.params && r.req.params.f === f);
    const answer = (r, items) => apply(() => r.answer.resolve(items));
    async function open(id) { trig(id).click(); await sleep(200); }
    async function close() { outside().focus(); document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true})); await sleep(300); }
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('R1 one lookup group, two data sets (other params): a request each, and each field shows its own record',
        {requests: 2, north: true, south: true},
        async () => {
            await until(() => reqs('g').length >= 1, 2000);
            await sleep(100);
            const list = reqs('g');
            list.forEach(r => answer(r, [{id: 4, label: r.req.params.store === 'N' ? 'North goods' : 'South goods'}]));
            await sleep(100);
            return {requests: list.length, north: text('g-north').indexOf('North goods') >= 0, south: text('g-south').indexOf('South goods') >= 0};
        });

    T('R2 the params change while a lookup runs: asked again with the new params; the late answer for the old ones is dropped',
        {asked: ['N', 'S'], shows: true},
        async () => {
            await until(() => reqs('sw').length >= 1, 2000);
            apply(s => { s.state.swStore = 'S'; });
            await until(() => reqs('sw').length >= 2, 2000);
            const list = reqs('sw');
            answer(list[1], [{id: 9, label: 'South nine'}]);
            await sleep(50);
            answer(list[0], [{id: 9, label: 'North nine'}]);
            await sleep(100);
            return {asked: list.map(r => r.req.params.store), shows: text('sw').indexOf('South nine') >= 0};
        });

    T('R3 a value picked again while its earlier lookup still runs: the earlier answer, coming first, is dropped; the latest counts',
        {shows: 'Fresh'},
        async () => {
            apply(s => { s.m.race = 9; });
            await until(() => reqs('race').length >= 1, 2000);
            apply(s => { s.m.race = 10; });
            await until(() => reqs('race').length >= 2, 2000);
            apply(s => { s.m.race = 9; });
            await until(() => reqs('race').length >= 3, 2000);
            const list = reqs('race');
            answer(list[0], [{id: 9, label: 'Earlier'}]);
            await sleep(50);
            answer(list[2], [{id: 9, label: 'Fresh'}]);
            await sleep(100);
            return {shows: text('race').indexOf('Fresh') >= 0 ? 'Fresh' : text('race')};
        });

    T('R4 a press on a dimmed row of the previous search (the new one still loading) picks nothing',
        {dimmed: true, model: null, open: true},
        async () => {
            await open('st');
            await until(() => reqs('st').length >= 1, 2000);
            answer(reqs('st')[0], [{id: 1, label: 'North depot'}, {id: 2, label: 'South depot'}]);
            await until(() => lis('st').length >= 2, 2000);
            const box = host('st').querySelector('.aui-select__search-input');
            box.value = 'South';
            box.dispatchEvent(new Event('input', {bubbles: true}));
            await until(() => reqs('st').length >= 2, 2000);
            const dimmed = !!host('st').querySelector('.aui-select__options--stale');
            lis('st')[0].click();
            await sleep(100);
            const r = {dimmed, model: scope().m.st, open: angular.element(host('st')).controller('auiSelect').isOpen};
            await close();
            return r;
        });

    T('R5 plain values as options: rows with their text; a pick gives the value itself',
        {rows: ['Red', 'Green', 'Blue'], model: 'Green'},
        async () => {
            await open('plain');
            const rows = lis('plain').map(li => li.textContent.trim());
            lis('plain')[1].click();
            await sleep(200);
            return {rows, model: scope().m.plain};
        });

    T('R6 value-options given with the field: its label at once, and the whole record in selected-items',
        {label: true, unit: 'kg'},
        async () => ({label: text('vo').indexOf('Known') >= 0, unit: (scope().state.voItems || [])[0] ? scope().state.voItems[0].unit : null}));

    T('R7 an option locked after it was picked (disabled-field set in place): Clear keeps it',
        {model: [1]},
        async () => {
            apply(s => { s.state.lockOpts[0].disabled = true; });
            await sleep(50);
            host('lock').querySelector('.aui-control-clear').click();
            await sleep(100);
            return {model: scope().m.lock.slice()};
        });

    T('R8 auto-select-on-single-required turned off before its moment: nothing is picked',
        {model: null},
        async () => {
            apply(s => { s.state.showAuto1 = true; });
            apply(s => { s.state.autoOn = false; });
            await sleep(1300);
            return {model: scope().m.auto1};
        });

    T('R9 a field that becomes required later (the opt-in on) picks its only option',
        {before: null, after: 1},
        async () => {
            apply(s => { s.state.showAuto2 = true; });
            await sleep(1200);
            const before = scope().m.auto2;
            apply(s => { s.state.req2 = true; });
            await sleep(1300);
            return {before, after: scope().m.auto2};
        });

    T('R10 the browser\'s own check of the form (a native submit): the empty required field takes the focus (not its hidden input) and shows it is invalid',
        {focused: true, touched: true},
        async () => {
            document.getElementById('sf').requestSubmit();
            await sleep(150);
            const model = angular.element(host('fr')).controller('ngModel');
            return {focused: document.activeElement === trig('fr'), touched: model.$touched};
        });

    T('R11 a disabled field adds nothing to the form\'s data; an empty readonly required one does not stop the browser\'s check',
        {pick: false, readonlyValid: true},
        async () => {
            const data = new FormData(document.getElementById('sf'));
            const input = host('fro').querySelector('.aui-select__hidden-input');
            return {pick: data.has('pick'), readonlyValid: input.checkValidity()};
        });

    T('R12 inside a disabled <fieldset>: disabled (it does not open, says so, takes no focus)',
        {open: false, aria: 'true', tabindex: null},
        async () => {
            apply(s => { s.state.fsOff = true; });
            await sleep(50);
            trig('fs').click();
            await sleep(200);
            const r = {open: angular.element(host('fs')).controller('auiSelect').isOpen, aria: trig('fs').getAttribute('aria-disabled'),
                tabindex: trig('fs').getAttribute('tabindex')};
            apply(s => { s.state.fsOff = false; });
            return r;
        });

    T('R13 a disabled field takes no focus, from the page\'s code either (it has no tabindex)',
        {focused: false, tabindex: null},
        async () => {
            outside().focus();
            trig('fd').focus();
            return {focused: document.activeElement === trig('fd'), tabindex: trig('fd').getAttribute('tabindex')};
        });

    T('R14 the form\'s native reset: the hidden input keeps the field\'s value (the data sent agrees with the field)',
        {value: 'C', model: 'C'},
        async () => {
            document.getElementById('sf').reset();
            await sleep(50);
            return {value: host('frs').querySelector('.aui-select__hidden-input').value, model: scope().m.frs};
        });

    T('R15 updateOn blur: a pick commits when the field is left',
        {before: 'C', after: 'D'},
        async () => {
            await open('blur');
            lis('blur')[3].click();
            await sleep(150);
            const before = scope().m.blur;
            outside().focus();
            await sleep(150);
            return {before, after: scope().m.blur};
        });

    T('R16 a debounced model: on-change reports the new value once it commits',
        {last: {value: 'D', oldValue: 'C'}},
        async () => {
            scope().changes.length = 0;
            await open('deb');
            lis('deb')[3].click();
            await sleep(400);
            const changes = scope().changes;
            return {last: changes[changes.length - 1] || null};
        });

    T('R17 options set to null while the list is open: no rows are left to pick',
        {rows: 0},
        async () => {
            await open('nul');
            apply(s => { s.state.nullOpts = null; });
            await sleep(150);
            const rows = lis('nul').length;
            await close();
            return {rows};
        });

    T('R18 reload() looks the shown value up again (a record renamed on the server)',
        {asked: 2, shows: true},
        async () => {
            await until(() => reqs('rl').length >= 1, 2000);
            answer(reqs('rl')[0], [{id: 7, label: 'Old name'}]);
            await sleep(100);
            scope().api.reload();
            await until(() => reqs('rl').length >= 2, 2000);
            answer(reqs('rl')[1], [{id: 7, label: 'New name'}]);
            await sleep(100);
            return {asked: reqs('rl').length, shows: text('rl').indexOf('New name') >= 0};
        });

    T('R20 max-tag-count switched from 2 to responsive after mount: the tags fit their line with a "+N" for the rest; back to 2',
        {before: {tags: 2, count: '+6'}, responsive: {fits: true, count: true}, back: {tags: 2, count: '+6'}},
        async () => {
            const tagsOf = () => host('mtc').querySelector('.aui-select__tags');
            const look = () => {
                const tags = tagsOf();
                const count = tags.querySelector('.aui-select__tag--count');
                return {tags: tags.querySelectorAll('.aui-select__tag:not(.aui-select__tag--count)').length, count: count ? count.textContent.trim() : null};
            };
            const before = look();
            apply(s => { s.state.mtc = 'responsive'; });
            await until(() => tagsOf().scrollWidth <= tagsOf().clientWidth + 1 && !!tagsOf().querySelector('.aui-select__tag--count'), 1500);
            const responsive = {fits: tagsOf().scrollWidth <= tagsOf().clientWidth + 1, count: !!tagsOf().querySelector('.aui-select__tag--count')};
            apply(s => { s.state.mtc = 2; });
            await sleep(50);
            return {before, responsive, back: look()};
        });

    T('R21 searchable bound: switched on, the open list has its search box; switched off, it has none',
        {off: false, on: true, offAgain: false},
        async () => {
            const hasSearch = () => !!host('srch').querySelector('.aui-select__search-input');
            await open('srch');
            const off = hasSearch();
            await close();
            apply(s => { s.state.srch = true; });
            await open('srch');
            const on = hasSearch();
            await close();
            apply(s => { s.state.srch = false; });
            await open('srch');
            const offAgain = hasSearch();
            await close();
            return {off, on, offAgain};
        });

    T('R22 label-field written with {{ }} and changed: the shown value follows the new field',
        {before: 'One', after: 'Uno'},
        async () => {
            const before = text('lf');
            apply(s => { s.state.lf = 'alt'; });
            await sleep(50);
            return {before, after: text('lf')};
        });

    T('R23 prefers-reduced-motion: reduce - the panel opens and closes without scaling (it only fades)',
        {open: ['none'], close: ['none']},
        async () => {
            const real = window.matchMedia;
            // the user's setting, as the browser reports it (the panel asks it at each opening and closing)
            window.matchMedia = q => (/prefers-reduced-motion:\s*reduce/.test(q)
                ? {matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}}
                : real.call(window, q));
            const panel = () => host('lf').querySelector('.aui-select__panel');
            const sample = async () => {
                const seen = new Set();
                for (let i = 0; i < 8; i += 1) {
                    await new Promise(r => requestAnimationFrame(r));
                    const p = panel();
                    if (p) seen.add(getComputedStyle(p).transform);
                }
                return Array.from(seen);
            };
            try {
                trig('lf').click();
                const open = await sample();
                await sleep(150);
                outside().focus();
                document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                const close = await sample();
                await sleep(300);
                return {open, close};
            } finally {
                window.matchMedia = real;
            }
        });

    T('R24 a long list scrolled by hand away from its active row: aria-activedescendant names no row that is not in the page',
        {before: true, scrolled: true, back: true},
        async () => {
            const resolves = () => {
                const ids = [trig('virt'), host('virt').querySelector('.aui-select__search-input')].filter(Boolean)
                    .map(el => el.getAttribute('aria-activedescendant')).filter(Boolean);
                return ids.every(id => !!document.getElementById(id));
            };
            await open('virt');
            const before = resolves();
            const list = host('virt').querySelector('ul.aui-select__options');
            list.scrollTop = list.scrollHeight;
            list.dispatchEvent(new Event('scroll'));
            await sleep(150);
            const scrolled = resolves();
            const box = host('virt').querySelector('.aui-select__search-input') || trig('virt');
            box.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true}));
            await sleep(150);
            const back = resolves();
            await close();
            return {before, scrolled, back};
        });

    T('R25 a failed load: its message is a live status, and Enter in the field tries again (as its Retry link does)',
        {role: 'status', asked: 2, open: true},
        async () => {
            await open('fail');
            await until(() => reqs('fail').length >= 1, 2000);
            apply(() => reqs('fail')[0].answer.reject(new Error('down')));
            await until(() => !!host('fail').querySelector('.aui-select__status--retry'), 2000);
            const role = host('fail').querySelector('.aui-select__status--retry').getAttribute('role');
            const box = host('fail').querySelector('.aui-select__search-input') || trig('fail');
            box.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
            await until(() => reqs('fail').length >= 2, 2000);
            const r = {role, asked: reqs('fail').length, open: angular.element(host('fail')).controller('auiSelect').isOpen};
            apply(() => reqs('fail')[1].answer.resolve([{id: 1, label: 'Back'}]));
            await close();
            return r;
        });

    T('R26 the page\'s aria-label, aria-labelledby and aria-describedby on the field name and describe its trigger (the focused element)',
        {label: 'External inventory label', described: 'ax-help', labelledby: 'ax-name', keepsMessage: true},
        async () => {
            const triggers = document.querySelectorAll('#ax .aui-select__trigger');
            const first = triggers[0], second = triggers[1];
            const ids = (second.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
            return {label: first.getAttribute('aria-label'), described: first.getAttribute('aria-describedby'),
                labelledby: second.getAttribute('aria-labelledby'), keepsMessage: ids.length === 0 || ids.every(id => !!document.getElementById(id))};
        });

    T('R19 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('aui-select: lookups, forms, locks, picks', tests, {delay: 0});
})();
