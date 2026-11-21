// Unit tests of auiDateEngine and AuiDate (the date pickers' calendar arithmetic), without a browser.
//   node --test test/unit/            (npm run test:unit)
// AUI_SOURCE=<path to a built file> runs them against that file, e.g. dist/aui-components.min.js. The local-time
// checks also run in child processes under other time zones (TZ), daylight saving ones among them.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

// the library as built from src/ (scripts/lib/bundle.js), or AUI_SOURCE: a built file, e.g. dist/aui-components.min.js
const source = process.env.AUI_SOURCE ? fs.readFileSync(process.env.AUI_SOURCE, 'utf8') : require('../../scripts/lib/bundle').js();

// A stand-in for the module 'aui': only the date factories (and the texts they read) are created.
const registry = {};
const chain = new Proxy({}, {
    get(target, method) {
        return function (name, def) {
            if (method === 'provider' && name === 'auiTexts') registry.auiTexts = new def().$get();
            if (method === 'factory' && (name === 'auiDateEngine' || name === 'AuiDate')) {
                const fn = def[def.length - 1];
                registry[name] = fn.apply(null, def.slice(0, -1).map(dep => registry[dep]));
            }
            return chain;
        };
    }
});
new Function('angular', 'window', source)(Object.assign({module: () => chain}, {extend: Object.assign}), {});
const E = registry.auiDateEngine;
const D = registry.AuiDate;
const P = (y, M, d, h, m, s) => E.make(y, M, d, h, m, s);
const fmt = (p, f) => E.format(p, f || 'YYYY-MM-DD HH:mm:ss');

test('dayNumber and fromDayNumber: every day from 1600 to 2400, against Date.UTC, and the weekday', () => {
    const from = E.dayNumber(1600, 1, 1);
    const to = E.dayNumber(2400, 12, 31);
    assert.equal(from, Date.UTC(1600, 0, 1) / 86400000);
    for (let n = from; n <= to; n += 1) {
        const p = E.fromDayNumber(n);
        assert.equal(E.dayNumber(p.y, p.M, p.d), n);
        if (n % 97 === 0) {
            const date = new Date(n * 86400000);
            assert.deepEqual([p.y, p.M, p.d], [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]);
            assert.equal(E.weekday(p), date.getUTCDay());
        }
    }
    assert.deepEqual(E.fromDayNumber(0), {y: 1970, M: 1, d: 1});
    assert.equal(E.weekday(P(1970, 1, 1)), 4);
    assert.deepEqual(E.fromDayNumber(E.dayNumber(1, 1, 1)), {y: 1, M: 1, d: 1});
});

test('leap years and month lengths', () => {
    assert.equal(E.isLeap(1900), false);
    assert.equal(E.isLeap(2000), true);
    assert.equal(E.isLeap(2024), true);
    assert.equal(E.isLeap(2026), false);
    assert.equal(E.isLeap(2100), false);
    assert.equal(E.daysInMonth(2024, 2), 29);
    assert.equal(E.daysInMonth(2026, 2), 28);
    assert.equal(E.daysInMonth(2026, 4), 30);
    assert.equal(E.daysInMonth(2026, 12), 31);
});

test('isValid refuses impossible parts', () => {
    assert.equal(E.isValid(P(2026, 2, 29)), false);
    assert.equal(E.isValid(P(2024, 2, 29)), true);
    assert.equal(E.isValid(P(2026, 13, 1)), false);
    assert.equal(E.isValid(P(2026, 11, 6, 24)), false);
    assert.equal(E.isValid(P(2026, 11, 6, 23, 60)), false);
    assert.equal(E.isValid(P(2026, 11, 6.5)), false);
    assert.equal(E.isValid(null), false);
});

test('add: months keep the day where the month has it; days, weeks, quarters, years, time units', () => {
    assert.equal(fmt(E.add(P(2026, 1, 31), 1, 'month')), '2026-02-28 00:00:00');
    assert.equal(fmt(E.add(P(2024, 1, 31), 1, 'month')), '2024-02-29 00:00:00');
    assert.equal(fmt(E.add(P(2024, 2, 29), 1, 'year')), '2025-02-28 00:00:00');
    assert.equal(fmt(E.add(P(2026, 3, 31), -1, 'M')), '2026-02-28 00:00:00');
    assert.equal(fmt(E.add(P(2026, 11, 30), 1, 'quarter')), '2027-02-28 00:00:00');
    assert.equal(fmt(E.add(P(2026, 12, 31), 1, 'd')), '2027-01-01 00:00:00');
    assert.equal(fmt(E.add(P(2026, 3, 1), -1, 'day')), '2026-02-28 00:00:00');
    assert.equal(fmt(E.add(P(2026, 11, 6), 2, 'w')), '2026-11-20 00:00:00');
    assert.equal(fmt(E.add(P(2026, 12, 31, 23, 30), 45, 'min')), '2027-01-01 00:15:00');
    assert.equal(fmt(E.add(P(2026, 11, 6), -1, 's')), '2026-11-05 23:59:59');
    assert.equal(fmt(E.add(P(2026, 11, 6), 3, 'unknown')), '2026-11-06 00:00:00');
});

