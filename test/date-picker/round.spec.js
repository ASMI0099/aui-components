// aui-date-picker round suite (page: round.html, fixture: round.fixture.js): native forms (a
// named field's value in FormData, required, a reset), ranges over disabled days far away and over disabled months,
// quarters, years, an end-only range's time rule, an hour the rule turns off typed, a time range's duration past
// midnight, rules that throw, the api object replaced, the keyboard (shortcuts, Today, the month list, the next time
// column), screen-reader states, a digest's work, offsets typed, week text, time slots.
(function () {
    const {sleep, until} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const svc = name => angular.element(document.body).injector().get(name);
    const host = id => document.getElementById(id);
    const box = (id, i) => host(id).querySelectorAll('input.aui-date-picker__input')[i || 0];
    const panel = id => host(id).querySelector('.aui-date-picker__panel');
    const isOpen = id => panel(id).classList.contains('aui-select__panel--open');
    const key = (el, k, extra) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({key: k, code: k, bubbles: true, cancelable: true}, extra || {})));
    const ngModel = id => angular.element(host(id)).controller('ngModel');
    const dayIn = (id, k) => Array.from(panel(id).querySelectorAll('.aui-date-picker__day[data-day="' + k + '"]'))
        .find(b => !b.classList.contains('aui-date-picker__day--outside'));
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
        await sleep(80);
    }
    async function close(id) {
        if (!isOpen(id)) return;
        key(box(id, 0), 'Escape');
        await sleep(250);
        if (isOpen(id)) {
            key(box(id, 0), 'Escape');
            await sleep(250);
        }
        box(id, 0).blur();
        await sleep(50);
    }
    const formEntries = form => Array.from(new FormData(form).entries()).map(e => e[0] + '=' + e[1]);

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('DR1 a named field in a native form: its value in the form\'s data (a date, a range\'s two ends, each date), as the model holds it',
        {entries: ['day=2026-03-10', 'range=2026-03-10', 'range=2026-03-12', 'dates=2026-03-10', 'dates=2026-03-11', 'again=2026-03-10']},
        async () => ({entries: formEntries(host('native'))}));

    T('DR2 required: the browser\'s own check of the form stops at an empty required field (and passes once it has a value)',
        {empty: false, filled: true},
        async () => {
            const empty = host('needs').checkValidity();
            apply(s => { s.f.need = '2026-03-10'; });
            await sleep(30);
            const filled = host('needs').checkValidity();
            apply(s => { s.f.need = ''; });
            return {empty, filled};
        });

    T('DR3 a native reset of the form: the box shows the model\'s value again; the field left right after keeps the value',
        {shown: '2026-03-10', model: '2026-03-10', afterLeave: '2026-03-10'},
        async () => {
            box('r-reset', 0).focus();
            host('native').reset();
            box('r-reset', 0).blur();
            await sleep(60);
            return {shown: box('r-reset', 0).value, model: scope().f.reset, afterLeave: ngModel('r-reset').$modelValue};
        });

    T('DR4 range-crosses-disabled false: a range over a disabled day further than ten years off is invalid; months, quarters, years over a disabled one too',
        {far: true, months: true, quarters: true, years: true},
        async () => {
            await sleep(20);
            const err = id => !!ngModel(id).$error.rangeCrossesDisabled;
            return {far: err('r-far'), months: err('r-months'), quarters: err('r-quarters'), years: err('r-years')};
        });

    T('DR5 the end of a range set over a year after its start: a day past a disabled day far off cannot be picked',
        {disabled: true, model: ['2024-01-01', '2024-01-02']},
        async () => {
            await press('r-pickfar', 1);
            // 14 months on: March 2025 (2025-03-04 is off)
            for (let i = 0; i < 14; i += 1) {
                const next = panel('r-pickfar').querySelector('[data-act="next-month"]');
                next.click();
                await sleep(20);
            }
            await sleep(100);
            const cell = dayIn('r-pickfar', '2025-3-6');
            const disabled = !!cell && cell.getAttribute('aria-disabled') === 'true';
            if (cell) cell.click();
            await sleep(100);
            const model = scope().f.pickFar.slice();
            await close('r-pickfar');
            return {disabled, model};
        });

    T('DR6 a time range with only its end set: its end\'s time rule holds (18:15 off at the end: disabledTime, not only rangeIncomplete)',
        {disabledTime: true, incomplete: true},
        async () => ({disabledTime: !!ngModel('r-endonly').$error.disabledTime, incomplete: !!ngModel('r-endonly').$error.rangeIncomplete}));

    T('DR7 an hour the rule turns off as a whole (asked with the minute null): typed, it is refused as in the panel',
        {model: '', refused: true},
        async () => {
            type('r-hour', 0, '12:00:00');
            await enter('r-hour', 0);
            const out = {model: scope().f.hourOff, refused: !!ngModel('r-hour').$error.disabledTime};
            key(box('r-hour', 0), 'Escape');
            box('r-hour', 0).blur();
            await sleep(50);
            return out;
        });

    T('DR8 a time range is of one day: from 23:15 a +2 h chip is off (it passed midnight), +30 min is on',
        {chips: ['+2 h:off', '+30 min:on']},
        async () => {
            await press('r-night', 1);
            await sleep(100);
            const chips = Array.from(panel('r-night').querySelectorAll('.aui-date-picker__duration'))
                .map(b => b.textContent.trim().replace(/\s+/g, ' ') + ':' + (b.disabled ? 'off' : 'on'));
            await close('r-night');
            return {chips};
        });

    T('DR9 a rule that throws refuses (fail closed) and its error reaches $exceptionHandler: a day set and a time set are invalid',
        {day: true, time: true, reported: true},
        async () => {
            const before = window.__purposeErrors.length;
            apply(s => { s.f.throwsDay = '2026-01-03'; s.f.throwsTime = '13:12:11'; });
            await sleep(30);
            return {day: !!ngModel('r-failday').$error.disabledDate, time: !!ngModel('r-failtime').$error.disabledTime,
                reported: window.__purposeErrors.length > before};
        });

    T('DR10 the api object replaced: the old one no longer drives the field; destroyed, the new one is let go too',
        {oldSet: 'undefined', newSet: 'function', value: '2026-05-01'},
        async () => {
            const s = scope();
            apply(x => { x.useA = false; });
            await sleep(20);
            const out = {oldSet: typeof s.api.a.setValue, newSet: typeof s.api.b.setValue};
            s.api.b.setValue('2026-05-01');
            await sleep(30);
            out.value = s.f.apiDay;
            return out;
        });

    T('DR11 the keyboard reaches the shortcuts and Today (Tab stops), a time column\'s next column goes to an option that can be chosen',
        {shortcut: 0, today: 0, minute: true},
        async () => {
            await press('r-kbd', 0);
            const shortcut = panel('r-kbd').querySelector('.aui-date-picker__shortcut').tabIndex;
            const todayBtn = panel('r-kbd').querySelector('[data-act="today"]');
            const today = todayBtn ? todayBtn.tabIndex : null;
            await close('r-kbd');
            await press('r-zero', 0);
            const hour = panel('r-zero').querySelector('.aui-date-picker__column[data-unit="h"] .aui-date-picker__time[data-value="2"]') ||
                panel('r-zero').querySelector('.aui-date-picker__column[data-unit="h"] .aui-date-picker__time');
            hour.focus();
            key(hour, 'ArrowRight');
            await sleep(80);
            const now = document.activeElement;
            const minute = !!now && now.getAttribute('data-unit') === 'm' && !now.disabled;
            await close('r-zero');
            return {shortcut, today, minute};
        });

    T('DR12 the month list the title opens: one Tab stop, the arrows move in it, Enter chooses (the days of that month shown)',
        {stops: 1, moved: true, back: true},
        async () => {
            await press('r-kbd', 0);
            panel('r-kbd').querySelector('[data-act="month-view"]').click();
            await sleep(100);
            const cells = Array.from(panel('r-kbd').querySelectorAll('.aui-date-picker__cell'));
            const stops = cells.filter(c => c.tabIndex === 0).length;
            const start = cells.find(c => c.tabIndex === 0);
            start.focus();
            key(start, 'ArrowRight');
            await sleep(50);
            const moved = document.activeElement !== start && document.activeElement.classList.contains('aui-date-picker__cell');
            document.activeElement.click();
            await sleep(150);
            const back = !!panel('r-kbd').querySelector('.aui-date-picker__day');
            await close('r-kbd');
            return {stops, moved, back};
        });

    T('DR13 screen-reader states: dates grid multi-selectable; a range\'s preview is not selected; this month aria-current; months a listbox of options',
        {multi: 'true', previewSelected: 'false', current: 'date', roles: 'listbox/option'},
        async () => {
            await press('r-multi', 0);
            const multi = panel('r-multi').querySelector('table[role="grid"]').getAttribute('aria-multiselectable');
            await close('r-multi');
            await press('r-hover', 1);
            const target = dayIn('r-hover', '2026-2-20');
            target.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            await sleep(80);
            const previewSelected = target.parentNode.getAttribute('aria-selected');
            await close('r-hover');
            await press('r-month', 0);
            const now = new Date();
            const cell = panel('r-month').querySelector('.aui-date-picker__unit[data-y="' + now.getFullYear() + '"][data-m="' + (now.getMonth() + 1) + '"]');
            const current = cell ? cell.getAttribute('aria-current') : null;
            const roles = (cell ? cell.parentNode.getAttribute('role') : '') + '/' + (cell ? cell.getAttribute('role') : '');
            await close('r-month');
            return {multi, previewSelected, current, roles};
        });

    T('DR14 a required range: its end box required and described as its start box; a time range\'s columns grouped by their captions',
        {required: 'true', described: true, groups: ['Start time', 'End time']},
        async () => {
            const s0 = box('r-reqrange', 0), s1 = box('r-reqrange', 1);
            const out = {required: s1.getAttribute('aria-required'),
                described: !!s0.getAttribute('aria-describedby') && s1.getAttribute('aria-describedby') === s0.getAttribute('aria-describedby')};
            await press('r-times', 0);
            out.groups = Array.from(panel('r-times').querySelectorAll('.aui-date-picker__time-group[role="group"]')).map(g => {
                const label = document.getElementById(g.getAttribute('aria-labelledby'));
                return label ? label.textContent.trim() : '';
            });
            await close('r-times');
            return out;
        });

    T('DR15 a selected day outside the month shown: its number readable (4.5:1 or more on its fill)',
        {readable: true},
        async () => {
            await press('r-outside', 0);
            panel('r-outside').querySelector('[data-act="prev-month"]').click();
            await sleep(100);
            const cell = Array.from(panel('r-outside').querySelectorAll('.aui-date-picker__day--outside.aui-date-picker__day--selected'))[0];
            const span = cell ? cell.querySelector('span') : null;
            // rgb(), rgba() or color(srgb r g b / a) (a colour mixed from the tokens)
            const rgb = c => {
                const m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(c);
                if (m) return [m[1], m[2], m[3]].map(v => v * 255).concat(m[4] !== undefined ? [Number(m[4])] : []);
                return (/rgba?\(([^)]+)\)/.exec(c) || [0, '0,0,0'])[1].split(',').map(Number);
            };
            const lum = c => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
            let readable = false;
            if (span) {
                const cs = getComputedStyle(span);
                const fg = rgb(cs.color), bgRaw = rgb(cs.backgroundColor);
                const a = bgRaw.length > 3 ? bgRaw[3] : 1;
                const bg = bgRaw.slice(0, 3).map(x => x * a + 255 * (1 - a));
                const l1 = lum(fg), l2 = lum(bg);
                readable = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) >= 4.5;
            }
            await close('r-outside');
            return {readable};
        });

    T('DR16 an open calendar asks the page\'s rule once per day and digest (it asked twice), and a 300-date list is looked up, not searched per day',
        {once: true, lookups: true},
        async () => {
            await press('r-count', 0);
            const s = scope();
            s.calls.day = 0;
            s.$root.$digest();
            const once = s.calls.day > 0 && s.calls.day <= 45;
            await close('r-count');
            await press('r-many', 0);
            const E = svc('auiDateEngine');
            const own = E.compareDay;
            let n = 0;
            E.compareDay = function () { n += 1; return own.apply(this, arguments); };
            try {
                s.$root.$digest();
            } finally {
                E.compareDay = own;
            }
            await close('r-many');
            return {once, lookups: n < 2000};
        });

    T('DR17 a date-time typed with its own offset (Z, -05:00) is that instant (at utc-offset +00:00: 04:15 the next day)',
        {model: '2024-03-01 04:15:00'},
        async () => {
            type('r-offset', 0, '2024-02-29T23:15:00-05:00');
            await enter('r-offset', 0);
            const model = scope().f.offset;
            await close('r-offset');
            return {model};
        });

    T('DR18 an ISO week text is read whatever the week start; time slots: a whole day of minutes, and a reversed definition gives none',
        {week: true, slots: 1440, bad: 0},
        async () => {
            type('r-week', 0, '2026-W10');
            await enter('r-week', 0);
            const week = !!scope().f.week && !ngModel('r-week').$error.date;
            await close('r-week');
            await press('r-slots', 0);
            const slots = panel('r-slots').querySelectorAll('.aui-date-picker__column--slots .aui-date-picker__time').length;
            await close('r-slots');
            await press('r-badslots', 0);
            const bad = panel('r-badslots').querySelectorAll('.aui-date-picker__column--slots .aui-date-picker__time').length;
            await close('r-badslots');
            return {week, slots, bad};
        });

    T('DR19 a fixed date-time shortcut keeps its time (it was set to midnight)',
        {model: '2024-02-29 18:45:15'},
        async () => {
            await press('r-shortcut', 0);
            panel('r-shortcut').querySelector('.aui-date-picker__shortcut').click();
            await sleep(150);
            const model = scope().f.shortcuts;
            await close('r-shortcut');
            return {model};
        });

    T('DR20 forced colours: the keyboard\'s day has an outline in the highlight colour and the arrows a system colour (rules present)',
        {focus: true, arrows: true},
        async () => {
            let focus = false, arrows = false;
            for (const sheet of document.styleSheets) {
                let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
                for (const r of rules) {
                    if (!r.media || String(r.media.mediaText).indexOf('forced-colors') < 0) continue;
                    for (const inner of r.cssRules) {
                        const sel = inner.selectorText || '';
                        if (sel.indexOf('.aui-date-picker__day:focus-visible') >= 0 && /Highlight/i.test(inner.style.outline || inner.style.outlineColor)) focus = true;
                        if (sel.indexOf('.aui-date-picker__arrow::before') >= 0 && /ButtonText/i.test(inner.style.backgroundColor)) arrows = true;
                    }
                }
            }
            return {focus, arrows};
        });

    T('DR99 no Angular errors other than the ones thrown on purpose',
        {errors: []},
        async () => ({errors: window.__ngErrors.slice()}));

    AuiTest.run('aui-* family: aui-date-picker, round checks', tests);
})();
