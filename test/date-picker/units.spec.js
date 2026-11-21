// aui-date-picker units suite (page: units.html, fixture: units.fixture.js): month, monthrange, quarter, quarterrange,
// year, yearrange, week and dates - values in and out (a unit's first and last day, ranges kept as days), the pages,
// the year view from a month page, max-range by months, ISO week numbers and week rows, dates checked with the panel
// open (max-count, the page's digest after the picking pauses), typing, limits and disabled-date by the unit, the
// keyboard, shortcuts.
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
    const key = (el, k, extra) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({key: k, code: k, bubbles: true, cancelable: true}, extra || {})));
    const digestsSince = t => window.__digests.filter(x => x >= t).length;
    const lastChange = name => scope().changes.filter(c => c[0] === name).pop();
    const ngModel = id => angular.element(host(id)).controller('ngModel');
    // a month, quarter or year of a page (one inside its page, not a year beside a decade)
    const unit = (id, y, M) => Array.from(panel(id).querySelectorAll('.aui-date-picker__unit[data-y="' + y + '"][data-m="' + (M || 1) + '"]'))
        .find(b => !b.classList.contains('aui-date-picker__unit--outside'));
    const has = (el, name) => !!el && el.classList.contains(name);
    const dayIn = (id, k) => Array.from(panel(id).querySelectorAll('.aui-date-picker__day[data-day="' + k + '"]'))
        .find(b => !b.classList.contains('aui-date-picker__day--outside'));
    const titles = id => Array.from(panel(id).querySelectorAll('.aui-date-picker__unit-page .aui-date-picker__title')).map(t => t.textContent.trim());
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
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('U1 the page\'s values shown, none written back: a month, a month range, a quarter, a year, an ISO week, dates',
        {month: '2026-11', mr: ['2026-01', '2026-03'], q: '2026-Q4', y: '2026', wk: '2026-W45', dates: '2026-11-03, 2026-11-10', pristine: true},
        async () => {
            await sleep(100);
            return {month: box('p-month').value, mr: [box('p-mr', 0).value, box('p-mr', 1).value], q: box('p-q').value, y: box('p-y').value,
                wk: box('p-wk').value, dates: box('p-dates').value, pristine: scope().pageForm.$pristine};
        });

    T('U2 a month: twelve on the year\'s page, the value marked; a pick takes it with its first and last day and their timestamps',
        {cells: 12, title: ['2026'], selected: true, model: '2026-03',
            change: ['2026-03', '2026-03', true, 'pick', true, '2026-03-01', '2026-03-31', true], closed: true},
        async () => {
            await press('p-month');
            const r = {cells: panel('p-month').querySelectorAll('.aui-date-picker__unit').length, title: titles('p-month'),
                selected: has(unit('p-month', 2026, 11), 'aui-date-picker__unit--selected')};
            await click(unit('p-month', 2026, 3), 400);
            const c = lastChange('month');
            r.model = scope().f.month;
            r.change = [c[1], c[2], c[3] === AD().toTimestamp('2026-03-01'), c[4], c[5], c[6], c[7],
                c[8][0] === AD().toTimestamp('2026-03-01') && c[8][1] === AD().toTimestamp('2026-03-31 23:59:59')];
            r.closed = !isOpen('p-month');
            return r;
        });

    T('U3 the year above the months opens the years; one picked brings its months back, a month of it picked',
        {years: true, back: ['2030'], model: '2030-01'},
        async () => {
            await press('p-month');
            await click(panel('p-month').querySelector('.aui-date-picker__unit-page [data-act="year-view"]'));
            const years = !!panel('p-month').querySelector('.aui-date-picker__cell[data-value="2030"]');
            await click(panel('p-month').querySelector('.aui-date-picker__cell[data-value="2030"]'));
            const back = titles('p-month');
            await click(unit('p-month', 2030, 1), 400);
            return {years, back, model: scope().f.month};
        });

    T('U4 a month range: two years side by side, its band; two months picked (the second in the next year) with their timestamps',
        {titles: ['2026', '2027'], band: [true, true, true], model: ['2026-05', '2027-02'], stamps: true},
        async () => {
            await press('p-mr');
            const t = titles('p-mr');
            const band = [has(unit('p-mr', 2026, 1), 'aui-date-picker__unit--start'), has(unit('p-mr', 2026, 2), 'aui-date-picker__unit--in-range'),
                has(unit('p-mr', 2026, 3), 'aui-date-picker__unit--end')];
            await click(unit('p-mr', 2026, 5));
            await click(unit('p-mr', 2027, 2), 400);
            const c = lastChange('mr');
            return {titles: t, band, model: scope().f.mr,
                stamps: c[2][0] === AD().toTimestamp('2026-05-01') && c[2][1] === AD().toTimestamp('2027-02-28 23:59:59')};
        });

    T('U5 max-range 12M: from March, the next February can be the end, the next March cannot',
        {feb: false, mar: true},
        async () => {
            await press('p-mr');
            await click(unit('p-mr', 2026, 3));
            const r = {feb: has(unit('p-mr', 2027, 2), 'aui-date-picker__unit--disabled'), mar: has(unit('p-mr', 2027, 3), 'aui-date-picker__unit--disabled')};
            await close('p-mr');
            return r;
        });

    T('U6 a month range kept as days (two models): its first month\'s first day, its last month\'s last day; the boxes show the months',
        {ms: '2026-01-01 00:00:00', me: '2026-02-28 23:59:59', boxes: ['2026-01', '2026-02']},
        async () => {
            await press('p-mrd');
            const year = Number(titles('p-mrd')[0]);
            await click(unit('p-mrd', year, 1));
            await click(unit('p-mrd', year, 2), 400);
            const f = scope().f;
            return {ms: f.ms && f.ms.replace(String(year), '2026'), me: f.me && f.me.replace(String(year), '2026').replace('-29 ', '-28 '),
                boxes: [box('p-mrd', 0).value.replace(String(year), '2026'), box('p-mrd', 1).value.replace(String(year), '2026')]};
        });

    T('U7 a quarter: four with their months, the value marked; Q2 picked: 2026-Q2 from April 1 to June 30',
        {labels: ['Q1', 'Q2', 'Q3', 'Q4'], sub: 'Jan - Mar', selected: true, model: '2026-Q2', change: ['2026-Q2', 'pick', '2026-04-01', '2026-06-30']},
        async () => {
            await press('p-q');
            const cells = Array.from(panel('p-q').querySelectorAll('.aui-date-picker__unit'));
            const r = {labels: cells.map(b => b.querySelector('.aui-date-picker__unit-label').textContent.trim()),
                sub: cells[0].querySelector('.aui-date-picker__unit-sub').textContent.trim(),
                selected: has(unit('p-q', 2026, 10), 'aui-date-picker__unit--selected')};
            await click(unit('p-q', 2026, 4), 400);
            const c = lastChange('q');
            r.model = scope().f.q;
            r.change = [c[2], c[3], c[4], c[5]];
            return r;
        });

    T('U8 a quarter range over two years: Q3 to the next Q1',
        {model: ['Q3', 'Q1'], years: 1},
        async () => {
            await press('p-qr');
            const year = Number(titles('p-qr')[0]);
            await click(unit('p-qr', year, 7));
            await click(unit('p-qr', year + 1, 1), 400);
            const v = scope().f.qr || [];
            return {model: v.map(x => x.slice(-2)), years: v.length === 2 ? Number(v[1].slice(0, 4)) - Number(v[0].slice(0, 4)) : null};
        });

    T('U9 a year: its decade with the years beside it, the value marked; the decade arrows; a year picked',
        {cells: 12, title: ['2020 - 2029'], selected: true, edges: [true, true], prev: ['2010 - 2019'], model: '2015'},
        async () => {
            await press('p-y');
            const cells = Array.from(panel('p-y').querySelectorAll('.aui-date-picker__unit'));
            const r = {cells: cells.length, title: titles('p-y'), selected: has(unit('p-y', 2026), 'aui-date-picker__unit--selected'),
                edges: [has(cells[0], 'aui-date-picker__unit--outside'), has(cells[11], 'aui-date-picker__unit--outside')]};
            await click(panel('p-y').querySelector('[data-act="prev-page"]'));
            r.prev = titles('p-y');
            await click(unit('p-y', 2015), 400);
            r.model = scope().f.y;
            return r;
        });

    T('U10 a year range: two decades side by side, a year in each picked',
        {decades: 2, model: true},
        async () => {
            await press('p-yr');
            const decades = titles('p-yr').length;
            const d = Number(titles('p-yr')[0].slice(0, 4));
            await click(unit('p-yr', d + 1));
            await click(unit('p-yr', d + 14), 400);
            const v = scope().f.yr || [];
            return {decades, model: v[0] === String(d + 1) && v[1] === String(d + 14)};
        });

    T('U11 a week: ISO numbers beside the weeks, its row drawn (ends filled); a day of another week picks that week with its days and timestamps',
        {numbers: 6, row: [true, true, true], model: '2026-W47', change: ['2026-W47', '2026-11-16', '2026-11-22', true]},
        async () => {
            await press('p-wk');
            const r = {numbers: panel('p-wk').querySelectorAll('.aui-date-picker__week-no').length,
                row: [has(dayIn('p-wk', '2026-11-2'), 'aui-date-picker__day--start'), has(dayIn('p-wk', '2026-11-4'), 'aui-date-picker__day--in-range'),
                    has(dayIn('p-wk', '2026-11-8'), 'aui-date-picker__day--end')]};
            await click(dayIn('p-wk', '2026-11-19'), 400);
            const c = lastChange('wk');
            r.model = scope().f.wk;
            r.change = [c[2], c[3], c[4], c[5][0] === AD().toTimestamp('2026-11-16') && c[5][1] === AD().toTimestamp('2026-11-22 23:59:59')];
            return r;
        });

    T('U12 the week under the pointer is drawn in the hover tint (lighter than a chosen range; one week, not a range: no dashed edges); the pointer leaving the panel clears it',
        {hover: [true, true], look: {tint: true, dashed: false}, cleared: true},
        async () => {
            await press('p-wk');
            dayIn('p-wk', '2026-11-25').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            await sleep(80);
            const hover = [has(dayIn('p-wk', '2026-11-23'), 'aui-date-picker__day--previewing'), has(dayIn('p-wk', '2026-11-29'), 'aui-date-picker__day--previewing')];
            const look = el => { const b = getComputedStyle(el, '::before'); const bg = b.backgroundColor; const m = /\/\s*([\d.]+)\s*\)$/.exec(bg) || /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(bg);
                const alpha = m ? +m[1] : (bg === 'transparent' ? 0 : 1); /* rgba(r, g, b, a) or color(srgb r g b / a) */ return {tint: alpha >= 0.07 && alpha < 0.11, dashed: b.borderTopStyle === 'dashed' && b.borderBottomStyle === 'dashed'}; };
            const weekLook = look(dayIn('p-wk', '2026-11-25'));
            panel('p-wk').dispatchEvent(new MouseEvent('mouseleave'));
            await sleep(80);
            const cleared = !panel('p-wk').querySelector('.aui-date-picker__day--previewing');
            await close('p-wk');
            return {hover, look: weekLook, cleared};
        });

    T('U13 a week typed: a day (its week), an ISO week in lower case',
        {day: '2026-W52', iso: '2027-W01'},
        async () => {
            type('p-wk', 0, '2026-12-25');
            await enter('p-wk', 0);
            await close('p-wk');
            const day = scope().f.wk;
            type('p-wk', 0, '2027-w01');
            await enter('p-wk', 0);
            await close('p-wk');
            return {day, iso: scope().f.wk};
        });

    T('U14 week-start 0: no ISO numbers; a Thursday picks its week, kept as its Sunday',
        {numbers: 0, model: '2026-11-15'},
        async () => {
            await press('p-wk0');
            const numbers = panel('p-wk0').querySelectorAll('.aui-date-picker__week-no').length;
            await click(dayIn('p-wk0', '2026-11-19'), 400);
            return {numbers, model: scope().f.wk0};
        });

    T('U15 dates: checked one by one, the panel open (no page digest until the picking pauses); max-count 3 disables the others; OK closes',
        {count: '2 selected / 3', added: ['2026-11-03', '2026-11-10', '2026-11-12'], open: true, full: [true, false], removed: ['2026-11-10', '2026-11-12'],
            change: ['pick', true], quiet: 0, later: true, closed: true},
        async () => {
            await press('p-dates');
            const count = panel('p-dates').querySelector('.aui-date-picker__count').textContent.trim();
            const t = performance.now();
            await click(dayIn('p-dates', '2026-11-12'), 60);
            const added = scope().f.dates.slice();
            const quiet = digestsSince(t);
            const open = isOpen('p-dates');
            const full = [has(dayIn('p-dates', '2026-11-20'), 'aui-date-picker__day--disabled'), has(dayIn('p-dates', '2026-11-3'), 'aui-date-picker__day--disabled')];
            await click(dayIn('p-dates', '2026-11-3'), 60);
            const removed = scope().f.dates.slice();
            const c = lastChange('dates');
            await sleep(600);
            const later = digestsSince(t) >= 1;
            await click(panel('p-dates').querySelector('[data-act="done"]'), 400);
            return {count, added, open, full, removed, change: [c[4], c[5]], quiet, later, closed: !isOpen('p-dates')};
        });

    T('U16 dates typed: in any order (kept in order); a text that is not a date: invalid, the value kept',
        {typed: ['2026-11-05', '2026-11-20'], bad: true, kept: ['2026-11-05', '2026-11-20']},
        async () => {
            type('p-dates', 0, '2026-11-20, 2026-11-05');
            await enter('p-dates', 0);
            await close('p-dates');
            const typed = scope().f.dates.slice();
            type('p-dates', 0, '2026-11-05, nope');
            await enter('p-dates', 0);
            await close('p-dates');
            const bad = !!ngModel('p-dates').$error.date;
            key(box('p-dates'), 'Escape');
            await sleep(150);
            return {typed, bad, kept: scope().f.dates};
        });

    T('U17 dates over max-count from the page: invalid (maxCount)',
        {over: true, back: false},
        async () => {
            apply(s => { s.f.dates = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']; });
            const over = !!scope().pageForm.dates.$error.maxCount;
            apply(s => { s.f.dates = ['2026-11-01']; });
            return {over, back: !!scope().pageForm.dates.$error.maxCount};
        });

    T('U18 min / max by the month and disabled-date asked for each month ($unit month): the months outside or refused disabled; the checks',
        {page: ['2026'], cells: {feb: true, mar: false, aug: true, oct: false, nov: true}, unit: 'month', errors: {aug: true, feb: true, mar: false}},
        async () => {
            await press('p-mlim');
            const page = titles('p-mlim');
            const d = (M) => has(unit('p-mlim', 2026, M), 'aui-date-picker__unit--disabled');
            const cells = {feb: d(2), mar: d(3), aug: d(8), oct: d(10), nov: d(11)};
            await close('p-mlim');
            apply(s => { s.f.mlim = '2026-08'; });
            const aug = !!scope().pageForm.mlim.$error.disabledDate;
            apply(s => { s.f.mlim = '2026-02'; });
            const feb = !!scope().pageForm.mlim.$error.min;
            apply(s => { s.f.mlim = '2026-03'; });
            return {page, cells, unit: scope().askedUnit, errors: {aug, feb, mar: !scope().pageForm.mlim.$valid}};
        });

    T('U19 the keyboard on months: ArrowDown opens on the value\'s month, ArrowRight, ArrowDown (a row), PageDown (a year), Enter picks',
        {start: '2026-3', right: '2026-4', down: '2026-7', page: ['2027'], model: '2027-07', closed: true},
        async () => {
            apply(s => { s.f.month = '2026-03'; });
            box('p-month').focus();
            key(box('p-month'), 'ArrowDown');
            await sleep(350);
            const at = () => (document.activeElement.getAttribute('data-y') || '') + '-' + (document.activeElement.getAttribute('data-m') || '');
            const start = at();
            key(document.activeElement, 'ArrowRight');
            await sleep(100);
            const right = at();
            key(document.activeElement, 'ArrowDown');
            await sleep(100);
            const down = at();
            key(document.activeElement, 'PageDown');
            await sleep(150);
            const page = titles('p-month');
            key(document.activeElement, 'Enter');
            await sleep(400);
            return {start, right, down, page, model: scope().f.month, closed: !isOpen('p-month')};
        });

    T('U20 value-type timestamp: a month picked is its first day\'s milliseconds',
        {model: true},
        async () => {
            await press('p-mstamp');
            const year = Number(titles('p-mstamp')[0]);
            await click(unit('p-mstamp', year, 6), 400);
            return {model: scope().f.mstamp === AD().toTimestamp(year + '-06-01')};
        });

    T('U21 shortcuts: a year type\'s This year; a quarter range\'s Last 4 quarters ends with this quarter',
        {year: true, quarters: true},
        async () => {
            await press('p-y');
            const items = Array.from(panel('p-y').querySelectorAll('.aui-date-picker__shortcut'));
            await click(items[0], 400);
            const year = scope().f.y === AD().today('YYYY');
            await press('p-qr');
            await click(panel('p-qr').querySelector('.aui-date-picker__shortcut'), 400);
            const v = scope().f.qr || [];
            const now = AD().format(AD().today(), 'YYYY-[Q]Q');
            const first = AD().format(AD().add(AD().startOf(AD().today(), 'quarter'), -9, 'month'), 'YYYY-[Q]Q');
            return {year, quarters: v[0] === first && v[1] === now};
        });

    T('U22 opening and moving pages cost the page no digest',
        {open: 0, pages: 0},
        async () => {
            if (document.activeElement) document.activeElement.blur();
            await sleep(450);
            let t = performance.now();
            await press('p-q');
            const open = digestsSince(t);
            t = performance.now();
            await click(panel('p-q').querySelector('[data-act="next-page"]'));
            await click(panel('p-q').querySelector('[data-act="prev-page"]'));
            const pages = digestsSince(t);
            await close('p-q');
            return {open, pages};
        });

    T('U24 boundary="end" on one month kept as a date-time: the month picked is its last moment; the page\'s value shown as its month',
        {shown: '2026-11', model: true},
        async () => {
            const shown = box('p-mend').value;
            await press('p-mend');
            const year = Number(titles('p-mend')[0]);
            await click(unit('p-mend', year, 2), 400);
            const last = AD().format(AD().endOf(year + '-02-01', 'month'), 'YYYY-MM-DD HH:mm:ss');
            return {shown, model: scope().f.mend === last};
        });

    T('U25 a range of years: in its two decades the year one shows of the other is left out (each year once); the years beside them drawn as any year (an end there marked)',
        {hidden: {lastOfFirst: true, firstOfSecond: true}, once: true, outerEnd: true},
        async () => {
            apply(s => { s.f.yr = ['2012', '2030']; });
            await press('p-yr', 0);
            const pages = panel('p-yr').querySelectorAll('.aui-date-picker__unit-page');
            const cells = i => Array.from(pages[i].querySelectorAll('.aui-date-picker__unit'));
            const isHidden = b => b.classList.contains('aui-date-picker__unit--hidden');
            const first = cells(0);
            const second = cells(1);
            const hidden = {lastOfFirst: isHidden(first[first.length - 1]), firstOfSecond: isHidden(second[0])};
            const shown = first.concat(second).filter(b => !isHidden(b)).map(b => b.getAttribute('data-y'));
            const end = second[second.length - 1];
            const outerEnd = end.getAttribute('data-y') === '2030' && end.classList.contains('aui-date-picker__unit--outside') &&
                end.classList.contains('aui-date-picker__unit--end');
            await close('p-yr');
            return {hidden, once: shown.length === new Set(shown).size, outerEnd};
        });

    T('U26 a range of years open on its end, switched to its start (its box) and back: the decades follow the end chosen - the start on the left, the end on the right',
        {open: [2080, 2090], start: [2010, 2020], end: [2080, 2090]},
        async () => {
            const decades = () => Array.from(panel('p-yr').querySelectorAll('.aui-date-picker__unit-page')).map(page => {
                const u = page.querySelector('.aui-date-picker__unit:not(.aui-date-picker__unit--outside)');
                return u ? Math.floor(Number(u.getAttribute('data-y')) / 10) * 10 : null;
            });
            apply(s => { s.f.yr = ['2012', '2090']; });
            await sleep(80);
            await press('p-yr', 1);
            const open = decades();
            await press('p-yr', 0);
            const start = decades();
            await press('p-yr', 1);
            const end = decades();
            await close('p-yr');
            box('p-yr', 1).blur();
            return {open, start, end};
        });

    T('U23 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('aui-date-picker: months, quarters, years, weeks, dates', tests);
})();
