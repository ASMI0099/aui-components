// Field-extras suite (page: field-extras.html, fixture: field-extras.fixture.js): the message line (hint-text,
// error-text, error-messages, show-errors, the shared texts of auiFieldMessages), size and label-position, on aui-input,
// aui-select and aui-tree-select alike; none of it there unless set.
(function () {
    const {sleep, type} = AuiTest;
    const fields = row => ['aui-input', 'aui-select', 'aui-tree-select'].map(tag => document.querySelector('#' + row + ' ' + tag));
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const box = el => el.querySelector('.aui-input__form-trigger, .aui-select__trigger');
    const focusable = el => el.querySelector('input.aui-input__form-field') || el.querySelector('.aui-select__trigger');
    const msg = el => el.querySelector('.aui-field-message');
    const touch = el => apply(() => angular.element(el).controller('ngModel').$setTouched());
    const names = ['input', 'select', 'tree'];
    const each = (row, fn) => { const out = {}; fields(row).forEach((el, i) => { if (el) out[names[i]] = fn(el); }); return out; };

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('XF1 none of it unless set: no message line, no size or label-position class, 34px, no aria-describedby',
        {input: {line: false, cls: 0, height: 34, describedBy: null}, select: {line: false, cls: 0, height: 34, describedBy: null},
            tree: {line: false, cls: 0, height: 34, describedBy: null}}, async () => {
            await sleep(100);
            return each('plain', el => ({line: !!msg(el), cls: el.querySelectorAll('[class*="--small"], [class*="--large"], [class*="--label-top"]').length,
                height: Math.round(box(el).getBoundingClientRect().height), describedBy: focusable(el).getAttribute('aria-describedby')}));
        });

    T('XF2 hint-text: the hint on the message line, muted, the line kept (18px), the box described by it',
        {input: {text: 'As on the ID card', error: false, color: 'rgb(100, 116, 139)', room: 18, linked: true},
            select: {text: 'Where the room is', error: false, color: 'rgb(100, 116, 139)', room: 18, linked: true},
            tree: {text: 'The main category', error: false, color: 'rgb(100, 116, 139)', room: 18, linked: true}}, async () =>
            each('hint', el => {
                const m = msg(el);
                return {text: m.textContent.trim(), error: m.classList.contains('aui-field-message--error'), color: getComputedStyle(m).color,
                    room: Math.round(m.getBoundingClientRect().height), linked: (focusable(el).getAttribute('aria-describedby') || '').split(' ').indexOf(m.id) >= 0 && !!m.id};
            }));

    T('XF3 once the field shows invalid, the line tells why (the shared required text), in the invalid red, aria-live; the hint comes back once valid',
        {before: {input: 'As on the ID card', select: 'Where the room is', tree: 'The main category'},
            after: {input: {text: 'This field is required', error: true, color: 'rgb(220, 53, 69)', live: 'polite'},
                select: {text: 'This field is required', error: true, color: 'rgb(220, 53, 69)', live: 'polite'},
                tree: {text: 'This field is required', error: true, color: 'rgb(220, 53, 69)', live: 'polite'}},
            fixed: 'As on the ID card', moved: false}, async () => {
            const before = each('hint', el => msg(el).textContent.trim());
            const heights = fields('hint').map(el => el.getBoundingClientRect().height);
            fields('hint').forEach(touch);
            await sleep(300);
            const after = each('hint', el => ({text: msg(el).textContent.trim(), error: msg(el).classList.contains('aui-field-message--error'),
                color: getComputedStyle(msg(el)).color, live: msg(el).getAttribute('aria-live')}));
            const moved = fields('hint').some((el, i) => Math.abs(el.getBoundingClientRect().height - heights[i]) > 0.5);
            type(fields('hint')[0].querySelector('input'), 'Ann');
            await sleep(30);
            return {before, after, fixed: msg(fields('hint')[0]).textContent.trim(), moved};
        });

    T('XF4 the field\'s own texts: error-messages per check ({length} filled in), error-text for any check',
        {input: {required: 'Name is needed', over: 'Up to 5 letters'}, select: 'Choose one', tree: 'Pick a category'}, async () => {
            const [input, select, tree] = fields('custom');
            fields('custom').forEach(touch);
            await sleep(50);
            const required = msg(input).textContent.trim();
            type(input.querySelector('input'), 'abcdefg');
            await sleep(30);
            return {input: {required, over: msg(input).textContent.trim()}, select: msg(select).textContent.trim(), tree: msg(tree).textContent.trim()};
        });

    T('XF5 show-errors with the shared texts: one set by the page (auiFieldMessagesProvider), precision "0", {max} filled in',
        {pattern: 'Digits only, please', whole: 'Whole numbers only', max: 'At most 100'}, async () => {
            const [pat, whole, upto] = [...document.querySelectorAll('#shared aui-input')];
            const leave = el => { el.querySelector('input').dispatchEvent(new FocusEvent('blur')); scope().$apply(); };
            type(pat.querySelector('input'), 'abc'); leave(pat);
            apply(s => { s.m.whole = 2.5; }); leave(whole);
            type(upto.querySelector('input'), '150'); leave(upto);
            await sleep(30);
            return {pattern: msg(pat).textContent.trim(), whole: msg(whole).textContent.trim(), max: msg(upto).textContent.trim()};
        });

    T('XF6 size: the box is 28px small and 40px large, the three alike; a small multiple select with tags stays 28px',
        {small: {input: 28, select: 28, tree: 28}, large: {input: 40, select: 40, tree: 40}, smallTags: 28}, async () => {
            await sleep(50);
            const h = el => Math.round(box(el).getBoundingClientRect().height);
            return {small: each('small', h), large: each('large', h),
                smallTags: h(document.querySelector('#small-multi aui-select'))};
        });

    T('XF6b size with the row parts (clear button and count, the password eye, prefix and suffix): still 28px and 40px, the parts inside the box',
        {small: [28, 28, 28], large: [40, 40, 40], inside: true}, async () => {
            await sleep(50);
            const rows = ['small-row', 'large-row'].map(id => [...document.querySelectorAll('#' + id + ' aui-input')]);
            const h = el => Math.round(box(el).getBoundingClientRect().height);
            const inside = rows.every(list => list.every(el => {
                const b = box(el).getBoundingClientRect();
                return [...el.querySelectorAll('.aui-control-clear, .aui-input__eye, .aui-input__count, .aui-input__affix')].every(p => {
                    const r = p.getBoundingClientRect();
                    return r.height === 0 || (r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5);
                });
            }));
            return {small: rows[0].map(h), large: rows[1].map(h), inside};
        });

    T('XF7 label-position="top": the label above the box (none in it); a press on it gives the field the focus, nothing opens',
        {input: {above: true, inBox: false, focused: true}, select: {above: true, inBox: false, focused: true, open: false},
            tree: {above: true, inBox: false, focused: true, open: false}}, async () => {
            const out = {};
            const els = fields('top');
            for (let i = 0; i < els.length; i++) {
                const el = els[i];
                const label = el.querySelector('.aui-field-label');
                const lr = label.getBoundingClientRect(), br = box(el).getBoundingClientRect();
                // above the box, as wide as the field (no float, no fixed width of a page's label rules), one 18px line
                const r = {above: lr.bottom <= br.top + 0.5 && Math.abs(lr.left - br.left) < 1 && lr.width > br.width - 6
                        && Math.round(lr.height) === 18,
                    inBox: !!box(el).querySelector('.aui-control-label')};
                label.click();
                await sleep(80);
                r.focused = el.contains(document.activeElement);
                if (i > 0) r.open = !!el.querySelector('.aui-select--open');
                document.activeElement.blur();
                out[names[i]] = r;
            }
            return out;
        });

    T('XF8 the basic style\'s floating label under a page\'s label rules: one line, as wide as its text, risen above the text on focus',
        {oneLine: true, wide: true, risen: true}, async () => {
            const el = document.querySelector('#basic-label aui-input');
            const input = el.querySelector('input');
            input.focus();
            await sleep(400);
            const l = el.querySelector('.aui-input-label').getBoundingClientRect(), i = input.getBoundingClientRect();
            input.blur();
            return {oneLine: l.height < 22, wide: l.width > 120, risen: l.bottom <= i.top + 2};
        });

    T('E1 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    T('F11 ng-disabled on every field: the flag Angular sets is followed - disabled while on, usable again when off (aui-input, aui-select, aui-tree-select, aui-date-picker)',
        {on: [true, true, true, true], back: [false, false, false, false]},
        async () => {
            const els = ['aui-input', 'aui-select', 'aui-tree-select', 'aui-date-picker'].map(t => document.querySelector('#ngdis ' + t));
            const isOff = el => (el.tagName === 'AUI-INPUT' ? !!el.querySelector('input').disabled : !!el.querySelector('.aui-select--disabled'));
            apply(s => { s.m.off = true; });
            await sleep(120);
            const on = els.map(isOff);
            apply(s => { s.m.off = false; });
            await sleep(120);
            return {on, back: els.map(isOff)};
        });

    AuiTest.run('aui-* family: message line, size, label-position', tests, {delay: 0});
})();
