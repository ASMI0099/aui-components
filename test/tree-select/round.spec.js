// aui-tree-select round suite (page: round.html, fixture: round.fixture.js): lookups and their races, a stale search,
// known records, locks, automatic picks, the page's form, deferred models and live configuration.
(function () {
    const {sleep, until} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-tree-select');
    const ctrl = id => angular.element(host(id)).controller('auiTreeSelect');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const text = id => (trig(id).textContent || '').replace(/\s+/g, ' ').trim();
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const outside = () => document.getElementById('outside');
    const reqs = f => scope().requests.filter(r => r.req.params && r.req.params.f === f);
    const answer = (r, data) => apply(() => r.answer.resolve(data));
    const searches = tag => scope().searches.filter(s => s.tag === tag);
    const rows = id => Array.prototype.slice.call(host(id).querySelectorAll('li.aui-tree-select__node'));
    const rowEl = (id, label) => rows(id).find(li => li.querySelector('.aui-tree-select__label').textContent.trim() === label);
    const type = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', {bubbles: true})); };
    async function open(id) { trig(id).click(); await sleep(250); }
    async function close() {
        outside().focus();
        document.body.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}));
        document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
        await sleep(300);
    }
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('TR1 one lookup group, two data sets (other params): a request each, and each field shows its own record (TL01)',
        {requests: 2, north: true, south: true},
        async () => {
            await until(() => reqs('g').length >= 1, 2000);
            await sleep(100);
            const list = reqs('g');
            list.forEach(r => answer(r, [{id: 7, name: r.req.params.store === 'N' ? 'North shelf' : 'South shelf'}]));
            await sleep(100);
            return {requests: list.length, north: text('g-n').indexOf('North shelf') >= 0, south: text('g-s').indexOf('South shelf') >= 0};
        });

    T('TR2 the params change while a lookup runs: asked again with the new params; the late answer for the old ones is dropped (TL02)',
        {asked: ['N', 'S'], shows: true},
        async () => {
            await until(() => reqs('sw').length >= 1, 2000);
            apply(s => { s.state.swStore = 'S'; });
            await until(() => reqs('sw').length >= 2, 2000);
            const list = reqs('sw');
            answer(list[1], [{id: 9, name: 'South nine'}]);
            await sleep(50);
            answer(list[0], [{id: 9, name: 'North nine'}]);
            await sleep(100);
            return {asked: list.map(r => r.req.params.store), shows: text('sw').indexOf('South nine') >= 0};
        });

    T('TR3 a value picked again while its earlier lookup still runs: the earlier answer is dropped; the latest counts (TL03)',
        {shows: 'Fresh'},
        async () => {
            apply(s => { s.m.race = 9; });
            await until(() => reqs('race').length >= 1, 2000);
            apply(s => { s.m.race = 10; });
            await until(() => reqs('race').length >= 2, 2000);
            apply(s => { s.m.race = 9; });
            await until(() => reqs('race').length >= 3, 2000);
            const list = reqs('race');
            answer(list[0], [{id: 9, name: 'Earlier'}]);
            await sleep(50);
            answer(list[2], [{id: 9, name: 'Fresh'}]);
            await sleep(100);
            return {shows: text('race').indexOf('Fresh') >= 0 ? 'Fresh' : text('race')};
        });

    T('TR4 a press on a row of the previous search (the new one still running) picks nothing (TL04)',
        {model: null, open: true},
        async () => {
            await open('st');
            const box = host('st').querySelector('.aui-select__search-input');
            type(box, 'North');
            await until(() => searches('st').length >= 1, 2000);
            apply(() => searches('st')[0].answer.resolve([{id: 7, name: 'North shelf', isLeaf: true}]));
            await until(() => !!rowEl('st', 'North shelf'), 2000);
            type(box, 'South');
            await until(() => searches('st').length >= 2, 2000);
            rowEl('st', 'North shelf').click();
            await sleep(100);
            const r = {model: scope().m.st, open: ctrl('st').isOpen};
            await close();
            return r;
        });

    T('TR5 value-options given with the field: its label at once, and the whole record in selected-items (TL05)',
        {label: true, sku: 'K'},
        async () => ({label: text('vo').indexOf('Known') >= 0, sku: (scope().state.voItems || [])[0] ? scope().state.voItems[0].sku : null}));

    T('TR6 api.clear() keeps a locked value as the Clear button does; nothing while the field is disabled (TL06)',
        {cleared: ['A'], whileDisabled: ['A', 'B']},
        async () => {
            apply(s => { s.apis.lock.clear(); });
            await sleep(50);
            const cleared = scope().m.lock.slice();
            apply(s => { s.m.lock = ['A', 'B']; s.state.lockOff = true; });
            apply(s => { s.apis.lock.clear(); });
            await sleep(50);
            const whileDisabled = scope().m.lock.slice();
            apply(s => { s.state.lockOff = false; });
            return {cleared, whileDisabled};
        });

    T('TR7 auto-select-on-single-required turned off before its moment: nothing is picked (TL07)',
        {model: null},
        async () => {
            apply(s => { s.state.showAuto1 = true; });
            apply(s => { s.state.autoOn = false; });
            await sleep(1300);
            return {model: scope().m.auto1};
        });

    T('TR8 a field that becomes required later (the opt-in on) picks its only option (TL08)',
        {before: null, after: 1},
        async () => {
            apply(s => { s.state.showAuto2 = true; });
            await sleep(1200);
            const before = scope().m.auto2;
            apply(s => { s.state.req2 = true; });
            await sleep(1300);
            return {before, after: scope().m.auto2};
        });

    T('TR9 load-enabled false: a search typed in does not reach the server (TL10)',
        {searched: 0},
        async () => {
            await open('lo');
            const box = host('lo').querySelector('.aui-select__search-input');
            if (box) type(box, 'North');
            await sleep(250);
            const searched = searches('lo').length;
            await close();
            return {searched};
        });

    T('TR10 a locked value whose node goes from the options stays locked: no remove button, Clear keeps it (TL11)',
        {removable: false, model: ['A']},
        async () => {
            apply(s => { s.state.unlOpts = s.state.unlOpts.filter(n => n.id !== 'A'); });
            await sleep(50);
            const tags = Array.prototype.slice.call(host('unl').querySelectorAll('.aui-select__tag'));
            const tagA = tags.find(t => t.textContent.indexOf('A') >= 0 && t.textContent.indexOf('Beta') < 0);
            const removable = !!(tagA && tagA.querySelector('.aui-select__tag-remove'));
            host('unl').querySelector('.aui-control-clear').click();
            await sleep(100);
            return {removable, model: scope().m.unl.slice()};
        });

    T('TR11 api.expand() twice, then collapse() twice: on-expand hears each real change once (TL14)',
        {expanded: [true, false]},
        async () => {
            scope().expanded.length = 0;
            apply(s => { s.apis.exp.expand(1); });
            apply(s => { s.apis.exp.expand(1); });
            await sleep(50);
            apply(s => { s.apis.exp.collapse(1); });
            apply(s => { s.apis.exp.collapse(1); });
            await sleep(50);
            return {expanded: scope().expanded.slice()};
        });

    T('TR12 the browser\'s own check of the form (a native submit): the empty required field takes the focus (not its hidden input) and shows it is invalid (TF01)',
        {focused: true, touched: true},
        async () => {
            document.getElementById('tf').requestSubmit();
            await sleep(150);
            const model = angular.element(host('fr')).controller('ngModel');
            return {focused: document.activeElement === trig('fr'), touched: model.$touched};
        });

    T('TR13 a disabled field adds nothing to the form\'s data; an empty readonly required one does not stop the browser\'s check (TF02)',
        {pick: false, readonlyValid: true},
        async () => {
            const data = new FormData(document.getElementById('tf'));
            const input = host('fro').querySelector('.aui-select__hidden-input');
            return {pick: data.has('pick'), readonlyValid: input.checkValidity()};
        });

    T('TR14 inside a disabled <fieldset>: disabled (it does not open, says so, takes no focus) (TF03)',
        {open: false, aria: 'true', tabindex: null},
        async () => {
            apply(s => { s.state.fsOff = true; });
            await sleep(50);
            trig('fs').click();
            await sleep(200);
            const r = {open: ctrl('fs').isOpen, aria: trig('fs').getAttribute('aria-disabled'), tabindex: trig('fs').getAttribute('tabindex')};
            apply(s => { s.state.fsOff = false; });
            return r;
        });

    T('TR15 a disabled field takes no focus, from the page\'s code either (it has no tabindex) (TV17)',
        {focused: false, tabindex: null},
        async () => {
            outside().focus();
            trig('fd').focus();
            return {focused: document.activeElement === trig('fd'), tabindex: trig('fd').getAttribute('tabindex')};
        });

    T('TR16 the form\'s native reset: the hidden input keeps the field\'s value (the data sent agrees with the field) (TF04)',
        {value: 'C', model: 'C'},
        async () => {
            document.getElementById('tf').reset();
            await sleep(50);
            return {value: host('frs').querySelector('.aui-select__hidden-input').value, model: scope().m.frs};
        });

    T('TR17 updateOn blur: a pick commits when the field is left (TF06)',
        {before: 'C', after: 'D'},
        async () => {
            await open('blur');
            rowEl('blur', 'Delta').click();
            await sleep(150);
            const before = scope().m.blur;
            outside().focus();
            await sleep(150);
            return {before, after: scope().m.blur};
        });

    T('TR18 a debounced model: on-change reports the new value once it commits (TF07)',
        {last: {value: 'D', oldValue: 'C'}},
        async () => {
            scope().changes.length = 0;
            await open('deb');
            rowEl('deb', 'Delta').click();
            await sleep(400);
            const changes = scope().changes;
            return {last: changes[changes.length - 1] || null};
        });

    T('TR19 comp-id written with {{ }} and changed: the trigger takes the new id (TC01)',
        {before: 'cat-old', after: 'cat-new'},
        async () => {
            const before = trig('cid').id;
            apply(s => { s.state.cid = 'cat-new'; });
            await sleep(50);
            return {before, after: trig('cid').id};
        });

    T('TR20 max-tag-count switched from 2 to responsive after mount: the tags fit their line with a "+N" for the rest (TC02)',
        {fits: true, count: true},
        async () => {
            const tagsOf = () => host('mtc').querySelector('.aui-select__tags');
            apply(s => { s.state.mtc = 'responsive'; });
            await until(() => tagsOf().scrollWidth <= tagsOf().clientWidth + 1 && !!tagsOf().querySelector('.aui-select__tag--count'), 1500);
            return {fits: tagsOf().scrollWidth <= tagsOf().clientWidth + 1, count: !!tagsOf().querySelector('.aui-select__tag--count')};
        });

    T('TR21 ng-disabled set while the panel is open: it closes (TC03)',
        {before: true, after: false},
        async () => {
            await open('open');
            const before = ctrl('open').isOpen;
            apply(s => { s.state.ngOff = true; });
            await sleep(300);
            const after = ctrl('open').isOpen;
            apply(s => { s.state.ngOff = false; });
            return {before, after};
        });

    T('TR22 options replaced by new objects of the same ids: selected-items follow the new records (EQ01)',
        {before: 'One', after: 'Uno'},
        async () => {
            await sleep(50);
            const before = (scope().state.eqItems || [])[0] ? scope().state.eqItems[0].name : null;
            apply(s => { s.state.eqOpts = [{id: 1, name: 'Uno'}]; });
            await sleep(50);
            return {before, after: (scope().state.eqItems || [])[0] ? scope().state.eqItems[0].name : null};
        });

    T('TR24 a long tree scrolled by hand away from its active row: aria-activedescendant names no row that is not in the page (TV09)',
        {before: true, scrolled: true, back: true},
        async () => {
            const resolves = () => {
                const ids = [trig('tvirt'), host('tvirt').querySelector('.aui-select__search-input')].filter(Boolean)
                    .map(el => el.getAttribute('aria-activedescendant')).filter(Boolean);
                return ids.every(id => !!document.getElementById(id));
            };
            await open('tvirt');
            const before = resolves();
            const list = host('tvirt').querySelector('ul.aui-tree-select__tree');
            list.scrollTop = list.scrollHeight;
            list.dispatchEvent(new Event('scroll'));
            await sleep(150);
            const scrolled = resolves();
            const box = host('tvirt').querySelector('.aui-select__search-input') || trig('tvirt');
            box.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true}));
            await sleep(150);
            const back = resolves();
            await close();
            return {before, scrolled, back};
        });

    T('TR25 a failed load of the tree: its message is a live status, and Enter in the field tries again (TV06, TV07)',
        {role: 'status', asked: 2},
        async () => {
            await open('tfail');
            await until(() => reqs('tfail').length >= 1, 2000);
            apply(() => reqs('tfail')[0].answer.reject(new Error('down')));
            await until(() => !!host('tfail').querySelector('.aui-tree-select__retry'), 2000);
            const role = host('tfail').querySelector('.aui-tree-select__retry').getAttribute('role');
            const box = host('tfail').querySelector('.aui-select__search-input') || trig('tfail');
            box.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
            await until(() => reqs('tfail').length >= 2, 2000);
            const r = {role, asked: reqs('tfail').length};
            apply(() => reqs('tfail')[1].answer.resolve([{id: 1, name: 'Back'}]));
            await close();
            return r;
        });

    T('TR26 a failed server search: its message is a live status, and Enter searches again (TV06, TV07)',
        {role: 'status', searched: 2},
        async () => {
            await open('tsfail');
            const box = host('tsfail').querySelector('.aui-select__search-input');
            type(box, 'North');
            await until(() => searches('tsfail').length >= 1, 2000);
            apply(() => searches('tsfail')[0].answer.reject(new Error('down')));
            await until(() => !!host('tsfail').querySelector('.aui-tree-select__retry'), 2000);
            const role = host('tsfail').querySelector('.aui-tree-select__retry').getAttribute('role');
            box.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
            await until(() => searches('tsfail').length >= 2, 2000);
            const r = {role, searched: searches('tsfail').length};
            apply(() => searches('tsfail')[1].answer.resolve([]));
            await close();
            return r;
        });

    T('TR27 a search that finds nothing: its message is a live status (TV07)',
        {role: 'status'},
        async () => {
            await open('tvirt');
            const box = host('tvirt').querySelector('.aui-select__search-input');
            if (box) type(box, 'zzzz');
            await sleep(400);
            const empty = host('tvirt').querySelector('.aui-select__no-results');
            const r = {role: empty ? empty.getAttribute('role') : null};
            await close();
            return r;
        });

    T('TR28 the page\'s aria-label and aria-describedby on the field name and describe its trigger (the focused element) (TV18)',
        {label: 'External inventory label', described: 'tax-help'},
        async () => ({label: trig('tax').getAttribute('aria-label'), described: trig('tax').getAttribute('aria-describedby')}));

    T('TR29 14 levels open in a 300px panel: the deepest row keeps room for its label (TV14)',
        {room: true, shallowSame: true},
        async () => {
            await open('deep');
            const deepest = rowEl('deep', 'Level 14 category');
            const first = rowEl('deep', 'Level 2 category');
            const label = deepest ? deepest.querySelector('.aui-tree-select__label').getBoundingClientRect().width : 0;
            // a shallow level is indented as before: 6px + 1 x 18px
            const shallow = first ? parseFloat(getComputedStyle(first).paddingLeft) : 0;
            await close();
            return {room: label >= 40, shallowSame: Math.abs(shallow - 24) < 0.5};
        });

    T('TR30 a reveal still loading its branch when the value changes: its answer no longer moves the keyboard to the value before (TL13)',
        {model: 9, onOld: false},
        async () => {
            await until(() => reqs('rev').length >= 1, 2000);
            answer(reqs('rev')[0], [[{id: 'R', name: 'Root'}, {id: 7, name: 'Target', isLeaf: true}]]);
            await sleep(50);
            await open('rev');
            await until(() => scope().childAsks.length >= 1, 2000);
            apply(s => { s.m.rev = 9; });
            await sleep(50);
            apply(() => scope().childAsks[0].answer.resolve([{id: 7, name: 'Target', isLeaf: true}]));
            await sleep(200);
            const c = ctrl('rev');
            const row = c.rows.find(r => r.sid === c.activeSid);
            const r = {model: scope().m.rev, onOld: !!row && row.node.label === 'Target'};
            await close();
            return r;
        });

    T('TR31 a value cleared and set again keeps its label when its data goes (TL15)',
        {before: true, after: true},
        async () => {
            const before = text('tl').indexOf('Old shelf') >= 0;
            apply(s => { s.m.tl = null; });
            apply(s => { s.m.tl = 7; });
            apply(s => { s.state.tlOpts = []; });
            await sleep(50);
            return {before, after: text('tl').indexOf('Old shelf') >= 0};
        });

    T('TR32 reveal-selected: a value on a later page of its branch is reached (the next pages load) (TL12)',
        {active: 'Target', pages: [1, 2]},
        async () => {
            await until(() => reqs('pg').length >= 1, 2000);
            answer(reqs('pg')[0], [[{id: 'R', name: 'Root'}, {id: 7, name: 'Target', isLeaf: true}]]);
            await sleep(50);
            await open('pg');
            const activeLabel = () => {
                const c = ctrl('pg');
                const row = c.rows.find(r => r.sid === c.activeSid);
                return row ? row.node.label : null;
            };
            await until(() => activeLabel() === 'Target', 2000);
            const r = {active: activeLabel(), pages: scope().pages.slice()};
            await close();
            return r;
        });

    T('TR33 a field whose data is replaced again and again (new ids each time) lets go of the ids of the old rows (EQ02)',
        {bounded: true, empty: true},
        async () => {
            // the field's map of row ids: the Map whose values are its rows' ids ("...-n12")
            const realSet = Map.prototype.set;
            let ids = null;
            Map.prototype.set = function (key, value) {
                if (!ids && typeof key === 'string' && /^[ks]:/.test(key) && typeof value === 'string' && /-n\d+$/.test(value)) ids = this;
                return realSet.call(this, key, value);
            };
            try {
                const sizes = [];
                for (let round = 0; round < 4; round += 1) {
                    apply(s => { s.state.idOpts = Array.from({length: 2000}, (x, i) => ({id: round * 2000 + i + 1, name: 'Node ' + (round * 2000 + i + 1)})); });
                    await sleep(30);
                    sizes.push(ids ? ids.size : -1);
                }
                apply(s => { s.state.idOpts = []; });
                await sleep(30);
                return {bounded: sizes.every(n => n >= 0 && n <= 2 * 2000 + 256), empty: !!ids && ids.size <= 256};
            } finally {
                Map.prototype.set = realSet;
            }
        });

    T('TR34 1,200 values set with max-tag-count 1: the paths are worked out once each at most, not twice (EQ04)',
        {calls: true, tags: 2},
        async () => {
            const engine = angular.element(document.body).injector().get('auiTreeEngine');
            const real = engine.pathLabel;
            let calls = 0;
            engine.pathLabel = function () {
                calls += 1;
                return real.apply(this, arguments);
            };
            try {
                apply(s => { s.m.big = Array.from({length: 1200}, (x, i) => i + 1); });
                await sleep(50);
                return {calls: calls <= 1200 + 100, tags: host('big').querySelectorAll('.aui-select__tag').length};
            } finally {
                engine.pathLabel = real;
            }
        });

    T('TR23 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('aui-tree-select: lookups, forms, locks, picks', tests, {delay: 0});
})();
