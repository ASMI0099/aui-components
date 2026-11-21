// Busy / page-function suite (page: busy.html, fixture: busy.fixture.js), aui-select and aui-tree-select:
// - loading: a spinner in the chevron's place, the progress cursor, aria-busy; the field still does not open;
// - a page function named without its call gives back a function: one clear console warning, the load fails as before.
(function () {
    const {sleep, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select, #' + id + ' aui-tree-select');
    const isTree = id => host(id).tagName.toLowerCase() === 'aui-tree-select';
    const ctrl = id => angular.element(host(id)).controller(isTree(id) ? 'auiTreeSelect' : 'auiSelect');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    /** The recorded warnings of one component ('aui-select: ' / 'aui-tree-select (') that contain the text. */
    const warned = (prefix, text) => window.__warnings.filter(w => w.indexOf(prefix) === 0 && w.indexOf(text) !== -1);
    const panelText = id => (host(id).querySelector('.aui-select__panel') || {textContent: ''}).textContent.replace(/\s+/g, ' ').trim();

    /** The look of a field: busy class, spinner, chevron visibility, cursor and aria-busy. */
    function look(id) {
        const t = trig(id);
        const chevron = t.querySelector('.aui-select__chevron');
        return {
            busy: t.classList.contains('aui-select__trigger--busy'),
            spinner: !!t.querySelector('.aui-select__busy'),
            chevron: getComputedStyle(chevron).visibility,
            cursor: getComputedStyle(t).cursor,
            ariaBusy: t.getAttribute('aria-busy')
        };
    }
    async function open(id) { trig(id).click(); await sleep(150); }
    async function close() { outside(); await sleep(350); }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('K1 aui-select loading: spinner in the chevron\'s place, progress cursor, aria-busy; a click does not open it (as before)',
        {look: {busy: true, spinner: true, chevron: 'hidden', cursor: 'progress', ariaBusy: 'true'}, open: false},
        async () => {
            const l = look('s-busy');
            await open('s-busy');
            const r = {look: l, open: ctrl('s-busy').isOpen};
            return r;
        });

    T('K2 aui-tree-select loading: the same look; a click does not open it',
        {look: {busy: true, spinner: true, chevron: 'hidden', cursor: 'progress', ariaBusy: 'true'}, open: false},
        async () => {
            const l = look('t-busy');
            await open('t-busy');
            return {look: l, open: ctrl('t-busy').isOpen};
        });

    T('K3 loading ends: chevron back, no spinner, aria-busy false; the field opens',
        {select: {busy: false, spinner: false, chevron: 'visible', cursor: 'pointer', ariaBusy: 'false'}, tree: {busy: false, spinner: false, chevron: 'visible', ariaBusy: 'false'}, opens: true},
        async () => {
            apply(s => { s.state.loading = false; });
            await sleep(30);
            const tree = look('t-busy');
            delete tree.cursor;
            const r = {select: look('s-busy'), tree};
            await open('s-busy');
            r.opens = ctrl('s-busy').isOpen;
            await close();
            return r;
        });

    T('K4 disabled and loading: the disabled cursor wins (busy look otherwise)',
        {busy: true, spinner: true, notAllowed: true},
        async () => {
            apply(s => { s.state.loading = true; s.state.disabled = true; });
            await sleep(30);
            const l = look('s-busy');
            apply(s => { s.state.loading = false; s.state.disabled = false; });
            await sleep(30);
            return {busy: l.busy, spinner: l.spinner, notAllowed: l.cursor === 'not-allowed'};
        });

    T('K5 load-options="loadList" (no call): one clear warning; the panel shows the failure, as before',
        {warnings: 1, mentions: true, failed: true, onceAfterReopen: 1},
        async () => {
            await open('s-ref');
            await sleep(100);
            const found = warned('aui-select: ', 'load-options gave back a function instead of data');
            const failed = /Failed to load/.test(panelText('s-ref'));
            await close();
            await open('s-ref');
            await sleep(100);
            const r = {warnings: found.length, mentions: /load-options="vm\.load\(\$request\)"/.test(found[0] || ''), failed,
                onceAfterReopen: warned('aui-select: ', 'load-options gave back a function').length};
            await close();
            return r;
        });

    T('K6 lookup-options="lookupList" (no call): the warning names lookup-options',
        {warned: true},
        async () => {
            await sleep(200);   // the lookup of the saved value 7 ran on load
            const found = warned('aui-select: ', 'lookup-options gave back a function instead of data');
            return {warned: found.length === 1 && /lookup-options="vm\.lookup\(\$request\)"/.test(found[0])};
        });

    T('K7 aui-tree-select: load-options and load-children named without their call are warned about too',
        {loadOptions: true, loadChildren: true},
        async () => {
            await open('t-ref');
            await sleep(100);
            await close();
            await open('t-kids');
            await sleep(100);
            await close();
            return {loadOptions: warned('aui-tree-select (', 'load-options gave back a function instead of data').length === 1,
                loadChildren: warned('aui-tree-select (', 'load-children gave back a function instead of data').length === 1};
        });

    T('K8 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-* family: busy fields and page functions', tests, {delay: 0});
})();
