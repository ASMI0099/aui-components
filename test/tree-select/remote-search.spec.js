// aui-tree-select remote-search suite (page: remote-search.html, fixture: remote-search.fixture.js): server-side
// search with remote-search="fn($query, $signal, $cancel)" against the fixture's mock server.
(function () {
    const {sleep, type, key, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-tree-select');
    const ctrl = id => angular.element(host(id)).controller('auiTreeSelect');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const searchBox = id => host(id).querySelector('.aui-select__search-input');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const server = () => scope().server;
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const labels = id => ctrl(id).rows.map(r => '  '.repeat(r.depth) + r.node.label);
    const rowEl = (id, label) => Array.prototype.slice.call(host(id).querySelectorAll('li.aui-tree-select__node'))
        .find(li => li.querySelector('.aui-tree-select__label').textContent.trim() === label);
    const caretOf = (id, label) => rowEl(id, label).querySelector('.aui-tree-select__caret');
    const checkedOf = (id, label) => rowEl(id, label).getAttribute('aria-checked');
    const tagTexts = id => Array.prototype.slice.call(host(id).querySelectorAll('.aui-select__tag')).map(t => t.textContent.trim());
    const display = id => {
        const el = host(id).querySelector('.aui-select__display-text');
        return el ? el.textContent.trim() : null;
    };
    const statusRow = (id, cls) => {
        const el = host(id).querySelector('.' + cls);
        return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
    };
    /** The panel's status rows: searching, error, "more" note, no results. */
    const status = id => ({
        searching: statusRow(id, 'aui-tree-select__searching'),
        error: statusRow(id, 'aui-tree-select__retry'),
        more: statusRow(id, 'aui-tree-select__more'),
        empty: host(id).querySelector('.aui-select__no-results:not(.aui-tree-select__searching):not(.aui-tree-select__retry)')
            ? host(id).querySelector('.aui-select__no-results:not(.aui-tree-select__searching):not(.aui-tree-select__retry)').textContent.trim() : null
    });
    const calls = () => server().calls.map(c => c.query);
    async function open(id) { trig(id).click(); await sleep(250); }
    async function close() { outside(); await sleep(350); }
    async function search(id, text, wait) {
        type(searchBox(id), text);
        await sleep(wait === undefined ? 400 : wait);
    }
    const errCount = () => window.__ngErrors.length;

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    // ------------------------------------------------------------------ timing and the requests
    T('R1 typing waits for a pause (search-delay), then sends one request with the last query',
        {searchBox: true, early: 0, calls: ['lem'], rows: ['Fruit', '  Citrus', '    Lemon', 'Lemon Grass']},
        async () => {
            server().reset();
            await open('r-single');
            const box = !!searchBox('r-single');
            type(searchBox('r-single'), 'l'); await sleep(40);
            type(searchBox('r-single'), 'le'); await sleep(40);
            type(searchBox('r-single'), 'lem'); await sleep(60);
            const early = server().calls.length;
            await sleep(400);
            const r = {searchBox: box, early, calls: calls(), rows: labels('r-single')};
            await close();
            return r;
        });

    T('R2 while the first answer is pending: "Searching..." row, spinner in the search box, aria-busy; then the results',
        {pending: {searching: 'Searching...', busy: true, ariaBusy: 'true', rows: 0},
            done: {searching: null, busy: false, ariaBusy: 'false', rows: ['Fruit', '  Citrus', '    Lemon', 'Lemon Grass']}},
        async () => {
            server().reset();
            server().delay = 300;
            await open('r-single');
            await search('r-single', 'lemon', 200);
            const snapshot = () => ({
                searching: status('r-single').searching,
                busy: !!host('r-single').querySelector('.aui-select__search--busy .aui-select__search-spinner'),
                ariaBusy: host('r-single').querySelector('.aui-tree-select__tree').getAttribute('aria-busy')
            });
            const pending = Object.assign(snapshot(), {rows: ctrl('r-single').rows.length});
            await sleep(400);
            const done = Object.assign(snapshot(), {rows: labels('r-single')});
            await close();
            return {pending, done};
        });

    T('R3 a new query cancels the running request ($cancel resolved, $signal aborted) and shows only its own results',
        {calls: ['lem', 'berr'], first: {cancelled: true, aborted: true}, second: {cancelled: false, aborted: false},
            rows: ['Fruit', '  Berries', '    Strawberry', '    Blueberry']},
        async () => {
            server().reset();
            server().delay = 300;
            await open('r-single');
            await search('r-single', 'lem', 200);
            await search('r-single', 'berr', 600);
            const [a, b] = server().calls;
            const r = {calls: calls(), first: {cancelled: a.cancelled, aborted: a.aborted}, second: {cancelled: b.cancelled, aborted: b.aborted},
                rows: labels('r-single')};
            await close();
            return r;
        });

    T('R4 a stale answer arriving after a newer one is dropped, even from a server that ignores the cancel',
        {afterNew: ['Fruit', '  Berries', '    Strawberry', '    Blueberry'], afterStale: ['Fruit', '  Berries', '    Strawberry', '    Blueberry'],
            staleSettled: true},
        async () => {
            server().reset();
            server().ignoreCancel = true;
            server().delays = [500, 50];
            await open('r-single');
            await search('r-single', 'lem', 150);
            await search('r-single', 'berr', 250);
            const afterNew = labels('r-single');
            await sleep(450);
            const r = {afterNew, afterStale: labels('r-single'), staleSettled: server().calls[0].settled};
            await close();
            return r;
        });

    T('R5 the query is sent as typed: outer spaces send no new request, a case change does',
        {calls: ['lemon', 'LEMON']},
        async () => {
            server().reset();
            await open('r-single');
            await search('r-single', 'lemon');
            await search('r-single', 'lemon ');
            await search('r-single', 'LEMON');
            const r = {calls: calls()};
            await close();
            return r;
        });

    // ------------------------------------------------------------------ panel states
    T('R6 a failed search shows "Search failed. Retry"; Retry asks again and shows the results',
        {failed: {searching: null, error: 'Search failed. Retry', more: null, empty: null}, rowsFailed: 0,
            retried: ['Fruit', '  Citrus', '    Lime'], calls: ['lime', 'lime'], errors: 0},
        async () => {
            const errors = errCount();
            server().reset();
            server().failNext = 1;
            await open('r-single');
            await search('r-single', 'lime');
            const failed = status('r-single');
            const rowsFailed = ctrl('r-single').rows.length;
            host('r-single').querySelector('.aui-tree-select__retry').click();
            await sleep(400);
            const r = {failed, rowsFailed, retried: labels('r-single'), calls: calls(), errors: errCount() - errors};
            await close();
            return r;
        });

    T('R7 the server found more than it returned: the rows it sent and "Showing 2 of 11 matches"',
        {rows: ['Fruit', '  Citrus', '    Lemon', '    Orange'], more: 'Showing 2 of 11 matches. Type more to narrow the search.'},
        async () => {
            server().reset();
            await open('r-limit');
            await search('r-limit', 'e');
            const r = {rows: labels('r-limit'), more: status('r-limit').more};
            await close();
            return r;
        });

    T('R8 no match: "No results found" only',
        {status: {searching: null, error: null, more: null, empty: 'No results found'}, rows: 0},
        async () => {
            server().reset();
            await open('r-single');
            await search('r-single', 'zzz');
            const r = {status: status('r-single'), rows: ctrl('r-single').rows.length};
            await close();
            return r;
        });

    T('R9 clearing the query cancels the running request and shows the tree at once',
        {cancelled: true, aborted: true, status: {searching: null, error: null, more: null, empty: null},
            rows: ['Fruit', 'Vegetables', 'Lemon Grass']},
        async () => {
            server().reset();
            server().delay = 300;
            await open('r-single');
            await search('r-single', 'carrot', 200);
            await search('r-single', '', 50);
            const call = server().calls[0];
            const r = {cancelled: call.cancelled, aborted: call.aborted, status: status('r-single'), rows: labels('r-single')};
            await sleep(300);
            await close();
            return r;
        });

    T('R10 closing the panel while a search runs cancels it; a late answer is ignored; reopening shows the tree',
        {cancelled: true, aborted: true, lateAnswer: true, query: '', rows: ['Fruit', 'Vegetables', 'Lemon Grass'], errors: 0},
        async () => {
            const errors = errCount();
            server().reset();
            server().delay = 300;
            server().ignoreCancel = true;   // the answer still arrives, during the fade-out
            await open('r-single');
            await search('r-single', 'spin', 200);
            await close();
            await sleep(300);
            await open('r-single');
            const call = server().calls[0];
            const r = {cancelled: call.cancelled, aborted: call.aborted, lateAnswer: call.settled, query: searchBox('r-single').value,
                rows: labels('r-single'), errors: errCount() - errors};
            await close();
            return r;
        });

    // ------------------------------------------------------------------ picking from the results (single)
    T('R11 single: picking a value the tree has not loaded; the trigger shows its path, selected-items its data',
        {model: 'f-c-1', open: false, display: 'Fruit / Citrus / Lemon', items: [{id: 'f-c-1', name: 'Lemon', isLeaf: true}],
            reopened: ['Fruit', 'Vegetables', 'Lemon Grass'], displayAfter: 'Fruit / Citrus / Lemon'},
        async () => {
            server().reset();
            await open('r-single');
            await search('r-single', 'lemon');
            rowEl('r-single', 'Lemon').click();
            await sleep(350);
            const s = scope();
            const r = {model: s.m.single, open: ctrl('r-single').isOpen, display: display('r-single'), items: angular.copy(s.m.singleItems)};
            await open('r-single');
            r.reopened = labels('r-single');
            r.displayAfter = display('r-single');
            await close();
            return r;
        });

    T('R12 single: once its branch loads, the picked value is the selected row of the tree',
        {selected: 'true', display: 'Fruit / Citrus / Lemon', model: 'f-c-1'},
        async () => {
            await open('r-single');
            caretOf('r-single', 'Fruit').click(); await sleep(150);
            caretOf('r-single', 'Citrus').click(); await sleep(150);
            const r = {selected: rowEl('r-single', 'Lemon').getAttribute('aria-selected'), display: display('r-single'), model: scope().m.single};
            await close();
            return r;
        });

    T('R13 expanding a match that has no children in the result loads them (load-children)',
        {before: ['Vegetables', '  Leafy'], after: ['Vegetables', '  Leafy', '    Lettuce', '    Spinach'], lazyCalls: ['v-l']},
        async () => {
            server().reset();
            await open('r-single');
            await search('r-single', 'leafy');
            const before = labels('r-single');
            caretOf('r-single', 'Leafy').click();
            await sleep(200);
            const r = {before, after: labels('r-single'), lazyCalls: server().lazyCalls.slice()};
            await close();
            return r;
        });

    T('R14 keyboard: ArrowDown to a result and Enter selects it',
        {active: 'Lime', model: 'f-c-3', open: false, display: 'Fruit / Citrus / Lime'},
        async () => {
            server().reset();
            await open('r-single');
            await search('r-single', 'lime');
            const c = ctrl('r-single');
            const activeLabel = () => { const row = c.rows.find(x => x.sid === c.activeSid); return row ? row.node.label : null; };
            for (let i = 0; i < 6 && activeLabel() !== 'Lime'; i += 1) {
                key(searchBox('r-single'), 'ArrowDown');
                await sleep(30);
            }
            const active = activeLabel();
            key(searchBox('r-single'), 'Enter');
            await sleep(350);
            return {active, model: scope().m.single, open: c.isOpen, display: display('r-single')};
        });

    // ------------------------------------------------------------------ picking from the results (multiple)
    T('R15 multiple: checking an unloaded result keeps the panel open; its ancestors in the result show half checked',
        {model: ['f-b-1'], tags: ['Strawberry'], open: true, strawberry: 'true', berries: 'mixed', fruit: 'mixed'},
        async () => {
            server().reset();
            await open('r-multi');
            await search('r-multi', 'berr');
            rowEl('r-multi', 'Strawberry').click();
            await sleep(100);
            return {model: scope().m.multi.slice(), tags: tagTexts('r-multi'), open: ctrl('r-multi').isOpen,
                strawberry: checkedOf('r-multi', 'Strawberry'), berries: checkedOf('r-multi', 'Berries'), fruit: checkedOf('r-multi', 'Fruit')};
        });

    T('R16 multiple: after clearing the query the value keeps its tag and data, and its loaded ancestor shows half checked',
        {rows: ['Fruit', 'Vegetables', 'Lemon Grass'], fruit: 'mixed', tags: ['Strawberry'], items: [{id: 'f-b-1', name: 'Strawberry', isLeaf: true}]},
        async () => {
            await search('r-multi', '', 100);
            const r = {rows: labels('r-multi'), fruit: checkedOf('r-multi', 'Fruit'), tags: tagTexts('r-multi'), items: angular.copy(scope().m.multiItems)};
            return r;
        });

    T('R17 multiple: unchecking the value in a later search removes it',
        {before: 'true', model: [], tags: []},
        async () => {
            await search('r-multi', 'straw');
            const before = checkedOf('r-multi', 'Strawberry');
            rowEl('r-multi', 'Strawberry').click();
            await sleep(100);
            const r = {before, model: scope().m.multi.slice(), tags: tagTexts('r-multi')};
            await close();
            return r;
        });

    // ------------------------------------------------------------------ lifecycle
    T('R18 destroyed while a search runs: the request is cancelled and its answer changes nothing',
        {cancelled: true, aborted: true, gone: true, errors: 0},
        async () => {
            const errors = errCount();
            server().reset();
            server().delay = 300;
            await open('r-destroy');
            await search('r-destroy', 'lem', 200);
            apply(s => { s.showDestroyable = false; });
            await sleep(500);
            const call = server().calls[0];
            return {cancelled: call.cancelled, aborted: call.aborted, gone: !host('r-destroy'), errors: errCount() - errors};
        });

    // ------------------------------------------------------------------ linked checks in search results (tree rules)
    const model = () => scope().m.multi.slice();
    T('R19 results: a child checked through its checked parent can be unchecked; the parent becomes half, the siblings stay',
        {afterCheck: ['f-c', 'f-c-1', 'f-c-2', 'f-c-3'], afterUncheck: ['f-c-2', 'f-c-3'], citrus: 'mixed', lemon: 'false', orange: 'true', fruit: 'mixed'},
        async () => {
            apply(s => { s.m.multi = []; });
            server().reset();
            await open('r-multi');
            await search('r-multi', 'citrus');
            caretOf('r-multi', 'Citrus').click();   // its children load (complete)
            await sleep(200);
            rowEl('r-multi', 'Citrus').click();
            await sleep(60);
            const afterCheck = model();
            rowEl('r-multi', 'Lemon').click();
            await sleep(60);
            return {afterCheck, afterUncheck: model(), citrus: checkedOf('r-multi', 'Citrus'), lemon: checkedOf('r-multi', 'Lemon'),
                orange: checkedOf('r-multi', 'Orange'), fruit: checkedOf('r-multi', 'Fruit')};
        });

    T('R20 results: checking the last unchecked child checks the parent (value-strategy all: parent and children)',
        {model: ['f-c', 'f-c-1', 'f-c-2', 'f-c-3'], citrus: 'true'},
        async () => {
            rowEl('r-multi', 'Lemon').click();
            await sleep(60);
            return {model: model(), citrus: checkedOf('r-multi', 'Citrus')};
        });

    T('R21 results: unchecking the parent removes its children; a checked parent takes over children picked one by one',
        {none: [], two: ['f-c-1', 'f-c-2'], parent: ['f-c', 'f-c-1', 'f-c-2', 'f-c-3'], again: []},
        async () => {
            rowEl('r-multi', 'Citrus').click();
            await sleep(60);
            const none = model();
            rowEl('r-multi', 'Lemon').click();
            await sleep(40);
            rowEl('r-multi', 'Orange').click();
            await sleep(40);
            const two = model();
            rowEl('r-multi', 'Citrus').click();
            await sleep(60);
            const parent = model();
            rowEl('r-multi', 'Citrus').click();
            await sleep(60);
            const r = {none, two, parent, again: model()};
            await close();
            return r;
        });

    T('R22 results: unchecking under a checked ancestor whose children are not all known loads that level first, then keeps every sibling',
        {inherited: 'true', lazyCalls: ['f'], model: ['f-c-2', 'f-c-3', 'f-b'], fruit: 'mixed', lemon: 'false'},
        async () => {
            apply(s => { s.m.multi = []; });
            server().reset();
            await open('r-multi');
            await search('r-multi', 'lemon');
            rowEl('r-multi', 'Fruit').click();   // the whole Fruit category; the result shows only the branch to Lemon
            await sleep(60);
            const inherited = checkedOf('r-multi', 'Lemon');
            rowEl('r-multi', 'Lemon').click();
            await sleep(300);
            const r = {inherited, lazyCalls: server().lazyCalls.filter(id => id !== 'root'), model: model(),
                fruit: checkedOf('r-multi', 'Fruit'), lemon: checkedOf('r-multi', 'Lemon')};
            await close();
            return r;
        });

    /** In the results for "citrus": open Citrus (its children load), check it, uncheck Lemon, check Lemon again. */
    async function strategySteps(id, prop) {
        apply(s => { s.m[prop] = []; });
        await open(id);
        await search(id, 'citrus');
        caretOf(id, 'Citrus').click();
        await sleep(200);
        const value = () => (scope().m[prop] || []).slice();
        rowEl(id, 'Citrus').click();
        await sleep(60);
        const parent = value();
        rowEl(id, 'Lemon').click();
        await sleep(60);
        const withoutLemon = value();
        rowEl(id, 'Lemon').click();
        await sleep(60);
        const again = value();
        await close();
        return {parent, withoutLemon, again};
    }

    T('R23 results with value-strategy="parent": a fully checked parent is the value, its children are not',
        {parent: ['f-c'], withoutLemon: ['f-c-2', 'f-c-3'], again: ['f-c']},
        () => strategySteps('r-parent', 'parent'));

    T('R24 results with value-strategy="child": only the leaves are the value',
        {parent: ['f-c-1', 'f-c-2', 'f-c-3'], withoutLemon: ['f-c-2', 'f-c-3'], again: ['f-c-1', 'f-c-2', 'f-c-3']},
        () => strategySteps('r-child', 'child'));

    AuiTest.run('aui-tree-select: remote search', tests);
})();
