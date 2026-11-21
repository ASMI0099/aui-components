// Checkbox suite (page: checkbox.html, fixture: checkbox.fixture.js):
// - in the page's form: the form holds the field itself under its name (its required error there), no control of its
//   own for a box without a name, touched once left, the message line then;
// - a click: the model (true-value / false-value), ng-change, on-change ($value, $oldValue, $checked, $triggerSource,
//   $byUser), the page's binding after the next frame; the page's model drawn without on-change;
// - disabled and ng-disabled; indeterminate (mixed while unchecked, the user's click leaves it, the page sets it again;
//   the native box's own state, no aria-checked);
// - a box without a label (named by aria-label), label-left, sizes, container-border; one watcher at most;
// - aui-checkbox-group: values in the options' order (values it does not show kept), select-all (mixed, enabled
//   options only), max (the others disabled), min / max / required errors, disabled options, the group disabled,
//   layouts, the model changed in place, the form's control.
(function () {
    const {sleep} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const host = id => document.getElementById(id);
    const box = id => host(id).querySelector('.aui-checkbox__native');
    const look = id => host(id).querySelector('.aui-checkbox');
    const has = (el, name) => el.classList.contains('aui-checkbox--' + name);
    const outer = id => angular.element(host(id)).controller('ngModel');
    const lastLog = () => scope().log[scope().log.length - 1];
    const options = id => Array.from(host(id).querySelectorAll('.aui-checkbox-group__options .aui-checkbox'));
    const optionBox = (id, i) => options(id)[i].querySelector('input');
    const allBox = id => host(id).querySelector('.aui-checkbox--select-all input');
    const states = id => options(id).map(o => (o.querySelector('input').checked ? 'on' : 'off') + (o.querySelector('input').disabled ? '-x' : ''));
    const message = id => { const m = host(id).querySelector('.aui-field-message'); return m ? m.textContent.trim() : null; };

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('C1 in the page\'s form: the form holds the field itself under its name, with its required error; a box without a name adds no control; touched once left, and then its message line and its red',
        {holds: true, required: true, controls: ['agree', 'perm', 'roles', 'req'], beforeLeft: {touched: false, message: '', invalid: false},
            afterLeft: {touched: true, message: 'This field is required', invalid: true, aria: 'true'}},
        async () => {
            const f = scope().f;
            const out = {holds: f.agree === outer('c-req'), required: !!f.agree.$error.required, controls: Object.keys(f).filter(k => k[0] !== '$'),
                beforeLeft: {touched: outer('c-req').$touched, message: message('c-req'), invalid: has(look('c-req'), 'invalid')}};
            box('c-req').focus();
            box('c-req').blur();
            await sleep(100);
            out.afterLeft = {touched: outer('c-req').$touched, message: message('c-req'), invalid: has(look('c-req'), 'invalid'),
                aria: box('c-req').getAttribute('aria-invalid')};
            return out;
        });

    T('C2 a click: the model, ng-change, on-change with $value, $oldValue, $checked, $triggerSource and $byUser; its look at once, the page\'s binding after the next frame; checked, the required error goes',
        {model: true, ngChange: true, onChange: {what: 'agree', value: true, oldValue: false, checked: true, source: 'toggle', byUser: true},
            lookAtOnce: true, pageLater: 'true', requiredGone: true, message: '', trueValue: {model: 'edit', value: 'edit', oldValue: 'no'}},
        async () => {
            scope().log.length = 0;
            box('c-req').click();
            const lookAtOnce = has(look('c-req'), 'checked');
            await sleep(100);
            const out = {model: scope().m.agree, ngChange: scope().log.some(e => e.what === 'ng-change'), onChange: scope().log.filter(e => e.what === 'agree')[0],
                lookAtOnce: lookAtOnce, pageLater: document.getElementById('agree-value').textContent, requiredGone: !outer('c-req').$error.required,
                message: message('c-req')};
            box('c-perm').click();
            await sleep(50);
            const perm = lastLog();
            out.trueValue = {model: scope().m.perm, value: perm.value, oldValue: perm.oldValue};
            return out;
        });

    T('C3 the page\'s model drawn without on-change; true-value compared by value',
        {checkedNow: false, perm: {checked: false}, onChanges: 0},
        async () => {
            scope().log.length = 0;
            apply(s => { s.m.agree = false; s.m.perm = 'no'; });
            return {checkedNow: box('c-req').checked, perm: {checked: box('c-perm').checked}, onChanges: scope().log.length};
        });

    T('C4 disabled and ng-disabled: no change by a click, the box disabled, the look; ng-disabled followed when it changes',
        {ngDisabled: {disabled: true, changed: false, look: true}, disabled: {disabled: true, changed: false}, enabled: {disabled: false, changed: true}},
        async () => {
            const before = scope().m.plain;
            box('c-ngdis').click();
            const ngDisabled = {disabled: box('c-ngdis').disabled, changed: scope().m.plain !== before, look: has(look('c-ngdis'), 'disabled')};
            const f0 = scope().m.flag;
            box('c-dis').click();
            const disabled = {disabled: box('c-dis').disabled, changed: scope().m.flag !== f0};
            apply(s => { s.m.off = false; });
            await sleep(50);
            box('c-ngdis').click();
            await sleep(50);
            const enabled = {disabled: box('c-ngdis').disabled, changed: scope().m.plain !== before};
            apply(s => { s.m.off = true; s.m.plain = false; });
            return {ngDisabled, disabled, enabled};
        });

    T('C5 indeterminate: mixed while unchecked (the native box\'s own state, no aria-checked); the user\'s clicks: checked, then empty (as a native box); the page sets it again: mixed',
        {first: 'mixed', native: true, ariaChecked: null, afterClick: 'checked', afterSecond: 'empty', pageAgain: 'mixed'},
        async () => {
            const state = () => has(look('c-all'), 'indeterminate') ? 'mixed' : (box('c-all').checked ? 'checked' : 'empty');
            const out = {first: state(), native: box('c-all').indeterminate, ariaChecked: box('c-all').getAttribute('aria-checked')};
            box('c-all').click();
            out.afterClick = state();
            box('c-all').click();
            out.afterSecond = state();
            apply(s => { s.m.part = false; });
            apply(s => { s.m.part = true; });
            out.pageAgain = state();
            return out;
        });

    T('C6 a box without a label: named by aria-label, a 24px target, in the middle of the line; label-left before the box; container-border in a field\'s box, blue while checked',
        {bare: {cls: true, aria: 'Row 1', target: 24}, left: true, boxed: {block: true, cls: true, checkedBlue: true}},
        async () => {
            const target = Math.round(box('c-row1').getBoundingClientRect().width);
            const l = look('c-left');
            const left = l.querySelector('.aui-checkbox__label').getBoundingClientRect().right <= l.querySelector('.aui-checkbox__control').getBoundingClientRect().left;
            box('c-boxed').click();
            await sleep(250);
            const cs = getComputedStyle(look('c-boxed'));
            const out = {bare: {cls: has(look('c-row1'), 'bare'), aria: box('c-row1').getAttribute('aria-label'), target},
                left, boxed: {block: host('c-boxed').classList.contains('aui-checkbox-host--block'), cls: has(look('c-boxed'), 'container-border'),
                    checkedBlue: cs.borderTopColor === getComputedStyle(document.documentElement).getPropertyValue('--aui-control-accent-color').trim()}};
            apply(s => { s.m.boxed = false; });
            return out;
        });

    T('C7 sizes: compact 12, sm 14, normal 16 (md too), lg 22; one watcher at most per checkbox',
        {sizes: [12, 14, 16, 16, 22], watchers: true},
        async () => {
            const sizes = ['s-compact', 's-sm', 's-normal', 's-md', 's-lg'].map(id => Math.round(host(id).querySelector('.aui-checkbox__box').getBoundingClientRect().width));
            const counts = Array.from(document.querySelectorAll('aui-checkbox')).map(el => {
                let n = 0;
                (function walk(s) { n += (s.$$watchers || []).length; for (let c = s.$$childHead; c; c = c.$$nextSibling) walk(c); })(angular.element(el).isolateScope());
                return n;
            });
            // the message line of c-req (show-errors) and its required watch: more there
            return {sizes, watchers: counts.filter((n, i) => document.querySelectorAll('aui-checkbox')[i].id !== 'c-req').every(n => n <= 1)};
        });

    T('G1 a group: values in the options\' order; a click adds or removes one, on-change with $option and $checked; the page\'s binding (boxes clicked one after another: once the clicking pauses); plain values; a value the options do not hold is kept',
        {start: ['on', 'off', 'off-x', 'off'], added: ['read', 'audit'], log: {value: ['read', 'audit'], oldValue: ['read'], checked: true, source: 'toggle', option: 'audit'},
            removed: ['audit'], page: 'audit', nums: [2], kept: ['b', 'c', 'gone']},
        async () => {
            const start = states('g-roles');
            optionBox('g-roles', 3).click();
            await sleep(50);
            const added = scope().g.roles.slice();
            const e = lastLog();
            optionBox('g-roles', 0).click();
            await sleep(550);   // the second of boxes clicked one after another: the page's digest once they pause (400 ms)
            const out = {start, added, log: {value: e.value, oldValue: e.oldValue, checked: e.checked, source: e.source, option: e.option.id},
                removed: scope().g.roles.slice(), page: document.getElementById('roles-value').textContent};
            optionBox('g-nums', 1).click();
            out.nums = scope().g.nums.slice();
            optionBox('g-kept', 2).click();
            out.kept = scope().g.kept.slice();
            return out;
        });

    T('G2 select-all: mixed while some are checked; a click checks every enabled option (a disabled one keeps its state), again clears them; on-change\'s source',
        {mixed: true, all: ['read', 'write', 'audit'], source: 'select-all', cleared: [], states: ['off', 'off', 'off-x', 'off']},
        async () => {
            const mixed = allBox('g-roles').indeterminate;
            allBox('g-roles').click();
            await sleep(50);
            const all = scope().g.roles.slice();
            const source = lastLog().source;
            allBox('g-roles').click();
            await sleep(50);
            return {mixed, all, source, cleared: scope().g.roles.slice(), states: states('g-roles')};
        });

    T('G3 min 2, max 3: with one, the min error once left; with three, the fourth option disabled and select-all too; the max error when the page puts four',
        {minError: 'Select at least 2', full: ['on', 'on', 'on', 'off-x'], allDisabled: true, maxError: 'Select at most 3'},
        async () => {
            const b = optionBox('g-limited', 0);
            b.focus();
            document.getElementById('c-plain').querySelector('input').focus();
            await sleep(100);
            const minError = message('g-limited');
            optionBox('g-limited', 1).click();
            optionBox('g-limited', 2).click();
            await sleep(100);
            const full = states('g-limited');
            const allDisabled = allBox('g-limited').disabled;
            apply(s => { s.g.limited = ['a', 'b', 'c', 'd']; });
            await sleep(50);
            return {minError, full, allDisabled, maxError: message('g-limited')};
        });

    T('G4 required group: its error in the form under its name; once left, its message; one checked, the error goes',
        {inForm: true, required: true, message: 'This field is required', after: {required: false, message: ''}},
        async () => {
            const f = scope().f;
            const out = {inForm: f.req === outer('g-req'), required: !!f.req.$error.required};
            optionBox('g-req', 0).focus();
            document.getElementById('c-plain').querySelector('input').focus();
            await sleep(100);
            out.message = message('g-req');
            optionBox('g-req', 1).click();
            await sleep(100);
            out.after = {required: !!f.req.$error.required, message: message('g-req')};
            return out;
        });

    T('G5 layouts: row, column, grid (columns); the group disabled: every box and select-all; the model changed in place by the page',
        {row: 'flex', column: 'column', grid: {display: 'grid', columns: 2}, disabled: {all: true, boxes: true}, inPlace: ['on', 'on', 'off-x', 'off']},
        async () => {
            const opts = () => getComputedStyle(host('g-roles').querySelector('.aui-checkbox-group__options'));
            const row = opts().display;
            const column = getComputedStyle(host('g-nums').querySelector('.aui-checkbox-group__options')).flexDirection;
            apply(s => { s.layout.name = 'grid'; s.layout.columns = 2; });
            const grid = {display: opts().display, columns: opts().gridTemplateColumns.split(' ').length};
            apply(s => { s.flags.groupOff = true; });
            const disabled = {all: allBox('g-roles').disabled, boxes: options('g-roles').every(o => o.querySelector('input').disabled)};
            apply(s => { s.flags.groupOff = false; s.layout.name = 'row'; });
            apply(s => { s.g.roles.push('read', 'write'); });
            return {row, column, grid, disabled, inPlace: states('g-roles')};
        });

    T('K1 a click: the model at once, with no digest of the page inside the click (the box drawn first: before, ngModel applied the whole page there); one digest of the page after the next frame',
        {inClick: 0, model: true, after: 1},
        async () => {
            await sleep(1100);   // no row of clicks before it
            apply(s => { s.m.plain = false; });
            const before = window.__digests.length;
            box('c-plain').click();
            const inClick = window.__digests.length - before;
            const model = scope().m.plain;
            await sleep(120);
            return {inClick, model, after: window.__digests.length - before};
        });

    T('K2 boxes clicked one after another (rows of a table): no digest of the page between them (no click waits for one); one once the clicking pauses; a press elsewhere runs an owed one first',
        {first: 1, between: 0, paused: 1, byPress: 1},
        async () => {
            await sleep(1100);
            const at = window.__digests.length;
            box('c-row1').click();
            await sleep(60);
            const first = window.__digests.length - at;
            box('c-row2').click();
            await sleep(150);
            box('c-row1').click();
            await sleep(150);
            const between = window.__digests.length - at - first;
            await sleep(450);
            const paused = window.__digests.length - at - first;
            box('c-row2').click();
            await sleep(50);
            const owed = window.__digests.length;
            document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true}));
            return {first, between, paused, byPress: window.__digests.length - owed};
        });

    T('K3 the box changes at once and never moves (no colour fade: one on the main thread froze near white under a long digest of the page; no press scale); the check only fades in',
        {box: '0s', press: 'none', check: 'opacity'},
        async () => {
            const box = look('c-plain').querySelector('.aui-checkbox__box');
            return {box: getComputedStyle(box).transitionDuration, press: getComputedStyle(box).transform,
                check: getComputedStyle(box, '::before').transitionProperty};
        });

    T('K4 in a table cell under a page\'s rules for spans and labels (position, top, margins, font size, line height, display, vertical-align): the box and the row number stand as in a clean cell',
        {same: true},
        async () => {
            const geo = id => {
                const host = document.getElementById(id), base = host.getBoundingClientRect();
                const r = el => { const b = el.getBoundingClientRect(); return [b.left - base.left, b.top - base.top, b.width, b.height].map(v => Math.round(v * 4) / 4); };
                return {box: r(host.querySelector('.aui-checkbox__box')), label: r(host.querySelector('.aui-checkbox__label')),
                    size: getComputedStyle(host.querySelector('.aui-checkbox__label')).fontSize};
            };
            const clean = geo('c-k4-clean'), hostile = geo('c-k4-hostile');
            const same = JSON.stringify(clean) === JSON.stringify(hostile);
            return same ? {same} : {same, clean, hostile};
        });

    T('K5 the box on the middle of its label\'s digits in the font they are drawn in (measured from the font: Microsoft YaHei draws them taller than Segoe UI); the box lifted by that middle',
        {yahei: true, segoe: true, taller: true, lifted: true},
        async () => {
            const mid = id => parseFloat(getComputedStyle(look(id)).getPropertyValue('--aui-checkbox-mid'));
            const y = mid('c-k5-yahei'), s = mid('c-k5-segoe');
            const lift = id => new DOMMatrix(getComputedStyle(look(id).querySelector('.aui-checkbox__control')).transform).m42;
            return {yahei: y > 0.37 && y < 0.41, segoe: s > 0.34 && s < 0.37, taller: y > s, lifted: lift('c-k5-yahei') < lift('c-k5-segoe')};
        });

    T('K6 row numbers in a table short of room (auto layout, long names beside): "10" and "100" stay on one line (the column is never squeezed below a whole number)',
        {ten: 1, hundred: 1},
        async () => {
            const lines = id => {
                const label = look(id).querySelector('.aui-checkbox__label');
                const range = document.createRange();
                range.selectNodeContents(label);
                return new Set(Array.from(range.getClientRects()).map(r => Math.round(r.top))).size;
            };
            return {ten: lines('c-k6-10'), hundred: lines('c-k6-100')};
        });

    T('E1 no Angular errors', {errors: 0}, async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-* family: aui-checkbox and aui-checkbox-group', tests);
})();
