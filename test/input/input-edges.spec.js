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

    T('E20 in a disabled fieldset: no clear button and no eye; api.clear clears nothing; the password is never shown',
        {clearShown: false, eyeShown: false, value: 'Locked', revealed: false},
        async () => {
            const shown = el => !!el && getComputedStyle(el).display !== 'none';
            const eye = host('fs-pw').querySelector('.aui-input__eye');
            const out = {clearShown: shown(host('fs-clear').querySelector('.aui-control-clear')), eyeShown: shown(eye)};
            scope().fsApi.clear();
            eye.click();
            await sleep(30);
            return Object.assign(out, {value: scope().m.fsText, revealed: box('fs-pw').type === 'text'});
        });

    T('E21 a form the browser checks sees the field\'s rules: required (empty), precision (a min off its grid)',
        {required: {required: true, missing: true}, decimals: {refused: true, message: 'Whole numbers only'}, whole: true},
        async () => {
            const r = box('nv-req');
            const p = box('nv-prec');
            type(p, '1.25');
            await sleep(30);
            const decimals = {refused: !p.checkValidity(), message: p.validationMessage};
            type(p, '2');
            await sleep(30);
            return {required: {required: r.required, missing: r.validity.valueMissing}, decimals, whole: p.checkValidity()};
        });

    T('E22 the field box takes the theme\'s background colour (a dark theme: never white on white)',
        {background: 'rgb(25, 35, 47)', value: 'rgb(255, 255, 255)'},
        async () => ({background: getComputedStyle(host('theme-dark').querySelector('.aui-input__form-trigger')).backgroundColor,
            value: getComputedStyle(box('theme-dark')).color}));

    T('E23 updateOn blur: typing leaves the field and the form pristine until it commits; a rollback leaves them pristine',
        {typed: {model: 'old', pristine: true, formPristine: true}, rolledBack: {model: 'old', box: 'old', pristine: true, formPristine: true}},
        async () => {
            const look = () => ({model: scope().m.rb, pristine: form().rb.$pristine, formPristine: form().$pristine});
            apply(s => { s.f.$setPristine(); });
            type(box('rollback'), 'draft');
            await sleep(30);
            const typed = look();
            apply(s => { s.f.$rollbackViewValue(); });
            await sleep(30);
            const after = look();
            return {typed, rolledBack: {model: after.model, box: box('rollback').value, pristine: after.pristine, formPristine: after.formPristine}};
        });

    T('E24 ng-trim="false" on the field: the model keeps the spaces around the text',
        {model: '  ab  '},
        async () => {
            type(box('keep-spaces'), '  ab  ');
            await sleep(20);
            return {model: scope().m.ks};
        });

    T('E25 on-focus comes first, with the value at the focus: api.focus() then api.blur() at once, and a focus then typing at once',
        {blurred: ['focus:Start', 'blur', 'finish'], typed: 'focus:Start'},
        async () => {
            apply(s => { s.calls.length = 0; });
            scope().foApi.focus();
            scope().foApi.blur();
            await sleep(30);
            const blurred = scope().calls.slice();
            apply(s => { s.calls.length = 0; });
            scope().foApi.focus();
            type(box('focus-order'), 'Edited');
            await sleep(30);
            box('focus-order').blur();
            return {blurred, typed: scope().calls[0]};
        });

    T('E26 api.clear() on an empty field: on-clear, but no on-change (nothing changed)',
        {calls: ['clear']},
        async () => {
            apply(s => { s.calls.length = 0; });
            scope().ceApi.clear();
            await sleep(30);
            return {calls: scope().calls.slice()};
        });

    T('E27 input-style-type from an expression, set empty: the default basic style, never a field without its box',
        {empty: {boxes: 1, basic: true}, cell: {boxes: 1, cell: true}},
        async () => {
            const look = name => ({boxes: host('style-dyn').querySelectorAll('input').length,
                [name]: !!host('style-dyn').querySelector('.aui-input--' + name)});
            apply(s => { s.state.style = ''; });
            await sleep(30);
            const empty = look('basic');
            apply(s => { s.state.style = 'cell'; });
            await sleep(30);
            return {empty, cell: look('cell')};
        });

    T('E28 the basic style: a resting line under the text; its clear button a 24px target (10px beside its centre hits it)',
        {line: {width: '1px', color: 'rgb(133, 144, 160)'}, besideHits: true},
        async () => {
            const line = getComputedStyle(host('basic-clear').querySelector('.aui-input-container'), '::before');
            const clear = host('basic-clear').querySelector('.aui-control-clear');
            clear.scrollIntoView({block: 'center'});
            await frames(1);
            const r = clear.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2 - 10, r.top + r.height / 2);
            return {line: {width: line.borderTopWidth, color: line.borderTopColor}, besideHits: !!hit && clear.contains(hit)};
        });

    T('E29 a top label cut by its room shows its whole text as a tooltip',
        {title: 'A label much longer than the room the field has for it'},
        async () => {
            const label = host('top-tip').querySelector('.aui-field-label');
            label.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            return {title: label.getAttribute('title')};
        });

    T('E30 the theme\'s height and radius reach the fields (aui-input and aui-select)',
        {input: {height: 30, radius: '9px'}, select: {height: 30, radius: '9px'}},
        async () => {
            const look = el => ({height: Math.round(el.getBoundingClientRect().height), radius: getComputedStyle(el).borderTopLeftRadius});
            return {input: look(host('theme-size').querySelector('.aui-input__form-trigger')),
                select: look(document.querySelector('#theme-size .aui-select__trigger'))};
        });

    T('E31 a narrow field with many parts: the count stays in the frame, the text keeps room, the suffix gives way',
        {countInside: true, textRoom: true, suffixCut: true},
        async () => {
            const frame = host('narrow').querySelector('.aui-input__form-trigger').getBoundingClientRect();
            const countBox = host('narrow').querySelector('.aui-input__count').getBoundingClientRect();
            const suffix = host('narrow').querySelector('.aui-input__affix--suffix .aui-input__affix-text');
            return {countInside: countBox.right <= frame.right + 0.5, textRoom: box('narrow').getBoundingClientRect().width >= 20,
                suffixCut: suffix.scrollWidth > suffix.clientWidth};
        });

    T('E32 the basic style: a unit and a sign at an ordinary width are shown whole (the text takes the room left, the row does not run over); in a narrow field the suffix gives way and the text keeps its room',
        {prefixWhole: true, suffixWhole: true, rowFits: true, narrowSuffixCut: true, narrowTextRoom: true},
        async () => {
            const whole = el => el.scrollWidth <= el.clientWidth;
            const affix = (id, side) => host(id).querySelector('.aui-input__affix--' + side + ' .aui-input__affix-text');
            const row = host('basic-affix').querySelector('.aui-input-container');
            return {prefixWhole: whole(affix('basic-affix', 'prefix')), suffixWhole: whole(affix('basic-affix', 'suffix')),
                rowFits: row.scrollWidth <= row.clientWidth,
                narrowSuffixCut: !whole(affix('basic-narrow', 'suffix')), narrowTextRoom: box('basic-narrow').getBoundingClientRect().width >= 20};
        });

    T('E33 a table cell (input-style-type="cell") hovers to a soft grey border (#b8c1cf), not the fields\' darker hover border',
        {rest: 'rgba(0, 0, 0, 0)', hover: 'rgb(184, 193, 207)'},
        async () => {
            const trigger = host('name-host').querySelector('.aui-input__form-trigger');
            let declared = null;
            for (const sheet of document.styleSheets) {
                let rules;
                try { rules = sheet.cssRules; } catch (e) { continue; }
                for (const r of rules) {
                    if (r.selectorText && r.selectorText.indexOf('.aui-input--cell') >= 0 && r.selectorText.indexOf(':hover') >= 0 && r.selectorText.indexOf(':has(') < 0 &&
                        r.style.getPropertyValue('border-color')) declared = r.style.getPropertyValue('border-color');
                }
            }
            // the declared value resolved where the cell's box is, as the browser would draw it
            const probe = document.createElement('span');
            probe.style.color = declared;
            trigger.appendChild(probe);
            const hover = getComputedStyle(probe).color;
            probe.remove();
            return {rest: getComputedStyle(trigger).borderTopColor, hover};
        });


    T('E34 updateOn blur: a rule that changes while a typed text waits does not commit it: the model, pristine state and rollback keep the value from before',
        {model: 'AA', pristine: true, formUnchanged: true, afterRollback: 'AA', box: 'AA'},
        async () => {
            const input = box('draft-limit');
            const formBefore = form().$pristine;
            input.focus();
            edit(input, 'ABC');
            await sleep(20);
            apply(s => { s.state.dlLimit = 2; });
            apply(s => { s.state.dlLimit = 8; });
            const model = scope().m.dl, pristine = form().draftLimit.$pristine, formUnchanged = form().$pristine === formBefore;
            apply(() => { form().$rollbackViewValue(); });
            await sleep(20);
            const afterRollback = scope().m.dl, shown = input.value;
            input.blur();
            return {model, pristine, formUnchanged, afterRollback, box: shown};
        });

    T('E35 updateOn blur: a typed invalid text changes the field\'s validity only when it commits (then its own error alone)',
        {before: [], model: 'GOOD', after: ['pattern']},
        async () => {
            const input = box('draft-pattern');
            input.focus();
            edit(input, 'bad');
            await sleep(30);
            const before = errors(form().draftPattern), model = scope().m.dp;
            input.blur();
            await sleep(30);
            return {before, model, after: errors(form().draftPattern)};
        });

    T('E36 inside a disabled <fieldset>: the field looks disabled (its surface, its border, no focus skin), invalid or not',
        {background: 'rgb(248, 250, 252)', border: 'rgb(219, 227, 236)', skin: 'none'},
        async () => {
            const input = box('fs-look');
            input.focus();
            input.blur();
            apply(s => { s.state.fsLook = true; });
            await sleep(30);
            const trigger = host('fs-look').querySelector('.aui-input__form-trigger');
            const r = {background: getComputedStyle(trigger).backgroundColor, border: getComputedStyle(trigger).borderTopColor,
                skin: getComputedStyle(trigger, '::after').display};
            apply(s => { s.state.fsLook = false; });
            return r;
        });

    T('E37 a search still waiting when a <fieldset> around the field is disabled does not run',
        {searches: []},
        async () => {
            scope().searches.length = 0;
            const input = box('fs-search');
            input.focus();
            edit(input, 'pending');
            apply(s => { s.state.fsSearch = true; });
            await sleep(240);
            const searches = scope().searches.filter(x => x.indexOf('fsq:') === 0);
            apply(s => { s.state.fsSearch = false; });
            return {searches};
        });

    T('E38 the basic style shows label-text (with show-label) as the caption in its line; with no placeholder, at rest too',
        {caption: 'Part number', rest: {visibility: 'visible', opacity: '1'}, placeholderField: 'hidden'},
        async () => {
            const label = host('basic-label').querySelector('.aui-input-label');
            const style = getComputedStyle(label);
            // a field with a placeholder: the placeholder names it at rest, the caption comes with the focus
            const other = getComputedStyle(host('basic-clear').querySelector('.aui-input-label')).visibility;
            return {caption: label.textContent.trim(), rest: {visibility: style.visibility, opacity: style.opacity}, placeholderField: other};
        });

    T('E39 an auto-height textarea fits its text again when its size changes (the text grows with it)',
        {fits: true},
        async () => {
            const area = document.querySelector('#ta-size textarea');
            await sleep(50);
            apply(s => { s.state.tsz = 'large'; });
            await AuiTest.until(() => area.scrollHeight <= area.clientHeight + 1, 1000);
            return {fits: area.scrollHeight <= area.clientHeight + 1};
        });

    T('E40 a field narrower than all its parts keeps its count inside its frame (never drawn into the next field)',
        {inside: true},
        async () => {
            const frame = host('narrow-count').querySelector('.aui-input__form-trigger').getBoundingClientRect();
            const count = host('narrow-count').querySelector('.aui-input__count').getBoundingClientRect();
            // cut to nothing, it draws nothing (its empty margin may stay past the edge)
            return {inside: count.width < 0.5 || count.right <= frame.right + 0.5};
        });

    T('E41 a number with value-max-length="0" (no limit) keeps its arrow keys',
        {prevented: false},
        async () => {
            const event = new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true});
            box('num-zero').dispatchEvent(event);
            return {prevented: event.defaultPrevented};
        });

    T('E42 autofocus: a field hidden by visibility (its size kept) takes the focus when it shows',
        {focused: true},
        async () => {
            outsideButton().focus();
            await sleep(50);
            apply(() => { document.getElementById('af-vis').style.visibility = 'visible'; });
            await AuiTest.until(() => document.activeElement === box('af-vis'), 1000);
            return {focused: document.activeElement === box('af-vis')};
        });

    T('E43 the form\'s native reset: the field keeps showing its model (box, count and clear button agree with it)',
        {box: 'kept', model: 'kept', count: '4/20'},
        async () => {
            document.getElementById('reset-form').reset();
            await sleep(50);
            return {box: box('reset-field').value, model: scope().m.rs, count: host('reset-field').querySelector('.aui-input__count').textContent.trim()};
        });

    T('E44 a field without a name adds nothing to the form\'s data (a named one does)',
        {names: ['rs']},
        async () => ({names: Array.from(new FormData(document.getElementById('reset-form')).keys())}));

    T('E45 ng-attr-aria-describedby that starts out unset: once set, on the box',
        {described: true},
        async () => {
            apply(s => { s.state.lateDesc = 'desc-late'; });
            await sleep(20);
            return {described: (box('late-desc').getAttribute('aria-describedby') || '').indexOf('desc-late') >= 0};
        });

    T('E46 a 95px field with many parts: its clear button stays inside the frame; a click 8px outside the field clears nothing',
        {inside: true, outsideHit: false, model: 123.45},
        async () => {
            const frame = host('narrow-95').querySelector('.aui-input__form-trigger').getBoundingClientRect();
            const clear = host('narrow-95').querySelector('.aui-control-clear');
            const r = clear.getBoundingClientRect();
            const y = r.top + r.height / 2;
            const hit = document.elementFromPoint(frame.right + 8, y);
            const outsideHit = !!(hit && clear.contains(hit));
            if (hit) hit.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, clientX: frame.right + 8, clientY: y}));
            await sleep(20);
            return {inside: r.right <= frame.right + 0.5, outsideHit, model: scope().m.n95};
        });

    T('E48 a 55px basic field with many parts: its clear button takes no click outside the field (1-12px past it); a click 8px past it clears nothing',
        {outsideHit: false, model: 123.45},
        async () => {
            const field = host('basic-55');
            // the field as drawn (its .aui-input, 55px wide): the custom element itself can be wider than it
            const outer = (field.querySelector('.aui-input') || field).getBoundingClientRect();
            const clear = field.querySelector('.aui-control-clear');
            const r = clear.getBoundingClientRect();
            const y = r.top + r.height / 2;
            const hits = [];
            for (let dx = 1; dx <= 12; dx += 1) {
                const hit = document.elementFromPoint(outer.right + dx, y);
                if (hit && clear.contains(hit)) hits.push(dx);
            }
            const hit = document.elementFromPoint(outer.right + 8, y);
            if (hit) hit.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, clientX: outer.right + 8, clientY: y}));
            await sleep(20);
            return {outsideHit: hits.length > 0, model: scope().m.b55};
        });

    T('E49 api.blur() with the focus on the field\'s own clear button: the focus leaves the field',
        {onClear: true, after: false},
        async () => {
            apply(s => { s.m.ce = 'Some text'; });
            await sleep(20);
            const clear = host('clear-empty').querySelector('.aui-control-clear');
            clear.focus();
            const onClear = document.activeElement === clear;
            scope().ceApi.blur();
            await sleep(20);
            return {onClear, after: host('clear-empty').contains(document.activeElement)};
        });

    T('E47 an auto-height textarea fits its text again when the theme\'s font scale changes',
        {fits: true, height: 'grew'},
        async () => {
            const area = document.querySelector('#ta-font textarea');
            await sleep(50);
            const before = area.clientHeight;
            document.documentElement.style.setProperty('--aui-font-scale', '1.25');
            try {
                await AuiTest.until(() => area.scrollHeight <= area.clientHeight + 1 && area.clientHeight > before, 1000);
                return {fits: area.scrollHeight <= area.clientHeight + 1, height: area.clientHeight > before ? 'grew' : 'same'};
            } finally {
                document.documentElement.style.removeProperty('--aui-font-scale');
            }
        });

    T('E19 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-input: names, rule changes, leaving the field, search, sizes', tests, {delay: 0});
})();
