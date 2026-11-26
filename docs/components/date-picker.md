# aui-date-picker and aui-time-picker

The date and time field. One component for every type; `aui-time-picker` is the same component under a second
name, its type `time` unless given.

| `type` | |
|---|---|
| `date`, `daterange` | a day, or a range of days |
| `datetime`, `datetimerange` | a day and a time, or a range of them |
| `time`, `timerange` | a time of day, or a range of times |
| `month`, `monthrange`, `quarter`, `quarterrange`, `year`, `yearrange` | a month, quarter or year, or a range of them |
| `week` | an ISO week (or a week with another first day) |
| `dates` | several single days |

## Values

| Binding | Meaning | Default |
|---|---|---|
| `value-type` | `text`, `timestamp` (ms), `seconds` (Unix seconds), `date` (a Date object); the time types are always text | `text` |
| `read-seconds` | a number the page gives (or a text of 9-10 digits) is a time in seconds, not ms - one of 1e11 or more (a text of 13 digits) is milliseconds all the same (seconds that large would be past the year 5138, milliseconds since 1973 are all that large; `value-type="seconds"` reads numbers so too); the model then gets the field's own value (`value-type` text or date) in its place, quietly (the form stays pristine, no `on-change`) - for a server that sends seconds and takes the text back | off |
| `value-format` | the text format of the value | by type, below |
| `format` | what the field shows; its time units are the time columns (`HH:mm`: hours and minutes, `hh:mm A`: 12 hours) | `value-format` |
| `empty-value` | the value of an empty field | a text's `''` (a range of texts `['', '']`, dates `[]`); a timestamp's, seconds' or Date's `null` (a range of them `[null, null]`) |
| `boundary` | one value: `end` - it is the end of something (an end time): a picked day at its end (`23:59:59`, or `default-time`), the units its format hides their most (`HH:mm`: `:59`), a day typed or given without a time at its end, a month (quarter, year, week) at its last moment - as a range's end | `start` |
| `utc-offset` | `+hh:mm`: timestamps for this fixed offset instead of the browser's local time | local time |

| Type | `value-format` by default | Example |
|---|---|---|
| `date`, `daterange`, `dates` | `YYYY-MM-DD` | `2026-11-06` |
| `datetime`, `datetimerange` | `YYYY-MM-DD HH:mm:ss` | `2026-11-06 14:30:00` |
| `time`, `timerange` | `HH:mm:ss` | `14:30:00` |
| `month`, `monthrange` | `YYYY-MM` | `2026-11` |
| `quarter`, `quarterrange` | `YYYY-[Q]Q` | `2026-Q4` |
| `year`, `yearrange` | `YYYY` | `2026` |
| `week` | `GGGG-[W]WW` (ISO week) with Monday weeks; `YYYY-MM-DD` (its first day) with another `week-start` | `2026-W45` |

Format tokens: `YYYY` `MM` `M` `DD` `D` `HH` `H` `hh` `h` `mm` `m` `ss` `s` `A` `a` `Q` `WW` `W` `GGGG`, text in `[...]`.

An empty field is `''` for text values, never `null` (a null turned into a text by a page's code is "null", which a
parser rejects), and `null` for numbers and Dates (`''` would read as 0, 1970-01-01). From the page, `null`,
`undefined`, `''`, a blank text and the texts `"null"` and `"undefined"` are all read as empty, never as invalid.

Text values are wall-clock values: they are never read as UTC (the classic one-day-off bug of `new Date('2026-11-06')`),
the calendar math is done on whole numbers. A value read from the page in another form (`2026/11/06`,
`2026-11-06T14:30:00`, a number) is shown correctly and not written back until the user changes it (loading a record
never marks a form changed). A value with an explicit offset (`...Z`, `+02:00`) is an instant: it is shown in local
time (or `utc-offset`).

