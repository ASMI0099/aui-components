// load-disabled-text suite (page: load-disabled.html, fixture: load-disabled.fixture.js), aui-select and
// aui-tree-select: while load-enabled is false the panel says what to do first, has no search box, and nothing loads.
(function () {
    const {sleep, type, key, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select, #' + id + ' aui-tree-select');
    const isTree = id => host(id).tagName.toLowerCase() === 'aui-tree-select';
    const ctrl = id => angular.element(host(id)).controller(isTree(id) ? 'auiTreeSelect' : 'auiSelect');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const searchBox = id => host(id).querySelector('.aui-select__search-input');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const calls = tag => scope().of(tag).map(c => ({kind: c.kind, reason: c.reason, params: c.params}));
    const notice = id => {
        const el = host(id).querySelector('.aui-select__notice');
        if (!el) return null;
        const icon = el.querySelector('.aui-select__notice-icon');
        return {text: el.textContent.trim(), role: el.getAttribute('role'), icon: !!icon && icon.getAttribute('aria-hidden') === 'true'};
    };
    const noResults = id => {
        const el = host(id).querySelector('.aui-select__no-results');
        return el ? el.textContent.trim() : null;
    };
    const rows = id => ctrl(id).rows.length;
    const errCount = () => window.__ngErrors.length;
    async function open(id) { trig(id).click(); await sleep(150); }
    async function close() { outside(); await sleep(400); }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('L1 aui-select, no hall yet: the panel says what to do, no search box, no "No results", no request; the field keeps the focus',
        {notice: {text: 'Select a hall first', role: 'status', icon: true}, noResults: null, search: false, calls: [], focusOnTrigger: true, open: true},
        async () => {
            trig('s-room').focus();   // a real click focuses the field first; a scripted click does not
            await open('s-room');
            const r = {notice: notice('s-room'), noResults: noResults('s-room'), search: !!searchBox('s-room'), calls: calls('room'),
                focusOnTrigger: document.activeElement === trig('s-room'), open: ctrl('s-room').isOpen};
            return r;
        });

    T('L2 keys while the notice shows: arrows and Enter do nothing, Escape closes',
        {model: '', openAfterKeys: true, openAfterEscape: false},
        async () => {
            key(trig('s-room'), 'ArrowDown');
            key(trig('s-room'), 'Enter');
            await sleep(30);
            const openAfterKeys = ctrl('s-room').isOpen;
            key(trig('s-room'), 'Escape');
            await sleep(400);
            return {model: scope().m.room, openAfterKeys, openAfterEscape: ctrl('s-room').isOpen};
        });

    T('L3 the hall is chosen while the panel is open: the notice goes, one request with the new params, the list and the search box come',
        {before: true, notice: null, calls: [{kind: 'rooms', reason: 'params', params: {hall: 1}}], rows: 20, search: true},
        async () => {
            await open('s-room');
            const before = !!notice('s-room');
            apply(s => { s.form.hall = 1; });
            await sleep(200);
            return {before, notice: notice('s-room'), calls: calls('room'), rows: rows('s-room'), search: !!searchBox('s-room')};
        });

    T('L4 the hall is cleared while typing in the search box: the notice is back, the keyboard stays on the field, a late answer shows nothing',
        {notice: 'Select a hall first', search: false, focusOnTrigger: true, open: true, rowsAfterAnswer: 0},
        async () => {
            searchBox('s-room').focus();
            apply(s => { s.form.hall = 2; });   // a request for hall 2 starts ...
            await sleep(20);
            apply(s => { s.form.hall = null; });   // ... and the hall is gone before it answers
            await sleep(30);
            const r = {notice: (notice('s-room') || {}).text, search: !!searchBox('s-room'), focusOnTrigger: document.activeElement === trig('s-room'),
                open: ctrl('s-room').isOpen};
            await sleep(150);
            r.rowsAfterAnswer = rows('s-room');
            return r;
        });

    T('L5 the text follows the page (an interpolated attribute)',
        {notice: 'Choose the hall at the top of the form'},
        async () => {
            apply(s => { s.text.hall = 'Choose the hall at the top of the form'; });
            await sleep(30);
            const r = {notice: (notice('s-room') || {}).text};
            await close();
            return r;
        });

    T('L6 aui-select, multiple, load all: the same; after the hall the whole list',
        {notice: 'Select a hall first', search: false, calls: 0, rows: 30},
        async () => {
            apply(s => { s.form.hall = null; });
            await open('s-rooms');
            const r = {notice: (notice('s-rooms') || {}).text, search: !!searchBox('s-rooms'), calls: calls('rooms').length};
            apply(s => { s.form.hall = 1; });
            await sleep(200);
            r.rows = rows('s-rooms');
            await close();
            return r;
        });

    T('L7 without load-disabled-text nothing changes: "No results found" and the search box, as before',
        {notice: null, noResults: 'No results found', search: true, calls: 0},
        async () => {
            apply(s => { s.form.hall = null; });
            await open('s-plain');
            const r = {notice: notice('s-plain'), noResults: noResults('s-plain'), search: !!searchBox('s-plain'), calls: calls('plain').length};
            await close();
            return r;
        });

    T('L8 two conditions, one message each: the message follows what is still missing; with both, the list loads',
        {noHall: 'Select a hall first', noType: 'Select a room type first', loaded: 20},
        async () => {
            apply(s => { s.form.hall = null; s.form.type = null; });
            await open('s-two');
            const noHall = (notice('s-two') || {}).text;
            apply(s => { s.form.hall = 1; });
            await sleep(30);
            const noType = (notice('s-two') || {}).text;
            apply(s => { s.form.type = 'food'; });
            await sleep(200);
            const r = {noHall, noType, loaded: rows('s-two')};
            await close();
            return r;
        });

    T('L9 aui-tree-select, load-options: the notice, no search box, no request; after the hall the tree',
        {notice: {text: 'Select a hall first', role: 'status', icon: true}, noResults: null, search: false, calls: 0, rows: ['Floor 1']},
        async () => {
            apply(s => { s.form.hall = null; });
            await open('t-cat');
            const r = {notice: notice('t-cat'), noResults: noResults('t-cat'), search: !!searchBox('t-cat'), calls: calls('cat').length};
            apply(s => { s.form.hall = 1; });
            await sleep(200);
            r.rows = ctrl('t-cat').rows.map(row => row.node.label);
            await close();
            return r;
        });

    T('L10 aui-tree-select, lazy with remote-search: the notice and no search box (it would search nothing); after the hall the roots',
        {notice: 'Select a hall first', search: false, calls: 0, roots: ['Root 1', 'Root 2'], searchAfter: true},
        async () => {
            apply(s => { s.form.hall = null; });
            await open('t-lazy');
            const r = {notice: (notice('t-lazy') || {}).text, search: !!searchBox('t-lazy'), calls: calls('lazy').length};
            apply(s => { s.form.hall = 1; });
            await sleep(200);
            r.roots = ctrl('t-lazy').rows.map(row => row.node.label);
            r.searchAfter = !!searchBox('t-lazy');
            await close();
            return r;
        });

    T('L11 the value is never touched by the notice',
        {room: '', rooms: [], cat: '', lazy: ''},
        async () => ({room: scope().m.room, rooms: scope().m.rooms, cat: scope().m.cat, lazy: scope().m.lazy}));

    T('L12 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: errCount()}));

    AuiTest.run('aui-* family: load-disabled-text', tests);
})();
