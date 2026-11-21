// aui-select remote suite (page: remote.html, fixture: remote.fixture.js): options from a server through
// load-options, page by page or all at once, server search, lookups of saved values, against the mock server.
(function () {
    const {sleep, until, type, key, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select');
    const ctrl = id => angular.element(host(id)).controller('auiSelect');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const listEl = id => host(id).querySelector('ul.aui-select__options');
    const searchBox = id => host(id).querySelector('.aui-select__search-input');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const server = () => scope().server;
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const labels = id => ctrl(id).rows.map(r => String(r.item.name));
    const calls = (tag, log) => server().of(tag, log);
    const loads = tag => calls(tag).filter(c => c.reason !== 'lookup');
    const lookups = tag => calls(tag).filter(c => c.reason === 'lookup');
    const brief = c => ({reason: c.reason, query: c.query, page: c.page});
    const display = id => {
        const el = host(id).querySelector('.aui-select__display-text');
        return el ? el.textContent.trim() : null;
    };
    const tags = id => Array.from(host(id).querySelectorAll('.aui-select__selected-display > .aui-select__tags > .aui-select__tag:not(.aui-select__tag--count)'))
        .map(t => t.textContent.trim());
    const statusText = id => {
        const el = listEl(id);
        if (!el) return null;
        return Array.from(el.querySelectorAll('.aui-select__status, .aui-select__no-results')).map(li => li.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
    };
    const domRow = (id, text) => Array.from(host(id).querySelectorAll('li.aui-select__option')).find(li => li.textContent.trim() === text);
    const skeletons = id => host(id).querySelectorAll('li.aui-select__skeleton').length;
    const warnedAbout = text => window.__warnings.some(w => w.indexOf(text) !== -1);
    const errCount = () => window.__ngErrors.length;
    async function open(id) { trig(id).click(); await sleep(30); }
    async function close() { outside(); await sleep(400); }
    async function scrollEnd(id, wait) {
        const el = listEl(id);
        el.scrollTop = el.scrollHeight;
        el.dispatchEvent(new Event('scroll'));
        await sleep(wait === undefined ? 150 : wait);
    }
    async function search(id, text, wait) {
        type(searchBox(id), text);
        await sleep(wait === undefined ? 300 : wait);
    }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    // ------------------------------------------------------------------ pages
    T('R1 opening loads page 1 (placeholder rows meanwhile); the request carries everything the function needs',
        {skeleton: 4, busy: 'true', rows: 20, first: 'Product A-0001', last: 'Product A-0020', calls: 1, setsize: '-1',
            request: {reason: 'open', query: '', page: 1, pageSize: 20, offset: 0, values: null, params: {brand: 'A', tag: 'single'}, hasSignal: true, hasCancel: true}},
        async () => {
            server().reset();
            // an answer well after the look of the meantime is read, however slow the machine is (40 ms was outrun)
            server().delay = 600;
            await open('s-single');
            await until(() => skeletons('s-single') > 0, 500);
            const skeleton = skeletons('s-single');
            const busy = listEl('s-single').getAttribute('aria-busy');
            await until(() => labels('s-single').length === 20 && !!domRow('s-single', 'Product A-0001'), 3000);
            server().delay = 40;
            const c = loads('single')[0];
            return {skeleton, busy, rows: labels('s-single').length, first: labels('s-single')[0], last: labels('s-single')[19], calls: loads('single').length,
                setsize: domRow('s-single', 'Product A-0001').getAttribute('aria-setsize'),
                request: {reason: c.reason, query: c.query, page: c.page, pageSize: c.pageSize, offset: c.offset, values: c.values, params: c.params, hasSignal: c.hasSignal, hasCancel: c.hasCancel}};
        });

    T('R2 scrolling near the end loads the next page ("Loading more..." meanwhile)',
        {loadingRow: true, rows: 40, pages: [{reason: 'open', query: '', page: 1}, {reason: 'more', query: '', page: 2}], offset: 20},
        async () => {
            server().delay = 600;   // the answer well after the row is looked for, however slow the machine is
            await scrollEnd('s-single', 0);
            await until(() => loads('single').length === 2, 1500);   // the request for page 2 has gone out
            // the row shows while that request is still out
            const loadingRow = await until(() => /Loading more/.test(statusText('s-single')), 500) && !loads('single')[1].settled;
            await until(() => labels('s-single').length === 40, 3000);
            server().delay = 40;
            return {loadingRow, rows: labels('s-single').length, pages: loads('single').map(brief), offset: loads('single')[1].offset};
        });

    T('R3 one page request at a time, however often the list scrolls',
        {whileLoading: 1, outAtOnce: 1, rows: 60},
        async () => {
            server().delay = 600;   // page 3 stays out while the list is scrolled again
            await scrollEnd('s-single', 0);
            await until(() => loads('single').some(c => c.page === 3), 1500);
            await scrollEnd('s-single', 20);
            await scrollEnd('s-single', 20);
            const whileLoading = loads('single').filter(c => c.page === 3).length;
            const outAtOnce = loads('single').filter(c => !c.settled).length;
            await until(() => labels('s-single').length === 60, 3000);
            server().delay = 40;
            return {whileLoading, outAtOnce, rows: labels('s-single').length};
        });

    T('R4 a page shorter than the page size ends the list (228 active products: 12 pages)',
        {rows: 228, calls: 12, after: 12, setsize: null, moreRow: false},
        async () => {
            for (let i = 0; i < 15 && ctrl('s-single').view.more !== ''; i += 1) await scrollEnd('s-single', 120);
            const count = loads('single').length;
            await scrollEnd('s-single', 150);
            const row = domRow('s-single', labels('s-single')[labels('s-single').length - 1]);
            return {rows: labels('s-single').length, calls: count, after: loads('single').length,
                setsize: row ? row.getAttribute('aria-setsize') : 'no row', moreRow: /Loading more|load more/.test(statusText('s-single'))};
        });

    T('R5 pages are added by themselves until the panel is filled (page size 3; 32px rows, 33px apart: 18 rows fill the 300px list with room to scroll)',
        {pages: [1, 2, 3, 4, 5, 6], rows: 18},
        async () => {
            await close();
            server().reset();
            await open('s-small');
            await sleep(900);
            const r = {pages: loads('small').map(c => c.page), rows: labels('s-small').length};
            await close();
            return r;
        });

    // ------------------------------------------------------------------ server search
    T('R6 search: one request once typing pauses; the old rows stay (dimmed) until the new ones arrive; the search box spinner and the progress line show from the first keystroke until then',
        {openCalls: 0, callsWhileTyping: 0, staleWhileTyping: true, busyWhileTyping: true, request: {reason: 'search', query: 'A-012', page: 1},
            staleWhileLoading: true, busyWhileLoading: true, progress: true, rows: 10, first: 'Product A-0120', staleAfter: false, busyAfter: false,
            progressAfter: false},
        async () => {
            server().reset();
            server().delay = 200;
            await open('s-single');
            await sleep(100);
            const openCalls = loads('single').length;
            type(searchBox('s-single'), 'A'); await sleep(30);
            type(searchBox('s-single'), 'A-'); await sleep(30);
            type(searchBox('s-single'), 'A-012'); await sleep(40);
            const callsWhileTyping = loads('single').length;
            const staleWhileTyping = listEl('s-single').classList.contains('aui-select__options--stale');
            const busy = () => !!host('s-single').querySelector('.aui-select__search--busy .aui-select__search-spinner');
            const busyWhileTyping = busy();
            await sleep(110);
            const req = loads('single')[0];
            const staleWhileLoading = listEl('s-single').classList.contains('aui-select__options--stale');
            const busyWhileLoading = busy();
            const progress = !!host('s-single').querySelector('.aui-select__progress');
            await sleep(300);
            return {openCalls, callsWhileTyping, staleWhileTyping, busyWhileTyping, request: req ? brief(req) : null, staleWhileLoading,
                busyWhileLoading, progress, rows: labels('s-single').length, first: labels('s-single')[0],
                staleAfter: listEl('s-single').classList.contains('aui-select__options--stale'), busyAfter: busy(),
                progressAfter: !!host('s-single').querySelector('.aui-select__progress')};
        });

    T('R7 a new query cancels the running search ($cancel, $signal); a late answer of the old query is dropped',
        {first: {query: 'A-013', cancelled: true, aborted: true}, second: {query: 'A-014', cancelled: false}, rows: 10, firstRow: 'Product A-0140'},
        async () => {
            server().reset();
            server().delay = 300;
            server().ignoreCancel = true;
            await search('s-single', 'A-013', 150);
            await search('s-single', 'A-014', 150);
            await sleep(400);
            const [a, b] = loads('single');
            return {first: {query: a.query, cancelled: a.cancelled, aborted: a.aborted}, second: {query: b.query, cancelled: b.cancelled},
                rows: labels('s-single').length, firstRow: labels('s-single')[0]};
        });

    T('R8 the query is sent as typed: a case change is a new search, outer spaces are not',
        {queries: ['pro', 'PRO']},
        async () => {
            server().reset();
            await search('s-single', 'pro', 250);
            await search('s-single', 'PRO', 250);
            await search('s-single', 'PRO  ', 250);
            return {queries: loads('single').map(c => c.query)};
        });

    T('R9 the latest searches are kept while open (back to one: no request); clearing shows the plain list at once',
        {queries: ['A-015', 'A-016'], back: 'Product A-0150', plainFirst: 'Product A-0001', plainCalls: 2},
        async () => {
            server().reset();
            await search('s-single', 'A-015', 250);
            await search('s-single', 'A-016', 250);
            await search('s-single', 'A-015', 250);
            const back = labels('s-single')[0];
            await search('s-single', '', 30);
            return {queries: loads('single').map(c => c.query), back, plainFirst: labels('s-single')[0], plainCalls: loads('single').length};
        });

    T('R10 closing drops the searches: the same query asks the server again after a reopen',
        {queries: ['A-015']},
        async () => {
            await close();
            server().reset();
            await open('s-single');
            await search('s-single', 'A-015', 300);
            const r = {queries: loads('single').map(c => c.query)};
            await close();
            return r;
        });

    T('R11 reopening within the cache time shows the loaded pages at once, without a request',
        {calls: 0, rows: 228},
        async () => {
            server().reset();
            await open('s-single');
            await sleep(100);
            const r = {calls: loads('single').length, rows: labels('s-single').length};
            await close();
            return r;
        });

    T('R12 after cache-ttl the rows show at once and refresh in the background (replaced while untouched)',
        {instantRows: 20, refresh: [{reason: 'refresh', query: '', page: 1}], progress: true, firstAfter: 'Product A-0001 (new)'},
        async () => {
            server().reset();
            await open('s-ttl');
            await sleep(150);
            await close();
            await sleep(450);
            server().reset();
            server().suffix = ' (new)';
            server().delay = 150;
            await open('s-ttl');
            const instantRows = labels('s-ttl').length;
            await sleep(30);
            const progress = !!host('s-ttl').querySelector('.aui-select__progress');
            const refresh = loads('ttl').map(brief);
            await sleep(250);
            const r = {instantRows, refresh, progress, firstAfter: labels('s-ttl')[0]};
            await close();
            return r;
        });

    T('R13 a background refresh never moves rows the user is scrolling; they are swapped at the next open',
        {held: 'Product A-0001 (new)', calls: 1, afterReopen: 'Product A-0001 (v3)'},
        async () => {
            await sleep(450);
            server().reset();
            server().suffix = ' (v3)';
            server().delay = 200;
            await open('s-ttl');
            await sleep(30);
            listEl('s-ttl').scrollTop = 60;
            await sleep(400);
            const held = labels('s-ttl')[0];
            await close();
            await open('s-ttl');
            await sleep(50);
            const r = {held, calls: loads('ttl').length, afterReopen: labels('s-ttl')[0]};
            await close();
            server().suffix = '';
            return r;
        });

    // ------------------------------------------------------------------ failures
    T('R14 page 1 fails: "Failed to load. Retry"; Retry loads it',
        {failed: 'Failed to load. Retry', rows: 20, calls: [{reason: 'open', query: '', page: 1}, {reason: 'retry', query: '', page: 1}]},
        async () => {
            server().reset();
            server().failNext = 1;
            await open('s-api');
            await sleep(150);
            const failed = statusText('s-api');
            listEl('s-api').querySelector('.aui-select__status--retry').click();
            await sleep(150);
            return {failed, rows: labels('s-api').length, calls: loads('api').map(brief)};
        });

    T('R15 the next page fails: rows stay, "Couldn\'t load more. Retry", no retry by scrolling; Retry loads it',
        {moreError: 'Couldn\'t load more. Retry', rows: 20, page2Calls: 1, rowsAfterRetry: 40},
        async () => {
            server().failPage = 2;
            await scrollEnd('s-api');
            const moreError = statusText('s-api');
            const rows = labels('s-api').length;
            await scrollEnd('s-api');
            const page2Calls = loads('api').filter(c => c.page === 2).length;
            listEl('s-api').querySelector('.aui-select__status--retry').click();
            await sleep(150);
            const r = {moreError, rows, page2Calls, rowsAfterRetry: labels('s-api').length};
            await close();
            return r;
        });

    T('R16 load-timeout: no answer in time is a failure (request aborted); Retry works',
        {status: 'The server did not answer. Retry', cancelled: true, aborted: true, rows: 20},
        async () => {
            server().reset();
            server().delay = 800;
            await open('s-timeout');
            await sleep(450);
            const status = statusText('s-timeout');
            const c = loads('timeout')[0];
            server().delay = 40;
            listEl('s-timeout').querySelector('.aui-select__status--retry').click();
            await sleep(150);
            const r = {status, cancelled: c.cancelled, aborted: c.aborted, rows: labels('s-timeout').length};
            await close();
            return r;
        });

    T('R17 an answer that is not an array or {items} is a failure, with a console warning',
        {status: 'Failed to load. Retry', warned: true},
        async () => {
            apply(s => s.sApi.reload());
            await sleep(30);
            server().reset();
            server().invalidNext = 1;
            await open('s-api');
            await sleep(150);
            const r = {status: statusText('s-api'), warned: warnedAbout('answered neither an array nor {items')};
            await close();
            return r;
        });

    T('R18 a server that ignores the page parameter: loading stops after page 2, with a warning (no loop)',
        {calls: 2, rows: 20, ended: true, warned: true},
        async () => {
            apply(s => s.sApi.reload());
            await sleep(30);
            server().reset();
            server().ignorePage = true;
            await open('s-api');
            await sleep(150);
            await scrollEnd('s-api');
            await scrollEnd('s-api');
            const r = {calls: loads('api').length, rows: labels('s-api').length, ended: ctrl('s-api').view.more === '',
                warned: warnedAbout('check that the page parameter reaches the server')};
            await close();
            return r;
        });

    T('R19 items that moved between pages are shown once',
        {rows: 38, unique: 38},
        async () => {
            apply(s => s.sApi.reload());
            await sleep(30);
            server().reset();
            server().shift = 2;
            await open('s-api');
            await sleep(150);
            await scrollEnd('s-api');
            const all = labels('s-api');
            const r = {rows: all.length, unique: new Set(all).size};
            await close();
            return r;
        });

    // ------------------------------------------------------------------ params
    T('R20 load-enabled false: nothing is requested; once enabled, the first open loads',
        {callsOff: 0, text: 'No results found', callsClosed: 0, callsOpen: [{reason: 'open', query: '', page: 1}], rows: 20},
        async () => {
            server().reset();
            await open('s-dedicated');
            await sleep(150);
            const callsOff = loads('dedicated').length;
            const text = statusText('s-dedicated');
            await close();
            apply(s => { s.p.dedicated = true; });
            await sleep(60);
            const callsClosed = loads('dedicated').length;
            await open('s-dedicated');
            await sleep(150);
            const r = {callsOff, text, callsClosed, callsOpen: loads('dedicated').map(brief), rows: labels('s-dedicated').length};
            await close();
            return r;
        });

    T('R21 params change while closed: no request until opened; rows of the old params never show',
        {callsClosed: 0, skeletonFirst: true, rows: 15, first: 'Product B-1001', request: {reason: 'open', brand: 'B'}},
        async () => {
            server().reset();
            apply(s => { s.p.single = 'B'; });
            await sleep(60);
            const callsClosed = loads('single').length;
            await open('s-single');
            const skeletonFirst = skeletons('s-single') === 4 && labels('s-single').length === 0;
            await sleep(150);
            const c = loads('single')[0];
            return {callsClosed, skeletonFirst, rows: labels('s-single').length, first: labels('s-single')[0], request: {reason: c.reason, brand: c.params.brand}};
        });

    T('R22 params change while open: the new list loads at once',
        {skeleton: true, rows: 1, reason: 'params'},
        async () => {
            server().reset();
            apply(s => { s.p.single = 'C'; });
            await sleep(20);
            const skeleton = skeletons('s-single') === 4;
            await sleep(150);
            return {skeleton, rows: labels('s-single').length, reason: loads('single')[0].reason};
        });

    T('R23 back to earlier params: the kept list shows without a request',
        {calls: 0, rows: 228},
        async () => {
            server().reset();
            apply(s => { s.p.single = 'A'; });
            await sleep(100);
            const r = {calls: loads('single').length, rows: labels('s-single').length};
            await close();
            return r;
        });

    // ------------------------------------------------------------------ saved values
    T('R24 a saved value outside the loaded pages is looked up through load-options (placeholder meanwhile)',
        {pending: true, busy: 'true', call: {reason: 'lookup', values: [150], page: 1, pageSize: 1, query: ''}, display: 'Product A-0150', calls: 1},
        async () => {
            server().reset();
            apply(s => { s.m.reset = 150; });
            const pending = !!host('s-reset').querySelector('.aui-select__display-text .aui-select__pending');
            const busy = trig('s-reset').getAttribute('aria-busy');
            await sleep(150);
            const c = calls('reset')[0];
            return {pending, busy, call: c ? {reason: c.reason, values: c.values, page: c.page, pageSize: c.pageSize, query: c.query} : null,
                display: display('s-reset'), calls: calls('reset').length};
        });

    T('R25 values set together are looked up in one request',
        {lookups: 1, values: [5, 6, 7, 120, 121], tags: ['Product A-0005', 'Product A-0006', 'Product A-0007', 'Product A-0120', 'Product A-0121']},
        async () => {
            server().reset();
            apply(s => { s.m.multi = [5, 6, 7, 120, 121]; });
            await sleep(150);
            return {lookups: lookups('multi').length, values: lookups('multi')[0].values, tags: tags('s-multi')};
        });

    // 5, 6 and 7 are known from R25: only the other 42 values are asked.
    T('R26 many values: one request per page size of ids, each asking for exactly that many; known ones are not asked',
        {chunks: [20, 20, 2], pageSizes: [20, 20, 2], tagCount: 45},
        async () => {
            server().reset();
            apply(s => { s.m.multi = Array.from({length: 45}, (x, i) => i + 1); });
            await sleep(400);
            return {chunks: lookups('multi').map(c => c.values.length), pageSizes: lookups('multi').map(c => c.pageSize), tagCount: tags('s-multi').length};
        });

    T('R27 a value no server knows shows its key; it is asked again only at the next open; the model stays',
        {tag: ['99999'], before: 1, afterRender: 1, afterOpen: 2, model: [99999]},
        async () => {
            server().reset();
            apply(s => { s.m.multi = [99999]; });
            await sleep(150);
            const tag = tags('s-multi');
            const before = lookups('multi').length;
            apply(s => { s.m.unrelated = Date.now(); });
            ctrl('s-multi').refreshViewValueFromModel();
            apply(() => {});
            await sleep(150);
            const afterRender = lookups('multi').length;
            await open('s-multi');
            await sleep(300);
            const r = {tag, before, afterRender, afterOpen: lookups('multi').length, model: scope().m.multi.slice()};
            await close();
            return r;
        });

    T('R28 a lookup finds an item the list leaves out (an inactive product)',
        {tags: ['Product A-0097']},
        async () => {
            apply(s => { s.m.multi = [97]; });
            await sleep(150);
            return {tags: tags('s-multi')};
        });

    T('R29 a lookup waits for a list that is loading, and is skipped when that list has the value',
        {whileLoading: 0, after: 0, display: 'Product A-0003', for150: 1},
        async () => {
            server().reset();
            server().delay = 200;
            await open('s-reset');
            apply(s => { s.m.reset = 3; });
            await sleep(100);
            const whileLoading = lookups('reset').length;
            await sleep(300);
            const after = lookups('reset').length;
            const shown = display('s-reset');
            server().delay = 40;
            await close();
            apply(s => { s.m.reset = 150; });
            await sleep(150);
            return {whileLoading, after, display: shown, for150: lookups('reset').length};
        });

    T('R30 the selected value is pinned on top while its page is not loaded, and never shown twice',
        {first: 'Product A-0150', pinned: true, second: 'Product A-0001', once: 1},
        async () => {
            await open('s-reset');
            await sleep(100);
            const first = labels('s-reset')[0];
            const pinned = domRow('s-reset', 'Product A-0150').classList.contains('aui-select__option--pinned-last');
            const second = labels('s-reset')[1];
            for (let i = 0; i < 9; i += 1) await scrollEnd('s-reset', 120);
            const r = {first, pinned, second, once: labels('s-reset').filter(l => l === 'Product A-0150').length};
            await close();
            return r;
        });

    T('R31 an option picked from a search result keeps its label afterwards (no lookup)',
        {tags: ['Product A-0222'], pinnedFirst: 'Product A-0222', lookups: 0},
        async () => {
            apply(s => { s.m.multi = []; });
            server().reset();
            await open('s-multi');
            await sleep(100);
            await search('s-multi', 'A-0222', 300);
            domRow('s-multi', 'Product A-0222').click();
            await sleep(50);
            await search('s-multi', '', 60);
            const r = {tags: tags('s-multi'), pinnedFirst: labels('s-multi')[0], lookups: lookups('multi').length};
            await close();
            return r;
        });

    T('R32 value-options: the label the page passes, without any request',
        {display: 'Saved name', calls: 0},
        async () => {
            server().reset();
            apply(s => { s.m.vo = 180; s.m.voName = 'Saved name'; });
            await sleep(150);
            return {display: display('s-vo'), calls: server().calls.length + server().lookupCalls.length};
        });

    T('R33 lookup-options is used instead of load-options, and does not wait for load-enabled',
        {lookupCalls: 1, loadCalls: 0, display: 'Product A-0077'},
        async () => {
            apply(s => { s.p.dedicated = false; });
            server().reset();
            apply(s => { s.m.dedicated = 77; });
            await sleep(150);
            return {lookupCalls: server().of('dedicated', server().lookupCalls).length, loadCalls: calls('dedicated').length, display: display('s-dedicated')};
        });

    T('R34 lookup-group: the values of every row go out in one request',
        {lookups: 1, values: [11, 12, 13, 14, 15], labels: ['Product A-0011', 'Product A-0012', 'Product A-0013', 'Product A-0014', 'Product A-0015']},
        async () => {
            server().reset();
            apply(s => { s.groupRows = [11, 12, 13, 14, 15].map((v, i) => ({id: i, value: v})); });
            await sleep(250);
            const rows = Array.from(document.querySelectorAll('#s-group aui-select .aui-select__display-text')).map(el => el.textContent.trim());
            const all = lookups('group');
            return {lookups: all.length, values: all.length ? all[0].values : null, labels: rows};
        });

    T('R35 reset-on-params="clear": cleared when the params change under the value; kept when both change together',
        {cleared: '', changeCalls: 1, kept: 160},
        async () => {
            const before = scope().changes.length;
            apply(s => { s.p.reset = 'B'; });
            await sleep(60);
            const cleared = scope().m.reset;
            const changeCalls = scope().changes.length - before;
            apply(s => { s.p.reset = 'A'; s.m.reset = 160; });
            await sleep(60);
            return {cleared, changeCalls, kept: scope().m.reset};
        });

    T('R35b reset-on-params with load-enabled: emptying the field the params come from clears; a pause, or params filled in while off, keep',
        {paused: 160, resumed: 160, emptied: '', changeCalls: 1, staged: 170},
        async () => {
            apply(s => { s.p.reset = 'A'; s.m.reset = 160; });
            await sleep(60);
            const before = scope().changes.length;
            apply(s => { s.p.resetPaused = true; });       // loading off, the same params
            await sleep(60);
            const paused = scope().m.reset;
            apply(s => { s.p.resetPaused = false; });
            await sleep(60);
            const resumed = scope().m.reset;
            apply(s => { s.p.reset = null; });             // the field the params come from emptied: loading off with it
            await sleep(60);
            const emptied = scope().m.reset;
            const changeCalls = scope().changes.length - before;
            apply(s => { s.m.reset = 170; });              // a record filled in steps: its value while loading is off,
            await sleep(60);
            apply(s => { s.p.reset = 'B'; });              // the field it depends on later
            await sleep(60);
            const staged = scope().m.reset;
            apply(s => { s.p.reset = 'A'; s.m.reset = 160; });
            await sleep(60);
            return {paused, resumed, emptied, changeCalls, staged};
        });

    T('R36 without reset-on-params the component never changes the value (unknown value, params changed)',
        {model: 999999, display: '999999'},
        async () => {
            apply(s => { s.m.single = 999999; });
            await sleep(150);
            apply(s => { s.p.single = 'B'; });
            await sleep(150);
            const r = {model: scope().m.single, display: display('s-single')};
            apply(s => { s.p.single = 'A'; s.m.single = null; });
            return r;
        });

    T('R37 disabled-field: such an option cannot be picked, and its tag is locked',
        {disabledRow: true, afterClick: [], picked: [8], locked: true},
        async () => {
            apply(s => { s.m.multi = []; });
            await open('s-multi');
            await sleep(100);
            const row = domRow('s-multi', 'Product A-0007');
            const disabledRow = row.classList.contains('aui-select__option--disabled');
            row.click();
            await sleep(30);
            const afterClick = scope().m.multi.slice();
            domRow('s-multi', 'Product A-0008').click();
            await sleep(30);
            const picked = scope().m.multi.slice();
            await close();
            apply(s => { s.m.multi = [57]; });
            await sleep(150);
            const tag = host('s-multi').querySelector('.aui-select__tag');
            return {disabledRow, afterClick, picked, locked: !!tag && tag.classList.contains('aui-select__tag--locked')};
        });

    T('R38 auto-select-on-single-required: a remote list with exactly one option selects it',
        {model: 2001, display: 'Product C-2001'},
        async () => ({model: scope().m.auto, display: display('s-auto')}));

    // ------------------------------------------------------------------ lifecycle, keyboard, rendering
    T('R39 destroyed while loading: every request is cancelled, a late answer changes nothing',
        {cancelled: true, aborted: true, errors: 0, gone: true},
        async () => {
            const errors = errCount();
            server().reset();
            server().delay = 300;
            await open('s-destroy');
            await sleep(50);
            apply(s => { s.m.destroy = 140; });
            apply(s => { s.show.destroyable = false; });
            await sleep(450);
            const all = calls('destroy');
            server().delay = 40;
            return {cancelled: all.length > 0 && all.every(c => c.cancelled), aborted: all.length > 0 && all.every(c => c.aborted),
                errors: errCount() - errors, gone: !host('s-destroy')};
        });

    T('R40 keyboard: moving down to the last loaded option loads the next page',
        {active: 'Product A-0020', rows: 40, pages: [1, 2]},
        async () => {
            apply(s => s.sApi.reload());
            await sleep(30);
            server().reset();
            await open('s-api');
            await sleep(150);
            for (let i = 0; i < 20; i += 1) key(searchBox('s-api'), 'ArrowDown');
            await sleep(60);
            const c = ctrl('s-api');
            const active = c.filteredOptions[c.activeIndex] ? c.filteredOptions[c.activeIndex].name : null;
            await sleep(150);
            const r = {active, rows: labels('s-api').length, pages: loads('api').map(x => x.page)};
            await close();
            return r;
        });

    T('R41 300 options: one-line rows in a scroll window (few rows in the page), the last one reachable',
        {rows: 296, fewInPage: true, lastRendered: true, oneLine: 'nowrap', samePitch: true},
        async () => {
            server().reset();
            await open('s-many');
            await sleep(150);
            await scrollEnd('s-many', 200);
            await scrollEnd('s-many', 200);
            await scrollEnd('s-many', 200);
            const inPage = host('s-many').querySelectorAll('li.aui-select__option');
            const r = {rows: labels('s-many').length, fewInPage: inPage.length < 60, lastRendered: !!domRow('s-many', 'Product D-3300'),
                oneLine: getComputedStyle(inPage[0]).whiteSpace, samePitch: inPage[0].offsetHeight === inPage[1].offsetHeight};
            await close();
            return r;
        });

    T('R42 a closed select keeps no options in the page',
        {options: 0, list: false},
        async () => ({options: host('s-many').querySelectorAll('li.aui-select__option').length, list: !!listEl('s-many')}));

    T('R43 load everything at once: one request without a page size, then the search is local',
        {request: {reason: 'open', page: 1, pageSize: null}, rows: 15, search: true, calls: 1, filtered: 9},
        async () => {
            server().reset();
            await open('s-all');
            await sleep(150);
            const c = loads('all')[0];
            const rows = labels('s-all').length;
            const searchShown = !!searchBox('s-all');
            await search('s-all', 'B-100', 150);
            const r = {request: {reason: c.reason, page: c.page, pageSize: c.pageSize}, rows, search: searchShown,
                calls: loads('all').length, filtered: labels('s-all').length};
            await close();
            return r;
        });

    T('R44 load everything at once: a saved value under new params loads the list at once for its label',
        {calls: [{reason: 'values', brand: 'A'}], display: 'Product A-0005'},
        async () => {
            server().reset();
            apply(s => { s.p.all = 'A'; s.m.all = 5; });
            await sleep(150);
            return {calls: loads('all').map(c => ({reason: c.reason, brand: c.params.brand})), display: display('s-all')};
        });

    T('R45 api.reload(): closed, the list is only forgotten (loaded at the next open); open, it loads at once',
        {closedCalls: 0, afterOpen: ['open'], afterReload: ['open', 'reload']},
        async () => {
            server().reset();
            apply(s => s.sApi.reload());
            await sleep(60);
            const closedCalls = loads('api').length;
            await open('s-api');
            await sleep(150);
            const afterOpen = loads('api').map(c => c.reason);
            apply(s => s.sApi.reload());
            await sleep(150);
            const r = {closedCalls, afterOpen, afterReload: loads('api').map(c => c.reason)};
            await close();
            return r;
        });

    T('R46 preload: the list loads as soon as loading is enabled, without opening',
        {calls: [{reason: 'preload', query: '', page: 1}]},
        async () => {
            server().reset();
            apply(s => { s.p.preload = true; });
            await sleep(150);
            return {calls: loads('preload').map(brief)};
        });

    T('R47 search-min-length: no request (and a hint) until enough characters are typed',
        {openCalls: 0, hint: 'Type at least 2 characters to search', afterOne: 0, request: {reason: 'search', query: 'A-', page: 1}, rows: 20},
        async () => {
            server().reset();
            await open('s-min');
            await sleep(100);
            const openCalls = loads('min').length;
            const hint = statusText('s-min');
            await search('s-min', 'A', 250);
            const afterOne = loads('min').length;
            await search('s-min', 'A-', 300);
            const r = {openCalls, hint, afterOne, request: loads('min')[0] ? brief(loads('min')[0]) : null, rows: labels('s-min').length};
            await close();
            return r;
        });

    T('R47b a search with nothing to show yet says "Searching..." (no placeholder rows) and the search box shows its spinner; both go once the rows arrive',
        {searching: true, skeletons: 0, busy: true, rowsAfter: 20, searchingAfter: false, busyAfter: false},
        async () => {
            server().reset();
            server().delay = 300;
            await open('s-min');
            await sleep(100);
            const busy = () => !!host('s-min').querySelector('.aui-select__search--busy .aui-select__search-spinner');
            const searchingRow = () => !!host('s-min').querySelector('li.aui-select__searching');
            await search('s-min', 'A-', 180);    // past the search-delay (100), before the answer (300)
            const r = {searching: searchingRow(), skeletons: skeletons('s-min'), busy: busy()};
            await sleep(350);
            r.rowsAfter = labels('s-min').length;
            r.searchingAfter = searchingRow();
            r.busyAfter = busy();
            server().delay = 0;
            await close();
            return r;
        });

    T('R48 answers with nextCursor: the cursor goes back with the next page',
        {cursor: 'c20', rows: 40},
        async () => {
            apply(s => s.sApi.reload());
            await sleep(30);
            server().reset();
            server().mode = 'cursor';
            await open('s-api');
            await sleep(150);
            await scrollEnd('s-api');
            const r = {cursor: loads('api')[1] ? loads('api')[1].cursor : null, rows: labels('s-api').length};
            await close();
            server().mode = 'array';
            return r;
        });

    // ------------------------------------------------------------------ review round
    T('R50 load-timeout: a request answered in time is never aborted afterwards',
        {answered: true, cancelled: false, aborted: false},
        async () => {
            apply(s => s.p.timeout = 'B');   // a list not loaded yet
            server().reset();
            await open('s-timeout');
            await sleep(600);   // past the 300 ms timeout
            const c = loads('timeout')[0];
            await close();
            return {answered: !!c, cancelled: c.cancelled, aborted: c.aborted};
        });

    T('R51 a lookup that must wait (loading not enabled) shows the raw value; once enabled, the label',
        {waiting: {text: '3150', placeholder: false, busy: 'false', calls: 0}, after: {text: 'Product D-3150', lookups: 1}},
        async () => {
            server().reset();
            apply(s => { s.p.single = ''; s.m.single = 3150; });
            await sleep(300);
            const el = () => host('s-single').querySelector('.aui-select__display-text');
            const waiting = {text: display('s-single'), placeholder: !!el().querySelector('.aui-select__pending'),
                busy: trig('s-single').getAttribute('aria-busy'), calls: calls('single').length};
            apply(s => { s.p.single = 'D'; });
            await sleep(200);
            const after = {text: display('s-single'), lookups: lookups('single').length};
            apply(s => { s.p.single = 'A'; s.m.single = null; });
            return {waiting, after};
        });

    T('R52 static options with lookup-options: a value outside the options gets its label; one inside needs no request',
        {outside: 'Product A-0200', lookups: 1, inside: 'Product A-0003', lookupsAfter: 1},
        async () => {
            server().reset();
            apply(s => { s.m.static = 200; });
            await sleep(150);
            const outside = display('s-static');
            const count = server().of('static', server().lookupCalls).length;
            apply(s => { s.m.static = 3; });
            await sleep(150);
            return {outside, lookups: count, inside: display('s-static'), lookupsAfter: server().of('static', server().lookupCalls).length};
        });

    T('R53 a pinned value whose label is still loading shows the placeholder (trigger aria-busy), then its label',
        {pinnedPlaceholder: true, busy: 'true', pinnedLabel: 'Product A-0180', busyAfter: 'false'},
        async () => {
            apply(s => { s.m.multi = []; });
            await open('s-multi');
            await sleep(150);
            server().reset();
            server().delay = 400;
            apply(s => { s.m.multi = [180]; });
            await sleep(120);
            const first = listEl('s-multi').querySelector('li.aui-select__option');
            const pinnedPlaceholder = !!first && first.classList.contains('aui-select__option--pinned') && !!first.querySelector('.aui-select__pending');
            const busy = trig('s-multi').getAttribute('aria-busy');
            await sleep(450);
            server().delay = 40;
            const r = {pinnedPlaceholder, busy, pinnedLabel: labels('s-multi')[0], busyAfter: trig('s-multi').getAttribute('aria-busy')};
            await close();
            return r;
        });

    T('R54 the list arriving after the opening: the keyboard goes to the selected option (No. 350 of 400), scrolled into view; the same on the next opening',
        {first: {active: 'Choice 350', inView: true}, second: {active: 'Choice 350', inView: true}},
        async () => {
            const read = () => {
                const c = ctrl('s-choice');
                const row = c.activeIndex >= 0 ? document.getElementById(c.activeOptionId()) : null;
                const box = listEl('s-choice').getBoundingClientRect();
                const inView = !!row && row.getBoundingClientRect().top >= box.top - 1 && row.getBoundingClientRect().bottom <= box.bottom + 1;
                return {active: c.activeIndex >= 0 ? c.filteredOptions[c.activeIndex].name : null, inView};
            };
            await open('s-choice');
            await sleep(350);
            const first = read();
            await close();
            await open('s-choice');
            await sleep(300);
            const second = read();
            await close();
            return {first, second};
        });

    T('R49 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: errCount()}));

    AuiTest.run('aui-select: remote data', tests);
})();
