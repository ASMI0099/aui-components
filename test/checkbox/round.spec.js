// Checkbox round suite (page: round.html, fixture: round.fixture.js): max counted over every value the model holds,
// select-all that clears always and adds only within max; a model changed in place validated; a disabled group keeps its
// select-all mark; an option edited in place; options of one value; an invalid group's look and state; deferred models
// (debounce, updateOn blur) and on-change; native forms (data, required, reset); external names, tabindex; the checked
// focus ring and the high-contrast rules; boxes side by side; many values; a hint's change; a font changed later; a
// disabled fieldset.
(function () {
    const {sleep, until} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const host = id => document.getElementById(id);
    const box = id => host(id).querySelector('.aui-checkbox__native');
    const look = id => host(id).querySelector('.aui-checkbox');
    const ngModel = id => angular.element(host(id)).controller('ngModel');
    const options = id => Array.from(host(id).querySelectorAll('.aui-checkbox-group__options .aui-checkbox'));
    const optionBox = (id, i) => options(id)[i].querySelector('input');
    const allBox = id => host(id).querySelector('.aui-checkbox--select-all input');
    const frames = AuiTest.frames;
    const flush = async () => { await frames(2); await sleep(450); };

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('CB01 max counts every value the model holds: with a saved value and A under max 2, B and C are off; select-all adds only within max, and clears always',
        {bOff: true, overfullClear: true, cleared: [], lockedAll: true},
        async () => {
            const bOff = optionBox('g-limited', 1).disabled;
            // three checked under max 2 (given by the page): select-all is checked, and clears them
            const overfullClear = !allBox('g-overfull').disabled;
            allBox('g-overfull').click();
            await flush();
            const cleared = scope().m.overfull.slice();
            // a locked value checked and two free options under max 2: select-all would make three, it is off
            const lockedAll = allBox('g-locked').disabled;
            return {bOff, overfullClear, cleared, lockedAll};
        });

    T('CB02 the model changed in place (splice, push): required, min and max follow at once, and the page\'s array is kept',
        {emptied: {required: true, min: true}, pushed: {max: true, kept: 3}},
        async () => {
            apply(s => { s.m.inPlace.splice(0, 2); });
            const e = ngModel('g-inplace').$error;
            const emptied = {required: !!e.required, min: !!e.minItems};
            apply(s => { s.m.inPlace.push('A', 'B', 'C'); });
            const pushed = {max: !!ngModel('g-inplace').$error.maxItems, kept: Array.isArray(scope().m.inPlace) ? scope().m.inPlace.length : -1};
            apply(s => { s.m.inPlace.splice(2, 1); });
            return {emptied, pushed};
        });

    T('CB03 a group disabled keeps its select-all\'s mark: mixed with two of three, checked with all',
        {mixed: true, checked: true},
        async () => {
            apply(s => { s.off.group = true; });
            await frames(1);
            const mixed = allBox('g-disabled').indeterminate;
            apply(s => { s.off.group = false; s.m.disabledGroup = ['A', 'B', 'C']; });
            apply(s => { s.off.group = true; });
            await frames(1);
            const checked = allBox('g-disabled').checked;
            apply(s => { s.off.group = false; s.m.disabledGroup = ['A', 'B']; });
            return {mixed, checked};
        });

    T('CB04 an option edited in place (its label, its lock): the box follows at the next digest',
        {label: 'Renamed', locked: true},
        async () => {
            apply(s => { s.liveOptions[0].label = 'Renamed'; s.liveOptions[0].off = true; });
            await frames(1);
            return {label: options('g-live')[0].textContent.trim(), locked: optionBox('g-live', 0).disabled};
        });

    T('CB05 options of one value are one choice: checked and cleared together, the value in the model once (select-all too)',
        {checkedBoth: [true, true], afterCheck: [5], afterClear: [], afterAll: [5, 6]},
        async () => {
            optionBox('g-twins', 0).click();
            await flush();
            const checkedBoth = [optionBox('g-twins', 0).checked, optionBox('g-twins', 1).checked];
            const afterCheck = scope().m.twins.slice();
            optionBox('g-twins', 1).click();
            await flush();
            const afterClear = scope().m.twins.slice();
            allBox('g-twins').click();
            await flush();
            const afterAll = scope().m.twins.slice();
            apply(s => { s.m.twins = []; });
            return {checkedBoth, afterCheck, afterClear, afterAll};
        });

    T('CB06 a required group left empty: the group aria-invalid and its boxes red, at once (the first time it is left)',
        {ariaInvalid: 'true', red: true},
        async () => {
            optionBox('g-invalid', 0).focus();
            optionBox('g-invalid', 0).blur();
            host('before-tab').focus();
            await flush();
            const group = host('g-invalid').querySelector('[role="group"]');
            return {ariaInvalid: group.getAttribute('aria-invalid'), red: options('g-invalid')[0].classList.contains('aui-checkbox--invalid')};
        });

    T('CB07 ng-model-options updateOn blur: leaving the box or the group commits what was checked',
        {single: true, group: ['A']},
        async () => {
            box('c-blur').focus();
            box('c-blur').click();
            box('c-blur').blur();
            host('before-tab').focus();
            optionBox('g-blur', 0).focus();
            optionBox('g-blur', 0).click();
            host('before-tab').focus();
            await flush();
            return {single: scope().m.blurSingle, group: scope().m.blurGroup.slice()};
        });

    T('CB08 on-change tells the value chosen: with a debounce once the model has it (not the old value as the new); a required box cleared: its false-value',
        {debounced: [['debounced', true, false]], model: true, required: ['required', false, true]},
        async () => {
            const s = scope();
            s.calls.length = 0;
            box('c-debounced').click();
            await sleep(400);
            const debounced = s.calls.filter(c => c[0] === 'debounced');
            box('c-required').click();
            await flush();
            s.calls.length = 0;
            box('c-required').click();
            await flush();
            const required = s.calls.filter(c => c[0] === 'required')[0] || null;
            return {debounced, model: s.m.debounced, required};
        });

    T('CB09 a native reset of the form: the boxes stay as the model is (native, look and the form\'s data agree)',
        {native: true, look: true, entry: 'YES'},
        async () => {
            apply(s => { s.m.resetMe = 'YES'; });
            host('native-form').reset();
            await frames(1);
            return {native: box('c-reset').checked, look: look('c-reset').classList.contains('aui-checkbox--checked'),
                entry: new FormData(host('native-form')).get('resetMe')};
        });

    T('CB10 a native form: a named box sends its true-value, a named group each value; required stops the browser\'s check (a box, a group)',
        {named: 'YES', group: ['read'], needOne: false, needGroup: false, groupFilled: true},
        async () => {
            const data = new FormData(host('native-form'));
            const out = {named: data.get('named'), group: data.getAll('namedGroup'),
                needOne: host('need-one').checkValidity(), needGroup: host('need-form').checkValidity()};
            apply(s => { s.m.needGroup = ['A']; });
            await frames(1);
            out.groupFilled = host('need-form').checkValidity();
            apply(s => { s.m.needGroup = []; });
            return out;
        });

    T('CB11 aria-labelledby and aria-describedby on the element name and describe the box',
        {labelledby: 'ext-label', describedby: 'ext-help', hostLabelledby: null},
        async () => ({labelledby: box('c-labelled').getAttribute('aria-labelledby'), describedby: box('c-labelled').getAttribute('aria-describedby'),
            hostLabelledby: host('c-labelled').getAttribute('aria-labelledby')}));

    T('CB12 a standard tabindex on the element: one Tab stop (the box), not the element too',
        {hostTab: null, boxTab: '0'},
        async () => ({hostTab: host('c-tabbed').getAttribute('tabindex'), boxTab: box('c-tabbed').getAttribute('tabindex')}));

    T('CB13 a checked box focused by the keyboard: a ring in the accent (rule present: a gap and the accent, not the light halo alone)',
        {ring: true},
        async () => {
            let ring = false;
            for (const sheet of document.styleSheets) {
                let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
                for (const r of rules) {
                    if (r.selectorText && r.selectorText.indexOf('.aui-checkbox--checked .aui-checkbox__native:focus-visible') >= 0 &&
                        /--aui-control-accent-color\)\s*$/.test(r.style.getPropertyValue('box-shadow').trim())) ring = true;
                }
            }
            return {ring};
        });

    T('CB14 high contrast: a disabled checked or mixed box is drawn in GrayText, its mark in the background colour (rules present)',
        {box: true, mark: true},
        async () => {
            let boxRule = false, mark = false;
            for (const sheet of document.styleSheets) {
                let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
                for (const r of rules) {
                    if (!r.media || String(r.media.mediaText).indexOf('forced-colors') < 0) continue;
                    for (const inner of r.cssRules) {
                        const sel = inner.selectorText || '';
                        if (sel.indexOf('.aui-checkbox--disabled.aui-checkbox--checked .aui-checkbox__box') >= 0 && /GrayText/i.test(inner.style.backgroundColor)) boxRule = true;
                        if (sel.indexOf('.aui-checkbox--disabled .aui-checkbox__box::before') >= 0 && /Canvas/i.test(inner.style.backgroundColor)) mark = true;
                    }
                }
            }
            return {box: boxRule, mark};
        });

    T('CB15 two compact boxes side by side: a click on the first one\'s box (where the second\'s target reaches) checks the first',
        {left: true, right: false},
        async () => {
            const r = look('c-left').querySelector('.aui-checkbox__box').getBoundingClientRect();
            const x = r.right - 2, y = r.top + r.height / 2;
            const target = document.elementFromPoint(x, y);
            target.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, detail: 1, clientX: x, clientY: y}));
            await flush();
            const out = {left: scope().m.left, right: scope().m.right};
            apply(s => { s.m.left = false; s.m.right = false; });
            return out;
        });

    T('CB18 a group of 400 checked values: no comparison of each option with each value at a drawing',
        {fewCompares: true},
        async () => {
            const own = angular.equals;
            let n = 0;
            angular.equals = function () { n += 1; return own.apply(this, arguments); };
            try {
                ngModel('g-hint').$render();
            } finally {
                angular.equals = own;
            }
            return {fewCompares: n < 1000};
        });

    T('CB19 a hint\'s change: the options\' records kept (not made again)',
        {kept: true},
        async () => {
            const ctrl = angular.element(host('g-hint')).controller('auiCheckboxGroup');
            const first = ctrl.items[0];
            apply(s => { s.hint = 'Another hint'; });
            return {kept: ctrl.items[0] === first};
        });

    T('CB20 the page\'s font changed later: the box fitted again in the new font (as a new box would be)',
        {refitted: true},
        async () => {
            const root = look('c-font');
            host('font-box').className = 'row font-b';
            await frames(4);
            const ctx = document.createElement('canvas').getContext('2d');
            const cs = getComputedStyle(root);
            ctx.font = (cs.fontWeight || '400') + ' 100px ' + cs.fontFamily;
            const ascent = ctx.measureText('0123456789').actualBoundingBoxAscent;
            const expected = Math.round(ascent * 5) / 1000 + 'em';
            return {refitted: root.style.getPropertyValue('--aui-checkbox-mid').trim() === expected};
        });

    T('CB22 inside a disabled fieldset: the disabled look (grey box, disabled text, the not-allowed cursor)',
        {grey: true, cursor: 'not-allowed'},
        async () => {
            apply(s => { s.off.fieldset = true; });
            await frames(1);
            const b = getComputedStyle(look('c-fieldset').querySelector('.aui-checkbox__box')).backgroundColor;
            const out = {grey: b === 'rgb(184, 194, 207)', cursor: getComputedStyle(look('c-fieldset')).cursor};
            apply(s => { s.off.fieldset = false; });
            return out;
        });

    T('CB99 no Angular errors', {errors: []}, async () => ({errors: window.__ngErrors.slice()}));

    AuiTest.run('aui-* family: aui-checkbox, round checks', tests);
})();
