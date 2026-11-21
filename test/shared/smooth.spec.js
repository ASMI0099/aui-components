// Smooth suite (page: smooth.html, fixture: smooth.fixture.js), aui-select and aui-tree-select (aui-input at the end):
// - a close from the user's input starts at once, with a digest of the component only, in which the page's code runs
//   (touched, on-close, a picked value with its ng-change / on-change): before the page's own handlers of the same
//   press or key, even one that removes the field; the page's bindings follow in one digest of the whole page, after
//   the close's first frame (a value) or once its motion has ended (no value); the next input anywhere runs it first;
// - keys that only move the highlight, typing a server search and a tree's own search digest no page;
// - a second press on the field right after the first one is a press of its own; a closed select keeps no rows;
// - aui-if (in place of ng-if in the templates) starts no digest of the page when it removes its content;
// - an opening asks the page only for what it needs (loading, lookups, on-open): a static field or a loaded list
//   that is recent digests no page at all;
// - aui-select's hidden validation input is no Tab stop; aui-input's box takes none of the field's ng-model-options.
(function () {
    const {sleep, outside, key, type} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select, #' + id + ' aui-tree-select, #' + id + ' aui-input');
    const isTree = id => host(id).tagName.toLowerCase() === 'aui-tree-select';
    const ctrl = id => angular.element(host(id)).controller(isTree(id) ? 'auiTreeSelect' : 'auiSelect');
    const ngm = id => angular.element(host(id)).controller('ngModel');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const panel = id => host(id).querySelector('.aui-select__panel');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const digests = () => window.__pageDigests;
    const log = () => scope().log.slice();
    const clearLog = () => { scope().log.length = 0; };
    const mouse = (el, typeName) => el.dispatchEvent(new MouseEvent(typeName, {bubbles: true, cancelable: true, button: 0}));
    /** A press on the trigger and its release (mousedown, mouseup, click). */
    function click(el) {
        mouse(el, 'mousedown');
        mouse(el, 'mouseup');
        mouse(el, 'click');
    }
    /** A press of the user on the page element (pointerdown, mousedown, mouseup, click), as the browser sends it. */
    function userClick(el) {
        if (typeof PointerEvent === 'function') el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true, button: 0}));
        click(el);
    }
    /** Text typed into a search box: its value and an input event. */
    const typeSearch = (box, text) => {
        box.value = text;
        box.dispatchEvent(new Event('input', {bubbles: true}));
    };
    const rowTexts = id => Array.prototype.map.call(host(id).querySelectorAll('li.aui-select__option'), li => li.textContent.trim());
    const focusIn = id => (document.activeElement && host(id).contains(document.activeElement) ? document.activeElement : trig(id));
    const row = (id, text) => Array.prototype.find.call(host(id).querySelectorAll('li.aui-select__option'),
        li => (li.querySelector('.aui-tree-select__label') || li).textContent.trim() === text);
    async function open(id) { click(trig(id)); await sleep(300); }
    async function settled() { outside(); await sleep(450); }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});
    const TT = (name, expect, fn) => tests.push({name, expect, fn, timing: true});

    TT('Z1 a press outside closes at once with the component\'s own digest: no page digest in the press, touched and on-close at once; one page digest after the motion (both components)',
        {select: {now: {open: false, closing: true, pageDigests: 0, touched: true, onClose: ['close s']}, later: {pageDigests: 1, onClose: ['close s']}},
         tree: {now: {open: false, closing: true, pageDigests: 0, touched: true, onClose: ['close t']}, later: {pageDigests: 1, onClose: ['close t']}}},
        async () => {
            const out = {};
            for (const [name, id] of [['select', 's'], ['tree', 't']]) {
                await open(id);
                clearLog();
                const before = digests();
                outside();
                const now = {open: ctrl(id).isOpen, closing: panel(id).style.opacity === '0', pageDigests: digests() - before,
                    touched: ngm(id).$touched, onClose: log()};
                await sleep(500);
                out[name] = {now, later: {pageDigests: digests() - before, onClose: log()}};
                apply(s => { s.f[id].$setUntouched(); });
            }
            return out;
        });

    TT('Z2 the next input runs the digest a close still owes the page first: the page\'s bindings are current when it handles that press',
        {order: ['close s', 'next'], digestFirst: 1, once: ['close s', 'next']},
        async () => {
            await open('s');
            clearLog();
            const before = digests();
            outside();
            await sleep(40);   // within the close's motion: the page's digest still waits
            userClick(document.getElementById('next'));
            const order = log();
            const digestFirst = scope().nextAt - before;
            await sleep(450);
            return {order, digestFirst, once: log()};
        });

    TT('Z3 an option picked: the panel closes and the value reaches the page at once, in the field\'s own digest (no page digest in the click); on-close before on-change; the page\'s digest after the first frame',
        {now: {open: false, closing: true, model: 3, pageDigests: 0, log: ['close s', 'change s']}, soon: 3, later: {log: ['close s', 'change s'], pageDigests: 1}},
        async () => {
            apply(s => { s.m.s = null; });
            await open('s');
            clearLog();
            const before = digests();
            click(row('s', 'Apple').querySelector('span') || row('s', 'Apple'));
            const now = {open: ctrl('s').isOpen, closing: panel('s').style.opacity === '0', model: scope().m.s, pageDigests: digests() - before, log: log()};
            await sleep(120);
            const soon = scope().m.s;
            await sleep(450);
            return {now, soon, later: {log: log(), pageDigests: digests() - before}};
        });

    TT('Z4 Escape closes at once (no page digest in the key) and keeps the focus on the field; on-close at once (both components)',
        {select: {now: {open: false, pageDigests: 0, focused: true, onClose: ['close s']}, onClose: ['close s']},
         tree: {now: {open: false, pageDigests: 0, focused: true, onClose: ['close t']}, onClose: ['close t']}},
        async () => {
            const out = {};
            for (const [name, id] of [['select', 's'], ['tree', 't']]) {
                await open(id);
                clearLog();
                const before = digests();
                key(document.activeElement && host(id).contains(document.activeElement) ? document.activeElement : trig(id), 'Escape');
                const now = {open: ctrl(id).isOpen, pageDigests: digests() - before, focused: trig(id).contains(document.activeElement), onClose: log()};
                await sleep(450);
                out[name] = {now, onClose: log()};
            }
            return out;
        });

    TT('Z5 an opening asks the page only for what it needs: a static field none; load-options: no page digest in the press (the panel paints first), the page right after the first frame (the request goes out then), one load; reopened while recent: no page digest, no load (both)',
        {static: 0, select: {inPress: 0, afterFrame: true, loads: 1, reopened: {pageDigests: 0, loads: 1}}, tree: {inPress: 0, afterFrame: true, loads: 1, reopened: {pageDigests: 0, loads: 1}}},
        async () => {
            const out = {};
            let before = digests();
            await open('s');
            out.static = digests() - before;
            await settled();
            for (const [name, id, counter] of [['select', 'r', 'loads'], ['tree', 'rt', 'treeLoads']]) {
                before = digests();
                mouse(trig(id), 'mousedown');
                const inPress = digests() - before;
                mouse(trig(id), 'mouseup');
                mouse(trig(id), 'click');
                await sleep(300);
                const afterFrame = digests() - before > 0;
                const loads = scope()[counter];
                await settled();
                before = digests();
                await open(id);
                out[name] = {inPress, afterFrame, loads, reopened: {pageDigests: digests() - before, loads: scope()[counter]}};
                await settled();
            }
            return out;
        });

    TT('Z10 a branch opened or closed by the user digests only the tree when its data is at hand (load-options): caret, a row that only opens, ArrowRight / ArrowLeft',
        {caret: 0, row: 0, keys: 0, opened: true},
        async () => {
            await open('rt');
            await sleep(100);
            let before = digests();
            mouse(row('rt', 'Group').querySelector('.aui-tree-select__caret'), 'click');
            const caret = digests() - before;
            const opened = !!row('rt', 'Apple');
            before = digests();
            mouse(row('rt', 'Group'), 'click');
            const rowToggle = digests() - before;
            before = digests();
            key(focusIn('rt'), 'ArrowRight');
            key(focusIn('rt'), 'ArrowLeft');
            const keys = digests() - before;
            await settled();
            return {caret, row: rowToggle, keys, opened};
        });

    TT('Z11 a lazy branch opened by the user: its loading row in the press, no page digest and no load-children call yet; the call right after the frame (one page digest); the children arrive',
        {inPress: {pageDigests: 0, calls: 0, busy: true}, afterFrame: {calls: 1}, children: true},
        async () => {
            await open('lz');
            await sleep(200);
            const calls0 = scope().kidLoads;
            const folder = row('lz', 'Folder.1');
            const before = digests();
            mouse(folder.querySelector('.aui-tree-select__caret'), 'click');
            const inPress = {pageDigests: digests() - before, calls: scope().kidLoads - calls0,
                busy: row('lz', 'Folder.1').classList.contains('aui-tree-select__node--loading')};
            await sleep(150);
            const afterFrame = {calls: scope().kidLoads - calls0};
            await sleep(150);
            const children = !!row('lz', 'Folder.1.1');
            await settled();
            return {inPress, afterFrame, children};
        });

    TT('Z12 on-open and on-expand: none in the press (no page digest), each right after the frame; a close before that frame: on-open before on-close',
        {press: {log: [], pageDigests: 0}, afterFrame: ['open ex'], expand: {inPress: [], afterFrame: ['expand true']}, quickClose: ['open ex', 'close ex']},
        async () => {
            clearLog();
            const before = digests();
            mouse(trig('ex'), 'mousedown');
            mouse(trig('ex'), 'mouseup');
            mouse(trig('ex'), 'click');
            const press = {log: log(), pageDigests: digests() - before};
            await sleep(150);
            const afterFrame = log();
            clearLog();
            mouse(row('ex', 'Group').querySelector('.aui-tree-select__caret'), 'click');
            const expandNow = log();
            await sleep(150);
            const expand = {inPress: expandNow, afterFrame: log()};
            await settled();
            clearLog();
            mouse(trig('ex'), 'mousedown');
            mouse(trig('ex'), 'mouseup');
            mouse(trig('ex'), 'click');
            outside();
            await sleep(450);
            return {press, afterFrame, expand, quickClose: log()};
        });

    TT('Z13 removed before the frame (ng-if): the waiting page calls are dropped, and no on-close (the page never heard of the opening); no error; shown again it opens as usual',
        {calls: [], errors: 0, reopened: ['open ex']},
        async () => {
            await settled();
            clearLog();
            const errors0 = window.__ngErrors.length;
            mouse(trig('ex'), 'mousedown');
            mouse(trig('ex'), 'mouseup');
            mouse(trig('ex'), 'click');
            apply(s => { s.show.ex = false; });
            await sleep(200);
            const calls = log();
            apply(s => { s.show.ex = true; });
            await sleep(50);
            clearLog();
            await open('ex');
            const reopened = log().filter(x => x.indexOf('open') === 0);
            await settled();
            return {calls, errors: window.__ngErrors.length - errors0, reopened};
        });

    TT('Z14 an answer of load-options: the digest of the page it arrives in runs one pass (the rows shown after it, in the component\'s own digest; before, they made it run a second pass over the whole page); a value then known reaches selected-items',
        {select: {passes: 1, rows: true, items: 'Yam'}, tree: {passes: 1, rows: true, items: 'Yam'}},
        async () => {
            const out = {};
            for (const [name, id, value, items] of [['select', 'r2', 2, 'r2Items'], ['tree', 'rt2', 'n-Yam', 'rt2Items']]) {
                await settled();
                await open(id);
                await sleep(400);
                const passes = window.__pagePasses - window.__passesAtAnswer;
                const rows = host(id).querySelectorAll('li.aui-select__option').length > 0;
                await settled();
                apply(s => { s.m[id] = value; });
                await sleep(50);
                const list = scope().m[items] || [];
                out[name] = {passes, rows, items: list.length ? String(list[0].label) : null};
            }
            return out;
        });

    T('Z6 aui-if: a value set by the page removes the placeholder with no further page digest; the value shows',
        {extra: 0, placeholder: false, text: 'Yam'},
        async () => {
            apply(s => { s.m.s = null; });
            await sleep(100);
            const before = digests();
            apply(s => { s.m.s = 2; });
            const ownApply = digests() - before;
            await sleep(150);
            return {extra: digests() - before - ownApply, placeholder: !!host('s').querySelector('.aui-select__placeholder'),
                text: host('s').querySelector('.aui-select__display-text').textContent.trim()};
        });

    T('Z7 aui-select\'s hidden validation input is no Tab stop, as the tree\'s',
        {select: {tab: -1, hidden: 'true'}, tree: {tab: -1, hidden: 'true'}},
        async () => {
            const read = id => { const i = host(id).querySelector('.aui-select__hidden-input'); return {tab: i.tabIndex, hidden: i.getAttribute('aria-hidden')}; };
            return {select: read('s'), tree: read('t')};
        });

    T('Z8 aui-input with ng-model-options on the field: updateOn blur takes the text when the box is left; a debounce waits once, not twice',
        {beforeBlur: 'undefined', afterBlur: 'xyz', debounceOnce: true},
        async () => {
            const box = id => host(id).querySelector('input');
            type(box('ub'), 'xyz');
            await sleep(50);
            const beforeBlur = String(scope().m.ub);
            box('ub').dispatchEvent(new FocusEvent('blur'));
            const afterBlur = String(scope().m.ub);
            const t0 = performance.now();
            type(box('db'), 'abc');
            let at = null;
            while (performance.now() - t0 < 700 && at === null) {
                await sleep(10);
                if (scope().m.db === 'abc') at = performance.now() - t0;
            }
            return {beforeBlur, afterBlur, debounceOnce: at !== null && at < 280};
        });

    TT('Z9 a press outside on a page button: on-close before the button\'s click, also when that click removes the field; once (both components)',
        {select: {save: ['close rm s', 'save'], cancel: ['close rm s', 'cancel'], removed: true, later: ['close rm s', 'cancel']},
         tree: {save: ['close rm t', 'save'], cancel: ['close rm t', 'cancel'], removed: true, later: ['close rm t', 'cancel']}},
        async () => {
            const out = {};
            for (const [name, id] of [['select', 'rms'], ['tree', 'rmt']]) {
                apply(s => { s.show.rm = true; });
                await sleep(50);
                await open(id);
                clearLog();
                userClick(document.getElementById('save'));
                const save = log();
                await sleep(450);
                await open(id);
                clearLog();
                userClick(document.getElementById('cancel'));
                const cancel = log();
                const removed = !host(id);
                await sleep(450);
                out[name] = {save, cancel, removed, later: log()};
            }
            apply(s => { s.show.rm = true; });
            await sleep(50);
            return out;
        });

    TT('Z10 Enter picks a value: the page\'s own key handler of that Enter sees the new value (both components)',
        {select: {seen: 2, model: 2}, tree: {seen: 'f-Yam', model: 'f-Yam'}},
        async () => {
            const out = {};
            for (const [name, id, field] of [['select', 'ks', 'ks'], ['tree', 'kt', 'kt']]) {
                await open(id);
                scope().keyLog.length = 0;
                key(focusIn(id), 'ArrowDown');
                await sleep(30);
                key(focusIn(id), 'Enter');
                const seen = scope().keyLog.length ? scope().keyLog[0][field] : 'no Enter seen';
                await sleep(450);
                out[name] = {seen, model: scope().m[field]};
            }
            return out;
        });

    TT('Z11 keys that only move the highlight digest no page (load-options: both components; load-children); typing a server search digests the page only when it starts and when it is answered',
        {arrows: {select: 0, tree: 0, lazy: 0}, typing: 0, search: 2, found: true},
        async () => {
            const arrows = {};
            for (const [name, id] of [['select', 'r'], ['tree', 'rt'], ['lazy', 'lz']]) {
                await open(id);
                await sleep(100);   // its rows (load-options, load-children) are in
                const before = digests();
                for (let i = 0; i < 4; i++) key(focusIn(id), 'ArrowDown');
                await sleep(80);
                arrows[name] = digests() - before;
                await settled();
            }
            await open('ps');
            await sleep(100);
            const box = host('ps').querySelector('.aui-select__search-input');
            const before = digests();
            for (const text of ['1', '12', '123']) {
                typeSearch(box, text);
                await sleep(30);
            }
            const typing = digests() - before;
            await sleep(450);   // search-delay 300 ms, then the answer
            const search = digests() - before;
            const found = rowTexts('ps').indexOf('Item 123') >= 0;
            await settled();
            return {arrows, typing, search, found};
        });

    TT('Z12 the in-browser search of a tree of 2,000 nodes or more (it waits for typing to pause) digests no page',
        {typing: 0, afterSearch: 0, found: true},
        async () => {
            await open('bt');
            const box = host('bt').querySelector('.aui-select__search-input');
            const before = digests();
            typeSearch(box, 'Leaf 707');
            const typing = digests() - before;
            await sleep(300);
            const afterSearch = digests() - before;
            const found = Array.prototype.some.call(host('bt').querySelectorAll('li.aui-tree-select__node'), li => li.textContent.indexOf('Leaf 707') >= 0);
            await settled();
            return {typing, afterSearch, found};
        });

    T('Z13 a second press on the field right after the first one (input sent by a script) closes it',
        {openAfterFirst: true, closed: true},
        async () => {
            mouse(trig('s'), 'mousedown');
            mouse(trig('s'), 'mouseup');
            mouse(trig('s'), 'click');
            const openAfterFirst = ctrl('s').isOpen;
            mouse(trig('s'), 'mousedown');
            await sleep(15);   // the first press's reset runs here
            mouse(trig('s'), 'mouseup');
            mouse(trig('s'), 'click');
            await sleep(400);
            return {openAfterFirst, closed: !ctrl('s').isOpen};
        });

    TT('Z15 several values picked one after another with the panel open: each value and its ng-change at once, no digest of the page per pick; the page bindings in one digest once the picking pauses; input elsewhere runs it first (both components)',
        {select: {during: {pageDigests: 0, changes: 3, model: 3, binding: '0'}, paused: {pageDigests: 1, binding: '3'}, elsewhere: {beforeNext: 1, binding: '4'}},
         tree: {during: {pageDigests: 0, changes: 3, model: 3, binding: '0'}, paused: {pageDigests: 1, binding: '3'}, elsewhere: {beforeNext: 1, binding: '4'}}},
        async () => {
            const out = {};
            for (const [name, id, labels] of [['select', 'ms', ['Apple', 'Banana', 'Cherry', 'Date']], ['tree', 'mt', ['Apple', 'Banana', 'Cherry', 'Date']]]) {
                apply(s => { s.m[id] = []; });
                await open(id);
                clearLog();
                const d0 = digests();
                for (let i = 0; i < 3; i += 1) {
                    row(id, labels[i]).click();
                    await sleep(120);
                }
                const during = {pageDigests: digests() - d0, changes: log().filter(e => e === 'change ' + id).length,
                    model: (scope().m[id] || []).length, binding: document.getElementById(id + '-count').textContent.trim()};
                await sleep(450);
                const paused = {pageDigests: digests() - d0, binding: document.getElementById(id + '-count').textContent.trim()};
                const d1 = digests();
                row(id, labels[3]).click();
                await sleep(30);
                userClick(document.getElementById('next'));
                await sleep(30);
                const elsewhere = {beforeNext: scope().nextAt - d1, binding: document.getElementById(id + '-count').textContent.trim()};
                await settled();
                out[name] = {during, paused, elsewhere};
            }
            return out;
        });

    TT('Z16 field and panel close as one: their joined corners stay square while the panel fades out and are rounded once it has (both components)',
        {select: {open: true, closing: true, closed: false}, tree: {open: true, closing: true, closed: false}},
        async () => {
            const out = {};
            for (const [name, id] of [['select', 's'], ['tree', 't']]) {
                await open(id);
                const joined = () => trig(id).classList.contains('aui-select__trigger--bottom') || trig(id).classList.contains('aui-select__trigger--top');
                const isOpen = joined();
                outside();
                await sleep(60);
                const closing = joined();
                await sleep(400);
                out[name] = {open: isOpen, closing, closed: joined()};
            }
            return out;
        });

    T('Z14 a closed select keeps no rows (none are built at its close); its next opening shows all of them',
        {searched: 1, closed: 0, reopened: 10},
        async () => {
            await open('s');
            typeSearch(host('s').querySelector('.aui-select__search-input'), 'Yam');
            await sleep(50);
            const searched = ctrl('s').rows.length;
            await settled();
            const closed = ctrl('s').rows.length + ctrl('s').filteredOptions.length + ctrl('s').viewRows.length;
            await open('s');
            const reopened = ctrl('s').rows.length;
            await settled();
            return {searched, closed, reopened};
        });

    T('E1 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-* family: smooth opening and closing', tests, {delay: 0});
})();