test('diff: whole units from a to b, cut toward zero', () => {
    assert.equal(E.diff(P(2026, 11, 1), P(2026, 11, 30), 'day'), 29);
    assert.equal(E.diff(P(2026, 11, 30), P(2026, 11, 1), 'day'), -29);
    // a month counts once a + that many months (as add counts them) is reached: Jan 31 + 1 month = Feb 28
    assert.equal(E.diff(P(2026, 1, 31), P(2026, 2, 28), 'month'), 1);
    assert.equal(E.diff(P(2026, 1, 31), P(2026, 2, 27), 'month'), 0);
    assert.equal(E.diff(P(2026, 1, 31, 10), P(2026, 2, 28, 9), 'month'), 0);
    assert.equal(E.diff(P(2026, 1, 15), P(2026, 2, 15), 'month'), 1);
    assert.equal(E.diff(P(2026, 1, 15), P(2026, 2, 14), 'month'), 0);
    assert.equal(E.diff(P(2024, 2, 29), P(2025, 2, 28), 'year'), 1);
    assert.equal(E.diff(P(2026, 1, 15), P(2027, 1, 14), 'year'), 0);
    assert.equal(E.diff(P(2026, 1, 15), P(2027, 1, 15), 'year'), 1);
    assert.equal(E.diff(P(2026, 11, 6, 10), P(2026, 11, 6, 12, 30), 'hour'), 2);
    assert.equal(E.diff(P(2024, 1, 1), P(2025, 1, 1), 'day'), 366);
});

test('diff agrees with add: diff(a, add(a, n, unit), unit) is n (months, quarters, years; 30,000 random, both ways)', () => {
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    for (let i = 0; i < 30000; i += 1) {
        const y = rnd(1900, 2200);
        const M = rnd(1, 12);
        const a = P(y, M, rnd(1, E.daysInMonth(y, M)), rnd(0, 23), rnd(0, 59), rnd(0, 59));
        const unit = ['month', 'quarter', 'year'][i % 3];
        const n = rnd(-40, 40);
        assert.equal(E.diff(a, E.add(a, n, unit), unit), n, fmt(a) + ' + ' + n + ' ' + unit);
    }
});

