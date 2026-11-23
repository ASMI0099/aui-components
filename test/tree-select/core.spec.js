// aui-tree-select core suite (page: core.html, fixture: core.fixture.js) on the AngularJS 1.5.3 + jQuery + Floating UI stack.
(function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const host = id => document.querySelector('#' + id + ' aui-tree-select');
    const ctrl = id => angular.element(host(id)).controller('auiTreeSelect');
    const ngm = id => angular.element(host(id)).controller('ngModel');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const panel = id => host(id).querySelector('.aui-select__panel');
    const searchBox = id => host(id).querySelector('.aui-select__search-input');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const rowEl = (id, label) => Array.prototype.slice.call(host(id).querySelectorAll('li.aui-tree-select__node'))
        .find(li => li.querySelector('.aui-tree-select__label').textContent.trim() === label);
    const caretOf = (id, label) => rowEl(id, label).querySelector('.aui-tree-select__caret');
    const labels = id => ctrl(id).rows.map(r => '  '.repeat(r.depth) + r.node.label);
    const tagTexts = id => Array.prototype.slice.call(host(id).querySelectorAll('.aui-select__tag')).map(t => t.textContent.trim());
    const key = (el, k, extra) => {
        const ev = new KeyboardEvent('keydown', Object.assign({key: k, bubbles: true, cancelable: true}, extra || {}));
        el.dispatchEvent(ev);
        return ev;
    };
    const outside = () => document.body.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}));
    const type = (input, text) => { input.value = text; input.dispatchEvent(new Event('input', {bubbles: true})); };
    async function open(id) { trig(id).click(); await sleep(250); }
    async function close() { outside(); await sleep(300); }
    const errCount = () => window.__ngErrors.length;

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});
    // a check of an animation's timing: run again (3 runs in all) when a busy machine drops the frames it samples
    const TT = (name, expect, fn) => tests.push({name, expect, fn, timing: true});

    // ------------------------------------------------------------------ single
    T('S1 initial value shows its label; opening reveals and activates it; search box gets focus',
        {display: 'iOS', rows: ['Electronics', '  Phones', '    Android', '    iOS', '    Accessories', '  Laptops', '  Cameras', 'Books', 'Garden', 'Home & Kitchen', 'A very long category name that does not fit into the dropdown width at all'], active: 'iOS', focus: true, opens: 1},
        async () => {
            const display = host('t-single').querySelector('.aui-select__display-text').textContent.trim();
            await open('t-single');
            const c = ctrl('t-single');
            const active = c.rows.find(r => r.sid === c.activeSid);
            const r = {display, rows: labels('t-single'), active: active && active.node.label, focus: document.activeElement === searchBox('t-single'), opens: scope().counts.open};
            await close();
            return r;
        });

    T('S2 click a row: model, label, closes, focus back on trigger, on-change(fn) payload, change event, .val()',
        {model: 12, display: 'Laptops', open: false, focusTrigger: true, payloadId: 12, events: 1, val: '12', closes: 1, dirty: true},
        async () => {
            let events = 0;
            const onNative = () => { events += 1; };
            host('t-single').addEventListener('change', onNative);
            const closesBefore = scope().counts.close;
            await open('t-single');
            rowEl('t-single', 'Laptops').click();
            await sleep(300);
            host('t-single').removeEventListener('change', onNative);
            const s = scope();
            const last = s.changes[s.changes.length - 1];
            return {
                model: s.m.single, display: host('t-single').querySelector('.aui-select__display-text').textContent.trim(),
                open: ctrl('t-single').isOpen, focusTrigger: document.activeElement === trig('t-single'),
                payloadId: last && last.selectedValues && last.selectedValues.id, events, val: String($(host('t-single')).val()),
                closes: s.counts.close - closesBefore, dirty: ngm('t-single').$dirty
            };
        });

    T('S3 clicking the selected row again changes nothing (no change event) and closes',
        {events: 0, changes: 0, open: false},
        async () => {
            let events = 0;
            const onNative = () => { events += 1; };
            host('t-single').addEventListener('change', onNative);
            const before = scope().changes.length;
            await open('t-single');
            rowEl('t-single', 'Laptops').click();
            await sleep(300);
            host('t-single').removeEventListener('change', onNative);
            return {events, changes: scope().changes.length - before, open: ctrl('t-single').isOpen};
        });

    T('S4 caret toggles a branch without selecting; on-expand fires',
        {model: 12, afterOpen: true, afterClose: false, expandEvents: 2, open: true},
        async () => {
            const before = scope().counts.expand;
            await open('t-single');
            caretOf('t-single', 'Books').click(); await sleep(50);
            const afterOpen = labels('t-single').indexOf('  Fiction') !== -1;
            caretOf('t-single', 'Books').click(); await sleep(50);
            const afterClose = labels('t-single').indexOf('  Fiction') !== -1;
            const r = {model: scope().m.single, afterOpen, afterClose, expandEvents: scope().counts.expand - before, open: ctrl('t-single').isOpen};
            await close();
            return r;
        });

    T('S5 clear button empties the model and fires on-change',
        {model: '', display: null, payload: null, clearHidden: true},
        async () => {
            host('t-single').querySelector('.aui-control-clear').click();
            await sleep(50);
            const s = scope();
            const last = s.changes[s.changes.length - 1];
            const clearEl = host('t-single').querySelector('.aui-control-clear');
            const display = host('t-single').querySelector('.aui-select__display-text');
            return {model: s.m.single, display: display ? display.textContent : null, payload: last.selectedValues, clearHidden: clearEl.classList.contains('aui-control-clear--hidden')};
        });

    T('S6 leaf-only + show-path: a branch row opens instead of selecting; a leaf shows its full path',
        {afterBranch: '', branchOpened: true, model: 1131, display: 'Electronics / Phones / Accessories / Cases'},
        async () => {
            await open('t-leaf');
            rowEl('t-leaf', 'Electronics').click(); await sleep(50);
            const afterBranch = scope().m.leaf;
            const branchOpened = labels('t-leaf').indexOf('  Phones') !== -1;
            rowEl('t-leaf', 'Phones').click(); await sleep(50);
            rowEl('t-leaf', 'Accessories').click(); await sleep(50);
            rowEl('t-leaf', 'Cases').click(); await sleep(300);
            return {afterBranch, branchOpened, model: scope().m.leaf, display: host('t-leaf').querySelector('.aui-select__display-text').textContent.trim()};
        });

    // ------------------------------------------------------------------ multiple (linked)
    T('M1 check a branch (strategy all): model, half parent, one compact tag; on-change($value, $nodes, $node)',
        {model: [11, 111, 112, 113, 1131, 1132], parent: 'mixed', tags: ['Phones'], expr: {count: 6, nodeId: 11}, open: true},
        async () => {
            apply(s => { s.m.multi = []; s.exprChanges = []; });
            await open('t-multi');
            const c = ctrl('t-multi');
            caretOf('t-multi', 'Electronics').click(); await sleep(30);
            rowEl('t-multi', 'Phones').click(); await sleep(50);
            const s = scope();
            const last = s.exprChanges[s.exprChanges.length - 1];
            return {
                model: s.m.multi.slice(), parent: c.rows.find(x => x.node.label === 'Electronics').ariaChecked,
                tags: tagTexts('t-multi'), expr: {count: last.count, nodeId: last.node.id}, open: c.isOpen
            };
        });

    T('M2 checking the remaining children checks the parent; tags collapse to it',
        {model: [1, 11, 111, 112, 113, 1131, 1132, 12, 121, 122, 13], tags: ['Electronics'], parent: 'true'},
        async () => {
            rowEl('t-multi', 'Laptops').click(); await sleep(30);
            rowEl('t-multi', 'Cameras').click(); await sleep(30);
            const r = {model: scope().m.multi.slice(), tags: tagTexts('t-multi'), parent: ctrl('t-multi').rows.find(x => x.node.label === 'Electronics').ariaChecked};
            await close();
            return r;
        });

    T('M3 removing a tag unchecks the whole branch',
        {model: [], tags: []},
        async () => {
            host('t-multi').querySelector('.aui-select__tag-remove').click();
            await sleep(50);
            return {model: scope().m.multi.slice(), tags: tagTexts('t-multi')};
        });

    T('M4 max-tag-count 2: two tags then "+N" with the hidden names as tooltip',
        {tags: ['Books', 'Garden', '+2'], title: 'Home & Kitchen, A very long category name that does not fit into the dropdown width at all'},
        async () => {
            apply(s => { s.m.multi = [2, 21, 22, 221, 222, 3, 4, 41, 42, 5]; });
            await sleep(50);
            const count = host('t-multi').querySelector('.aui-select__tag--count');
            return {tags: tagTexts('t-multi'), title: count && count.getAttribute('title')};
        });

    T('M5 Backspace / Delete in an empty search box remove nothing, also when held (only x, clear or unchecking do)',
        {model: [2, 21, 22, 221, 222, 3, 4, 41, 42, 5]},
        async () => {
            await open('t-multi');
            key(searchBox('t-multi'), 'Backspace');
            for (let i = 0; i < 5; i += 1) key(searchBox('t-multi'), 'Backspace', {repeat: true});
            key(searchBox('t-multi'), 'Delete');
            await sleep(50);
            const r = {model: scope().m.multi.slice()};
            await close();
            return r;
        });

    T('M6 value-strategy parent and child',
        {parent: [11, 3], child: [111, 112, 1131, 1132, 3]},
        async () => {
            await open('t-parent');
            caretOf('t-parent', 'Electronics').click(); await sleep(30);
            rowEl('t-parent', 'Phones').click(); await sleep(30);
            rowEl('t-parent', 'Garden').click(); await sleep(30);
            await close();
            await open('t-child');
            caretOf('t-child', 'Electronics').click(); await sleep(30);
            rowEl('t-child', 'Phones').click(); await sleep(30);
            rowEl('t-child', 'Garden').click(); await sleep(30);
            await close();
            return {parent: scope().m.parent.slice(), child: scope().m.child.slice()};
        });

    T('M7 check-strictly: parent and children independent; model in tree order',
        {afterParent: [1], afterChild: [1, 13], electronicsChecked: 'true', camerasChecked: 'true', laptops: 'false'},
        async () => {
            await open('t-strict');
            rowEl('t-strict', 'Electronics').click(); await sleep(30);
            const afterParent = scope().m.strict.slice();
            caretOf('t-strict', 'Electronics').click(); await sleep(30);
            rowEl('t-strict', 'Cameras').click(); await sleep(30);
            const c = ctrl('t-strict');
            const r = {
                afterParent, afterChild: scope().m.strict.slice(),
                electronicsChecked: c.rows.find(x => x.node.label === 'Electronics').ariaChecked,
                camerasChecked: c.rows.find(x => x.node.label === 'Cameras').ariaChecked,
                laptops: c.rows.find(x => x.node.label === 'Laptops').ariaChecked
            };
            await close();
            return r;
        });

    T('M8 in-place model changes (push / length = 0) re-render without replacing the page array',
        {afterPush: ['Garden'], afterEmpty: [], sameArray: true},
        async () => {
            const s = scope();
            apply(x => { x.m.strict = []; });
            const arr = s.m.strict;
            apply(() => { arr.push(3); });
            await sleep(30);
            const afterPush = tagTexts('t-strict');
            apply(() => { arr.length = 0; });
            await sleep(30);
            return {afterPush, afterEmpty: tagTexts('t-strict'), sameArray: s.m.strict === arr};
        });

    // ------------------------------------------------------------------ disabled
    T('D1 disabled node + disabled-values: locked tags, no check on click, parent counts enabled children, clear keeps locked; the opening shows the checked Cookware (its branch open)',
        {initialTags: ['Garden', 'Cookware'], removable: [false, false], afterClickDisabled: [41, 3], openedToChecked: true, afterBedroom: [3, 4, 41, 42], afterClear: [3, 41], clearVisibleAfter: false},
        async () => {
            const initialTags = tagTexts('t-dis');
            const removable = Array.prototype.slice.call(host('t-dis').querySelectorAll('.aui-select__tag')).map(t => !!t.querySelector('.aui-select__tag-remove'));
            await open('t-dis');
            rowEl('t-dis', 'Garden').click(); await sleep(30);
            const afterClickDisabled = scope().m.dis.slice();
            const openedToChecked = !!rowEl('t-dis', 'Bedroom');
            rowEl('t-dis', 'Bedroom').click(); await sleep(30);
            const afterBedroom = scope().m.dis.slice();
            await close();
            host('t-dis').querySelector('.aui-control-clear').click(); await sleep(30);
            return {
                initialTags, removable, afterClickDisabled, openedToChecked, afterBedroom, afterClear: scope().m.dis.slice(),
                clearVisibleAfter: !host('t-dis').querySelector('.aui-control-clear').classList.contains('aui-control-clear--hidden')
            };
        });

    T('D3 locked tags (no remove button) show their whole label',
        {fits: [true, true]},
        async () => ({
            fits: Array.prototype.slice.call(host('t-dis').querySelectorAll('.aui-select__tag .aui-select__tag-text'))
                .map(el => el.scrollWidth <= el.clientWidth)
        }));

    T('D2 disabled component: does not open, not focusable, disabled style',
        {open: false, tabindex: null, disabledClass: true},
        async () => {
            trig('t-off').click(); await sleep(100);
            return {open: ctrl('t-off').isOpen, tabindex: trig('t-off').getAttribute('tabindex'), disabledClass: host('t-off').querySelector('.aui-select').classList.contains('aui-select--disabled')};
        });

    // ------------------------------------------------------------------ keyboard
    T('K1 keyboard: open, arrows, Right expands / enters, Left goes up, Enter selects + closes + focus trigger',
        {opened: true, afterDown: 'Books', afterRight1: true, afterRight2: 'Fiction', afterLeft: 'Books', model: 21, open: false, focusTrigger: true},
        async () => {
            apply(s => { s.m.single = ''; });
            scope().api.collapseAll(); await sleep(30);
            const t = trig('t-single');
            t.focus();
            key(t, 'Enter'); await sleep(250);
            const c = ctrl('t-single');
            const opened = c.isOpen;
            const input = searchBox('t-single');
            const activeLabel = () => { const r = c.rows.find(x => x.sid === c.activeSid); return r && r.node.label; };
            key(input, 'ArrowDown'); await sleep(20);
            const afterDown = activeLabel();
            key(input, 'ArrowRight'); await sleep(30);
            const afterRight1 = labels('t-single').indexOf('  Fiction') !== -1;
            key(input, 'ArrowRight'); await sleep(20);
            const afterRight2 = activeLabel();
            key(input, 'ArrowLeft'); await sleep(20);
            const afterLeft = activeLabel();
            key(input, 'ArrowRight'); await sleep(20);
            key(input, 'Enter'); await sleep(300);
            return {opened, afterDown, afterRight1, afterRight2, afterLeft, model: scope().m.single, open: c.isOpen, focusTrigger: document.activeElement === t};
        });

    T('K2 in the search box: Space types (not blocked, stays open); Escape closes only the dropdown',
        {spacePrevented: false, openAfterSpace: true, escPrevented: true, escStopped: true, openAfterEsc: false},
        async () => {
            await open('t-single');
            const ev = key(searchBox('t-single'), ' ');
            await sleep(30);
            const openAfterSpace = ctrl('t-single').isOpen;
            let reachedDocument = false;
            const onDoc = () => { reachedDocument = true; };
            document.addEventListener('keydown', onDoc);
            const esc = key(searchBox('t-single'), 'Escape');
            document.removeEventListener('keydown', onDoc);
            await sleep(300);
            return {spacePrevented: ev.defaultPrevented, openAfterSpace, escPrevented: esc.defaultPrevented, escStopped: !reachedDocument, openAfterEsc: ctrl('t-single').isOpen};
        });

    T('K3 Left/Right inside the search text move the caret unless it is at the edge',
        {midRight: false, endRight: true},
        async () => {
            await open('t-single');
            const input = searchBox('t-single');
            type(input, 'oo'); await sleep(30);
            input.setSelectionRange(1, 1);
            const mid = key(input, 'ArrowRight');
            input.setSelectionRange(2, 2);
            const end = key(input, 'ArrowRight');
            await close();
            return {midRight: mid.defaultPrevented, endRight: end.defaultPrevented};
        });

    T('K4 type-ahead from the trigger; Tab closes',
        {active: 'Garden', openAfterTab: false},
        async () => {
            const t = trig('t-flat');
            t.focus();
            key(t, 'ArrowDown'); await sleep(250);
            key(t, 'g'); await sleep(20);
            const c = ctrl('t-flat');
            const r = c.rows.find(x => x.sid === c.activeSid);
            key(t, 'Tab'); await sleep(300);
            return {active: r && r.node.label, openAfterTab: c.isOpen};
        });

    // ------------------------------------------------------------------ search
    T('Q1 search: matches with ancestors, highlighted; clearing restores the tree',
        {rows: ['Electronics', '  Phones', '    iOS'], hit: 'iOS', restored: true},
        async () => {
            await open('t-single');
            type(searchBox('t-single'), 'ios'); await sleep(50);
            const rows = labels('t-single');
            const hitEl = host('t-single').querySelector('.aui-select__hit');
            type(searchBox('t-single'), ''); await sleep(50);
            const restored = labels('t-single')[0] === 'Electronics' && labels('t-single').indexOf('Garden') !== -1;
            await close();
            return {rows, hit: hitEl && hitEl.textContent, restored};
        });

    T('Q2 search no match shows the empty text; search resets after closing (not while fading)',
        {empty: 'No results found', during: 'zzz', after: ''},
        async () => {
            await open('t-single');
            type(searchBox('t-single'), 'zzz'); await sleep(50);
            const emptyEl = host('t-single').querySelector('.aui-select__no-results');
            const empty = emptyEl && emptyEl.textContent.trim();
            outside();
            await sleep(30);
            const during = ctrl('t-single').searchQuery;
            await sleep(400);
            return {empty, during, after: ctrl('t-single').searchQuery};
        });

    // ------------------------------------------------------------------ flat data
    T('F1 flat data (parent-field) builds the same tree; default-expand-level 1',
        {rows: ['Electronics', '  Phones', '  Laptops', '  Cameras', 'Books', '  Fiction', '  Science', 'Garden', 'Home & Kitchen', '  Cookware', '  Bedroom', 'A very long category name that does not fit into the dropdown width at all']},
        async () => {
            await open('t-flat');
            const r = {rows: labels('t-flat')};
            await close();
            return r;
        });

    // ------------------------------------------------------------------ lazy
    T('L1 lazy: root loads on first open (spinner), a branch loads on expand, failures retry',
        {spinner: true, roots: ['Alpha', 'Beta', 'Flaky', 'Leaf'], loadingClass: true, children: ['Alpha', '  Alpha 1', '  Alpha 2', '  Alpha 3', 'Beta', 'Flaky', 'Leaf'], failed: true, retried: true, leafHasNoCaret: true, calls: ['root', 'a', 'flaky', 'flaky']},
        async () => {
            apply(s => { s.lazyCalls = []; });
            trig('t-lazy').click();
            await sleep(40);   // the demo loader answers after 150 ms: the spinner shows meanwhile
            const spinner = !host('t-lazy').querySelector('.aui-tree-select__loading').classList.contains('aui-tree-select__loading--hidden');
            await sleep(400);
            const roots = labels('t-lazy');
            caretOf('t-lazy', 'Alpha').click(); await sleep(30);
            const loadingClass = rowEl('t-lazy', 'Alpha').classList.contains('aui-tree-select__node--loading');
            await sleep(300);
            const children = labels('t-lazy');
            caretOf('t-lazy', 'Flaky').click(); await sleep(300);
            const failed = rowEl('t-lazy', 'Flaky').classList.contains('aui-tree-select__node--error');
            caretOf('t-lazy', 'Flaky').click(); await sleep(300);
            const retried = labels('t-lazy').indexOf('  Flaky 1') !== -1;
            const leafHasNoCaret = rowEl('t-lazy', 'Leaf').classList.contains('aui-tree-select__node--leaf');
            await close();
            return {spinner, roots, loadingClass, children, failed, retried, leafHasNoCaret, calls: scope().lazyCalls.slice()};
        });

    T('L2 lazy + linked checks: checking a loaded branch (strategy parent) gives one value',
        {model: ['a'], tags: ['Alpha']},
        async () => {
            await open('t-lazy');
            rowEl('t-lazy', 'Alpha').click(); await sleep(30);
            await close();
            return {model: scope().m.lazy.slice(), tags: tagTexts('t-lazy')};
        });

    TT('L3 root data arriving grows the panel smoothly as drawn (several frames, never shrinking, no single jump)',
        {grewOverFrames: true, monotonic: true, noBigJump: true, endsNatural: true, rowsFadeIn: true},
        async () => {
            const s = scope();
            s.lazyApi.reload(); await sleep(50);
            const h = host('t-lazy');
            const p = panel('t-lazy');
            // The height as drawn (its transform included: the growth runs as a transform), read after each frame
            // has been drawn. A reading after the panel changed since that frame (data arrived in between: not drawn
            // yet) shows no drawn frame and is left out.
            const heights = [];
            let recording = true;
            let changed = false;
            const watch = new MutationObserver(() => { changed = true; });
            watch.observe(p, {childList: true, subtree: true, attributes: true, characterData: true});
            const tick = () => {
                changed = false;
                setTimeout(() => { if (!changed) heights.push(Math.round(p.getBoundingClientRect().height)); }, 0);
                if (recording) requestAnimationFrame(tick);
                else watch.disconnect();
            };
            trig('t-lazy').click();
            requestAnimationFrame(tick);
            await sleep(140);   // loader answers after 150 ms
            const enterAtArrival = await new Promise(resolve => {
                const check = () => {
                    const row = h.querySelector('li.aui-tree-select__node');
                    if (row) resolve(row.classList.contains('aui-tree-select__node--enter'));
                    else requestAnimationFrame(check);
                };
                check();
            });
            await sleep(450);
            recording = false;
            const loadingHeight = heights.find(x => x > 0);
            const finalHeight = heights[heights.length - 1];
            const growth = heights.filter(x => x > loadingHeight + 1 && x < finalHeight - 1);
            let monotonic = true;
            let maxStep = 0;
            for (let i = 1; i < heights.length; i += 1) {
                if (heights[i] < heights[i - 1] - 1 && heights[i - 1] > loadingHeight) monotonic = false;
                if (heights[i - 1] >= loadingHeight) maxStep = Math.max(maxStep, heights[i] - heights[i - 1]);
            }
            const natural = (() => { const before = p.style.height; p.style.height = ''; const n = p.offsetHeight; p.style.height = before; return n; })();
            window.__lazyHeights = heights.filter((x, i) => i === 0 || x !== heights[i - 1]);
            const r = {
                grewOverFrames: growth.length >= 3, monotonic, noBigJump: maxStep < (finalHeight - loadingHeight) * 0.75,
                endsNatural: Math.abs(finalHeight - natural) <= 1 && p.style.height === '', rowsFadeIn: enterAtArrival
            };
            await close();
            return r;
        });

    // Samples a value every animation frame until stop() is called.
    function sampler(read) {
        const values = [];
        let on = true;
        const tick = () => { values.push(read()); if (on) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        return {values, stop: () => { on = false; }};
    }
    const loadingBlock = () => host('t-lazy').querySelector('.aui-tree-select__loading');
    const opacityOf = el => parseFloat(getComputedStyle(el).opacity);

    T('LT1 fast root load (40 ms): the loading block never becomes visible',
        {maxOpacity: 0, rows: 4},
        async () => {
            apply(s => { s.lazyDelay = 40; });
            scope().lazyApi.reload(); await sleep(50);
            const smp = sampler(() => opacityOf(loadingBlock()));
            trig('t-lazy').click();
            await sleep(400);
            smp.stop();
            const r = {maxOpacity: Math.max.apply(null, smp.values), rows: ctrl('t-lazy').rows.length};
            await close();
            apply(s => { s.lazyDelay = 150; });
            return r;
        });

    TT('LT2 slow root load: block fades in, then crossfades out (out of layout) while rows cascade in',
        {fadeIn: true, fullWhileLoading: true, leftLayout: true, fadingOut: true, goneAfter: true, staggered: true},
        async () => {
            apply(s => { s.lazyDelay = 500; });
            scope().lazyApi.reload(); await sleep(50);
            trig('t-lazy').click();
            await sleep(60);
            const early = opacityOf(loadingBlock());
            await sleep(300);
            const full = opacityOf(loadingBlock());
            await new Promise(resolve => { const t = setInterval(() => { if (ctrl('t-lazy').rows.length) { clearInterval(t); resolve(); } }, 5); });
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const block = loadingBlock();
            const midOpacity = opacityOf(block);
            const position = getComputedStyle(block).position;
            const delays = Array.prototype.slice.call(host('t-lazy').querySelectorAll('li.aui-tree-select__node--enter'))
                .map(li => parseFloat(getComputedStyle(li).animationDelay));
            await sleep(300);
            const after = {opacity: opacityOf(block), visibility: getComputedStyle(block).visibility};
            const r = {
                fadeIn: early < 0.5, fullWhileLoading: full > 0.95, leftLayout: position === 'absolute',
                fadingOut: midOpacity > 0.05 && midOpacity < 1, goneAfter: after.opacity === 0 && after.visibility === 'hidden',
                staggered: delays.length === 4 && delays[0] === 0 && delays[1] > 0 && delays[3] > delays[1]
            };
            window.__lt2 = {early, full, midOpacity, position, delays, after};
            await close();
            apply(s => { s.lazyDelay = 150; });
            return r;
        });

    TT('LT3 node load: caret turns "open" at once; spinner only after 120 ms; crossfades back; children arrive',
        {openAtOnce: true, noSpinnerEarly: true, spinnerLater: true, chevronBack: true, children: true},
        async () => {
            apply(s => { s.lazyDelay = 500; });
            await open('t-lazy');
            await sleep(600);
            const caret = label => rowEl('t-lazy', label).querySelector('.aui-tree-select__caret');
            caretOf('t-lazy', 'Beta').click();
            await sleep(20);
            const openAtOnce = rowEl('t-lazy', 'Beta').classList.contains('aui-tree-select__node--expanded');
            await sleep(60);
            const early = parseFloat(getComputedStyle(caret('Beta'), '::after').opacity);
            await sleep(300);
            const later = parseFloat(getComputedStyle(caret('Beta'), '::after').opacity);
            await sleep(500);
            const chevronBack = parseFloat(getComputedStyle(caret('Beta'), '::before').opacity) > 0.95
                && parseFloat(getComputedStyle(caret('Beta'), '::after').opacity) < 0.05;
            window.__lt3 = {early, later};
            const r = {openAtOnce, noSpinnerEarly: early < 0.05, spinnerLater: later > 0.95, chevronBack,
                children: ['Beta 1', 'Beta 2', 'Beta 3'].every(l => !!rowEl('t-lazy', l))};
            await close();
            apply(s => { s.lazyDelay = 150; });
            return r;
        });

    T('LT4 fast node load (40 ms): no spinner at all, the chevron stays',
        {maxSpinner: 0, minChevron: 1, children: true},
        async () => {
            apply(s => { s.lazyDelay = 40; });
            await open('t-lazy');
            await sleep(150);
            // Close Alpha if open, drop its loaded children, then open it again with the fast loader.
            scope().lazyApi.collapse('a'); await sleep(60);
            scope().lazyApi.reload('a'); await sleep(60);
            const smp = sampler(() => {
                const el = caretOf('t-lazy', 'Alpha');
                return [parseFloat(getComputedStyle(el, '::after').opacity), parseFloat(getComputedStyle(el, '::before').opacity)];
            });
            caretOf('t-lazy', 'Alpha').click();
            await sleep(300);
            smp.stop();
            const r = {
                maxSpinner: Math.max.apply(null, smp.values.map(v => v[0])),
                minChevron: Math.min.apply(null, smp.values.map(v => v[1])),
                children: !!rowEl('t-lazy', 'Alpha 1')
            };
            await close();
            apply(s => { s.lazyDelay = 150; });
            return r;
        });

    // ------------------------------------------------------------------ required / form
    T('R1 required: not red at first; form[name] is the real control; hidden input carries value/name/required',
        {red: false, same: true, hiddenName: 'reqField', hiddenValue: '', hiddenRequired: true, hiddenValid: false, entries: 1},
        async () => {
            const form = scope().treeForm;
            const hidden = host('t-req').querySelector('.aui-select__hidden-input');
            return {
                red: trig('t-req').classList.contains('aui-select__trigger--invalid'),
                same: form.reqField === ngm('t-req'),
                hiddenName: hidden.name, hiddenValue: hidden.value, hiddenRequired: hidden.required, hiddenValid: hidden.checkValidity(),
                entries: (form.$error.required || []).filter(c => c.$name === 'reqField').length
            };
        });

    T('R2 required: red after open + close while empty; selecting clears it; hidden input follows',
        {redAfterClose: true, redAfterPick: false, valid: true, hiddenValue: '3', hiddenValid: true},
        async () => {
            await open('t-req');
            await close();
            const redAfterClose = trig('t-req').classList.contains('aui-select__trigger--invalid');
            await open('t-req');
            rowEl('t-req', 'Garden').click(); await sleep(300);
            const hidden = host('t-req').querySelector('.aui-select__hidden-input');
            return {redAfterClose, redAfterPick: trig('t-req').classList.contains('aui-select__trigger--invalid'), valid: ngm('t-req').$valid, hiddenValue: hidden.value, hiddenValid: hidden.checkValidity()};
        });

    // ------------------------------------------------------------------ unknown values
    T('U1 unknown model values are kept and shown; selected-labels names them',
        {single: '999', multi: ['Archived category'], keptAfterAdd: [3, 7777]},
        async () => {
            const single = host('t-unknown').querySelector('.aui-select__display-text').textContent.trim();
            const multiHost = document.querySelectorAll('#t-unknown aui-tree-select')[1];
            const multi = Array.prototype.slice.call(multiHost.querySelectorAll('.aui-select__tag')).map(t => t.textContent.trim());
            multiHost.querySelector('.aui-select__trigger').click(); await sleep(250);
            Array.prototype.slice.call(multiHost.querySelectorAll('li.aui-tree-select__node')).find(li => li.textContent.trim() === 'Garden').click();
            await sleep(30);
            await close();
            return {single, multi, keptAfterAdd: scope().m.labels.slice()};
        });

    // ------------------------------------------------------------------ big tree / virtual scrolling
    T('V1 20,020 nodes: expand all renders a window only; search (debounced) finds a deep item; min width',
        {rows: 20020, windowed: true, searchMatched: true, panelWidthOk: true},
        async () => {
            await open('t-big');
            scope().bigApi.expandAll(); await sleep(100);
            const c = ctrl('t-big');
            const rows = c.rows.length;
            const rendered = host('t-big').querySelectorAll('li.aui-tree-select__node').length;
            const input = searchBox('t-big');
            const before = performance.now();
            type(input, 'item 19-49-18'); await sleep(250);
            const searchMatched = c.rows.some(r => r.node.label === 'Item 19-49-18');
            window.__bigSearchMs = Math.round(performance.now() - before);
            type(input, ''); await sleep(250);
            const width = panel('t-big').getBoundingClientRect().width;
            window.__bigRendered = rendered;
            const r = {rows, windowed: rendered > 0 && rendered < 200, searchMatched, panelWidthOk: width >= 359};
            await close();
            return r;
        });

    T('V2 virtual window follows scrolling and keyboard',
        {scrolledWindow: true, activeRendered: true},
        async () => {
            await open('t-big');
            const c = ctrl('t-big');
            scope().bigApi.expandAll();
            // waits for the state, not a fixed time (20k rows expanded can take longer on a busy machine)
            await AuiTest.until(() => c.rows.length > 5000, 1500);
            const list = host('t-big').querySelector('.aui-tree-select__tree');
            const firstIndex = () => {
                const first = host('t-big').querySelector('li.aui-tree-select__node');
                return first ? c.rows.findIndex(r => r.domId === first.id) : -1;
            };
            list.scrollTop = 36 * 5000;
            list.dispatchEvent(new Event('scroll'));
            const scrolledWindow = await AuiTest.until(() => firstIndex() > 4000, 1000);
            const input = searchBox('t-big');
            for (let i = 0; i < 3; i += 1) key(input, 'ArrowDown');
            await sleep(80);
            const activeRendered = !!document.getElementById(c.activeDomId());
            scope().bigApi.collapseAll(); await sleep(50);
            await close();
            return {scrolledWindow, activeRendered};
        });

    // ------------------------------------------------------------------ placement (page scrolled far down)
    async function placementAt(where) {
        const t = trig('t-child');
        const rect = t.getBoundingClientRect();
        window.scrollBy(0, where === 'top' ? rect.top - 60 : rect.bottom - window.innerHeight + 40);
        await sleep(100);
        await open('t-child');
        const p = panel('t-child');
        const pr = p.getBoundingClientRect();
        const tr = t.getBoundingClientRect();
        const result = {
            placement: (p.className.match(/aui-select__panel--(top|bottom)/) || [])[1],
            inViewport: pr.top >= 0 && pr.bottom <= window.innerHeight,
            attached: Math.abs(pr.top - tr.bottom) < 2 || Math.abs(pr.bottom - tr.top) < 2,
            sameWidth: Math.abs(pr.width - tr.width) < 1
        };
        await close();
        return result;
    }

    T('P1-P3 scrolled page: near the top opens down, near the bottom flips up; attached, on screen, same width',
        {nearTop: {placement: 'bottom', inViewport: true, attached: true, sameWidth: true},
         nearBottom: {placement: 'top', inViewport: true, attached: true, sameWidth: true}},
        async () => {
            const spacer = document.createElement('div');
            spacer.style.height = '1600px';
            document.body.insertBefore(spacer, document.body.firstChild);
            try {
                return {nearTop: await placementAt('top'), nearBottom: await placementAt('bottom')};
            } finally {
                spacer.parentNode.removeChild(spacer);
                window.scrollTo(0, 0);
                await sleep(100);
            }
        });

    // ------------------------------------------------------------------ api
    T('A1 api: open/close, reveal, getSelectedNodes, getNode, clear',
        {opened: true, revealed: 'Chargers', nodes: [{id: 3, name: 'Garden'}], node: {id: 1132, name: 'Chargers'}, closed: false, cleared: ''},
        async () => {
            apply(s => { s.m.single = 3; });
            const api = scope().api;
            api.open(); await sleep(250);
            const opened = ctrl('t-single').isOpen;
            api.reveal(1132); await sleep(50);
            const c = ctrl('t-single');
            const active = c.rows.find(r => r.sid === c.activeSid);
            const nodes = api.getSelectedNodes();
            const node = api.getNode(1132);
            api.close(); await sleep(300);
            const closed = c.isOpen;
            api.clear(); await sleep(50);
            return {opened, revealed: active && active.node.label, nodes, node, closed, cleared: scope().m.single};
        });

    // ------------------------------------------------------------------ outside click / focus
    T('O1 clicking rows (multiple) keeps the panel open; mousedown in the panel is prevented; outside click closes',
        {stillOpen: true, mousedownPrevented: true, closed: false},
        async () => {
            await open('t-multi');
            const row = rowEl('t-multi', 'Garden');
            const down = new MouseEvent('mousedown', {bubbles: true, cancelable: true});
            row.dispatchEvent(down);
            row.click(); await sleep(50);
            const r = {stillOpen: ctrl('t-multi').isOpen, mousedownPrevented: down.defaultPrevented};
            await close();
            r.closed = ctrl('t-multi').isOpen;
            return r;
        });

    T('O2 reopening during the close fade-out shows the panel again (visible, not just clickable)',
        {open: true, opacity: '1'},
        async () => {
            await open('t-single');
            outside();
            await sleep(60);
            trig('t-single').click();
            await sleep(500);
            const r = {open: ctrl('t-single').isOpen, opacity: getComputedStyle(panel('t-single')).opacity};
            await close();
            return r;
        });

    // ------------------------------------------------------------------ deep-review additions
    T('I1 input method composing: Enter / ArrowDown / Escape are left to the IME',
        {enterPrevented: false, downPrevented: false, escPrevented: false, open: true, model: 3, active: 'Electronics'},
        async () => {
            apply(s => { s.m.single = 3; });
            scope().api.collapseAll(); await sleep(30);
            await open('t-single');
            const c = ctrl('t-single');
            c.activeSid = c.rows[0].sid;
            const input = searchBox('t-single');
            const enter = key(input, 'Enter', {isComposing: true});
            const down = key(input, 'ArrowDown', {isComposing: true});
            const esc = key(input, 'Escape', {isComposing: true});
            await sleep(30);
            const active = c.rows.find(r => r.sid === c.activeSid);
            const r = {enterPrevented: enter.defaultPrevented, downPrevented: down.defaultPrevented, escPrevented: esc.defaultPrevented,
                open: c.isOpen, model: scope().m.single, active: active && active.node.label};
            await close();
            return r;
        });

    T('H1 field scrolled out of its scrolling box: the panel hides, and returns when scrolled back',
        {shownAtFirst: true, hiddenWhenOut: true, shownWhenBack: true},
        async () => {
            const box = document.getElementById('t-scroll');
            box.scrollIntoView({block: 'center'});
            box.scrollTop = 0;
            await sleep(100);
            const h = box.querySelector('aui-tree-select');
            h.querySelector('.aui-select__trigger').click();
            await sleep(300);
            const p = h.querySelector('.aui-select__panel');
            const shownAtFirst = getComputedStyle(p).visibility === 'visible';
            box.scrollTop = 200;
            await sleep(200);
            const hiddenWhenOut = getComputedStyle(p).visibility === 'hidden';
            box.scrollTop = 0;
            await sleep(200);
            const shownWhenBack = getComputedStyle(p).visibility === 'visible';
            await close();
            window.scrollTo(0, 0);
            return {shownAtFirst, hiddenWhenOut, shownWhenBack};
        });

    T('TT1 row tooltips only where they help: none for a short visible label, the path for a cut-off one',
        {shortTitle: null, longTitle: 'A very long category name that does not fit into the dropdown width at all', searchTitle: 'Electronics / Phones / iOS'},
        async () => {
            apply(s => { s.m.single = ''; });
            await open('t-single');
            const over = el => el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            const shortRow = rowEl('t-single', 'Garden');
            over(shortRow);
            const longRow = rowEl('t-single', 'A very long category name that does not fit into the dropdown width at all');
            over(longRow);
            type(searchBox('t-single'), 'ios'); await sleep(50);
            const iosRow = rowEl('t-single', 'iOS');
            over(iosRow);
            const r = {shortTitle: shortRow.getAttribute('title'), longTitle: longRow.getAttribute('title'), searchTitle: iosRow.getAttribute('title')};
            await close();
            return r;
        });

    T('LN1 show-line: guide line block spans the ancestor levels of each row',
        {rootClass: true, depth0: '0px', depth2: '36px'},
        async () => {
            await open('t-lines');
            const root = rowEl('t-lines', 'Electronics');
            const deep = rowEl('t-lines', 'Android');
            const r = {
                rootClass: host('t-lines').querySelector('.aui-select').classList.contains('aui-tree-select--lines'),
                depth0: getComputedStyle(root, '::before').width, depth2: getComputedStyle(deep, '::before').width
            };
            await close();
            return r;
        });

    T('IF1 focus moving into an iframe closes the dropdown',
        {closed: true},
        async () => {
            await open('t-single');
            const frame = document.getElementById('t-iframe');
            frame.contentWindow.focus();
            frame.contentDocument.querySelector('input').focus();
            await sleep(150);
            const closed = !ctrl('t-single').isOpen;
            window.focus();
            await sleep(300);
            return {closed};
        });

    // ------------------------------------------------------------------ destroy
    T('X1 destroy while open: on-close once, no errors, no open popover, no leftover listeners',
        {closeDelta: 1, errors: 0, popovers: 0, afterClickErrors: 0},
        async () => {
            apply(s => { s.show.destroyable = true; });
            await sleep(50);
            await open('t-destroy');
            const before = scope().counts.close, errs = errCount();
            apply(s => { s.show.destroyable = false; });
            await sleep(400);
            outside(); await sleep(50);
            return {closeDelta: scope().counts.close - before, errors: errCount() - errs, popovers: document.querySelectorAll(':popover-open').length, afterClickErrors: errCount() - errs};
        });

    // ------------------------------------------------------------------ modal
    T('Z1 inside aui-modal: panel in the top layer above the dialog; Escape closes only the dropdown',
        {dialogOpen: true, panelTopLayer: true, dropdownClosed: true, dialogStillOpen: true},
        async () => {
            apply(s => { s.modal.open = true; });
            await sleep(400);
            const dialog = document.querySelector('dialog');
            const dialogOpen = !!(dialog && dialog.open);
            await open('t-modal');
            const panelTopLayer = panel('t-modal').matches(':popover-open');
            key(searchBox('t-modal'), 'Escape');
            await sleep(350);
            const r = {dialogOpen, panelTopLayer, dropdownClosed: !ctrl('t-modal').isOpen, dialogStillOpen: !!(dialog && dialog.open)};
            apply(s => { s.modal.open = false; });
            await sleep(400);
            return r;
        });

    AuiTest.run('aui-tree-select: core', tests, {
        summary: function () {
            return window.__bigSearchMs === undefined ? ''
                : '20k: ' + window.__bigRendered + ' rows rendered, search ' + window.__bigSearchMs + ' ms incl. debounce wait';
        }
    });
})();
