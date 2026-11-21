/**
 * auiDateEngine and AuiDate: parsing, formatting and calendar arithmetic of the date picker.
 */
angular.module('aui')
    /**
     * auiDateEngine: the calendar arithmetic of the date pickers and of AuiDate, on whole numbers, with no Date object
     * and no time zone. A value is its parts {y, M, d, h, m, s} (M 1-12); a day is counted from 1970-01-01 (dayNumber);
     * the Gregorian calendar throughout (years 1 to 9999). Dates and times stay the wall-clock values they are written
     * as: nothing here reads them as UTC or moves them by an offset (new Date('2026-11-06') is UTC midnight: the day
     * before, in the evening of every time zone west of UTC). Only toTimestamp, fromTimestamp and now meet the clock:
     * in the browser's local time, or at a fixed offset (minutes east of UTC) when one is given.
     */
    .factory('auiDateEngine', ['auiTexts', function (allTexts) {
        const texts = allTexts.date;
        const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const FIELDS = ['y', 'M', 'd', 'h', 'm', 's'];
        // the units of add, diff, startOf, endOf, durations and relative keywords
        const UNIT_NAMES = {
            s: 'second', second: 'second', seconds: 'second', min: 'minute', minute: 'minute', minutes: 'minute',
            h: 'hour', hour: 'hour', hours: 'hour', d: 'day', day: 'day', days: 'day', w: 'week', week: 'week',
            weeks: 'week', M: 'month', month: 'month', months: 'month', Q: 'quarter', quarter: 'quarter',
            quarters: 'quarter', y: 'year', year: 'year', years: 'year'
        };
        const SECONDS = {second: 1, minute: 60, hour: 3600, day: 86400, week: 604800};

        function mod(a, n) {
            return ((a % n) + n) % n;
        }

        function isLeap(y) {
            return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        }

        function daysInMonth(y, M) {
            return M === 2 && isLeap(y) ? 29 : MONTH_DAYS[M - 1];
        }

        // days from 1970-01-01 (negative before it): H. Hinnant's days_from_civil, exact for every Gregorian date
        function dayNumber(y, M, d) {
            const year = M <= 2 ? y - 1 : y;
            const era = Math.floor(year / 400);
            const yoe = year - era * 400;
            const doy = Math.floor((153 * ((M + 9) % 12) + 2) / 5) + d - 1;
            const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
            return era * 146097 + doe - 719468;
        }

        function fromDayNumber(n) {
            const z = n + 719468;
            const era = Math.floor(z / 146097);
            const doe = z - era * 146097;
            const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
            const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
            const mp = Math.floor((5 * doy + 2) / 153);
            const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
            const M = mp < 10 ? mp + 3 : mp - 9;
            return {y: yoe + era * 400 + (M <= 2 ? 1 : 0), M: M, d: d};
        }

        function make(y, M, d, h, m, s) {
            return {y: y, M: M, d: d, h: h || 0, m: m || 0, s: s || 0};
        }

        function copy(p) {
            return make(p.y, p.M, p.d, p.h, p.m, p.s);
        }

        function isInt(value, min, max) {
            return typeof value === 'number' && Math.floor(value) === value && value >= min && value <= max;
        }

        function isValid(p) {
            return !!p && isInt(p.y, 1, 9999) && isInt(p.M, 1, 12) && isInt(p.d, 1, daysInMonth(p.y, p.M)) &&
                isInt(p.h, 0, 23) && isInt(p.m, 0, 59) && isInt(p.s, 0, 59);
        }

        // 0 Sunday ... 6 Saturday (1970-01-01 was a Thursday)
        function weekday(p) {
            return mod(dayNumber(p.y, p.M, p.d) + 4, 7);
        }

        function seconds(p) {
            return dayNumber(p.y, p.M, p.d) * 86400 + p.h * 3600 + p.m * 60 + p.s;
        }

        function fromSeconds(total) {
            const days = Math.floor(total / 86400);
            const rest = total - days * 86400;
            const day = fromDayNumber(days);
            return make(day.y, day.M, day.d, Math.floor(rest / 3600), Math.floor(rest / 60) % 60, rest % 60);
        }

        function compare(a, b) {
            for (let i = 0; i < FIELDS.length; i += 1) {
                const f = FIELDS[i];
                if (a[f] !== b[f]) return a[f] < b[f] ? -1 : 1;
            }
            return 0;
        }

        function compareDay(a, b) {
            return a.y !== b.y ? (a.y < b.y ? -1 : 1) : a.M !== b.M ? (a.M < b.M ? -1 : 1) : a.d !== b.d ? (a.d < b.d ? -1 : 1) : 0;
        }

        function unitOf(unit) {
            return UNIT_NAMES[unit] || null;
        }

        // n months on, the day kept where the month has it (Jan 31 + 1 month: Feb 28 or 29)
        function addMonths(p, n) {
            const total = p.y * 12 + (p.M - 1) + n;
            const y = Math.floor(total / 12);
            const M = mod(total, 12) + 1;
            return make(y, M, Math.min(p.d, daysInMonth(y, M)), p.h, p.m, p.s);
        }

        function addDays(p, n) {
            const day = fromDayNumber(dayNumber(p.y, p.M, p.d) + n);
            return make(day.y, day.M, day.d, p.h, p.m, p.s);
        }

        function add(p, n, unit) {
            const u = unitOf(unit);
            if (!u || !isFinite(n)) return copy(p);
            const whole = Math.trunc(n);
            if (u === 'month') return addMonths(p, whole);
            if (u === 'quarter') return addMonths(p, whole * 3);
            if (u === 'year') return addMonths(p, whole * 12);
            if (u === 'day') return addDays(p, whole);
            if (u === 'week') return addDays(p, whole * 7);
            return fromSeconds(seconds(p) + whole * SECONDS[u]);
        }

        // whole units from a to b (b - a, cut toward zero)
        function diff(a, b, unit) {
            const u = unitOf(unit);
            if (!u) return NaN;
            if (u === 'month' || u === 'quarter' || u === 'year') {
                let months = (b.y * 12 + b.M) - (a.y * 12 + a.M);
                // a month counts once a + that many months (as add counts them: Jan 31 + 1 month = Feb 28) is reached,
                // so that diff(a, add(a, n, unit), unit) is n
                if (months > 0 && compare(addMonths(a, months), b) > 0) months -= 1;
                else if (months < 0 && compare(addMonths(a, months), b) < 0) months += 1;
                return u === 'month' ? months : Math.trunc(months / (u === 'quarter' ? 3 : 12));
            }
            return Math.trunc((seconds(b) - seconds(a)) / SECONDS[u]);
        }

        function quarter(p) {
            return Math.floor((p.M - 1) / 3) + 1;
        }

        function startOf(p, unit, weekStart) {
            const u = unitOf(unit);
            switch (u) {
                case 'minute': return make(p.y, p.M, p.d, p.h, p.m, 0);
                case 'hour': return make(p.y, p.M, p.d, p.h, 0, 0);
                case 'day': return make(p.y, p.M, p.d);
                case 'week': return addDays(make(p.y, p.M, p.d), -mod(weekday(p) - (weekStart === undefined ? 1 : weekStart), 7));
                case 'month': return make(p.y, p.M, 1);
                case 'quarter': return make(p.y, (quarter(p) - 1) * 3 + 1, 1);
                case 'year': return make(p.y, 1, 1);
                default: return copy(p);
            }
        }

        function endOf(p, unit, weekStart) {
            const u = unitOf(unit);
            switch (u) {
                case 'minute': return make(p.y, p.M, p.d, p.h, p.m, 59);
                case 'hour': return make(p.y, p.M, p.d, p.h, 59, 59);
                case 'day': return make(p.y, p.M, p.d, 23, 59, 59);
                case 'week': {
                    const last = addDays(startOf(p, 'week', weekStart), 6);
                    return make(last.y, last.M, last.d, 23, 59, 59);
                }
                case 'month': return make(p.y, p.M, daysInMonth(p.y, p.M), 23, 59, 59);
                case 'quarter': {
                    const M = quarter(p) * 3;
                    return make(p.y, M, daysInMonth(p.y, M), 23, 59, 59);
                }
                case 'year': return make(p.y, 12, 31, 23, 59, 59);
                default: return copy(p);
            }
        }

        // ISO 8601 week: weeks start on Monday, week 1 holds the year's first Thursday
        function isoWeek(p) {
            const n = dayNumber(p.y, p.M, p.d);
            const thursday = n - mod(weekday(p) + 6, 7) + 3;
            const year = fromDayNumber(thursday).y;
            return {year: year, week: Math.floor((thursday - dayNumber(year, 1, 1)) / 7) + 1};
        }

        /** The day view of a month: always 42 days (six weeks) from the week start before its first day. */
        function monthGrid(y, M, weekStart) {
            const first = make(y, M, 1);
            const start = addDays(first, -mod(weekday(first) - (weekStart === undefined ? 1 : weekStart), 7));
            const n = dayNumber(start.y, start.M, start.d);
            const cells = [];
            for (let i = 0; i < 42; i += 1) {
                const day = fromDayNumber(n + i);
                cells.push({y: day.y, M: day.M, d: day.d, inMonth: day.M === M && day.y === y});
            }
            return cells;
        }

        // ------------------------------------------------------------------------------------------------ formats

        const TOKEN = /\[([^\]]*)]|YYYY|GGGG|MM|DD|HH|hh|mm|ss|WW|M|D|H|h|m|s|A|a|Q|W/g;
        const FIELD_OF = {
            YYYY: {f: 'y', min: 4, max: 4}, GGGG: {f: 'G', min: 4, max: 4},
            MM: {f: 'M', min: 1, max: 2}, M: {f: 'M', min: 1, max: 2}, DD: {f: 'd', min: 1, max: 2}, D: {f: 'd', min: 1, max: 2},
            HH: {f: 'h', min: 1, max: 2}, H: {f: 'h', min: 1, max: 2}, hh: {f: 'h12', min: 1, max: 2}, h: {f: 'h12', min: 1, max: 2},
            mm: {f: 'm', min: 1, max: 2}, m: {f: 'm', min: 1, max: 2}, ss: {f: 's', min: 1, max: 2}, s: {f: 's', min: 1, max: 2},
            Q: {f: 'Q', min: 1, max: 1}, WW: {f: 'W', min: 1, max: 2}, W: {f: 'W', min: 1, max: 2},
            A: {f: 'ampm'}, a: {f: 'ampm'}
        };
        const formatCache = {};

        function pad(n, width) {
            const text = String(Math.abs(n));
            return (n < 0 ? '-' : '') + (text.length >= width ? text : '0000'.slice(0, width - text.length) + text);
        }

        /** The format's pieces: {token, field} for each token, {literal} for the text between and in [...]. */
        function pieces(fmt) {
            const key = String(fmt);
            if (formatCache[key]) return formatCache[key];
            const list = [];
            let last = 0;
            key.replace(TOKEN, function (match, literal, offset) {
                if (offset > last) list.push({literal: key.slice(last, offset)});
                if (literal !== undefined) list.push({literal: literal});
                else list.push({token: match, field: FIELD_OF[match]});
                last = offset + match.length;
                return match;
            });
            if (last < key.length) list.push({literal: key.slice(last)});
            formatCache[key] = list;
            return list;
        }

        function format(p, fmt) {
            if (!p) return '';
            let week = null;
            const iso = function () { return week || (week = isoWeek(p)); };
            return pieces(fmt).map(function (piece) {
                if (piece.literal !== undefined) return piece.literal;
                const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
                switch (piece.token) {
                    case 'YYYY': return pad(p.y, 4);
                    case 'GGGG': return pad(iso().year, 4);
                    case 'MM': return pad(p.M, 2);
                    case 'M': return String(p.M);
                    case 'DD': return pad(p.d, 2);
                    case 'D': return String(p.d);
                    case 'HH': return pad(p.h, 2);
                    case 'H': return String(p.h);
                    case 'hh': return pad(h12, 2);
                    case 'h': return String(h12);
                    case 'mm': return pad(p.m, 2);
                    case 'm': return String(p.m);
                    case 'ss': return pad(p.s, 2);
                    case 's': return String(p.s);
                    case 'A': return p.h < 12 ? texts.am : texts.pm;
                    case 'a': return (p.h < 12 ? texts.am : texts.pm).toLowerCase();
                    case 'Q': return String(quarter(p));
                    case 'WW': return pad(iso().week, 2);
                    case 'W': return String(iso().week);
                    default: return '';
                }
            }).join('');
        }

        // an offset at the end of a time (an instant: 2026-11-06T06:30:00Z, ...+02:00), and fractions of a second
        const OFFSET_AT_END = /(\d{1,2}:\d{2}(?::\d{2})?)(?:[.,]\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

        function parseOffset(text) {
            const match = /^([+-])(\d{2}):?(\d{2})$/.exec(String(text || '').trim());
            if (!match) return null;
            const minutes = Number(match[2]) * 60 + Number(match[3]);
            return minutes > 18 * 60 ? null : (match[1] === '-' ? -minutes : minutes);
        }

        /**
         * A text read by a format, leniently: the format gives the order of the numbers, not their separators (any
         * non-digit separates: 2026-11-6, 2026/11/06, 2026.11.06, 2026-11-06T14:30), single digits are taken where the
         * format has two, and a text of digits alone is cut by the widths (20261106, 1430). A year has four digits
         * (a two-digit year is refused, not guessed). Letters must be the format's own ([W], [Q], AM/PM) or the T of
         * ISO texts. An offset at the end (Z, +02:00) makes it an instant: the result says so (offset, minutes east of
         * UTC). Returns {parts, missing, offset, ampm} - parts holds the numbers read, missing the fields the text did not
         * have (the format's last ones: a date without its time) - or null when the text is not one of the format.
         */
        function parse(text, fmt) {
            let rest = String(text === undefined || text === null ? '' : text).trim();
            if (!rest) return null;
            // a sign before the first number is no date or time (any other non-digit separates)
            if (/^[+-]\s*\d/.test(rest)) return null;
            const list = pieces(fmt);
            const fields = list.filter(function (piece) { return piece.field && piece.field.f !== 'ampm'; });
            const hasAmpm = list.some(function (piece) { return piece.field && piece.field.f === 'ampm'; });
            let offset;
            const end = OFFSET_AT_END.exec(rest);
            if (end && end[0] !== end[1]) {
                // fractions and an offset after the time: dropped from the text, the offset kept
                if (end[2]) {
                    offset = end[2].toUpperCase() === 'Z' ? 0 : parseOffset(end[2]);
                    if (offset === null) return null;
                }
                rest = rest.slice(0, end.index) + end[1];
            }
            let ampm = null;
            if (hasAmpm) {
                rest = rest.replace(/\b([ap])\.?\s*m\.?(?=\s|$)|([ap]m)\b/i, function (match) {
                    ampm = /^p/i.test(match) ? 'pm' : 'am';
                    return ' ';
                });
                // the page language's own words for them
                [['am', texts.am], ['pm', texts.pm]].forEach(function (half) {
                    const at = ampm ? -1 : rest.toLowerCase().indexOf(half[1].toLowerCase());
                    if (at < 0) return;
                    ampm = half[0];
                    rest = rest.slice(0, at) + ' ' + rest.slice(at + half[1].length);
                });
            }
            // letters: the format's own literal ones, and T
            const allowed = list.filter(function (piece) { return piece.literal !== undefined; }).map(function (piece) {
                return piece.literal;
            }).join('').replace(/[^A-Za-z]/g, '') + 'Tt';
            for (let i = 0; i < rest.length; i += 1) {
                const ch = rest.charAt(i);
                if (/[A-Za-z]/.test(ch) && allowed.indexOf(ch) < 0) return null;
            }
            const groups = rest.match(/\d+/g) || [];
            if (!groups.length) return null;
            const values = {};
            let g = 0;
            let at = 0;
            for (let i = 0; i < fields.length && g < groups.length; i += 1) {
                const field = fields[i].field;
                const group = groups[g];
                const left = group.length - at;
                let take;
                if (at === 0 && left <= field.max) take = left;               // the whole group (1 or 2 digits for 2)
                else if (left >= field.max) take = field.max;                 // digits run on: cut by the width
                else return null;                                             // too few digits left for this field
                if (take < field.min) return null;
                values[field.f] = Number(group.substr(at, take));
                at += take;
                if (at >= group.length) {
                    g += 1;
                    at = 0;
                }
            }
            if (g < groups.length) return null;                               // digits beyond the format
            const missing = fields.filter(function (piece) { return values[piece.field.f] === undefined; })
                .map(function (piece) { return piece.field.f; });
            if (values.h12 !== undefined) {
                if (values.h12 < 1 || values.h12 > 12) return null;
                values.h = (values.h12 % 12) + (ampm === 'pm' ? 12 : 0);
            }
            const parts = {y: values.y, M: values.M, d: values.d, h: values.h, m: values.m, s: values.s};
            // ISO week (GGGG-[W]WW): its Monday; quarter (YYYY-[Q]Q): its first day
            if (values.G !== undefined && values.W !== undefined) {
                if (values.W < 1 || values.W > 53) return null;
                const jan4 = make(values.G, 1, 4);
                const monday = addDays(jan4, -mod(weekday(jan4) + 6, 7) + (values.W - 1) * 7);
                if (isoWeek(monday).week !== values.W) return null;
                parts.y = monday.y;
                parts.M = monday.M;
                parts.d = monday.d;
            } else if (values.Q !== undefined) {
                if (values.Q < 1 || values.Q > 4) return null;
                parts.M = (values.Q - 1) * 3 + 1;
                if (parts.d === undefined) parts.d = 1;
            }
            // the numbers read must be possible ones
            if (parts.y !== undefined && !isInt(parts.y, 1, 9999)) return null;
            if (parts.M !== undefined && !isInt(parts.M, 1, 12)) return null;
            if (parts.d !== undefined && !isInt(parts.d, 1, daysInMonth(parts.y || 2000, parts.M || 1))) return null;
            if (parts.h !== undefined && !isInt(parts.h, 0, 23)) return null;
            if (parts.m !== undefined && !isInt(parts.m, 0, 59)) return null;
            if (parts.s !== undefined && !isInt(parts.s, 0, 59)) return null;
            return {parts: parts, missing: missing, offset: offset, ampm: ampm};
        }

        /**
         * Parts read by parse made whole: the units the text did not have filled with their least ('start': 00:00:00,
         * the first month and day) or their most ('end': 23:59:59, the last month and day). null when the date itself
         * is not complete enough (no year).
         */
        function complete(parts, fill) {
            if (!parts || parts.y === undefined) return null;
            const end = fill === 'end';
            const M = parts.M !== undefined ? parts.M : (end ? 12 : 1);
            const d = parts.d !== undefined ? parts.d : (end ? daysInMonth(parts.y, M) : 1);
            const p = make(parts.y, M, d,
                parts.h !== undefined ? parts.h : (end ? 23 : 0),
                parts.m !== undefined ? parts.m : (end ? 59 : 0),
                parts.s !== undefined ? parts.s : (end ? 59 : 0));
            return isValid(p) ? p : null;
        }

        // ------------------------------------------------------------------------------------------------ the clock

        function newDate(ms) {
            return new Date(ms);
        }

        /** Milliseconds of the wall-clock parts: in local time, or at offset (minutes east of UTC) when given. */
        function toTimestamp(p, offset) {
            if (!isValid(p)) return NaN;
            if (typeof offset === 'number' && isFinite(offset)) {
                return seconds(p) * 1000 - offset * 60000;
            }
            const date = newDate(0);
            date.setFullYear(p.y, p.M - 1, p.d);
            date.setHours(p.h, p.m, p.s, 0);
            return date.getTime();
        }

        function fromTimestamp(ms, offset) {
            if (typeof ms !== 'number' || !isFinite(ms)) return null;
            if (typeof offset === 'number' && isFinite(offset)) {
                return fromSeconds(Math.floor((ms + offset * 60000) / 1000));
            }
            const date = newDate(ms);
            const p = make(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
            return isValid(p) ? p : null;
        }

        function now(offset) {
            return fromTimestamp(Date.now(), offset);
        }

        /** "31d", "2w", "3M", "1y", "12h", "30min", "45s": {n, unit}, or null. */
        function parseDuration(text) {
            const match = /^\s*(\d+)\s*(min|s|h|d|w|M|Q|y)\s*$/.exec(String(text === undefined || text === null ? '' : text));
            return match ? {n: Number(match[1]), unit: UNIT_NAMES[match[2]]} : null;
        }

        /** "today", "now", "today+30d", "today-1y", "now+2h": the parts at that time from nowParts, or null. */
        function relative(text, nowParts) {
            const match = /^\s*(today|now)\s*(?:([+-])\s*(\d+)\s*(min|s|h|d|w|M|Q|y))?\s*$/.exec(String(text || ''));
            if (!match || !nowParts) return null;
            let base = match[1] === 'today' ? startOf(nowParts, 'day') : copy(nowParts);
            if (match[2]) base = add(base, (match[2] === '-' ? -1 : 1) * Number(match[3]), UNIT_NAMES[match[4]]);
            return base;
        }

        return {
            isLeap: isLeap,
            daysInMonth: daysInMonth,
            dayNumber: dayNumber,
            fromDayNumber: fromDayNumber,
            make: make,
            copy: copy,
            isValid: isValid,
            weekday: weekday,
            compare: compare,
            compareDay: compareDay,
            unitOf: unitOf,
            add: add,
            addDays: addDays,
            addMonths: addMonths,
            diff: diff,
            quarter: quarter,
            startOf: startOf,
            endOf: endOf,
            isoWeek: isoWeek,
            monthGrid: monthGrid,
            format: format,
            parse: parse,
            complete: complete,
            parseOffset: parseOffset,
            toTimestamp: toTimestamp,
            fromTimestamp: fromTimestamp,
            now: now,
            parseDuration: parseDuration,
            relative: relative
        };
    }])

    /**
     * AuiDate: the date pickers' engine for page code, so that a page's own calculations agree with its pickers (the
     * same reading of texts, the same month lengths and week start). A value is a text (in format, or any common form
     * when no format is given), a timestamp in ms, a Date (its local time), or parts. Texts out are in format
     * (YYYY-MM-DD HH:mm:ss unless given); options.utcOffset ('+hh:mm') for timestamps at a fixed offset.
     *   AuiDate.diff('2026-11-01', '2026-11-30', 'day')  -> 29
     *   AuiDate.add('2026-01-31', 1, 'month', 'YYYY-MM-DD')  -> '2026-02-28'
     *   AuiDate.toTimestamp('2026-11-06 14:30:00')  -> ms in local time
     */
    .factory('AuiDate', ['auiDateEngine', function (E) {
        const TEXT_FORMAT = 'YYYY-MM-DD HH:mm:ss';
        // the parts of a date (a year, a month, a day; an ISO week's year and week; a quarter)
        const DATE_FIELDS = ['y', 'M', 'd', 'G', 'W', 'Q'];

        function offsetOf(options) {
            return options && options.utcOffset !== undefined ? E.parseOffset(options.utcOffset) : undefined;
        }

        /** Parts of a value, or null. A text with an offset is an instant, shown in local time (or utcOffset). */
        function read(value, fmt, options) {
            if (value === null || value === undefined || value === '') return null;
            const offset = offsetOf(options);
            if (typeof value === 'number') return E.fromTimestamp(value, offset);
            if (value instanceof Date) return E.fromTimestamp(value.getTime(), offset);
            if (typeof value === 'object') return E.isValid(value) ? E.copy(value) : null;
            // in the format given; else (none, or a text of another form: a date-time where a date is asked for) read
            // as a date or date-time, which must then be at least a whole date (its time may be left out)
            // in the format given, when its date parts are all there (only its time may be left out)
            let parsed = fmt ? E.parse(value, fmt) : null;
            if (parsed && parsed.missing.some(f => DATE_FIELDS.indexOf(f) >= 0)) parsed = null;
            if (!parsed) {
                parsed = E.parse(value, TEXT_FORMAT);
                if (!parsed || parsed.parts.M === undefined || parsed.parts.d === undefined) return null;
            }
            const p = E.complete(parsed.parts, 'start');
            if (!p) return null;
            if (parsed.offset !== undefined) return E.fromTimestamp(E.toTimestamp(p, parsed.offset), offset);
            return p;
        }

        return {
            parse: function (text, fmt, options) { return read(text, fmt, options); },
            format: function (value, fmt, inFormat, options) {
                const p = read(value, inFormat, options);
                return p ? E.format(p, fmt || TEXT_FORMAT) : '';
            },
            toTimestamp: function (value, fmt, options) {
                const p = read(value, fmt, options);
                return p ? E.toTimestamp(p, offsetOf(options)) : NaN;
            },
            fromTimestamp: function (ms, fmt, options) {
                const p = E.fromTimestamp(ms, offsetOf(options));
                return p ? E.format(p, fmt || TEXT_FORMAT) : '';
            },
            add: function (value, n, unit, fmt) {
                const p = read(value, fmt);
                return p ? E.format(E.add(p, n, unit), fmt || TEXT_FORMAT) : '';
            },
            diff: function (a, b, unit, fmt) {
                const pa = read(a, fmt);
                const pb = read(b, fmt);
                return pa && pb ? E.diff(pa, pb, unit) : NaN;
            },
            startOf: function (value, unit, fmt, weekStart) {
                const p = read(value, fmt);
                return p ? E.format(E.startOf(p, unit, weekStart), fmt || TEXT_FORMAT) : '';
            },
            endOf: function (value, unit, fmt, weekStart) {
                const p = read(value, fmt);
                return p ? E.format(E.endOf(p, unit, weekStart), fmt || TEXT_FORMAT) : '';
            },
            compare: function (a, b, fmt) {
                const pa = read(a, fmt);
                const pb = read(b, fmt);
                return pa && pb ? E.compare(pa, pb) : NaN;
            },
            isValid: function (value, fmt) { return read(value, fmt) !== null; },
            today: function (fmt, options) { return E.format(E.startOf(E.now(offsetOf(options)), 'day'), fmt || 'YYYY-MM-DD'); },
            now: function (fmt, options) { return E.format(E.now(offsetOf(options)), fmt || TEXT_FORMAT); },
            engine: E
        };
    }]);
