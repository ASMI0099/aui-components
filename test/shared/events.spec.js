// Events suite (page: events.html, fixture: events.fixture.js), aui-select and aui-tree-select:
// - the trigger opens and closes on the press of the primary button (the click of that press is no second toggle;
//   a click without a press toggles); presses on a tag's x and on the clear button are left to their click;
// - opening a static field digests only the component; closing, choosing and page callbacks digest the page;
// - the search box (no ng-model): filtering without a page digest, the page form stays pristine, input methods;
// - the row directives: state, ARIA, and the one click listener choosing the row that was clicked;
// - the focus ring only for keyboard use: focused after pointer input the trigger looks unfocused until a key is pressed.
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
    const rows = id => Array.prototype.slice.call(host(id).querySelectorAll('li.aui-select__option'));
    const rowText = li => (li.querySelector('.aui-tree-select__label') || li).textContent.replace(/\s+/g, ' ').trim();
    const mouse = (el, typeName, button) => el.dispatchEvent(new MouseEvent(typeName, {bubbles: true, cancelable: true, button: button || 0}));
    /** A press: mousedown on the element; release() lets go (mouseup, then the click of that press). */
    function press(el, button) {
        mouse(el, 'mousedown', button);
        return function release() {
            mouse(el, 'mouseup', button);
            if (!button) mouse(el, 'click', button);
        };
    }
    async function close() { outside(); await sleep(350); }
    const QUIET = 'aui-select__trigger--pointer-focus';
    /** The trigger's focus look: focused, quiet (focused after pointer input), the border colour, ring and shadows it
     *  shows (the box and its skins: AuiTest.fieldLook). */
    function look(id) {
        const t = trig(id);
        const shown = AuiTest.fieldLook(t);
        return {focused: t.contains(document.activeElement), quiet: t.classList.contains(QUIET), border: shown.border,
            ring: shown.ring, shadow: shown.shadow, halo: shown.halo};
    }
    /** A choice made with the mouse on a row: mousedown, mouseup, click. */
    function mouseChoose(li) {
        const target = li.querySelector('.aui-tree-select__label') || li.querySelector('span') || li;
        ['mousedown', 'mouseup', 'click'].forEach(name => mouse(target, name));
    }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('P1 a press opens the field before the button is let go; the click of that press does not close it (both components)',
        {select: {onPress: true, afterClick: true}, tree: {onPress: true, afterClick: true}},
        async () => {
            const out = {};
            for (const [name, id] of [['select', 's'], ['tree', 't']]) {
                const release = press(trig(id));
                await sleep(30);
                const onPress = ctrl(id).isOpen;
                release();
                await sleep(30);
                out[name] = {onPress, afterClick: ctrl(id).isOpen};
                await close();
            }
            return out;
        });

    T('P2 a second press closes; a click without a press (element.click()) still opens and closes (both components)',
        {select: {pressClosed: true, clickOpened: true, clickClosed: true}, tree: {pressClosed: true, clickOpened: true, clickClosed: true}},
        async () => {
            const out = {};
            for (const [name, id] of [['select', 's'], ['tree', 't']]) {
                press(trig(id))();
                await sleep(250);
                press(trig(id))();
                await sleep(350);
                const pressClosed = !ctrl(id).isOpen;
                trig(id).click();
                await sleep(250);
                const clickOpened = ctrl(id).isOpen;
                trig(id).click();
                await sleep(350);
                out[name] = {pressClosed, clickOpened, clickClosed: !ctrl(id).isOpen};
            }
            return out;
        });

    T('P3 pressing a tag x or the clear button opens nothing; their click removes / clears (both components)',
        {select: {openOnX: false, afterX: [7], openOnClear: false, afterClear: []}, tree: {openOnX: false, afterX: [], openOnClear: false}},
        async () => {
            const out = {};
            let x = host('sm').querySelector('.aui-select__tag-remove');
            press(x)();
            await sleep(60);
            out.select = {openOnX: ctrl('sm').isOpen, afterX: model('multi')};
            let clear = host('sm').querySelector('.aui-control-clear');
            press(clear)();
            await sleep(60);
            out.select.openOnClear = ctrl('sm').isOpen;
            out.select.afterClear = model('multi');
            x = host('tm').querySelector('.aui-select__tag-remove');
            press(x)();
            await sleep(60);
            out.tree = {openOnX: ctrl('tm').isOpen, afterX: model('treeMulti')};
            apply(s => { s.m.treeMulti = ['n-Apple']; s.m.multi = [3, 7]; });
            await sleep(30);
            clear = host('tm').querySelector('.aui-control-clear');
            press(clear)();
            await sleep(60);
            out.tree.openOnClear = ctrl('tm').isOpen;
            apply(s => { s.m.treeMulti = ['n-Apple']; });
            await sleep(30);
            return out;
        });

    T('P4 a right-button press opens nothing',
        {select: false, tree: false},
        async () => {
            press(trig('s'), 2)();
            press(trig('t'), 2)();
            await sleep(60);
            return {select: ctrl('s').isOpen, tree: ctrl('t').isOpen};
        });

    T('P5 the press gives the trigger the focus; then the search box has it (aui-select after a moment, the tree at once, kept)',
        {select: {first: 'trigger', then: 'search'}, tree: {then: 'search'}},
        async () => {
            const where = id => document.activeElement === trig(id) ? 'trigger' : (document.activeElement === search(id) ? 'search' : (document.activeElement || {}).tagName);
            const release = press(trig('s'));
            const first = where('s');
            release();
            await sleep(250);
            const out = {select: {first, then: where('s')}};
            await close();
            press(trig('t'))();
            await sleep(250);
            out.tree = {then: where('t')};
            await close();
            return out;
        });

    T('D1 opening a static field digests only the component; closing it (touched) digests the page',
        {select: {open: 0, close: true}, tree: {open: 0, close: true}},
        async () => {
            const out = {};
            for (const [name, id] of [['select', 's'], ['tree', 't']]) {
                // no field keeps the focus: a field losing it is marked touched, which digests the page (rightly)
                if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                await sleep(80);
                const before = window.__pageDigests;
                press(trig(id))();
                await sleep(250);
                const open = window.__pageDigests - before;
                const beforeClose = window.__pageDigests;
                press(trig(id))();
                await sleep(350);
                out[name] = {open, close: window.__pageDigests > beforeClose};
            }
            return out;
        });

    T('D2 a field with on-open digests the page when it opens: the page shows what the callback changed',
        {opened: '1', open: true},
        async () => {
            press(trig('h'))();
            await sleep(250);
            const r = {opened: document.getElementById('opened').textContent.trim(), open: ctrl('h').isOpen};
            await close();
            return r;
        });

    T('D3 typing in the search box filters without a page digest, and the page form stays pristine (aui-select and tree)',
        {select: {rows: ['Apple', 'Apricot', 'Grape', 'Papaya'], digests: 0, pristine: true, fieldDirty: false},
         tree: {matches: ['Apple', 'Apricot', 'Grape', 'Papaya'], digests: 0, pristine: true}},
        async () => {
            const out = {};
            apply(s => { s.f.$setPristine(); });   // earlier checks changed values (the form is dirty from those)
            press(trig('s'))();
            await sleep(250);
            let before = window.__pageDigests;
            type(search('s'), 'ap');
            await sleep(60);
            out.select = {rows: rows('s').map(rowText), digests: window.__pageDigests - before, pristine: scope().f.$pristine,
                fieldDirty: angular.element(host('s')).controller('ngModel').$dirty};
            await close();
            press(trig('t'))();
            await sleep(250);
            before = window.__pageDigests;
            type(search('t'), 'ap');
            await sleep(80);
            out.tree = {matches: rows('t').map(rowText).filter(t => t !== 'Group'), digests: window.__pageDigests - before, pristine: scope().f.$pristine};
            await close();
            return out;
        });

    T('D4 an input method: nothing is taken while composing, the text when the composition ends; reopening shows an empty box',
        {whileComposing: 10, afterEnd: ['Grape'], reopened: ''},
        async () => {
            press(trig('s'))();
            await sleep(250);
            const box = search('s');
            box.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
            box.value = 'gra';
            box.dispatchEvent(new Event('input', {bubbles: true}));
            await sleep(60);
            const whileComposing = rows('s').length;
            box.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, data: 'gra'}));
            await sleep(60);
            const afterEnd = rows('s').map(rowText);
            await close();
            press(trig('s'))();
            await sleep(250);
            const reopened = search('s').value;
            await close();
            return {whileComposing, afterEnd, reopened};
        });

    T('D5 Enter on the highlighted match chooses it and digests the page (the page shows the value)',
        {value: 3, shown: '3|'},
        async () => {
            press(trig('s'))();
            await sleep(250);
            type(search('s'), 'appl');
            await sleep(60);
            key(search('s'), 'Enter');
            await sleep(80);
            return {value: model('single'), shown: document.getElementById('shown').textContent.trim()};
        });

    T('R1 aui-select rows: selected state and ARIA follow the value; a click on a filtered row chooses exactly that row',
        {selected: {apple: 'true', cls: true, other: 'false'}, clicked: [3, 7, 4]},
        async () => {
            apply(s => { s.m.multi = [3, 7]; });
            press(trig('sm'))();
            await sleep(250);
            const apple = rows('sm').find(li => rowText(li) === 'Apple');
            const fig = rows('sm').find(li => rowText(li) === 'Zucchini');
            const selected = {apple: apple.getAttribute('aria-selected'), cls: apple.classList.contains('aui-select__option--selected'),
                other: fig.getAttribute('aria-selected')};
            type(search('sm'), 'ap');
            await sleep(60);
            const second = rows('sm')[1];   // Apricot (id 4)
            second.querySelector('span').dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
            await sleep(60);
            const clicked = model('multi');
            await close();
            return {selected, clicked};
        });

    T('R2 tree rows: search hits in the label, checkboxes and aria-checked in multiple mode, aria-selected in single mode',
        {hits: ['Ap', 'Ap', 'ap', 'ap'], checkbox: true, appleChecked: 'true', groupChecked: 'mixed', singleSelected: 'false'},
        async () => {
            press(trig('tm'))();
            await sleep(250);
            const group = rows('tm').find(li => rowText(li) === 'Group');
            const groupChecked = group.getAttribute('aria-checked');
            const checkbox = !!group.querySelector('.aui-tree-select__checkbox');
            type(search('tm'), 'ap');
            await sleep(80);
            const apple = rows('tm').find(li => rowText(li) === 'Apple');
            const hits = Array.prototype.map.call(host('tm').querySelectorAll('li .aui-select__hit'), el => el.textContent);
            const r = {hits, checkbox, appleChecked: apple.getAttribute('aria-checked'), groupChecked};
            await close();
            press(trig('t'))();
            await sleep(250);
            r.singleSelected = rows('t')[0].getAttribute('aria-selected');
            await close();
            return r;
        });

    T('F1 after a choice made with the mouse the trigger keeps the focus without the ring; Shift keeps it quiet, any other key shows the ring (both components)',
        {select: {focused: true, quiet: true, ring: false, resting: true, afterShift: true, afterKey: false, ringAfterKey: true, blurred: false},
            tree: {focused: true, quiet: true, ring: false, resting: true, afterShift: true, afterKey: false, ringAfterKey: true, blurred: false}},
        async () => {
            const out = {};
            for (const [name, id] of [['select', 's'], ['tree', 't']]) {
                const resting = look(id).border;
                press(trig(id))();
                await sleep(250);
                mouseChoose(rows(id)[0]);
                await sleep(350);
                const chosen = look(id);
                key(trig(id), 'Shift');
                await sleep(30);
                const afterShift = look(id).quiet;
                key(trig(id), 'ArrowLeft');
                await sleep(300);
                const afterKey = look(id);
                trig(id).blur();
                await sleep(30);
                out[name] = {focused: chosen.focused, quiet: chosen.quiet, ring: chosen.ring, resting: chosen.border === resting,
                    afterShift, afterKey: afterKey.quiet, ringAfterKey: afterKey.ring, blurred: look(id).quiet};
            }
            return out;
        });

    T('F2 focused from the keyboard the trigger shows the 2px ring (border and a 1px inner ring) at once (both components)',
        {select: {focused: true, quiet: false, ring: true, inner: true}, tree: {focused: true, quiet: false, ring: true, inner: true}},
        async () => {
            const out = {};
            for (const [name, id] of [['select', 's'], ['tree', 't']]) {
                key(document.body, 'Tab');
                trig(id).focus();
                await sleep(300);
                const l = look(id);
                out[name] = {focused: l.focused, quiet: l.quiet, ring: l.ring, inner: l.shadow.indexOf('1px inset') !== -1};
                trig(id).blur();
                await sleep(30);
            }
            return out;
        });

    T('F3 a field without a search box: open after a press it has the open look; closed by a press it keeps the focus and looks as without it; closed with Escape it shows the ring',
        {open: {open: true, focused: true, ring: true, openBorder: true}, pressed: {open: false, focused: true, quiet: true, asUnfocused: true},
            escape: {open: false, quiet: false, focusLook: true}},
        async () => {
            const resting = look('few').border;
            press(trig('few'))();
            await sleep(300);
            const o = look('few');
            const open = {open: ctrl('few').isOpen, focused: o.focused, ring: o.ring, openBorder: o.border !== resting};
            press(trig('few'))();
            await sleep(350);
            const p = look('few');
            const isOpen = ctrl('few').isOpen;
            trig('few').blur();
            await sleep(350);
            const u = look('few');
            const pressed = {open: isOpen, focused: p.focused, quiet: p.quiet, asUnfocused: p.border === u.border && p.shadow === u.shadow};
            press(trig('few'))();
            await sleep(300);
            key(trig('few'), 'Escape');
            await sleep(350);
            const e = look('few');
            const escape = {open: ctrl('few').isOpen, quiet: e.quiet, focusLook: e.border !== u.border || e.shadow !== u.shadow};
            await close();
            return {open, pressed, escape};
        });

    T('F4 an invalid field (touched, empty) focused after a press stays red: the resting red while quiet, the 2px red ring after a key',
        {invalid: true, quiet: true, quietRed: true, quietShadow: true, afterKey: false, keyShadow: true, keyInner: true},
        async () => {
            apply(s => { s.f.few.$setTouched(); });
            press(trig('few'))();
            await sleep(300);
            press(trig('few'))();
            await sleep(350);
            const q = look('few');
            key(trig('few'), 'ArrowLeft');
            await sleep(300);
            const k = look('few');
            await close();
            return {invalid: trig('few').classList.contains('aui-select__trigger--invalid'), quiet: q.quiet,
                quietRed: q.border === 'rgb(220, 53, 69)', quietShadow: q.halo === 0.12,
                afterKey: k.quiet, keyShadow: k.halo === 0.2, keyInner: k.shadow.indexOf('rgb(220, 53, 69) 0px 0px 0px 1px inset') !== -1};
        });

    T('E1 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-* family: press, digests, search box, rows', tests, {delay: 0});
})();
