// aui-tree-select label suite (page: labels.html, fixture: labels.fixture.js): a selected value keeps its label and
// path when its node is not loaded any more (other load-params), as aui-select keeps picked options. Loaded data comes
// first; a value that is no longer selected leaves nothing behind.
(function () {
    const {sleep, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-tree-select');
    const ctrl = id => angular.element(host(id)).controller('auiTreeSelect');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const display = id => {
        const el = host(id).querySelector('.aui-select__display-text');
        return el ? el.textContent.trim() : null;
    };
    const tags = id => Array.from(host(id).querySelectorAll('.aui-select__selected-display > .aui-select__tags > .aui-select__tag:not(.aui-select__tag--count)'))
        .map(t => t.textContent.trim());
    const rowEl = (id, label) => Array.prototype.slice.call(host(id).querySelectorAll('li.aui-tree-select__node'))
        .find(li => li.querySelector('.aui-tree-select__label').textContent.trim() === label);
    async function open(id) { trig(id).click(); await sleep(200); }
    async function close() { outside(); await sleep(350); }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('L1 single: a value picked in hall A keeps its label and path in hall B (no request just for the label), also once B is loaded',
        {picked: 'Electronics / Smartphones', inB: 'Electronics / Smartphones', bLoaded: 'Electronics / Smartphones', model: 'a11'},
        async () => {
            await open('t-single');
            rowEl('t-single', 'Smartphones').click();
            await sleep(300);
            const picked = display('t-single');
            apply(s => { s.p.hall = 'B'; });
            await sleep(30);
            const inB = display('t-single');
            await open('t-single');             // B's tree loads now
            await sleep(150);
            const bLoaded = display('t-single');
            await close();
            return {picked, inB, bLoaded, model: scope().m.single};
        });

    T('L2 loaded data comes first: once a tree where the node has another name is loaded, that name is shown',
        {renamed: 'Electronics / Smartphones 2026'},
        async () => {
            apply(s => { s.p.hall = 'A2'; });
            await open('t-single');             // A2's tree loads: the node is there, renamed
            await sleep(150);
            const renamed = display('t-single');
            await close();
            return {renamed};
        });

    T('L3 multiple: tags and selected-items keep the labels in hall B',
        {tagsA: ['Smartphones', 'Chargers'], tagsB: ['Smartphones', 'Chargers'], items: ['Smartphones', 'Chargers'], model: ['a11', 'a13']},
        async () => {
            apply(s => { s.p.hall = 'A'; });
            await sleep(250);
            await open('t-multi');
            rowEl('t-multi', 'Smartphones').click();
            await sleep(30);
            rowEl('t-multi', 'Chargers').click();
            await sleep(30);
            const tagsA = tags('t-multi');
            await close();
            apply(s => { s.p.hall = 'B'; });
            await sleep(300);
            return {tagsA, tagsB: tags('t-multi'), items: scope().items.multi.map(i => i.name), model: angular.copy(scope().m.multi)};
        });

    T('L4 a value set by the page, shown from the loaded tree, keeps its label after the hall changes',
        {inA: 'Feature phones', inB: 'Feature phones'},
        async () => {
            apply(s => { s.p.hall = 'A'; });
            await sleep(250);
            apply(s => { s.m.model = 'a12'; });
            await sleep(50);
            const inA = display('t-model');
            apply(s => { s.p.hall = 'B'; });
            await sleep(250);
            return {inA, inB: display('t-model')};
        });

    T('L5 a value that is no longer selected leaves nothing behind: set again where its node is not loaded, it is the bare value',
        {cleared: null, again: 'a12'},
        async () => {
            apply(s => { s.m.model = ''; });
            await sleep(50);
            const cleared = display('t-model');
            apply(s => { s.m.model = 'a12'; });
            await sleep(50);
            return {cleared, again: display('t-model')};
        });

    T('L6 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-tree-select: labels of selected values', tests, {delay: 0});
})();
