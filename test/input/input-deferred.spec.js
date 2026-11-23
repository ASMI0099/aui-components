// aui-input deferred-commit suite (page: input-deferred.html, fixture: input-deferred.fixture.js). Each case types
// into an aui-input and a native AngularJS input with the same rules and ng-model-options, changes a rule while the
// texts wait, and leaves both: the aui-input's model, validity, dirty state and ng-change must be Angular's own.
(function () {
    const {sleep} = AuiTest;
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const form = () => scope().f;
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const errors = ctrl => Object.keys(ctrl.$error).sort();
    const show = v => v === undefined ? 'undefined' : JSON.stringify(v);
    const auiBox = id => document.querySelector('#' + id + ' aui-input input');
    const nativeBox = id => document.querySelector('#' + id + ' input.native');
    // an edit as the browser sends it: beforeinput, the new text, then input
    const edit = (input, next) => {
        input.dispatchEvent(new InputEvent('beforeinput', {inputType: 'insertText', data: next.slice(-1) || null, bubbles: true, cancelable: true}));
        input.value = next;
        input.dispatchEvent(new Event('input', {bubbles: true}));
    };
    // the same text typed into both: the aui-input has the focus, the native input takes the text without it (so
    // that neither commits before the rule changes)
    const typeBoth = (id, text) => {
        auiBox(id).focus();
        edit(auiBox(id), text);
        edit(nativeBox(id), text);
    };
    // both left: the focus goes to the native input (the aui-input commits), then out of it (the native one commits)
    const leaveBoth = async id => {
        nativeBox(id).focus();
        nativeBox(id).blur();
        await sleep(20);
    };
    const look = (key, side) => {
        const ctrl = form()[side + key];
        return {model: show(scope()[side][key]), errors: errors(ctrl)};
    };
    const pair = key => ({aui: look(key, 'a'), native: look(key, 'n')});

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('D1 a length tightened while a text waits: it commits refused (model undefined, maxlength) and ng-change hears that',
        {aui: {model: 'undefined', errors: ['maxlength']}, native: {model: 'undefined', errors: ['maxlength']},
            changes: ['a:undefined', 'n:undefined']},
        async () => {
            scope().changes.length = 0;
            typeBoth('tight', 'LONG');
            apply(s => { s.rule.tight = 2; });
            await leaveBoth('tight');
            return angular.extend(pair('tight'), {changes: scope().changes.slice()});
        });

    T('D2 a length relaxed while a refused text waits: it commits as the text it is now (model LONG, valid)',
        {aui: {model: '"LONG"', errors: []}, native: {model: '"LONG"', errors: []}},
        async () => {
            typeBoth('relax', 'LONG');
            apply(s => { s.rule.relax = 8; });
            await leaveBoth('relax');
            return pair('relax');
        });

    T('D3 a number maximum lowered while a number waits: it commits refused (model undefined, max)',
        {aui: {model: 'undefined', errors: ['max']}, native: {model: 'undefined', errors: ['max']}},
        async () => {
            typeBoth('num', '25');
            apply(s => { s.rule.num = 10; });
            await leaveBoth('num');
            return pair('num');
        });

    T('D4 a length tightened while a valid text waits: the committed value is checked at once (model undefined, maxlength); the text then commits valid',
        {now: {aui: {model: 'undefined', errors: ['maxlength']}, native: {model: 'undefined', errors: ['maxlength']}},
            after: {aui: {model: '"B"', errors: []}, native: {model: '"B"', errors: []}}},
        async () => {
            typeBoth('keep', 'B');
            apply(s => { s.rule.keep = 2; });
            await sleep(20);
            const now = pair('keep');
            await leaveBoth('keep');
            return {now, after: pair('keep')};
        });

    T('D5 the same, rolled back: the committed text shows again, its model undefined, maxlength',
        {aui: {model: 'undefined', errors: ['maxlength'], shown: 'LONG'}, native: {model: 'undefined', errors: ['maxlength'], shown: 'LONG'}},
        async () => {
            typeBoth('back', 'B');
            apply(s => { s.rule.back = 2; });
            await sleep(20);
            apply(() => { form().$rollbackViewValue(); });
            await sleep(20);
            const r = pair('back');
            r.aui.shown = auiBox('back').value;
            r.native.shown = nativeBox('back').value;
            auiBox('back').blur();
            return r;
        });

    T('D6 a number maximum lowered while a valid number waits: the committed 25 is checked at once (undefined, max); 5 then commits',
        {now: {aui: {model: 'undefined', errors: ['max']}, native: {model: 'undefined', errors: ['max']}},
            after: {aui: {model: '5', errors: []}, native: {model: '5', errors: []}}},
        async () => {
            typeBoth('num-keep', '5');
            apply(s => { s.rule.numKeep = 10; });
            await sleep(20);
            const now = {aui: look('numKeep', 'a'), native: look('numKeep', 'n')};
            await leaveBoth('num-keep');
            return {now, after: {aui: look('numKeep', 'a'), native: look('numKeep', 'n')}};
        });

    T('D7 no model yet, updateOn blur: a refused text keeps required until it commits; then pattern, dirty, model undefined',
        {before: {aui: ['required'], native: ['required']},
            after: {aui: {model: 'undefined', errors: ['pattern'], dirty: true}, native: {model: 'undefined', errors: ['pattern'], dirty: true}}},
        async () => {
            typeBoth('undef', 'bad');
            await sleep(20);
            const before = {aui: errors(form().aundef), native: errors(form().nundef)};
            await leaveBoth('undef');
            const after = pair('undef');
            after.aui.dirty = form().aundef.$dirty;
            after.native.dirty = form().nundef.$dirty;
            return {before, after};
        });

    T('D8 no model yet, debounce: a refused text commits when the debounce ends (pattern, dirty), not before',
        {before: {aui: ['required'], native: ['required']},
            after: {aui: {errors: ['pattern'], dirty: true}, native: {errors: ['pattern'], dirty: true}}},
        async () => {
            typeBoth('deb', 'bad');
            await sleep(30);
            const before = {aui: errors(form().adeb), native: errors(form().ndeb)};
            await sleep(220);
            const after = {aui: {errors: errors(form().adeb), dirty: form().adeb.$dirty},
                native: {errors: errors(form().ndeb), dirty: form().ndeb.$dirty}};
            await leaveBoth('deb');
            return {before, after};
        });

    T('D9 debounce: a length relaxed while a refused text waits for the debounce: it commits as the text it is now',
        {aui: {model: '"LONG"', errors: []}, native: {model: '"LONG"', errors: []}},
        async () => {
            typeBoth('deb-relax', 'LONG');
            apply(s => { s.rule.debRelax = 8; });
            await sleep(250);
            const r = pair('debRelax');
            await leaveBoth('deb-relax');
            return r;
        });

    T('D10 a form submitted while a text waits (its rule relaxed meanwhile): ng-submit sees the text\'s value and a valid form',
        {submits: [{valid: true, value: 'LONG'}]},
        async () => {
            scope().submits.length = 0;
            const input = document.querySelector('#submit aui-input input');
            input.focus();
            edit(input, 'LONG');
            apply(s => { s.rule.submit = 8; });
            document.getElementById('save').click();
            await sleep(20);
            input.blur();
            return {submits: scope().submits.slice()};
        });

    T('D11 a text typed and typed back before it commits leaves the field pristine, its model as it was',
        {aui: {model: '"AA"', pristine: true}, native: {model: '"AA"', pristine: true}},
        async () => {
            typeBoth('same', 'AAB');
            edit(auiBox('same'), 'AA');
            edit(nativeBox('same'), 'AA');
            await leaveBoth('same');
            return {aui: {model: show(scope().a.same), pristine: form().asame.$pristine},
                native: {model: show(scope().n.same), pristine: form().nsame.$pristine}};
        });

    T('D12 cleared while the committed LONG stays: a tightened length checks LONG (undefined, maxlength); the empty text then commits',
        {now: {aui: {model: 'undefined', errors: ['maxlength']}, native: {model: 'undefined', errors: ['maxlength']}},
            after: {aui: {model: '""', errors: []}, native: {model: '""', errors: []}}},
        async () => {
            document.querySelector('#clear-keep .aui-control-clear').click();
            edit(nativeBox('clear-keep'), '');
            await sleep(20);
            apply(s => { s.rule.clearKeep = 2; });
            await sleep(20);
            const now = {aui: look('clearKeep', 'a'), native: look('clearKeep', 'n')};
            await leaveBoth('clear-keep');
            return {now, after: {aui: look('clearKeep', 'a'), native: look('clearKeep', 'n')}};
        });

    T('D14 a refused text saved, then corrected and saved again: the second Save gets the corrected value (as the native input)',
        {first: {valid: false, a: 'undefined', n: 'undefined'}, second: {valid: true, a: '"OK"', n: '"OK"'}},
        async () => {
            const saves = scope().patternSaves;
            saves.length = 0;
            typeBoth('pattern-fix', 'bad');
            document.getElementById('pattern-save').click();
            await sleep(30);
            typeBoth('pattern-fix', 'OK');
            document.getElementById('pattern-save').click();
            await sleep(30);
            await leaveBoth('pattern-fix');
            const view = s => s && {valid: s.valid, a: show(s.a), n: show(s.n)};
            return {first: view(saves[0]), second: view(saves[1])};
        });

    T('D15 a refused text committed, another typed, then form.$rollbackViewValue(): the refused text shows again, its error kept, its value empty',
        {aui: {shown: 'LONG', errors: ['maxlength'], model: 'undefined'}, native: {shown: 'LONG', errors: ['maxlength'], model: 'undefined'}, saved: {valid: false}},
        async () => {
            typeBoth('refused', 'LONG');
            await leaveBoth('refused');
            typeBoth('refused', 'B');
            apply(s => { s.r.$rollbackViewValue(); });
            await sleep(30);
            const rf = scope().r;
            const r = {aui: {shown: auiBox('refused').value, errors: errors(rf.arefused), model: show(scope().a.refused)},
                native: {shown: nativeBox('refused').value, errors: errors(rf.nrefused), model: show(scope().n.refused)}};
            scope().rollbackSaves.length = 0;
            document.getElementById('rollback-save').click();
            await sleep(30);
            r.saved = {valid: scope().rollbackSaves[0] ? scope().rollbackSaves[0].valid : null};
            return r;
        });

    T('D16 the same with the length relaxed before the rollback: the text shows again and Save gets it (as the native input)',
        {aui: {shown: 'LONG'}, native: {shown: 'LONG'}, saved: {valid: true, a: '"LONG"', n: '"LONG"'}},
        async () => {
            // from D15: LONG committed and refused; a new text waits, the rule relaxes, then the rollback
            typeBoth('refused', 'B');
            apply(s => { s.rule.refused = 8; });
            await sleep(20);
            apply(s => { s.r.$rollbackViewValue(); });
            await sleep(30);
            const r = {aui: {shown: auiBox('refused').value}, native: {shown: nativeBox('refused').value}};
            scope().rollbackSaves.length = 0;
            document.getElementById('rollback-save').click();
            await sleep(30);
            const save = scope().rollbackSaves[0];
            r.saved = save && {valid: save.valid, a: show(save.a), n: show(save.n)};
            auiBox('refused').blur();
            return r;
        });

    T('D13 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-input: deferred commits next to Angular\'s own input', tests, {delay: 0});
})();