test('AuiDate: a text in a format is read only with all of its date parts (its time may be left out)', () => {
    assert.equal(D.parse('2026-11', 'YYYY-MM-DD'), null);
    assert.equal(D.parse('2026', 'YYYY-MM-DD'), null);
    assert.equal(D.format('2026-11', 'YYYY-MM-DD', 'YYYY-MM'), '2026-11-01');
    assert.equal(D.format('2026-11-07', 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm:ss'), '2026-11-07 00:00:00');
    assert.equal(D.isValid('2026-11', 'YYYY-MM-DD'), false);
});

test('parse: a sign before the first number is refused; AM / PM given or not (ampm)', () => {
    assert.equal(E.parse('-2026-11-07', 'YYYY-MM-DD'), null);
    assert.equal(E.parse('+2026-11-07', 'YYYY-MM-DD'), null);
    assert.equal(E.parse(' - 09:30', 'HH:mm'), null);
    assert.equal(E.parse('2026-11-07T10:00:00-05:00', 'YYYY-MM-DD HH:mm:ss').offset, -300);
    assert.equal(E.parse('3:00 PM', 'h:mm A').ampm, 'pm');
    assert.equal(E.parse('3:00', 'h:mm A').ampm, null);
});

test('startOf and endOf, the week with its start', () => {
    const fri = P(2026, 11, 6, 14, 30, 5);              // a Friday
    assert.equal(fmt(E.startOf(fri, 'day')), '2026-11-06 00:00:00');
    assert.equal(fmt(E.endOf(fri, 'day')), '2026-11-06 23:59:59');
    assert.equal(fmt(E.startOf(fri, 'week', 1)), '2026-11-02 00:00:00');
    assert.equal(fmt(E.endOf(fri, 'week', 1)), '2026-11-08 23:59:59');
    assert.equal(fmt(E.startOf(fri, 'week', 0)), '2026-11-01 00:00:00');
    assert.equal(fmt(E.startOf(P(2026, 11, 1), 'week', 1)), '2026-10-26 00:00:00');
    assert.equal(fmt(E.startOf(fri, 'month')), '2026-11-01 00:00:00');
    assert.equal(fmt(E.endOf(P(2024, 2, 10), 'month')), '2024-02-29 23:59:59');
    assert.equal(fmt(E.startOf(fri, 'quarter')), '2026-10-01 00:00:00');
    assert.equal(fmt(E.endOf(fri, 'quarter')), '2026-12-31 23:59:59');
    assert.equal(fmt(E.startOf(fri, 'year')), '2026-01-01 00:00:00');
    assert.equal(fmt(E.startOf(fri, 'hour')), '2026-11-06 14:00:00');
});

test('ISO weeks: the year of the week, week 53', () => {
    assert.deepEqual(E.isoWeek(P(2026, 1, 1)), {year: 2026, week: 1});
    assert.deepEqual(E.isoWeek(P(2027, 1, 1)), {year: 2026, week: 53});
    assert.deepEqual(E.isoWeek(P(2024, 12, 30)), {year: 2025, week: 1});
    assert.deepEqual(E.isoWeek(P(2026, 11, 6)), {year: 2026, week: 45});
});

test('monthGrid: six weeks from the week start, the month marked', () => {
    const grid = E.monthGrid(2026, 11, 1);
    assert.equal(grid.length, 42);
    assert.deepEqual([grid[0].y, grid[0].M, grid[0].d, grid[0].inMonth], [2026, 10, 26, false]);
    assert.equal(grid.filter(c => c.inMonth).length, 30);
    assert.equal(E.weekday(grid[0]), 1);
    const sunday = E.monthGrid(2026, 11, 0);
    assert.deepEqual([sunday[0].M, sunday[0].d, sunday[0].inMonth], [11, 1, true]);
    const feb = E.monthGrid(2027, 2, 1);                // 2027-02-01 is a Monday: the grid starts on it
    assert.deepEqual([feb[0].M, feb[0].d], [2, 1]);
});

test('format: every token', () => {
    const p = P(2026, 3, 7, 9, 5, 4);
    assert.equal(E.format(p, 'YYYY-MM-DD HH:mm:ss'), '2026-03-07 09:05:04');
    assert.equal(E.format(p, 'YYYY/M/D H:m:s'), '2026/3/7 9:5:4');
    assert.equal(E.format(p, 'hh:mm A'), '09:05 AM');
    assert.equal(E.format(P(2026, 3, 7, 0, 30), 'h:mm a'), '12:30 am');
    assert.equal(E.format(P(2026, 3, 7, 13, 30), 'h:mm A'), '1:30 PM');
    assert.equal(E.format(p, 'YYYY-[Q]Q'), '2026-Q1');
    assert.equal(E.format(P(2027, 1, 1), 'GGGG-[W]WW'), '2026-W53');
    assert.equal(E.format(p, '[YYYY] YYYY'), 'YYYY 2026');
    assert.equal(E.format(P(5, 1, 2), 'YYYY-MM-DD'), '0005-01-02');
});

test('parse: lenient separators, single digits, digits alone, ISO texts', () => {
    const f = 'YYYY-MM-DD HH:mm:ss';
    const day = text => { const r = E.parse(text, 'YYYY-MM-DD'); return r && fmt(E.complete(r.parts, 'start'), 'YYYY-MM-DD'); };
    assert.equal(day('2026-11-06'), '2026-11-06');
    assert.equal(day('2026-11-6'), '2026-11-06');
    assert.equal(day('2026/11/06'), '2026-11-06');
    assert.equal(day('2026.11.06'), '2026-11-06');
    assert.equal(day(' 2026 11 06 '), '2026-11-06');
    assert.equal(day('20261106'), '2026-11-06');
    assert.equal(day('2026-1-6'), '2026-01-06');
    const time = E.parse('2026-11-06T14:30:00', f);
    assert.equal(fmt(E.complete(time.parts, 'start')), '2026-11-06 14:30:00');
    assert.equal(time.offset, undefined);
    const partial = E.parse('2026-11-06 9:5', f);
    assert.deepEqual(partial.missing, ['s']);
    assert.equal(fmt(E.complete(partial.parts, 'start')), '2026-11-06 09:05:00');
    assert.equal(fmt(E.complete(partial.parts, 'end')), '2026-11-06 09:05:59');
    const dateOnly = E.parse('2026-11-06', f);
    assert.deepEqual(dateOnly.missing, ['h', 'm', 's']);
    assert.equal(fmt(E.complete(dateOnly.parts, 'end')), '2026-11-06 23:59:59');
    assert.equal(fmt(E.complete(E.parse('202611061430', f).parts, 'start')), '2026-11-06 14:30:00');
    assert.equal(fmt(E.complete(E.parse('06/11/2026', 'DD/MM/YYYY').parts, 'start'), 'YYYY-MM-DD'), '2026-11-06');
});

test('parse: an offset at the end makes an instant; fractions of a second are dropped', () => {
    const z = E.parse('2026-11-06T06:30:00.123Z', 'YYYY-MM-DD HH:mm:ss');
    assert.equal(z.offset, 0);
    assert.equal(fmt(E.complete(z.parts, 'start')), '2026-11-06 06:30:00');
    assert.equal(E.parse('2026-11-06T06:30:00+02:00', 'YYYY-MM-DD HH:mm:ss').offset, 120);
    assert.equal(E.parse('2026-11-06 06:30-0530', 'YYYY-MM-DD HH:mm:ss').offset, -330);
    assert.equal(E.parse('2026-11-06 06:30+25:00', 'YYYY-MM-DD HH:mm:ss'), null);
});

test('parse: refuses what is not a value of the format', () => {
    const f = 'YYYY-MM-DD';
    for (const bad of ['', '   ', 'abc', '26-11-06', '2026-13-01', '2026-02-29', '2026-11-31', '2026-11-06 5',
        '2026-11-06x', '2026-0-06', '2026-11-00', '11-06']) {
        assert.equal(E.parse(bad, f), null, bad);
    }
    assert.equal(E.parse('2026-11-06 25:00', 'YYYY-MM-DD HH:mm'), null);
    assert.equal(E.parse('2026-11-06 10:60', 'YYYY-MM-DD HH:mm'), null);
    assert.equal(E.parse('14:30', 'YYYY-MM-DD HH:mm:ss'), null);
    assert.equal(E.parse(null, f), null);
});

test('parse: 12-hour clock, quarter, ISO week', () => {
    assert.equal(fmt(E.complete(E.parse('2026-11-06 2:30 PM', 'YYYY-MM-DD h:mm A').parts, 'start')), '2026-11-06 14:30:00');
    assert.equal(fmt(E.complete(E.parse('2026-11-06 12:15 am', 'YYYY-MM-DD hh:mm a').parts, 'start')), '2026-11-06 00:15:00');
    assert.equal(E.parse('2026-11-06 13:15 pm', 'YYYY-MM-DD hh:mm a'), null);
    assert.equal(fmt(E.complete(E.parse('2026-Q4', 'YYYY-[Q]Q').parts, 'start'), 'YYYY-MM-DD'), '2026-10-01');
    assert.equal(E.parse('2026-Q5', 'YYYY-[Q]Q'), null);
    assert.equal(fmt(E.complete(E.parse('2026-W01', 'GGGG-[W]WW').parts, 'start'), 'YYYY-MM-DD'), '2025-12-29');
    assert.equal(fmt(E.complete(E.parse('2026-W53', 'GGGG-[W]WW').parts, 'start'), 'YYYY-MM-DD'), '2026-12-28');
    assert.equal(E.parse('2025-W53', 'GGGG-[W]WW'), null);
});

test('format and parse round trip, 20,000 random date-times in four formats', () => {
    let seed = 7;
    const rand = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let i = 0; i < 20000; i += 1) {
        const y = 1 + rand(9999);
        const M = 1 + rand(12);
        const p = P(y, M, 1 + rand(E.daysInMonth(y, M)), rand(24), rand(60), rand(60));
        for (const f of ['YYYY-MM-DD HH:mm:ss', 'YYYY/M/D H:m:s', 'DD.MM.YYYY HH:mm:ss', 'YYYYMMDDHHmmss']) {
            const back = E.parse(E.format(p, f), f);
            assert.ok(back, f + ' ' + E.format(p, f));
            assert.deepEqual(E.complete(back.parts, 'start'), p);
        }
    }
});

test('timestamps at a fixed offset match Date.UTC', () => {
    const p = P(2026, 11, 6, 14, 30, 0);
    assert.equal(E.toTimestamp(p, 0), Date.UTC(2026, 10, 6, 14, 30, 0));
    assert.equal(E.toTimestamp(p, 480), Date.UTC(2026, 10, 6, 6, 30, 0));
    assert.equal(E.toTimestamp(p, -300), Date.UTC(2026, 10, 6, 19, 30, 0));
    assert.deepEqual(E.fromTimestamp(Date.UTC(2026, 10, 6, 6, 30, 0), 480), p);
    // (Date.UTC reads years 0-99 as 1900-1999: the year 1 is set with setUTCFullYear)
    assert.deepEqual(E.fromTimestamp(new Date(0).setUTCFullYear(1, 0, 1), 0), P(1, 1, 1));
    assert.ok(isNaN(E.toTimestamp(P(2026, 2, 30), 0)));
    assert.equal(E.parseOffset('+05:30'), 330);
    assert.equal(E.parseOffset('-0800'), -480);
    assert.equal(E.parseOffset('8'), null);
});

test('local timestamps round trip in several time zones (daylight saving ones among them)', () => {
    const probe = path.join(__dirname, 'date-local-probe.js');
    // fixed offsets, and rule-based zones with daylight saving (their changes at 02:00 local time)
    for (const zone of ['UTC', 'Etc/GMT-8', 'Etc/GMT+3', 'Etc/GMT-14', 'EST5EDT', 'CST6CDT', 'MST7MDT', 'PST8PDT']) {
        const out = childProcess.execFileSync(process.execPath, [probe], {env: Object.assign({}, process.env, {TZ: zone})}).toString();
        assert.equal(out.trim(), 'ok', zone + ': ' + out);
    }
});

test('durations and relative keywords', () => {
    assert.deepEqual(E.parseDuration('31d'), {n: 31, unit: 'day'});
    assert.deepEqual(E.parseDuration('3M'), {n: 3, unit: 'month'});
    assert.deepEqual(E.parseDuration('30min'), {n: 30, unit: 'minute'});
    assert.deepEqual(E.parseDuration(' 1y '), {n: 1, unit: 'year'});
    assert.equal(E.parseDuration('3 months'), null);
    assert.equal(E.parseDuration(''), null);
    const now = P(2026, 11, 6, 14, 30, 15);
    assert.equal(fmt(E.relative('today', now)), '2026-11-06 00:00:00');
    assert.equal(fmt(E.relative('now', now)), '2026-11-06 14:30:15');
    assert.equal(fmt(E.relative('today+30d', now)), '2026-12-06 00:00:00');
    assert.equal(fmt(E.relative('today - 1y', now)), '2025-11-06 00:00:00');
    assert.equal(fmt(E.relative('now+2h', now)), '2026-11-06 16:30:15');
    assert.equal(E.relative('yesterday', now), null);
});

test('AuiDate: texts in and out, with and without formats', () => {
    assert.equal(D.diff('2026-11-01', '2026-11-30', 'day'), 29);
    assert.equal(D.add('2026-01-31', 1, 'month', 'YYYY-MM-DD'), '2026-02-28');
    assert.equal(D.format('2026/11/6 9:05', 'YYYY-MM-DD HH:mm'), '2026-11-06 09:05');
    assert.equal(D.format(Date.UTC(2026, 10, 6, 6, 30), 'YYYY-MM-DD HH:mm', null, {utcOffset: '+00:00'}), '2026-11-06 06:30');
    assert.equal(D.toTimestamp('2026-11-06 14:30:00', null, {utcOffset: '+00:00'}), Date.UTC(2026, 10, 6, 14, 30));
    assert.equal(D.format('2026-11-06T06:30:00Z', 'YYYY-MM-DD HH:mm', null, {utcOffset: '+02:00'}), '2026-11-06 08:30');
    assert.equal(D.startOf('2026-11-06 14:30:00', 'week', 'YYYY-MM-DD'), '2026-11-02');
    assert.equal(D.endOf('2026-11-06', 'month', null), '2026-11-30 23:59:59');
    assert.equal(D.compare('2026-11-06', '2026-11-07'), -1);
    assert.equal(D.isValid('2026-02-29'), false);
    assert.equal(D.isValid('2026-11'), false);
    assert.equal(D.isValid('2026-11', 'YYYY-MM'), true);
    assert.equal(D.format('', 'YYYY'), '');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(D.today()));
});
