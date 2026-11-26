// input-more suite (page: input-more.html, fixture: input-more.fixture.js): aui-textarea (aui-input with a <textarea>),
// aui-input's search preset (search, on-search, search-debounce, searching) and its cell style, under a page's general
// label rules.
(function () {
    const {sleep, type} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-input');
    const area = id => host(id).querySelector('textarea');
    const box = id => host(id).querySelector('input');
    const trigger = id => host(id).querySelector('.aui-input__form-trigger');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const press = (el, init) => { const e = new KeyboardEvent('keydown', Object.assign({bubbles: true, cancelable: true}, init)); el.dispatchEvent(e); return e.defaultPrevented; };
    const rect = el => el.getBoundingClientRect();

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('XT1 aui-textarea is an aui-input around a <textarea>: 3 rows, form.<name> is its own ngModel (required), the label in the box, the count at the bottom right, the clear button at the top right',
        {textarea: true, rows: '3', isField: true, required: ['required'], label: true, labelInBox: true, count: '0/20', countCorner: true}, async () => {
            await sleep(50);
            const h = host('ta'), t = area('ta'), b = rect(trigger('ta')), c = rect(h.querySelector('.aui-input__count'));
            return {textarea: !!t, rows: t.getAttribute('rows'), isField: scope().f.note === angular.element(h).controller('ngModel'),
                required: Object.keys(scope().f.note.$error), label: !!h.querySelector('.aui-control-label'),
                labelInBox: rect(h.querySelector('.aui-control-label')).top >= b.top - 0.5 && rect(h.querySelector('.aui-control-label')).left >= b.left - 0.5,
                count: h.querySelector('.aui-input__count').textContent.trim(),
                countCorner: c.right <= b.right - 4 && c.bottom <= b.bottom - 1 && c.bottom > b.bottom - 12};
        });

    T('XT2 typing several lines: the model has them, the count follows; Enter is a new line (no on-finish), leaving the field is on-finish',
        {model: 'one\ntwo', count: '7/20', enterPrevented: false, onEnter: [], onLeave: ['blur'], clearTop: true}, async () => {
            apply(s => { s.finishes.length = 0; });
            type(area('ta'), 'one\ntwo');
            await sleep(30);
            const enterPrevented = press(area('ta'), {key: 'Enter', keyCode: 13, which: 13});
            const onEnter = scope().finishes.slice();
            area('ta').dispatchEvent(new FocusEvent('blur'));
            scope().$apply();
            const clear = host('ta').querySelector('.aui-control-clear');
            return {model: scope().m.note, count: host('ta').querySelector('.aui-input__count').textContent.trim(), enterPrevented, onEnter,
                onLeave: scope().finishes.slice(), clearTop: rect(clear).top - rect(trigger('ta')).top < 12};
        });

    T('XT3 auto-height: as tall as its text, from rows (2) up to max-rows (5), then it scrolls; cleared text back to its rows',
        {grows: true, capped: true, scrolls: 'auto', back: true}, async () => {
            const t = area('ta-auto');
            await sleep(30);
            const start = rect(t).height;
            type(t, 'a\nb\nc\nd');
            await sleep(30);
            const four = rect(t).height;
            type(t, '1\n2\n3\n4\n5\n6\n7\n8\n9\n10');
            await sleep(30);
            const ten = rect(t).height;
            const scrolls = t.style.overflowY;
            apply(s => { s.m.auto = ''; });
            await sleep(30);
            // five lines and the textarea's own padding (the box's right and bottom padding are the textarea's)
            const cs = getComputedStyle(t);
            const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
            return {grows: four > start + 30, capped: Math.abs(ten - (5 * 20 + pad)) <= 1, scrolls, back: Math.abs(rect(t).height - start) <= 1};
        });

    T('XT4 aui-textarea with enforce-limits: the textarea\'s own maxlength; label-position="top" with a hint',
        {maxlength: '5', above: true, hint: 'A hint'}, async () => {
            const top = host('ta-top');
            const label = top.querySelector('.aui-field-label');
            return {maxlength: area('ta-strict').getAttribute('maxlength'),
                above: !!label && rect(label).bottom <= rect(trigger('ta-top')).top + 0.5 && rect(label).height < 22,
                hint: top.querySelector('.aui-field-message').textContent.trim()};
        });

    T('XT5 aui-textarea in ng-repeat: one field each (ng-repeat not handed on), its own model and form entry; a written class stays on aui-textarea, an id with {{...}} is filled in on the field',
        {wrappers: 2, fields: 2, nested: 0, values: ['first', ''], form: [true, true], required: ['required'], wrapperClass: true, ids: ['rep0', 'rep1']},
        async () => {
            const wraps = [...document.querySelectorAll('#ta-rep aui-textarea')];
            return {wrappers: wraps.length, fields: document.querySelectorAll('#ta-rep aui-textarea > aui-input').length,
                nested: document.querySelectorAll('#ta-rep aui-input aui-input').length,
                values: [...document.querySelectorAll('#ta-rep textarea')].map(t => t.value),
                form: [!!scope().f.rep0, !!scope().f.rep1], required: Object.keys(scope().f.rep1.$error),
                wrapperClass: wraps.every(w => w.classList.contains('rep-wrap') && w.id === ''),
                ids: wraps.map(w => w.querySelector('aui-input').id)};
        });

    T('XS1 search: the search icon, a searchbox with the search key; on-search on Enter and when cleared; with search-debounce once typing pauses (once)',
        {icon: true, role: 'searchbox', key: 'search', enter: ['phones'], cleared: ['phones', ''], paused: ['phones', '', 'lap'], noDebounce: ['tv']},
        async () => {
            const b = box('search');
            apply(s => { s.searches.length = 0; s.searches2.length = 0; });
            type(b, 'phones');
            press(b, {key: 'Enter', keyCode: 13, which: 13});
            await sleep(10);
            const enter = scope().searches.slice();   // Enter came before the pause: no second search for it
            host('search').querySelector('.aui-control-clear').click();
            const cleared = scope().searches.slice();
            type(b, 'l'); await sleep(20); type(b, 'la'); await sleep(20); type(b, 'lap');
            await sleep(200);
            const paused = scope().searches.slice();
            type(box('search2'), 'tv');
            await sleep(150);
            const before = scope().searches2.length;
            press(box('search2'), {key: 'Enter', keyCode: 13, which: 13});
            return {icon: !!host('search').querySelector('.aui-input__search-icon'), role: b.getAttribute('role'), key: b.getAttribute('enterkeyhint'),
                enter: enter.slice(0, 1), cleared, paused, noDebounce: before === 0 ? scope().searches2.slice() : ['typed!']};
        });

    T('XS2 searching: the spinner in place of the icon, aria-busy; a field without search has none of it',
        {spinner: true, icon: false, busy: 'true', after: {spinner: false, icon: true, busy: null}, plain: {role: null, key: null, icon: false}}, async () => {
            apply(s => { s.state.busy = true; });
            await sleep(20);
            const h = host('search');
            const out = {spinner: !!h.querySelector('.aui-input__search-spinner'), icon: !!h.querySelector('.aui-input__search-icon'), busy: box('search').getAttribute('aria-busy')};
            apply(s => { s.state.busy = false; });
            await sleep(20);
            out.after = {spinner: !!h.querySelector('.aui-input__search-spinner'), icon: !!h.querySelector('.aui-input__search-icon'), busy: box('search').getAttribute('aria-busy')};
            const cell = host('cell');
            out.plain = {role: cell.querySelector('input').getAttribute('role'), key: cell.querySelector('input').getAttribute('enterkeyhint'), icon: !!cell.querySelector('.aui-input__search-icon')};
            return out;
        });

    T('XC1 cell style: 28px, no label (even with show-label), no border at rest; the focus ring when focused; an invalid cell keeps its red border',
        {height: 28, label: false, restBorder: 'rgba(0, 0, 0, 0)', focusBorder: 'rgb(13, 110, 253)', invalidBorder: 'rgb(220, 53, 69)', fits: true}, async () => {
            await sleep(50);
            const t = trigger('cell');
            const restBorder = AuiTest.fieldLook(t).border;
            box('cell').focus();
            await sleep(320);
            const focusBorder = AuiTest.fieldLook(t).border;
            box('cell').blur();
            const empty = host('cell-empty');
            empty.querySelector('input').dispatchEvent(new FocusEvent('blur'));
            scope().$apply();
            await sleep(320);
            const cellRect = rect(document.getElementById('cell'));
            return {height: Math.round(rect(t).height), label: !!host('cell').querySelector('.aui-control-label, .aui-field-label'), restBorder, focusBorder,
                invalidBorder: AuiTest.fieldLook(empty.querySelector('.aui-input__form-trigger')).border,
                fits: rect(t).right <= cellRect.right && rect(t).left >= cellRect.left};
        });

    T('XB1 input-text-bold: the text bold and black in the form and basic styles and in aui-textarea (above the boxes\' own !important weight); readonly keeps its grey; a value without it is regular',
        {form: ['700', 'rgb(0, 0, 0)'], basic: ['700', 'rgb(0, 0, 0)'], textarea: ['700', 'rgb(0, 0, 0)'], readonly: ['700', 'rgb(100, 116, 139)'],
         plain: ['400', 'rgb(31, 35, 40)']}, async () => {
            const look = id => { const b = host(id).querySelector('input, textarea'); const cs = getComputedStyle(b); return [cs.fontWeight, cs.color]; };
            return {form: look('bold-form'), basic: look('bold-basic'), textarea: look('bold-ta'), readonly: look('bold-ro'), plain: look('plain')};
        });

    T('XY1 input-type: a text-like type is the box\'s own (email, tel, number); another one (file, range: a control of its own) gives a text box, which takes typing',
        {types: {'type-file': 'text', 'type-range': 'text', 'type-email': 'email', 'type-tel': 'tel', 'type-num': 'number'}, typed: 'abc'},
        async () => {
            const types = {};
            ['type-file', 'type-range', 'type-email', 'type-tel', 'type-num'].forEach(id => { types[id] = box(id).type; });
            type(box('type-file'), 'abc');
            await sleep(50);
            return {types, typed: scope().m.typeFile};
        });

    T('XL1 basic style under a page\'s label colour (.form-group label): its label (the placeholder\'s text) is not seen at rest and never over the box; focused, a blue 12px caption above the line, in the regular weight',
        {rest: {seen: false, overBox: false}, early: {overBox: false}, focused: {seen: true, overBox: false, above: true, color: 'rgb(13, 110, 253)', weight: '400'}},
        async () => {
            const label = host('basic-group').querySelector('.aui-input-label');
            const b = box('basic-group');
            const look = () => {
                const cs = getComputedStyle(label), l = rect(label), r = rect(b);
                return {seen: cs.visibility === 'visible' && cs.opacity !== '0', overBox: l.bottom > r.top + 1 && l.top < r.bottom - 1,
                    above: l.bottom <= r.top + 1, color: cs.color, weight: cs.fontWeight};
            };
            const r0 = look();
            b.focus();
            const e0 = look();
            await sleep(300);
            const f0 = look();
            b.blur();
            return {rest: {seen: r0.seen, overBox: r0.overBox}, early: {overBox: e0.overBox},
                focused: {seen: f0.seen, overBox: f0.overBox, above: f0.above, color: f0.color, weight: f0.weight}};
        });

    T('TA9 aui-textarea: a press in its frame outside the text box (its padding, the count) puts the caret in the text box',
        {padding: true, count: true},
        async () => {
            const pressOn = el => el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0}));
            const frame = host('ta-strict').querySelector('.aui-input__form-trigger');
            area('ta-strict').blur();
            pressOn(frame);
            const padding = document.activeElement === area('ta-strict');
            area('ta-strict').blur();
            pressOn(host('ta-strict').querySelector('.aui-input__count'));
            const count = document.activeElement === area('ta-strict');
            area('ta-strict').blur();
            return {padding, count};
        });

    T('E1 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-input: aui-textarea, search, cell style', tests, {delay: 0});
})();
