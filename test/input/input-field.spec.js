// aui-input suite (page: input-field.html, fixture: input-field.fixture.js): the page form sees the field's own ngModel
// (form.<name>, with the box's checks taken over), its options read as aui-select reads them, show-count, and the focus
// look that blends in.
(function () {
    const {sleep, type} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-input');
    const box = id => host(id).querySelector('input');
    const ngm = id => angular.element(host(id)).controller('ngModel');
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const form = () => scope().f;
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const leave = id => { box(id).dispatchEvent(new FocusEvent('blur')); scope().$apply(); };
    const errors = ctrl => Object.keys(ctrl.$error).sort();
    const count = id => host(id).querySelector('.aui-input__count');
    const shown = el => !!el && getComputedStyle(el).display !== 'none' && !el.classList.contains('aui-control-clear--hidden');

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('IF0 autofocus: the box has the focus once it is shown (the first check of the suite)',
        {focused: true}, async () => {
            await sleep(150);   // the focus is given just after the box is shown
            return {focused: document.activeElement === box('auto')};
        });

    T('IF1 form.<name> is the field\'s own ngModel; a field without a name adds nothing to the form',
        {title: true, code: true, boxKeys: 0}, async () => ({
            title: form().title === ngm('named'), code: form().code === ngm('pattern'),
            boxKeys: Object.keys(form()).filter(k => k.indexOf('aui-input__') === 0).length}));

    T('IF2 required: form.<name> has the required error, is touched once left, and the field turns red',
        {error: ['required'], touched: true, red: true, after: []}, async () => {
            const error = errors(form().title);
            leave('named');
            const touched = form().title.$touched;
            const red = !!host('named').querySelector('.aui-input__form-trigger--invalid');
            type(box('named'), 'Title');
            return {error, touched, red, after: errors(form().title)};
        });

    T('IF3 pattern: the box\'s check is the field\'s (form.<name>, form.$error, the red look); the model stays undefined; a valid text clears it',
        {error: ['pattern'], formPattern: 1, isField: true, model: 'undefined', red: true, after: [], afterModel: '12', revalidated: []},
        async () => {
            type(box('pattern'), 'ab');
            leave('pattern');
            const out = {error: errors(form().code), formPattern: (form().$error.pattern || []).length,
                isField: (form().$error.pattern || [])[0] === ngm('pattern'), model: String(scope().m.code),
                red: !!host('pattern').querySelector('.aui-input__form-trigger--invalid')};
            type(box('pattern'), '12');
            out.after = errors(form().code);
            out.afterModel = scope().m.code;
            apply(() => form().code.$validate());   // the host's own pattern validator, combined with the box's result
            out.revalidated = errors(form().code);
            return out;
        });

    T('IF4 an invalid text typed into a pristine field (its value stays undefined) makes the field and the form dirty',
        {before: true, model: 'undefined', fieldDirty: true, formDirty: true}, async () => {
            apply(() => { form().$setPristine(); });
            const before = form().digits.$pristine && form().$pristine;
            type(box('dirty'), 'x');
            return {before, model: String(scope().m.digits), fieldDirty: form().digits.$dirty, formDirty: form().$dirty};
        });

    T('IF5 value-max-length on a text: longer is the maxlength error of form.<name>; the count says 9/7 in red',
        {error: ['maxlength'], count: '9/7', over: true, after: [], afterCount: '3/7', afterOver: false}, async () => {
            type(box('len'), 'abcdefghi');
            const out = {error: errors(form().short), count: count('len').textContent, over: count('len').classList.contains('aui-input__count--over')};
            type(box('len'), 'abc');
            out.after = errors(form().short);
            out.afterCount = count('len').textContent;
            out.afterOver = count('len').classList.contains('aui-input__count--over');
            return out;
        });

    T('IF6 number with min/max: out of range is the max error of form.<name>; in range it is valid',
        {error: ['max'], after: [], model: 50}, async () => {
            type(box('range'), '500');
            const error = errors(form().qty);
            type(box('range'), '50');
            return {error, after: errors(form().qty), model: scope().m.qty};
        });

    T('IF7 form.$setPristine() / $setUntouched() reset the box as well (its ng-dirty / ng-touched classes go)',
        {dirtyBoxes: 0, touchedBoxes: 0, field: 'ng-pristine ng-untouched'}, async () => {
            leave('pattern');
            apply(() => { form().$setPristine(); form().$setUntouched(); });
            const boxes = Array.prototype.slice.call(document.querySelectorAll('aui-input input'));
            return {dirtyBoxes: boxes.filter(b => b.classList.contains('ng-dirty')).length,
                touchedBoxes: boxes.filter(b => b.classList.contains('ng-touched')).length,
                field: ['ng-pristine', 'ng-untouched'].filter(c => host('pattern').classList.contains(c)).join(' ')};
        });

    T('IF8 options as aui-select reads them: bare show-label / readonly / clearable / disabled are on; "false" is off',
        {bare: {label: true, readonly: true, clearShown: false, cls: true}, off: {label: false, readonly: false, disabled: false, clear: false},
            disabled: {disabled: true, cls: true}}, async () => ({
            bare: {label: !!host('flags').querySelector('.aui-control-label'), readonly: box('flags').readOnly,
                clearShown: shown(host('flags').querySelector('.aui-control-clear')),
                cls: !!host('flags').querySelector('.aui-input--readonly')},
            off: {label: !!host('flags-off').querySelector('.aui-control-label'), readonly: box('flags-off').readOnly,
                disabled: box('flags-off').disabled, clear: !!host('flags-off').querySelector('.aui-control-clear')},
            disabled: {disabled: box('dis').disabled, cls: !!host('dis').querySelector('.aui-input--disabled')}}));

    T('IF9 options from expressions follow their changes (show-label, readonly, show-count)',
        {before: {label: false, readonly: false, count: false}, after: {label: true, readonly: true, count: true}}, async () => {
            const read = () => ({label: !!host('dyn').querySelector('.aui-control-label'), readonly: box('dyn').readOnly, count: !!count('dyn')});
            const before = read();
            apply(s => { s.state.label = true; s.state.ro = true; s.state.count = true; });
            await sleep(30);
            return {before, after: read()};
        });

    T('IF10 show-count is off unless asked for',
        {count: false, describedBy: null}, async () => ({count: !!count('count-off'), describedBy: box('count-off').getAttribute('aria-describedby')}));

    T('IF11 show-count: the length (out of value-max-length when set) of the text in the box, the spaces around it too',
        {start: '0', typed: '5', limited: '3/5', spaces: '6/7', describedBy: true}, async () => {
            const start = count('count-free').textContent;
            type(box('count-free'), 'hello');
            const typed = count('count-free').textContent;
            const limited = count('count-basic').textContent;
            type(box('len'), '  ab  ');
            const spaces = count('len').textContent;
            return {start, typed, limited, spaces, describedBy: box('len').getAttribute('aria-describedby') === count('len').id && !!count('len').id};
        });

    T('IF12 show-count with the clear button, both styles: text | clear | count in one row, inside the field, none over another',
        {form: {clear: true, inRow: true}, basic: {clear: true, inRow: true}}, async () => {
            await sleep(50);
            const out = {};
            for (const [name, id, frame] of [['form', 'count-free', '.aui-input__form-trigger'], ['basic', 'count-basic', '.aui-input-container']]) {
                const t = box(id).getBoundingClientRect();
                const c = host(id).querySelector('.aui-control-clear');
                const r = c.getBoundingClientRect();
                const n = count(id).getBoundingClientRect();
                const f = host(id).querySelector(frame).getBoundingClientRect();
                out[name] = {clear: shown(c),
                    inRow: t.right <= r.left + 0.5 && r.right <= n.left + 0.5 && n.right <= f.right + 0.5 && t.width > 50 &&
                        Math.abs((r.top + r.bottom) / 2 - (n.top + n.bottom) / 2) < 3};
            }
            return out;
        });

    T('IF13 the focus look is a skin over the box that fades by its opacity only (not drawn while hidden); the box itself does not animate (no frame repaints the page); focused: the 2px ring; invalid: the red halo, focused the red ring',
        {boxFades: '0s', skin: 'opacity, visibility', hiddenSkin: 'hidden', focus: {ring: true, inner: true}, invalidRest: 0.12,
            invalidFocus: {ring: true, halo: 0.2, inner: true}}, async () => {
            const trigger = id => host(id).querySelector('.aui-input__form-trigger');
            const t = trigger('anon');
            const boxFades = getComputedStyle(t).transitionDuration;
            const skin = getComputedStyle(t, '::after').transitionProperty;
            const hiddenSkin = getComputedStyle(t, '::after').visibility;
            box('anon').focus();
            await sleep(320);
            const focused = AuiTest.fieldLook(t);
            box('anon').blur();
            type(box('named'), '');
            leave('named');
            await sleep(320);
            const invalidRest = AuiTest.fieldLook(trigger('named')).halo;
            box('named').focus();
            await sleep(320);
            const invalid = AuiTest.fieldLook(trigger('named'));
            box('named').blur();
            return {boxFades, skin, hiddenSkin, focus: {ring: focused.ring, inner: focused.shadow.indexOf('1px inset') !== -1}, invalidRest,
                invalidFocus: {ring: invalid.ring, halo: invalid.halo, inner: invalid.shadow.indexOf('rgb(220, 53, 69) 0px 0px 0px 1px inset') !== -1}};
        });

    const press = (input, init) => {
        const event = new KeyboardEvent('keydown', Object.assign({bubbles: true, cancelable: true}, init));
        input.dispatchEvent(event);
        return event.defaultPrevented;
    };
    const paste = (input, text) => {
        const data = new DataTransfer();
        data.setData('text', text);
        const event = new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true});
        input.dispatchEvent(event);
        return event.defaultPrevented;
    };

    T('IF14 an optional number field emptied, or cleared with x, is just empty: no error, no Angular error, the value undefined',
        {typed: 5, emptied: {error: [], model: 'undefined'}, cleared: {error: [], model: 'undefined', box: ''}, ngErrors: 0}, async () => {
            const before = window.__ngErrors.length;
            type(box('num'), '5');
            const typed = scope().m.amount;
            type(box('num'), '');
            const emptied = {error: errors(ngm('num')), model: String(scope().m.amount)};
            type(box('num'), '7');
            host('num').querySelector('.aui-control-clear').click();
            const cleared = {error: errors(ngm('num')), model: String(scope().m.amount), box: box('num').value};
            return {typed, emptied, cleared, ngErrors: window.__ngErrors.length - before};
        });

    T('IF15 a number field shows a numeric text from the page as its number; another text shows as nothing; the model is left as it is',
        {numeric: '12', model: '12', other: '', otherModel: 'abc', ngErrors: 0}, async () => {
            const before = window.__ngErrors.length;
            const numeric = box('ntext').value;
            const model = scope().m.ntext;
            apply(s => { s.m.ntext = 'abc'; });
            return {numeric, model, other: box('ntext').value, otherModel: scope().m.ntext, ngErrors: window.__ngErrors.length - before};
        });

    T('IF16 the clear button shows for an invalid text too (its value is undefined) and clears it',
        {shown: true, box: '', error: [], model: ''}, async () => {
            type(box('pattern'), 'abc');
            await sleep(20);
            const clear = host('pattern').querySelector('.aui-control-clear');
            const out = {shown: shown(clear)};
            clear.click();
            return Object.assign(out, {box: box('pattern').value, error: errors(form().code), model: scope().m.code});
        });

    T('IF17 the length limit of a number box: keys that type nothing pass, the characters of a number pass (digits, minus, point), other characters and ArrowUp stay blocked; the length is held after each edit (a key, a paste, any text put in), the box text counts (above max too), a selection typed over is replaced, and a longer page value can be shortened',
        {passes: {F5: false, Home: false, End: false, Escape: false, Tab: false, Backspace: false, 'ctrl+a': false},
            blocked: {a: true, '.': false, ArrowUp: true},
            aboveMax: '500', full: '123', replaced: '4', pasteNoNumber: true, pasteNumber: false,
            fromPage: {shown: '12345', shortened: '1234', longerAgain: '1234'}},
        async () => {
            const input = box('digits3');
            const passes = {};
            ['F5', 'Home', 'End', 'Escape', 'Tab', 'Backspace'].forEach(k => { passes[k] = press(input, {key: k}); });
            passes['ctrl+a'] = press(input, {key: 'a', ctrlKey: true});
            const blocked = {};
            ['a', '.', 'ArrowUp'].forEach(k => { blocked[k] = press(input, {key: k}); });
            type(input, '500');                       // above max: the value is undefined, the text has 3 digits
            edit(input, '5001');
            const aboveMax = input.value;
            type(input, '123');
            edit(input, '1234');
            const full = input.value;
            edit(input, '4');                         // all of it selected and typed over
            const replaced = input.value;
            const pasteNoNumber = paste(input, 'ab');
            const pasteNumber = paste(input, '45');   // taken; its length is held after the edit, as a key's
            apply(s => { s.m.d3 = 12345; });
            const shown = input.value;
            edit(input, '1234');                      // Backspace: closer to the limit, kept
            const shortened = input.value;
            edit(input, '12345');
            const longerAgain = input.value;
            input.blur();
            return {passes, blocked, aboveMax, full, replaced, pasteNoNumber, pasteNumber, fromPage: {shown, shortened, longerAgain}};
        });

    T('IF18 Enter that confirms an input method word does not finish the field; a plain Enter does',
        {composing: [], plain: ['enter']}, async () => {
            apply(s => { s.finishes.length = 0; });
            press(box('finish'), {key: 'Enter', keyCode: 13, which: 13, isComposing: true});
            press(box('finish'), {key: 'Process', keyCode: 229, which: 229});
            const composing = scope().finishes.slice();
            press(box('finish'), {key: 'Enter', keyCode: 13, which: 13});
            return {composing, plain: scope().finishes.slice()};
        });

    T('IF19 required is announced (aria-required), and the basic style shows invalid as a red underline once left',
        {required: 'true', optional: 'false', before: false, after: true, aria: 'true', red: true}, async () => {
            const container = host('basic-req').querySelector('.aui-input-container');
            const before = container.classList.contains('aui-input-container--invalid');
            leave('basic-req');
            await sleep(400);
            const line = getComputedStyle(container.querySelector('.aui-input-highlight'));
            return {required: box('basic-req').getAttribute('aria-required'), optional: box('anon').getAttribute('aria-required'), before,
                after: container.classList.contains('aui-input-container--invalid'), aria: box('basic-req').getAttribute('aria-invalid'),
                red: line.backgroundColor === 'rgb(220, 53, 69)' && parseFloat(line.width) > 100};
        });

    T('IF20 a number box: no spin buttons; the wheel over it while focused leaves it (not with Ctrl, not a text box)',
        {spin: 'none', left: true, touched: true, ctrlStays: true, textStays: true}, async () => {
            const wheel = (input, init) => input.dispatchEvent(new WheelEvent('wheel', Object.assign({deltaY: 100, bubbles: true, cancelable: true}, init)));
            // a pseudo-element's style cannot be read from the page: the rule of the loaded stylesheet that hides it
            let spin = 'missing';
            Array.prototype.forEach.call(document.styleSheets, sheet => {
                let rules = [];
                try { rules = sheet.cssRules || []; } catch (e) { /* another origin */ }
                Array.prototype.forEach.call(rules, rule => {
                    if (rule.selectorText && rule.selectorText.indexOf('.aui-input input[type="number"]::-webkit-inner-spin-button') >= 0) {
                        spin = rule.style.getPropertyValue('-webkit-appearance') || rule.style.getPropertyValue('appearance') || 'set';
                    }
                });
            });
            apply(() => { ngm('num').$setUntouched(); });
            box('num').focus();
            wheel(box('num'), {ctrlKey: true});
            const ctrlStays = document.activeElement === box('num');
            wheel(box('num'));
            await sleep(20);
            const left = document.activeElement !== box('num');
            box('anon').focus();
            wheel(box('anon'));
            const textStays = document.activeElement === box('anon');
            box('anon').blur();
            return {spin, left, touched: ngm('num').$touched, ctrlStays, textStays};
        });

    // an edit as the browser sends it: beforeinput (the text before), the new text, then input
    const edit = (input, next) => {
        input.dispatchEvent(new InputEvent('beforeinput', {inputType: 'insertText', data: next.slice(-1), bubbles: true, cancelable: true}));
        input.value = next;
        input.dispatchEvent(new Event('input', {bubbles: true}));
    };
    const red = id => !!host(id).querySelector('.aui-input__form-trigger--invalid');

    T('IF21 a text longer than value-max-length is red at once (field and count), before the field was ever left; other checks wait until it is left',
        {over: {red: true, count: true, touched: false}, back: {red: false, count: false}, required: {error: ['required'], red: false}}, async () => {
            type(box('over-fresh'), 'abcdefg');
            const over = {red: red('over-fresh'), count: count('over-fresh').classList.contains('aui-input__count--over'), touched: ngm('over-fresh').$touched};
            type(box('over-fresh'), 'abc');
            const back = {red: red('over-fresh'), count: count('over-fresh').classList.contains('aui-input__count--over')};
            apply(() => { form().$setUntouched(); });
            type(box('named'), '');
            return {over, back, required: {error: errors(form().title), red: red('named')}};
        });

    T('IF22 enforce-limits on a text: the box\'s own maxlength is value-max-length (the browser types no further); without the flag there is none; it follows an expression',
        {strict: '7', loose: null, dynOff: null, dynOn: '4', check: ['maxlength']}, async () => {
            const out = {strict: box('strict-text').getAttribute('maxlength'), loose: box('len').getAttribute('maxlength'),
                dynOff: box('strict-dyn').getAttribute('maxlength')};
            apply(s => { s.state.enforce = true; });
            await sleep(20);
            out.dynOn = box('strict-dyn').getAttribute('maxlength');
            type(box('strict-text'), 'abcdefghi');   // a value set past the browser's limit (as a page can): still the check's error
            out.check = errors(form().st);
            type(box('strict-text'), 'abc');
            return out;
        });

    T('IF23 enforce-limits on a number: an edit above max (or below a min under zero) is undone; in range, and 0..min, stay; without the flag it is the max error',
        {above: {box: '10', model: 10}, below: {box: '-5', model: -5}, inRange: {box: '100', model: 100}, loose: {box: '101', error: ['max']}},
        async () => {
            const input = box('strict-num');
            type(input, '10');
            edit(input, '101');
            const above = {box: input.value, model: scope().m.sn};
            type(input, '-5');
            edit(input, '-55');
            const below = {box: input.value, model: scope().m.sn};
            type(input, '10');
            edit(input, '100');
            const inRange = {box: input.value, model: scope().m.sn};
            type(box('loose-num'), '10');
            edit(box('loose-num'), '101');
            return {above, below, inRange, loose: {box: box('loose-num').value, error: errors(form().ln)}};
        });

    const rect = el => el.getBoundingClientRect();

    T('IF24 prefix and suffix: icon and text before the text, the suffix after the clear button, in one row, read with the box; a press on them puts the caret in the box; none: nothing changes',
        {form: {icon: true, prefix: '$', suffix: 'kg', inRow: true, row: true, describedBy: true, focus: true},
            basic: {suffix: '%', inRow: true, row: true}, none: {row: false, affix: 0}}, async () => {
            await sleep(30);
            const h = host('affix');
            const pre = h.querySelector('.aui-input__affix--prefix'), suf = h.querySelector('.aui-input__affix--suffix');
            const clear = h.querySelector('.aui-control-clear'), b = box('affix');
            box('anon').focus();
            suf.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
            const form = {icon: !!pre.querySelector('i.aui-input__affix-icon.t-icon'), prefix: pre.textContent.trim(), suffix: suf.textContent.trim(),
                inRow: rect(pre).right <= rect(b).left + 0.5 && rect(b).right <= rect(clear).left + 0.5 && rect(clear).right <= rect(suf).left + 0.5,
                row: !!h.querySelector('.aui-input--row'),
                describedBy: (b.getAttribute('aria-describedby') || '').split(' ').sort().join(' ') === [pre.querySelector('.aui-input__affix-text').id, suf.querySelector('.aui-input__affix-text').id].sort().join(' '),
                focus: document.activeElement === b};
            b.blur();
            const hb = host('affix-basic'), sb = hb.querySelector('.aui-input__affix--suffix'), cb = hb.querySelector('.aui-control-clear');
            const basic = {suffix: sb.textContent.trim(), inRow: rect(box('affix-basic')).right <= rect(cb).left + 0.5 && rect(cb).right <= rect(sb).left + 0.5,
                row: !!hb.querySelector('.aui-input--row')};
            return {form, basic, none: {row: !!host('anon').querySelector('.aui-input--row'), affix: host('anon').querySelectorAll('.aui-input__affix').length}};
        });

    T('IF25 password: a password box (current-password, no spell check, no count); the eye shows it while the user is in the field, hidden again on leaving and before Enter; never trimmed',
        {start: {type: 'password', autocomplete: 'current-password', spellcheck: 'false', autocapitalize: 'off', count: false, pressed: 'false'},
            shown: {type: 'text', pressed: 'true'}, leftField: 'password', enter: 'password', model: '  pw  ', plainEye: false}, async () => {
            const b = box('pw'), eye = () => host('pw').querySelector('.aui-input__eye');
            const start = {type: b.type, autocomplete: b.getAttribute('autocomplete'), spellcheck: b.getAttribute('spellcheck'),
                autocapitalize: b.getAttribute('autocapitalize'), count: !!count('pw'), pressed: eye().getAttribute('aria-pressed')};
            type(b, '  pw  ');
            b.focus();
            eye().click();
            await sleep(20);
            const shown = {type: b.type, pressed: eye().getAttribute('aria-pressed')};
            box('anon').focus();
            await sleep(30);
            const leftField = b.type;
            b.focus();
            eye().click();
            await sleep(20);
            press(b, {key: 'Enter', keyCode: 13, which: 13});
            const enter = b.type;   // at once, before the browser acts on Enter
            b.blur();
            return {start, shown, leftField, enter, model: scope().m.pw, plainEye: !!host('pw-plain').querySelector('.aui-input__eye')};
        });

    T('IF29 show-password: the browser\'s own reveal button (Microsoft Edge) is hidden where the field has its eye, kept where it has none',
        {rule: 'as the browser', withEye: true, withoutEye: false}, async () => {
            // the rule is in the page's style sheet only when the browser understood it: Microsoft Edge knows
            // ::-ms-reveal, other browsers drop the rule (and have no such button)
            let rule = false;
            Array.prototype.forEach.call(document.styleSheets, sheet => {
                let rules = [];
                try { rules = sheet.cssRules || []; } catch (e) { /* another origin */ }
                Array.prototype.forEach.call(rules, r => {
                    if (r.selectorText && r.selectorText.indexOf('.aui-input--with-eye input::-ms-reveal') >= 0 && r.style.display === 'none') rule = true;
                });
            });
            const edge = navigator.userAgent.indexOf(' Edg/') !== -1;
            return {rule: rule === edge ? 'as the browser' : 'rule ' + rule + ' in ' + (edge ? 'Edge' : 'another browser'),
                withEye: !!host('pw').querySelector('.aui-input--with-eye'), withoutEye: !!host('pw-plain').querySelector('.aui-input--with-eye')};
        });

    T('IF26 passed-through attributes on the box (autocomplete, inputmode, spellcheck); a field without them: autocomplete "off" (no browser list of earlier entries), none of the others',
        {given: {autocomplete: 'email', inputmode: 'numeric', spellcheck: 'false'}, none: ['off', null, null, null, null, null, null]}, async () => {
            const g = box('pass'), n = box('anon');
            return {given: {autocomplete: g.getAttribute('autocomplete'), inputmode: g.getAttribute('inputmode'), spellcheck: g.getAttribute('spellcheck')},
                none: ['autocomplete', 'inputmode', 'spellcheck', 'autocapitalize', 'step', 'aria-describedby', 'ng-trim'].map(a => n.getAttribute(a))};
        });

    T('IF27 api (focus, blur, clear, select) and on-focus / on-blur / on-clear',
        {methods: 'blur clear focus select', focused: true, selected: 5, events: ['focus', 'blur:Hello', 'clear:api', 'clear:click'], model: '', stayedOut: true},
        async () => {
            const api = scope().apiObj, b = box('api');
            apply(s => { s.events.length = 0; });
            const methods = Object.keys(api).filter(k => typeof api[k] === 'function').sort().join(' ');
            api.focus();
            await sleep(20);
            const focused = document.activeElement === b;
            api.select();
            const selected = b.selectionEnd - b.selectionStart;
            api.blur();
            await sleep(20);
            api.clear();
            await sleep(30);
            const stayedOut = document.activeElement !== b;
            type(b, 'x');
            host('api').querySelector('.aui-control-clear').click();
            b.blur();
            await sleep(20);
            const events = scope().events.filter(e => e !== 'focus' || true).slice(0, 4);
            return {methods, focused, selected, events, model: scope().m.apiv, stayedOut};
        });

    T('IF28 precision: the decimal point passes the digit filter; more decimals than allowed are undone; with "0" (whole numbers) a decimal stays and the field is red (undone, the box lost its point and the digits joined the whole number); the box step matches; a page value with more decimals is invalid',
        {point: false, undone: {box: '12.34', model: 12.34}, step: '0.01', whole: {box: '12.5', model: 'undefined', errors: ['precision'], step: '1'}, page: ['precision']}, async () => {
            const b = box('prec');
            type(b, '12');
            const point = press(b, {key: '.'});
            type(b, '12.34');
            edit(b, '12.345');
            const undone = {box: b.value, model: scope().m.amt};
            type(box('prec0'), '12');
            edit(box('prec0'), '12.5');
            return {point, undone, step: b.getAttribute('step'),
                whole: {box: box('prec0').value, model: scope().m.whole === undefined ? 'undefined' : scope().m.whole, errors: errors(form().whole),
                    step: box('prec0').getAttribute('step')}, page: errors(form().amtp)};
        });

    T('IF29 show-count with enforce-limits: spaces typed after the text count at once (Angular passes no change for them), the count reaches the limit where the box takes no more; the value is the text without them, valid',
        {typed: '5/7', spaced: '7/7', model: 'Apple', valid: true, maxlength: 7, fromPage: '0/7'}, async () => {
            const el = box('strict-text');
            type(el, 'Apple');
            const typed = count('strict-text').textContent;
            type(el, 'Apple  ');
            const spaced = count('strict-text').textContent;
            const out = {typed, spaced, model: scope().m.st, valid: !form().st.$error.maxlength, maxlength: el.maxLength};
            apply(s => { s.m.st = ''; });
            out.fromPage = count('strict-text').textContent;
            return out;
        });

    T('E1 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    T('IF31 a number box with value-max-length and a maxlength on the element too (some server-side templates write both): the AngularJS length check of the element measures the number as its text: a number within the limit is valid and kept, typed or set by the page; a longer one stays invalid',
        {typed: {model: 222, errors: [], red: false}, loaded: {model: 123, errors: []}, over: {errors: ['maxlength']}},
        async () => {
            const b = box('nml');
            b.focus();
            type(b, '222');
            await sleep(30);
            leave('nml');
            await sleep(30);
            const red = host('nml').querySelector('.aui-input__form-trigger').classList.contains('aui-input__form-trigger--invalid');
            const typed = {model: scope().m.nml, errors: errors(form().nml), red};
            apply(s => { s.m.nml = 123; });
            await sleep(30);
            const loaded = {model: scope().m.nml, errors: errors(form().nml)};
            apply(s => { s.m.nml = 1234567; });
            await sleep(30);
            return {typed, loaded, over: {errors: errors(form().nml)}};
        });

    T('IF32 a number box with value-max-length: a minus and a decimal point pass its key filter (dropped, -99.99 became 9999 unseen), other characters (e, +, letters) type nothing, and the limit counts the whole text, the minus included',
        {minus: false, point: false, e: true, plus: true, letter: true, atLimit: '-1234', belowLimit: '-1234'},
        async () => {
            const b = box('nml');
            apply(s => { s.m.nml = undefined; });
            b.value = '';
            const minus = press(b, {key: '-'});
            const point = press(b, {key: '.'});
            const e = press(b, {key: 'e'});
            const plus = press(b, {key: '+'});
            const letter = press(b, {key: 'a'});
            type(b, '-1234');
            edit(b, '-12345');
            const atLimit = b.value;
            type(b, '-123');
            edit(b, '-1234');
            const belowLimit = b.value;
            type(b, '');
            return {minus, point, e, plus, letter, atLimit, belowLimit};
        });

    T('IF33 a press inside the frame but outside the box (its padding) puts the caret in the box; the clear button keeps its own press; a disabled field is left to the browser, as a native one (no focus taken; its caret is hidden by its CSS)',
        {padding: {focused: true, prevented: true}, clear: {focused: false}, disabled: {focused: false, prevented: false}},
        async () => {
            const pressOn = el => {
                const ev = new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0});
                el.dispatchEvent(ev);
                return ev.defaultPrevented;
            };
            const frame = id => host(id).querySelector('.aui-input__form-trigger');
            box('anon').blur();
            const prevented = pressOn(frame('anon'));
            const padding = {focused: document.activeElement === box('anon'), prevented};
            box('anon').blur();
            pressOn(host('pattern').querySelector('.aui-control-clear'));
            const clear = {focused: document.activeElement === box('pattern')};
            const offPrevented = pressOn(frame('dis'));
            const disabled = {focused: document.activeElement === box('dis'), prevented: offPrevented};
            return {padding, clear, disabled};
        });

    AuiTest.run('aui-input: the page form, options, show-count', tests, {delay: 0});
})();
