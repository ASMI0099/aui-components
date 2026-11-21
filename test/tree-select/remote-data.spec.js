// aui-tree-select remote-data suite (page: remote-data.html, fixture: remote-data.fixture.js): load-options per
// params, lookups with paths, $params for load-children and remote-search, children in pages, reveal-selected.
(function () {
    const {sleep, type, key, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-tree-select');
    const ctrl = id => angular.element(host(id)).controller('auiTreeSelect');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const searchBox = id => host(id).querySelector('.aui-select__search-input');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const server = () => scope().server;
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const rowText = r => (r.more ? '[' + r.segs[0].text + ']' : r.node.label);
    const labels = id => ctrl(id).rows.map(r => '  '.repeat(r.depth) + rowText(r));
    const top = id => ctrl(id).rows.filter(r => r.depth === 0 && !r.more).map(r => r.node.label);
    const rowEl = (id, label) => Array.prototype.slice.call(host(id).querySelectorAll('li.aui-tree-select__node'))
        .find(li => li.querySelector('.aui-tree-select__label').textContent.trim() === label);
    const caretOf = (id, label) => rowEl(id, label).querySelector('.aui-tree-select__caret');
    const display = id => {
        const el = host(id).querySelector('.aui-select__display-text');
        return el ? el.textContent.trim() : null;
    };
    const tags = id => Array.from(host(id).querySelectorAll('.aui-select__selected-display > .aui-select__tags > .aui-select__tag:not(.aui-select__tag--count)'))
        .map(t => t.textContent.trim());
    const statusText = id => Array.from(host(id).querySelectorAll('.aui-select__no-results')).map(li => li.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
    const loadingShown = id => !host(id).querySelector('.aui-tree-select__loading').classList.contains('aui-tree-select__loading--hidden');
    const calls = (tag, kind) => server().of(tag, kind);
    const activeLabel = id => {
        const c = ctrl(id);
        const row = c.rows.find(r => r.sid === c.activeSid);
        return row ? rowText(row) : null;
    };
    const warnedAbout = text => window.__warnings.some(w => w.indexOf(text) !== -1);
    const errCount = () => window.__ngErrors.length;
    async function open(id) { trig(id).click(); await sleep(30); }
    async function close() { outside(); await sleep(400); }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    // ------------------------------------------------------------------ load-options
    T('D1 load-options: the whole tree on the first open (loading block meanwhile), one request without a page size',
        {loading: true, roots: ['Fruit', 'Vegetables', 'Spices'], calls: [{reason: 'open', pageSize: null, params: {room: 'A'}}]},
        async () => {
            server().reset();
            await open('t-all');
            const loading = loadingShown('t-all');
            await sleep(150);
            return {loading, roots: top('t-all'), calls: calls('all', 'tree').map(c => ({reason: c.reason, pageSize: c.pageSize, params: c.params}))};
        });

    T('D2 reopening: the kept tree, no request',
        {calls: 0, roots: ['Fruit', 'Vegetables', 'Spices']},
        async () => {
            await close();
            server().reset();
            await open('t-all');
            await sleep(100);
            return {calls: calls('all').length, roots: top('t-all')};
        });

    T('D3 params change while closed: nothing until opened, then the new tree (never the old one)',
        {callsClosed: 0, emptyFirst: true, roots: ['Tools'], request: {reason: 'open', params: {room: 'B'}}},
        async () => {
            await close();
            server().reset();
            apply(s => { s.p.all = 'B'; });
            await sleep(60);
            const callsClosed = calls('all').length;
            await open('t-all');
            const emptyFirst = ctrl('t-all').rows.length === 0 && loadingShown('t-all');
            await sleep(150);
            const c = calls('all', 'tree')[0];
            return {callsClosed, emptyFirst, roots: top('t-all'), request: {reason: c.reason, params: c.params}};
        });

    T('D4 back to the earlier params while open: the kept tree at once, no request',
        {calls: 0, roots: ['Fruit', 'Vegetables', 'Spices']},
        async () => {
            server().reset();
            apply(s => { s.p.all = 'A'; });
            await sleep(100);
            const r = {calls: calls('all').length, roots: top('t-all')};
            await close();
            return r;
        });

    T('D5 load-enabled false: no request, the empty text',
        {calls: 0, text: 'No results found'},
        async () => {
            server().reset();
            apply(s => { s.p.allEnabled = false; });
            await open('t-all');
            await sleep(100);
            const r = {calls: calls('all').length, text: statusText('t-all')};
            await close();
            apply(s => { s.p.allEnabled = true; });
            return r;
        });

    // ------------------------------------------------------------------ saved values
    T('D6 a saved value is looked up through load-options (placeholder meanwhile); the tree itself is not loaded',
        {pending: true, lookups: [{reason: 'lookup', values: ['A-f-c-1']}], trees: 0, display: 'Lemon', item: {id: 'A-f-c-1', name: 'Lemon', isLeaf: true}},
        async () => {
            server().reset();
            apply(s => { s.m.reset = 'A-f-c-1'; });
            const pending = !!host('t-reset').querySelector('.aui-select__display-text .aui-select__pending');
            await sleep(150);
            const item = angular.copy(ctrl('t-reset').selectedItems[0]);
            return {pending, lookups: calls('reset', 'lookup').map(c => ({reason: c.reason, values: c.values})), trees: calls('reset', 'tree').length,
                display: display('t-reset'), item};
        });

    T('D7 lookup-options: values set together go in one request; tags from the chains; their ancestors show half checked',
        {lookups: 1, values: ['A-f-c-1', 'A-f-b-2'], tags: ['Lemon', 'Blueberry'], fruit: 'mixed'},
        async () => {
            server().reset();
            apply(s => { s.m.multi = ['A-f-c-1', 'A-f-b-2']; });
            await sleep(150);
            const r = {lookups: calls('multi', 'lookup').length, values: calls('multi', 'lookup')[0].values, tags: tags('t-multi')};
            await open('t-multi');
            await sleep(200);
            r.fruit = rowEl('t-multi', 'Fruit').getAttribute('aria-checked');
            await close();
            return r;
        });

    T('D8 value-options: the label the page passes, without any request',
        {display: 'From the record', calls: 0},
        async () => {
            server().reset();
            apply(s => { s.m.vo = 'X-1'; });
            await sleep(100);
            return {display: display('t-vo'), calls: calls('vo').length};
        });

    // ------------------------------------------------------------------ lazy trees with params
    T('D9 lazy tree: $params reach load-children; a params change drops the loaded children and reloads on open',
        {rootsA: ['Fruit', 'Vegetables', 'Spices'], first: {reason: 'roots', params: {room: 'A'}}, child: {reason: 'children', params: {room: 'A'}},
            rootsB: ['Tools'], afterChange: {reason: 'roots', params: {room: 'B'}}},
        async () => {
            server().reset();
            await open('t-lazy');
            await sleep(150);
            const rootsA = top('t-lazy');
            caretOf('t-lazy', 'Fruit').click();
            await sleep(150);
            const [first, child] = calls('lazy', 'children');
            await close();
            apply(s => { s.p.lazy = 'B'; });
            await open('t-lazy');
            await sleep(150);
            const last = calls('lazy', 'children').slice(-1)[0];
            return {rootsA, first: {reason: first.reason, params: first.params}, child: {reason: child.reason, params: child.params},
                rootsB: top('t-lazy'), afterChange: {reason: last.reason, params: last.params}};
        });

    T('D10 remote-search receives $params',
        {search: {query: 'to', params: {room: 'B'}}, rows: ['Tools']},
        async () => {
            server().reset();
            type(searchBox('t-lazy'), 'to');
            await sleep(250);
            const c = calls('lazy', 'search')[0];
            const r = {search: c ? {query: c.query, params: c.params} : null, rows: labels('t-lazy')};
            await close();
            apply(s => { s.p.lazy = 'A'; });
            return r;
        });

    // ------------------------------------------------------------------ children in pages
    T('D11 children in pages: the next page loads by itself near the end, a "Load more" row after the loaded ones, the end removes it',
        {children: 20, moreRow: '[Load more (5 left)]', afterClick: 25, noMore: true, pages: [1, 2, 3], reasons: ['children', 'more', 'more']},
        async () => {
            server().reset();
            await open('t-lazy');
            await sleep(150);
            caretOf('t-lazy', 'Spices').click();
            await sleep(350);
            const rows = ctrl('t-lazy').rows;
            const children = rows.filter(r => !r.more && r.depth === 1).length;
            const more = rows.find(r => r.more);
            const moreRow = more ? rowText(more) : null;
            rowEl('t-lazy', 'Load more (5 left)').click();
            await sleep(200);
            const after = ctrl('t-lazy').rows;
            const spiceCalls = calls('lazy', 'children').filter(c => c.reason !== 'roots');
            const r = {children, moreRow, afterClick: after.filter(r => !r.more && r.depth === 1).length, noMore: !after.some(r => r.more),
                pages: spiceCalls.map(c => c.page), reasons: spiceCalls.map(c => c.reason)};
            await close();
            return r;
        });

    T('D12 keyboard on a failed "Load more" row (it never loads by itself): ArrowLeft goes to its node, Enter retries',
        {onError: "[Couldn't load more. Retry]", left: 'Spices', children: 20, moreRow: '[Load more (5 left)]'},
        async () => {
            server().reset();
            await open('t-multi');
            await sleep(150);
            caretOf('t-multi', 'Spices').click();
            await sleep(20);
            server().failNext = 1;   // page 1 is on its way; page 2 (loaded by itself) fails
            await sleep(300);
            const c = ctrl('t-multi');
            const box = searchBox('t-multi') || trig('t-multi');
            const toMoreRow = async () => {
                for (let i = 0; i < 40 && !(activeLabel('t-multi') || '').startsWith('[Couldn'); i += 1) {
                    key(box, 'ArrowDown');
                    await sleep(15);
                }
            };
            await toMoreRow();
            const onError = activeLabel('t-multi');
            key(box, 'ArrowLeft');
            await sleep(30);
            const left = activeLabel('t-multi');
            await toMoreRow();
            key(box, 'Enter');
            await sleep(400);
            const more = c.rows.find(row => row.more);
            // Page 2 came by Enter; the next "Load more" row is below the visible area, so it waits for scrolling.
            const r = {onError, left, children: c.rows.filter(row => !row.more && row.depth === 1 && row.node.parent && row.node.parent.label === 'Spices').length,
                moreRow: more ? rowText(more) : null};
            await close();
            return r;
        });

    T('D13 a server that ignores the page: paging stops after page 2, with a warning (no loop)',
        {pages: [1, 2], noMore: true, warned: true},
        async () => {
            server().reset();
            server().repeatPage = true;
            await open('t-reveal');
            await sleep(150);
            caretOf('t-reveal', 'Spices').click();
            await sleep(400);
            const r = {pages: calls('reveal', 'children').filter(c => c.reason !== 'roots').map(c => c.page),
                noMore: !ctrl('t-reveal').rows.some(row => row.more), warned: warnedAbout('a page of children brought only nodes')};
            await close();
            server().repeatPage = false;
            return r;
        });

    // ------------------------------------------------------------------ reveal, reset, failures, lifecycle
    T('D14 reveal-selected: opening loads the branches down to a looked-up value; it is the active, selected row',
        {display: 'Fruit / Citrus / Lime', rows: ['Fruit', '  Citrus', '    Lemon', '    Orange', '    Lime'], selected: 'true', active: 'Lime', loads: 2},
        async () => {
            server().reset();
            apply(s => { s.m.reveal = 'A-f-c-3'; });
            await sleep(150);
            const shown = display('t-reveal');
            server().calls = [];
            await open('t-reveal');
            await sleep(450);
            const r = {display: shown, rows: labels('t-reveal').filter(l => /Fruit|Citrus|Lemon|Orange|Lime/.test(l)),
                selected: rowEl('t-reveal', 'Lime') ? rowEl('t-reveal', 'Lime').getAttribute('aria-selected') : null,
                active: activeLabel('t-reveal'),
                loads: calls('reveal', 'children').filter(c => c.reason === 'children').length};
            await close();
            return r;
        });

    T('D15 reset-on-params="clear": cleared when the params change under the value; kept when both change together',
        {cleared: '', lookups: 0, kept: 'A-f-c-2'},
        async () => {
            // A value known from the loaded tree (no lookup so far), as when a record was picked in the tree.
            await open('t-reset');
            await sleep(150);
            apply(s => { s.m.reset = 'A-f-b-1'; });
            await close();
            server().reset();
            apply(s => { s.p.reset = 'B'; });
            await sleep(120);
            const cleared = scope().m.reset;
            const lookups = calls('reset', 'lookup').length;   // the cleared value is not looked up for the new params
            apply(s => { s.p.reset = 'A'; s.m.reset = 'A-f-c-2'; });
            await sleep(60);
            return {cleared, lookups, kept: scope().m.reset};
        });

    T('D15b reset-on-params with load-enabled: emptying the field the params come from clears; a pause, or params filled in while off, keep',
        {paused: 'A-f-c-2', resumed: 'A-f-c-2', emptied: '', staged: 'B-f-a-1'},
        async () => {
            apply(s => { s.p.reset = 'A'; s.m.reset = 'A-f-c-2'; });
            await sleep(60);
            apply(s => { s.p.resetPaused = true; });       // loading off, the same params
            await sleep(60);
            const paused = scope().m.reset;
            apply(s => { s.p.resetPaused = false; });
            await sleep(60);
            const resumed = scope().m.reset;
            apply(s => { s.p.reset = null; });             // the field the params come from emptied: loading off with it
            await sleep(60);
            const emptied = scope().m.reset;
            apply(s => { s.m.reset = 'B-f-a-1'; });        // a record filled in steps: its value while loading is off,
            await sleep(60);
            apply(s => { s.p.reset = 'B'; });              // the field it depends on later
            await sleep(60);
            const staged = scope().m.reset;
            apply(s => { s.p.reset = 'A'; s.m.reset = 'A-f-c-2'; });
            await sleep(60);
            return {paused, resumed, emptied, staged};
        });

    T('D16 load-timeout: no answer in time shows "The server did not answer. Retry" (request aborted); Retry loads it',
        {status: 'The server did not answer. Retry', cancelled: true, aborted: true, roots: ['Fruit', 'Vegetables', 'Spices']},
        async () => {
            server().reset();
            server().delay = 800;
            await open('t-timeout');
            await sleep(450);
            const status = statusText('t-timeout');
            const c = calls('timeout')[0];
            server().delay = 40;
            host('t-timeout').querySelector('.aui-tree-select__retry').click();
            await sleep(200);
            const r = {status, cancelled: c.cancelled, aborted: c.aborted, roots: top('t-timeout')};
            await close();
            return r;
        });

    T('D17 destroyed while loading: every request is cancelled, a late answer changes nothing',
        {cancelled: true, aborted: true, errors: 0, gone: true},
        async () => {
            const errors = errCount();
            server().reset();
            server().delay = 300;
            await open('t-destroy');
            await sleep(50);
            apply(s => { s.m.destroy = 'A-v-l-1'; });
            apply(s => { s.show.destroyable = false; });
            await sleep(450);
            const all = calls('destroy');
            server().delay = 40;
            return {cancelled: all.length > 0 && all.every(c => c.cancelled), aborted: all.length > 0 && all.every(c => c.aborted),
                errors: errCount() - errors, gone: !host('t-destroy')};
        });

    // ------------------------------------------------------------------ review round
    T('D19 search results: a match whose children come in pages gets "Load more" rows too',
        {children: 20, moreRow: '[Load more (5 left)]', afterClick: 25},
        async () => {
            // a fresh data set (D11 loaded every Spice): a params change drops what was loaded
            apply(s => { s.p.lazy = 'B'; });
            apply(s => { s.p.lazy = 'A'; });
            server().reset();
            await open('t-lazy');
            await sleep(150);
            type(searchBox('t-lazy'), 'spi');
            await sleep(300);
            caretOf('t-lazy', 'Spices').click();
            await sleep(400);   // page 1, and page 2 by itself (its row is in view)
            const kids = () => ctrl('t-lazy').rows.filter(r => !r.more && r.depth === 1).length;
            const more = ctrl('t-lazy').rows.find(r => r.more);
            const r = {children: kids(), moreRow: more ? rowText(more) : null};
            if (more) rowEl('t-lazy', more.segs[0].text).click();
            await sleep(200);
            r.afterClick = kids();
            await close();
            return r;
        });

    T('D20 the top level in pages: "Load more" after the loaded roots, by itself near the end, by click after',
        {roots: 20, moreRow: '[Load more (5 left)]', afterClick: 25, noMore: true},
        async () => {
            server().reset();
            await open('t-roots');
            await sleep(400);
            const more = ctrl('t-roots').rows.find(r => r.more);
            const r = {roots: top('t-roots').length, moreRow: more ? rowText(more) : null};
            if (more) rowEl('t-roots', more.segs[0].text).click();
            await sleep(200);
            r.afterClick = top('t-roots').length;
            r.noMore = !ctrl('t-roots').rows.some(row => row.more);
            await close();
            return r;
        });

    T('D21 lookup-group: the values of every row go out in one request; each row shows its path',
        {lookups: 1, values: ['A-f-c-1', 'A-v-l-2', 'A-s-7'], labels: ['Fruit / Citrus / Lemon', 'Vegetables / Leafy / Spinach', 'Spices / Spice 07']},
        async () => {
            server().reset();
            apply(s => { s.treeRows = [{id: 1, value: 'A-f-c-1'}, {id: 2, value: 'A-v-l-2'}, {id: 3, value: 'A-s-7'}]; });
            await sleep(250);
            const all = calls('tg', 'lookup');
            return {lookups: all.length, values: all.length ? all[0].values : null,
                labels: Array.from(document.querySelectorAll('#t-group .aui-select__display-text')).map(el => el.textContent.trim())};
        });

    T('D22 a lazy top level that does not answer in time: "The server did not answer. Retry"',
        {status: 'The server did not answer. Retry', aborted: true, roots: ['Fruit', 'Vegetables', 'Spices']},
        async () => {
            server().reset();
            server().delay = 800;
            await open('t-lazytimeout');
            await sleep(450);
            const status = statusText('t-lazytimeout');
            const c = calls('lt', 'children')[0];
            server().delay = 40;
            host('t-lazytimeout').querySelector('.aui-tree-select__retry').click();
            await sleep(200);
            const r = {status, aborted: !!c && c.aborted, roots: top('t-lazytimeout')};
            await close();
            return r;
        });

    T('D23 reveal-selected also when the lookup answers after the panel opened',
        {active: 'Spinach', selected: 'true'},
        async () => {
            server().reset();
            server().delay = 250;
            apply(s => { s.m.reveal = 'A-v-l-2'; });
            await open('t-reveal');   // the lookup is still on its way
            await sleep(1400);
            server().delay = 40;
            const li = rowEl('t-reveal', 'Spinach');
            const r = {active: activeLabel('t-reveal'), selected: li ? li.getAttribute('aria-selected') : null};
            await close();
            return r;
        });

    T('D24 remote-search with load-timeout: no answer in time is "Search failed. Retry" (request aborted); Retry works',
        {status: 'Search failed. Retry', cancelled: true, aborted: true, rows: ['Vegetables']},
        async () => {
            server().reset();
            server().delay = 900;
            await open('t-lazy');
            await sleep(80);   // roots are on their way too: wait for them below
            await sleep(1000);
            server().calls = [];
            type(searchBox('t-lazy'), 'veg');
            await sleep(750);   // 80 ms delay + 500 ms timeout
            const status = statusText('t-lazy');
            const c = calls('lazy', 'search')[0];
            server().delay = 40;
            host('t-lazy').querySelector('.aui-tree-select__retry').click();
            await sleep(250);
            const r = {status, cancelled: !!c && c.cancelled, aborted: !!c && c.aborted, rows: top('t-lazy')};
            await close();
            return r;
        });

    T('D25 the choice on opening, the data arriving after it (load-options): single opens the branches down to the value, the keyboard on it; the second opening the same',
        {first: {rows: ['Fruit', '  Citrus', '    Lemon', '    Orange', '    Lime', '  Berries', 'Vegetables', 'Spices'], active: 'Orange', inView: true},
         second: {active: 'Orange', inView: true}},
        async () => {
            const read = () => {
                const li = rowEl('t-ch1', 'Orange');
                const list = host('t-ch1').querySelector('.aui-tree-select__tree');
                const inView = !!li && li.getBoundingClientRect().top >= list.getBoundingClientRect().top - 1
                    && li.getBoundingClientRect().bottom <= list.getBoundingClientRect().bottom + 1;
                return {rows: labels('t-ch1'), active: activeLabel('t-ch1'), inView};
            };
            await open('t-ch1');
            await sleep(400);
            const first = read();
            await close();
            await open('t-ch1');
            await sleep(300);
            const second = read();
            delete second.rows;
            await close();
            return {first, second};
        });

    T('D26 multiple (linked) on opening: the branches holding checked items open, a fully checked branch stays folded, the keyboard on the first checked row',
        {rows: ['Fruit', '  Citrus', '  Berries', 'Vegetables', '  Leafy', '    Lettuce', '    Spinach', 'Spices'], citrus: 'true', fruit: 'mixed', active: 'Citrus'},
        async () => {
            await open('t-ch2');
            await sleep(400);
            const c = ctrl('t-ch2');
            const of = label => c.rows.find(r => r.node.label === label).ariaChecked;
            const r = {rows: labels('t-ch2'), citrus: of('Citrus'), fruit: of('Fruit'), active: activeLabel('t-ch2')};
            await close();
            return r;
        });

    T('D27 branches opened by hand stay open on the next opening; after the page sets another value they close, the new value\'s branches open',
        {kept: true, afterNewValue: {spices: false, citrus: false, leafy: true, active: 'Spinach'}},
        async () => {
            await open('t-ch1');
            await sleep(300);
            caretOf('t-ch1', 'Spices').click();
            await sleep(100);
            await close();
            await open('t-ch1');
            await sleep(200);
            const kept = !!rowEl('t-ch1', 'Spice 01');
            await close();
            apply(s => { s.m.ch1 = 'A-v-l-2'; });
            await sleep(50);
            await open('t-ch1');
            await sleep(300);
            const afterNewValue = {spices: !!rowEl('t-ch1', 'Spice 01'), citrus: !!rowEl('t-ch1', 'Lemon'), leafy: !!rowEl('t-ch1', 'Spinach'),
                active: activeLabel('t-ch1')};
            await close();
            return {kept, afterNewValue};
        });

    T('D18 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: errCount()}));

    AuiTest.run('aui-tree-select: remote data', tests);
})();
