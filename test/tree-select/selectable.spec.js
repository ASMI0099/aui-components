// aui-tree-select selectable-field suite (page: selectable.html, fixture: selectable.fixture.js): groups
// (selectable: false) are shown and can be opened, but never become a value, in every mode.
(function () {
    const {sleep, type, key, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-tree-select');
    const ctrl = id => angular.element(host(id)).controller('auiTreeSelect');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const searchBox = id => host(id).querySelector('.aui-select__search-input');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const model = name => angular.copy(scope().m[name]);
    const rowEl = (id, label) => Array.prototype.slice.call(host(id).querySelectorAll('li.aui-tree-select__node'))
        .find(li => li.querySelector('.aui-tree-select__label').textContent.trim() === label);
    const row = (id, label) => ctrl(id).rows.find(r => !r.more && r.node.label === label);
    const visible = id => ctrl(id).rows.filter(r => !r.more).map(r => r.node.label);
    const hasCheckbox = (id, label) => !!rowEl(id, label).querySelector('.aui-tree-select__checkbox');
    const click = async (id, label) => { rowEl(id, label).click(); await sleep(30); };
    const display = id => {
        const el = host(id).querySelector('.aui-select__display-text');
        return el ? el.textContent.trim() : null;
    };
    const tags = id => Array.from(host(id).querySelectorAll('.aui-select__selected-display > .aui-select__tags > .aui-select__tag:not(.aui-select__tag--count)'))
        .map(t => t.textContent.trim());
    const stateOf = (id, label) => {
        const li = rowEl(id, label);
        return {
            group: li.classList.contains('aui-tree-select__node--group'),
            checked: li.classList.contains('aui-tree-select__node--checked'),
            half: li.classList.contains('aui-tree-select__node--half'),
            selected: li.classList.contains('aui-select__option--selected'),
            ariaChecked: li.getAttribute('aria-checked')
        };
    };
    const errCount = () => window.__ngErrors.length;
    async function open(id) { trig(id).click(); await sleep(40); }
    async function close() { outside(); await sleep(400); }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('G1 without selectable-field the same data behaves as before: a node marked selectable: false can be picked',
        {groups: 0, model: 1},
        async () => {
            await open('s-off');
            const groups = ctrl('s-off').rows.filter(r => r.node.group).length;
            await click('s-off', 'Electronics');
            await sleep(300);
            return {groups, model: model('off')};
        });

    T('G2 single: a click on a group opens it and keeps the panel and the value; a child under it can be picked',
        {afterGroup: {model: '', open: true, expanded: true, state: {group: true, checked: false, half: false, selected: false, ariaChecked: null}},
            afterPhones: ['Electronics', 'Phones', 'Smartphones', 'Feature phones', 'Laptops', 'Empty group', 'Books', 'Garden'],
            model: 111, open: false, changes: 1},
        async () => {
            await open('s-single');
            await click('s-single', 'Electronics');
            const afterGroup = {model: model('single'), open: ctrl('s-single').isOpen, expanded: row('s-single', 'Electronics').expanded,
                state: stateOf('s-single', 'Electronics')};
            await click('s-single', 'Phones');
            const afterPhones = visible('s-single');
            await click('s-single', 'Smartphones');
            await sleep(300);
            return {afterGroup, afterPhones, model: model('single'), open: ctrl('s-single').isOpen, changes: scope().changes};
        });

    T('G3 single, keyboard: Enter on a group closes or opens it, the value stays',
        {active: 'Phones', expanded: false, model: 111, open: true},
        async () => {
            await open('s-single');
            key(trig('s-single'), 'ArrowUp');
            await sleep(30);
            const c = ctrl('s-single');
            const active = c.rows.find(r => r.sid === c.activeSid).node.label;
            key(trig('s-single'), 'Enter');
            await sleep(30);
            const r = {active, expanded: row('s-single', 'Phones').expanded, model: model('single'), open: c.isOpen};
            await close();
            return r;
        });

    T('G4 auto-select-on-single-required picks the only node that can be picked, never its group',
        {model: 91},
        async () => {
            await sleep(1100);
            return {model: model('auto')};
        });

    T('G5 check-strictly: groups have no checkbox and no aria-checked; a click opens or closes them; only real nodes become values',
        {groupCheckbox: false, nodeCheckbox: true, phonesExpanded: false, ariaChecked: null, model: [121]},
        async () => {
            await open('s-strict');
            const groupCheckbox = hasCheckbox('s-strict', 'Electronics');
            const nodeCheckbox = hasCheckbox('s-strict', 'Laptops');
            const ariaChecked = rowEl('s-strict', 'Phones').getAttribute('aria-checked');
            await click('s-strict', 'Phones');
            const phonesExpanded = row('s-strict', 'Phones').expanded;
            await click('s-strict', 'Ultrabooks');
            const r = {groupCheckbox, nodeCheckbox, phonesExpanded, ariaChecked, model: model('strict')};
            await close();
            return r;
        });

    T('G6 linked (all): every child of a group checked gives those children; the group shows no check state; a group without children does not stop its parent',
        {first: [111, 112], phones: {group: true, checked: false, half: false, selected: false, ariaChecked: null},
            model: [111, 112, 12, 121, 122], tags: ['Smartphones', 'Feature phones', 'Laptops']},
        async () => {
            await open('s-all');
            await click('s-all', 'Smartphones');
            await click('s-all', 'Feature phones');
            const first = model('all');
            const phones = stateOf('s-all', 'Phones');
            await click('s-all', 'Laptops');
            const r = {first, phones, model: model('all'), tags: tags('s-all')};
            await close();
            return r;
        });

    T('G7 linked (parent): a checked node covers the group under it; unchecking inside the group keeps the rest; checking it again gives the parent',
        {first: [2], afterUncheck: [21, 222], tags: ['Fiction', 'Biology'], afterRecheck: [2]},
        async () => {
            await open('s-parent');
            await click('s-parent', 'Books');
            const first = model('parent');
            await click('s-parent', 'Physics');
            const afterUncheck = model('parent');
            const tagsNow = tags('s-parent');
            await click('s-parent', 'Physics');
            const r = {first, afterUncheck, tags: tagsNow, afterRecheck: model('parent')};
            await close();
            return r;
        });

    T('G8 linked (parent): everything under a top group checked gives the topmost real nodes, never the group',
        {model: [111, 112, 12], tags: ['Smartphones', 'Feature phones', 'Laptops']},
        async () => {
            apply(s => { s.m.parent = []; });
            await open('s-parent');
            await click('s-parent', 'Smartphones');
            await click('s-parent', 'Feature phones');
            await click('s-parent', 'Laptops');
            const r = {model: model('parent'), tags: tags('s-parent')};
            await close();
            return r;
        });

    T('G9 linked (child): the bottom-most real nodes; groups (also those without children) never',
        {model: [21, 221, 222]},
        async () => {
            await open('s-child');
            await click('s-child', 'Books');
            const r = {model: model('child')};
            await close();
            return r;
        });

    T('G10 saved group value (linked): it stands for the nodes under it; the model is written only on a user change',
        {tags: ['Smartphones', 'Feature phones'], before: [11], after: [111, 112, 121]},
        async () => {
            const before = model('mLinked');
            const tagsNow = tags('s-mlinked');
            await open('s-mlinked');
            await click('s-mlinked', 'Ultrabooks');
            const r = {tags: tagsNow, before, after: model('mLinked')};
            await close();
            return r;
        });

    T('G11 saved group without children (linked): it stays itself as a removable tag',
        {tags: ['Archive'], after: []},
        async () => {
            const tagsNow = tags('s-minert');
            host('s-minert').querySelector('.aui-select__tag-remove').click();
            await sleep(30);
            return {tags: tagsNow, after: model('mInert')};
        });

    T('G12 saved group value (single): shown with its label and kept',
        {display: 'Phones', model: 11},
        async () => {
            await open('s-msingle');
            await close();
            return {display: display('s-msingle'), model: model('mSingle')};
        });

    T('G13 saved group value (check-strictly): a removable tag',
        {tags: ['Phones'], after: []},
        async () => {
            const tagsNow = tags('s-mstrict');
            host('s-mstrict').querySelector('.aui-select__tag-remove').click();
            await sleep(30);
            return {tags: tagsNow, after: model('mStrict')};
        });

    T('G14 disabled-values: a group whose children are all disabled no longer keeps its parent from counting as fully checked',
        {before: [21], booksBefore: false, booksAfter: true, modelAfterDisable: [21], afterRecheck: [2, 21]},
        async () => {
            await open('s-dis');
            await click('s-dis', 'Fiction');
            const before = model('dis');
            const booksBefore = stateOf('s-dis', 'Books').checked;
            apply(s => { s.disabledValues = [221, 222]; });
            await sleep(30);
            const booksAfter = stateOf('s-dis', 'Books').checked;
            const modelAfterDisable = model('dis');
            await click('s-dis', 'Fiction');
            await click('s-dis', 'Fiction');
            const r = {before, booksBefore, booksAfter, modelAfterDisable, afterRecheck: model('dis')};
            await close();
            return r;
        });

    T('G15 selectable-field set later: the tree is indexed again; the value stays',
        {before: 1, groups: 5, after: 1, open: true, display: 'Electronics'},
        async () => {
            await open('s-toggle');
            await click('s-toggle', 'Electronics');
            await sleep(300);
            const before = model('toggle');
            apply(s => { s.p.sf = 'selectable'; });
            await sleep(30);
            await open('s-toggle');
            const groups = ctrl('s-toggle').rows.filter(r => r.node.group).length;
            await click('s-toggle', 'Electronics');
            const r = {before, groups, after: model('toggle'), open: ctrl('s-toggle').isOpen, display: display('s-toggle')};
            await close();
            return r;
        });

    T('G16 lazy: a click on a group loads and opens it; a child below can be picked',
        {roots: ['Electronics', 'Books', 'Garden'], afterPhones: ['Smartphones', 'Feature phones'], model: 111},
        async () => {
            await open('s-lazy');
            await sleep(150);
            const roots = visible('s-lazy');
            await click('s-lazy', 'Electronics');
            await sleep(150);
            await click('s-lazy', 'Phones');
            await sleep(150);
            const afterPhones = visible('s-lazy').filter(l => l === 'Smartphones' || l === 'Feature phones');
            await click('s-lazy', 'Smartphones');
            await sleep(300);
            return {roots, afterPhones, model: model('lazy')};
        });

    T('G17 server search: group rows in the results have no checkbox; a click opens or closes them; a result below can be checked',
        {rows: ['Books', 'Science shelf', 'Physics'], groupCheckbox: false, nodeCheckbox: true, model: [221], afterGroupClick: [221], collapsed: false},
        async () => {
            await open('s-remote');
            await sleep(150);
            type(searchBox('s-remote'), 'phys');
            await sleep(250);
            const rows = visible('s-remote');
            const groupCheckbox = hasCheckbox('s-remote', 'Science shelf');
            const nodeCheckbox = hasCheckbox('s-remote', 'Physics');
            await click('s-remote', 'Physics');
            const after = model('remote');
            await click('s-remote', 'Science shelf');
            const r = {rows, groupCheckbox, nodeCheckbox, model: after, afterGroupClick: model('remote'),
                collapsed: row('s-remote', 'Science shelf').expanded};
            await close();
            return r;
        });

    T('G18 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: errCount()}));

    AuiTest.run('aui-tree-select: selectable-field', tests);
})();
