// Keys suite (page: keys.html, fixture: keys.fixture.js), aui-select and aui-tree-select. A key never changes a
// selection the user cannot see being changed:
// - Enter / Space act only on the row with the keyboard highlight, and only when the rows answer the search text as
//   it is now (not the dimmed rows of the previous search while new results are on their way);
// - typing in the search box and opening from the keyboard show the highlight; after a mouse open the first Enter only
//   shows it; a held key (auto-repeat) never picks; a mousemove without a real move keeps it;
// - Backspace / Delete only edit the search text.
(function () {
    const {sleep, outside, key, type} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select, #' + id + ' aui-tree-select');
    const isTree = id => host(id).tagName.toLowerCase() === 'aui-tree-select';
    const ctrl = id => angular.element(host(id)).controller(isTree(id) ? 'auiTreeSelect' : 'auiSelect');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const search = id => host(id).querySelector('.aui-select__search-input');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const model = name => angular.copy(scope().m[name]);
    const activeEl = id => host(id).querySelector('li.aui-select__option--active');
    const activeLabel = id => {
        const li = activeEl(id);
        if (!li) return null;
        const label = li.querySelector('.aui-tree-select__label') || li;
        return label.textContent.replace(/\s+/g, ' ').trim();
    };
    const highlight = id => !!host(id).querySelector('.aui-select__panel--keyboard li.aui-select__option--active');
    const ring = id => { const li = activeEl(id); return !!li && highlight(id) && getComputedStyle(li).boxShadow !== 'none'; };
    const stale = id => !!host(id).querySelector('ul.aui-select__options--stale');
    const rowLabels = id => Array.prototype.map.call(host(id).querySelectorAll('li.aui-select__option'), li => {
        const label = li.querySelector('.aui-tree-select__label') || li;
        return label.textContent.replace(/\s+/g, ' ').trim();
    });
    async function openByMouse(id) { trig(id).click(); await sleep(250); }
    async function close() { outside(); await sleep(350); }
    function hold(el, name, times) { for (let i = 0; i < times; i += 1) key(el, name, {repeat: true}); }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('E1 aui-select: typing shows the highlight on the first match; Enter toggles that row; a held Enter toggles once',
        {afterType: {highlight: true, ring: true, active: 'Apple'}, afterEnter: [3], afterSecond: [], afterHeld: [3]},
        async () => {
            apply(s => { s.m.sel = []; });
            await openByMouse('s');
            type(search('s'), 'ap');
            await sleep(50);
            const afterType = {highlight: highlight('s'), ring: ring('s'), active: activeLabel('s')};
            key(search('s'), 'Enter');
            await sleep(30);
            const afterEnter = model('sel');
            key(search('s'), 'Enter');
            await sleep(30);
            const afterSecond = model('sel');
            key(search('s'), 'Enter');
            hold(search('s'), 'Enter', 5);   // odd: if repeats acted, the result would flip
            await sleep(30);
            const afterHeld = model('sel');
            await close();
            return {afterType, afterEnter, afterSecond, afterHeld};
        });

    T('E2 aui-select: after a mouse open the first Enter only shows the highlight; the next one acts on the highlighted row',
        {first: [3], highlight: true, active: 'Apple', second: []},
        async () => {
            apply(s => { s.m.sel = [3]; });
            await openByMouse('s');
            key(search('s'), 'Enter');
            await sleep(30);
            const r = {first: model('sel'), highlight: highlight('s'), active: activeLabel('s')};
            key(search('s'), 'Enter');
            await sleep(30);
            r.second = model('sel');
            await close();
            return r;
        });

    T('E3 aui-select server search: Enter before the new results changes nothing (old rows dimmed, no keyboard ring); after them it picks the first match',
        {during: {model: [], stale: true, ring: false}, after: {rows: ['Apple', 'Apricot', 'Grape', 'Papaya'], stale: false, active: 'Apple', ring: true}, picked: [3]},
        async () => {
            await openByMouse('r');
            await sleep(500);   // the first page
            type(search('r'), 'ap');
            await sleep(30);
            key(search('r'), 'Enter');
            await sleep(30);
            const during = {model: model('remote'), stale: stale('r'), ring: ring('r')};
            await sleep(1000);   // search-delay, then the answer
            const after = {rows: rowLabels('r'), stale: stale('r'), active: activeLabel('r'), ring: ring('r')};
            key(search('r'), 'Enter');
            await sleep(30);
            const picked = model('remote');
            await close();
            return {during, after, picked};
        });

    T('E4 opened from the keyboard: the highlight shows at once; a held Enter that opened the panel picks nothing',
        {open: true, highlight: true, heldOnTrigger: [], heldInSearch: []},
        async () => {
            apply(s => { s.m.sel = []; });
            trig('s').focus();
            key(trig('s'), 'Enter');
            hold(trig('s'), 'Enter', 3);
            await sleep(250);
            const heldOnTrigger = model('sel');
            hold(search('s'), 'Enter', 3);
            await sleep(30);
            const r = {open: ctrl('s').isOpen, highlight: highlight('s'), heldOnTrigger, heldInSearch: model('sel')};
            await close();
            return r;
        });

    T('E5 aui-tree-select: typing shows the highlight on the first match (not the group above it); Enter checks it; a held Enter changes nothing more',
        {afterType: {highlight: true, ring: true, active: 'Apple'}, afterEnter: ['n-Apple'], afterHeld: ['n-Apple']},
        async () => {
            await openByMouse('t');
            type(search('t'), 'ap');
            await sleep(50);
            const afterType = {highlight: highlight('t'), ring: ring('t'), active: activeLabel('t')};
            key(search('t'), 'Enter');
            await sleep(30);
            const afterEnter = model('tree');
            hold(search('t'), 'Enter', 5);   // odd: if repeats acted, the result would flip
            await sleep(30);
            const afterHeld = model('tree');
            await close();
            return {afterType, afterEnter, afterHeld};
        });

    T('E6 aui-tree-select remote search: Enter before the results changes nothing (the old rows are dimmed); after them it checks the first match, not the group',
        {during: {model: [], stale: true, ring: false}, after: {stale: false, active: 'Apple', ring: true}, picked: ['n-Apple']},
        async () => {
            await openByMouse('rt');
            type(search('rt'), 'ap');
            await sleep(30);
            key(search('rt'), 'Enter');
            key(search('rt'), ' ');
            await sleep(30);
            const during = {model: model('rtree'), stale: stale('rt'), ring: ring('rt')};
            await sleep(900);   // search-delay, then the answer
            const after = {stale: stale('rt'), active: activeLabel('rt'), ring: ring('rt')};
            key(search('rt'), 'Enter');
            await sleep(30);
            const picked = model('rtree');
            await close();
            return {during, after, picked};
        });

    T('E7 a mousemove without a real move keeps the keyboard highlight; a real move ends it (both components)',
        {select: {same: true, moved: false}, tree: {same: true, moved: false}},
        async () => {
            const out = {};
            for (const [name, id, target] of [['select', 's', () => host('s').querySelector('.aui-select__panel')],
                                              ['tree', 't', () => host('t').querySelector('ul.aui-tree-select__tree')]]) {
                await openByMouse(id);
                type(search(id), 'a');
                await sleep(50);
                const at = {bubbles: true, screenX: 200, screenY: 300, clientX: 120, clientY: 220};
                target().dispatchEvent(new MouseEvent('mousemove', at));
                target().dispatchEvent(new MouseEvent('mousemove', at));
                await sleep(20);
                const same = highlight(id);
                target().dispatchEvent(new MouseEvent('mousemove', Object.assign({}, at, {screenX: 210, screenY: 306})));
                await sleep(20);
                out[name] = {same, moved: highlight(id)};
                await close();
            }
            return out;
        });

    T('E8 Backspace while deleting the text, then held in the empty box, removes nothing (both components)',
        {select: [3, 7], tree: ['n-Apple', 'n-Date']},
        async () => {
            apply(s => { s.m.sel = [3, 7]; s.m.tree = ['n-Apple', 'n-Date']; });
            for (const id of ['s', 't']) {
                await openByMouse(id);
                type(search(id), 'ap');
                key(search(id), 'Backspace');
                type(search(id), 'a');
                key(search(id), 'Backspace');
                type(search(id), '');
                key(search(id), 'Backspace');
                hold(search(id), 'Backspace', 8);
                key(search(id), 'Delete');
                await sleep(50);
                await close();
            }
            return {select: model('sel'), tree: model('tree')};
        });

    T('E10 clear from the keyboard: focus stays on the field (the button hides), and the held key opens nothing (both components)',
        {select: {model: [], focus: 'trigger', open: false}, tree: {model: [], focus: 'trigger', open: false}},
        async () => {
            apply(s => { s.m.sel = [3, 7]; s.m.tree = ['n-Apple', 'n-Date']; });
            await sleep(50);
            const out = {};
            for (const [name, id, field] of [['select', 's', 'sel'], ['tree', 't', 'tree']]) {
                const button = host(id).querySelector('.aui-control-clear');
                button.focus();
                key(button, 'Enter');
                await sleep(30);
                hold(document.activeElement, 'Enter', 3);
                await sleep(250);
                out[name] = {model: model(field), focus: document.activeElement === trig(id) ? 'trigger' : (document.activeElement || {}).tagName,
                    open: ctrl(id).isOpen};
            }
            return out;
        });

    T('E9 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-* family: keys never change a selection you cannot see', tests, {delay: 0});
})();
