// Field-parity suite (page: field-parity.html, fixture: field-parity.fixture.js): aui-input (form style), aui-select and
// aui-tree-select alike - the placeholder, the invalid look (aui-input touched on leaving it), readonly (the selects:
// focusable, nothing opens or changes), the selects' disabled trigger (out of the Tab order, aria-disabled), and a
// long label in the box (cut with an ellipsis in its room, its text on hover) and its share of the field
// (--aui-control-label-max-width, within its bounds).
(function () {
    const {sleep, outside} = AuiTest;
    const in_ = (row, tag) => document.querySelector('#' + row + ' ' + tag);
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const mouse = (el, name) => el.dispatchEvent(new MouseEvent(name, {bubbles: true, cancelable: true, button: 0}));
    const press = el => ['mousedown', 'mouseup', 'click'].forEach(n => mouse(el, n));
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}));
    const trig = el => el.querySelector('.aui-select__trigger');
    const isOpen = el => !!el.querySelector('.aui-select--open') || (angular.element(el).controller('auiSelect') || angular.element(el).controller('auiTreeSelect')).isOpen;
    // numbers to one decimal: the end of an ease-out transition can still read 2.998px for 3px
    const round = text => text.replace(/\d+\.\d+/g, n => (Math.round(parseFloat(n) * 10) / 10).toString());
    const font = el => { const s = getComputedStyle(el); return s.fontSize + ' ' + s.fontWeight + ' ' + s.color; };

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('FP1 the placeholder looks the same in the three fields (the value\'s size, regular weight)',
        {same: true, size: '14px', weight: '400'}, async () => {
            const input = in_('empty', 'aui-input input.aui-input__form-field');
            const ph = getComputedStyle(input, '::placeholder');
            const a = ph.fontSize + ' ' + ph.fontWeight + ' ' + ph.color;
            const b = font(in_('empty', 'aui-select .aui-select__placeholder'));
            const c = font(in_('empty', 'aui-tree-select .aui-select__placeholder'));
            return {same: a === b && b === c, size: ph.fontSize, weight: ph.fontWeight};
        });

    T('FP2 a required, empty aui-input turns red once it has been left (as the selects), with aria-invalid',
        {before: false, after: true, aria: 'true', sameRed: true, selectRed: true}, async () => {
            const host = in_('required', 'aui-input');
            const box = host.querySelector('.aui-input__form-trigger');
            const input = host.querySelector('input');
            const before = box.classList.contains('aui-input__form-trigger--invalid');
            input.focus();
            input.blur();
            input.dispatchEvent(new FocusEvent('blur'));   // the blur of a page without the focus is not always sent
            await sleep(60);
            [in_('required', 'aui-select'), in_('required', 'aui-tree-select')].forEach(el => apply(() => angular.element(el).controller('ngModel').$setTouched()));
            await sleep(450);   // past the colour transition of both
            const sb = getComputedStyle(trig(in_('required', 'aui-select')));
            const ib = getComputedStyle(box);
            return {before, after: box.classList.contains('aui-input__form-trigger--invalid'), aria: input.getAttribute('aria-invalid'),
                sameRed: round(ib.borderTopColor + ' ' + ib.boxShadow) === round(sb.borderTopColor + ' ' + sb.boxShadow),
                selectRed: trig(in_('required', 'aui-select')).classList.contains('aui-select__trigger--invalid')};
        });

    T('FP3 readonly selects: focusable, but no press, Enter, ArrowDown or Space opens them; no clear button; aria-readonly; the look of aui-input\'s readonly',
        {select: {focusable: true, opened: false, clear: false, aria: 'true', look: true}, tree: {focusable: true, opened: false, clear: false, aria: 'true', look: true}},
        async () => {
            const inputBox = getComputedStyle(in_('readonly', 'aui-input .aui-input__form-trigger')).backgroundColor;
            const out = {};
            for (const [name, el] of [['select', in_('readonly', 'aui-select')], ['tree', in_('readonly', 'aui-tree-select')]]) {
                const t = trig(el);
                t.focus();
                const focusable = el.contains(document.activeElement) && t.getAttribute('tabindex') === '0';
                press(t);
                await sleep(120);
                let opened = isOpen(el);
                for (const k of ['Enter', 'ArrowDown', ' ']) { key(t, k); await sleep(60); opened = opened || isOpen(el); }
                const clearEl = el.querySelector('.aui-control-clear');
                const clear = !!clearEl && !clearEl.classList.contains('aui-control-clear--hidden') && getComputedStyle(clearEl).display !== 'none';
                out[name] = {focusable, opened, clear, aria: t.getAttribute('aria-readonly'), look: getComputedStyle(t).backgroundColor === inputBox};
                t.blur();
            }
            return out;
        });

    T('FP4 readonly multiple selects: the tags show without their x, and a press on a tag removes nothing',
        {select: {tags: 2, removers: 0, model: [1, 2]}, tree: {tags: 2, removers: 0, model: ['n1', 'n2']}}, async () => {
            const out = {};
            for (const [name, el, field] of [['select', in_('readonly-multi', 'aui-select'), 'smro'], ['tree', in_('readonly-multi', 'aui-tree-select'), 'tmro']]) {
                const tags = el.querySelectorAll('.aui-select__selected-display > .aui-select__tags > .aui-select__tag:not(.aui-select__tag--count)');
                tags.forEach(tag => press(tag));
                await sleep(80);
                out[name] = {tags: tags.length, removers: el.querySelectorAll('.aui-select__selected-display .aui-select__tag-remove').length,
                    model: angular.copy(scope().m[field])};
            }
            return out;
        });

    T('FP5 readonly never chooses by itself (auto-select-on-single-required stays empty)',
        {select: true, tree: true}, async () => {
            await sleep(400);
            return {select: scope().m.sauto === undefined || scope().m.sauto === null, tree: scope().m.tauto === undefined || scope().m.tauto === null};
        });

    T('FP6 readonly switched on while open closes the field; switched off, it opens again',
        {select: {closed: true, reopened: true}, tree: {closed: true, reopened: true}}, async () => {
            const out = {};
            apply(s => { s.state.ro = false; });
            await sleep(60);
            for (const [name, el] of [['select', in_('readonly', 'aui-select')], ['tree', in_('readonly', 'aui-tree-select')]]) {
                press(trig(el));
                await sleep(300);
                const wasOpen = isOpen(el);
                apply(s => { s.state.ro = true; });
                await sleep(400);
                const closed = wasOpen && !isOpen(el);
                apply(s => { s.state.ro = false; });
                await sleep(60);
                press(trig(el));
                await sleep(300);
                const reopened = isOpen(el);
                outside();
                await sleep(450);
                out[name] = {closed, reopened};
            }
            apply(s => { s.state.ro = true; });
            return out;
        });

    T('FP7 a disabled select is out of the Tab order and says so (aria-disabled), as the tree',
        {select: {tabindex: null, aria: 'true'}, tree: {tabindex: null, aria: 'true'}}, async () => {
            const r = el => ({tabindex: trig(el).getAttribute('tabindex'), aria: trig(el).getAttribute('aria-disabled')});
            return {select: r(in_('disabled', 'aui-select')), tree: r(in_('disabled', 'aui-tree-select'))};
        });

    T('FP8 a label longer than half the field is cut with an ellipsis in its room (never over the value), its whole text on hover; a short one shows whole, without a tooltip',
        {long: ['cut, apart, Belongs product category of the hall', 'cut, apart, Belongs product category of the hall', 'cut, apart, Belongs product category of the hall'],
         short: ['whole, apart, no tooltip', 'whole, apart, no tooltip', 'whole, apart, no tooltip'], ellipsis: true},
        async () => {
            const read = (row, tag) => {
                const host = in_(row, tag);
                const label = host.querySelector('.aui-control-label');
                const value = host.querySelector(tag === 'aui-input' ? 'input' : '.aui-select__selected-display');
                label.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
                const cut = label.scrollWidth > label.clientWidth + 1;
                const apart = label.getBoundingClientRect().right <= value.getBoundingClientRect().left + 0.5;
                const title = label.getAttribute('title');
                return (cut ? 'cut' : 'whole') + ', ' + (apart ? 'apart' : 'over the value') + ', ' + (title || 'no tooltip');
            };
            const tags = ['aui-input', 'aui-select', 'aui-tree-select'];
            const label = in_('long-label', 'aui-select').querySelector('.aui-control-label');
            return {long: tags.map(tag => read('long-label', tag)), short: tags.map(tag => read('empty', tag)),
                ellipsis: getComputedStyle(label).textOverflow === 'ellipsis' && getComputedStyle(label).overflow === 'hidden'};
        });

    T('FP9 --aui-control-label-max-width: the label\'s share of the field (50% by default), another one for a form or one field; kept between 20% and what leaves the value its room; any other value counts as 50%',
        {unset: 50, form: [40, 40, 40], oneField: [40, 35, 40], tooSmall: 20, tooLarge: 'the value keeps 96px', invalid: [50, 50]},
        async () => {
            const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
            // the label's width (its content box, or its border box where the page sizes boxes so) in % of its row
            const share = host => {
                const label = host.querySelector('.aui-control-label');
                const row = label.parentElement;
                const rs = getComputedStyle(row), ls = getComputedStyle(label);
                const room = row.clientWidth - parseFloat(rs.paddingLeft) - parseFloat(rs.paddingRight);
                const used = ls.boxSizing === 'border-box' ? label.offsetWidth
                    : label.clientWidth - parseFloat(ls.paddingLeft) - parseFloat(ls.paddingRight);
                return {room, used, pct: Math.round(used / room * 100)};
            };
            const set = (el, value) => {
                if (value === null) el.style.removeProperty('--aui-control-label-max-width');
                else el.style.setProperty('--aui-control-label-max-width', value);
            };
            const row = document.getElementById('long-label');
            const hosts = ['aui-input', 'aui-select', 'aui-tree-select'].map(tag => in_('long-label', tag));
            const out = {unset: share(hosts[1]).pct};
            set(row, '40%');
            await frame();
            out.form = hosts.map(h => share(h).pct);
            set(hosts[1], '35%');
            await frame();
            out.oneField = hosts.map(h => share(h).pct);
            set(hosts[1], null);
            set(row, '5%');
            await frame();
            out.tooSmall = share(hosts[1]).pct;
            set(row, '95%');
            await frame();
            const large = share(hosts[1]);
            out.tooLarge = Math.abs(large.used - (large.room - 96)) <= 1 ? 'the value keeps 96px' : large.pct;
            set(row, 'abc');
            await frame();
            const word = share(hosts[1]).pct;
            set(row, '120px');
            await frame();
            out.invalid = [word, share(hosts[1]).pct];
            set(row, null);
            await frame();
            return out;
        });

    T('E1 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    T('FP10 the labels follow --aui-font-scale, or --aui-label-font-scale where a page sets it (whole pixels; a label factor that is not a number gives the design size); the value text follows --aui-font-scale only',
        {unset: ['14px', '13px'], scale90: ['13px', '12px'], labels100: ['13px', '13px'], labels110: ['13px', '14px'], invalid: ['14px', '13px']},
        async () => {
            const d = document.documentElement.style;
            const read = () => {
                const field = document.querySelector('aui-select');
                const value = field.querySelector('.aui-select__display-text, .aui-select__placeholder');
                return [getComputedStyle(value).fontSize, getComputedStyle(field.querySelector('.aui-control-label')).fontSize];
            };
            const at = (font, label) => {
                if (font) d.setProperty('--aui-font-scale', font); else d.removeProperty('--aui-font-scale');
                if (label) d.setProperty('--aui-label-font-scale', label); else d.removeProperty('--aui-label-font-scale');
                return read();
            };
            const out = {unset: at(null, null), scale90: at('0.9', null), labels100: at('0.9', '1'), labels110: at('0.9', '1.1'), invalid: at('1', 'abc')};
            at(null, null);
            return out;
        });

    T('FP11 the colour tokens: their defaults; one field takes its own (the others keep theirs); a value that is not a colour gives the default; the shades of the accent follow the accent of a field or its container',
        {defaults: {value: 'rgb(31, 35, 40)', label: 'rgb(100, 116, 139)'}, own: {value: 'rgb(1, 2, 3)', label: 'rgb(4, 5, 6)', other: 'rgb(31, 35, 40)'},
         typo: 'rgb(31, 35, 40)', shades: {accent: 'rgb(11, 143, 207)', text: true}},
        async () => {
            // two fields of its own: a select with a value and an input with a value
            const inj = angular.element(document.body).injector();
            const s = inj.get('$rootScope').$new();
            s.tk = {opts: [{id: 1, label: 'One'}], sel: 1, text: 'Text'};
            const box = document.createElement('div');
            box.innerHTML = '<div class="tk-a"><aui-select ng-model="tk.sel" options="tk.opts" show-label label-text="Token"></aui-select></div>'
                + '<div class="tk-b"><aui-input ng-model="tk.text" input-style-type="form" show-label label-text="Other"></aui-input></div>';
            document.body.appendChild(box);
            inj.get('$compile')(box)(s);
            s.$digest();
            await AuiTest.sleep(50);
            const a = box.querySelector('aui-select');
            const valueOf = () => getComputedStyle(a.querySelector('.aui-select__display-text')).color;
            const labelOf = () => getComputedStyle(a.querySelector('.aui-control-label')).color;
            const other = () => getComputedStyle(box.querySelector('aui-input input.aui-input__form-field')).color;
            const defaults = {value: valueOf(), label: labelOf()};
            a.style.setProperty('--aui-control-value-color', 'rgb(1, 2, 3)');
            a.style.setProperty('--aui-control-label-color', '#040506');
            const own = {value: valueOf(), label: labelOf(), other: other()};
            a.style.setProperty('--aui-control-value-color', 'not-a-colour');
            const typo = valueOf();
            a.style.removeProperty('--aui-control-value-color');
            a.style.removeProperty('--aui-control-label-color');
            box.firstChild.style.setProperty('--aui-control-accent-color', '#0b8fcf');
            const root = a.querySelector('.aui-select');
            const text = getComputedStyle(root).getPropertyValue('--aui-control-accent-text');
            const shades = {accent: getComputedStyle(root).getPropertyValue('--aui-control-accent-color').trim(),
                text: text.indexOf('11, 143, 207') >= 0 || text.indexOf('#0b8fcf') >= 0};
            s.$destroy();
            box.remove();
            return {defaults, own, typo, shades};
        });

    AuiTest.run('aui-* family: aui-input, aui-select, aui-tree-select alike', tests, {delay: 0});
})();
