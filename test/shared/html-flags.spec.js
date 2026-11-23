// html-flags suite (page: html-flags.html, fixture: html-flags.fixture.js): a flag written the HTML way, its own name
// as its value (disabled="disabled", readonly="readonly"), is on in every component, while the scope has nothing by
// that name; an expression (disabled="vm.locked", disabled="false") still counts as one.
(function () {
    const {sleep, outside} = AuiTest;
    const cell = id => document.querySelector('#' + id);
    const host = (id, tag) => cell(id).querySelector(tag);
    const ctrl = (id, tag, name) => angular.element(host(id, tag)).controller(name);
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const box = id => cell(id).querySelector('aui-input input:not([type="hidden"]), aui-input textarea');
    const trigger = id => cell(id).querySelector('.aui-select__trigger');
    const errCount = () => window.__ngErrors.length;
    async function pressed(el) { el.click(); await sleep(200); }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('H1 aui-input disabled="disabled": the box disabled, the disabled look, the option on',
        {boxDisabled: true, look: true, option: true},
        async () => ({boxDisabled: box('in-d').disabled, look: !!cell('in-d').querySelector('.aui-input--disabled'),
            option: ctrl('in-d', 'aui-input', 'auiInput').opt.disabled}));

    T('H2 aui-input readonly="readonly": the box read-only, not disabled',
        {boxReadonly: true, boxDisabled: false, option: true},
        async () => ({boxReadonly: box('in-r').readOnly, boxDisabled: box('in-r').disabled,
            option: ctrl('in-r', 'aui-input', 'auiInput').opt.readonly}));

    T('H3 aui-input disabled="vm.locked": unset is off; it follows the expression',
        {unset: false, on: true, off: false},
        async () => {
            const unset = box('in-x').disabled;
            apply(s => { s.vm.locked = true; });
            await sleep(30);
            const on = box('in-x').disabled;
            apply(s => { s.vm.locked = false; });
            await sleep(30);
            return {unset, on, off: box('in-x').disabled};
        });

    T('H4 aui-input disabled="false": off',
        {boxDisabled: false},
        async () => ({boxDisabled: box('in-f').disabled}));

    T('H5 aui-textarea disabled="disabled": the text box disabled',
        {tag: 'textarea', boxDisabled: true},
        async () => ({tag: box('ta-d').tagName.toLowerCase(), boxDisabled: box('ta-d').disabled}));

    T('H6 aui-select disabled="disabled": not focusable, marked disabled, a press does not open it',
        {ariaDisabled: 'true', tabindex: null, open: false},
        async () => {
            await pressed(trigger('se-d'));
            return {ariaDisabled: trigger('se-d').getAttribute('aria-disabled'), tabindex: trigger('se-d').getAttribute('tabindex'),
                open: !!ctrl('se-d', 'aui-select', 'auiSelect').isOpen};
        });

    T('H7 aui-select readonly="readonly": read-only, a press does not open it',
        {readonly: true, open: false},
        async () => {
            await pressed(trigger('se-r'));
            const c = ctrl('se-r', 'aui-select', 'auiSelect');
            return {readonly: c.isReadonly(), open: !!c.isOpen};
        });

    T('H7b aui-select multiple="multiple": several values, the value shown as a tag',
        {multiple: true, tags: 1},
        async () => ({multiple: ctrl('se-m', 'aui-select', 'auiSelect').multiple,
            tags: cell('se-m').querySelectorAll('.aui-select__tag:not(.aui-select__tag--more)').length}));

    T('H7c aui-select disabled="vm.locked" and ng-disabled="vm.locked": unset is off; both follow the expression',
        {unset: [false, false], on: [true, true, 'true', 'true'], off: [false, false]},
        async () => {
            const c = id => ctrl(id, 'aui-select', 'auiSelect');
            const unset = [c('se-x').disabled, c('se-n').disabled];
            apply(s => { s.vm.locked = true; });
            await sleep(30);
            const on = [c('se-x').disabled, c('se-n').disabled, trigger('se-x').getAttribute('aria-disabled'), trigger('se-n').getAttribute('aria-disabled')];
            apply(s => { s.vm.locked = false; });
            await sleep(30);
            return {unset, on, off: [c('se-x').disabled, c('se-n').disabled]};
        });

    T('H8 aui-tree-select disabled="disabled": not focusable, marked disabled, a press does not open it',
        {option: true, ariaDisabled: 'true', tabindex: null, open: false},
        async () => {
            await pressed(trigger('tr-d'));
            const c = ctrl('tr-d', 'aui-tree-select', 'auiTreeSelect');
            return {option: c.opt.disabled, ariaDisabled: trigger('tr-d').getAttribute('aria-disabled'),
                tabindex: trigger('tr-d').getAttribute('tabindex'), open: !!c.isOpen};
        });

    T('H9 aui-tree-select readonly="readonly": read-only, a press does not open it',
        {option: true, open: false},
        async () => {
            await pressed(trigger('tr-r'));
            const c = ctrl('tr-r', 'aui-tree-select', 'auiTreeSelect');
            return {option: c.opt.readonly, open: !!c.isOpen};
        });

    T('H10 aui-date-picker disabled="disabled": disabled, its text box too',
        {disabled: true, boxDisabled: true},
        async () => ({disabled: ctrl('dp-d', 'aui-date-picker', 'auiDatePicker').isDisabled(),
            boxDisabled: host('dp-d', 'input').disabled}));

    T('H11 aui-date-picker readonly="readonly": read-only, its text box too',
        {readonly: true, boxReadonly: true},
        async () => ({readonly: ctrl('dp-r', 'aui-date-picker', 'auiDatePicker').isReadonly(),
            boxReadonly: host('dp-r', 'input').readOnly}));

    T('H12 aui-button disabled="disabled": the button disabled, a press does nothing',
        {buttonDisabled: true, pressed: 0},
        async () => {
            const b = host('bt-d', 'button');
            await pressed(b);
            return {buttonDisabled: b.disabled, pressed: scope().pressed};
        });

    T('H13 aui-checkbox disabled="disabled": the box disabled, a press on its label changes nothing',
        {boxDisabled: true, look: true, model: false},
        async () => {
            await pressed(host('cb-d', 'label') || host('cb-d', 'aui-checkbox'));
            return {boxDisabled: host('cb-d', 'input').disabled, look: !!cell('cb-d').querySelector('.aui-checkbox--disabled'),
                model: scope().m.agree};
        });

    T('H14 aui-checkbox-group disabled="disabled": every box disabled',
        {boxes: 2, allDisabled: true},
        async () => {
            const boxes = Array.prototype.slice.call(cell('cg-d').querySelectorAll('input[type="checkbox"][data-i]'));
            return {boxes: boxes.length, allDisabled: boxes.every(b => b.disabled)};
        });

    T('H15 aui-popover disabled="disabled": the trigger disabled, a press does not open the card',
        {disabledLook: true, shown: 0},
        async () => {
            const t = host('po-d', '.aui-popover__trigger');
            await pressed(t);
            const out = {disabledLook: t.classList.contains('aui-popover__trigger--disabled'),
                shown: document.querySelectorAll('.aui-popover__panel--shown').length};
            outside();
            await sleep(200);
            return out;
        });

    T('H16b a disabled box shows no caret (input, textarea, date-picker); an enabled one keeps it',
        {disabled: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'], enabledVisible: true},
        async () => {
            const caret = el => getComputedStyle(el).caretColor;
            return {disabled: [caret(box('in-d')), caret(box('ta-d')), caret(host('dp-d', 'input'))],
                enabledVisible: caret(box('in-f')) !== 'rgba(0, 0, 0, 0)'};
        });

    T('H16 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: errCount()}));

    AuiTest.run('aui-* family: flags written the HTML way', tests);
})();