Ranges: `ng-model` holds `[start, end]`; or `start-model` and `end-model` hold the two ends (forms with two fields,
e.g. a promotion's start and end). A range's start fills the units its format lacks with their minimum, its end with
their maximum: a date range stored as date-times is `00:00:00` to `23:59:59`; a date-time range shown as
`YYYY-MM-DD HH:mm` keeps its start's seconds `00` and its end's `59`; a month range stored as date-times
(`value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM"`) is its first month's first day `00:00:00` to its last month's
last day `23:59:59`. `default-time` gives the time of a picked day: `'09:00:00'` (one value) or
`['08:00:00', '20:00:00']` (a range's start and end).

A time-only value (`time`, `timerange`) is its text (`HH:mm:ss` by default); its `$timestamp` is null.

## Times

| Binding | Meaning | Default |
|---|---|---|
| `hour-step`, `minute-step`, `second-step` | the options of the time columns | 1 |
| `disabled-time` | `disabled-time="vm.off($hour, $minute, $second, $end)"`: true for a time that cannot be set ($minute and $second null when an hour is asked, $second null for a minute; $end true for a range's end). A typed or given time whose hour or minute it refuses is refused too, as the panel turns that hour or minute off | none |
| `time-slots` | type `time`: one list of times instead of the columns, `'09:00-18:00/30m'` (`m`, `min` or `h`); a pick takes it. A definition that is no time range (minutes over 59, hours over 24, an end before its start, a step of nothing) is left out; a list may be as long as the day | none |
| `commit-on-close` | a whole, allowed draft is taken when the panel closes without OK | true |

A date is taken as it is picked. A time is set in a draft first: the day picked (its time kept), the columns (each
chosen option at the top of its column). The draft shows in the boxes while the panel is open; OK (or Enter) takes
it, Now takes this second (`$triggerSource` `now`), Escape drops it, and a press outside or leaving the field takes
it when it is whole and allowed (`commit-on-close`). OK is disabled, with the reason beside it, while the draft is
not whole, outside the limits or ends before it starts. An empty time shows no chosen option; the first one set gives
the others `00` (or the page's `default-time`).

A date-time range shows its start and end above the months; the one being set (the underline, see Picking a range) is
the one its time columns set, and a day picked keeps that end's time. Typed in its boxes: Enter in the start box moves
to the end box, Enter there takes both. A time range shows two groups of columns (start, end); its end comes after its start (a span over midnight, such as
a night shift, is a date-time range). Two months are shown beside the time columns from a 920px wide screen, one below
it; on a phone the columns are under the month.

The limits are to the second for the time types (`min="now"`, `min="2026-11-10 09:30:00"`): the hours, minutes and
seconds outside them are disabled for the day being set.

## Picking a range

The field shows which end the next pick sets: an underline under its box (the start or the end), while the panel is
open; a date-time range's Start and End above the months follow it. A pick sets that end:

- The start: the day picked; the end is kept if it still fits (after the start, within max-range / min-range), else
  cleared; the end is set next.
- The end: the day picked, after the start; a day before the start becomes the new start (the end set next again).
  With no start yet, the start is set next.
- A range of days or units is taken once its end is picked with its start there (or its start after its end), and
  the panel closes; a date-time range waits for OK (its times). A press outside, or leaving the field, keeps a whole
  range being set (commit-on-close); Escape steps back pick by pick, then closes with the value as it was.

So a range is changed at one end in one pick: open the end's box and pick the new end. Opening from the start's box
starts over at the start (the end kept while it fits). Opening on an end shows it (the start's month on the left, the
end's on the right); so does choosing the other end while open (its box, Tab, or its tab above the months): its month
comes into view unless it is shown already.

A date-time range is set end by end, each day then time. After an end's day its time is next: the time columns are
that end's, its time already there (`default-time`, else 00:00:00 for a start and 23:59:59 for an end, or the time it
had), outlined, with a short glow as the step begins; the footer says "Set the start time, or choose the end date" and
its button names the end it goes on to, "Next: End time" (texts `toEnd`, `toStart`; OK once the range is whole). It - or a
day from the start's on, picked straight away (the start keeps its time) - goes on to the end; a day before the start
is a new start. So whole days take two picks and OK, and a start time is never skipped by the panel moving on. Set
from its end first (opened on the end's box, no start yet): the same the other way - the end's day, its time ("Set the
end time, or choose the start date", text `setEndTime`), "Next: Start time" (or a day up to the end's, picked straight
away, is the start; a later day a new end), the start's day and time, OK. Keyboard: Enter on a day moves on to its
time; Enter there is that button (back to the days) or OK. Escape steps back through these steps too. One date-time: the same outline and glow
after its day.

Before a pick: the day (unit) under the pointer or the keyboard shows what the pick would make - the range drawn
lighter, the date in its box (muted, nothing taken; a date-time range's Start and End above the months too), the
range's length beside the pointer ("23 days"; months, quarters, years; a date-time range "8 days", "2 days 4 h"; it
follows a time changed meanwhile; a pick that sets the start, the end kept, is named: "Start · 22 days" - counted from
the pointer to the end, so on the start day it is the whole length; text `startAt`). Only while the pointer is on a day
that can be picked: anywhere else in the panel
(between the months, the header and its arrows, the time columns, the footer) nothing is previewed; on a day the
range's length rules out, the tip says why ("At most 14 days", "At least 2 days"; texts `atMost`, `atLeast`). A tip
over a day (unit) near the panel's side is moved in to stay inside the panel (it never runs out of it or makes it
scroll sideways). The keyboard's preview lasts while the focus is on the days. While another range is set, the one taken before is
outlined (what Escape goes back to). The footer says what to choose next ("Choose the end date") or the length of the
range set, and has OK (for a range set at its start only).

`durations="['7d', '14d', '1M']"`: once the start is set, chips in the footer set the end that far from it (a range of
days or units, both ends counted: `7d` from the 3rd is to the 9th; a date-time or time range, that time on), within the
limits (a chip that would leave them is disabled). A time range is of one day: a chip that would pass midnight is
disabled.

The panel's content is built at a field's first opening and kept while it is closed (hidden, its bindings out of the page's digests), so later openings only bring it up to date; at most ten fields keep a closed panel (the one closed longest ago builds its again when opened).

A whole range typed or pasted into one box (`2026-11-07 ~ 2026-11-29`; also a spaced `-`, `–`, `—`, `to`, or a comma)
fills both ends.

## Months, quarters, years

A page of months (a year), of quarters (a year, each with its months) or of years (a decade, with the year before and
after it muted); a range shows two pages side by side (one on narrow screens) with its band across them. The arrows
move a page; above months and quarters the year opens the year view to jump to another one. A pick takes the value at
once; a range is picked as in Picking a range, the band following the pointer.

The value is the unit (`2026-11`); `$start` and `$end` (its first and last day, `YYYY-MM-DD`) and `$timestamps` (its
first moment and its last second, ms) come with each change, for queries over the whole unit. Typing takes the unit
in the field's format, or a day (the unit it is in): `2026-11-06` typed into a month field is `2026-11`.

## Weeks

`type="week"`: a calendar whose rows are picked whole; the week under the pointer is drawn lighter, the value's week
as a band with its ends filled. ISO week numbers stand beside the rows with Monday weeks (`show-week-numbers="false"`
hides them; on the day types `show-week-numbers` shows them). With Monday weeks the value is the ISO week
(`2026-W45`, its year the ISO year: `2027-01-01` is in `2026-W53`), with another
`week-start` the week's first day. A change gives `$start`, `$end` (its first and last day) and `$timestamps`.
Typed: an ISO week in either case (`2026-w45`) or a day (its week).

## Several dates

`type="dates"`: days checked and unchecked one by one with the panel open (each change is taken at once, `pick`; the
page's digest runs once the picking pauses, as in aui-select's several values); OK closes. `max-count` limits how many:
once reached, the days not checked are disabled. The value is a list in order (`['2026-11-03', '2026-11-10']`; from
the page also a text with commas), the field shows the days separated by commas, typing takes them so (in any order,
each once). `$text` and `$timestamps` are lists.

## Limits

| Binding | Meaning |
|---|---|
| `min`, `max` | a value in `value-format`, or `today`, `now`, `today+30d`, `today-1y`, `now+2h` (days by the day; months, quarters, years and weeks by any day of them; date-times and times to the second) |
| `limits-new-only` | true: `min` / `max` hold for new picks and typing only - an end the page gave (a saved value) outside them stays valid and is kept (`min="today"`: past days cannot be picked, a past start saved before can still be saved) |
| `disabled-date` | `disabled-date="vm.closed($text, $parts, $timestamp, $unit)"`: true for one that cannot be picked; asked for each day (`$unit` `day`), or for each month, quarter, year or week (`$unit` that, `$parts` and `$timestamp` of its first day, `$text` in `value-format`); `$parts` has both names, `year`, `month`, `day` and `y`, `M`, `d` (as AuiDate's parts). A rule that throws refuses (the day is off, a value on it invalid) and its error goes to the application's `$exceptionHandler`, once until it answers again; the same for `disabled-time` |
| `max-range`, `min-range` | the longest / shortest range: `31d`, `2w`, `3M`, `12M`, `1y`, `12h`, `30min` (ranges of days and units by their days, both ends counted: `12M` from March is to the next February; date-time and time ranges by their time, at the shown precision: with `HH:mm`, 31 days from 10:00 is to 10:00 of the 31st day on) |
| `range-crosses-disabled` | true (default): a range may span disabled days, its ends may not be one; false: it may not - nor a month, quarter or year range a disabled month, quarter or year (while its end is set, the days or units past the nearest disabled one after the start cannot be; a typed or given range over one is invalid, `rangeCrossesDisabled`). The whole range is looked at, however long: `disabled-date` is asked for each of its days (units) once while the range stays as it is, and again when a value is taken |
| `max-count` | type `dates`: the most days that can be checked |

Limits apply in every view (a month or year outside min / max is disabled in the month and year views); the keyboard
skips disabled days and units. The calendar's own range is the years 1 to 9999: the days past it cannot be picked and
the months do not move past it.

A date typed outside min / max, or on a day or at a time the page refuses, is not taken: the box keeps the text,
marked, the field's error says why (`min`, `max`, `disabledDate`, `disabledTime`), the value stays as it was; Escape
shows the value again. (A range typed in the wrong order or longer / shorter than allowed is kept as typed and shown
invalid: its other end may be typed next.)

The model always holds what the field holds, valid or not, never `undefined` (which Angular writes into a model whose
value turns invalid, erasing it): a value the page or `api.setValue` gives outside the limits stays in the model and the
field shows it invalid; a page that changes `min` / `max` later never loses its value; a required field cleared holds
its empty value (`''`). The field sets ngModel's `allowInvalid` for this (a page's own `ng-model-options` are kept).

In a native form: with a `name`, the value goes with the form's own data too (a submit without Angular, `FormData`) -
hidden inputs of that name holding the text of what the model holds (a text value as it is, a timestamp its number, a
Date its text in `value-format`): one for a date, two for a range (start, end; `''` for an end not set), one per date
for `dates`; none while the field is disabled. `required` is also the boxes' own (a range's two), so the browser's
check of the form stops at an empty required field. A native reset of the form (`form.reset()`, a reset button) does
not change the model: the boxes show its value again.

A range outside max-range / min-range, or ending before it starts, cannot be picked: while its end is set, the days
(units) after the start that cannot end it are disabled (a day before the start can still be picked: it is a new
start); a date-time range's end day picked gets its time moved as little as needed into the limits; the time columns
of a date-time or time range disable the times its other end does not allow.
Only a typed range can be outside them: it is kept as typed and shown invalid (`rangeMax`, `rangeMin`, `rangeOrder`).

The checks on the field's ngModel (form.name.$error; the message line tells them with show-errors, error-messages or
error-text): `required`, `date` (a text that is not a value), `min`, `max`, `disabledDate`, `disabledTime`,
`rangeIncomplete` (one end only), `rangeOrder` (a typed start after its end: kept as typed, never swapped),
`rangeMax`, `rangeMin`, `rangeCrossesDisabled`, `maxCount`.

## Shortcuts

`shortcuts="true"` (a built-in set for the type), `shortcuts="['today', 'last7Days', 'thisMonth']"` (by name) or
`shortcuts="vm.items"` with `{label, value}` items, where `value` is a fixed value, a function `($now) => value`, or a
rule: `{offset: {days: -1}}`, `{last: 7, unit: 'day'}`, `{next: 30, unit: 'day'}`, `{this: 'month'}`,
`{previous: 'month'}`, `{from: {days: -6}, to: {days: 0}}`. Computed when clicked (a page left open overnight stays
right), with the week start; outside the limits a shortcut is shown disabled.

Built-in names - one value: `today`, `yesterday`, `tomorrow`, `weekAgo`, `startOfMonth`, `endOfMonth`, `now`
(date-times); for the month, quarter, year and week types also `thisWeek`, `lastWeek`, `nextWeek`, `thisMonth`,
`lastMonth`, `nextMonth`, `thisQuarter`, `lastQuarter`, `thisYear`, `lastYear`, `nextYear`. Ranges: `today`,
`yesterday`, `last7Days`, `last30Days`, `thisWeek`, `lastWeek`, `thisMonth`, `lastMonth`, `thisQuarter`, `thisYear`,
`next7Days`, `next30Days`, `next3Months`, `next6Months` (to the day before the same date 3 / 6 months on), `untilEndOfMonth`, `last3Months`, `last6Months`, `last12Months`, `yearToDate`, `lastYear`,
`last4Quarters`, `last5Years`, `last10Years`, `last24Hours`, `next24Hours` (date-time ranges). Day shortcuts give the
picked day's times (a date-time range: `00:00:00` to `23:59:59`); `now`, `last24Hours` and `next24Hours` are to the
second; for the unit types the days are their units (`last6Months` in a month range: this month and the five before); in a range of days or date-times `last3Months` / `last6Months` / `last12Months` run from the day after the same date 3 / 6 / 12 months ago to today.

`shortcuts="true"` gives - date: `today`, `yesterday`, `weekAgo`; daterange: `last7Days`, `last30Days`, `thisWeek`,
`lastWeek`, `thisMonth`, `lastMonth`; datetime: `now`, `today`, `yesterday`; datetimerange: `last24Hours`, `today`,
`last7Days`, `thisWeek`, `thisMonth`, `next7Days`; month: `thisMonth`, `lastMonth`, `nextMonth`; monthrange:
`last3Months`, `last6Months`, `last12Months`, `yearToDate`, `thisYear`, `lastYear`; quarter: `thisQuarter`,
`lastQuarter`; quarterrange: `last4Quarters`, `thisYear`, `lastYear`; year: `thisYear`, `lastYear`, `nextYear`;
yearrange: `last5Years`, `last10Years`; week: `thisWeek`, `lastWeek`, `nextWeek`. The time types and `dates` have none.

## Events and api

`on-change` is a call, `on-change="vm.changed($value, $text, $timestamp, $triggerSource, $byUser)"`, or a function
reference, `on-change="vm.changed"` (called with one object). Ranges also give `$start`, `$end`, `$timestamps`
(`[start, end]` in ms) and `$duration` (ms); a month, quarter, year or week gives `$start`, `$end` (its first and last
day) and `$timestamps`; dates give `$text` and `$timestamps` as lists. Timestamps are given whatever `value-type` is.
`$duration` is the end's timestamp minus the start's: with an end at :59 (a day's end, 23:59:59) it is one second less
than the length the panel shows ("18 days" is 17 days 23:59:59 in ms) - add 1000 ms for the length people count.
`$triggerSource`: `pick`, `input` (typed), `shortcut`, `now`, `clear`, `api`. A native `change` event follows on the
element.

`on-open`, `on-close`, `on-view-change="vm.load($year, $month)"` (the month shown changed: load availability for it).

`api="vm.dateApi"` receives `open()`, `close()`, `focus()`, `clear()`, `setValue(value)`, `getValue()`, `getText()`,
`getTimestamp()`, `getRange()` (a range's ends; a month, quarter, year or week: its first and last moment).

## AuiDate (the same engine for page code)

`AuiDate.parse(text, format)`, `format(value, format)`, `toTimestamp(value, format)`, `fromTimestamp(ms, format)`,
`add(value, n, unit, format)`, `diff(a, b, unit)`, `startOf(value, unit, format)`, `endOf(...)`, `compare(a, b)`,
`isValid(text, format)`, `today(format)`, `now(format)`. Page calculations and the picker always agree.
`diff` counts whole units from a to b, cut toward zero; in months, quarters and years a month counts once a + that
many months is reached as `add` counts them (Jan 31 + 1 month = Feb 28, so Jan 31 to Feb 28 is 1 month): `diff(a,
add(a, n, unit), unit)` is always n. A text with a sign before its first number (`-2026-11-07`) is not read.

## Field and panel

The field is the select's field (same height, border, label in the box or above it, sizes, clear button, invalid
look, message line) with a text box: typing is free (`2026-11-6`, `2026/11/06`, `20261106`; a time `930` or
`2026-11-08 930` is 09:30; a 12-hour time typed without AM / PM keeps the half of the day of the time it replaces,
else AM); the value changes on
Enter or on leaving the field with a complete, valid text; an unreadable text keeps the field invalid (`date`) until
fixed or cleared; Escape restores the value. A range field has two boxes with a thin arrow between them (a long
line, one barb: "to", not a direction to go; read out as "to", text `rangeTo`). A box shows a hint: the page's
(`placeholder`, a range's `start-placeholder` / `end-placeholder`), else the built-in one by type (the `date` texts:
`placeholder` "Select a date", `startPlaceholder` / `endPlaceholder`, `timePlaceholder`, ...; `""` also means the
built-in one). `show-placeholder="false"`: no hint; screen readers still hear the box's name. `disabled="..."` and
`readonly="..."`, or Angular's `ng-disabled` / `ng-readonly` (as on every aui field). The type is read once:
a field of another type is another field (`ng-if` / `ng-switch`). The panel's content is built at its first opening
(compiled once on the page, then copied): a field that is never opened costs little (about as much as an aui-input).

The panel: a header (year and month arrows; the month and the year open the month and year views), a day grid of
always six rows (the panel never changes height), muted days of the other months (the value and a range drawn on
them as on any day, lighter; in a range's two months, the days one month shows of the other are left out, so each
date is shown once - the same for the years beside two decades), today ringed, the value filled, a
range band with a preview while the end is picked (a tint a little lighter than a chosen range's, with dashed top and bottom edges: not chosen yet, and seen on any screen), two months side by side for ranges (one on narrow screens),
shortcuts on the side (on top on narrow screens). Week start: `week-start` (0 Sunday ... 6 Saturday), default 1
(Monday, ISO 8601). The month, quarter and year pages are as tall as a month of days. The window resized while the
panel is open (a phone turned, a split screen): as many months (pages) as now fit.

On a phone or a tablet, a press by touch (or a pen) opens the panel without the on-screen keyboard over it (the boxes'
`inputmode` is `none` while it is open); a tap in a box of the open panel brings the keyboard back for typing.

The panel is joined to the field as the selects' panels are: no gap, square where the two meet, its shadow away from
the field. It keeps its own width (a range's months are wider than the field, one month often narrower), so only the
corners where the two meet are square; a corner of either past the other's edge stays round (measured after each
placement, also when the panel is shifted into the screen).

After a pick with the pointer the focus stays in the box (Tab and typing go on from there) but the field looks as it
does without focus, no ring and no caret, until a key is pressed, as the selects after a pick with the mouse; after a
pick with the keyboard the focus shows. The time columns end at their last option (the chosen one at the top as far as
the column goes) and have a slim scrollbar, its thumb only while the pointer is over them.

A box too narrow for its text shows it shorter, only where nothing is lost, both boxes of a range alike: first the
seconds when they are a start's :00 and an end's :59, then the time when the range is whole days, then the year when
both ends are in this year. Each step is tried as it is, then with the letters a little closer (a fortieth of the font
size). What still does not fit ends in an ellipsis, drawn by the field itself (a browser does not draw one in a box
with the focus, as after a pick with the pointer). While any of it is shorter or cut, the whole value is the tooltip
of the field's value - its boxes, the arrow between them, the calendar icon: a range's two ends together
("2026-11-07 00:00:00 → 2026-11-29 23:59:59", an end not set: "Not set"); none while all of it shows (the label keeps
its own tooltip, its whole text when it is cut). A box's whole text comes back as soon as it is typed in or reached
with the keyboard, and the field fits again when it changes size.

Keyboard (WAI-ARIA date grid): in the box, ArrowDown or Alt+ArrowDown opens with the focus on the value's day (or
today's); with the panel already open, ArrowDown moves into the grid;
in the grid arrows move by a day or a week, PageUp/PageDown by a month, with Shift by a year, Home/End to the week's
start/end, Enter or Space picks, Escape returns to the box (and closes). On months, quarters and years: arrows by one
and by a row, PageUp/PageDown by a page, Enter or Space picks. The time columns are listboxes, one Tab stop each (the
grid, the columns, then OK): ArrowUp/ArrowDown set the previous or next option, Home/End the first or last,
ArrowLeft/ArrowRight move between the columns (to the chosen option, or the first that can be chosen), Enter takes the
draft (as OK); Escape drops the draft and closes. Tab also reaches the shortcuts, the duration chips, Today and Now. The
month and year lists the calendar's title opens are one Tab stop (ArrowDown from the box goes there too): arrows by one
and by a row, Home/End, Enter or Space chooses.
Screen readers: the box is a combobox with a dialog (a range's end box required and described as its start box); each
day (month, quarter, year) has its full name as label, selected and current states (`aria-current`, today's day and
this month, quarter, year); the days are a grid (multi-selectable for `dates`), the months, quarters and years lists of
options; a range's ends are selected as they are set (the preview under the pointer is drawn, not selected); a time
range's two sets of columns are groups named by their captions; week numbers are row headers. In high contrast mode
the keyboard's focus is an outline in the system's highlight colour and the arrows are drawn in its text colour.

Texts (weekday and month names, labels) are the `date` group of `auiTexts` (see [texts.md](../texts.md)): English, or the
page's language chosen once; a group (`shortcuts`, `length`, `unitNames`) is merged, so
`set({date: {length: {days: '{n} d'}}})` changes one text of it. A 12-hour value shows and reads the `am` / `pm` texts.

On a window under 640px wide the panel stays inside it (a time range's two sets of columns stand one under the
other), and a panel taller than the room on its side scrolls.

Values are to the whole second (a timestamp's milliseconds are kept while the value is not changed, never shown or
set). As the other fields, the field is laid out left to right and follows the browser's zoom, not a CSS `zoom` on
the page (see [fields.md](../fields.md)).
