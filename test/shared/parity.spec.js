// Behaviour parity: the same scenario on aui-select and on aui-tree-select must give the same result.
(function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const frames = n => new Promise(res => { let k = 0; (function f() { if (++k > n) res(); else requestAnimationFrame(f); })(); });
    const scope = () => window.unifyScope;
    const apply = fn => scope().$apply(fn);
    const host = id => document.querySelector('#h-' + id + ' aui-select, #h-' + id + ' aui-tree-select');
    const ctrl = id => { const el = angular.element(host(id)); return el.controller('auiSelect') || el.controller('auiTreeSelect'); };
    const ngm = id => angular.element(host(id)).controller('ngModel');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const key = (el, k, extra) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({key: k, bubbles: true, cancelable: true}, extra || {})));
    const isOpen = id => !!ctrl(id).isOpen;
    const close = async id => { if (isOpen(id)) { key(trig(id), 'Escape'); await sleep(400); } };
    const describe = el => !el ? 'none' : (el === document.body ? 'body' : el.tagName.toLowerCase() + '.' + String(el.className).split(' ').filter(c => c.indexOf('aui') === 0)[0]);
    const both = async (fn) => ({select: await fn('r1'), tree: await fn('r3')});

    const checks = [
        ['O1 focus moves to another field while open (Tab)', () => both(async id => {
            trig(id).focus();
            trig(id).click();
            await sleep(350);
            document.getElementById('after').focus();
            await sleep(350);
            const out = {stillOpen: isOpen(id)};
            await close(id);
            return out;
        })],
        ['O2 open and close without choosing: dirty / touched', () => both(async id => {
            apply(() => { ngm(id).$setPristine(); ngm(id).$setUntouched(); scope().f.$setPristine(); });
            trig(id).click();
            await sleep(350);
            const whileOpen = {dirty: ngm(id).$dirty, touched: ngm(id).$touched, invalidBorder: trig(id).classList.contains('aui-select__trigger--invalid')};
            await close(id);
            return {whileOpen, afterClose: {dirty: ngm(id).$dirty, touched: ngm(id).$touched, formDirty: scope().f.$dirty}};
        })],
        ['O3 focus then leave without opening (keyboard pass): touched', () => both(async id => {
            apply(() => { ngm(id).$setPristine(); ngm(id).$setUntouched(); });
            trig(id).focus();
            await sleep(50);
            document.getElementById('after').focus();
            await sleep(100);
            return {touched: ngm(id).$touched, invalidBorder: trig(id).classList.contains('aui-select__trigger--invalid')};
        })],
        ['O4 locked (disabled) selected value: tag remove button, clear all', async () => {
            const s = {};
            const r2 = host('r2');
            const tag2 = Array.from(r2.querySelectorAll('.aui-select__selected-display > .aui-select__tags > .aui-select__tag'))
                .find(t => t.textContent.indexOf('Option 2') !== -1);
            s.select = {lockedTagHasRemove: !!(tag2 && tag2.querySelector('.aui-select__tag-remove'))};
            if (tag2 && tag2.querySelector('.aui-select__tag-remove')) { tag2.querySelector('.aui-select__tag-remove').click(); await sleep(50); }
            s.select.modelAfterRemoveLocked = scope().m.r2.slice();
            apply(() => { scope().m.r2 = [2, 3]; });
            await frames(2);
            r2.querySelector('.aui-control-clear').click();
            await sleep(50);
            s.select.modelAfterClear = scope().m.r2.slice();
            const r4 = host('r4');
            const lockedTree = Array.from(r4.querySelectorAll('.aui-select__selected-display > .aui-select__tags > .aui-select__tag'))
                .find(t => t.textContent.indexOf('Store 0-0-0') !== -1);
            s.tree = {lockedTagHasRemove: !!(lockedTree && lockedTree.querySelector('.aui-select__tag-remove'))};
            r4.querySelector('.aui-control-clear').click();
            await sleep(50);
            s.tree.modelAfterClear = scope().m.r4.slice();
            return s;
        }],
        ['O5 Escape inside an aui-modal with the dropdown open', async () => {
            const out = {};
            for (const id of ['m1', 'm2']) {
                apply(() => { scope().show.modal = true; });
                await sleep(500);
                trig(id).click();
                await sleep(400);
                const target = host(id).querySelector('.aui-select__search-input') || trig(id);
                target.focus();
                key(target, 'Escape');
                await sleep(450);
                out[id === 'm1' ? 'select' : 'tree'] = {dropdownOpen: isOpen(id), modalStillOpen: !!scope().show.modal};
                apply(() => { scope().show.modal = false; });
                await sleep(500);
            }
            return out;
        }],
        ['O6 where focus goes after choosing an option with the mouse', () => both(async id => {
            trig(id).focus();
            trig(id).click();
            await sleep(400);
            const row = host(id).querySelectorAll(id === 'r1' ? 'li.aui-select__option' : 'li.aui-tree-select__node')[3];
            row.click();
            await sleep(450);
            return {open: isOpen(id), focus: describe(document.activeElement)};
        })],
        ['O7 becomes disabled while open', () => both(async id => {
            trig(id).click();
            await sleep(350);
            apply(() => { scope().flags[id] = true; });
            await sleep(350);
            const out = {stillOpen: isOpen(id)};
            apply(() => { scope().flags[id] = false; });
            await sleep(100);
            await close(id);
            return out;
        })],
        ['O8 digests caused by one mousedown on the page (10 + 3 closed aui-selects)', async () => {
            const $root = angular.element(document.body).injector().get('$rootScope');
            const original = $root.$digest;
            let count = 0;
            $root.$digest = function () { count++; return original.apply(this, arguments); };
            document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
            await sleep(50);
            $root.$digest = original;
            return {rootDigests: count};
        }],
        ['O9 the selected option is scrolled into view when opening', () => both(async id => {
            apply(() => { scope().m[id] = id === 'r1' ? 90 : 'r1-9-9'; });
            await frames(2);
            trig(id).click();
            await sleep(450);
            const list = host(id).querySelector('ul.aui-select__options');
            const sel = host(id).querySelector('.aui-select__option--selected');
            let visible = false;
            if (sel && list) {
                const lr = list.getBoundingClientRect(), sr = sel.getBoundingClientRect();
                visible = sr.top >= lr.top - 1 && sr.bottom <= lr.bottom + 1;
            }
            await close(id);
            return {selectedRendered: !!sel, selectedVisible: visible};
        })],
        ['O10 choose with the keyboard only (Enter to open, ArrowDown x2, Enter)', () => both(async id => {
            apply(() => { scope().m[id] = null; });
            await frames(2);
            trig(id).focus();
            key(trig(id), 'Enter');
            await sleep(400);
            const target = document.activeElement;
            key(target, 'ArrowDown');
            await sleep(30);
            key(document.activeElement, 'ArrowDown');
            await sleep(30);
            key(document.activeElement, 'Enter');
            await sleep(400);
            const out = {value: scope().m[id], open: isOpen(id)};
            await close(id);
            return out;
        })],
        ['O11 long labels: tooltip on the cut-off option and on the trigger text', () => both(async id => {
            apply(() => { scope().m[id] = id === 'r1' ? 1 : 'r0'; });
            await frames(2);
            const text = host(id).querySelector('.aui-select__display-text');
            const triggerTitle = text ? (text.getAttribute('title') || '') : '';
            trig(id).click();
            await sleep(400);
            const row = host(id).querySelector(id === 'r1' ? 'li.aui-select__option' : 'li.aui-tree-select__node');
            row.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            await sleep(30);
            const rowTitle = row.getAttribute('title') || '';
            await close(id);
            return {triggerHasTitle: triggerTitle.length > 0, cutOffRowHasTitle: rowTitle.length > 0};
        })]
    ];

    const activeLabel = id => { const li = host(id).querySelector('li.aui-select__option--active'); return li ? li.textContent.trim() : null; };
    checks.push(
        ['N1 aui-select options: search-placeholder, empty-text, panel-min-width, selected-labels; locked tag', async () => {
            trig('r5').click();
            await sleep(400);
            const input = host('r5').querySelector('.aui-select__search-input');
            const placeholder = input.placeholder;
            input.value = 'zzz';
            input.dispatchEvent(new Event('input', {bubbles: true}));
            await sleep(80);
            const emptyEl = host('r5').querySelector('.aui-select__no-results');
            const width = host('r5').querySelector('.aui-select__panel').getBoundingClientRect().width;
            const tagEls = Array.from(host('r5').querySelectorAll('.aui-select__selected-display > .aui-select__tags > .aui-select__tag'));
            const out = {placeholder, empty: emptyEl ? emptyEl.textContent.trim() : null, widthAtLeast420: width >= 419.5,
                tags: tagEls.map(t => t.textContent.trim()), locked: tagEls.map(t => t.classList.contains('aui-select__tag--locked'))};
            input.value = '';
            input.dispatchEvent(new Event('input', {bubbles: true}));
            await close('r5');
            return out;
        }],
        ['N2 keyboard on a list without search box: End, Home, typeahead, aria-activedescendant, Enter', async () => {
            const t = trig('r6');
            t.focus();
            key(t, 'Enter');
            await sleep(400);
            const noSearch = !host('r6').querySelector('.aui-select__search-input');
            key(document.activeElement, 'End');
            await sleep(30);
            const end = activeLabel('r6');
            key(document.activeElement, 'Home');
            await sleep(30);
            const home = activeLabel('r6');
            key(document.activeElement, 'b');
            await sleep(30);
            const typed = activeLabel('r6');
            const li = host('r6').querySelector('li.aui-select__option--active');
            const aria = t.getAttribute('aria-activedescendant');
            const ariaOk = !!li && aria === li.id && host('r6').querySelector('.aui-select__panel').classList.contains('aui-select__panel--keyboard');
            key(document.activeElement, 'Enter');
            await sleep(400);
            return {noSearch, end, home, typed, ariaOk, value: scope().m.r6, open: isOpen('r6'), focus: describe(document.activeElement)};
        }],
        ['N3 multiple: Enter toggles and stays open, Backspace in the empty search box removes nothing (also held), Alt+ArrowUp closes', async () => {
            apply(() => { scope().m.r5 = [99, 3]; });
            await frames(2);
            trig('r5').click();
            await sleep(400);
            const search = host('r5').querySelector('.aui-select__search-input');
            search.focus();
            key(search, 'ArrowDown');
            await sleep(30);
            key(search, 'Enter');
            await sleep(80);
            const afterEnter = scope().m.r5.slice();
            const stillOpen = isOpen('r5');
            key(search, 'Backspace');
            await sleep(80);
            const afterBackspace = scope().m.r5.slice();
            for (let i = 0; i < 5; i += 1) key(search, 'Backspace', {repeat: true});   // a held key
            key(search, 'Delete');
            await sleep(80);
            const afterBackspace2 = scope().m.r5.slice();
            key(search, 'ArrowUp', {altKey: true});
            await sleep(400);
            return {afterEnter, stillOpen, afterBackspace, afterBackspace2, closed: !isOpen('r5'), focus: describe(document.activeElement)};
        }]
    );

    // What both components must do (aui-select now matches aui-tree-select).
    const EXPECT = {
        O1: {select: {stillOpen: false}, tree: {stillOpen: false}},
        O2: {select: {whileOpen: {dirty: false, touched: false, invalidBorder: false}, afterClose: {dirty: false, touched: true, formDirty: false}},
             tree: {whileOpen: {dirty: false, touched: false, invalidBorder: false}, afterClose: {dirty: false, touched: true, formDirty: false}}},
        O3: {select: {touched: true, invalidBorder: true}, tree: {touched: true, invalidBorder: true}},
        O4: {select: {lockedTagHasRemove: false, modelAfterRemoveLocked: [2, 3], modelAfterClear: [2]},
             tree: {lockedTagHasRemove: false, modelAfterClear: ['r0-0-0']}},
        O5: {select: {dropdownOpen: false, modalStillOpen: true}, tree: {dropdownOpen: false, modalStillOpen: true}},
        O6: {select: {open: false, focus: 'div.aui-select__trigger'}, tree: {open: false, focus: 'div.aui-select__trigger'}},
        O7: {select: {stillOpen: false}, tree: {stillOpen: false}},
        O8: {rootDigests: 0},
        O9: {select: {selectedRendered: true, selectedVisible: true}, tree: {selectedRendered: true, selectedVisible: true}},
        O10: {select: {value: 3, open: false}, tree: {value: 'r0-0-0', open: false}},
        // aui-select rows are one line: its long first option is cut off and gets the full label as a tooltip (the tree's
        // first row is short, so it has none).
        O11: {select: {triggerHasTitle: true, cutOffRowHasTitle: true}, tree: {triggerHasTitle: true, cutOffRowHasTitle: false}},
        N1: {placeholder: 'Find a fruit', empty: 'Nothing here', widthAtLeast420: true, tags: ['Archived fruit', 'Grape'], locked: [false, true]},
        N2: {noSearch: true, end: 'Cherry', home: 'Apple', typed: 'Banana', ariaOk: true, value: 4, open: false, focus: 'div.aui-select__trigger'},
        N3: {afterEnter: [99, 3, 4], stillOpen: true, afterBackspace: [99, 3, 4], afterBackspace2: [99, 3, 4], closed: true, focus: 'div.aui-select__trigger'}
    };

    AuiTest.run('aui-* family: parity', checks.map(function (check) {
        return {name: check[0], expect: EXPECT[check[0].split(' ')[0]], fn: check[1]};
    }), {delay: 400});
})();
