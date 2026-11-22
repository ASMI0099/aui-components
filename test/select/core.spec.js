// aui-select core suite (page: core.html, fixture: core.fixture.js).
(function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const host = id => document.querySelector('#' + id + ' aui-select');
    const ctrl = id => angular.element(host(id)).controller('auiSelect');
    const ngm = id => angular.element(host(id)).controller('ngModel');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const search = id => host(id).querySelector('.aui-select__search-input');
    const lis = id => Array.prototype.slice.call(host(id).querySelectorAll('li.aui-select__option'));
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const key = (el, k) => {
        const ev = new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true});
        el.dispatchEvent(ev);
        return ev;
    };
    // A real press outside: pointerdown, then mousedown (the old outside-click directive listened to mousedown).
    const outside = () => {
        if (typeof PointerEvent === 'function') document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
        document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    };
    const type = (input, text) => { input.value = text; input.dispatchEvent(new Event('input', {bubbles: true})); };
    async function open(id) { trig(id).click(); await sleep(150); }
    async function close() { outside(); await sleep(300); }
    const errCount = () => window.__ngErrors.length;

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('T20 auto-select: a destroyed select runs nothing later (no on-change, no change event); a kept one still auto-selects',
        {auto1: '', onChangeAfterDestroy: 0, changeEventsAfterDestroy: 0, auto2: 'only'},
        async () => {
            let changeEvents = 0;
            const detachedHost = host('c-auto1');
            detachedHost.addEventListener('change', () => { changeEvents += 1; });
            await sleep(300);
            const changesBefore = scope().autoChanges;
            apply(s => { s.showAuto1 = false; });
            await sleep(1300);
            const s = scope();
            return {
                auto1: s.m.auto1, onChangeAfterDestroy: s.autoChanges - changesBefore,
                changeEventsAfterDestroy: changeEvents, auto2: s.m.auto2
            };
        });

    T('T01 Space typed in search box keeps panel open and is not blocked',
        {open: true, prevented: false},
        async () => {
            await open('c-s1');
            const ev = key(search('c-s1'), ' ');
            await sleep(50);
            const r = {open: ctrl('c-s1').isOpen, prevented: ev.defaultPrevented};
            await close();
            return r;
        });

    T('T02 Enter in the search box after a mouse open: the first press only shows the keyboard highlight, the next picks the highlighted option (default always prevented: no implicit submit)',
        {first: {open: true, prevented: true, highlight: true, value: null}, second: {open: false, prevented: true, picked: true}},
        async () => {
            await open('c-s1');
            const before = scope().m.s1;
            const ev = key(search('c-s1'), 'Enter');
            await sleep(50);
            const first = {open: ctrl('c-s1').isOpen, prevented: ev.defaultPrevented,
                highlight: !!host('c-s1').querySelector('.aui-select__panel--keyboard .aui-select__option--active'),
                value: scope().m.s1 === before ? null : scope().m.s1};
            const ev2 = key(search('c-s1'), 'Enter');
            await sleep(50);
            const second = {open: ctrl('c-s1').isOpen, prevented: ev2.defaultPrevented, picked: scope().m.s1 !== before};
            await close();
            return {first, second};
        });

    T('T03 Escape in search box closes panel',
        {open: false},
        async () => {
            await open('c-s1');
            key(search('c-s1'), 'Escape');
            await sleep(300);
            return {open: ctrl('c-s1').isOpen};
        });

    T('T04 Enter / Space / Escape / ArrowDown on the trigger behave as before',
        {enter1: true, enter2: false, space: true, esc: false, down: true},
        async () => {
            const t = trig('c-s1');
            t.focus();
            const r = {};
            key(t, 'Enter'); await sleep(150); r.enter1 = ctrl('c-s1').isOpen;
            key(t, 'Enter'); await sleep(300); r.enter2 = ctrl('c-s1').isOpen;
            key(t, ' '); await sleep(150); r.space = ctrl('c-s1').isOpen;
            key(t, 'Escape'); await sleep(300); r.esc = ctrl('c-s1').isOpen;
            key(t, 'ArrowDown'); await sleep(150); r.down = ctrl('c-s1').isOpen;
            await close();
            return r;
        });

    T('T05 search with numeric labels filters by text and throws nothing',
        {labels: ['101', 'abc 10', '310'], threw: false},
        async () => {
            const before = errCount();
            await open('c-s2');
            type(search('c-s2'), '10');
            await sleep(80);
            const r = {labels: ctrl('c-s2').filteredOptions.map(o => String(o.label)), threw: errCount() > before};
            await close();
            return r;
        });

    T('T06 search result stays during the close fade-out, then resets; the closed field keeps no rows, the next opening shows all',
        {during: 1, queryDuring: 'golf', after: 0, queryAfter: '', reopened: 8},
        async () => {
            await open('c-s1');
            type(search('c-s1'), 'golf');
            await sleep(80);
            outside();
            const c = ctrl('c-s1');
            const r = {during: c.filteredOptions.length, queryDuring: c.searchQuery};
            await sleep(300);
            r.after = c.filteredOptions.length;
            r.queryAfter = c.searchQuery;
            await open('c-s1');
            r.reopened = c.filteredOptions.length;
            outside();
            await sleep(300);
            return r;
        });

    T('T07 fast re-open during the fade-out starts with an empty search',
        {query: '', count: 8, open: true},
        async () => {
            await open('c-s1');
            type(search('c-s1'), 'golf');
            await sleep(80);
            outside();
            await sleep(50);
            trig('c-s1').click();
            await sleep(30);
            const c = ctrl('c-s1');
            const r = {query: c.searchQuery, count: c.filteredOptions.length, open: c.isOpen};
            await close();
            return r;
        });

    T('T08 opening marks dirty+touched without sending an event to parent scopes',
        {rootEvent: false, dirty: false, touched: false},
        async () => {
            const before = window.__rootEvents;
            await open('c-dv');
            const r = {rootEvent: window.__rootEvents > before, dirty: ngm('c-dv').$dirty, touched: ngm('c-dv').$touched};
            await close();
            return r;
        });

    T('T09 required select is not red before any interaction (hidden input still invalid natively)',
        {red: false, touched: false, invalid: true, hiddenValue: '', hiddenValid: false},
        async () => {
            const hidden = host('c-req').querySelector('.aui-select > input');
            return {
                red: trig('c-req').classList.contains('aui-select__trigger--invalid'),
                touched: ngm('c-req').$touched, invalid: ngm('c-req').$invalid,
                hiddenValue: hidden.value, hiddenValid: hidden.checkValidity()
            };
        });

    T('T12 form[name] is the real control; one required entry per select',
        {same: true, entries: 1, formInvalid: true},
        async () => {
            const form = scope().testForm;
            const entries = (form.$error.required || []).filter(c => c.$name === 'reqField').length;
            return {same: form.reqField === ngm('c-req'), entries: entries, formInvalid: form.$invalid};
        });

    T('T10 required select turns red after open + close while still empty',
        {red: true},
        async () => {
            await open('c-req');
            await close();
            return {red: trig('c-req').classList.contains('aui-select__trigger--invalid')};
        });

    T('T11 selecting a value clears the red and validates',
        {red: false, model: 1, valid: true},
        async () => {
            await open('c-req');
            lis('c-req')[0].click();
            await sleep(300);
            return {red: trig('c-req').classList.contains('aui-select__trigger--invalid'), model: scope().m.req, valid: ngm('c-req').$valid};
        });

    T('T13 hidden input keeps name, value, required for native validation and serialization',
        {name: 'reqField', value: '1', required: true, serialized: ['1'], valid: true},
        async () => {
            const hidden = host('c-req').querySelector('.aui-select > input');
            return {
                name: hidden.name, value: hidden.value, required: hidden.required,
                serialized: $('#testForm').serializeArray().filter(x => x.name === 'reqField').map(x => x.value),
                valid: hidden.checkValidity()
            };
        });

    T('T14 single pick: model, host .val(), native change event, on-change payload, panel closes',
        {model: 3, val: '3', changeEvents: 1, payloadId: 3, open: false},
        async () => {
            let changeEvents = 0;
            const onNative = () => { changeEvents += 1; };
            host('c-s1').addEventListener('change', onNative);
            await open('c-s1');
            lis('c-s1')[2].click();
            await sleep(300);
            host('c-s1').removeEventListener('change', onNative);
            const s = scope();
            const last = s.changes[s.changes.length - 1];
            return {
                model: s.m.s1, val: String($(host('c-s1')).val()), changeEvents: changeEvents,
                payloadId: last && last.selectedValues && last.selectedValues.id, open: ctrl('c-s1').isOpen
            };
        });

    T('T16 aria-selected reflects the selection',
        {attrs: ['false', 'false', 'true']},
        async () => {
            await open('c-s1');
            const r = {attrs: lis('c-s1').slice(0, 3).map(li => li.getAttribute('aria-selected'))};
            await close();
            return r;
        });

    T('T15 multiple: add two, remove a tag, clear all',
        {afterAdd: [1, 2], openAfterAdd: true, tags: 2, afterRemove: [2], afterClear: []},
        async () => {
            await open('c-multi');
            lis('c-multi')[0].click(); await sleep(50);
            lis('c-multi')[1].click(); await sleep(50);
            const r = {afterAdd: scope().m.multi.slice(), openAfterAdd: ctrl('c-multi').isOpen};
            await close();
            r.tags = host('c-multi').querySelectorAll('.aui-select__tag').length;
            host('c-multi').querySelector('.aui-select__tag-remove').click(); await sleep(50);
            r.afterRemove = scope().m.multi.slice();
            host('c-multi').querySelector('.aui-control-clear').click(); await sleep(50);
            r.afterClear = scope().m.multi.slice();
            return r;
        });

    T('T17 disabled values cannot be picked',
        {afterDisabled: '', afterEnabled: 1},
        async () => {
            await open('c-dv');
            lis('c-dv')[1].click(); await sleep(50);
            const r = {afterDisabled: scope().m.dv};
            lis('c-dv')[0].click(); await sleep(300);
            r.afterEnabled = scope().m.dv;
            return r;
        });

    T('T18 destroying a closed select does not fire on-close and raises nothing',
        {closeDelta: 0, errors: 0},
        async () => {
            const before = scope().closes.s5, errs = errCount();
            apply(s => { s.show5 = false; });
            await sleep(400);
            return {closeDelta: scope().closes.s5 - before, errors: errCount() - errs};
        });

    T('T19 destroying an open select fires on-close once and leaves no open popover',
        {closeDelta: 1, errors: 0, openPopovers: 0},
        async () => {
            apply(s => { s.show5 = true; });
            await sleep(100);
            await open('c-s5');
            const before = scope().closes.s5, errs = errCount();
            apply(s => { s.show5 = false; });
            await sleep(400);
            let openPopovers = 0;
            try { openPopovers = document.querySelectorAll(':popover-open').length; } catch (e) { openPopovers = -1; }
            return {closeDelta: scope().closes.s5 - before, errors: errCount() - errs, openPopovers: openPopovers};
        });

    // ---------------------------------------------------------------- max-tag-count
    const tagTexts = id => Array.prototype.slice.call(
        host(id).querySelectorAll('.aui-select__tag:not(.aui-select__tag--count) .aui-select__tag-text')).map(e => e.textContent.trim());
    const countTag = id => host(id).querySelector('.aui-select__tag--count');
    const countText = id => countTag(id) ? countTag(id).textContent.trim() : null;
    const countTitle = id => countTag(id) ? countTag(id).getAttribute('title') : null;

    T('T21 max-tag-count 2: two tags, then "+3" with the hidden names as tooltip',
        {tags: ['Alpha', 'Bravo'], count: '+3', title: 'Charlie, Delta, Echo', fits: true},
        async () => {
            const el = countTag('c-t2');
            // The whole "+N" text must be visible: nothing clipped inside the tag.
            const fits = el ? (el.scrollWidth <= el.clientWidth) : null;
            return {tags: tagTexts('c-t2'), count: countText('c-t2'), title: countTitle('c-t2'), fits: fits};
        });

    T('T27 clicking "+N" opens the dropdown, which still marks every selected item',
        {opened: true, selectedInPanel: 5},
        async () => {
            if (!countTag('c-t2')) return {opened: null, selectedInPanel: null};
            countTag('c-t2').click();
            await sleep(150);
            const r = {opened: ctrl('c-t2').isOpen, selectedInPanel: host('c-t2').querySelectorAll('li.aui-select__option--selected').length};
            await close();
            return r;
        });

    T('T22 removing a visible tag pulls the next hidden one in; count drops',
        {model: [2, 3, 4, 5], tags: ['Bravo', 'Charlie'], count: '+2'},
        async () => {
            host('c-t2').querySelector('.aui-select__tag-remove').click();
            await sleep(50);
            return {model: scope().m.tags.slice(), tags: tagTexts('c-t2'), count: countText('c-t2')};
        });

    T('T28 picking another item while limited: count grows, panel stays open (multiple)',
        {model: [2, 3, 4, 5, 1], tags: ['Bravo', 'Charlie'], count: '+3', open: true},
        async () => {
            await open('c-t2');
            lis('c-t2')[0].click();
            await sleep(50);
            const r = {model: scope().m.tags.slice(), tags: tagTexts('c-t2'), count: countText('c-t2'), open: ctrl('c-t2').isOpen};
            await close();
            return r;
        });

    T('T23 max-tag-count 0: only the count tag',
        {tags: [], count: '+2'},
        async () => ({tags: tagTexts('c-t0'), count: countText('c-t0')}));

    T('T24 max-tag-count from an expression follows its changes (1 -> 3 -> unset)',
        {one: {tags: ['Alpha'], count: '+3'}, three: {tags: ['Alpha', 'Bravo', 'Charlie'], count: '+1'}, unset: {tags: ['Alpha', 'Bravo', 'Charlie', 'Delta'], count: null}},
        async () => {
            const r = {one: {tags: tagTexts('c-tdyn'), count: countText('c-tdyn')}};
            apply(s => { s.tagLimit = 3; }); await sleep(30);
            r.three = {tags: tagTexts('c-tdyn'), count: countText('c-tdyn')};
            apply(s => { s.tagLimit = undefined; }); await sleep(30);
            r.unset = {tags: tagTexts('c-tdyn'), count: countText('c-tdyn')};
            return r;
        });

    T('T25 negative max-tag-count is ignored: all tags',
        {tags: ['Alpha', 'Bravo', 'Charlie'], count: null},
        async () => ({tags: tagTexts('c-tneg'), count: countText('c-tneg')}));

    T('T26 single mode ignores max-tag-count',
        {text: 'Bravo', tags: 0, count: null},
        async () => ({
            text: host('c-tsingle').querySelector('.aui-select__display-text').textContent.trim(),
            tags: host('c-tsingle').querySelectorAll('.aui-select__tag').length, count: countText('c-tsingle')
        }));

    // aria-setsize, and aria-posinset of the first and last rendered row (nulls when not set)
    const ariaOf = id => {
        const rows = lis(id);
        if (rows.length === 0) return null;
        return [rows[0].getAttribute('aria-setsize'), rows[0].getAttribute('aria-posinset'),
            rows[rows.length - 1].getAttribute('aria-posinset')];
    };
    const firstLabel = id => (lis(id)[0] || {textContent: ''}).textContent.trim();

    T('T29 a long static list (scroll window): each rendered row tells the whole count and its position; also scrolled and searched',
        {top: ['1000', '1'], middle: true, searched: ['112', '1'], few: [null, null, null]},
        async () => {
            await open('c-long');
            const top = ariaOf('c-long').slice(0, 2);
            const list = host('c-long').querySelector('ul.aui-select__options');
            list.scrollTop = list.scrollHeight / 2;
            list.dispatchEvent(new Event('scroll'));
            await sleep(100);
            // Scrolled: the first rendered row is "Option n" and its position is n
            const at = ariaOf('c-long');
            const middle = at[0] === '1000' && at[1] === firstLabel('c-long').replace('Option ', '') && Number(at[1]) > 400;
            type(search('c-long'), 'Option 1');    // Option 1, 10-19, 100-199, 1000: 112 matches
            await sleep(100);
            const searched = ariaOf('c-long').slice(0, 2);
            type(search('c-long'), 'Option 99');   // Option 99, 990-999: 11 matches, all rendered
            await sleep(100);
            const few = ariaOf('c-long');
            await close();
            return {top, middle, searched, few};
        });

    T('T30 a short list renders every row: no aria-setsize / aria-posinset, as before',
        {aria: [null, null, null]},
        async () => {
            await open('c-s1');
            const aria = ariaOf('c-s1');
            await close();
            return {aria};
        });

    T('T31 the keyboard starts on the selected option of a long static list (also a value given as text); with nothing selected on the first option, without searching the list',
        {none: {active: 0, fewCalls: true}, number: 730, text: 730},
        async () => {
            const c = ctrl('c-long');
            apply(s => { s.m.long = null; });
            // with nothing selected only the rendered rows ask whether they are selected (no search of all 1,000)
            const original = c.isOptionSelected;
            let calls = 0;
            c.isOptionSelected = function (option) { calls += 1; return original.call(this, option); };
            await open('c-long');
            const none = {active: c.activeIndex, fewCalls: calls < 100};
            await close();
            c.isOptionSelected = original;
            apply(s => { s.m.long = 731; });
            await open('c-long');
            const number = c.activeIndex;
            await close();
            apply(s => { s.m.long = '731'; });
            await open('c-long');
            const text = c.activeIndex;
            await close();
            apply(s => { s.m.long = null; });
            return {none, number, text};
        });

    T('T32 the opening finds the selected option without asking each row before it (a value at the end of a long list): only the rendered rows ask',
        {active: 999, fewAsked: true},
        async () => {
            const c = ctrl('c-long');
            apply(s => { s.m.long = 1000; });
            const original = c.isOptionSelected;
            const asked = new Set();
            c.isOptionSelected = function (option) { asked.add(option); return original.call(this, option); };
            await open('c-long');
            const out = {active: c.activeIndex, fewAsked: asked.size < 200};
            await close();
            c.isOptionSelected = original;
            apply(s => { s.m.long = null; });
            return out;
        });

    T('T33 the chevron\'s drawing covers its whole box (no image placed inside it): an inset falls on half a device pixel at a screen scale such as 125%, and the chevron hopped a pixel as each turn ended',
        {box: '16px 16px', mask: '16px 16px'},
        async () => {
            const chevron = trig('c-s1').querySelector('.aui-select__chevron');
            const style = getComputedStyle(chevron);
            return {box: style.width + ' ' + style.height, mask: style.webkitMaskSize || style.maskSize};
        });

    AuiTest.run('aui-select: core', tests, {delay: 0});
})();
