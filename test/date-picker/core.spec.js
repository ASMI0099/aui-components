// aui-date-picker core suite (page: core.html, fixture: core.fixture.js): values in and out (texts, ranges, two
// models, timestamps, an instant from the server), pointer and keyboard, typing, limits, max-range, shortcuts, clear,
// api, the views, the week start and format, and the digests it costs the page.
(function () {
    const {sleep} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const svc = name => angular.element(document.body).injector().get(name);
    const AD = () => svc('AuiDate');
    const host = id => document.getElementById(id);
    const box = (id, i) => host(id).querySelectorAll('input.aui-date-picker__input')[i || 0];
    const panel = id => host(id).querySelector('.aui-date-picker__panel');
    const isOpen = id => panel(id).classList.contains('aui-select__panel--open');
    const dayIn = (id, key) => Array.from(panel(id).querySelectorAll('.aui-date-picker__day[data-day="' + key + '"]'))
        .find(b => !b.classList.contains('aui-date-picker__day--outside'));
    const key = (el, k, extra) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({key: k, code: k, bubbles: true, cancelable: true}, extra || {})));
    const digestsSince = t => window.__digests.filter(x => x >= t).length;
    const lastChange = name => scope().changes.filter(c => c[0] === name).pop();
    const grid = id => panel(id).querySelector('.aui-date-picker__grid');
    // a press on a box (focus, then the press, as a mouse gives them)
    async function press(id, i) {
        const b = box(id, i);
        b.focus();
        b.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0}));
        await sleep(300);
    }
    function type(id, i, text) {
        const b = box(id, i);
        b.focus();
        b.value = text;
        b.dispatchEvent(new Event('input', {bubbles: true}));
    }
    async function enter(id, i) {
        key(box(id, i), 'Enter');
        await sleep(200);
    }
    // Escape until closed (in a range it first steps back through the picks made)
    async function close(id) {
        for (let n = 0; n < 6 && isOpen(id); n += 1) {
            key(document.activeElement && host(id).contains(document.activeElement) ? document.activeElement : box(id), 'Escape');
            await sleep(250);
        }
    }
    async function clickDay(id, k) {
        dayIn(id, k).click();
        await sleep(150);
    }
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('D1 the page\'s values shown as texts, none written back: a day, two models, an instant from the server (local time); the form untouched',
        {day: '2026-11-06', two: ['2026-12-01', '2026-12-24'], serverLocal: true, modelsKept: true, pristine: true},
        async () => {
            await sleep(100);
            return {
                day: box('p-day').value,
                two: [box('p-two', 0).value, box('p-two', 1).value],
                serverLocal: box('p-server').value === AD().format('2026-11-06T06:30:00Z', 'YYYY-MM-DD'),
                modelsKept: scope().f.start === '2026-12-01 08:00:00' && scope().f.server === '2026-11-06T06:30:00Z',
                pristine: scope().pageForm.$pristine
            };
        });

    T('D2 a press opens the value\'s month: 42 days, the value selected, today ringed when shown; Escape closes, the box keeps the focus',
        {open: true, days: 42, title: 'November 2026', selected: true, todayOk: true, closed: true, focus: true},
        async () => {
            await press('p-day');
            const t = AD().today('YYYY-M-D');
            const todays = panel('p-day').querySelectorAll('.aui-date-picker__day--today:not(.aui-date-picker__day--outside)').length;
            const r = {open: isOpen('p-day'), days: panel('p-day').querySelectorAll('.aui-date-picker__day').length,
                title: grid('p-day').getAttribute('aria-label'),
                selected: dayIn('p-day', '2026-11-6').classList.contains('aui-date-picker__day--selected'),
                todayOk: todays === (t.indexOf('2026-11-') === 0 ? 1 : 0)};
            key(box('p-day'), 'Escape');
            await sleep(300);
            r.closed = !isOpen('p-day');
            r.focus = document.activeElement === box('p-day');
            return r;
        });

    T('D3 a day picked: the value, on-change with its text and timestamp (pick, by the user), the panel closed, the page shows it',
        {model: '2026-11-12', change: ['day', '2026-11-12', '2026-11-12', true, 'pick', true], closed: true, page: '2026-11-12', dirty: true},
        async () => {
            await press('p-day');
            await clickDay('p-day', '2026-11-12');
            await sleep(300);
            const c = lastChange('day');
            return {model: scope().f.day, change: [c[0], c[1], c[2], c[3] === AD().toTimestamp('2026-11-12'), c[4], c[5]],
                closed: !isOpen('p-day'), page: document.getElementById('page-value').textContent.trim(), dirty: scope().pageForm.$dirty};
        });

    T('D4 typing: a lenient text taken on Enter; one that is not a date keeps the value, invalid; Escape restores it; an empty box clears',
        {lenient: ['2026-02-03', 'input'], bad: {model: '2026-02-03', error: true, marked: true}, restored: {text: '2026-02-03', error: false}, cleared: ['', 'clear']},
        async () => {
            type('p-day', 0, '2026/2/3');
            await enter('p-day', 0);
            const lenient = [scope().f.day, lastChange('day')[4]];
            type('p-day', 0, '2026-02-30');
            await enter('p-day', 0);
            const model = host('p-day').querySelector('.aui-date-picker');
            const ngModel = angular.element(host('p-day')).controller('ngModel');
            const bad = {model: scope().f.day, error: !!ngModel.$error.date, marked: box('p-day').classList.contains('aui-date-picker__input--bad')};
            await close('p-day');
            key(box('p-day'), 'Escape');
            await sleep(150);
            const restored = {text: box('p-day').value, error: !!ngModel.$error.date};
            type('p-day', 0, '');
            await enter('p-day', 0);
            await close('p-day');
            return {lenient, bad, restored: model ? restored : null, cleared: [scope().f.day, lastChange('day')[4]]};
        });

    T('D5 keyboard: ArrowDown opens and moves into the grid; arrows and PageDown move, Enter picks',
        {start: '2026-11-12', right: '2026-11-13', down: '2026-11-20', page: '2026-12-20', title: 'December 2026', picked: '2026-12-20', closed: true},
        async () => {
            apply(s => { s.f.day = '2026-11-12'; });
            box('p-day').focus();
            key(box('p-day'), 'ArrowDown');
            await sleep(300);
            const at = () => (document.activeElement && document.activeElement.getAttribute('data-day')) || '';
            const norm = k => AD().format(k, 'YYYY-MM-DD', 'YYYY-M-D');
            const start = norm(at());
            key(document.activeElement, 'ArrowRight');
            await sleep(120);
            const right = norm(at());
            key(document.activeElement, 'ArrowDown');
            await sleep(120);
            const down = norm(at());
            key(document.activeElement, 'PageDown');
            await sleep(150);
            const page = norm(at());
            const title = grid('p-day').getAttribute('aria-label');
            key(document.activeElement, 'Enter');
            await sleep(400);
            return {start, right, down, page, title, picked: scope().f.day, closed: !isOpen('p-day')};
        });

    T('D6 limits: days outside min / max and weekends cannot be picked - by the pointer, or the keyboard (it skips them)',
        {disabled: [true, true, false], clickIgnored: {open: true, model: '2026-11-12'}, keyboard: '2026-11-16'},
        async () => {
            apply(s => { s.f.limited = '2026-11-12'; });
            await press('p-limits');
            const dis = k => dayIn('p-limits', k).getAttribute('aria-disabled') === 'true';
            const disabled = [dis('2026-11-9'), dis('2026-11-14'), dis('2026-11-12')];
            await clickDay('p-limits', '2026-11-14');
            const clickIgnored = {open: isOpen('p-limits'), model: scope().f.limited};
            const active = panel('p-limits').querySelector('.aui-date-picker__day[tabindex="0"]');
            active.focus();
            key(active, 'ArrowRight');
            await sleep(120);
            key(document.activeElement, 'ArrowRight');
            await sleep(120);
            const keyboard = AD().format(document.activeElement.getAttribute('data-day'), 'YYYY-MM-DD', 'YYYY-M-D');
            await close('p-limits');
            return {disabled, clickIgnored, keyboard};
        });

    T('D7 the end being set takes a day before the start as the new start (the end next); then the end: in order, timestamps and duration',
        {newStart: {start: '2026-11-10', end: '', open: true}, model: ['2026-11-10 00:00:00', '2026-11-20 23:59:59'], stamps: true, duration: true, source: 'pick', byUser: true},
        async () => {
            apply(s => { s.f.range = ['2026-11-12 00:00:00', '2026-11-14 23:59:59']; });
            await press('p-range', 1);
            await clickDay('p-range', '2026-11-10');
            const newStart = {start: box('p-range', 0).value, end: box('p-range', 1).value, open: isOpen('p-range')};
            await clickDay('p-range', '2026-11-20');
            await sleep(300);
            const c = lastChange('range');
            const s0 = AD().toTimestamp('2026-11-10 00:00:00');
            const s1 = AD().toTimestamp('2026-11-20 23:59:59');
            return {newStart, model: scope().f.range, stamps: c[2][0] === s0 && c[2][1] === s1, duration: c[3] === s1 - s0, source: c[4], byUser: c[5]};
        });

    T('D8 start-model and end-model: the page\'s pair shown, a pick written to both, a clear empties both (required then fails)',
        {shown: ['2027-01-05', '2027-01-09'], picked: ['2027-01-12 00:00:00', '2027-01-15 23:59:59'], cleared: ['', ''], required: true},
        async () => {
            apply(s => { s.f.start = '2027-01-05 00:00:00'; s.f.end = '2027-01-09 23:59:59'; });
            await sleep(100);
            const shown = [box('p-two', 0).value, box('p-two', 1).value];
            await press('p-two');
            await clickDay('p-two', '2027-1-12');
            await clickDay('p-two', '2027-1-15');
            await sleep(300);
            const picked = [scope().f.start, scope().f.end];
            host('p-two').querySelector('.aui-control-clear').click();
            await sleep(300);
            return {shown, picked, cleared: [scope().f.start, scope().f.end], required: !!scope().pageForm.promo.$error.required};
        });

    T('D9 max-range 7d: once the start is picked, the days past a week after it cannot end the range; the days before it can be a new start; a typed range too long is invalid',
        {after: [false, true], before: [false, false], typed: true},
        async () => {
            await press('p-max');
            await clickDay('p-max', '2026-11-10');
            const dis = k => dayIn('p-max', k).getAttribute('aria-disabled') === 'true';
            const r = {after: [dis('2026-11-16'), dis('2026-11-17')], before: [dis('2026-11-4'), dis('2026-11-3')]};
            await close('p-max');
            type('p-max', 0, '2026-11-01');
            await enter('p-max', 0);
            type('p-max', 1, '2026-11-20');
            await enter('p-max', 1);
            await close('p-max');
            r.typed = !!scope().pageForm.maxr.$error.rangeMax;
            return r;
        });

    T('D10 shortcuts: worked out on today; outside min (today) shown disabled; one applied gives its range',
        {disabled: [false, true], model: true, closed: true},
        async () => {
            await press('p-short');
            const buttons = panel('p-short').querySelectorAll('.aui-date-picker__shortcut');
            const disabled = [buttons[0].disabled, buttons[1].disabled];
            buttons[0].click();
            await sleep(400);
            const today = AD().today();
            const v = scope().f.short;
            return {disabled, model: !!v && v[0] === today && v[1] === AD().add(today, 6, 'day', 'YYYY-MM-DD'), closed: !isOpen('p-short')};
        });

    T('D11 value-type="timestamp": a timestamp from the page shown; a typed day gives its local midnight in ms',
        {shown: '2026-11-06', model: true},
        async () => {
            apply(s => { s.f.stamp = AD().toTimestamp('2026-11-06'); });
            await sleep(100);
            const shown = box('p-stamp').value;
            type('p-stamp', 0, '2026-11-07');
            await enter('p-stamp', 0);
            await close('p-stamp');
            return {shown, model: scope().f.stamp === AD().toTimestamp('2026-11-07 00:00:00')};
        });

    T('D12 the clear button: the empty value, on-change by the user (clear)',
        {model: '', source: 'clear', byUser: true},
        async () => {
            apply(s => { s.f.day = '2026-11-06'; });
            await sleep(100);
            host('p-day').querySelector('.aui-control-clear').click();
            await sleep(300);
            const c = lastChange('day');
            return {model: scope().f.day, source: c[4], byUser: c[5]};
        });

    T('D13 api: setValue, getText, getTimestamp, getRange-free day, clear',
        {set: '2027-02-14', text: '2027-02-14', stamp: true, cleared: ''},
        async () => {
            const api = scope().api;
            api.setValue('2027-02-14');
            await sleep(100);
            const r = {set: scope().f.api, text: api.getText(), stamp: api.getTimestamp() === AD().toTimestamp('2027-02-14')};
            api.clear();
            await sleep(100);
            r.cleared = scope().f.api;
            return r;
        });

    T('D14 no digest of the page to open, to move months, to hover a range; a pick costs it at most two',
        {open: 0, months: 0, hover: 0, pick: true},
        async () => {
            apply(s => { s.f.range = ['2026-11-01 00:00:00', '2026-11-02 23:59:59']; });
            await sleep(200);
            let t = performance.now();
            await press('p-range');
            const open = digestsSince(t);
            t = performance.now();
            panel('p-range').querySelector('[data-act="next-month"]').click();
            await sleep(150);
            panel('p-range').querySelector('[data-act="prev-month"]').click();
            await sleep(150);
            const months = digestsSince(t);
            await clickDay('p-range', '2026-11-10');
            t = performance.now();
            dayIn('p-range', '2026-11-14').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            await sleep(60);
            dayIn('p-range', '2026-11-18').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            await sleep(60);
            const hover = digestsSince(t);
            t = performance.now();
            await clickDay('p-range', '2026-11-18');
            await sleep(500);
            return {open, months, hover, pick: digestsSince(t) <= 2};
        });

    T('D15 a press outside closes the panel and takes what was typed',
        {closed: true, model: '2026-03-04'},
        async () => {
            await press('p-day');
            type('p-day', 0, '2026-03-04');
            document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
            document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
            await sleep(400);
            return {closed: !isOpen('p-day'), model: scope().f.day};
        });

    T('D16 the month and year views: a month picked, then a year and its month',
        {months: 12, afterMonth: 'August 2026', years: 12, afterYear: 'January 2030'},
        async () => {
            await press('p-day');
            panel('p-day').querySelector('[data-act="month-view"]').click();
            await sleep(150);
            const months = panel('p-day').querySelectorAll('[data-act="pick-month"]').length;
            panel('p-day').querySelector('[data-act="pick-month"][data-value="8"]').click();
            await sleep(150);
            const afterMonth = grid('p-day').getAttribute('aria-label');
            panel('p-day').querySelector('[data-act="year-view"]').click();
            await sleep(150);
            const years = panel('p-day').querySelectorAll('[data-act="pick-year"]').length;
            const next = panel('p-day').querySelector('[data-act="next-years"]');
            const has2030 = () => panel('p-day').querySelector('[data-act="pick-year"][data-value="2030"]');
            if (!has2030()) { next.click(); await sleep(150); }
            has2030().click();
            await sleep(150);
            panel('p-day').querySelector('[data-act="pick-month"][data-value="1"]').click();
            await sleep(150);
            const afterYear = grid('p-day').getAttribute('aria-label');
            await close('p-day');
            return {months, afterMonth, years, afterYear};
        });

    T('D17 week-start 0 and format DD/MM/YYYY: Sunday first, the text shown in the format, the value in YYYY-MM-DD',
        {shown: '06/11/2026', first: 'Su', typed: '2026-11-07'},
        async () => {
            const shown = box('p-week').value;
            await press('p-week');
            const first = panel('p-week').querySelector('.aui-date-picker__grid th').textContent.trim();
            await close('p-week');
            type('p-week', 0, '07/11/2026');
            await enter('p-week', 0);
            await close('p-week');
            return {shown, first, typed: scope().f.week};
        });

    T('D19 a range with one end only is half a value: invalid (rangeIncomplete) until the other end is there',
        {half: true, whole: false},
        async () => {
            apply(s => { s.f.maxr = null; });
            await sleep(100);
            type('p-max', 0, '2026-11-02');
            await enter('p-max', 0);
            await close('p-max');
            const half = !!scope().pageForm.maxr.$error.rangeIncomplete;
            type('p-max', 1, '2026-11-05');
            await enter('p-max', 1);
            await close('p-max');
            return {half, whole: !!scope().pageForm.maxr.$error.rangeIncomplete};
        });

    T('D20 range-crosses-disabled="false" (weekends disabled): from Wed 4 Nov the days past Sat 7 cannot be picked, Fri 6 can; a typed range over a weekend is invalid',
        {fri: false, nextMon: true, prevMon: true, picked: ['2026-11-04', '2026-11-06'], typedInvalid: true, fixed: false},
        async () => {
            await press('p-stay');
            await clickDay('p-stay', '2026-11-4');
            const fri = dayIn('p-stay', '2026-11-6').classList.contains('aui-date-picker__day--disabled');
            const nextMon = dayIn('p-stay', '2026-11-9').classList.contains('aui-date-picker__day--disabled');
            const prevMon = dayIn('p-stay', '2026-10-26') ? dayIn('p-stay', '2026-10-26').classList.contains('aui-date-picker__day--disabled') : true;
            await clickDay('p-stay', '2026-11-6');
            await sleep(300);
            const picked = scope().f.stay;
            type('p-stay', 1, '2026-11-10');
            await enter('p-stay', 1);
            await close('p-stay');
            const typedInvalid = !!scope().pageForm.stay.$error.rangeCrossesDisabled;
            type('p-stay', 1, '2026-11-06');
            await enter('p-stay', 1);
            await close('p-stay');
            return {fri, nextMon, prevMon, picked, typedInvalid, fixed: !!scope().pageForm.stay.$error.rangeCrossesDisabled};
        });

    // the open panel's corners and the field's, where they meet (px), and the gap between them
    function joint(id) {
        const p = panel(id);
        const t = host(id).querySelector('.aui-date-picker__trigger');
        const pr = p.getBoundingClientRect();
        const tr = t.getBoundingClientRect();
        const ps = getComputedStyle(p);
        const ts = getComputedStyle(t);
        return {below: p.classList.contains('aui-date-picker__panel--bottom'), gap: Math.round(pr.top - tr.bottom),
            panel: [ps.borderTopLeftRadius, ps.borderTopRightRadius], field: [ts.borderBottomLeftRadius, ts.borderBottomRightRadius]};
    }

    T('D21 the panel joined to the field as the selects are: no gap, square where they meet; a corner past the other edge round (one month narrower than the field, two months wider)',
        {narrower: {below: true, gap: 0, panel: ['0px', '0px'], field: ['0px', '3px']},
            wider: {below: true, gap: 0, panel: ['0px', '10px'], field: ['0px', '0px']}},
        async () => {
            await press('p-day');
            await sleep(150);
            const narrower = joint('p-day');
            await close('p-day');
            await press('p-narrow');
            await sleep(150);
            const wider = joint('p-narrow');
            await close('p-narrow');
            return {narrower, wider};
        });

    T('D22 focus after a pick: with the pointer the box keeps it quietly (no ring, no caret) until a key; with the keyboard it shows',
        {pointer: {focus: true, quiet: true, caret: true}, afterKey: false, keyboard: {focus: true, quiet: false}},
        async () => {
            apply(s => { s.f.day = '2026-11-06'; });
            await press('p-day');
            dayIn('p-day', '2026-11-16').dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0}));
            await clickDay('p-day', '2026-11-16');
            await sleep(300);
            const trigger = host('p-day').querySelector('.aui-date-picker__trigger');
            const caret = getComputedStyle(box('p-day')).caretColor;
            const pointer = {focus: document.activeElement === box('p-day'), quiet: trigger.classList.contains('aui-select__trigger--pointer-focus'),
                caret: caret === 'transparent' || caret === 'rgba(0, 0, 0, 0)'};
            key(box('p-day'), 'Shift');
            key(box('p-day'), 'ArrowLeft');
            const afterKey = trigger.classList.contains('aui-select__trigger--pointer-focus');
            key(box('p-day'), 'ArrowDown');
            await sleep(350);
            key(document.activeElement, 'ArrowRight');
            await sleep(100);
            key(document.activeElement, 'Enter');
            await sleep(400);
            const keyboard = {focus: document.activeElement === box('p-day'), quiet: trigger.classList.contains('aui-select__trigger--pointer-focus')};
            return {pointer, afterKey, keyboard};
        });

    // a press outside the field (the panel closes; a whole range being set is kept)
    async function outside() {
        document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true}));
        document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
        await sleep(350);
    }
    // where the underline is going: under the start box, the end box, or hidden (its slide and fade finished at once, so
    // a slow run never reads it on the way)
    function underline(id) {
        const el = host(id).querySelector('.aui-date-picker__bar');
        el.style.transition = 'none';
        const shown = getComputedStyle(el).opacity === '1';
        const bar = el.getBoundingClientRect();
        el.style.transition = '';
        if (!shown) return 'hidden';
        // under a box: centred under it (as its text), no wider than it
        const at = i => { const b = box(id, i).getBoundingClientRect(); return Math.abs(bar.left + bar.width / 2 - b.left - b.width / 2) <= 2 && bar.width <= b.width + 1; };
        return at(0) ? 'start' : (at(1) ? 'end' : 'elsewhere');
    }

    T('D23 the underline under the end being set; from the end box a pick changes the end only (taken); from the start box a new start, the end kept, the underline on the end, a press outside keeps it',
        {endBox: 'end', endOnly: ['2026-11-10 00:00:00', '2026-11-25 23:59:59'], startBox: 'start', afterStart: {bar: 'end', end: '2026-11-25', status: '14 days', open: true},
            kept: ['2026-11-12 00:00:00', '2026-11-25 23:59:59'], closedBar: 'hidden'},
        async () => {
            apply(s => { s.f.range = ['2026-11-10 00:00:00', '2026-11-20 23:59:59']; });
            await press('p-range', 1);
            const endBox = underline('p-range');
            await clickDay('p-range', '2026-11-25');
            await sleep(300);
            const endOnly = scope().f.range.slice();
            await press('p-range', 0);
            const startBox = underline('p-range');
            await clickDay('p-range', '2026-11-12');
            await sleep(300);
            const afterStart = {bar: underline('p-range'), end: box('p-range', 1).value,
                status: panel('p-range').querySelector('.aui-date-picker__status').textContent.trim(), open: isOpen('p-range')};
            await outside();
            await sleep(200);
            return {endBox, endOnly, startBox, afterStart, kept: scope().f.range.slice(), closedBar: underline('p-range')};
        });

    T('D24 the pick under the pointer previewed (its date muted in its box, the range a little lighter than a chosen one, with dashed edges: not chosen yet, seen on any screen; its length beside it); the range replaced outlined; Escape steps back pick by pick, then closes',
        {preview: {text: '2026-11-05', muted: true, band: true, look: {tint: true, dashed: true}, tip: 'Start · 21 days'}, was: true, back: {open: true, start: '2026-11-12', bar: 'start'}, closed: true,
            model: ['2026-11-12 00:00:00', '2026-11-25 23:59:59']},
        async () => {
            await press('p-range', 0);
            dayIn('p-range', '2026-11-5').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            await sleep(120);
            const tip = panel('p-range').querySelector('.aui-date-picker__tip');
            const look = el => { const b = getComputedStyle(el, '::before'); const bg = b.backgroundColor; const m = /\/\s*([\d.]+)\s*\)$/.exec(bg) || /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(bg);
                const alpha = m ? +m[1] : (bg === 'transparent' ? 0 : 1); /* rgba(r, g, b, a) or color(srgb r g b / a) */ return {tint: alpha >= 0.07 && alpha < 0.11, dashed: b.borderTopStyle === 'dashed' && b.borderBottomStyle === 'dashed'}; };
            const preview = {text: box('p-range', 0).value, muted: box('p-range', 0).classList.contains('aui-date-picker__input--preview'),
                band: dayIn('p-range', '2026-11-15').classList.contains('aui-date-picker__day--previewing'), look: look(dayIn('p-range', '2026-11-15')),
                tip: tip ? tip.textContent.trim() : null};
            await clickDay('p-range', '2026-11-5');
            const was = dayIn('p-range', '2026-11-12').classList.contains('aui-date-picker__day--was');
            key(box('p-range'), 'Escape');
            await sleep(300);
            const back = {open: isOpen('p-range'), start: box('p-range', 0).value, bar: underline('p-range')};
            key(box('p-range'), 'Escape');
            await sleep(300);
            return {preview, was, back, closed: !isOpen('p-range'), model: scope().f.range.slice()};
        });

    T('D25 the status says what to choose next; duration chips once the start is set: +7 days ends it 7 days on (both counted), taken',
        {first: 'Choose the end date', chips: ['+7 days', '+1 month'], model: ['2026-11-03', '2026-11-09'], closed: true},
        async () => {
            apply(s => { s.f.dur = ['2026-11-01', '2026-11-02']; });
            await press('p-dur', 0);
            await clickDay('p-dur', '2026-11-3');
            const first = panel('p-dur').querySelector('.aui-date-picker__status').textContent.trim();
            const chips = Array.from(panel('p-dur').querySelectorAll('.aui-date-picker__duration')).map(b => b.textContent.trim());
            panel('p-dur').querySelector('.aui-date-picker__duration').click();
            await sleep(400);
            return {first, chips, model: scope().f.dur, closed: !isOpen('p-dur')};
        });

    T('D26 a whole range typed (or pasted) into one box: both ends taken',
        {model: ['2026-11-03 00:00:00', '2026-11-09 23:59:59'], boxes: ['2026-11-03', '2026-11-09']},
        async () => {
            type('p-range', 0, '2026-11-03 ~ 2026-11-09');
            await enter('p-range', 0);
            await close('p-range');
            return {model: scope().f.range.slice(), boxes: [box('p-range', 0).value, box('p-range', 1).value]};
        });

    T('D27 empty values: the text "null" from the page shown empty (not invalid); a timestamp field emptied is null (not an empty text)',
        {nullText: {box: '', error: false}, stamp: null},
        async () => {
            apply(s => { s.f.day = 'null'; });
            await sleep(100);
            const nullText = {box: box('p-day').value, error: !!angular.element(host('p-day')).controller('ngModel').$error.date};
            apply(s => { s.f.stamp = AD().toTimestamp('2026-11-06'); });
            await sleep(100);
            type('p-stamp', 0, '');
            await enter('p-stamp', 0);
            await close('p-stamp');
            return {nullText, stamp: scope().f.stamp};
        });

    T('D28 the underline never widens the page: placed under the end box of a wide field, the field then narrow at the right edge of the window',
        {inside: true, pageWidth: true},
        async () => {
            await press('p-range', 1);
            await close('p-range');
            const el = host('p-range');
            const keep = el.getAttribute('style');
            el.setAttribute('style', 'position: absolute; top: 0; left: ' + (innerWidth - 180) + 'px; width: 170px;');
            await sleep(200);
            const bar = el.querySelector('.aui-date-picker__bar');
            const inside = getComputedStyle(bar.parentElement).overflow === 'hidden';
            const pageWidth = document.documentElement.scrollWidth <= innerWidth;
            if (keep === null) el.removeAttribute('style');
            else el.setAttribute('style', keep);
            await sleep(100);
            return {inside, pageWidth};
        });

    T('D29 the underline and the focus tell the truth (min-range 2d): a new start whose old end no longer fits: the underline and the focus on the end; a day before the start under the pointer: the underline under the start, "New start"; the pointer gone: back on the end',
        {afterPick: {bar: 'end', end: '', focusEnd: true}, before: {bar: 'start', start: '2026-11-10', muted: true, tip: 'New start'},
            gone: {bar: 'end', start: '2026-11-13'}, after: {bar: 'end', end: '2026-11-15', tip: '3 days'}},
        async () => {
            apply(s => { s.f.nights = ['2026-11-06', '2026-11-13']; });
            await press('p-nights', 0);
            await clickDay('p-nights', '2026-11-13');
            await sleep(250);
            const afterPick = {bar: underline('p-nights'), end: box('p-nights', 1).value, focusEnd: document.activeElement === box('p-nights', 1)};
            dayIn('p-nights', '2026-11-10').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            await sleep(250);
            const tip1 = panel('p-nights').querySelector('.aui-date-picker__tip');
            const before = {bar: underline('p-nights'), start: box('p-nights', 0).value,
                muted: box('p-nights', 0).classList.contains('aui-date-picker__input--preview'), tip: tip1 ? tip1.textContent.trim() : null};
            panel('p-nights').dispatchEvent(new MouseEvent('mouseleave'));
            await sleep(250);
            const gone = {bar: underline('p-nights'), start: box('p-nights', 0).value};
            dayIn('p-nights', '2026-11-15').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            await sleep(250);
            const tip2 = panel('p-nights').querySelector('.aui-date-picker__tip');
            const after = {bar: underline('p-nights'), end: box('p-nights', 1).value, tip: tip2 ? tip2.textContent.trim() : null};
            await close('p-nights');
            return {afterPick, before, gone, after};
        });

    T('D30 a box too narrow for its text: whole days shown as dates, times without :00 / :59 seconds and without this year, never cut; the whole text as its title; typed in: the whole text; a wide field: as it is',
        {days: {shown: true, fits: true, title: true}, times: {shown: true, fits: true, title: true}, typing: true, left: true, wide: {whole: true, title: false}},
        async () => {
            const y = AD().today('YYYY');
            const fitsBox = b => b.scrollWidth <= b.clientWidth + 1;
            const whole = () => host('p-tight').querySelector('.aui-date-picker__boxes').title;
            apply(s => { s.f.tight = [y + '-11-07 00:00:00', y + '-12-31 23:59:59']; });
            await sleep(150);
            const b0 = box('p-tight', 0);
            const b1 = box('p-tight', 1);
            // whole days: their dates (or shorter still: the month and day of this year)
            const days = {shown: (b0.value === y + '-11-07' || b0.value === '11-07') && (b1.value === y + '-12-31' || b1.value === '12-31'),
                fits: fitsBox(b0) && fitsBox(b1), title: whole() === y + '-11-07 00:00:00 \u2192 ' + y + '-12-31 23:59:59' && !b0.title && !b1.title};
            apply(s => { s.f.tight = [y + '-11-07 09:30:00', y + '-12-31 18:00:59']; });
            await sleep(150);
            // times kept (seconds dropped, the year too when needed)
            const times = {shown: /09:30$/.test(b0.value) && /18:00$/.test(b1.value), fits: fitsBox(b0) && fitsBox(b1),
                title: whole() === y + '-11-07 09:30:00 \u2192 ' + y + '-12-31 18:00:59'};
            // the keyboard in the box: its whole text to edit; leaving it: short again
            b0.focus();
            key(b0, 'ArrowLeft');
            await sleep(100);
            const typing = b0.value === y + '-11-07 09:30:00';
            b0.blur();
            await sleep(100);
            const left = /09:30$/.test(b0.value) && b0.value !== y + '-11-07 09:30:00';
            apply(s => { s.f.range = [y + '-11-07 00:00:00', y + '-12-31 23:59:59']; });
            await sleep(150);
            const wide = {whole: box('p-range', 0).value === y + '-11-07', title: !!host('p-range').querySelector('.aui-date-picker__boxes').title};
            apply(s => { s.f.tight = null; });
            return {days, times, typing, left, wide};
        });

    T('D31 a box a few pixels too narrow: the text with the letters a little closer, both boxes; narrower: an ellipsis drawn by the field, also in a box with the quiet focus of a pointer; a key: the whole text, spaced as typed',
        {tight: {text: true, both: true, cut: false}, clipped: {quiet: true, ellipsis: true, fits: true, title: true}, typing: {whole: true, tight: false}},
        async () => {
            const y = AD().today('YYYY');
            const h = host('p-tight');
            const b0 = box('p-tight', 0);
            const b1 = box('p-tight', 1);
            const isTight = b => b.classList.contains('aui-date-picker__input--tight');
            const whole = () => h.querySelector('.aui-date-picker__boxes').title;
            // the width a text takes in a box's font, spaced as typed
            const widthOf = (text, b) => {
                const cs = getComputedStyle(b);
                const sp = document.createElement('span');
                sp.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;letter-spacing:normal';
                sp.style.fontFamily = cs.fontFamily;
                sp.style.fontSize = cs.fontSize;
                sp.style.fontWeight = cs.fontWeight;
                sp.style.fontVariantNumeric = cs.fontVariantNumeric;
                sp.textContent = text;
                document.body.appendChild(sp);
                const w = sp.getBoundingClientRect().width;
                sp.remove();
                return w;
            };
            // the field made narrower until its boxes are `room` wide (the two boxes share what it loses)
            async function boxesOf(room) {
                for (let n = 0; n < 8 && b0.clientWidth !== room; n += 1) {
                    const diff = room - b0.clientWidth;
                    h.style.width = (h.getBoundingClientRect().width + (Math.abs(diff) > 1 ? 2 * diff : diff)) + 'px';
                    await sleep(80);
                }
                await sleep(120);
            }
            apply(s => { s.f.tight = [y + '-11-07 09:30:00', y + '-12-31 18:00:59']; });
            await sleep(150);
            // the shortest text without a cut (no seconds, no year) two pixels too long: shown whole, tighter
            await boxesOf(Math.floor(widthOf('11-07 09:30', b0)) - 2);
            const tight = {text: b0.value === '11-07 09:30' && b1.value === '12-31 18:00', both: isTight(b0) && isTight(b1),
                cut: /…/.test(b0.value + b1.value)};
            // far too narrow, the focus in the box after a pointer (quiet): cut by the field, an ellipsis at its end
            await boxesOf(30);
            document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0}));
            b0.focus();
            await sleep(150);
            const fitsBox = b => b.scrollWidth <= b.clientWidth + 1;
            const clipped = {quiet: document.activeElement === b0 && h.querySelector('.aui-date-picker__trigger').classList.contains('aui-select__trigger--pointer-focus'),
                ellipsis: /…$/.test(b0.value) && /…$/.test(b1.value), fits: fitsBox(b0) && fitsBox(b1), title: whole() === y + '-11-07 09:30:00 \u2192 ' + y + '-12-31 18:00:59'};
            // a key in it: its whole text to edit, spaced as typed
            key(b0, 'ArrowLeft');
            await sleep(100);
            const typing = {whole: b0.value === y + '-11-07 09:30:00', tight: isTight(b0)};
            b0.blur();
            h.style.width = '';
            apply(s => { s.f.tight = null; });
            await sleep(150);
            return {tight, clipped, typing};
        });

    T('D32 the pick under the pointer previewed only while the pointer is on a day: off the days in the panel (the header, the footer) nothing previewed and no tip; after the next-month arrow no tip floats over another day',
        {on: {tip: '5 days', muted: true}, header: {tip: null, muted: false, lit: 0}, footer: {tip: null, muted: false}, arrow: {tip: null, lit: 0}},
        async () => {
            apply(s => { s.f.range = ['2026-11-03 00:00:00', '2026-11-05 23:59:59']; });
            await press('p-range', 1);
            const over = el => el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            const tipText = () => { const t = panel('p-range').querySelector('.aui-date-picker__tip'); return t ? t.textContent.trim() : null; };
            const muted = () => box('p-range', 1).classList.contains('aui-date-picker__input--preview');
            const lit = () => panel('p-range').querySelectorAll('.aui-date-picker__day--previewing').length;
            over(dayIn('p-range', '2026-11-7'));
            await sleep(200);
            const on = {tip: tipText(), muted: muted()};
            over(panel('p-range').querySelector('.aui-date-picker__header'));
            await sleep(200);
            const header = {tip: tipText(), muted: muted(), lit: lit()};
            over(dayIn('p-range', '2026-11-7'));
            await sleep(150);
            over(panel('p-range').querySelector('.aui-date-picker__footer'));
            await sleep(200);
            const footer = {tip: tipText(), muted: muted()};
            over(dayIn('p-range', '2026-11-7'));
            await sleep(150);
            const arrowEl = panel('p-range').querySelector('[data-act="next-month"]');
            over(arrowEl);
            arrowEl.click();
            await sleep(250);
            const arrow = {tip: tipText(), lit: lit()};
            await close('p-range');
            return {on, header, footer, arrow};
        });

    T('D33 a day the range\'s length rules out, under the pointer: nothing previewed, the tip says why (At most 14 days, At least 2 days); a day that fits: its length again',
        {far: {tip: 'At most 14 days', end: '', lit: 0}, near: {tip: 'At least 2 days'}, fits: {tip: '6 days', end: '2026-11-08', muted: true}},
        async () => {
            apply(s => { s.f.nights = ['2026-11-03', '2026-11-04']; });
            await press('p-nights', 1);
            const over = el => el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            const tipText = () => { const t = panel('p-nights').querySelector('.aui-date-picker__tip'); return t ? t.textContent.trim() : null; };
            over(dayIn('p-nights', '2026-11-25'));
            await sleep(200);
            const far = {tip: tipText(), end: box('p-nights', 1).classList.contains('aui-date-picker__input--preview') ? box('p-nights', 1).value : '',
                lit: panel('p-nights').querySelectorAll('.aui-date-picker__day--previewing').length};
            over(dayIn('p-nights', '2026-11-3'));
            await sleep(200);
            const near = {tip: tipText()};
            over(dayIn('p-nights', '2026-11-8'));
            await sleep(200);
            const fits = {tip: tipText(), end: box('p-nights', 1).value, muted: box('p-nights', 1).classList.contains('aui-date-picker__input--preview')};
            await close('p-nights');
            return {far, near, fits};
        });

    T('D34 the days of the last and next month: the range drawn on them as on any day (its start there marked); in the two months the days one shows of the other are left out (invisible, not read out), each date once',
        {view: ['2026-11', '2026-12'], startMarked: true, inner: {left: true, right: true, invisible: true, ariaHidden: true}, nextMonthShown: true, onceEach: true},
        async () => {
            apply(s => { s.f.range = ['2026-10-31 00:00:00', '2026-12-31 23:59:59']; });
            await press('p-range', 1);
            const cals = panel('p-range').querySelectorAll('.aui-date-picker__calendar');
            const cells = i => Array.from(cals[i].querySelectorAll('.aui-date-picker__day'));
            const keyOf = b => b.getAttribute('data-day');
            const hidden = b => b.classList.contains('aui-date-picker__day--hidden');
            const monthOf = i => keyOf(cells(i).find(b => !b.classList.contains('aui-date-picker__day--outside'))).split('-').slice(0, 2)
                .map((n, k) => (k ? String(n).padStart(2, '0') : n)).join('-');
            const left = cells(0);
            const right = cells(1);
            const oct31 = left.find(b => keyOf(b) === '2026-10-31');
            const startMarked = !!oct31 && oct31.classList.contains('aui-date-picker__day--start') && !hidden(oct31) &&
                getComputedStyle(oct31).visibility === 'visible';
            const leftTail = left.filter(b => keyOf(b).indexOf('2026-12-') === 0);
            const rightHead = right.filter(b => keyOf(b).indexOf('2026-11-') === 0);
            const inner = {left: leftTail.length > 0 && leftTail.every(hidden), right: rightHead.length > 0 && rightHead.every(hidden),
                invisible: !!leftTail[0] && getComputedStyle(leftTail[0]).visibility === 'hidden',
                ariaHidden: !!leftTail[0] && leftTail[0].parentElement.getAttribute('aria-hidden') === 'true'};
            const next = right.filter(b => keyOf(b).indexOf('2027-1-') === 0);
            const nextMonthShown = next.length > 0 && next.every(b => !hidden(b));
            const shown = left.concat(right).filter(b => !hidden(b)).map(keyOf);
            const onceEach = shown.length === new Set(shown).size;
            const view = [monthOf(0), monthOf(1)];
            await close('p-range');
            return {view, startMarked, inner, nextMonthShown, onceEach};
        });

    T('D35 the keyboard\'s pick previewed only while the focus is on the days: the focus moved on (to OK), the range as set again',
        {inGrid: true, moved: false},
        async () => {
            apply(s => { s.f.range = ['2026-11-03 00:00:00', '2026-11-05 23:59:59']; });
            await press('p-range', 1);
            key(box('p-range', 1), 'ArrowDown');
            await sleep(250);
            key(document.activeElement, 'ArrowRight');
            await sleep(250);
            const inGrid = box('p-range', 1).classList.contains('aui-date-picker__input--preview');
            panel('p-range').querySelector('[data-act="ok"]').focus();
            await sleep(200);
            const moved = box('p-range', 1).classList.contains('aui-date-picker__input--preview');
            await close('p-range');
            return {inGrid, moved};
        });

    T('D36 a range opened with a value: from its start the tip names the start (its length to the end kept: the start day the whole range, the end day one day), past the end "New start"; from its end the plain length',
        {fromStart: {startDay: 'Start \u00b7 18 days', endDay: 'Start \u00b7 1 day', pastEnd: 'New start', bar: 'start'}, fromEnd: {later: '23 days', bar: 'end'}},
        async () => {
            apply(s => { s.f.range = ['2026-11-03 00:00:00', '2026-11-20 23:59:59']; });
            const over = (k) => dayIn('p-range', k).dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            const tipText = () => { const el = panel('p-range').querySelector('.aui-date-picker__tip'); return el ? el.textContent.trim() : null; };
            await press('p-range', 0);
            over('2026-11-3');
            await sleep(300);
            const startDay = tipText();
            const bar = underline('p-range');
            over('2026-11-20');
            await sleep(200);
            const endDay = tipText();
            over('2026-11-25');
            await sleep(200);
            const pastEnd = tipText();
            await close('p-range');
            await press('p-range', 1);
            over('2026-11-25');
            await sleep(300);
            const fromEnd = {later: tipText(), bar: underline('p-range')};
            await close('p-range');
            return {fromStart: {startDay, endDay, pastEnd, bar}, fromEnd};
        });

    T('D37 a narrow range field\'s tooltip: over its value area and its calendar icon (the pointer let through) the whole range, an end not set "Not set"; over the label not; all of it shown (a wide field): none',
        {icon: true, label: true, oneEnd: true, shownWhole: true},
        async () => {
            const y = AD().today('YYYY');
            const h = host('p-tight');
            const area = h.querySelector('.aui-date-picker__boxes');
            const at = el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); };
            h.style.width = '300px';
            apply(s => { s.f.tight = [y + '-11-07 09:30:00', y + '-12-31 18:00:59']; });
            await sleep(200);
            const range = y + '-11-07 09:30:00 \u2192 ' + y + '-12-31 18:00:59';
            const underIcon = at(h.querySelector('.aui-date-picker__icon'));
            const icon = !!underIcon && !!underIcon.closest('[title]') && underIcon.closest('[title]').title === range;
            const labelEl = h.querySelector('.aui-control-label');
            const label = !labelEl || !labelEl.closest('[title]') || labelEl.closest('[title]').title !== range;
            apply(s => { s.f.tight = [y + '-11-07 09:30:00', '']; });
            await sleep(200);
            const oneEnd = area.title === y + '-11-07 09:30:00 \u2192 Not set';
            h.style.width = '760px';
            apply(s => { s.f.tight = [y + '-11-07 09:30:00', y + '-12-31 18:00:59']; });
            await sleep(250);
            const shownWhole = !area.title && box('p-tight', 0).value === y + '-11-07 09:30:00';
            h.style.width = '';
            apply(s => { s.f.tight = null; });
            return {icon, label, oneEnd, shownWhole};
        });

    T('D38 a text cut by less than a pixel is cut (the ellipsis drawn): kit.isCutOff measures it exactly; one that fits by less than a pixel is not; the label of a field cut that little shows its whole text on hover',
        {subPixel: true, fitsBarely: false, clearly: true, label: 'Time of the promotion in the room'},
        async () => {
            const kit = svc('auiControlKit');
            const el = document.createElement('div');
            el.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:14px sans-serif;padding:0 9px 0 0;box-sizing:content-box';
            el.textContent = 'Promotion Time Time Time';
            document.body.appendChild(el);
            const range = document.createRange();
            range.selectNodeContents(el);
            el.style.width = 'auto';
            el.style.display = 'inline-block';
            const text = range.getBoundingClientRect().width;
            el.style.width = (text - 0.6) + 'px';
            const subPixel = kit.isCutOff(el);
            el.style.width = (text + 0.6) + 'px';
            const fitsBarely = kit.isCutOff(el);
            el.style.width = (text - 6) + 'px';
            const clearly = kit.isCutOff(el);
            el.remove();
            // the date picker's label (in its box) cut: its whole text on hover
            const h = host('p-tight');
            h.setAttribute('label-text', 'Time of the promotion in the room');
            const scopeOf = angular.element(h).isolateScope && angular.element(h).isolateScope();
            if (scopeOf) scopeOf.$apply(() => { scopeOf.$ctrl.labelText = 'Time of the promotion in the room'; });
            h.style.width = '260px';
            await sleep(150);
            const labelEl = h.querySelector('.aui-control-label');
            labelEl.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            const label = labelEl.getAttribute('title');
            if (scopeOf) scopeOf.$apply(() => { scopeOf.$ctrl.labelText = 'Time'; });
            h.style.width = '';
            await sleep(100);
            return {subPixel, fitsBarely, clearly, label};
        });

    T('D39 a date typed outside min / max or on a disabled day is not taken: the box keeps it, marked, the reason the error, the value as it was; Escape shows the value again; an allowed one is taken',
        {below: {model: '2026-11-12', box: '2026-11-05', bad: true, min: true}, back: {box: '2026-11-12', min: false},
            weekend: {model: '2026-11-12', disabledDate: true}, taken: {model: '2026-11-13', valid: true}},
        async () => {
            apply(s => { s.f.limited = '2026-11-12'; });
            await sleep(100);
            const b = box('p-limits');
            const m = () => angular.element(host('p-limits')).controller('ngModel');
            const typeEnter = async text => { type('p-limits', 0, text); key(b, 'Enter'); await sleep(250); };
            await typeEnter('2026-11-05');
            const below = {model: scope().f.limited, box: b.value, bad: b.classList.contains('aui-date-picker__input--bad'), min: !!m().$error.min};
            await close('p-limits');
            key(b, 'Escape');
            await sleep(200);
            const back = {box: b.value, min: !!m().$error.min};
            await typeEnter('2026-11-14');
            const weekend = {model: scope().f.limited, disabledDate: !!m().$error.disabledDate};
            await close('p-limits');
            await typeEnter('2026-11-13');
            await close('p-limits');
            const taken = {model: scope().f.limited, valid: m().$valid};
            b.blur();
            return {below, back, weekend, taken};
        });

    T('D40 the page model is never erased to undefined: a value the page made invalid by changing min stays; a required field cleared holds an empty text; a range of timestamps cleared holds [null, null]',
        {dyn: {model: '2026-11-15', min: true}, dynBack: {valid: true}, req: {model: '', required: true}, tsr: [null, null]},
        async () => {
            const m = id => angular.element(host(id)).controller('ngModel');
            apply(s => { s.f.dynMin = '2026-11-20'; });
            await sleep(150);
            const dyn = {model: scope().f.dyn, min: !!m('p-dyn').$error.min};
            apply(s => { s.f.dynMin = ''; });
            await sleep(150);
            const dynBack = {valid: m('p-dyn').$valid};
            host('p-req').querySelector('.aui-control-clear').click();
            await sleep(200);
            const req = {model: scope().f.req, required: !!m('p-req').$error.required};
            apply(s => { s.f.tsr = [AD().toTimestamp('2026-11-03'), AD().toTimestamp('2026-11-20')]; });
            await sleep(100);
            host('p-tsr').querySelector('.aui-control-clear').click();
            await sleep(200);
            apply(s => { s.f.req = '2026-11-07'; });
            return {dyn, dynBack, req, tsr: scope().f.tsr};
        });

    T('D41 the calendar ends with the year 9999: the days of January 10000 cannot be picked, the next month arrow stays on December 9999',
        {disabled: true, kept: '9999-12-30', view: true},
        async () => {
            await press('p-edge');
            const beyond = Array.from(panel('p-edge').querySelectorAll('.aui-date-picker__day[data-day^="10000-"]'));
            const disabled = beyond.length > 0 && beyond.every(c => c.getAttribute('aria-disabled') === 'true');
            if (beyond[0]) beyond[0].click();
            await sleep(150);
            const next = panel('p-edge').querySelector('[data-act="next-month"]');
            if (next) next.click();
            await sleep(150);
            const view = Array.from(panel('p-edge').querySelectorAll('.aui-date-picker__day:not(.aui-date-picker__day--outside)')).every(c => /^9999-12-/.test(c.getAttribute('data-day')));
            const kept = scope().f.edge;
            await close('p-edge');
            return {disabled, kept, view};
        });

    T('D42 a held arrow key keeps every step across month changes: 60 x ArrowRight from 2026-11-06 lands on 2027-01-05, the focus on it',
        {focus: '2027-1-5', active: true},
        async () => {
            apply(s => { s.f.day = '2026-11-06'; });
            await sleep(80);
            box('p-day').focus();
            key(box('p-day'), 'ArrowDown');
            await sleep(400);
            for (let i = 0; i < 60; i += 1) key(document.activeElement, 'ArrowRight', {repeat: i > 0});
            await sleep(200);
            const el = document.activeElement;
            const r = {focus: el && el.getAttribute('data-day'), active: !!el && el.classList.contains('aui-date-picker__day--active')};
            await close('p-day');
            return r;
        });

    T('D43 a touch press opens the panel with the on-screen keyboard kept away (inputmode none); a tap in the box while open brings it back; closed: none; a mouse press never sets it',
        {touchOpen: 'none', tapAgain: null, closed: null, mouse: null},
        async () => {
            const b = box('p-day');
            const pointer = type => b.dispatchEvent(new PointerEvent('pointerdown', {pointerType: type, bubbles: true, cancelable: true, button: 0}));
            pointer('touch');
            await press('p-day');
            const touchOpen = b.getAttribute('inputmode');
            pointer('touch');
            await sleep(50);
            const tapAgain = b.getAttribute('inputmode');
            await close('p-day');
            const closed = b.getAttribute('inputmode');
            pointer('mouse');
            await press('p-day');
            const mouse = b.getAttribute('inputmode');
            await close('p-day');
            b.blur();
            return {touchOpen, tapAgain, closed, mouse};
        });

    T('D44 disabled-date gets $parts with both names (y, M, d and year, month, day): the 15th refused by $parts.d, the 16th by $parts.day',
        {d15: 'true', d16: 'true', d17: 'false'},
        async () => {
            await press('p-parts');
            const r = {d15: dayIn('p-parts', '2026-11-15').getAttribute('aria-disabled'), d16: dayIn('p-parts', '2026-11-16').getAttribute('aria-disabled'),
                d17: dayIn('p-parts', '2026-11-17').getAttribute('aria-disabled')};
            await close('p-parts');
            return r;
        });

    T('D45 a tip near the panel\'s side stays inside it: At most 14 days over the last column of the second month (it would cross the side where it is anchored), a tip over the first column of the first month; nothing in the panel scrolls sideways',
        {right: {tip: 'At most 14 days', wouldRunOut: true, inside: true}, left: {inside: true}, scrolls: []},
        async () => {
            apply(s => { s.f.nights = ['2026-11-03', '2026-11-04']; });
            await press('p-nights', 1);
            const p = panel('p-nights');
            const column = (cal, last) => {
                const days = Array.from(p.querySelectorAll('.aui-date-picker__calendar')[cal].querySelectorAll('.aui-date-picker__day'))
                    .filter(d => !d.classList.contains('aui-date-picker__day--outside') && !d.classList.contains('aui-date-picker__day--hidden'));
                const at = d => d.closest('td').cellIndex;
                const edge = last ? Math.max.apply(null, days.map(at)) : 0;
                return days.filter(d => at(d) === edge);
            };
            const tipBy = async el => {
                el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
                await sleep(200);
                const t = p.querySelector('.aui-date-picker__tip');
                if (!t) return {tip: null};
                const pr = p.getBoundingClientRect();
                const tr = t.getBoundingClientRect();
                const er = el.getBoundingClientRect();
                const anchor = er.left + er.width / 2;
                return {tip: t.textContent.trim(), wouldRunOut: anchor - tr.width / 2 < pr.left || anchor + tr.width / 2 > pr.right,
                    inside: tr.left >= pr.left - 0.5 && tr.right <= pr.right + 0.5};
            };
            const right = await tipBy(column(1, true)[2]);
            const left = await tipBy(column(0, false)[2]);
            const scrolls = [p].concat(Array.from(p.querySelectorAll('*')))
                .filter(e => e.scrollWidth > e.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(e).overflowX)).map(e => e.className.split(' ')[0]);
            await close('p-nights');
            return {right, left: {inside: left.tip === null || left.inside}, scrolls};
        });

    T('D46 the footer\'s Clear only on a clearable field, enabled with a value, clears it as the field\'s clear button (closed, [null, null]); the underline as wide as the text, under it',
        {plain: false, clear: {shown: true, enabled: true}, after: {model: [null, null], open: false}, bar: {narrower: true, centred: true, text: true}},
        async () => {
            apply(s => { s.f.range = ['2026-11-10 00:00:00', '2026-11-20 23:59:59']; s.f.tsr = [AD().toTimestamp('2026-11-03'), AD().toTimestamp('2026-11-20')]; });
            await sleep(80);
            await press('p-range', 0);
            const plain = !!panel('p-range').querySelector('[data-act="clear"]');
            const b = box('p-range', 0).getBoundingClientRect();
            const el = host('p-range').querySelector('.aui-date-picker__bar');
            el.style.transition = 'none';
            const r = el.getBoundingClientRect();
            el.style.transition = '';
            const bar = {narrower: r.width < b.width - 20, centred: Math.abs(r.left + r.width / 2 - b.left - b.width / 2) <= 2, text: r.width > 40};
            await close('p-range');
            await press('p-tsr', 0);
            const btn = panel('p-tsr').querySelector('[data-act="clear"]');
            const clear = {shown: !!btn, enabled: !!btn && !btn.disabled};
            if (btn) btn.click();
            await sleep(300);
            const after = {model: scope().f.tsr, open: isOpen('p-tsr')};
            box('p-tsr', 0).blur();
            return {plain, clear, after, bar};
        });

    T('D47 a closed panel is kept, its bindings out of the page\'s digests: closed, none of its watchers runs; the value changed by the page meanwhile shows at the next opening; past ten closed panels the one closed longest ago gives its body back and builds it again when opened',
        {asleep: true, awake: true, shown: {start: true, box: '2026-11-03'}, cap: {first: false, last: true}, again: {body: true, day: true}},
        async () => {
            const watchersOf = el => { let n = 0; const walk = s => { n += (s.$$watchers || []).length; for (let c = s.$$childHead; c; c = c.$$nextSibling) walk(c); }; walk(angular.element(el).scope()); return n; };
            apply(s => { s.f.range = ['2026-11-10 00:00:00', '2026-11-20 23:59:59']; });
            await press('p-range', 0);
            await close('p-range');
            await sleep(400);
            const bodyOf = id => panel(id).querySelector('.aui-date-picker__body');
            const asleep = !!bodyOf('p-range') && watchersOf(bodyOf('p-range')) === 0;
            apply(s => { s.f.range = ['2026-11-03 00:00:00', '2026-11-08 23:59:59']; });
            await sleep(100);
            await press('p-range', 0);
            const awake = watchersOf(bodyOf('p-range')) > 50;
            const startCell = dayIn('p-range', '2026-11-3');
            const shown = {start: !!startCell && startCell.classList.contains('aui-date-picker__day--start'), box: box('p-range', 0).value};
            await close('p-range');
            box('p-range', 0).blur();
            // eleven fields of their own, each opened and closed: the first gives its body back
            const inj = angular.element(document.body).injector();
            const sc = scope().$new(true);
            sc.v = [];
            let html = '';
            for (let i = 0; i < 11; i += 1) { sc.v.push('2026-11-1' + (i % 9)); html += '<aui-date-picker class="cap-f" ng-model="v[' + i + ']"></aui-date-picker>'; }
            const holder = inj.get('$compile')('<div>' + html + '</div>')(sc)[0];
            document.body.appendChild(holder);
            sc.$digest();
            const fields = Array.from(holder.querySelectorAll('aui-date-picker'));
            for (const f of fields) {
                const b = f.querySelector('input.aui-date-picker__input');
                b.focus();
                b.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0}));
                await sleep(250);
                key(b, 'Escape');
                await sleep(350);
                b.blur();
            }
            const cap = {first: !!fields[0].querySelector('.aui-date-picker__body'), last: !!fields[10].querySelector('.aui-date-picker__body')};
            const b0 = fields[0].querySelector('input.aui-date-picker__input');
            b0.focus();
            b0.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0}));
            await sleep(300);
            const again = {body: !!fields[0].querySelector('.aui-date-picker__body'), day: !!fields[0].querySelector('.aui-date-picker__day--selected')};
            key(b0, 'Escape');
            await sleep(300);
            b0.blur();
            sc.$destroy();
            holder.remove();
            return {asleep, awake, shown, cap, again};
        });

    T('D48 last3Months / last6Months / last12Months in a range of days: from the day after the same date 3 / 6 / 12 months ago to today (a month range: this month and those before)',
        {days: [true, true, true], months: true},
        async () => {
            const inj = angular.element(document.body).injector();
            const sc = scope().$new(true);
            sc.m = {d: null, mo: null};
            const el = inj.get('$compile')('<div><aui-date-picker type="daterange" ng-model="m.d" shortcuts="[\'last3Months\', \'last6Months\', \'last12Months\']"></aui-date-picker>' +
                '<aui-date-picker type="monthrange" ng-model="m.mo" shortcuts="[\'last3Months\']"></aui-date-picker></div>')(sc)[0];
            document.body.appendChild(el);
            sc.$digest();
            const today = new Date();
            const day = d => AD().format(d, 'YYYY-MM-DD');
            const since = k => day(new Date(today.getFullYear(), today.getMonth() - k, today.getDate() + 1));
            const take = async (f, i) => {
                const b = f.querySelector('input.aui-date-picker__input');
                b.focus();
                b.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0}));
                await sleep(300);
                f.querySelectorAll('[data-shortcut]')[i].click();
                await sleep(300);
                b.blur();
            };
            const fields = el.querySelectorAll('aui-date-picker');
            const days = [];
            for (let i = 0; i < 3; i += 1) {
                await take(fields[0], i);
                days.push(JSON.stringify(sc.m.d) === JSON.stringify([since([3, 6, 12][i]), day(today)]));
            }
            await take(fields[1], 0);
            const ym = d => AD().format(d, 'YYYY-MM');
            const months = JSON.stringify(sc.m.mo) === JSON.stringify([ym(new Date(today.getFullYear(), today.getMonth() - 2, 1)), ym(today)]);
            sc.$destroy();
            el.remove();
            return {days, months};
        });

    T('D49 the built-in hints by default (a single box; a range\'s boxes, also with start-/end-placeholder="" as server-side templates write them); a given one shows; show-placeholder="false": none, the boxes still named',
        {single: {placeholder: 'Select a date', named: true}, range: {start: 'Start date', end: 'End date', named: [true, true]}, given: 'Day',
         none: {start: '', end: '', named: [true, true]}},
        async () => {
            const ph = el => el.getAttribute('placeholder') || '';
            const named = el => !!(el.getAttribute('aria-label') || '').trim();
            return {
                single: {placeholder: ph(box('p-limits')), named: named(box('p-limits'))},
                range: {start: ph(box('p-narrow', 0)), end: ph(box('p-narrow', 1)), named: [named(box('p-narrow', 0)), named(box('p-narrow', 1))]},
                given: ph(box('p-given')),
                none: {start: ph(box('p-nohint', 0)), end: ph(box('p-nohint', 1)), named: [named(box('p-nohint', 0)), named(box('p-nohint', 1))]}
            };
        });

    T('D18 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('aui-date-picker: core', tests);
})();
