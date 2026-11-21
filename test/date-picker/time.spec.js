// aui-date-picker time suite (page: time.html, fixture: time.fixture.js): datetime, datetimerange, time, timerange and
// aui-time-picker - the draft (a day and a time set, taken with OK, on a close, dropped with Escape), Now, the time
// columns (steps, 12 hours, limits, disabled-time, the keyboard), a range's ends, time slots, typing, timestamps,
// shortcuts to the second, and the digests picking costs the page.
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
    const dayIn = (id, k) => Array.from(panel(id).querySelectorAll('.aui-date-picker__day[data-day="' + k + '"]'))
        .find(b => !b.classList.contains('aui-date-picker__day--outside'));
    const key = (el, k, extra) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({key: k, code: k, bubbles: true, cancelable: true}, extra || {})));
    const digestsSince = t => window.__digests.filter(x => x >= t).length;
    const lastChange = name => scope().changes.filter(c => c[0] === name).pop();
    const option = (id, group, unit, value) => panel(id).querySelector('.aui-date-picker__time[data-group="' + group + '"][data-unit="' + unit +
        '"][data-value="' + value + '"]');
    const chosen = (id, group, unit) => {
        const el = panel(id).querySelector('.aui-date-picker__column[data-group="' + group + '"][data-unit="' + unit + '"] .aui-date-picker__time--selected');
        return el ? el.textContent.trim() : null;
    };
    const units = (id, group) => Array.from(panel(id).querySelectorAll('.aui-date-picker__column[data-group="' + (group || 0) + '"]'))
        .map(c => c.getAttribute('data-unit'));
    const act = (id, name, extra) => panel(id).querySelector('[data-act="' + name + '"]' + (extra || ''));
    const ok = id => act(id, 'ok');
    const ngModel = id => angular.element(host(id)).controller('ngModel');
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
        await sleep(250);
    }
    async function close(id) {
        for (let n = 0; n < 6 && isOpen(id); n += 1) {
            key(document.activeElement && host(id).contains(document.activeElement) ? document.activeElement : box(id), 'Escape');
            await sleep(300);
        }
    }
    async function click(el, wait) {
        el.click();
        await sleep(wait || 150);
    }
    async function outside() {
        document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true}));
        document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
        await sleep(350);
    }
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('T1 the page\'s values shown in their formats, none written back; aui-time-picker is the same field (type time)',
        {dt: '2026-11-06 14:30:00', dtr: ['2026-11-10 09:00:00', '2026-11-12 18:00:00'], t: '08:15', tr: ['09:00:00', '18:00:00'],
            d12: '2026-11-06 02:30 PM', alias: true, pristine: true},
        async () => {
            await sleep(100);
            return {dt: box('p-dt').value, dtr: [box('p-dtr', 0).value, box('p-dtr', 1).value], t: box('p-time').value,
                tr: [box('p-tr', 0).value, box('p-tr', 1).value], d12: box('p-12').value,
                alias: !!host('p-time').querySelector('.aui-date-picker.aui-date-picker--time'),
                pristine: scope().pageForm.$pristine};
        });

    T('T2 a date-time opens with its month and its time: hours, minutes, seconds chosen, each at the top of its column; Now and OK',
        {open: true, calendar: true, units: ['h', 'm', 's'], chosen: ['14', '30', '00'], atTop: true, now: true, ok: true},
        async () => {
            await press('p-dt');
            await sleep(200);
            const column = panel('p-dt').querySelector('.aui-date-picker__column[data-unit="h"]');
            const sel = column.querySelector('.aui-date-picker__time--selected');
            const r = {open: isOpen('p-dt'), calendar: !!dayIn('p-dt', '2026-11-6'), units: units('p-dt'),
                chosen: [chosen('p-dt', 0, 'h'), chosen('p-dt', 0, 'm'), chosen('p-dt', 0, 's')],
                atTop: Math.abs(column.scrollTop - (sel.offsetTop - column.firstElementChild.offsetTop)) <= 1 && column.scrollTop > 0,
                now: !!act('p-dt', 'now'), ok: !ok('p-dt').disabled};
            await close('p-dt');
            return r;
        });

    T('T3 a day and an hour set in the draft (the box shows it, the model waits), OK takes it: on-change with its timestamp (pick, by the user)',
        {draft: ['2026-11-12 14:30:00', '2026-11-12 09:30:00'], waited: '2026-11-06 14:30:00', open: true,
            model: '2026-11-12 09:30:00', change: ['dt', '2026-11-12 09:30:00', '2026-11-12 09:30:00', true, 'pick', true], closed: true, page: '2026-11-12 09:30:00'},
        async () => {
            await press('p-dt');
            await click(dayIn('p-dt', '2026-11-12'));
            const d1 = box('p-dt').value;
            await click(option('p-dt', 0, 'h', 9));
            const draft = [d1, box('p-dt').value];
            const waited = scope().f.dt;
            const open = isOpen('p-dt');
            await click(ok('p-dt'), 400);
            const c = lastChange('dt');
            return {draft, waited, open, model: scope().f.dt,
                change: [c[0], c[1], c[2], c[3] === AD().toTimestamp('2026-11-12 09:30:00'), c[4], c[5]],
                closed: !isOpen('p-dt'), page: document.getElementById('page-value').textContent.trim()};
        });

    T('T4 Escape drops the draft: the value and its text as they were',
        {model: '2026-11-12 09:30:00', text: '2026-11-12 09:30:00', closed: true},
        async () => {
            await press('p-dt');
            await click(dayIn('p-dt', '2026-11-20'));
            await click(option('p-dt', 0, 'm', 45));
            key(box('p-dt'), 'Escape');
            await sleep(300);
            return {model: scope().f.dt, text: box('p-dt').value, closed: !isOpen('p-dt')};
        });

    T('T5 a press outside takes a whole draft (commit-on-close); with commit-on-close="false" it is dropped',
        {kept: '2026-11-13 09:30:00', dropped: '2026-11-06 10:00:00', closed: [true, true]},
        async () => {
            await press('p-dt');
            await click(dayIn('p-dt', '2026-11-13'));
            await outside();
            const kept = scope().f.dt;
            const c1 = !isOpen('p-dt');
            await press('p-nc');
            await click(dayIn('p-nc', '2026-11-13'));
            await outside();
            return {kept, dropped: scope().f.nc, closed: [c1, !isOpen('p-nc')], text: undefined};
        });

    T('T6 Now takes this second (source now, by the user)',
        {near: true, source: 'now', byUser: true, closed: true},
        async () => {
            await press('p-dt');
            await click(act('p-dt', 'now'), 400);
            const c = lastChange('dt');
            return {near: Math.abs(AD().toTimestamp(scope().f.dt) - Date.now()) < 3000, source: c[4], byUser: c[5], closed: !isOpen('p-dt')};
        });

    T('T7 the keyboard in the columns: ArrowDown sets the next hour (the focus follows), ArrowRight moves to the minutes, End the last, Enter takes',
        {hour: '10', focusHour: true, minuteFocus: true, minute: '59', model: '2026-11-12 10:59:00', closed: true},
        async () => {
            apply(s => { s.f.dt = '2026-11-12 09:30:00'; });
            await press('p-dt');
            option('p-dt', 0, 'h', 9).focus();
            key(document.activeElement, 'ArrowDown');
            await sleep(200);
            const hour = chosen('p-dt', 0, 'h');
            const focusHour = document.activeElement === option('p-dt', 0, 'h', 10);
            key(document.activeElement, 'ArrowRight');
            await sleep(100);
            const minuteFocus = document.activeElement === option('p-dt', 0, 'm', 30);
            key(document.activeElement, 'End');
            await sleep(200);
            const minute = chosen('p-dt', 0, 'm');
            key(document.activeElement, 'Enter');
            await sleep(400);
            return {hour, focusHour, minuteFocus, minute, model: scope().f.dt, closed: !isOpen('p-dt')};
        });

    T('T8 a date-time range: two months, its ends above them; the start\'s day keeps its time and its time is set next (the start marked, its time tinted, Next); a later day picked straight away is the end, keeping the end\'s time; OK takes both',
        {calendars: 2, ends: 2, half: {start: '2026-11-15 09:00:00', end: '', button: 'Next: End time', disabled: false, activeStart: true, tinted: true,
            status: 'Set the start time, or choose the end date'},
            whole: {end: '2026-11-17 18:00:00', activeEnd: true}, set: '2026-11-17 20:00:00',
            model: ['2026-11-15 09:00:00', '2026-11-17 20:00:00'], change: [true, 2 * 86400000 + 11 * 3600000, 'pick', true]},
        async () => {
            await press('p-dtr');
            const calendars = panel('p-dtr').querySelectorAll('.aui-date-picker__calendar').length;
            const ends = panel('p-dtr').querySelectorAll('.aui-date-picker__end').length;
            await click(dayIn('p-dtr', '2026-11-15'));
            const half = {start: box('p-dtr', 0).value, end: box('p-dtr', 1).value, button: ok('p-dtr').textContent.trim(), disabled: ok('p-dtr').disabled,
                activeStart: act('p-dtr', 'end', '[data-end="0"]').classList.contains('aui-date-picker__end--active'),
                tinted: panel('p-dtr').querySelector('.aui-date-picker__clock').classList.contains('aui-date-picker__clock--step'),
                status: panel('p-dtr').querySelector('.aui-date-picker__status').textContent.trim()};
            await click(dayIn('p-dtr', '2026-11-17'));
            const whole = {end: box('p-dtr', 1).value,
                activeEnd: act('p-dtr', 'end', '[data-end="1"]').classList.contains('aui-date-picker__end--active')};
            await click(option('p-dtr', 1, 'h', 20));
            const set = box('p-dtr', 1).value;
            await click(ok('p-dtr'), 400);
            const c = lastChange('dtr');
            return {calendars, ends, half, whole, set, model: scope().f.dtr,
                change: [c[2][0] === AD().toTimestamp('2026-11-15 09:00:00'), c[3], c[4], c[5]]};
        });

    T('T9 a range\'s end cannot be set before its start: the end\'s hours before the start\'s disabled (a click on one changes nothing); the start tab: the start\'s hours after the end disabled',
        {endHours: {h7: true, h8: true, h9: false}, kept: '20', ok: true, problem: '', startHour: '09', startHours: {h20: false, h21: true}},
        async () => {
            await press('p-dtr');
            await click(dayIn('p-dtr', '2026-11-15'));
            await click(dayIn('p-dtr', '2026-11-15'));
            const endHours = {h7: option('p-dtr', 1, 'h', 7).disabled, h8: option('p-dtr', 1, 'h', 8).disabled, h9: option('p-dtr', 1, 'h', 9).disabled};
            await click(option('p-dtr', 1, 'h', 7));
            const kept = chosen('p-dtr', 1, 'h');
            const okEnabled = !ok('p-dtr').disabled;
            const problem = panel('p-dtr').querySelector('.aui-date-picker__problem').textContent.trim();
            await click(act('p-dtr', 'end', '[data-end="0"]'));
            const startHour = chosen('p-dtr', 0, 'h');
            const startHours = {h20: option('p-dtr', 0, 'h', 20).disabled, h21: option('p-dtr', 0, 'h', 21).disabled};
            await close('p-dtr');
            return {endHours, kept, ok: okEnabled, problem, startHour, startHours};
        });

    T('T10 Escape with a range half picked undoes the first day only; the next closes, the value kept',
        {open: true, start: '2026-11-15 09:00:00', closed: true, model: ['2026-11-15 09:00:00', '2026-11-17 20:00:00']},
        async () => {
            await press('p-dtr');
            await click(dayIn('p-dtr', '2026-11-25'));
            key(box('p-dtr'), 'Escape');
            await sleep(200);
            const open = isOpen('p-dtr');
            const start = box('p-dtr', 0).value;
            key(box('p-dtr'), 'Escape');
            await sleep(300);
            return {open, start, closed: !isOpen('p-dtr'), model: scope().f.dtr};
        });

    T('T11 start-model / end-model with format HH:mm: the days\' default times (00:00:00, 23:59:59), the form valid',
        {invalidBefore: true, start: '00:00:00', end: '23:59:59', shown: [16, 16], valid: true},
        async () => {
            const invalidBefore = !!scope().pageForm.promo.$error.required;
            await press('p-promo');
            const days = Array.from(panel('p-promo').querySelectorAll('.aui-date-picker__calendar:first-child .aui-date-picker__day:not(.aui-date-picker__day--outside):not(.aui-date-picker__day--disabled)'));
            await click(days[2]);
            await click(days[4]);
            await click(ok('p-promo'), 400);
            const f = scope().f;
            return {invalidBefore, start: f.ps && f.ps.slice(-8), end: f.pe && f.pe.slice(-8),
                shown: [box('p-promo', 0).value.length, box('p-promo', 1).value.length], valid: scope().pageForm.promo.$valid};
        });

    T('T12 typing: a date-time without seconds taken on Enter (closed); typed while open, the month and the columns follow, Enter takes it',
        {closed: '2026-11-20 07:05:00', follow: {hour: '08', minute: '00', day: true}, taken: '2026-11-21 08:00:00', isClosed: true},
        async () => {
            type('p-dt', 0, '2026-11-20 7:05');
            await enter('p-dt', 0);
            await close('p-dt');
            const closedModel = scope().f.dt;
            await press('p-dt');
            type('p-dt', 0, '2026-11-21 08:00:00');
            await sleep(150);
            const follow = {hour: chosen('p-dt', 0, 'h'), minute: chosen('p-dt', 0, 'm'),
                day: dayIn('p-dt', '2026-11-21').classList.contains('aui-date-picker__day--selected')};
            await enter('p-dt', 0);
            return {closed: closedModel, follow, taken: scope().f.dt, isClosed: !isOpen('p-dt')};
        });

    T('T13 a typed text that is not a date-time: the value kept, the field invalid (date) until fixed',
        {model: '2026-11-21 08:00:00', error: true, fixed: false},
        async () => {
            type('p-dt', 0, '2026-11-31 10:00');
            await enter('p-dt', 0);
            await close('p-dt');
            const error = !!ngModel('p-dt').$error.date;
            const model = scope().f.dt;
            type('p-dt', 0, '2026-11-30 10:00');
            await enter('p-dt', 0);
            await close('p-dt');
            return {model, error, fixed: !!ngModel('p-dt').$error.date};
        });

    T('T14 aui-time-picker HH:mm, minute-step 15: no calendar, hours and minutes (00 15 30 45); a minute set, OK: the text, no timestamp',
        {calendar: false, units: ['h', 'm'], minutes: ['00', '15', '30', '45'], box: '08:45', model: '08:45', change: ['08:45', null, 'pick']},
        async () => {
            await press('p-time');
            const r = {calendar: !!panel('p-time').querySelector('.aui-date-picker__calendar'), units: units('p-time'),
                minutes: Array.from(panel('p-time').querySelectorAll('.aui-date-picker__column[data-unit="m"] .aui-date-picker__time')).map(b => b.textContent.trim())};
            await click(option('p-time', 0, 'm', 45));
            r.box = box('p-time').value;
            await click(ok('p-time'), 400);
            r.model = scope().f.t;
            const c = lastChange('t');
            r.change = [c[2], c[3], c[4]];
            return r;
        });

    T('T15 a time range: two groups (start, end); both set, OK takes them; an end before its start cannot be set (its hours disabled)',
        {titles: ['Start time', 'End time'], model: ['10:00:00', '17:00:00'], blocked: {h8: true, h10: false}, kept: '17'},
        async () => {
            await press('p-tr');
            const titles = Array.from(panel('p-tr').querySelectorAll('.aui-date-picker__time-title')).map(t => t.textContent.trim());
            await click(option('p-tr', 0, 'h', 10));
            await click(option('p-tr', 1, 'h', 17));
            await click(ok('p-tr'), 400);
            const model = scope().f.tr;
            await press('p-tr');
            const blocked = {h8: option('p-tr', 1, 'h', 8).disabled, h10: option('p-tr', 1, 'h', 10).disabled};
            await click(option('p-tr', 1, 'h', 8));
            const kept = chosen('p-tr', 1, 'h');
            await close('p-tr');
            return {titles, model, blocked, kept};
        });

    T('T16 12 hours (hh:mm A): hours 12, 01 ... 11 and AM / PM; AM set moves 14:30 to 02:30; the value in 24 hours',
        {hours: ['12', '01', '11'], units: ['h', 'm', 'a'], chosen: ['02', 'PM'], box: '2026-11-06 02:30 AM', model: '2026-11-06 02:30:00'},
        async () => {
            await press('p-12');
            const list = Array.from(panel('p-12').querySelectorAll('.aui-date-picker__column[data-unit="h"] .aui-date-picker__time')).map(b => b.textContent.trim());
            const r = {hours: [list[0], list[1], list[11]], units: units('p-12'), chosen: [chosen('p-12', 0, 'h'), chosen('p-12', 0, 'a')]};
            await click(option('p-12', 0, 'a', 0));
            r.box = box('p-12').value;
            await click(ok('p-12'), 400);
            r.model = scope().f.d12;
            return r;
        });

    T('T17 time-slots 09:00-12:00/30m: one list of seven times; a pick takes it and closes',
        {slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'], model: '10:30', closed: true, footer: false},
        async () => {
            await press('p-slots');
            const slots = Array.from(panel('p-slots').querySelectorAll('.aui-date-picker__column--slots .aui-date-picker__time')).map(b => b.textContent.trim());
            const footer = !!panel('p-slots').querySelector('.aui-date-picker__ok');
            await click(panel('p-slots').querySelector('.aui-date-picker__column--slots .aui-date-picker__time[data-index="3"]'), 400);
            return {slots, model: scope().f.slot, closed: !isOpen('p-slots'), footer};
        });

    T('T18 min / max to the minute and disabled-time: the hours and minutes outside them disabled; a draft outside them cannot be taken',
        {opensAt: true, hours: {h8: true, h9: false, h12: true}, problem: 'Outside the allowed times', minutes: {m15: true, m30: false}, ok: true},
        async () => {
            await press('p-lim');
            const opensAt = !!dayIn('p-lim', '2026-11-10');
            await click(dayIn('p-lim', '2026-11-10'));
            const hours = {h8: option('p-lim', 0, 'h', 8).disabled, h9: option('p-lim', 0, 'h', 9).disabled, h12: option('p-lim', 0, 'h', 12).disabled};
            const problem = panel('p-lim').querySelector('.aui-date-picker__problem').textContent.trim();
            await click(option('p-lim', 0, 'h', 9));
            const minutes = {m15: option('p-lim', 0, 'm', 15).disabled, m30: option('p-lim', 0, 'm', 30).disabled};
            await click(option('p-lim', 0, 'm', 30));
            const r = {opensAt, hours, problem, minutes, ok: !ok('p-lim').disabled};
            await close('p-lim');
            return r;
        });

    T('T19 the checks of a date-time\'s value: min to the second, disabled-time; a value inside them valid',
        {min: true, disabledTime: true, valid: true},
        async () => {
            apply(s => { s.f.lim = '2026-11-10 09:00:00'; });
            const min = !!scope().pageForm.lim.$error.min;
            apply(s => { s.f.lim = '2026-11-12 12:30:00'; });
            const disabledTime = !!scope().pageForm.lim.$error.disabledTime;
            apply(s => { s.f.lim = '2026-11-12 13:00:00'; });
            return {min, disabledTime, valid: scope().pageForm.lim.$valid};
        });

    T('T20 value-type timestamp: a date-time picked is its milliseconds',
        {model: true},
        async () => {
            await press('p-stamp');
            const first = panel('p-stamp').querySelectorAll('.aui-date-picker__calendar .aui-date-picker__day:not(.aui-date-picker__day--outside)')[9];
            const k = first.getAttribute('data-day').split('-').map(Number);
            await click(first);
            await click(option('p-stamp', 0, 'h', 15));
            await click(ok('p-stamp'), 400);
            const p = k[0] + '-' + String(k[1]).padStart(2, '0') + '-' + String(k[2]).padStart(2, '0') + ' 15:00:00';
            return {model: scope().f.stamp === AD().toTimestamp(p)};
        });

    T('T21 format HH:mm in a range: the start\'s seconds 00, the end\'s 59 (typed, the panel closed)',
        {model: ['2026-11-01 08:00:00', '2026-11-02 18:30:59']},
        async () => {
            type('p-hm', 0, '2026-11-01 08:00');
            await enter('p-hm', 0);
            await close('p-hm');
            type('p-hm', 1, '2026-11-02 18:30');
            await enter('p-hm', 1);
            await close('p-hm');
            return {model: scope().f.hm};
        });

    T('T22 picking costs the page nothing until the value is taken: open, a day, an hour, a minute (0 page digests); OK at most 2',
        {picking: {open: 0, day: 0, hour: 0, minute: 0}, ok: true, model: '2026-11-14 11:15:00'},
        async () => {
            apply(s => { s.f.dt = '2026-11-12 09:30:00'; });
            // the field focused before (its leaving marks it touched: a page digest of its own) left first
            if (document.activeElement) document.activeElement.blur();
            await sleep(450);
            const picking = {};
            const step = async (name, fn) => {
                const t = performance.now();
                await fn();
                picking[name] = digestsSince(t);
            };
            await step('open', () => press('p-dt'));
            await step('day', () => click(dayIn('p-dt', '2026-11-14')));
            await step('hour', () => click(option('p-dt', 0, 'h', 11)));
            await step('minute', () => click(option('p-dt', 0, 'm', 15)));
            const t1 = performance.now();
            await click(ok('p-dt'), 500);
            const n = digestsSince(t1);
            return {picking, ok: n >= 1 && n <= 2, model: scope().f.dt};
        });

    T('T23 date-time range shortcuts: Last 24 hours to the minute shown (its end :59), Today from 00:00:00 to 23:59:59',
        {labels: ['Last 24 hours', 'Today'], last24: true, today: ['00:00:00', '23:59:59'], sameDay: true},
        async () => {
            await press('p-promo');
            const items = Array.from(panel('p-promo').querySelectorAll('.aui-date-picker__shortcut'));
            const labels = items.slice(0, 2).map(b => b.textContent.trim());
            await click(items[0], 400);
            const f = scope().f;
            const span = AD().toTimestamp(f.pe) - AD().toTimestamp(f.ps);
            const last24 = span >= 86400000 && span < 86400000 + 60000 && Math.abs(AD().toTimestamp(f.pe) - Date.now()) < 60000;
            await press('p-promo');
            await click(panel('p-promo').querySelectorAll('.aui-date-picker__shortcut')[1], 400);
            return {labels, last24, today: [f.ps.slice(-8), f.pe.slice(-8)], sameDay: f.ps.slice(0, 10) === f.pe.slice(0, 10) && f.ps.slice(0, 10) === AD().today()};
        });

    T('T25 an empty time range: no option chosen, OK disabled; the first hour set gives its minutes and seconds 00',
        {chosen: 0, okDisabled: true, end: '17:00:00', model: ['09:00:00', '17:00:00']},
        async () => {
            apply(s => { s.f.tr = null; });
            await press('p-tr');
            const chosenCount = panel('p-tr').querySelectorAll('.aui-date-picker__time--selected').length;
            const okDisabled = ok('p-tr').disabled;
            await click(option('p-tr', 1, 'h', 17));
            const end = box('p-tr', 1).value;
            await click(option('p-tr', 0, 'h', 9));
            await click(ok('p-tr'), 400);
            return {chosen: chosenCount, okDisabled, end, model: scope().f.tr};
        });

    T('T26 a date-time range typed: Enter in the start box moves to the end box (still open, the end marked), Enter there takes both',
        {moved: true, open: true, endMarked: true, model: ['2026-11-03 10:00:00', '2026-11-05 12:00:00'], closed: true},
        async () => {
            apply(s => { s.f.dtr = null; });
            await press('p-dtr');
            type('p-dtr', 0, '2026-11-03 10:00');
            await enter('p-dtr', 0);
            const moved = document.activeElement === box('p-dtr', 1);
            const open = isOpen('p-dtr');
            const endMarked = act('p-dtr', 'end', '[data-end="1"]').classList.contains('aui-date-picker__end--active');
            type('p-dtr', 1, '2026-11-05 12:00:00');
            await enter('p-dtr', 1);
            return {moved, open, endMarked, model: scope().f.dtr, closed: !isOpen('p-dtr')};
        });

    T('T27 a time column ends at its last option (no empty room after it); its last hour chosen: scrolled to the end, in view',
        {ends: true, atEnd: true, inView: true},
        async () => {
            apply(s => { s.f.dt = '2026-11-12 23:30:00'; });
            await press('p-dt');
            await sleep(200);
            const col = panel('p-dt').querySelector('.aui-date-picker__column[data-unit="h"]');
            const items = col.querySelectorAll('.aui-date-picker__time');
            const last = items[items.length - 1];
            const pad = parseFloat(getComputedStyle(col).paddingBottom) || 0;
            const ends = Math.abs(col.scrollHeight - (last.offsetTop + last.offsetHeight + pad)) <= 1;
            const atEnd = Math.abs(col.scrollTop - (col.scrollHeight - col.clientHeight)) <= 1;
            const chosen = col.querySelector('.aui-date-picker__time--selected');
            const inView = chosen.offsetTop - col.scrollTop >= 0 && chosen.offsetTop + chosen.offsetHeight - col.scrollTop <= col.clientHeight;
            await close('p-dt');
            return {ends, atEnd, inView};
        });

    T('T28 max-range 7d on a date-time range (HH:mm): the days past it cannot end it; a day picked moves its time into it; a day before the start is a new start; never too long',
        {fwd: {d17: false, d18: true}, end: '2026-11-17 08:30', hours: {h8: false, h9: true}, ok: true,
            back: {d12: false, d20: false, d21: true}, boxes: ['2026-11-13 08:30', '2026-11-20 08:30'], model: ['2026-11-13 08:30:00', '2026-11-20 08:30:59']},
        async () => {
            const off = k => dayIn('p-dmax', k).classList.contains('aui-date-picker__day--disabled');
            await press('p-dmax');
            await click(dayIn('p-dmax', '2026-11-10'));
            const fwd = {d17: off('2026-11-17'), d18: off('2026-11-18')};
            await click(dayIn('p-dmax', '2026-11-17'));
            const end = box('p-dmax', 1).value;
            const hours = {h8: option('p-dmax', 1, 'h', 8).disabled, h9: option('p-dmax', 1, 'h', 9).disabled};
            const okEnabled = !ok('p-dmax').disabled;
            await close('p-dmax');
            await press('p-dmax');
            await click(dayIn('p-dmax', '2026-11-20'));
            await click(dayIn('p-dmax', '2026-11-13'));
            const back = {d12: off('2026-11-12'), d20: off('2026-11-20'), d21: off('2026-11-21')};
            await click(dayIn('p-dmax', '2026-11-20'));
            const boxes = [box('p-dmax', 0).value, box('p-dmax', 1).value];
            await click(ok('p-dmax'), 400);
            return {fwd, end, hours, ok: okEnabled, back, boxes, model: scope().f.dmax};
        });

    T('T29 boundary="end" on one date-time (HH:mm): a time set is kept for another day (its hidden seconds 59); on an empty field a picked day is at its end (23:59:59); a day typed without a time too',
        {kept: '2026-11-15 18:00:59', picked: {box: '2026-11-14 23:59', model: '2026-11-14 23:59:59'}, typed: '2026-11-20 23:59:59'},
        async () => {
            await press('p-dend');
            await click(dayIn('p-dend', '2026-11-15'));
            await click(ok('p-dend'), 400);
            const kept = scope().f.dend;
            apply(sc => { sc.f.dend = null; });
            await press('p-dend');
            await click(dayIn('p-dend', '2026-11-14'));
            const pickedBox = box('p-dend').value;
            await click(ok('p-dend'), 400);
            const picked = {box: pickedBox, model: scope().f.dend};
            type('p-dend', 0, '2026-11-20');
            await enter('p-dend', 0);
            await close('p-dend');
            return {kept, picked, typed: scope().f.dend};
        });

    T('T30 a date-time range: the pick under the pointer shown in its End above the months too (muted); a time changed while the pointer rests on the day: the tip and the End follow; the pointer off the days: the End as set',
        {hover: {end: '2026-11-20 18:00:00', muted: true, tip: '10 days 9 h'}, timed: {end: '2026-11-20 19:00:00', tip: '10 days 10 h'},
            off: {end: '2026-11-12 19:00:00', muted: false, tip: null}},
        async () => {
            apply(s => { s.f.dtr = ['2026-11-10 09:00:00', '2026-11-12 18:00:00']; });
            await press('p-dtr', 1);
            const endTab = () => panel('p-dtr').querySelectorAll('.aui-date-picker__end-value')[1];
            const tipText = () => { const t = panel('p-dtr').querySelector('.aui-date-picker__tip'); return t ? t.textContent.trim() : null; };
            dayIn('p-dtr', '2026-11-20').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            await sleep(200);
            const hover = {end: endTab().textContent.trim(), muted: endTab().classList.contains('aui-date-picker__end-value--preview'), tip: tipText()};
            option('p-dtr', 1, 'h', 18).focus();
            key(document.activeElement, 'ArrowDown');
            await sleep(250);
            const timed = {end: endTab().textContent.trim(), tip: tipText()};
            option('p-dtr', 1, 'h', 19).dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            await sleep(200);
            const off = {end: endTab().textContent.trim(), muted: endTab().classList.contains('aui-date-picker__end-value--preview'), tip: tipText()};
            await close('p-dtr');
            return {hover, timed, off};
        });

    T('T31 a date-time range set end by end: the start\'s day, then its time (00:00:00 there, tinted), Next; the end\'s day, then its time (23:59:59 there, tinted), OK; Escape goes back step by step (the start\'s time again after Next)',
        {start: {group: 0, hour: '00', tinted: true, active: 0, button: 'Next: End time'}, startTime: '2026-11-15 10:00:00',
            next: {active: 1, tinted: false, status: 'Choose the end date', button: 'OK', disabled: true},
            end: {group: 1, value: '2026-11-20 23:59:59', tinted: true, button: 'OK', disabled: false},
            back: {afterOne: {active: 1, end: '', tinted: false}, afterTwo: {active: 0, tinted: true, button: 'Next: End time'}},
            model: ['2026-11-15 10:00:00', '2026-11-20 22:59:59']},
        async () => {
            apply(s => { s.f.dtr = null; });
            await sleep(100);
            await press('p-dtr', 0);
            const clock = () => panel('p-dtr').querySelector('.aui-date-picker__clock');
            const tinted = () => clock().classList.contains('aui-date-picker__clock--step');
            const active = () => (act('p-dtr', 'end', '[data-end="1"]').classList.contains('aui-date-picker__end--active') ? 1 : 0);
            const group = () => Number(clock().querySelector('.aui-date-picker__column').getAttribute('data-group'));
            const status = () => panel('p-dtr').querySelector('.aui-date-picker__status').textContent.trim();
            await click(dayIn('p-dtr', '2026-11-15'));
            const start = {group: group(), hour: chosen('p-dtr', 0, 'h'), tinted: tinted(), active: active(), button: ok('p-dtr').textContent.trim()};
            await click(option('p-dtr', 0, 'h', 10));
            const startTime = box('p-dtr', 0).value;
            await click(ok('p-dtr'));
            const next = {active: active(), tinted: tinted(), status: status(), button: ok('p-dtr').textContent.trim(), disabled: ok('p-dtr').disabled};
            await click(dayIn('p-dtr', '2026-11-20'));
            const end = {group: group(), value: box('p-dtr', 1).value, tinted: tinted(), button: ok('p-dtr').textContent.trim(), disabled: ok('p-dtr').disabled};
            key(document.activeElement, 'Escape');
            await sleep(250);
            const afterOne = {active: active(), end: box('p-dtr', 1).value, tinted: tinted()};
            key(document.activeElement, 'Escape');
            await sleep(250);
            const afterTwo = {active: active(), tinted: tinted(), button: ok('p-dtr').textContent.trim()};
            // on again: Next, the end's day, its hour 22, OK
            await click(ok('p-dtr'));
            await click(dayIn('p-dtr', '2026-11-20'));
            await click(option('p-dtr', 1, 'h', 22));
            await click(ok('p-dtr'), 400);
            return {start, startTime, next, end, back: {afterOne, afterTwo}, model: scope().f.dtr};
        });

    T('T32 the keyboard through a date-time range: Enter on a day moves on to its time; Enter there is Next (back to the days), then on the end\'s day to its time, then OK',
        {startToTime: true, nextToDays: true, endToTime: true, closed: true, times: ['00:00:00', '23:59:59'], days: 1},
        async () => {
            apply(s => { s.f.dtr = null; });
            await sleep(100);
            await press('p-dtr', 0);
            const isTime = group => !!document.activeElement && document.activeElement.classList.contains('aui-date-picker__time') &&
                document.activeElement.getAttribute('data-group') === String(group);
            key(box('p-dtr', 0), 'ArrowDown');
            await sleep(250);
            key(document.activeElement, 'Enter');
            await sleep(250);
            const startToTime = isTime(0);
            key(document.activeElement, 'Enter');
            await sleep(250);
            const nextToDays = !!document.activeElement && document.activeElement.classList.contains('aui-date-picker__day');
            key(document.activeElement, 'ArrowRight');
            await sleep(200);
            key(document.activeElement, 'Enter');
            await sleep(250);
            const endToTime = isTime(1);
            key(document.activeElement, 'Enter');
            await sleep(400);
            const v = scope().f.dtr || ['', ''];
            const day = t => AD().toTimestamp(String(t).slice(0, 10) + ' 00:00:00');
            return {startToTime, nextToDays, endToTime, closed: !isOpen('p-dtr'), times: [String(v[0]).slice(11), String(v[1]).slice(11)],
                days: Math.round((day(v[1]) - day(v[0])) / 86400000)};
        });

    T('T33 one date-time: after its day, its time is next - the columns tinted (a glow); the keyboard (Enter on a day) moves on to them',
        {tinted: true, keysToTime: true},
        async () => {
            apply(s => { s.f.dt = '2026-11-06 14:30:00'; });
            await press('p-dt');
            await click(dayIn('p-dt', '2026-11-18'));
            const tinted = panel('p-dt').querySelector('.aui-date-picker__clock').classList.contains('aui-date-picker__clock--step');
            await close('p-dt');
            await press('p-dt');
            key(box('p-dt'), 'ArrowDown');
            await sleep(250);
            key(document.activeElement, 'Enter');
            await sleep(250);
            const keysToTime = !!document.activeElement && document.activeElement.classList.contains('aui-date-picker__time');
            await close('p-dt');
            return {tinted, keysToTime};
        });

    T('T34 default-time: a day picked in an empty date-time takes it (09:15:00); the first column set fills the others from it; a range: its start and end times (08:00:00, 20:00:00)',
        {one: true, column: true, range: [true, true]},
        async () => {
            const dayOfView = (id, d) => Array.from(panel(id).querySelectorAll('.aui-date-picker__day:not(.aui-date-picker__day--outside):not(.aui-date-picker__day--hidden)'))
                .find(b => Number(b.getAttribute('data-day').split('-')[2]) === d);
            apply(s => { s.f.deft = ''; });
            await press('p-deft');
            await click(dayOfView('p-deft', 12));
            await click(ok('p-deft'), 400);
            const one = / 09:15:00$/.test(scope().f.deft);
            apply(s => { s.f.deft = ''; });
            await press('p-deft');
            await click(option('p-deft', 0, 'h', 10));
            const column = / 10:15:00$/.test(box('p-deft').value);
            await close('p-deft');
            await press('p-defr', 0);
            await click(dayOfView('p-defr', 10));
            await click(dayOfView('p-defr', 12));
            await click(ok('p-defr'), 400);
            const v = scope().f.defr || [];
            return {one, column, range: [/ 08:00:00$/.test(v[0]), / 20:00:00$/.test(v[1])]};
        });

    T('T35 a time typed in digits with a one-digit hour: 930 is 09:30 (a time), 2026-11-08 930 is 09:30 (a date-time)',
        {time: '09:30', dt: '2026-11-08 09:30:00'},
        async () => {
            apply(s => { s.f.t = ''; s.f.dt = '2026-11-06 14:30:00'; });
            await sleep(80);
            type('p-time', 0, '930');
            await enter('p-time', 0);
            await close('p-time');
            type('p-dt', 0, '2026-11-08 930');
            await enter('p-dt', 0);
            await close('p-dt');
            return {time: scope().f.t, dt: scope().f.dt};
        });

    T('T36 a 12-hour time typed without AM / PM keeps the half of the day of the time it replaces (an afternoon stays one; a morning, or none, is AM)',
        {pm: '2026-11-07 16:00:00', am: '2026-11-07 04:00:00', given: '2026-11-07 04:00:00'},
        async () => {
            apply(s => { s.f.d12 = '2026-11-06 15:00:00'; });
            await sleep(80);
            type('p-12', 0, '2026-11-07 04:00');
            await enter('p-12', 0);
            await close('p-12');
            const pm = scope().f.d12;
            apply(s => { s.f.d12 = '2026-11-06 09:00:00'; });
            await sleep(80);
            type('p-12', 0, '2026-11-07 04:00');
            await enter('p-12', 0);
            await close('p-12');
            const am = scope().f.d12;
            apply(s => { s.f.d12 = '2026-11-06 15:00:00'; });
            await sleep(80);
            type('p-12', 0, '2026-11-07 04:00 am');
            await enter('p-12', 0);
            await close('p-12');
            return {pm, am, given: scope().f.d12};
        });

    T('T37 a range open on its end, switched to its start (the Start tab, its box, Tab) and back: the days follow the end chosen - its month in view, the start on the left, the end on the right; both ends in view: the view stays',
        {open: ['2045-11', '2045-12'], startTab: ['2026-11', '2026-12'], endBox: ['2045-11', '2045-12'], tabToStart: ['2026-11', '2026-12'],
            near: ['2026-11', '2026-12'], nearStart: ['2026-11', '2026-12'], model: ['2026-11-10 16:17:17', '2045-12-31 23:59:59']},
        async () => {
            const months = () => Array.from(panel('p-dtr').querySelectorAll('.aui-date-picker__calendar')).map(c => {
                const d = c.querySelector('.aui-date-picker__day:not(.aui-date-picker__day--outside)');
                const k = d ? d.getAttribute('data-day').split('-') : [];
                return k[0] + '-' + ('0' + k[1]).slice(-2);
            });
            apply(s => { s.f.dtr = ['2026-11-10 16:17:17', '2045-12-31 23:59:59']; });
            await sleep(80);
            await press('p-dtr', 1);
            const open = months();
            act('p-dtr', 'end', '[data-end="0"]').click();
            await sleep(200);
            const startTab = months();
            await press('p-dtr', 1);
            const endBox = months();
            box('p-dtr', 0).focus();
            await sleep(200);
            const tabToStart = months();
            await close('p-dtr');
            const model = scope().f.dtr.slice();
            apply(s => { s.f.dtr = ['2026-11-10 16:17:17', '2026-12-05 18:00:00']; });
            await sleep(80);
            await press('p-dtr', 1);
            const near = months();
            act('p-dtr', 'end', '[data-end="0"]').click();
            await sleep(200);
            const nearStart = months();
            await close('p-dtr');
            box('p-dtr', 0).blur();
            return {open, startTab, endBox, tabToStart, near, nearStart, model};
        });

    T('T38 a date-time range set from its end first: the end\'s day, then its time (outlined, Set the end time, Next); a later day a new end; Next on to the start; its day, then OK. A day before the end\'s in its time step: the start, picked straight away',
        {end: {group: 1, hour: '23', tinted: true, active: 1, status: 'Set the end time, or choose the start date', button: 'Next: Start time', disabled: false},
            endTime: '2026-11-20 18:59:59', newEnd: {end: '2026-11-22 18:59:59', active: 1, tinted: true},
            next: {active: 0, tinted: false, status: 'Choose the start date', button: 'OK', disabled: true},
            start: {active: 0, tinted: true, button: 'OK', disabled: false}, model: ['2026-11-15 00:00:00', '2026-11-22 18:59:59'],
            fast: {active: 0, start: '2026-11-12 00:00:00', end: '2026-11-20 23:59:59', tinted: true, button: 'OK'}, fastModel: ['2026-11-12 00:00:00', '2026-11-20 23:59:59']},
        async () => {
            const clock = () => panel('p-dtr').querySelector('.aui-date-picker__clock');
            const tinted = () => clock().classList.contains('aui-date-picker__clock--step');
            const active = () => (act('p-dtr', 'end', '[data-end="1"]').classList.contains('aui-date-picker__end--active') ? 1 : 0);
            const group = () => Number(clock().querySelector('.aui-date-picker__column').getAttribute('data-group'));
            const status = () => panel('p-dtr').querySelector('.aui-date-picker__status').textContent.trim();
            apply(s => { s.f.dtr = null; });
            await sleep(100);
            await press('p-dtr', 1);
            await click(dayIn('p-dtr', '2026-11-20'));
            const end = {group: group(), hour: chosen('p-dtr', 1, 'h'), tinted: tinted(), active: active(), status: status(),
                button: ok('p-dtr').textContent.trim(), disabled: ok('p-dtr').disabled};
            await click(option('p-dtr', 1, 'h', 18));
            const endTime = box('p-dtr', 1).value;
            await click(dayIn('p-dtr', '2026-11-22'));
            const newEnd = {end: box('p-dtr', 1).value, active: active(), tinted: tinted()};
            await click(ok('p-dtr'));
            const next = {active: active(), tinted: tinted(), status: status(), button: ok('p-dtr').textContent.trim(), disabled: ok('p-dtr').disabled};
            await click(dayIn('p-dtr', '2026-11-15'));
            const start = {active: active(), tinted: tinted(), button: ok('p-dtr').textContent.trim(), disabled: ok('p-dtr').disabled};
            await click(ok('p-dtr'), 400);
            const model = scope().f.dtr;
            // the start picked straight away in the end's time step
            apply(s => { s.f.dtr = null; });
            await sleep(100);
            await press('p-dtr', 1);
            await click(dayIn('p-dtr', '2026-11-20'));
            await click(dayIn('p-dtr', '2026-11-12'));
            const fast = {active: active(), start: box('p-dtr', 0).value, end: box('p-dtr', 1).value, tinted: tinted(), button: ok('p-dtr').textContent.trim()};
            await click(ok('p-dtr'), 400);
            const fastModel = scope().f.dtr;
            box('p-dtr', 1).blur();
            return {end, endTime, newEnd, next, start, model, fast, fastModel};
        });

    T('T39 a form whose server sends seconds (read-seconds, limits-new-only, min today): the server\'s seconds shown and replaced by the text quietly (pristine, no on-change); the saved past start valid; a past day not pickable, a past day typed refused; a new end picked, OK: the past start kept, valid',
        {models: ['2026-11-01 08:00:00', '2026-12-31 23:59:59'], quiet: {pristine: true, changes: 0, valid: true},
            pastDay: 'true', typed: {start: '2026-11-01 08:00:00', refused: true},
            taken: {models: ['2026-11-01 08:00:00', '2026-12-20 23:59:59'], valid: true},
            single: {number: true, digits: true}},
        async () => {
            const sec = text => AD().toTimestamp(text) / 1000;
            const ngm = () => angular.element(host('p-plat').querySelector('.aui-date-picker__mirror')).controller('ngModel');
            const before = scope().changes.filter(c => c[0] === 'plat').length;
            apply(s => { s.f.ps2 = sec('2026-11-01 08:00:00'); s.f.pe2 = sec('2026-12-31 23:59:59'); });
            await sleep(150);
            const models = [scope().f.ps2, scope().f.pe2];
            const quiet = {pristine: ngm().$pristine, changes: scope().changes.filter(c => c[0] === 'plat').length - before, valid: ngm().$valid};
            await press('p-plat', 0);
            const pastDay = dayIn('p-plat', '2026-11-2').getAttribute('aria-disabled');
            await close('p-plat');
            type('p-plat', 0, '2026-11-03 10:00:00');
            await enter('p-plat', 0);
            const typed = {start: scope().f.ps2, refused: box('p-plat', 0).classList.contains('aui-date-picker__input--refused') || !ngm().$valid};
            await close('p-plat');
            box('p-plat', 0).blur();
            apply(s => { s.f.ps2 = sec('2026-11-01 08:00:00'); s.f.pe2 = sec('2026-12-31 23:59:59'); });
            await sleep(150);
            await press('p-plat', 1);
            const view = panel('p-plat').querySelector('.aui-date-picker__calendar .aui-date-picker__day[data-day="2026-12-20"]') ? null : 1;
            if (view) await click(act('p-plat', 'next-month'));
            await click(dayIn('p-plat', '2026-12-20'));
            await click(ok('p-plat'), 400);
            const taken = {models: [scope().f.ps2, scope().f.pe2], valid: ngm().$valid};
            box('p-plat', 1).blur();
            apply(s => { s.f.sec = 1762000000; });
            await sleep(150);
            const want = AD().format(1762000000 * 1000, 'YYYY-MM-DD HH:mm:ss');
            const number = scope().f.sec === want;
            apply(s => { s.f.sec = '1762000000'; });
            await sleep(150);
            return {models, quiet, pastDay, typed, taken, single: {number, digits: scope().f.sec === want}};
        });

    T('T40 under a page\'s button { box-shadow: none !important } (a global rule of some pages) the Start / End tabs keep their edge and active look, a time option its focus ring; next3Months / next6Months: from today to the day before the same date 3 / 6 months on',
        {tabs: {active: true, other: true}, ring: true, shortcuts: [['Next 3 months', true], ['Next 6 months', true]]},
        async () => {
            const st = document.createElement('style');
            st.textContent = "button{padding:4px 9px;border-width:1px !important;margin:0 5px 5px 0;box-shadow:none !important;white-space:nowrap}" +
                "button:focus{box-shadow:none !important}";
            document.head.appendChild(st);
            apply(s => { s.f.dtr = ['2026-11-10 09:00:00', '2026-11-12 18:00:00']; });
            await press('p-dtr', 0);
            const shadow = el => getComputedStyle(el).boxShadow !== 'none';
            const tabs = {active: shadow(act('p-dtr', 'end', '[data-end="0"]')), other: shadow(act('p-dtr', 'end', '[data-end="1"]'))};
            const opt = option('p-dtr', 0, 'h', 9);
            opt.focus();
            key(opt, 'ArrowDown');
            await sleep(100);
            const ring = shadow(document.activeElement);
            await close('p-dtr');
            box('p-dtr', 0).blur();
            st.remove();
            // the two shortcuts, on a field of their own
            const inj = angular.element(document.body).injector();
            const sc = scope().$new(true);
            sc.m = {s: '', e: ''};
            const el = inj.get('$compile')('<div><aui-date-picker type="datetimerange" start-model="m.s" end-model="m.e" shortcuts="[\'next3Months\', \'next6Months\']"></aui-date-picker></div>')(sc)[0];
            document.body.appendChild(el);
            sc.$digest();
            const today = new Date();
            const want = n => { const d = new Date(today.getFullYear(), today.getMonth() + n, today.getDate() - 1); return AD().format(d, 'YYYY-MM-DD') + ' 23:59:59'; };
            const start = AD().format(today, 'YYYY-MM-DD') + ' 00:00:00';
            const shortcuts = [];
            for (let i = 0; i < 2; i += 1) {
                const b = el.querySelector('input.aui-date-picker__input');
                b.focus();
                b.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0}));
                await sleep(300);
                const item = el.querySelectorAll('[data-shortcut]')[i];
                const label = item.textContent.trim();
                item.click();
                await sleep(250);
                const okBtn = el.querySelector('[data-act="ok"]');
                if (okBtn && !okBtn.disabled && el.querySelector('.aui-select__panel--open')) { okBtn.click(); await sleep(300); }
                shortcuts.push([label, sc.m.s === start && sc.m.e === want(i === 0 ? 3 : 6)]);
                b.blur();
            }
            sc.$destroy();
            el.remove();
            return {tabs, ring, shortcuts};
        });

    T('T41 read-seconds takes milliseconds too: a number of 1e11 or more (a text of 13 digits) is milliseconds, below that seconds - a range and one value, each written back as the text',
        {range: true, number: true, digits: true},
        async () => {
            const ms = AD().toTimestamp('2026-11-12 09:30:00');
            const ms2 = AD().toTimestamp('2026-11-20 18:00:00');
            apply(s => { s.f.ps2 = ms; s.f.pe2 = String(ms2); });
            await sleep(150);
            const range = scope().f.ps2 === '2026-11-12 09:30:00' && scope().f.pe2 === '2026-11-20 18:00:00';
            apply(s => { s.f.sec = ms; });
            await sleep(150);
            const number = scope().f.sec === '2026-11-12 09:30:00';
            apply(s => { s.f.sec = String(ms2); });
            await sleep(150);
            return {range, number, digits: scope().f.sec === '2026-11-20 18:00:00'};
        });

    T('T24 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('aui-date-picker: time types', tests);
})();
