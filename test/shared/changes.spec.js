// Changes suite (page: changes.html, fixture: changes.fixture.js): on-change of aui-select, aui-tree-select and aui-input
// tells what changed the value (triggerSource) and whether the user did (byUser), with the value and the value before:
// - a pick with the pointer ('option') or the keyboard ('keyboard'), a tag removed ('remove-tag'), the clear button
//   ('clear'), typing ('input'): by the user; the api ('api'), auto-select-on-single-required ('auto-select') and
//   reset-on-params ('params-reset'): not;
// - on-change as a function reference gets one object (selectedValues as before, value, oldValue, option / node,
//   triggerSource, byUser); as a call, the locals $value, $oldValue, $triggerSource, $byUser ($items / $option,
//   $nodes / $node);
// - the selects' native "change" event carries {value, oldValue, triggerSource, byUser} in its detail;
// - a tree's DOM handler run from page code inside a digest starts no digest of its own ($rootScope:inprog).
(function () {
    const {sleep, outside, key, type} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select, #' + id + ' aui-tree-select, #' + id + ' aui-input');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const search = id => host(id).querySelector('.aui-select__search-input');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const box = id => host(id).querySelector('input.aui-input__form-field');
    const row = (id, text) => Array.prototype.find.call(host(id).querySelectorAll('li.aui-select__option'),
        li => (li.querySelector('.aui-tree-select__label') || li).textContent.replace(/\s+/g, ' ').trim() === text);
    const entries = name => scope().log.filter(e => e.name === name);
    const last = name => { const all = entries(name); return all[all.length - 1] || null; };
    /** Forgets the calls of these fields (the others stay: auto-select's comes a second after the page loads) */
    const clearLog = (...names) => { const log = scope().log; for (let i = log.length - 1; i >= 0; i -= 1) if (names.indexOf(log[i].name) >= 0) log.splice(i, 1); };
    async function open(id) { trig(id).click(); await sleep(250); }
    async function close() { outside(); await sleep(350); }
    /** What a reference-form call was given, the fields this suite looks at */
    const ref = name => {
        const e = last(name);
        if (!e) return null;
        const c = e.change;
        const sel = c.selectedValues;
        return {form: e.form, triggerSource: c.triggerSource, byUser: c.byUser, value: c.value, oldValue: c.oldValue,
            option: c.option ? c.option.id : (c.node ? c.node.id : null),
            selected: Array.isArray(sel) ? sel.map(x => x.id) : (sel ? sel.id : null)};
    };
    const call = name => {
        const e = last(name);
        if (!e) return null;
        const l = e.locals;
        return {form: e.form, triggerSource: l.triggerSource, byUser: l.byUser, value: l.value, oldValue: l.oldValue,
            option: l.option ? l.option.id : (l.node ? l.node.id : null)};
    };

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('C1 aui-select: a pick with the pointer and one with the keyboard; on-change as a reference (one object, selectedValues as before) and as a call (locals)',
        {pointer: {form: 'reference', triggerSource: 'option', byUser: true, value: 3, oldValue: null, option: 3, selected: 3},
         keyboard: {form: 'call', triggerSource: 'keyboard', byUser: true, value: 3, oldValue: null, option: 3}},
        async () => {
            clearLog('s', 'sc');
            await open('s');
            row('s', 'Apple').click();
            await sleep(350);
            const pointer = ref('s');
            await open('sc');
            type(search('sc'), 'ap');
            await sleep(60);
            key(search('sc'), 'Enter');
            await sleep(350);
            return {pointer, keyboard: call('sc')};
        });

    T('C2 aui-select, several values: a tag removed, the clear button (values in disabled-values stay), the api; the value before each',
        {tag: {form: 'reference', triggerSource: 'remove-tag', byUser: true, value: [7], oldValue: [3, 7], option: 3, selected: [7]},
         clear: {form: 'reference', triggerSource: 'clear', byUser: true, value: [], oldValue: [7], option: null, selected: []},
         api: {form: 'reference', triggerSource: 'api', byUser: false, value: [], oldValue: [1], option: null, selected: []}},
        async () => {
            clearLog('sm');
            host('sm').querySelector('.aui-select__tag-remove').click();
            await sleep(60);
            const tag = ref('sm');
            host('sm').querySelector('.aui-control-clear').click();
            await sleep(60);
            const clear = ref('sm');
            apply(s => { s.m.sm = [1]; });
            await sleep(60);
            apply(s => { s.api.sm.clear(); });
            await sleep(60);
            return {tag, clear, api: ref('sm')};
        });

    T('C3 aui-select: the only option chosen by auto-select-on-single-required, and a value emptied by reset-on-params: not by the user',
        {auto: {form: 'reference', triggerSource: 'auto-select', byUser: false, value: 7, oldValue: null, option: 7, selected: 7},
         reset: {form: 'reference', triggerSource: 'params-reset', byUser: false, value: '', oldValue: 2, option: null, selected: null}},
        async () => {
            await sleep(1300);   // auto-select waits a second after the options arrive
            const auto = ref('sa');
            apply(s => { s.params = {hall: 2}; });
            await sleep(80);
            return {auto, reset: ref('sp')};
        });

    T('C4 aui-select: the native change event of the element carries what made the change',
        {detail: {value: 9, oldValue: 3, triggerSource: 'option', byUser: true}},
        async () => {
            let detail = null;
            const listener = e => { detail = e.detail ? {value: e.detail.value, oldValue: e.detail.oldValue, triggerSource: e.detail.triggerSource, byUser: e.detail.byUser} : 'none'; };
            host('s').addEventListener('change', listener);
            await open('s');
            row('s', 'Date').click();
            await sleep(350);
            host('s').removeEventListener('change', listener);
            return {detail};
        });

    T('C5 aui-tree-select: a pick with the pointer (reference form: node and selectedValues) and with the keyboard (call form); several values: a tag, the clear button, the api',
        {pointer: {form: 'reference', triggerSource: 'option', byUser: true, value: 'f-Apple', oldValue: null, option: 'f-Apple', selected: 'f-Apple'},
         keyboard: {form: 'call', triggerSource: 'keyboard', byUser: true, value: 'f-Apple', oldValue: null, option: 'f-Apple'},
         tag: {form: 'reference', triggerSource: 'remove-tag', byUser: true, value: ['f-Fig'], oldValue: ['f-Apple', 'f-Fig'], option: 'f-Apple', selected: ['f-Fig']},
         clear: {form: 'reference', triggerSource: 'clear', byUser: true, value: [], oldValue: ['f-Fig'], option: null, selected: []},
         api: {form: 'reference', triggerSource: 'api', byUser: false, value: [], oldValue: ['f-Date'], option: null, selected: []}},
        async () => {
            clearLog('t', 'tc', 'tm');
            await open('t');
            row('t', 'Apple').click();
            await sleep(350);
            const pointer = ref('t');
            await open('tc');
            type(search('tc'), 'ap');
            await sleep(450);   // the tree's own search waits for typing to pause
            key(search('tc'), 'Enter');
            await sleep(350);
            const keyboard = call('tc');
            host('tm').querySelector('.aui-select__tag-remove').click();
            await sleep(60);
            const tag = ref('tm');
            host('tm').querySelector('.aui-control-clear').click();
            await sleep(60);
            const clear = ref('tm');
            apply(s => { s.m.tm = ['f-Date']; });
            await sleep(60);
            apply(s => { s.api.tm.clear(); });
            await sleep(60);
            return {pointer, keyboard, tag, clear, api: ref('tm')};
        });

    T('C6 aui-input: typing, the clear button, the api; the text before each; on-change as a call and as a reference',
        {typing: {form: 'call', triggerSource: 'input', byUser: true, value: 'abc', oldValue: 'ab', option: null},
         clear: {form: 'call', triggerSource: 'clear', byUser: true, value: '', oldValue: 'abc', option: null},
         api: {form: 'call', triggerSource: 'api', byUser: false, value: '', oldValue: 'new', option: null},
         reference: {form: 'reference', triggerSource: 'input', byUser: true, value: 'xyz', oldValue: 'xy', option: null, selected: null}},
        async () => {
            clearLog('i', 'ir');
            box('i').focus();
            type(box('i'), 'abc');
            await sleep(60);
            const typing = call('i');
            host('i').querySelector('.aui-control-clear').click();
            await sleep(60);
            const clear = call('i');
            apply(s => { s.m.i = 'new'; });
            await sleep(60);
            apply(s => { s.api.i.clear(); });
            await sleep(60);
            const api = call('i');
            box('ir').focus();
            type(box('ir'), 'xyz');
            await sleep(60);
            box('ir').blur();
            return {typing, clear, api, reference: ref('ir')};
        });

    T('C7 aui-tree-select: a click on a row run by page code inside a digest starts no digest of its own (no $rootScope:inprog error)',
        {errors: [], expanded: true},
        async () => {
            const before = AuiTest.angularErrors().length;
            await open('te');
            const caret = host('te').querySelector('li.aui-select__option .aui-tree-select__caret');
            apply(() => { caret.click(); });
            await sleep(80);
            const expanded = scope().expandedLog.length > 0;
            await close();
            return {errors: AuiTest.angularErrors().slice(before), expanded};
        });

    AuiTest.run('aui-* family: on-change, what made a change', tests);
})();
