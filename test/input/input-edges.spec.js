// aui-input edges suite (page: input-edges.html, fixture: input-edges.fixture.js): the box's accessible name, the
// number step and edits that go further out, rules changed by the page, leaving the field, autofocus when shown,
// search, the textarea's height and description, the width.
(function () {
    const {sleep, type, frames, until} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-input');
    const box = id => host(id).querySelector('input:not([type="hidden"]), textarea');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const form = () => scope().f;
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const errors = ctrl => Object.keys(ctrl.$error).sort();
    const outsideButton = () => document.getElementById('outside');
    // an edit as the browser sends it: beforeinput (the text before), the new text, then input
    const edit = (input, next) => {
        input.dispatchEvent(new InputEvent('beforeinput', {inputType: 'insertText', data: next.slice(-1), bubbles: true, cancelable: true}));
        input.value = next;
        input.dispatchEvent(new Event('input', {bubbles: true}));
    };
    const enter = input => input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true}));

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('E1 a number box\'s step: "any" without precision (a valid 1.5 never stops a native form submit) and with a min off the precision grid',
        {noPrecision: 'any', minOffGrid: 'any', typed: {stepMismatch: false, valid: true}},
        async () => {
            const b = box('n-any');
            type(b, '1.5');
            return {noPrecision: b.getAttribute('step'), minOffGrid: box('n-prec-min').getAttribute('step'),
                typed: {stepMismatch: b.validity.stepMismatch, valid: b.validity.valid}};
        });

    T('E2 enforce-limits: a page value beyond max can be corrected digit by digit; an edit further out is undone',
        {shown: '12345', shortened: '1234', longer: '1234', fromRange: '100'},
        async () => {
            const b = box('n-strict');
            const shown = b.value;
            edit(b, '1234');
            const shortened = b.value;
            edit(b, '12345');
            const longer = b.value;
            type(b, '100');
            edit(b, '1000');
            return {shown, shortened, longer, fromRange: b.value};
        });

    T('E3 precision: a page value with more decimals can be shortened; an edit that adds one is undone',
        {shown: '1.2345', fewer: '1.234', more: '1.234'},
        async () => {
            const b = box('n-prec-page');
            const shown = b.value;
            edit(b, '1.234');
            const fewer = b.value;
            edit(b, '1.2345');
            return {shown, fewer, more: b.value};
        });

    T('E4 precision changed by the page: the value is checked again at once, both ways; the field stays pristine',
        {at2: [], at1: {errors: ['precision'], model: 'undefined', pristine: true}, back: {errors: [], model: 1.23, pristine: true}},
        async () => {
            const field = () => form().pdyn;
            const model = () => scope().m.pdyn === undefined ? 'undefined' : scope().m.pdyn;
            const at2 = errors(field());
            apply(s => { s.state.places = 1; });
            await sleep(30);
            const at1 = {errors: errors(field()), model: model(), pristine: field().$pristine};
            apply(s => { s.state.places = 2; });
            await sleep(30);
            return {at2, at1, back: {errors: errors(field()), model: model(), pristine: field().$pristine}};
        });

    T('E5 max changed by the page: the model follows the check, the field and the form stay pristine, no on-change; a typed change is the user\'s',
        {down: {errors: ['max'], model: 'undefined', pristine: true, formPristine: true, changes: 0},
            up: {errors: [], model: 25, pristine: true, formPristine: true, changes: 0},
            typed: {value: 30, source: 'input', byUser: true}},
        async () => {
            const field = () => form().rdyn;
            const look = () => ({errors: errors(field()), model: scope().m.rdyn === undefined ? 'undefined' : scope().m.rdyn,
                pristine: field().$pristine, formPristine: form().$pristine, changes: scope().changes.length});
            apply(s => { s.f.$setPristine(); s.changes.length = 0; });
            apply(s => { s.state.max = 20; });
            await sleep(30);
            const down = look();
            apply(s => { s.state.max = 40; });
            await sleep(30);
            const up = look();
            type(box('r-dyn'), '30');
            await sleep(30);
            const last = scope().changes[scope().changes.length - 1] || {};
            return {down, up, typed: {value: last.value, source: last.source, byUser: last.byUser}};
        });

    T('E6 ng-model-options updateOn blur with a blur debounce: the text is committed after the debounce once the field is left',
        {typed: 'old', rightAfter: 'old', later: 'new'},
        async () => {
            const b = box('blur-deb');
            b.focus();
            type(b, 'new');
            const typed = scope().m.bd;
            outsideButton().focus();
            await sleep(20);
            const rightAfter = scope().m.bd;
            await sleep(300);
            return {typed, rightAfter, later: scope().m.bd};
        });

    T('E7 a Tab to the field\'s own clear button does not finish the field; leaving from the clear button does',
        {toClear: {finishes: [], touched: false}, out: {finishes: ['blur'], touched: true}},
        async () => {
            const b = box('fin-clear');
            const clear = host('fin-clear').querySelector('.aui-control-clear');
            b.focus();
            await sleep(20);
            clear.focus();
            await sleep(30);
            const toClear = {finishes: scope().finishes.slice(), touched: form().fc.$touched};
            outsideButton().focus();
            await sleep(30);
            return {toClear, out: {finishes: scope().finishes.slice(), touched: form().fc.$touched}};
        });

    T('E8 autofocus on a field hidden at first (ng-show): it takes the focus when it shows',
        {before: false, shown: true},
        async () => {
            outsideButton().focus();
            const before = document.activeElement === box('af-show');
            apply(s => { s.state.afShown = true; });
            const shown = await until(() => document.activeElement === box('af-show'), 1500);
            return {before, shown};
        });

    T('E9 value-max-length="0" is no limit, for the check, the count and the typing alike',
        {errors: [], count: '3', maxlength: null},
        async () => {
            type(box('zero-len'), 'abc');
            await sleep(20);
            return {errors: errors(form().zl), count: host('zero-len').querySelector('.aui-input__count').textContent.trim(),
                maxlength: box('zero-len').getAttribute('maxlength')};
        });

    T('E10 width from an expression follows it',
        {first: 220, then: 340},
        async () => {
            const width = () => Math.round(host('w-dyn').querySelector('.aui-input').getBoundingClientRect().width);
            const first = width();
            apply(s => { s.state.w = 340; });
            await sleep(20);
            return {first, then: width()};
        });

    T('E11 the box\'s accessible name and description: label-text without show-label, the field\'s aria-label / aria-labelledby / aria-describedby, the basic style\'s placeholder',
        {label: 'Account number', host: 'Order code', ref: {by: 'ext-name', resolved: true, help: true, hint: true}, basic: 'Search text'},
        async () => {
            const described = (box('name-ref').getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
            const hintId = host('name-ref').querySelector('.aui-field-message').id;
            return {label: box('name-label').getAttribute('aria-label'), host: box('name-host').getAttribute('aria-label'),
                ref: {by: box('name-ref').getAttribute('aria-labelledby'), resolved: described.every(id => !!document.getElementById(id)),
                    help: described.indexOf('ext-help') >= 0, hint: described.indexOf(hintId) >= 0},
                basic: box('name-basic').getAttribute('aria-label')};
        });

    T('E12 the password eye pressed from outside the field: the focus comes into the box, and leaving the field hides the password again',
        {afterEye: {focused: true, type: 'text'}, afterLeaving: {type: 'password', pressed: 'false'}},
        async () => {
            const eye = host('pw-eye').querySelector('.aui-input__eye');
            outsideButton().focus();
            eye.click();
            await sleep(30);
            const afterEye = {focused: document.activeElement === box('pw-eye'), type: box('pw-eye').type};
            outsideButton().focus();
            await sleep(30);
            return {afterEye, afterLeaving: {type: box('pw-eye').type, pressed: eye.getAttribute('aria-pressed')}};
        });

    T('E13 required with a pattern: a text the pattern refuses is no empty field (only the pattern error); an empty one is required',
        {refused: ['pattern'], empty: ['required']},
        async () => {
            type(box('req-pat'), 'abc');
            await sleep(30);
            const refused = errors(form().rp);
            type(box('req-pat'), '');
            await sleep(30);
            return {refused, empty: errors(form().rp)};
        });

    T('E14 aui-textarea auto-height: fitted again when its width changes (no clipped lines); turned off, its own height again',
        {wide: true, narrowGrew: true, notClipped: true, released: {height: '', overflow: ''}},
        async () => {
            const ta = box('ta-flex');
            const room = document.getElementById('ta-room');
            await frames(2);
            const h1 = ta.clientHeight;
            room.style.width = '215px';
            await frames(3);
            await sleep(30);
            const h2 = ta.clientHeight;
            const notClipped = ta.scrollHeight <= ta.clientHeight + 1;
            apply(s => { s.state.auto = false; });
            await sleep(30);
            const released = {height: ta.style.height, overflow: ta.style.overflowY};
            room.style.width = '540px';
            return {wide: h1 > 0, narrowGrew: h2 > h1, notClipped, released};
        });

    T('E15 aui-textarea with prefix and suffix texts (single-line fields only): its description names no missing element',
        {resolved: true, affixes: false, hint: true},
        async () => {
            const ids = (box('ta-affix').getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
            return {resolved: ids.every(id => !!document.getElementById(id)), affixes: ids.some(id => /^(prefix|suffix)-/.test(id)),
                hint: ids.length > 0};
        });

    T('E16 search with a pattern: Enter searches for the text typed, even one the pattern refuses',
        {searches: ['pat:BAD']},
        async () => {
            apply(s => { s.searches.length = 0; });
            type(box('s-pat'), 'BAD');
            enter(box('s-pat'));
            await sleep(20);
            return {searches: scope().searches.slice()};
        });

    T('E17 search: the text emptied by the browser (Escape in a search box, deleted) searches for \'\' at once',
        {typed: [], emptied: ['plain:']},
        async () => {
            apply(s => { s.searches.length = 0; });
            type(box('s-plain'), 'query');
            await sleep(20);
            const typed = scope().searches.slice();
            type(box('s-plain'), '');
            await sleep(20);
            return {typed, emptied: scope().searches.slice()};
        });

    T('E18 search-debounce: the search comes once typing pauses; a text from the page drops the one waiting',
        {paused: ['deb:abc'], replaced: []},
        async () => {
            apply(s => { s.searches.length = 0; });
            type(box('s-deb'), 'abc');
            await sleep(160);
            const paused = scope().searches.slice();
            apply(s => { s.searches.length = 0; });
            type(box('s-deb'), 'typed');
            apply(s => { s.m.sd = 'external'; });
            await sleep(160);
            return {paused, replaced: scope().searches.slice()};
        });

    T('E19 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-input: names, rule changes, leaving the field, search, sizes', tests, {delay: 0});
})();
