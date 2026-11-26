// Run by date-engine.test.js under a time zone of its own (TZ): auiDateEngine's local timestamps against the
// Date object's local time, every 7 hours over 2023-2027 (daylight saving changes included). Prints "ok" or what failed.
//   TZ=EST5EDT node test/unit/date-local-probe.js       (AUI_SOURCE=<file>: a built file instead of src/)
'use strict';
const fs = require('node:fs');
const source = process.env.AUI_SOURCE ? fs.readFileSync(process.env.AUI_SOURCE, 'utf8') : require('../../scripts/lib/bundle').js();
const registry = {};
const chain = new Proxy({}, {
    get(target, method) {
        return function (name, def) {
            if (method === 'provider' && name === 'auiTexts') registry.auiTexts = new def().$get();
            if (method === 'factory' && name === 'auiDateEngine') registry[name] = def[def.length - 1](registry.auiTexts);
            return chain;
        };
    }
});
new Function('angular', 'window', source)({module: () => chain, extend: Object.assign}, {});
const E = registry.auiDateEngine;
const failures = [];
const start = Date.UTC(2023, 0, 1);
const end = Date.UTC(2027, 11, 31);
for (let ms = start; ms <= end && failures.length < 5; ms += 7 * 3600 * 1000) {
    const date = new Date(ms);
    const p = E.fromTimestamp(ms);
    const local = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
    if (!p || [p.y, p.M, p.d, p.h, p.m, p.s].join() !== local.join()) failures.push('fromTimestamp ' + ms);
    // back from the wall-clock time: the same instant, also the later of a time that exists twice (the clock set back
    // at the end of daylight saving): the parts read from an instant give that instant while they are unchanged
    const back = E.toTimestamp(p);
    if (back !== ms) failures.push('toTimestamp ' + ms + ' ' + back);
    // the same parts made anew (typed, picked): the instant Date gives them (of a time that exists twice, the one Date picks)
    const fresh = E.toTimestamp(E.make(p.y, p.M, p.d, p.h, p.m, p.s));
    const again = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()).getTime();
    if (fresh !== again) failures.push('toTimestamp of new parts ' + ms + ' ' + fresh + ' ' + again);
}
// a wall-clock day keeps its date at local midnight in every zone (the one-day-off bug of UTC parsing)
const midnight = E.toTimestamp(E.make(2026, 11, 6));
const d = new Date(midnight);
if (d.getDate() !== 6 || d.getMonth() !== 10) failures.push('midnight ' + d.toString());
process.stdout.write(failures.length ? failures.join('; ') : 'ok');
