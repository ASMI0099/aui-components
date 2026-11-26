/**
 * aui-date-picker and aui-time-picker: dates, times, ranges, months, quarters, years, weeks.
 */
angular.module('aui')
    /**
     * aui-date-picker / aui-time-picker: the date and time field of the aui family (docs/date-picker.md).
     * type: date, daterange, datetime, datetimerange, time, timerange, month, monthrange, quarter, quarterrange, year,
     * yearrange, week, dates. aui-time-picker is the same component under a second name, its type time unless given.
     *
     * The field is the select's field (same box, label, sizes, clear button, invalid look, message line) with text
     * boxes to type in; its panel a calendar (the day types: date, datetime, week, dates), time columns (the time
     * types) or both (the date-time types), or a grid of months, quarters or years, on the shared panel engine.
     *
     * Values are wall-clock texts by default (value-type="text"; value-format YYYY-MM-DD, YYYY-MM-DD HH:mm:ss or
     * HH:mm:ss), or timestamps (value-type="timestamp" ms, "seconds") or Date objects (value-type="date") for the date
     * types: never read as UTC. A range is ng-model="[start, end]", or start-model and end-model (a form's two fields).
     * A range's start fills the units its format does not show with their least, its end with their most (a date
     * range kept as date-times: 00:00:00 to 23:59:59; default-time; a month range kept as days: its first month's
     * first day to its last month's last day). A value from the page is shown as it is and written back only when the
     * user changes it.
     *
     * A date (a month, a week ...) is taken as it is picked; dates are checked one by one with the panel open. A time is
     * set in a draft first (the day picked, the columns), taken with OK, or as the panel closes (commit-on-close,
     * default on; Escape drops the draft).
     *
     * Digests: as the selects - moving in the panel, the pointer over it and typing digest this field only; a value
     * taken reaches the page in the close's own digest, the page's bindings after the close's first frame.
     */
    .component('auiDatePicker', (function () {
        // A function, not an object as the other components: its definition is registered twice (aui-date-picker and
        // aui-time-picker, below), and what comes first here is shared by every date field - made once, kept private.

        // one element measuring texts for every date field: the width a text takes in a box's own font
        let measureEl = null;
        // the letter spacing of a box a little too narrow (as .aui-date-picker__input--tight in the CSS)
        const TIGHT_SPACING = '-0.025em';

        // texts measured: their widths by font, letter spacing and text (a sweep of the pointer over the days measures
        // the same texts again); the fonts of the boxes, read once until a field fits again (forgetFont)
        const widthCache = new Map();
        const fontOf = new WeakMap();

        function forgetFont(box) {
            fontOf.delete(box);
        }

        // the panel's content: compiled at the first opening of a date field on the page (once), cloned into a field at
        // its own first opening - a field never opened keeps no copy of it (buildBody)
        let bodyLinker = null;
        const PANEL_BODY = `
                            <div class="aui-date-picker__body" aui-if="$ctrl.panelReady">
                                <div class="aui-date-picker__shortcuts" aui-if="$ctrl.shortcutItems.length > 0" role="group">
                                    <button type="button" class="aui-date-picker__shortcut"
                                            ng-repeat="s in $ctrl.shortcutItems track by $index"
                                            data-shortcut="{{ $index }}" ng-disabled="s.disabled"
                                            title="{{ s.disabled ? $ctrl.texts.shortcutOutside : '' }}">{{ s.label }}</button>
                                </div>
                                <div class="aui-date-picker__main">
                                    <!-- a date-time range: which end the time columns set -->
                                    <div class="aui-date-picker__ends" aui-if="$ctrl.type === 'datetimerange'" role="tablist">
                                        <button type="button" class="aui-date-picker__end" tabindex="-1" role="tab" data-act="end" data-end="0"
                                                ng-class="{'aui-date-picker__end--active': $ctrl.activeEnd === 0}"
                                                aria-selected="{{ $ctrl.activeEnd === 0 }}"><span class="aui-date-picker__end-label">{{ $ctrl.texts.start }}</span><span
                                                class="aui-date-picker__end-value" ng-class="{'aui-date-picker__end-value--empty': !$ctrl.endText(0), 'aui-date-picker__end-value--preview': $ctrl.endPreviewing(0)}">{{ $ctrl.endText(0) || $ctrl.texts.notSet }}</span></button>
                                        <span class="aui-date-picker__to" aria-hidden="true"></span>
                                        <button type="button" class="aui-date-picker__end" tabindex="-1" role="tab" data-act="end" data-end="1"
                                                ng-class="{'aui-date-picker__end--active': $ctrl.activeEnd === 1}"
                                                aria-selected="{{ $ctrl.activeEnd === 1 }}"><span class="aui-date-picker__end-label">{{ $ctrl.texts.end }}</span><span
                                                class="aui-date-picker__end-value" ng-class="{'aui-date-picker__end-value--empty': !$ctrl.endText(1), 'aui-date-picker__end-value--preview': $ctrl.endPreviewing(1)}">{{ $ctrl.endText(1) || $ctrl.texts.notSet }}</span></button>
                                    </div>
                                    <div class="aui-date-picker__content">
                                        <div class="aui-date-picker__calendars" aui-if="$ctrl.hasCalendar() && $ctrl.mode === 'day'">
                                            <div class="aui-date-picker__calendar" ng-repeat="cal in $ctrl.calendars track by cal.key"
                                                 ng-class="{'aui-date-picker__calendar--weeks': $ctrl.weekNumbers()}">
                                                <div class="aui-date-picker__header">
                                                    <span class="aui-date-picker__arrows">
                                                        <button type="button" class="aui-date-picker__arrow aui-date-picker__arrow--prev-year" tabindex="-1"
                                                                aui-if="cal.first" data-act="prev-year" aria-label="{{ $ctrl.texts.prevYear }}"></button>
                                                        <button type="button" class="aui-date-picker__arrow aui-date-picker__arrow--prev" tabindex="-1"
                                                                aui-if="cal.first" data-act="prev-month" aria-label="{{ $ctrl.texts.prevMonth }}"></button>
                                                    </span>
                                                    <span class="aui-date-picker__title" aria-live="polite"><span
                                                            class="aui-date-picker__title-piece" ng-repeat="part in cal.titleParts track by $index"><button
                                                            type="button" class="aui-date-picker__title-part" tabindex="-1" aui-if="part.kind !== 'text'"
                                                            data-act="{{ part.kind === 'month' ? 'month-view' : 'year-view' }}" data-cal="{{ cal.index }}"
                                                            aria-label="{{ part.kind === 'month' ? $ctrl.texts.chooseMonth : $ctrl.texts.chooseYear }}: {{ part.label }}">{{ part.label }}</button><span
                                                            class="aui-date-picker__title-text" aui-if="part.kind === 'text'">{{ part.label }}</span></span></span>
                                                    <span class="aui-date-picker__arrows aui-date-picker__arrows--end">
                                                        <button type="button" class="aui-date-picker__arrow aui-date-picker__arrow--next" tabindex="-1"
                                                                aui-if="cal.last" data-act="next-month" aria-label="{{ $ctrl.texts.nextMonth }}"></button>
                                                        <button type="button" class="aui-date-picker__arrow aui-date-picker__arrow--next-year" tabindex="-1"
                                                                aui-if="cal.last" data-act="next-year" aria-label="{{ $ctrl.texts.nextYear }}"></button>
                                                    </span>
                                                </div>
                                                <table class="aui-date-picker__grid" role="grid" aria-label="{{ cal.title }}"
                                                       ng-attr-aria-multiselectable="{{ $ctrl.isDates() ? 'true' : undefined }}">
                                                    <thead><tr>
                                                        <th class="aui-date-picker__week-head" aui-if="$ctrl.weekNumbers()" scope="col"
                                                            abbr="{{ $ctrl.texts.weekNumber }}">{{ $ctrl.texts.weekShort }}</th>
                                                        <th ng-repeat="w in $ctrl.weekdayHeads track by $index" scope="col" abbr="{{ w.long }}">{{ w.short }}</th>
                                                    </tr></thead>
                                                    <tbody>
                                                    <tr ng-repeat="week in cal.weeks track by week.key">
                                                        <td class="aui-date-picker__week-no" aui-if="$ctrl.weekNumbers()" role="rowheader"
                                                            aria-label="{{ $ctrl.texts.weekNumber }} {{ week.no }}">{{ week.no }}</td>
                                                        <td ng-repeat="c in week.days track by c.key" role="gridcell"
                                                            aria-selected="{{ $ctrl.dayIsSelected(c) }}"
                                                            ng-attr-aria-hidden="{{ c.hidden ? 'true' : undefined }}">
                                                            <button type="button" class="aui-date-picker__day {{ $ctrl.dayClass(c) }}"
                                                                    data-day="{{ c.key }}" tabindex="{{ $ctrl.dayTab(c) }}"
                                                                    aria-label="{{ c.label }}"
                                                                    aria-disabled="{{ c.noPick ? 'true' : 'false' }}"
                                                                    ng-attr-aria-current="{{ c.inMonth && $ctrl.isToday(c) ? 'date' : undefined }}"><span>{{ c.d }}</span></button>
                                                        </td>
                                                    </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        <div class="aui-date-picker__picker" aui-if="$ctrl.hasCalendar() && $ctrl.mode === 'month'">
                                            <div class="aui-date-picker__header">
                                                <span class="aui-date-picker__arrows">
                                                    <button type="button" class="aui-date-picker__arrow aui-date-picker__arrow--prev-year" tabindex="-1"
                                                            data-act="prev-year" aria-label="{{ $ctrl.texts.prevYear }}"></button>
                                                </span>
                                                <span class="aui-date-picker__title">
                                                    <button type="button" class="aui-date-picker__title-part" tabindex="-1" data-act="year-view"
                                                            aria-label="{{ $ctrl.texts.chooseYear }}">{{ $ctrl.modeYear() }}</button>
                                                </span>
                                                <span class="aui-date-picker__arrows aui-date-picker__arrows--end">
                                                    <button type="button" class="aui-date-picker__arrow aui-date-picker__arrow--next-year" tabindex="-1"
                                                            data-act="next-year" aria-label="{{ $ctrl.texts.nextYear }}"></button>
                                                </span>
                                            </div>
                                            <div class="aui-date-picker__cells" role="listbox" aria-label="{{ $ctrl.texts.chooseMonth }}">
                                                <button type="button" class="aui-date-picker__cell" tabindex="{{ m.tab ? 0 : -1 }}" role="option"
                                                        ng-repeat="m in $ctrl.monthList track by m.key"
                                                        ng-class="{'aui-date-picker__cell--current': m.current, 'aui-date-picker__cell--selected': m.selected}"
                                                        aria-selected="{{ m.selected ? 'true' : 'false' }}" ng-attr-aria-current="{{ m.current ? 'date' : undefined }}"
                                                        ng-disabled="m.disabled" data-act="pick-month" data-value="{{ m.key }}">{{ m.label }}</button>
                                            </div>
                                        </div>
                                        <div class="aui-date-picker__picker" aui-if="($ctrl.hasCalendar() || $ctrl.hasUnits()) && $ctrl.mode === 'year'">
                                            <div class="aui-date-picker__header">
                                                <span class="aui-date-picker__arrows">
                                                    <button type="button" class="aui-date-picker__arrow aui-date-picker__arrow--prev-year" tabindex="-1"
                                                            data-act="prev-years" aria-label="{{ $ctrl.texts.prevYears }}"></button>
                                                </span>
                                                <span class="aui-date-picker__title"><span class="aui-date-picker__title-text">{{ $ctrl.yearPageTitle() }}</span></span>
                                                <span class="aui-date-picker__arrows aui-date-picker__arrows--end">
                                                    <button type="button" class="aui-date-picker__arrow aui-date-picker__arrow--next-year" tabindex="-1"
                                                            data-act="next-years" aria-label="{{ $ctrl.texts.nextYears }}"></button>
                                                </span>
                                            </div>
                                            <div class="aui-date-picker__cells" role="listbox" aria-label="{{ $ctrl.texts.chooseYear }}">
                                                <button type="button" class="aui-date-picker__cell" tabindex="{{ y.tab ? 0 : -1 }}" role="option"
                                                        ng-repeat="y in $ctrl.yearList track by y.key"
                                                        ng-class="{'aui-date-picker__cell--current': y.current, 'aui-date-picker__cell--selected': y.selected, 'aui-date-picker__cell--edge': y.edge}"
                                                        aria-selected="{{ y.selected ? 'true' : 'false' }}" ng-attr-aria-current="{{ y.current ? 'date' : undefined }}"
                                                        ng-disabled="y.disabled" data-act="pick-year" data-value="{{ y.key }}">{{ y.label }}</button>
                                            </div>
                                        </div>
                                        <!-- months, quarters, years: a page each (a range: two) -->
                                        <div class="aui-date-picker__units" aui-if="$ctrl.hasUnits() && $ctrl.mode === 'unit'">
                                            <div class="aui-date-picker__unit-page" ng-repeat="page in $ctrl.unitPages track by page.key">
                                                <div class="aui-date-picker__header">
                                                    <span class="aui-date-picker__arrows">
                                                        <button type="button" class="aui-date-picker__arrow aui-date-picker__arrow--prev-year" tabindex="-1"
                                                                aui-if="page.first" data-act="prev-page"
                                                                aria-label="{{ page.unit === 'year' ? $ctrl.texts.prevYears : $ctrl.texts.prevYear }}"></button>
                                                    </span>
                                                    <span class="aui-date-picker__title" aria-live="polite"><button
                                                            type="button" class="aui-date-picker__title-part" tabindex="-1" aui-if="page.titleAct"
                                                            data-act="year-view" data-cal="{{ page.index }}"
                                                            aria-label="{{ $ctrl.texts.chooseYear }}: {{ page.title }}">{{ page.title }}</button><span
                                                            class="aui-date-picker__title-text" aui-if="!page.titleAct">{{ page.title }}</span></span>
                                                    <span class="aui-date-picker__arrows aui-date-picker__arrows--end">
                                                        <button type="button" class="aui-date-picker__arrow aui-date-picker__arrow--next-year" tabindex="-1"
                                                                aui-if="page.last" data-act="next-page"
                                                                aria-label="{{ page.unit === 'year' ? $ctrl.texts.nextYears : $ctrl.texts.nextYear }}"></button>
                                                    </span>
                                                </div>
                                                <div class="aui-date-picker__unit-cells aui-date-picker__unit-cells--{{ page.unit }}" role="listbox"
                                                     aria-label="{{ page.title }}" ng-attr-aria-multiselectable="{{ $ctrl.isRange() ? 'true' : undefined }}">
                                                    <button type="button" class="aui-date-picker__unit {{ $ctrl.unitClass(cell) }}"
                                                            ng-repeat="cell in page.cells track by cell.key"
                                                            data-y="{{ cell.y }}" data-m="{{ cell.M }}" tabindex="{{ $ctrl.unitTab(cell) }}"
                                                            role="option" aria-label="{{ cell.long }}" ng-attr-aria-hidden="{{ cell.hidden ? 'true' : undefined }}"
                                                            aria-selected="{{ $ctrl.unitIsSelected(cell) }}"
                                                            aria-disabled="{{ $ctrl.unitDisabled(cell) }}"
                                                            ng-attr-aria-current="{{ $ctrl.isCurrentUnit(cell) ? 'date' : undefined }}"><span class="aui-date-picker__unit-in"><span
                                                            class="aui-date-picker__unit-label">{{ cell.label }}</span><span
                                                            class="aui-date-picker__unit-sub" aui-if="cell.sub">{{ cell.sub }}</span></span></button>
                                                </div>
                                            </div>
                                        </div>
                                        <!-- the time columns (or the list of time-slots) -->
                                        <div class="aui-date-picker__tip" aria-hidden="true" aui-if="$ctrl.tip" ng-style="$ctrl.tip.style">{{ $ctrl.tip.text }}</div>
                                        <div class="aui-date-picker__clock" aui-if="$ctrl.hasClock()" ng-class="$ctrl.clockClass()">
                                            <div class="aui-date-picker__time-group" ng-repeat="g in $ctrl.timeGroups track by g.key"
                                                 ng-attr-role="{{ g.title ? 'group' : undefined }}"
                                                 ng-attr-aria-labelledby="{{ g.title ? $ctrl.compId + '-time-' + g.end : undefined }}">
                                                <div class="aui-date-picker__time-title" aui-if="g.title" id="{{ $ctrl.compId }}-time-{{ g.end }}">{{ g.title }}</div>
                                                <div class="aui-date-picker__columns">
                                                    <div class="aui-date-picker__column" ng-repeat="col in g.columns track by col.unit"
                                                         role="listbox" aria-label="{{ col.label }}" data-unit="{{ col.unit }}" data-group="{{ g.end }}">
                                                        <button type="button" class="aui-date-picker__time" role="option"
                                                                ng-repeat="it in col.items track by it.value"
                                                                ng-class="{'aui-date-picker__time--selected': it.selected}"
                                                                ng-disabled="it.disabled" aria-selected="{{ it.selected }}"
                                                                tabindex="{{ it.tab ? 0 : -1 }}"
                                                                data-unit="{{ col.unit }}" data-group="{{ g.end }}" data-value="{{ it.value }}">{{ it.label }}</button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="aui-date-picker__column aui-date-picker__column--slots" aui-if="$ctrl.usesSlots()"
                                                 role="listbox" aria-label="{{ $ctrl.texts.timePlaceholder }}" data-unit="slot" data-group="0">
                                                <button type="button" class="aui-date-picker__time" role="option"
                                                        ng-repeat="it in $ctrl.slotItems track by it.value"
                                                        ng-class="{'aui-date-picker__time--selected': it.selected}"
                                                        ng-disabled="it.disabled" aria-selected="{{ it.selected }}"
                                                        tabindex="{{ it.tab ? 0 : -1 }}"
                                                        data-index="{{ $index }}">{{ it.label }}</button>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- a range of days or units: duration chips, what to choose next (or its length), OK -->
                                    <div class="aui-date-picker__footer aui-date-picker__footer--range" aui-if="$ctrl.isRange() && !$ctrl.hasClock()">
                                        <span class="aui-date-picker__durations" aui-if="$ctrl.durationList.length > 0">
                                            <button type="button" class="aui-date-picker__duration"
                                                    ng-repeat="d in $ctrl.durationList track by d.spec"
                                                    data-act="duration" data-spec="{{ d.spec }}" ng-disabled="d.disabled">+{{ d.label }}</button>
                                        </span>
                                        <span class="aui-date-picker__status" aria-live="polite" aui-if="!$ctrl.problem()">{{ $ctrl.rangeStatus() }}</span>
                                        <span class="aui-date-picker__problem" aria-live="polite">{{ $ctrl.problem() }}</span>
                                        <button type="button" class="aui-date-picker__link aui-date-picker__clear" tabindex="-1" data-act="clear"
                                                aui-if="$ctrl.isClearable()" ng-disabled="!$ctrl.canClear()">{{ $ctrl.texts.clear }}</button>
                                        <button type="button" class="aui-date-picker__ok" data-act="ok"
                                                ng-disabled="!$ctrl.canTake()">{{ $ctrl.texts.ok }}</button>
                                    </div>
                                    <div class="aui-date-picker__footer" aui-if="$ctrl.showToday()">
                                        <button type="button" class="aui-date-picker__link" data-act="today">{{ $ctrl.texts.today }}</button>
                                    </div>
                                    <!-- dates: how many are checked; OK closes (each check is taken as it is made) -->
                                    <div class="aui-date-picker__footer aui-date-picker__footer--dates" aui-if="$ctrl.isDates()">
                                        <span class="aui-date-picker__count" aria-live="polite">{{ $ctrl.countText() }}</span>
                                        <button type="button" class="aui-date-picker__link aui-date-picker__clear" tabindex="-1" data-act="clear"
                                                aui-if="$ctrl.isClearable()" ng-disabled="!$ctrl.canClear()">{{ $ctrl.texts.clear }}</button>
                                        <button type="button" class="aui-date-picker__ok" data-act="done">{{ $ctrl.texts.ok }}</button>
                                    </div>
                                    <div class="aui-date-picker__footer aui-date-picker__footer--time" aui-if="$ctrl.hasClock() && !$ctrl.usesSlots()">
                                        <button type="button" class="aui-date-picker__link" data-act="now"
                                                aui-if="!$ctrl.isRange()" ng-disabled="!$ctrl.nowAllowed()">{{ $ctrl.texts.now }}</button>
                                        <span class="aui-date-picker__durations" aui-if="$ctrl.durationList.length > 0">
                                            <button type="button" class="aui-date-picker__duration"
                                                    ng-repeat="d in $ctrl.durationList track by d.spec"
                                                    data-act="duration" data-spec="{{ d.spec }}" ng-disabled="d.disabled">+{{ d.label }}</button>
                                        </span>
                                        <span class="aui-date-picker__status" aria-live="polite" aui-if="$ctrl.isRange() && !$ctrl.draftProblem">{{ $ctrl.rangeStatus() }}</span>
                                        <span class="aui-date-picker__problem" aria-live="polite">{{ $ctrl.draftProblem }}</span>
                                        <button type="button" class="aui-date-picker__link aui-date-picker__clear" tabindex="-1" data-act="clear"
                                                aui-if="$ctrl.isClearable()" ng-disabled="!$ctrl.canClear()">{{ $ctrl.texts.clear }}</button>
                                        <button type="button" class="aui-date-picker__ok" data-act="ok"
                                                ng-disabled="!$ctrl.canTake() && !$ctrl.canNext()">{{ $ctrl.okText() }}</button>
                                    </div>
                                </div>
                            </div>`;

        /**
         * A closed panel's body, kept for its next opening, out of the page's digests: each scope of it lends its watchers
         * aside (a digest walks scope.$$watchers; a watcher's deregistration keeps the array it was made in) and gets
         * them back as the panel opens - its bindings then catch up in that digest. Angular 1.5's scopes.
         */
        function suspendScope(scope) {
            const stash = [];
            const walk = s => {
                if (s.$$watchers && s.$$watchers.length) {
                    stash.push([s, s.$$watchers]);
                    s.$$watchers = [];
                }
                for (let c = s.$$childHead; c; c = c.$$nextSibling) walk(c);
            };
            walk(scope);
            return stash;
        }

        function resumeScope(stash) {
            stash.forEach(pair => {
                const s = pair[0];
                if (!s.$$watchers) return;                                  // destroyed meanwhile
                if (s.$$watchers.length) Array.prototype.push.apply(pair[1], s.$$watchers);
                s.$$watchers = pair[1];
            });
        }

        // the fields keeping a closed body (the one closed longest ago first); more than KEPT_BODIES: it gives its back
        const KEPT_BODIES = 10;
        const keptBodies = [];

        function textWidth(text, box, spacing) {
            let font = fontOf.get(box);
            if (!font) {
                const cs = window.getComputedStyle(box);
                font = {family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, style: cs.fontStyle, stretch: cs.fontStretch,
                    spacing: cs.letterSpacing, numeric: cs.fontVariantNumeric};
                font.key = [font.family, font.size, font.weight, font.style, font.stretch, font.numeric].join('|');
                fontOf.set(box, font);
            }
            const letters = spacing || font.spacing;
            const key = font.key + '|' + letters + '|' + text;
            const known = widthCache.get(key);
            if (known !== undefined) return known;
            if (!measureEl || !measureEl.isConnected) {
                measureEl = document.createElement('span');
                measureEl.setAttribute('aria-hidden', 'true');
                // nothing of the page's CSS (a page's span { padding; display } would change the width), then the box's font
                measureEl.style.cssText = 'all:initial;position:absolute;left:-10000px;top:-10000px;visibility:hidden;white-space:pre;pointer-events:none;';
                document.body.appendChild(measureEl);
            }
            const st = measureEl.style;
            st.fontFamily = font.family;
            st.fontSize = font.size;
            st.fontWeight = font.weight;
            st.fontStyle = font.style;
            st.fontStretch = font.stretch;
            st.letterSpacing = letters;
            st.fontVariantNumeric = font.numeric;
            measureEl.textContent = text;
            const width = measureEl.getBoundingClientRect().width;
            if (widthCache.size > 5000) widthCache.clear();
            widthCache.set(key, width);
            return width;
        }

        const definition = {
        require: {
            ngModelCtrl: '?ngModel'
        },
        bindings: {
            type: '@?',                  // date (default; aui-time-picker: time) and the others above
            valueType: '@?',             // date types: 'text' (default) | 'timestamp' (ms) | 'seconds' | 'date' (a Date)
            valueFormat: '@?',           // the value's text format (default by type)
            format: '@?',                // what the boxes show (default: value-format); its units give the time columns
            emptyValue: '<?',            // the value of an empty field (default null)
            utcOffset: '@?',             // '+hh:mm': timestamps at this offset (default: local time)
            startModel: '=?',            // a range's start (with end-model, instead of ng-model)
            endModel: '=?',              // a range's end
            defaultTime: '<?',           // the time of a picked day: '09:00:00' (one), ['00:00:00', '23:59:59'] (a range)
            boundary: '@?',              // one value: "end" - the end of something (an end time): filled as a range's end
            min: '@?',                   // the first allowed: a value, or today, now, today+30d, now-2h
            max: '@?',                   // the last allowed
            limitsNewOnly: '<?',         // min / max hold for new picks and typing only: an end the page gave stays valid
            readSeconds: '<?',           // the page's numbers are seconds; its model then gets the field's own value
            disabledDate: '&?',          // disabled-date="vm.closed($text, $parts, $timestamp, $unit)": true = cannot be picked
                                         // (asked for each day; month, quarter, year and week types: for each of those)
            disabledTime: '&?',          // disabled-time="vm.off($hour, $minute, $second, $end)": true = cannot be set
            hourStep: '@?',              // the time columns' steps (default 1)
            minuteStep: '@?',
            secondStep: '@?',
            timeSlots: '@?',             // type time: one list of times instead of columns, '09:00-18:00/30m'
            commitOnClose: '<?',         // a time's draft taken when the panel closes (default true)
            maxRange: '@?',              // a range's longest: 31d, 2w, 3M, 1y (date ranges: the days covered, both counted)
            minRange: '@?',              // a range's shortest
            rangeCrossesDisabled: '<?',  // false: a range may not span a disabled day (default true: only its ends may not be one)
            weekStart: '@?',             // 0 Sunday ... 6 Saturday (default 1, Monday)
            showWeekNumbers: '<?',       // ISO week numbers beside the weeks (Monday weeks; type week: shown unless false)
            maxCount: '@?',              // type dates: the most dates that can be checked
            durations: '<?',             // a range: lengths offered once its start is set, ['7d', '14d', '1M'] (its end from the start)
            shortcuts: '<?',             // true, ['today', 'last7Days', ...], or [{label, value}] (docs)
            placeholder: '@?',           // the box's hint; unset or "": the built-in one ("Select a date", ... by type)
            startPlaceholder: '@?',      // a range's boxes; unset or "": the built-in ones ("Start date" / "End date", ...)
            endPlaceholder: '@?',
            showPlaceholder: '<?',       // false: no hint in the boxes (their names stay for screen readers)
            name: '@?',
            compId: '@?',
            disabled: '<?',
            readonly: '<?',
            required: '<?ngRequired',
            clearable: '<?',
            showLabel: '<?',
            labelText: '@?',
            labelPosition: '@?',         // "top": the label above the box
            size: '@?',                  // "small" (28px) or "large" (40px); unset: 34px
            hintText: '@?',
            errorText: '@?',
            errorMessages: '<?',
            showErrors: '<?',
            borderRounded: '<?',
            borderRoundedLeftNone: '<?',
            borderRoundedRightNone: '<?',
            dropDownPositionStrategy: '@?',
            dropDownPanelBackgroundOpacity: '@?',
            api: '<?',                   // receives open, close, focus, clear, setValue, getValue, getText, getTimestamp, getRange
            onChange: '&?',              // on-change="fn($value, $text, $timestamp, $triggerSource, $byUser)" or a function
            onOpen: '&?',
            onClose: '&?',
            onViewChange: '&?'           // on-view-change="vm.load($year, $month)": the month shown changed
        },
        controller: ['$scope', '$element', '$attrs', '$timeout', 'auiControlKit', 'auiDropdownPanel', 'auiFieldExtras',
            'auiDateEngine', 'auiTexts', '$compile', '$exceptionHandler',
            function ($scope, $element, $attrs, $timeout, kit, dropdownPanel, fieldExtras, E, allTexts, $compile, $exceptionHandler) {
            const $ctrl = this;
            const texts = allTexts.date;
            // the kind of each type: what it picks (date: days; datetime: days and times; time: times; month, quarter,
            // year: those; week: a week in the calendar; dates: several days)
            const KINDS = {date: 'date', daterange: 'date', datetime: 'datetime', datetimerange: 'datetime', time: 'time', timerange: 'time',
                month: 'month', monthrange: 'month', quarter: 'quarter', quarterrange: 'quarter', year: 'year', yearrange: 'year',
                week: 'week', dates: 'dates'};
            const RANGES = {daterange: true, datetimerange: true, timerange: true, monthrange: true, quarterrange: true, yearrange: true};
            const FORMATS = {date: 'YYYY-MM-DD', datetime: 'YYYY-MM-DD HH:mm:ss', time: 'HH:mm:ss', month: 'YYYY-MM',
                quarter: 'YYYY-[Q]Q', year: 'YYYY', dates: 'YYYY-MM-DD'};
            const DAY_GRID = {date: true, datetime: true, week: true, dates: true};     // a calendar of days
            const UNIT_GRID = {month: true, quarter: true, year: true};                  // a grid of months, quarters, years
            const UNIT_COLUMNS = {month: 3, quarter: 2, year: 3};
            const TIME_DAY = E.make(2000, 1, 1);  // the day of a time-only value (its date is not part of it)
            const NARROW_PX = 640;               // below this width a range shows one month
            const NARROW_TIME_PX = 920;          // ... a date-time range (its time columns beside the months)
            const SEARCH_LIMIT = 400;            // days the keyboard looks for an enabled day in one direction
            const SHORTCUTS = {
                date: ['today', 'yesterday', 'weekAgo'],
                daterange: ['last7Days', 'last30Days', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth'],
                datetime: ['now', 'today', 'yesterday'],
                datetimerange: ['last24Hours', 'today', 'last7Days', 'thisWeek', 'thisMonth', 'next7Days'],
                month: ['thisMonth', 'lastMonth', 'nextMonth'],
                monthrange: ['last3Months', 'last6Months', 'last12Months', 'yearToDate', 'thisYear', 'lastYear'],
                quarter: ['thisQuarter', 'lastQuarter'],
                quarterrange: ['last4Quarters', 'thisYear', 'lastYear'],
                year: ['thisYear', 'lastYear', 'nextYear'],
                yearrange: ['last5Years', 'last10Years'],
                week: ['thisWeek', 'lastWeek', 'nextWeek']
            };

            $ctrl.texts = texts;
            $ctrl.isOpen = false;
            $ctrl.panelReady = false;
            $ctrl.mode = 'day';                  // the panel's view: 'day', 'month', 'year' (moving), 'unit' (picking units)
            $ctrl.calendars = [];
            $ctrl.unitPages = [];
            $ctrl.boxTexts = ['', ''];           // what the boxes hold (typed or the value)
            $ctrl.boxBad = [false, false];       // a box holds a text that is not a date
            $ctrl.shortcutItems = [];
            $ctrl.timeGroups = [];
            $ctrl.slotItems = [];
            $ctrl.activeEnd = 0;                 // a range's end the time columns set (0 start, 1 end)
            $ctrl.draftProblem = '';             // why OK cannot take the draft ('' when it can)

            let triggerEl = null;
            let panelEl = null;
            let panelCtl = null;
            let dismiss = null;
            let stopFocusLeave = null;
            let stopQuietFocus = null;
            let stopLabelTip = null;
            let destroyed = false;
            let closeFinishing = false;
            let value = null;                    // the value taken: parts, {start, end} (a range), {bad} or null
            let given = null;                    // the value as the page last gave it (limits-new-only)
            let bodyAside = null;                // a closed panel's kept body: its watchers set aside (suspendScope)
            let draft = null;                    // the time types' value in the panel, until taken
            let hoverDay = null;                 // the day (unit, week) under the pointer (a range: its pick previewed)
            let hoverEl = null;                  // its element (the tip above it), or the one of blockedDay
            let hoverByKeys = false;             // hoverDay is the keyboard's (ends when the focus leaves the calendar)
            let blockedDay = null;               // a day (unit) under the pointer a range's length rules out (the tip: why)
            let timeStep = null;                 // a date-time's end whose day was just picked: its time is set next (0, 1)
            let stepPulse = 0;                   // the steps begun (the time columns' glow shown again for each)
            let history = [];                    // a range's picks while open, {draft, active}: Escape steps back through them
            let touchedEnd = false;              // a range's end picked while open (a start picked after it completes it)
            let previewMemo = {hover: null, draft: null, active: -1, result: null};
            let activeDay = null;                // the keyboard's day (unit) in the panel
            let activeBox = 0;                   // the box a range's typing and picking fill
            let viewY = 0;                       // the first month or unit page shown (year types: its decade)
            let viewM = 1;
            let modeTarget = 0;                  // the calendar whose month or year view is open
            let yearPageStart = 0;
            let limits = {min: null, max: null};
            let twoModels = false;
            let mirrorCtrl = null;
            let offset;                          // utc-offset in minutes, or undefined (local time)
            let lastViewKey = '';
            let scrollSmooth = false;            // the next column scroll follows a pick (smooth) or an opening

            /** The field's ngModel: the page's, or the inner one of start-model / end-model. */
            const model = () => (twoModels ? mirrorCtrl : $ctrl.ngModelCtrl);

            $ctrl.field = fieldExtras.create({
                ctrl: $ctrl,
                attrs: $attrs,
                ngModel: model,
                invalidShown: () => $ctrl.showInvalid(),
                limits: () => ({min: $ctrl.min || '', max: $ctrl.max || ''}),
                id: () => $ctrl.compId
            });

            const pageDigest = kit.createPageDigest($scope, () => $element[0]);

            function localDigest() {
                if (!destroyed) kit.digestOwn($scope);
            }

            // an opening by the user with an on-open: the panel drawn first, on-open (page code) after its first frame,
            // in one digest of the page (kit.createOpening; before, that digest ran first: on a large page the press
            // seemed to do nothing for its length)
            const pageAsk = kit.createOpening($scope, localDigest);
            function openFromInput(focusInside) {
                if ($ctrl.onOpen) pageAsk.open(() => openPanel(focusInside));
                else settle(false, () => openPanel(focusInside));
            }

            // as the selects: inside a digest the work runs there; else this field's own digest, or the page's
            function settle(pageWide, fn) {
                if ($scope.$root.$$phase) {
                    fn();
                    return;
                }
                if (pageWide) {
                    pageDigest.forget();
                    $scope.$apply(fn);
                    return;
                }
                fn();
                localDigest();
            }

            const kind = () => KINDS[$ctrl.type] || 'date';
            $ctrl.isRange = () => RANGES[$ctrl.type] === true;
            $ctrl.hasCalendar = () => DAY_GRID[kind()] === true;
            $ctrl.hasUnits = () => UNIT_GRID[kind()] === true;
            $ctrl.hasClock = () => kind() === 'datetime' || kind() === 'time';
            $ctrl.isWeek = () => kind() === 'week';
            $ctrl.isDates = () => kind() === 'dates';
            // one value that is the end of something (boundary="end"): its missing units filled with their most
            const singleEnd = () => $ctrl.boundary === 'end' && !$ctrl.isRange() && !$ctrl.isDates();
            // the unit a value is (month, quarter, year, week), or null (a day, a time)
            const unit = () => (UNIT_GRID[kind()] || kind() === 'week' ? kind() : null);
            $ctrl.usesSlots = () => $ctrl.type === 'time' && !!parseSlots();
            $ctrl.isReadonly = () => kit.readFlag($attrs, 'readonly', $ctrl.readonly, false);
            $ctrl.isDisabled = () => kit.readFlag($attrs, 'disabled', $ctrl.disabled, false);
            $ctrl.isRequired = () => $ctrl.required === true ||
                ($attrs.hasOwnProperty('required') && $attrs.required !== false && $attrs.required !== 'false' && $ctrl.required !== false);
            $ctrl.isClearable = () => kit.readFlag($attrs, 'clearable', $ctrl.clearable, false);
            $ctrl.showInvalid = function () {
                const m = model();
                return !!(m && m.$invalid && m.$touched);
            };
            const commitOnClose = () => $ctrl.commitOnClose !== false && $ctrl.commitOnClose !== 'false';

            // ------------------------------------------------------------------------------------- formats, values

            // a week: its ISO text (GGGG-[W]WW) with Monday weeks, else its first day
            const valueFormat = () => $ctrl.valueFormat ||
                (kind() === 'week' ? (weekStart() === 1 ? 'GGGG-[W]WW' : 'YYYY-MM-DD') : FORMATS[kind()]);
            const displayFormat = () => $ctrl.format || valueFormat();
            const valueType = () => (kind() !== 'time' && ['timestamp', 'seconds', 'date'].indexOf($ctrl.valueType) >= 0 ? $ctrl.valueType : 'text');
            // read-seconds: numbers (and texts of 9-10 digits) from the page are seconds (a text or Date value only)
            const secondsIn = () => kind() !== 'time' && (valueType() === 'text' || valueType() === 'date') &&
                kit.readFlag($attrs, 'readSeconds', $ctrl.readSeconds, false);
            const stampText = v => typeof v === 'string' && /^(\d{9,10}|\d{13})$/.test(v.trim());
            // a number in seconds (read-seconds, value-type seconds) as milliseconds - one of 1e11 or more is milliseconds
            // already: seconds that large are past the year 5138, milliseconds since March 1973 are all that large
            const stampMs = n => ((valueType() === 'seconds' || secondsIn()) && Math.abs(n) < 1e11 ? n * 1000 : n);
            const weekStart = () => {
                const n = parseInt($ctrl.weekStart, 10);
                return n >= 0 && n <= 6 ? n : 1;
            };
            // an empty field's value (empty-value, else): a text's '' (a string a page can always read and send: null
            // turned into a text is "null"), a number's or a Date's null ('' would be read as 0, 1970-01-01), a list of
            // dates []; a range of texts ['', ''] (each end a safe ''); one end of a range alone (two models): its ''
            const emptyOne = () => ($attrs.hasOwnProperty('emptyValue') ? $ctrl.emptyValue : (valueType() === 'text' ? '' : null));
            const emptyValue = () => {
                if ($attrs.hasOwnProperty('emptyValue')) return $ctrl.emptyValue;
                if ($ctrl.isDates()) return [];
                if ($ctrl.isRange()) return valueType() === 'text' ? ['', ''] : [null, null];
                return emptyOne();
            };
            // no value: null, undefined, '' or blank, and the texts "null" and "undefined" (a null a page's code turned
            // into a text) - shown empty, never invalid
            const blankValue = x => x === null || x === undefined || (typeof x === 'number' && isNaN(x)) ||
                (typeof x === 'string' && /^\s*(null|undefined)?\s*$/i.test(x));
            // the page's empty-value (or one end of it) read back: empty (an empty-value [] or ['', ''] is blank anyway)
            const isEmptyMarker = x => $attrs.hasOwnProperty('emptyValue') && !blankValue(x) &&
                (angular.equals(x, $ctrl.emptyValue) ||
                    (Array.isArray($ctrl.emptyValue) && $ctrl.emptyValue.some(e => !blankValue(e) && angular.equals(x, e))));
            let todayDay = null;
            const today = () => todayDay || (todayDay = E.startOf(E.now(offset), 'day'));
            const freshToday = () => { todayDay = null; return today(); };
            const onTimeDay = p => E.make(TIME_DAY.y, TIME_DAY.M, TIME_DAY.d, p.h, p.m, p.s);
            const withTime = (day, time) => E.make(day.y, day.M, day.d, time.h, time.m, time.s);

            /** The time units the boxes show (the time columns are these): {h, m, s, twelve, ampm}. */
            function shownUnits() {
                const fmt = displayFormat().replace(/\[[^\]]*]/g, '');
                const twelve = /h/.test(fmt);
                return {h: /[Hh]/.test(fmt), m: /m/.test(fmt), s: /s/.test(fmt), twelve: twelve, ampm: twelve && /[Aa]/.test(fmt)};
            }

            /** A value's units the boxes do not show: their least (a start, one value) or their most (a range's end, one
             * value with boundary="end"). */
            function finish(p, end) {
                if (!p || isBad(p) || !$ctrl.hasClock()) return p;
                const most = end || singleEnd();
                const shows = shownUnits();
                const q = E.copy(p);
                if (!shows.h) q.h = most ? 23 : 0;
                if (!shows.m) q.m = most ? 59 : 0;
                if (!shows.s) q.s = most ? 59 : 0;
                return q;
            }

            // a time's text: typed (the boxes' format first) or the page's (the value's format first); 24 or 12 hours
            function readTime(textValue, typed, end) {
                const t = typed ? oneDigitHour(String(textValue).trim()) : String(textValue).trim();
                const formats = typed ? [displayFormat(), valueFormat()] : [valueFormat(), displayFormat()];
                const parsed = E.parse(t, formats[0]) || E.parse(t, formats[1]) || E.parse(t, 'HH:mm:ss') || E.parse(t, 'h:mm:ss A');
                return parsed && parsed.parts.h !== undefined ? (typed ? keepHalf(parsed, end) : parsed) : null;
            }

            // a time typed in digits with a one-digit hour ("930", "93015"; a date-time's "2026-11-08 930"): its 0 added
            const oneDigitHour = t => (/^\d{3}$|^\d{5}$/.test(t) ? '0' + t : t.replace(/([\sTt])(\d{3}|\d{5})$/, '$10$2'));

            /** A 12-hour time typed without AM / PM: in the half of the day of the time it replaces (none: AM). */
            function keepHalf(parsed, end) {
                if (!parsed || parsed.ampm || parsed.parts.h === undefined || parsed.parts.h >= 12 || !/[Aa]/.test(displayFormat().replace(/\[[^\]]*]/g, ''))) {
                    return parsed;
                }
                const was = $ctrl.isRange() ? rangeOf(value)[end ? 'end' : 'start'] : value;
                if (good(was) && was.h >= 12) parsed.parts.h += 12;
                return parsed;
            }

            /** The time of a picked day (default-time): a range's start or end, or one value's. */
            function dayTime(end) {
                const given = $ctrl.defaultTime;
                const read = (textValue, fill) => {
                    const r = textValue ? E.parse(textValue, 'HH:mm:ss') : null;
                    const p = r ? E.complete(Object.assign({}, r.parts, {y: 2000, M: 1, d: 1}), fill) : null;
                    return p || (fill === 'end' ? E.make(2000, 1, 1, 23, 59, 59) : E.make(2000, 1, 1));
                };
                if (!$ctrl.isRange()) return read(typeof given === 'string' ? given : (Array.isArray(given) ? given[0] : ''), singleEnd() ? 'end' : 'start');
                const list = Array.isArray(given) ? given : [];
                return end ? read(list[1], 'end') : read(list[0], 'start');
            }

            /** A day picked as a value: its time the default one (a time type keeps the draft's time). */
            function dayValue(day, end, keepTime) {
                return withTime(day, keepTime && !isBad(keepTime) ? keepTime : dayTime(end));
            }

            const unitStart = p => (unit() ? E.startOf(p, unit(), weekStart()) : p);
            const unitEnd = p => (unit() ? E.endOf(p, unit(), weekStart()) : p);

            /** A value of the month, quarter, year and week types made its unit: its first day (a start, one value), or
             * its last day's end (a range's end: 23:59:59). Other values as they are. */
            function snap(p, end) {
                if (!unit() || !p || isBad(p)) return p;
                const q = end ? unitEnd(p) : unitStart(p);
                // a week at the edge of the calendar (its first day before year 1, its last after 9999): no value
                return E.isValid(q) ? q : {bad: E.format(p, displayFormat())};
            }

            // the parts a text must have for a value of this type (a year: its year; a month, a quarter: also its month)
            function whole(parts) {
                if (parts.y === undefined) return false;
                if (kind() === 'year') return true;
                if (kind() === 'month' || kind() === 'quarter') return parts.M !== undefined;
                return parts.M !== undefined && parts.d !== undefined;
            }

            /** The page's value as parts (a range end filled with the end of its units), {bad: text}, or null. */
            function readValue(raw, end) {
                // an end equal to empty-value (EMPTY, 0) is empty: it read as an error or as the epoch's day
                if (blankValue(raw) || isEmptyMarker(raw)) return null;
                if (kind() === 'time') {
                    if (typeof raw === 'number' || E.isDate(raw)) {
                        const p = E.fromTimestamp(typeof raw === 'number' ? raw : raw.getTime(), offset);
                        return p ? onTimeDay(p) : {bad: String(raw)};
                    }
                    const parsed = readTime(raw, false);
                    if (!parsed) return {bad: String(raw)};
                    const p = E.complete(Object.assign({}, parsed.parts, {y: TIME_DAY.y, M: TIME_DAY.M, d: TIME_DAY.d}), end ? 'end' : 'start');
                    return p ? onTimeDay(p) : {bad: String(raw)};
                }
                if (secondsIn() && stampText(raw)) raw = Number(raw);
                if (typeof raw === 'number') {
                    const p = E.fromTimestamp(stampMs(raw), offset);
                    return p ? snap(p, end) : {bad: String(raw)};
                }
                // a Date (also one from another window: a frame's)
                if (E.isDate(raw)) {
                    const p = E.fromTimestamp(raw.getTime(), offset);
                    return p ? snap(p, end) : {bad: ''};
                }
                const textValue = String(raw);
                const parsed = E.parse(textValue, valueFormat()) || E.parse(textValue, 'YYYY-MM-DD HH:mm:ss');
                if (!parsed || !whole(parsed.parts)) return {bad: textValue};
                const p = E.complete(parsed.parts, end ? 'end' : 'start');
                if (!p) return {bad: textValue};
                return snap(parsed.offset !== undefined ? E.fromTimestamp(E.toTimestamp(p, parsed.offset), offset) : p, end);
            }

            /** Parts as the page's value. */
            function writeValue(p) {
                if (!p) return emptyValue();
                switch (valueType()) {
                    case 'timestamp': return E.toTimestamp(p, offset);
                    case 'seconds': return Math.floor(E.toTimestamp(p, offset) / 1000);
                    case 'date': return new Date(E.toTimestamp(p, offset));
                    default: return E.format(p, valueFormat());
                }
            }

            const isBad = p => !!(p && p.bad !== undefined);
            const text = p => (p && !isBad(p) ? E.format(p, displayFormat()) : (isBad(p) ? p.bad : ''));
            const stamp = p => (p && !isBad(p) && kind() !== 'time' ? E.toTimestamp(p, offset) : null);
            const good = p => !!(p && !isBad(p));

            function rangeOf(v) {
                return v && $ctrl.isRange() && !isBad(v) ? v : {start: null, end: null};
            }

            const rangeParts = () => rangeOf(value);

            // ------------------------------------------------------------------------------------- limits

            function resolveLimit(textValue, end) {
                if (!textValue) return null;
                const now = E.now(offset);
                const rel = E.relative(textValue, now);
                if (rel) return kind() === 'time' ? onTimeDay(rel) : rel;
                const p = readValue(textValue, end);
                return good(p) ? p : null;
            }

            function refreshLimits() {
                freshToday();
                limits = {min: resolveLimit($ctrl.min, false), max: resolveLimit($ctrl.max, true)};
                // what was found against the old limits and rules is looked at again
                crossings.clear();
                blocks = {key: '', after: null, reached: null};
            }

            // a value against min / max: date-times and times to the second; a day, month, quarter, year or week by any
            // part of it (a month is allowed when one of its days is)
            function inLimits(p) {
                if ($ctrl.hasClock()) {
                    if (limits.min && E.compare(p, limits.min) < 0) return false;
                    return !(limits.max && E.compare(p, limits.max) > 0);
                }
                if (limits.min && E.compareDay(unitEnd(p), limits.min) < 0) return false;
                return !(limits.max && E.compareDay(unitStart(p), limits.max) > 0);
            }

            // the page's disabled-date: asked for a day, or for the month, quarter, year or week a value is ($unit, its
            // first day's parts and timestamp, its text in value-format)
            function pageRefuses(p) {
                if (!($ctrl.disabledDate instanceof Function) || kind() === 'time') return false;
                const first = E.startOf(unitStart(p), 'day');
                return askRule('date', () => $ctrl.disabledDate({$text: E.format(first, valueFormat()),
                    $parts: {year: first.y, month: first.M, day: first.d, y: first.y, M: first.M, d: first.d},
                    $timestamp: E.toTimestamp(first, offset), $unit: unit() || 'day'}));
            }

            /**
             * One answer of the page's disabled-date / disabled-time. A rule that fails refuses (a failure took the day
             * or time as allowed: a broken rule let every value through, unseen); its error goes to $exceptionHandler,
             * once until the rule answers again (it is asked for every cell).
             */
            const ruleFailing = {date: false, time: false};
            function askRule(which, ask) {
                try {
                    const answer = !!ask();
                    ruleFailing[which] = false;
                    return answer;
                } catch (e) {
                    if (!ruleFailing[which]) {
                        ruleFailing[which] = true;
                        $exceptionHandler(e);
                    }
                    return true;
                }
            }

            // a day (a month, quarter, year: a cell) that cannot be picked: outside min / max (any part of it allowed
            // counts; a week: any of its days), or refused by the page's disabled-date (a week: its week)
            function dayDisabled(day) {
                if (day.y < 1 || day.y > 9999) return true;
                if (unit()) return !inLimits(day) || pageRefuses(day);
                if (limits.min && E.compareDay(day, limits.min) < 0) return true;
                if (limits.max && E.compareDay(day, limits.max) > 0) return true;
                return pageRefuses(day);
            }

            // a time the page's disabled-time refuses (minute and second null for an hour, second null for a minute)
            function timeRefused(h, m, s, end) {
                if (!($ctrl.disabledTime instanceof Function)) return false;
                return askRule('time', () => $ctrl.disabledTime({$hour: h, $minute: m, $second: s, $end: !!end}));
            }

            // a value's time refused, as the panel refuses it: its hour (minute and second null), its minute (second
            // null) or the time itself - an hour the panel turns off could be typed
            function timeOff(p, end) {
                return timeRefused(p.h, null, null, end) || timeRefused(p.h, p.m, null, end) || timeRefused(p.h, p.m, p.s, end);
            }

            /** A value that can be taken: in the limits, its day and time not refused. */
            /** limits-new-only: an end (a date) the page gave, kept as it is - min / max do not hold for it. */
            function givenEnd(p) {
                if (!given || !good(p) || !kit.readFlag($attrs, 'limitsNewOnly', $ctrl.limitsNewOnly, false)) return false;
                const list = $ctrl.isDates() ? datesOf(given) : ($ctrl.isRange() ? [rangeOf(given).start, rangeOf(given).end] : [given]);
                return list.some(g => good(g) && E.compare(g, p) === 0);
            }

            function allowed(p, end) {
                if (!good(p)) return false;
                const kept = givenEnd(p);
                if (!kept && !inLimits(p)) return false;
                if (kind() !== 'time' && (kept ? pageRefuses(p) : dayDisabled(p))) return false;
                return !$ctrl.hasClock() || !timeOff(p, end);
            }

            /** n hours, minutes or seconds on as time that passes - in local time a day of a clock change has 23 or 25
             * hours (by the wall clock last24Hours and a 24h max-range spanned 25 of them); days and longer by the
             * calendar, as E.add. */
            function addTime(p, n, u) {
                const ms = {hour: 3600000, minute: 60000, second: 1000}[E.unitOf(u)];
                if (!ms || typeof offset === 'number' || !good(p)) return E.add(p, n, u);
                const q = E.fromTimestamp(E.toTimestamp(p, offset) + Math.trunc(n) * ms, offset);
                return q || E.add(p, n, u);
            }

            // date ranges: the day a span reaches from a range's first day, both ends counted (31d from the 1st: the 31st)
            function spanLimit(from, spec, forward) {
                const duration = E.parseDuration(spec);
                if (!duration || !from) return null;
                const sign = forward ? 1 : -1;
                return E.addDays(E.add(E.startOf(from, 'day'), sign * duration.n, duration.unit), -sign);
            }

            const crossesAllowed = () => $ctrl.rangeCrossesDisabled !== false && $ctrl.rangeCrossesDisabled !== 'false';

            // a range's steps for range-crosses-disabled: its days, or its months, quarters, years (the first day of each)
            const stepStart = p => E.startOf(unitStart(p), 'day');
            const nextStep = p => (unit() ? E.startOf(E.add(stepStart(p), 1, unit()), 'day') : E.addDays(E.startOf(p, 'day'), 1));
            const crossChecked = () => !crossesAllowed() && kind() !== 'time' && $ctrl.disabledDate instanceof Function;

            // range-crosses-disabled false, while a range's end is set: the first disabled day (unit) after its first
            // one, looked for as far as a cell asks (the cells come in order: each day looked at once; it stopped at
            // 400 days, and a day past a blocker further off could be picked). Anew for each opening and start.
            let blocks = {key: '', after: null, reached: null};

            function blockAfter(from, upto) {
                if (!crossChecked()) return null;
                const first = stepStart(from);
                const key = first.y + '-' + first.M + '-' + first.d + '|' + kind();
                if (blocks.key !== key) blocks = {key: key, after: null, reached: first};
                if (blocks.after) return blocks.after;
                const last = stepStart(upto);
                for (let day = nextStep(blocks.reached); E.compareDay(day, last) <= 0; day = nextStep(day)) {
                    if (dayDisabled(day)) {
                        blocks.after = day;
                        return day;
                    }
                    blocks.reached = day;
                }
                return null;
            }

            // what clearBetween found, by range: the panel's footer and its OK button ask at each digest of the page (a
            // range of years asked the page's rule for each of its days every time); emptied for each opening, a change
            // of the limits or the rule, and before a value is taken (taken, the rule's answers of that moment count)
            const crossings = new Map();

            /**
             * No disabled day between a range's two ends (both ends not counted) - for month, quarter and year ranges no
             * disabled month, quarter or year (they were not looked at). The whole range is looked at (it stopped after
             * ten years, and a range past that passed).
             */
            function clearBetween(a, b) {
                if (!crossChecked() || !good(a) || !good(b)) return true;
                const first = stepStart(a);
                const last = stepStart(b);
                const key = E.format(first, 'YYYY-MM-DD') + '|' + E.format(last, 'YYYY-MM-DD') + '|' + kind();
                if (crossings.has(key)) return crossings.get(key);
                let clear = true;
                for (let day = nextStep(first); E.compareDay(day, last) < 0; day = nextStep(day)) {
                    if (dayDisabled(day)) {
                        clear = false;
                        break;
                    }
                }
                if (crossings.size >= 64) crossings.clear();
                crossings.set(key, clear);
                return clear;
            }

            // a date-time range: each end set day, then time (Next, or a day from the start's on, goes on to the end)
            const stepsTime = () => kind() === 'datetime' && $ctrl.isRange();

            /** The time of the end whose day was just picked is set next (one date-time; a range: while that end is the
             * one being set). */
            function stepOn() {
                return timeStep !== null && $ctrl.isOpen && (!$ctrl.isRange() || timeStep === $ctrl.activeEnd);
            }

            function beginStep(end) {
                timeStep = end;
                stepPulse += 1;
            }

            // the end a day picked sets: the one being set - or, while the start's time is set after its day, the end
            // for a day from the start's on (a day before it: a new start); while the end's time is set after its day
            // with no start yet, the start for a day up to the end's (a later day: a new end)
            function pickTarget(day) {
                const r = rangeOf(draft);
                if (!stepsTime() || !stepOn()) return $ctrl.activeEnd;
                if (timeStep === 0 && good(r.start) && E.compareDay(day, r.start) >= 0) return 1;
                if (timeStep === 1 && !good(r.start) && good(r.end) && E.compareDay(day, r.end) <= 0) return 0;
                return $ctrl.activeEnd;
            }

            // the end set first (no start yet), its time being set: Next goes on to the start
            const endFirst = () => stepsTime() && $ctrl.activeEnd === 1 && good(rangeOf(draft).end) && !good(rangeOf(draft).start);

            // the start a range's end is picked from: the draft's, while the end is being set - also while the start's
            // time is set, a later day picking the end (null otherwise)
            function anchorStart() {
                if (!$ctrl.isRange() || !$ctrl.isOpen || !($ctrl.activeEnd === 1 || (stepsTime() && stepOn() && timeStep === 0))) return null;
                const start = rangeOf(draft).start;
                return good(start) ? start : null;
            }

            /**
             * While a range's end is set from its start: the days (units) after the start that cannot end it - past a
             * disabled day (range-crosses-disabled false), past max-range, short of min-range. A day before the start
             * can always be picked: it becomes the new start.
             */
            function outOfSpan(day) {
                const anchor = anchorStart();
                if (!anchor) return false;
                const from = E.startOf(unitStart(anchor), 'day');
                if (E.compareDay(day, from) < 0) return false;
                // past a disabled day (a month, quarter, year of a range of those too)
                const block = blockAfter(from, day);
                if (block && E.compareDay(day, block) > 0) return true;
                if ($ctrl.hasClock()) return kind() === 'datetime' && !dayFits(day, anchor);
                const reach = unitEnd(day);
                const farthest = spanLimit(from, $ctrl.maxRange, true);
                if (farthest && E.compareDay(reach, farthest) > 0) return true;
                const nearest = spanLimit(from, $ctrl.minRange, true);
                return !!(nearest && E.compareDay(reach, nearest) < 0);
            }

            // type dates: the days checked, by day (a Set of the value's days: each cell searched the whole list, twice
            // per digest - 1000 dates made over half a million comparisons); made anew when the value is another list
            let checked = {list: null, n: -1, keys: null};
            const dayKey = d => d.y + '-' + d.M + '-' + d.d;
            function checkedKeys() {
                const list = datesOf(value);
                if (checked.list !== list || checked.n !== list.length) {
                    checked = {list: list, n: list.length, keys: new Set(list.filter(good).map(dayKey))};
                }
                return checked.keys;
            }
            const isChecked = c => !!c && !isBad(c) && checkedKeys().has(dayKey(c));

            // type dates with max-count reached: the days not checked cannot be
            const countFull = day => $ctrl.isDates() && maxCount() > 0 && datesOf(value).length >= maxCount() && !isChecked(day);
            const pickable = day => !dayDisabled(day) && !outOfSpan(day) && !countFull(day);

            /**
             * The moments a range's end may be at, given its other end: {lo, hi} (null: no bound). The end: from the
             * start (min-range on) to max-range from it; the start: from max-range before the end to the end (min-range
             * before it). At the shown precision: a start's hidden units are their least, an end's their most (HH:mm:
             * an end 31 days on at 10:00 is 10:00:59).
             */
            function reachFrom(other, end) {
                const max = E.parseDuration($ctrl.maxRange);
                const min = E.parseDuration($ctrl.minRange);
                const shift = (d, sign) => addTime(other, sign * d.n, d.unit);
                if (end) return {lo: min ? finish(shift(min, 1), false) : other, hi: max ? finish(shift(max, 1), true) : null};
                return {lo: max ? finish(shift(max, -1), false) : null, hi: min ? finish(shift(min, -1), true) : other};
            }

            // a date-time or time range's end being set: where it may be, given the other end in the draft (null: one
            // value, or the other end not set yet)
            function spanBounds(end) {
                if (!$ctrl.isRange() || !$ctrl.hasClock()) return null;
                const other = rangeOf(draft)[end ? 'start' : 'end'];
                return good(other) ? reachFrom(other, end) : null;
            }

            /** A date-time range's end day: some time on it is within max-range / min-range of the start. */
            function dayFits(day, start) {
                if (!$ctrl.maxRange && !$ctrl.minRange) return true;
                const dayFirst = E.make(day.y, day.M, day.d);
                const dayLast = E.make(day.y, day.M, day.d, 23, 59, 59);
                const reach = reachFrom(start, true);
                const earliest = E.compare(dayFirst, start) > 0 ? dayFirst : start;
                return !(reach.hi && E.compare(earliest, reach.hi) > 0) && !(reach.lo && E.compare(dayLast, reach.lo) < 0);
            }

            /** A date-time range's end moved within its own day into its reach from the start (null: no time of that
             * day is in it). */
            function fitEnd(start, end) {
                const reach = reachFrom(start, true);
                const dayFirst = E.make(end.y, end.M, end.d);
                const dayLast = E.make(end.y, end.M, end.d, 23, 59, 59);
                const lo = reach.lo && E.compare(reach.lo, dayFirst) > 0 ? reach.lo : dayFirst;
                const hi = reach.hi && E.compare(reach.hi, dayLast) < 0 ? reach.hi : dayLast;
                if (E.compare(lo, hi) > 0) return null;
                return E.compare(end, lo) < 0 ? lo : (E.compare(end, hi) > 0 ? hi : end);
            }

            /** A range's length within max-range / min-range: ranges of days and units by their days, the others by
             * their time (at the shown precision). */
            function spanOk(start, end, spec, least) {
                if (!spec || !good(start) || !good(end)) return true;
                const duration = E.parseDuration(spec);
                if (!duration) return true;
                if (!$ctrl.hasClock()) {
                    const limit = spanLimit(start, spec, true);
                    return least ? E.compareDay(end, limit) >= 0 : E.compareDay(end, limit) <= 0;
                }
                const reach = addTime(start, duration.n, duration.unit);
                return least ? E.compare(end, finish(reach, false)) >= 0 : E.compare(end, finish(reach, true)) <= 0;
            }

            // ------------------------------------------------------------------------------------- the model

            /** The checks of the field's value (Angular's $validators of its ngModel). */
            // a value inside min / max: date-times and times to the second; days and units by any part of them
            const insideMin = p => !limits.min || givenEnd(p) || ($ctrl.hasClock() ? E.compare(p, limits.min) >= 0 : E.compareDay(unitEnd(p), limits.min) >= 0);
            const insideMax = p => !limits.max || givenEnd(p) || ($ctrl.hasClock() ? E.compare(p, limits.max) <= 0 : E.compareDay(unitStart(p), limits.max) <= 0);

            // a box's typed text the field refused, by its reason (min, max, disabledDate, disabledTime; '' none)
            let boxRefused = ['', ''];
            let lastRefused = '|';

            /** Why a value typed cannot be taken ('' when it can): outside min / max, a day or a time the page refuses.
             * read: one value, a list of dates, or a range {start, end}. (A range's order and length are kept as typed and
             * shown invalid: the other end may be typed next.) */
            function refusalOf(read, end) {
                const list = $ctrl.isDates() ? datesOf(read) : (read && read.start !== undefined ? [read.start, read.end] : [read]);
                for (let i = 0; i < list.length; i += 1) {
                    const p = list[i];
                    if (!good(p)) continue;
                    if (!insideMin(p)) return 'min';
                    if (!insideMax(p)) return 'max';
                    if (kind() !== 'time' && pageRefuses(p)) return 'disabledDate';
                    if ($ctrl.hasClock() && timeOff(p, list.length === 2 ? i === 1 : end)) return 'disabledTime';
                }
                return '';
            }

            // a typed text that is a value the field cannot take: kept in its box, marked, its reason the field's error
            // (the value as it was)
            function refuse(index, typed, why) {
                boxRefused[index] = why;
                keepTyped(index, typed);
            }

            // a typed text kept in its box, marked (refused, or not a value): the box's whole text for the fitting too
            function keepTyped(index, typed) {
                $ctrl.boxTexts[index] = typed;
                $ctrl.boxBad[index] = true;
                written[index] = typed;
                fullTexts[index] = typed;
                setTextValidity();
            }

            /**
             * The model holds what the field holds, valid or not - a value the page or api.setValue gave outside the
             * limits, a range typed in the wrong order, a required field cleared ('') - never undefined, which Angular
             * writes for an invalid value (and so erases the page's value). Set once ngModel has its options (after its
             * pre-link): a page's ng-model-options are kept (updateOnDefault: ngModel commits as it does without any).
             */
            function holdInvalid(m) {
                if (m) m.$options = angular.extend({updateOnDefault: true}, m.$options, {allowInvalid: true});
            }

            function installValidators(m) {
                m.$isEmpty = v => (Array.isArray(v) ? v.every(blankValue) : blankValue(v));
                // the values checked: one, a range's ends, the dates
                const ends = () => ($ctrl.isDates() ? datesOf(value)
                    : ($ctrl.isRange() ? [rangeParts().start, rangeParts().end] : [value])).filter(good);
                // a typed text refused for that reason counts too
                const typedOk = key => boxRefused.indexOf(key) < 0;
                m.$validators.min = () => ends().every(insideMin) && typedOk('min');
                m.$validators.max = () => ends().every(insideMax) && typedOk('max');
                m.$validators.disabledDate = () => (kind() === 'time' || !($ctrl.disabledDate instanceof Function) || ends().every(p => !pageRefuses(p))) &&
                    typedOk('disabledDate');
                // each end with its own flag: an end without a start is still the end (filtered first, it was asked as
                // the start)
                m.$validators.disabledTime = () => {
                    if (!$ctrl.hasClock() || !($ctrl.disabledTime instanceof Function)) return typedOk('disabledTime');
                    const list = $ctrl.isRange() ? [rangeParts().start, rangeParts().end] : [value];
                    return list.every((p, i) => !good(p) || !timeOff(p, $ctrl.isRange() && i === 1)) && typedOk('disabledTime');
                };
                m.$validators.maxCount = () => !$ctrl.isDates() || !maxCount() || datesOf(value).length <= maxCount();
                m.$validators.rangeOrder = () => {
                    const r = rangeParts();
                    return !$ctrl.isRange() || !good(r.start) || !good(r.end) || E.compare(r.start, r.end) <= 0;
                };
                // a range with one end only: half a value (both ends, or neither)
                m.$validators.rangeIncomplete = () => {
                    const r = rangeParts();
                    return !$ctrl.isRange() || !r.start === !r.end;
                };
                m.$validators.rangeMax = () => !$ctrl.isRange() || spanOk(rangeParts().start, rangeParts().end, $ctrl.maxRange, false);
                m.$validators.rangeMin = () => !$ctrl.isRange() || spanOk(rangeParts().start, rangeParts().end, $ctrl.minRange, true);
                // (the page's rule asked anew: the value is checked as it is now)
                m.$validators.rangeCrossesDisabled = () => {
                    if (!$ctrl.isRange() || kind() === 'time') return true;
                    crossings.clear();
                    return clearBetween(rangeParts().start, rangeParts().end);
                };
            }

            // type dates: its days (a value that is not a list: none)
            const datesOf = v => (Array.isArray(v) ? v : []);
            const maxCount = () => {
                const n = parseInt($ctrl.maxCount, 10);
                return n > 0 ? n : 0;
            };

            /** Days in order, each once. */
            function sortDays(list) {
                const sorted = list.slice().sort(E.compareDay);
                return sorted.filter((p, i) => i === 0 || E.compareDay(p, sorted[i - 1]) !== 0);
            }

            function modelOf(v) {
                if ($ctrl.isDates()) {
                    if (isBad(v)) return v.bad;
                    const list = datesOf(v).filter(good).map(writeValue);
                    return list.length ? list : emptyValue();
                }
                if (!$ctrl.isRange()) return good(v) ? writeValue(v) : (isBad(v) ? v.bad : emptyValue());
                const r = v || {start: null, end: null};
                const one = p => (good(p) ? writeValue(p) : (isBad(p) ? p.bad : emptyOne()));
                return r.start || r.end ? [one(r.start), one(r.end)] : emptyValue();
            }

            function viewOf(modelValue) {
                // the field's own empty-value given back (a cleared field saved and loaded again): empty
                if (isEmptyMarker(modelValue)) return null;
                if (!$ctrl.isRange() && !$ctrl.isDates()) return readValue(modelValue, singleEnd());
                if ($ctrl.isDates()) {
                    if (!Array.isArray(modelValue) && blankValue(modelValue)) return null;
                    // a list, or a text of dates separated by commas
                    const raw = Array.isArray(modelValue) ? modelValue : String(modelValue).split(/[,;]/);
                    const list = [];
                    for (let i = 0; i < raw.length; i += 1) {
                        if (blankValue(raw[i])) continue;
                        const p = readValue(typeof raw[i] === 'string' ? raw[i].trim() : raw[i], false);
                        if (isBad(p)) return {bad: raw.join(', ')};
                        list.push(p);
                    }
                    return list.length ? sortDays(list) : null;
                }
                // a range: a list of its two ends; another value (a text, an object, more than two ends) is no range -
                // shown as it is, the field invalid (an optional field passed it, its boxes empty or one end left out)
                if (!Array.isArray(modelValue)) {
                    return blankValue(modelValue) || isEmptyMarker(modelValue) ? null
                        : {bad: typeof modelValue === 'string' ? modelValue : ''};
                }
                if (modelValue.slice(2).some(x => !blankValue(x))) return {bad: modelValue.join(', ')};
                const list = modelValue;
                const start = readValue(list[0], false);
                const end = readValue(list[1], true);
                return start || end ? {start: start, end: end} : null;
            }

            function attachModel(m) {
                installValidators(m);
                m.$formatters.push(function (modelValue) {
                    value = viewOf(modelValue);
                    given = value;
                    if (secondsIn() && [].concat(modelValue).some(v => typeof v === 'number' || stampText(v))) $scope.$evalAsync(replaceSeconds);
                    return value;
                });
                m.$parsers.push(function (viewValue) {
                    return modelOf(viewValue);
                });
                m.$render = function () {
                    value = m.$viewValue === undefined ? null : m.$viewValue;
                    followDraft();
                    paintBoxes();
                };
            }

            /** read-seconds: the page's model holds the field's own value instead of seconds (as many older date-time
             * fields did), written straight to it: the form stays pristine, no on-change. */
            function replaceSeconds() {
                if (destroyed || isBad(value) || (value && value.start !== undefined && (isBad(value.start) || isBad(value.end)))) return;
                const next = modelOf(value);
                if (twoModels) {
                    $ctrl.startModel = Array.isArray(next) ? next[0] : emptyOne();
                    $ctrl.endModel = Array.isArray(next) ? next[1] : emptyOne();
                } else if ($attrs.ngModel) {
                    // a getter/setter model (ng-model-options getterSetter): the value given to its function - an
                    // assignment replaced the function itself with the text
                    const m = model();
                    const target = $scope.$parent.$eval($attrs.ngModel);
                    if (m && m.$options && m.$options.getterSetter && typeof target === 'function') target(next);
                    else $scope.$parent.$eval($attrs.ngModel + ' = $auiValue', {$auiValue: next});
                }
            }

            /** The inner ngModel of start-model / end-model (aui-date-picker-mirror). */
            $ctrl.attachMirror = function (m) {
                mirrorCtrl = m;
                attachModel(m);
                holdInvalid(m);
                m.$setViewValue = wrapSetViewValue(m.$setViewValue);
            };

            // the mirror's value is the two models: written to them with it
            function wrapSetViewValue(original) {
                return function (viewValue, trigger) {
                    original.call(mirrorCtrl, viewValue, trigger);
                    const list = mirrorCtrl.$modelValue;
                    $ctrl.startModel = Array.isArray(list) ? list[0] : (list === null || list === undefined ? emptyOne() : list);
                    $ctrl.endModel = Array.isArray(list) ? list[1] : emptyOne();
                };
            }

            // the page's start-model / end-model as the mirror's model (its model watch formats and renders them)
            function pullTwoModels() {
                $ctrl.mirrorValue = blankValue($ctrl.startModel) && blankValue($ctrl.endModel) ? emptyValue() : [$ctrl.startModel, $ctrl.endModel];
            }

            /**
             * The page changed the value while the panel is open (its model, api.setValue): the draft is that value -
             * OK took the old draft back (a cleared or replaced value came back).
             */
            function followDraft() {
                if (!$ctrl.isOpen || !drafts()) return;
                const next = copyValue(value);
                // the field's own commit coming back (two models: through their watch): the draft is it already
                if (angular.equals(next, draft)) return;
                draft = next;
                if ($ctrl.hasClock()) buildTime();
            }

            /**
             * A value saved as an instant (timestamp, seconds, Date) in local time: a time the clock skips (set forward:
             * 02:30) taken as the time it is (03:30) - the box showed 02:30 as valid while its instant was 03:30, and the
             * record opened again showed 03:30. Texts stay the wall-clock texts they are.
             */
            function realTime(p) {
                if (!good(p) || typeof offset === 'number' || valueType() === 'text' || kind() === 'time') return p;
                const q = E.fromTimestamp(E.toTimestamp(p, offset), offset);
                return q && E.compare(q, p) !== 0 ? q : p;
            }

            function realValue(v) {
                if (!v || isBad(v)) return v;
                if ($ctrl.isDates()) return datesOf(v).map(realTime);
                if ($ctrl.isRange()) return {start: realTime(rangeOf(v).start), end: realTime(rangeOf(v).end)};
                return realTime(v);
            }

            /** A new value from the user: the page's model, on-change. source: pick, input, shortcut, now, clear, api. */
            function commit(next, source) {
                const m = model();
                const before = m ? m.$modelValue : undefined;
                next = realValue(next);
                value = next;
                if (source === 'api') followDraft();
                if (m) {
                    m.$setViewValue(next, source);
                    m.$validate();
                }
                paintBoxes();
                // a deferred model (ng-model-options debounce, updateOn): on-change once Angular commits it - compared
                // at once, the model was still the old one, and the change was never told
                if (m && kit.commitPending(m)) {
                    if (!notifyLater) {
                        notifyLater = kit.changeAfterCommit(m, (src, old) => {
                            const now = m.$modelValue;
                            if (!angular.equals(old, now)) reportChange(now, old, src);
                        });
                    }
                    notifyLater(source, before);
                    return;
                }
                const after = m ? m.$modelValue : modelOf(next);
                if (!angular.equals(before, after)) reportChange(after, before, source);
            }

            let notifyLater = null;   // on-change after a deferred commit (kit.changeAfterCommit), made at the first

            const dayText = p => (good(p) ? E.format(p, 'YYYY-MM-DD') : null);

            function reportChange(after, before, source) {
                const r = rangeParts();
                const list = datesOf(value).filter(good);
                const one = good(value) && !$ctrl.isDates() && !$ctrl.isRange() ? value : null;
                const locals = $ctrl.isDates()
                    ? {$text: list.map(text), $timestamps: list.map(stamp), $timestamp: list.length ? stamp(list[0]) : null}
                    : unit() && !$ctrl.isRange()
                    // a month, quarter, year or week: its first and last day, and its timestamps from its start to its end
                    ? {$text: text(value), $timestamp: stamp(one), $start: one ? dayText(unitStart(one)) : null,
                        $end: one ? dayText(unitEnd(one)) : null, $timestamps: one ? [stamp(unitStart(one)), stamp(unitEnd(one))] : [null, null]}
                    : $ctrl.isRange()
                    ? {$start: after && after[0] !== undefined ? after[0] : null, $end: after && after[1] !== undefined ? after[1] : null,
                        $timestamps: [stamp(r.start), stamp(r.end)],
                        $duration: good(r.start) && good(r.end) ? (kind() === 'time'
                            ? (E.compare(r.start, r.end) <= 0 ? (E.toTimestamp(r.end, 0) - E.toTimestamp(r.start, 0)) : null)
                            : stamp(r.end) - stamp(r.start)) : null,
                        $text: [text(r.start), text(r.end)], $timestamp: stamp(r.start)}
                    : {$text: text(value), $timestamp: stamp(value)};
                kit.reportChange($ctrl.onChange, {value: after, oldValue: before, triggerSource: source}, locals, $element[0],
                    'aui-date-picker');
            }

            // ------------------------------------------------------------------------------------- boxes

            function boxEls() {
                return triggerEl ? triggerEl.querySelectorAll('input.aui-date-picker__input') : [];
            }

            function textsOf(v) {
                if ($ctrl.isDates()) return [isBad(v) ? v.bad : datesOf(v).map(text).join(', '), ''];
                const r = rangeOf(v);
                // a range that is no range (see viewOf): its text in the first box
                if ($ctrl.isRange() && isBad(v)) return [v.bad, ''];
                return $ctrl.isRange() ? [text(r.start), text(r.end)] : [text(v), ''];
            }

            const valueTexts = () => textsOf(value);

            /** The boxes show the value (what was typed and not taken is replaced; a value the page gave that is not a
             * date is shown as it is, the field invalid). */
            function paintBoxes() {
                const r = rangeParts();
                $ctrl.boxTexts = valueTexts();
                boxRefused = ['', ''];
                $ctrl.boxBad = $ctrl.isRange() ? [isBad(r.start), isBad(r.end)] : [isBad(value), false];
                if ($ctrl.isRange() && isBad(value)) $ctrl.boxBad = [true, false];
                writeBoxes($ctrl.boxTexts);
                setTextValidity();
                writeFormValue();
            }

            /**
             * name: the value in the page's native form - hidden inputs of that name (the boxes show it in the display
             * format, and had no name: a form sent without Angular, FormData, lost the field). The text of what the
             * model holds: a text value as it is, a timestamp its number, a Date its text in value-format; a range two
             * (start, end: '' for an end not set), dates one each. Disabled with the field (a native form leaves it out).
             * The inputs are the field's last children, with no element around them: the browser never draws a hidden
             * input, whatever the page's CSS (a holder <span> showed under a page's span rule and moved the field down).
             */
            let formInputs = [];

            function writeFormValue() {
                const root = triggerEl ? triggerEl.parentNode : null;
                if (!root) return;
                const name = $ctrl.name ? String($ctrl.name) : '';
                const one = p => {
                    if (isBad(p)) return String(p.bad);
                    if (!good(p)) return '';
                    const v = writeValue(p);
                    if (typeof v === 'number') return String(v);
                    if (E.isDate(v)) return E.format(p, valueFormat());
                    return v === null || v === undefined ? '' : String(v);
                };
                let texts;
                if (!name) texts = [];
                else if ($ctrl.isDates()) texts = isBad(value) ? [String(value.bad)] : datesOf(value).filter(good).map(one);
                else if ($ctrl.isRange()) texts = isBad(value) ? [String(value.bad), ''] : [one(rangeParts().start), one(rangeParts().end)];
                else texts = [one(value)];
                while (formInputs.length > texts.length) {
                    const extra = formInputs.pop();
                    if (extra.parentNode) extra.parentNode.removeChild(extra);
                }
                while (formInputs.length < texts.length) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    formInputs.push(input);
                }
                const off = $ctrl.isDisabled();
                texts.forEach((text, i) => {
                    const input = formInputs[i];
                    if (input.parentNode !== root) root.appendChild(input);
                    if (input.name !== name) input.name = name;
                    if (input.value !== text) input.value = text;
                    if (input.disabled !== off) input.disabled = off;
                });
            }

            // the texts this field put in the boxes: a box holding another text was typed in
            let written = ['', ''];

            function writeBoxes(list) {
                showTexts(list, false);
                const boxes = boxEls();
                for (let i = 0; i < boxes.length; i += 1) boxes[i].classList.remove('aui-date-picker__input--preview');
            }

            // ---- a box too narrow for its text: the text made shorter where it says nothing more, then an ellipsis

            let fullTexts = ['', ''];             // the whole texts of the boxes (what the field shows, not fitted)
            let fitFrame = null;
            let stopFit = null;

            // a box the user types in (the keyboard's focus): its whole text; after a pick with the pointer (the quiet
            // focus) the field looks unfocused and keeps the short one
            function editing(box) {
                return document.activeElement === box && !(triggerEl && triggerEl.classList.contains('aui-select__trigger--pointer-focus'));
            }

            // the boxes' widths and the underline's places: read once, until the field fits again (its size, the focus or
            // the fonts changed) - a sweep of the pointer over the days reads no layout for them
            let geometry = null;

            function forgetGeometry() {
                geometry = null;
                const boxes = boxEls();
                for (let i = 0; i < boxes.length; i += 1) forgetFont(boxes[i]);
            }

            function roomOf(box) {
                const index = Number(box.getAttribute('data-box')) || 0;
                if (!geometry) geometry = {rooms: [], bars: []};
                let room = geometry.rooms[index];
                if (room === undefined) {
                    room = box.clientWidth;
                    if (room) geometry.rooms[index] = room;    // a box not laid out yet: read again next time
                }
                return room;
            }

            // a text fits its box, as it is or tighter (a box not laid out, in a hidden part of the page, is not fitted yet)
            function fits(text, box, tight) {
                const room = roomOf(box);
                return !text || !room || textWidth(text, box, tight ? TIGHT_SPACING : 'normal') <= room + 0.5;
            }

            // a box's text read back as a value (in the format it is shown in); null: not a value (a typed text)
            function shownValue(t, end) {
                const parsed = t ? E.parse(t, displayFormat()) : null;
                if (!parsed) return null;
                const parts = kind() === 'time' ? Object.assign({}, parsed.parts, {y: TIME_DAY.y, M: TIME_DAY.M, d: TIME_DAY.d}) : parsed.parts;
                return E.complete(parts, end ? 'end' : 'start');
            }

            const plainFormat = f => f.replace(/\[[^\]]*]/g, '');
            const dropSeconds = f => f.replace(/[:.]?ss?(?![^\[]*\])/, '');
            const dropTime = f => {
                const at = plainFormat(f) === f ? f.search(/[Hh]/) : -1;
                return at > 0 ? f.slice(0, at).replace(/[\sT,]+$/, '') : f;
            };
            const dropYear = f => {
                const lead = f.replace(/^(YYYY|GGGG)[^A-Za-z[]?/, '');
                return lead !== f ? lead : f.replace(/[^A-Za-z\]]?(YYYY|GGGG)(?=[^A-Za-z]|$)/, '');
            };

            /**
             * The texts the boxes show: each whole when it fits; else, both ends alike, shorter step by step where
             * nothing is lost - seconds that are a start's :00 and an end's :59; the time of a range of whole days (a
             * start at 00:00:00, an end at 23:59:59); the year, both ends in this year - until they fit. Each step is
             * tried as it is, then a little tighter (tight: the letters closer, both boxes alike); what is still too
             * long ends in an ellipsis (clip). A box the user types in keeps its whole text. Returns {texts, tight}.
             */
            function fitTexts(list) {
                const boxes = boxEls();
                const count = $ctrl.isRange() ? 2 : 1;
                const ends = [0, 1].slice(0, count);
                const fitted = i => !!boxes[i] && !editing(boxes[i]);
                const over = (shown, tight) => ends.some(i => shown[i] && fitted(i) && !fits(shown[i], boxes[i], tight));
                const settle = shown => (!over(shown, false) ? {texts: shown, tight: false} : (!over(shown, true) ? {texts: shown, tight: true} : null));
                const whole = settle(list.slice());
                if (whole) return whole;
                const isEnd = i => i === 1 || singleEnd();
                const parts = ends.map(i => shownValue(list[i], isEnd(i)));
                if (ends.some(i => list[i] && !parts[i])) return {texts: list.slice(), tight: false};
                const all = test => ends.every(i => !parts[i] || test(parts[i], isEnd(i)));
                const candidates = [];
                let fmt = displayFormat();
                if ($ctrl.hasClock() && /s/.test(plainFormat(fmt)) && all((p, end) => p.s === (end ? 59 : 0))) {
                    fmt = dropSeconds(fmt);
                    candidates.push(fmt);
                }
                if (kind() === 'datetime' && all((p, end) => (end ? p.h === 23 && p.m === 59 && p.s === 59 : p.h === 0 && p.m === 0 && p.s === 0))) {
                    const f = dropTime(fmt);
                    if (f !== fmt) {
                        fmt = f;
                        candidates.push(fmt);
                    }
                }
                if ((kind() === 'date' || kind() === 'datetime') && all(p => p.y === today().y)) {
                    const f = dropYear(fmt);
                    if (f !== fmt) {
                        fmt = f;
                        candidates.push(fmt);
                    }
                }
                let shown = list.slice();
                for (let c = 0; c < candidates.length; c += 1) {
                    shown = [0, 1].map(i => (i < count && parts[i] && fitted(i) ? E.format(parts[i], candidates[c]) : list[i]));
                    const done = settle(shown);
                    if (done) return done;
                }
                return {texts: shown.map((t, i) => (i < count && t && fitted(i) ? clip(t, boxes[i]) : t)), tight: true};
            }

            /** A text cut to its box (tight), ending in an ellipsis (the longest start that fits with it). The field
             * cuts it itself: a browser draws text-overflow's ellipsis only in a box without the focus, and after a
             * pick with the pointer the box keeps the focus (quietly). */
            function clip(text, box) {
                if (fits(text, box, true)) return text;
                let lo = 0;
                let hi = text.length - 1;
                while (lo < hi) {
                    const mid = Math.ceil((lo + hi) / 2);
                    if (fits(text.slice(0, mid).replace(/\s+$/, '') + '\u2026', box, true)) lo = mid;
                    else hi = mid - 1;
                }
                return lo > 0 ? text.slice(0, lo).replace(/\s+$/, '') + '\u2026' : text;
            }

            /** The boxes show texts: fitted to them; while any is shown shorter or cut, the whole value is the tooltip of
             * the field's value (showWhole). A box typed in is left as it is (keepTyped). */
            function showTexts(list, keepTyped) {
                const boxes = boxEls();
                const typed = keepTyped ? typedBoxes() : [];
                fullTexts = list.slice();
                const fit = fitTexts(list);
                const shown = fit.texts;
                let cut = false;
                for (let i = 0; i < boxes.length; i += 1) {
                    if (typed.indexOf(i) >= 0) continue;
                    if (boxes[i].value !== shown[i]) boxes[i].value = shown[i];
                    written[i] = shown[i];
                    boxes[i].classList.toggle('aui-date-picker__input--tight', fit.tight && !editing(boxes[i]));
                    if (list[i] && (shown[i] !== list[i] || (!editing(boxes[i]) && !fits(shown[i], boxes[i], fit.tight)))) cut = true;
                }
                const count = $ctrl.isRange() ? 2 : 1;
                showWhole(cut ? (count === 2 ? (list[0] || texts.notSet) + ' \u2192 ' + (list[1] || texts.notSet) : list[0]) : '');
                if ($ctrl.isOpen && count === 2) placeBar(false, barEnd());
            }

            /**
             * The whole value as the tooltip of the field's value area - its boxes, the arrow, the space around them, and
             * the calendar icon, which lets the pointer through to the area under it - while some of it is cut (none
             * while all of it shows). The label (its own whole text when it is cut) and the clear button keep theirs.
             */
            function showWhole(text) {
                const area = triggerEl && triggerEl.querySelector('.aui-date-picker__boxes');
                if (!area) return;
                if (text) {
                    if (area.getAttribute('title') !== text) area.setAttribute('title', text);
                } else if (area.hasAttribute('title')) {
                    area.removeAttribute('title');
                }
            }

            // the boxes fitted again: their size changed, the focus came or went (after the field's own handlers)
            function refit() {
                fitFrame = null;
                if (destroyed || !triggerEl) return;
                forgetGeometry();
                showTexts(fullTexts, true);
            }

            function refitSoon() {
                if (fitFrame === null) fitFrame = setTimeout(refit, 0);
            }

            // a key in a box shown shorter or tighter: its whole text first, spaced as typed (the key then edits it)
            function expandBox(box) {
                const index = Number(box.getAttribute('data-box')) || 0;
                box.classList.remove('aui-date-picker__input--tight');
                if (box.value !== written[index] || written[index] === fullTexts[index]) return;
                box.value = fullTexts[index];
                written[index] = fullTexts[index];
                if ($ctrl.isOpen && $ctrl.isRange()) placeBar(false, barEnd());
                try {
                    box.setSelectionRange(box.value.length, box.value.length);
                } catch (e) { /* not a text box */ }
            }

            /** The boxes the user typed in (their text not the one this field put there). */
            function typedBoxes() {
                const boxes = boxEls();
                const list = [];
                for (let i = 0; i < boxes.length; i += 1) {
                    if (boxes[i].value !== written[i]) list.push(i);
                }
                return list;
            }

            // the kinds whose panel sets a draft first: the time types, and every range (its ends picked one by one)
            const drafts = () => $ctrl.hasClock() || $ctrl.isRange();

            // while a draft is set in the panel the boxes show it (the value comes back if it is not taken)
            function paintDraft() {
                if (!drafts()) return;
                writeBoxes(textsOf(draft));
            }

            function setTextValidity() {
                const m = model();
                if (!m) return;
                // a text that is not a value: date; one refused: its reason (the limits' checks see it)
                m.$setValidity('date', !(($ctrl.boxBad[0] && !boxRefused[0]) || ($ctrl.boxBad[1] && !boxRefused[1])));
                const key = boxRefused.join('|');
                if (key !== lastRefused) {
                    lastRefused = key;
                    m.$validate();
                }
            }

            /** A box's text read as a value (type dates: a list); '' (empty) or null (not a value of this field). end: a
             * range's end box, or one value with boundary="end". */
            function readBox(textValue, end) {
                end = end || singleEnd();
                const t = String(textValue || '').trim();
                if (!t) return '';
                if ($ctrl.isDates()) return readDates(t);
                if (kind() === 'time') {
                    const parsed = readTime(t, true, end);
                    if (!parsed) return null;
                    const p = E.complete(Object.assign({}, parsed.parts, {y: TIME_DAY.y, M: TIME_DAY.M, d: TIME_DAY.d}), end ? 'end' : 'start');
                    return p ? finish(onTimeDay(p), end) : null;
                }
                return readOne(t, end);
            }

            // a text of a day, a date-time, or a unit (a quarter's Q and a week's W in either case; a day typed for a
            // month, quarter, year or week: the one it is in)
            function readOne(t, end) {
                const typed = kind() === 'quarter' || kind() === 'week' ? t.toUpperCase() : (kind() === 'datetime' ? oneDigitHour(t) : t);
                // a week: also its ISO text (2020-W53), whatever the week start (its value format is a day then)
                const read = E.parse(typed, displayFormat()) || E.parse(typed, valueFormat()) || E.parse(typed, FORMATS.datetime) ||
                    (kind() === 'week' ? E.parse(typed, 'GGGG-[W]WW') : null);
                const parsed = kind() === 'datetime' ? keepHalf(read, end) : read;
                if (!parsed || !whole(parsed.parts)) return null;
                let p = E.complete(parsed.parts, end ? 'end' : 'start');
                if (!p) return null;
                // a text with an offset (Z, -05:00) is that instant, in the field's time (as the page's values and
                // api.setValue read it): its wall-clock numbers were taken, another instant
                if (parsed.offset !== undefined) {
                    p = E.fromTimestamp(E.toTimestamp(p, parsed.offset), offset);
                    if (!p) return null;
                }
                if (unit()) return snap(p, end);
                if (kind() !== 'datetime') return dayValue(p, end);
                // a date-time typed without its time: the picked day's default time
                return parsed.parts.h === undefined ? dayValue(p, end) : finish(p, end);
            }

            // several dates typed, separated by commas or semicolons: in order, each once; null when one is not a date
            function readDates(t) {
                const list = [];
                const pieces = t.split(/[,;]/).map(x => x.trim()).filter(Boolean);
                for (let i = 0; i < pieces.length; i += 1) {
                    const p = readOne(pieces[i], false);
                    if (!p) return null;
                    list.push(p);
                }
                return list.length ? sortDays(list) : '';
            }

            /** A whole range typed or pasted into one box ('2026-11-07 ~ 2026-11-29'; also a spaced -, –, —, to, or a
             * comma between): {start, end}; null when the text is not one. */
            function readPair(t) {
                if (!$ctrl.isRange()) return null;
                const parts = String(t || '').split(/\s+(?:~|-|\u2013|\u2014|to)\s+|\s*[~\u2013\u2014,]\s*/).map(x => x.trim()).filter(Boolean);
                if (parts.length !== 2) return null;
                const start = readBox(parts[0], false);
                const end = readBox(parts[1], true);
                return start && end ? {start: start, end: end} : null;
            }

            /**
             * The text of a box taken (Enter, the box left): empty clears its end, a value is taken, a text that is not
             * one keeps the box invalid (the value as it was). A range whose typed start comes after its end is kept as
             * typed and shown invalid (rangeOrder), never swapped behind the user's back.
             */
            function takeBox(index) {
                const boxes = boxEls();
                const box = boxes[index];
                if (!box) return;
                const typed = box.value;
                if ((typed === $ctrl.boxTexts[index] || typed === written[index]) && !$ctrl.boxBad[index]) return;
                const pair = readPair(typed);
                if (pair) {
                    const why = refusalOf(pair);
                    if (why) {
                        refuse(index, typed, why);
                        return;
                    }
                    commit(pair, 'input');
                    draft = copyValue(value);
                    return;
                }
                const read = readBox(typed, index === 1);
                if (read === null) {
                    keepTyped(index, typed);
                    return;
                }
                const why = read === '' ? '' : refusalOf(read, index === 1 || singleEnd());
                if (why) {
                    refuse(index, typed, why);
                    return;
                }
                const next1 = read === '' ? null : read;
                if (!$ctrl.isRange()) {
                    commit(next1, next1 ? 'input' : 'clear');
                } else {
                    const r = rangeParts();
                    const next = {start: index === 0 ? next1 : r.start, end: index === 1 ? next1 : r.end};
                    commit(next.start || next.end ? next : null, next1 ? 'input' : 'clear');
                }
                draft = copyValue(value);
                if (next1 && $ctrl.isOpen) {
                    showValueOf($ctrl.isDates() ? next1[next1.length - 1] : next1);
                    buildTime();
                }
            }

            function copyValue(v) {
                if (!v || isBad(v)) return null;
                if ($ctrl.isDates()) return datesOf(v).map(E.copy);
                if (!$ctrl.isRange()) return E.copy(v);
                const r = rangeOf(v);
                return {start: good(r.start) ? E.copy(r.start) : null, end: good(r.end) ? E.copy(r.end) : null};
            }

            // ------------------------------------------------------------------------------------- the calendar

            $ctrl.weekdayHeads = [];

            function buildWeekdays() {
                const start = weekStart();
                $ctrl.weekdayHeads = [0, 1, 2, 3, 4, 5, 6].map(i => {
                    const w = (start + i) % 7;
                    return {short: texts.weekdays[w], long: texts.weekdaysLong[w]};
                });
            }

            // two months side by side when they fit (a date-time range: with its time columns beside them)
            const isNarrow = () => window.innerWidth < (kind() === 'datetime' ? NARROW_TIME_PX : NARROW_PX);
            $ctrl.calendarCount = () => (!$ctrl.hasCalendar() ? 0 : ($ctrl.isRange() && !isNarrow() ? 2 : 1));

            function monthTitle(y, M) {
                return texts.header.replace('{month}', texts.monthsLong[M - 1]).replace('{year}', String(y));
            }

            function titleParts(y, M) {
                return texts.header.split(/(\{month\}|\{year\})/).filter(Boolean).map(part =>
                    part === '{month}' ? {kind: 'month', label: texts.monthsLong[M - 1]}
                        : part === '{year}' ? {kind: 'year', label: String(y)} : {kind: 'text', label: part});
            }

            $ctrl.modeYear = () => ($ctrl.hasUnits() ? viewY + modeTarget : ($ctrl.calendars[modeTarget] || {y: viewY}).y);

            // ISO week numbers beside the weeks: Monday weeks only (show-week-numbers; type week unless false)
            $ctrl.weekNumbers = () => weekStart() === 1 && kit.readFlag($attrs, 'showWeekNumbers', $ctrl.showWeekNumbers, $ctrl.isWeek());

            /** The calendars shown: the month in view (and the next, for a range). */
            function buildCalendars() {
                const list = [];
                const count = $ctrl.calendarCount();
                for (let i = 0; i < count; i += 1) {
                    const first = E.addMonths(E.make(viewY, viewM, 1), i);
                    const own = first.y * 12 + first.M;
                    // hidden: a day of the other month shown beside this one (each date once; its place kept)
                    const cells = E.monthGrid(first.y, first.M, weekStart()).map(c => ({
                        key: c.y + '-' + c.M + '-' + c.d, y: c.y, M: c.M, d: c.d, inMonth: c.inMonth,
                        hidden: !c.inMonth && ((i < count - 1 && c.y * 12 + c.M > own) || (i > 0 && c.y * 12 + c.M < own)),
                        label: texts.weekdaysLong[E.weekday(c)] + ', ' + texts.monthsLong[c.M - 1] + ' ' + c.d + ', ' + c.y
                    }));
                    const weeks = [];
                    for (let w = 0; w < 6; w += 1) {
                        weeks.push({key: w, no: E.isoWeek(cells[w * 7]).week, days: cells.slice(w * 7, w * 7 + 7)});
                    }
                    list.push({key: first.y + '-' + first.M, index: i, y: first.y, M: first.M, first: i === 0,
                        last: i === count - 1, title: monthTitle(first.y, first.M), titleParts: titleParts(first.y, first.M),
                        weeks: weeks});
                }
                $ctrl.calendars = list;
                const key = viewY + '-' + viewM;
                if (key !== lastViewKey) {
                    lastViewKey = key;
                    if ($ctrl.onViewChange instanceof Function && $ctrl.isOpen && count > 0) {
                        $scope.$evalAsync(() => $ctrl.onViewChange({$year: viewY, $month: viewM}));
                        pageDigest.owe(true);
                    }
                }
            }

            function setView(y, M) {
                // every month shown inside years 1 to 9999: two months from December 9999 showed a January 10000, and a
                // range's end in January 0001 (its month the second shown) asked for December 0000 and showed none
                const last = 9999 * 12 + 12 - (Math.max(1, $ctrl.calendarCount()) - 1);
                const index = Math.min(Math.max(y * 12 + M, 1 * 12 + 1), last);
                viewY = Math.floor((index - 1) / 12);
                viewM = index - viewY * 12;
                buildCalendars();
            }

            /** The panel moved so that a value is shown: its month (a calendar), its page (months, quarters, years). */
            function showValueOf(p) {
                if ($ctrl.hasCalendar()) showMonthOf(p);
                else if ($ctrl.hasUnits()) showUnitOf(p);
            }

            /** The month view moved so that a day is shown (a range keeps its two months when the day is in the second). */
            function showMonthOf(day) {
                if (!$ctrl.hasCalendar()) return;
                const first = E.make(viewY, viewM, 1);
                const shown = $ctrl.calendarCount();
                const months = (day.y * 12 + day.M) - (first.y * 12 + first.M);
                if (months >= 0 && months < shown) return;
                setView(day.y, day.M);
            }

            const sameDay = (a, b) => !!(a && b && !isBad(a) && !isBad(b) && E.compareDay(a, b) === 0);

            // what the panel marks: the draft while it is open (time types, ranges), else the value
            const marked = () => (drafts() && $ctrl.isOpen ? draft : value);

            /**
             * A range on a day or a unit c: its ends, and its band between two different ones (a first one alone has
             * none); while the second end is picked, from the first to the one under the pointer. cmp: the comparison
             * of days or of units. The classes' names after prefix.
             */
            function rangeClasses(c, cmp, prefix) {
                const preview = previewRange();
                const r = preview || rangeOf(marked());
                const from = good(r.start) ? r.start : null;
                const to = good(r.end) ? r.end : null;
                const list = [];
                if (from && cmp(c, from) === 0) list.push('selected', 'start');
                if (to && cmp(c, to) === 0) list.push('selected', 'end');
                if (from && to && cmp(from, to) < 0) {
                    if (cmp(c, from) === 0) list.push('band-start');
                    else if (cmp(c, to) === 0) list.push('band-end');
                    else if (cmp(c, from) > 0 && cmp(c, to) < 0) list.push('in-range');
                }
                if (preview) list.push('previewing');
                // the range taken before, while another is set: its ends outlined (what Escape goes back to)
                if ($ctrl.isOpen && draftChanged()) {
                    const was = rangeOf(value);
                    if ((good(was.start) && cmp(c, was.start) === 0 && !(from && cmp(c, from) === 0)) ||
                        (good(was.end) && cmp(c, was.end) === 0 && !(to && cmp(c, to) === 0))) list.push('was');
                }
                return list.map(name => prefix + name);
            }

            // a week (type week): the value's week drawn as a band with its ends filled, the week under the pointer as a
            // lighter band
            function weekClasses(c) {
                const ws = weekStart();
                const own = E.startOf(c, 'week', ws);
                const chosen = good(value) && sameDay(E.startOf(value, 'week', ws), own);
                const hovered = !chosen && !!hoverDay && sameDay(E.startOf(hoverDay, 'week', ws), own);
                if (!chosen && !hovered) return [];
                const first = sameDay(c, own);
                const last = sameDay(c, E.addDays(own, 6));
                const list = [first ? 'band-start' : (last ? 'band-end' : 'in-range')];
                if (chosen && (first || last)) list.push('selected', first ? 'start' : 'end');
                if (hovered) list.push('previewing');
                return list.map(name => 'aui-date-picker__day--' + name);
            }


            /** The classes of a day: today, the value, a range's band and ends, the preview, disabled, the keyboard's. A
             * day of the last or next month is drawn as any day (lighter); one the other month shows is left out. */
            $ctrl.dayClass = function (c) {
                if (c.hidden) return 'aui-date-picker__day--outside aui-date-picker__day--hidden';
                const classes = [];
                if (!c.inMonth) classes.push('aui-date-picker__day--outside');
                if (sameDay(c, today())) classes.push('aui-date-picker__day--today');
                // asked once per drawing: aria-disabled reads it (each asked the page's rule: twice per day and digest);
                // it changes with the disabled class, so the digest goes round once more and aria-disabled follows
                c.noPick = !pickable(c);
                if (c.noPick) classes.push('aui-date-picker__day--disabled');
                if (sameDay(c, activeDay)) classes.push('aui-date-picker__day--active');
                if ($ctrl.isDates()) {
                    if (isChecked(c)) classes.push('aui-date-picker__day--selected');
                    return classes.join(' ');
                }
                if ($ctrl.isWeek()) return classes.concat(weekClasses(c)).join(' ');
                if (!$ctrl.isRange()) {
                    if (sameDay(c, marked())) classes.push('aui-date-picker__day--selected');
                    return classes.join(' ');
                }
                return classes.concat(rangeClasses(c, E.compareDay, 'aui-date-picker__day--')).join(' ');
            };

            $ctrl.dayIsSelected = function (c) {
                if (c.hidden) return false;
                const shown = marked();
                if ($ctrl.isDates()) return isChecked(c);
                if ($ctrl.isWeek()) return good(value) && sameDay(E.startOf(value, 'week', weekStart()), E.startOf(c, 'week', weekStart()));
                if (!$ctrl.isRange()) return sameDay(c, shown);
                // the range as set (the preview under the pointer is drawn, not selected: it was announced as chosen)
                const r = rangeOf(shown);
                return sameDay(c, r.start) || sameDay(c, r.end);
            };
            $ctrl.dayTab = c => (sameDay(c, activeDay) && c.inMonth ? 0 : -1);
            $ctrl.isToday = c => sameDay(c, today());
            $ctrl.dayDisabled = c => !pickable(c);

            /** Months of the month view and years of the year view: built when the view or its year changes. */
            $ctrl.monthList = [];
            $ctrl.yearList = [];

            function buildPickerLists() {
                if ($ctrl.mode === 'month') $ctrl.monthList = withTabStop(monthCells());
                if ($ctrl.mode === 'year') $ctrl.yearList = withTabStop(yearCells());
            }

            // one stop of the keyboard's Tab in a list of months or years (the arrows move in it): the chosen one, else
            // this one, else the first that can be chosen (they all were out of the Tab order: the keyboard could not
            // reach them)
            function withTabStop(list) {
                const stop = list.filter(c => c.selected && !c.disabled)[0] || list.filter(c => c.current && !c.disabled)[0] ||
                    list.filter(c => !c.disabled)[0];
                list.forEach(c => { c.tab = c === stop; });
                return list;
            }

            /** The arrows in a list of months or years: to the next one that can be chosen (left, right; up and down by
             * a row), Home and End; Enter and Space choose it (the button's own click). */
            function onCellKeydown(event, cell) {
                const cells = Array.prototype.slice.call(cell.parentNode.querySelectorAll('.aui-date-picker__cell'));
                const at = cells.indexOf(cell);
                const top = cells.length ? cells[0].getBoundingClientRect().top : 0;
                const perRow = Math.max(1, cells.filter(c => Math.abs(c.getBoundingClientRect().top - top) < 2).length);
                const step = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -perRow, ArrowDown: perRow}[event.key];
                let next = -1;
                if (step) {
                    for (let i = at + step; i >= 0 && i < cells.length; i += step) {
                        if (!cells[i].disabled) {
                            next = i;
                            break;
                        }
                    }
                } else if (event.key === 'Home' || event.key === 'End') {
                    const order = event.key === 'Home' ? cells : cells.slice().reverse();
                    next = cells.indexOf(order.filter(c => !c.disabled)[0]);
                } else {
                    return;
                }
                event.preventDefault();
                if (next < 0 || next === at) return;
                cells.forEach((c, i) => c.setAttribute('tabindex', i === next ? '0' : '-1'));
                kit.focusQuietly(cells[next]);
            }

            function monthCells() {
                const y = $ctrl.modeYear();
                const shown = marked();
                return texts.months.map((label, i) => {
                    const first = E.make(y, i + 1, 1);
                    const last = E.endOf(first, 'month');
                    const off = (limits.max && E.compareDay(first, limits.max) > 0) || (limits.min && E.compareDay(last, limits.min) < 0);
                    const now = today();
                    return {key: i + 1, label: label, disabled: !!off, current: now.y === y && now.M === i + 1,
                        selected: !!(good(shown) && !$ctrl.isRange() && shown.y === y && shown.M === i + 1)};
                });
            }

            function yearCells() {
                const list = [];
                const shown = marked();
                for (let i = 0; i < 12; i += 1) {
                    const y = yearPageStart + i;
                    const off = y < 1 || y > 9999 || (limits.max && y > limits.max.y) || (limits.min && y < limits.min.y);
                    list.push({key: y, label: String(y), disabled: !!off, current: today().y === y, edge: i === 0 || i === 11,
                        selected: !!(good(shown) && !$ctrl.isRange() && shown.y === y)});
                }
                return list;
            }

            $ctrl.yearPageTitle = () => yearPageStart + 1 + ' - ' + (yearPageStart + 10);

            // ------------------------------------------------------------------------------------- months, quarters, years

            // two pages side by side for a range, when they fit
            $ctrl.unitCount = () => (!$ctrl.hasUnits() ? 0 : ($ctrl.isRange() && !isNarrow() ? 2 : 1));

            const compareUnit = (a, b) => E.compareDay(unitStart(a), unitStart(b));
            const sameUnit = (a, b) => !!(a && b && !isBad(a) && !isBad(b) && compareUnit(a, b) === 0);

            function unitCell(start, label, sub, long, inPage) {
                return {key: start.y + '-' + start.M, y: start.y, M: start.M, d: 1, label: label, sub: sub, long: long,
                    inPage: inPage, off: start.y < 1 || start.y > 9999};
            }

            /** The unit pages: a year of months or quarters, or a decade of years (with the years beside it); a range: the
             * next page beside it. */
            function buildUnits() {
                const pages = [];
                const count = $ctrl.unitCount();
                for (let i = 0; i < count; i += 1) {
                    const y = kind() === 'year' ? viewY + i * 10 : viewY + i;
                    const cells = [];
                    if (kind() === 'month') {
                        for (let M = 1; M <= 12; M += 1) {
                            cells.push(unitCell(E.make(y, M, 1), texts.months[M - 1], '', monthTitle(y, M), true));
                        }
                    } else if (kind() === 'quarter') {
                        for (let q = 1; q <= 4; q += 1) {
                            const M = (q - 1) * 3 + 1;
                            const label = texts.quarter.replace('{q}', String(q));
                            cells.push(unitCell(E.make(y, M, 1), label, texts.months[M - 1] + ' - ' + texts.months[M + 1],
                                label + ' ' + y + ', ' + texts.monthsLong[M - 1] + ' - ' + texts.monthsLong[M + 1], true));
                        }
                    } else {
                        for (let n = -1; n <= 10; n += 1) {
                            const year = Math.min(9999, Math.max(1, y + n));
                            const cell = unitCell(E.make(year, 1, 1), String(y + n), '', String(y + n), n >= 0 && n <= 9);
                            cell.key = 'y' + (y + n);
                            cell.off = y + n < 1 || y + n > 9999;
                            // the year the other decade shows: left out (each year once)
                            cell.hidden = (n === 10 && i < count - 1) || (n === -1 && i > 0);
                            cells.push(cell);
                        }
                    }
                    pages.push({key: kind() + '-' + y, index: i, first: i === 0, last: i === count - 1, unit: kind(),
                        title: kind() === 'year' ? y + ' - ' + (y + 9) : String(y), titleAct: kind() !== 'year', cells: cells});
                }
                $ctrl.unitPages = pages;
            }

            // the first page shown: a year (months, quarters) or a decade (years)
            function setUnitView(y) {
                const years = kind() === 'year';
                const step = years ? 10 : 1;
                const page = years ? Math.floor(y / 10) * 10 : y;
                // every page shown inside years 1 to 9999 (a range's second page past 9999 had nothing to pick)
                const lastPage = (years ? 9990 : 9999) - (Math.max(1, $ctrl.unitCount()) - 1) * step;
                viewY = Math.min(Math.max(page, years ? 0 : 1), lastPage);
                buildUnits();
            }

            /** The pages moved so that a unit is shown (a range keeps its two pages when it is in the second). */
            function showUnitOf(p) {
                if (!$ctrl.hasUnits()) return;
                const page = kind() === 'year' ? Math.floor(p.y / 10) * 10 : p.y;
                const at = (page - viewY) / (kind() === 'year' ? 10 : 1);
                if (at >= 0 && at < $ctrl.unitCount()) return;
                setUnitView(page);
            }

            /**
             * A range's end chosen while open (its box, Tab, its tab above the months): the days (units) show it as an
             * opening on it does - in view already: kept; else its month (page) on its side (the start on the left, the
             * end on the right). The keyboard's day moves to it. An end not set (or a time range): the view stays.
             */
            function showEnd(end) {
                const r = rangeOf(draft);
                const p = end === 1 ? r.end : r.start;
                if (!good(p) || kind() === 'time') return;
                activeDay = E.startOf(unitStart(p), 'day');
                if ($ctrl.hasCalendar()) {
                    const shown = $ctrl.calendarCount();
                    const at = (p.y * 12 + p.M) - (viewY * 12 + viewM);
                    if (at >= 0 && at < shown) return;
                    const left = end === 1 && shown === 2 ? E.addMonths(activeDay, -1) : activeDay;
                    if (left.y >= 1) setView(left.y, left.M);
                    else setView(activeDay.y, activeDay.M);
                } else if ($ctrl.hasUnits()) {
                    const step = kind() === 'year' ? 10 : 1;
                    const page = kind() === 'year' ? Math.floor(p.y / 10) * 10 : p.y;
                    const at = (page - viewY) / step;
                    if (at >= 0 && at < $ctrl.unitCount()) return;
                    setUnitView(end === 1 && $ctrl.unitCount() === 2 && page - step >= 1 ? page - step : page);
                }
            }

            const unitPickable = cell => !cell.off && pickable(cell);

            /** The classes of a unit: this one (now), the value, a range's band and ends, disabled, the keyboard's. */
            $ctrl.unitClass = function (cell) {
                if (cell.hidden) return 'aui-date-picker__unit--outside aui-date-picker__unit--hidden';
                const classes = [];
                if (!cell.inPage) classes.push('aui-date-picker__unit--outside');
                if (sameUnit(cell, today())) classes.push('aui-date-picker__unit--current');
                if (!unitPickable(cell)) classes.push('aui-date-picker__unit--disabled');
                if (sameUnit(cell, activeDay)) classes.push('aui-date-picker__unit--active');
                if (!$ctrl.isRange()) {
                    if (sameUnit(cell, value)) classes.push('aui-date-picker__unit--selected');
                    return classes.join(' ');
                }
                return classes.concat(rangeClasses(cell, compareUnit, 'aui-date-picker__unit--')).join(' ');
            };

            $ctrl.unitIsSelected = function (cell) {
                if (cell.hidden) return false;
                if (!$ctrl.isRange()) return sameUnit(cell, value);
                const r = rangeOf(marked());
                return sameUnit(cell, r.start) || sameUnit(cell, r.end);
            };
            // this month, quarter, year (as today's day): aria-current, not only its look
            $ctrl.isCurrentUnit = cell => !cell.hidden && sameUnit(cell, today());
            $ctrl.unitTab = cell => (sameUnit(cell, activeDay) && cell.inPage ? 0 : -1);
            $ctrl.unitDisabled = cell => !unitPickable(cell);

            // ------------------------------------------------------------------------------------- the time columns

            const stepOf = (textValue, max) => {
                const n = parseInt(textValue, 10);
                return n >= 1 && n <= max ? n : 1;
            };
            const pad2 = n => (n < 10 ? '0' : '') + n;

            // the draft's time (one value) or its end's (a range); null while not set
            function draftTime(end) {
                const v = $ctrl.isRange() ? rangeOf(draft)[end ? 'end' : 'start'] : draft;
                return good(v) ? v : null;
            }

            /** The time a column sets: the draft's (one value) or its end's (a range), else the picked day's default. */
            function timeTarget(end) {
                const v = draftTime(end);
                if (v) return v;
                const base = kind() === 'time' ? TIME_DAY
                    : ($ctrl.isRange() ? (good(rangeOf(draft).start) && end ? rangeOf(draft).start : (activeDay || today())) : (activeDay || today()));
                return withTime(base, dayTime(end));
            }

            /** The time columns: one group (one value; a date-time range's end being set), or two (a time range). */
            function buildTime() {
                if (!$ctrl.hasClock() || !$ctrl.panelReady) {
                    $ctrl.timeGroups = [];
                    return;
                }
                if ($ctrl.usesSlots()) {
                    buildSlots();
                    return;
                }
                const ends = $ctrl.type === 'timerange' ? [0, 1] : [$ctrl.isRange() ? $ctrl.activeEnd : 0];
                $ctrl.timeGroups = ends.map(end => ({
                    key: 'g' + end,
                    end: end,
                    title: $ctrl.type === 'timerange' ? (end ? texts.endTime : texts.startTime) : '',
                    columns: timeColumns(end)
                }));
                $ctrl.draftProblem = draftProblem();
                scrollColumnsSoon();
            }

            function timeColumns(end) {
                const units = shownUnits();
                const target = timeTarget(end);
                // a time not set yet: no option chosen (the first one set gives the others the default time)
                const isSet = !!draftTime(end);
                const columns = [];
                const day = target;
                const reach = spanBounds(end);
                // an option allowed: some time inside it is within the limits and not refused; a range's end also within
                // its other end's reach (never before its start, max-range, min-range)
                const range = (h1, m1, s1, h2, m2, s2) => {
                    const lo = E.make(day.y, day.M, day.d, h1, m1, s1);
                    const hi = E.make(day.y, day.M, day.d, h2, m2, s2);
                    if (limits.min && E.compare(hi, limits.min) < 0) return false;
                    if (limits.max && E.compare(lo, limits.max) > 0) return false;
                    if (reach && reach.lo && E.compare(hi, reach.lo) < 0) return false;
                    return !(reach && reach.hi && E.compare(lo, reach.hi) > 0);
                };
                if (units.h) {
                    const step = stepOf($ctrl.hourStep, 23);
                    const items = [];
                    if (units.twelve) {
                        const pm = target.h >= 12;
                        for (let i = 0; i < 12; i += step) {
                            const h12 = i === 0 ? 12 : i;
                            const h = (i % 12) + (pm ? 12 : 0);
                            items.push({value: h, label: pad2(h12), selected: isSet && target.h === h,
                                disabled: !range(h, 0, 0, h, 59, 59) || timeRefused(h, null, null, end)});
                        }
                    } else {
                        for (let h = 0; h < 24; h += step) {
                            items.push({value: h, label: pad2(h), selected: isSet && target.h === h,
                                disabled: !range(h, 0, 0, h, 59, 59) || timeRefused(h, null, null, end)});
                        }
                    }
                    columns.push({unit: 'h', label: texts.hours, items: items});
                }
                if (units.m) {
                    const step = stepOf($ctrl.minuteStep, 59);
                    const items = [];
                    for (let m = 0; m < 60; m += step) {
                        items.push({value: m, label: pad2(m), selected: isSet && target.m === m,
                            disabled: !range(target.h, m, 0, target.h, m, 59) || timeRefused(target.h, m, null, end)});
                    }
                    columns.push({unit: 'm', label: texts.minutes, items: items});
                }
                if (units.s) {
                    const step = stepOf($ctrl.secondStep, 59);
                    const items = [];
                    for (let s = 0; s < 60; s += step) {
                        items.push({value: s, label: pad2(s), selected: isSet && target.s === s,
                            disabled: !range(target.h, target.m, s, target.h, target.m, s) || timeRefused(target.h, target.m, s, end)});
                    }
                    columns.push({unit: 's', label: texts.seconds, items: items});
                }
                if (units.ampm) {
                    const am = target.h < 12;
                    columns.push({unit: 'a', label: texts.am + ' / ' + texts.pm, items: [
                        {value: 0, label: texts.am, selected: isSet && am, disabled: !range(0, 0, 0, 11, 59, 59)},
                        {value: 12, label: texts.pm, selected: isSet && !am, disabled: !range(12, 0, 0, 23, 59, 59)}]});
                }
                // one Tab stop a column: its chosen option, or its first that can be chosen
                columns.forEach(col => markTabStop(col.items));
                return columns;
            }

            function markTabStop(items) {
                const stop = items.filter(it => it.selected && !it.disabled)[0] || items.filter(it => !it.disabled)[0];
                if (stop) stop.tab = true;
            }

            /** A column's option picked: that unit of the draft (or of its end) set. */
            function setTime(end, unit, n) {
                // a time not set yet: the others from the page's default-time, else 00 (the units not shown: finish)
                const given = $ctrl.isRange() ? (Array.isArray($ctrl.defaultTime) && $ctrl.defaultTime[end ? 1 : 0])
                    : (typeof $ctrl.defaultTime === 'string' || Array.isArray($ctrl.defaultTime));
                const base = timeTarget(end);
                const target = draftTime(end) || (given ? base : E.make(base.y, base.M, base.d));
                const next = E.copy(target);
                if (unit === 'h') next.h = n;
                else if (unit === 'm') next.m = n;
                else if (unit === 's') next.s = n;
                else if (unit === 'a') next.h = (target.h % 12) + n;
                setDraftEnd(end, finish(next, end));
                if ($ctrl.isRange()) $ctrl.activeEnd = end ? 1 : 0;
                scrollSmooth = true;
                buildTime();
                refreshRange();
            }

            function setDraftEnd(end, p) {
                if (!$ctrl.isRange()) {
                    draft = p;
                } else {
                    const r = rangeOf(draft);
                    draft = {start: end ? r.start : p, end: end ? p : r.end};
                }
                paintDraft();
            }

            // time-slots="09:00-18:00/30m": the times of the list - within one day, its first not after its last (hours
            // 0 to 23, minutes 0 to 59); another text is no list (the clock's columns are shown: see the docs)
            function parseSlots() {
                const match = /^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*\/\s*(\d+)\s*(min|m|h)\s*$/.exec($ctrl.timeSlots || '');
                if (!match) return null;
                const at = textValue => textValue.split(':').map(Number);
                const from = at(match[1]);
                const to = at(match[2]);
                const step = Number(match[3]) * (match[4] === 'h' ? 60 : 1);
                const inDay = t => t[0] <= 23 && t[1] <= 59;
                if (!step || !inDay(from) || !inDay(to)) return null;
                const first = from[0] * 60 + from[1];
                const last = to[0] * 60 + to[1];
                return first <= last ? {from: first, to: last, step: step} : null;
            }

            function buildSlots() {
                const slots = parseSlots();
                const list = [];
                const current = good(draft) ? draft : null;
                // every time of the list (at most a day's minutes: it stopped at 288, the later times out of reach)
                for (let minutes = slots.from; minutes <= slots.to; minutes += slots.step) {
                    const p = onTimeDay(E.make(2000, 1, 1, Math.floor(minutes / 60) % 24, minutes % 60, 0));
                    list.push({value: minutes, label: E.format(p, displayFormat()), parts: p,
                        selected: !!(current && current.h === p.h && current.m === p.m),
                        disabled: !allowed(p, false)});
                }
                markTabStop(list);
                $ctrl.slotItems = list;
                $ctrl.timeGroups = [];
                scrollColumnsSoon();
            }

            /** Each column (and the slot list) scrolled so that its chosen option is at its top (as far as the column
             * goes: the last options stay at its bottom). */
            function scrollColumnsSoon() {
                const smooth = scrollSmooth;
                scrollSmooth = false;
                $timeout(() => {
                    if (!$ctrl.isOpen || !panelEl) return;
                    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    const columns = panelEl.querySelectorAll('.aui-date-picker__column');
                    for (let i = 0; i < columns.length; i += 1) {
                        const column = columns[i];
                        const chosen = column.querySelector('.aui-date-picker__time--selected');
                        if (!chosen) continue;
                        const top = Math.min(chosen.offsetTop - column.firstElementChild.offsetTop,
                            Math.max(0, column.scrollHeight - column.clientHeight));
                        if (Math.abs(column.scrollTop - top) < 1) continue;
                        if (smooth && !reduce && typeof column.scrollTo === 'function') column.scrollTo({top: top, behavior: 'smooth'});
                        else column.scrollTop = top;
                    }
                }, 0, false);
            }

            /** Why the draft cannot be taken ('' when it can): it is not whole, outside the limits, or its end first. */
            function draftProblem() {
                if (!drafts()) return '';
                if ($ctrl.isRange()) {
                    const r = rangeOf(draft);
                    if (!good(r.start) || !good(r.end)) return '';
                    if (E.compare(r.start, r.end) > 0) return texts.endBeforeStart;
                    if (!allowed(r.start, false) || !allowed(r.end, true)) return texts.outsideLimits;
                    if (!spanOk(r.start, r.end, $ctrl.maxRange, false)) return texts.rangeTooLong;
                    if (!spanOk(r.start, r.end, $ctrl.minRange, true)) return texts.rangeTooShort;
                    if (!clearBetween(r.start, r.end)) return texts.crossesDisabled;
                    return '';
                }
                return good(draft) && !allowed(draft, false) ? texts.outsideLimits : '';
            }

            $ctrl.problem = () => draftProblem();

            $ctrl.canTake = function () {
                if (!drafts()) return false;
                if ($ctrl.isRange()) {
                    const r = rangeOf(draft);
                    return good(r.start) && good(r.end) && !draftProblem();
                }
                return good(draft) && !draftProblem();
            };

            // the ends of a date-time range above its calendars: the draft's start and end ('' while not set), or what the
            // pick under the pointer would make of them (muted, as in the boxes)
            const endOf = (r, end) => {
                const p = r[end ? 'end' : 'start'];
                return good(p) ? E.format(p, displayFormat()) : '';
            };
            $ctrl.endText = end => endOf(previewRange() || rangeOf(draft), end);
            $ctrl.endPreviewing = end => {
                const preview = previewRange();
                return !!preview && endOf(preview, end) !== endOf(rangeOf(draft), end);
            };

            // type dates: how many are checked (of max-count)
            $ctrl.countText = () => texts.selectedCount.replace('{count}', String(datesOf(value).length)) +
                (maxCount() ? ' / ' + maxCount() : '');
            $ctrl.showToday = () => kind() === 'date' && !$ctrl.isRange();

            /**
             * Now as the field takes it (its hidden units their least: HH:mm drops the seconds), or null when it cannot be
             * taken. Below min only by those units (min="now" a moment ago: 12:17:30, Now 12:17:00), it is the next shown
             * moment (12:18:00) - the one the button gave was below min, the form invalid at once.
             */
            function nowValue() {
                if ($ctrl.isRange()) return null;
                const now = E.now(offset);
                const at = kind() === 'time' ? onTimeDay(now) : now;
                let p = finish(at, false);
                if (limits.min && E.compare(p, limits.min) < 0 && E.compare(at, limits.min) >= 0) {
                    const shows = shownUnits();
                    p = finish(E.add(p, 1, shows.s ? 'second' : (shows.m ? 'minute' : 'hour')), false);
                }
                return allowed(p, false) ? p : null;
            }

            $ctrl.nowAllowed = () => !!nowValue();

            // ------------------------------------------------------------------------------------- shortcuts

            const CATALOGUE = {
                day: {
                    now: (n, ws, now) => now,
                    today: n => n,
                    yesterday: n => E.addDays(n, -1),
                    tomorrow: n => E.addDays(n, 1),
                    weekAgo: n => E.addDays(n, -7),
                    startOfMonth: n => E.startOf(n, 'month'),
                    endOfMonth: n => E.startOf(E.endOf(n, 'month'), 'day'),
                    // one month, quarter, year or week (those types)
                    thisWeek: n => n,
                    lastWeek: n => E.addDays(n, -7),
                    nextWeek: n => E.addDays(n, 7),
                    thisMonth: n => n,
                    lastMonth: n => E.addMonths(n, -1),
                    nextMonth: n => E.addMonths(n, 1),
                    thisQuarter: n => n,
                    lastQuarter: n => E.addMonths(n, -3),
                    thisYear: n => n,
                    lastYear: n => E.add(n, -1, 'year'),
                    nextYear: n => E.add(n, 1, 'year')
                },
                range: {
                    today: n => [n, n],
                    yesterday: n => [E.addDays(n, -1), E.addDays(n, -1)],
                    last7Days: n => [E.addDays(n, -6), n],
                    last30Days: n => [E.addDays(n, -29), n],
                    thisWeek: (n, ws) => [E.startOf(n, 'week', ws), E.startOf(E.endOf(n, 'week', ws), 'day')],
                    lastWeek: (n, ws) => [E.addDays(E.startOf(n, 'week', ws), -7), E.addDays(E.startOf(n, 'week', ws), -1)],
                    thisMonth: n => [E.startOf(n, 'month'), E.startOf(E.endOf(n, 'month'), 'day')],
                    lastMonth: n => [E.startOf(E.addMonths(E.startOf(n, 'month'), -1), 'month'), E.addDays(E.startOf(n, 'month'), -1)],
                    thisQuarter: n => [E.startOf(n, 'quarter'), E.startOf(E.endOf(n, 'quarter'), 'day')],
                    thisYear: n => [E.startOf(n, 'year'), E.make(n.y, 12, 31)],
                    next7Days: n => [n, E.addDays(n, 6)],
                    next30Days: n => [n, E.addDays(n, 29)],
                    next3Months: n => [n, E.addDays(E.addMonths(n, 3), -1)],
                    next6Months: n => [n, E.addDays(E.addMonths(n, 6), -1)],
                    untilEndOfMonth: n => [n, E.startOf(E.endOf(n, 'month'), 'day')],
                    last3Months: n => monthsBack(n, 3),
                    last6Months: n => monthsBack(n, 6),
                    last12Months: n => monthsBack(n, 12),
                    yearToDate: n => [E.startOf(n, 'year'), n],
                    lastYear: n => [E.make(n.y - 1, 1, 1), E.make(n.y - 1, 12, 31)],
                    last4Quarters: n => [E.addMonths(E.startOf(n, 'quarter'), -9), n],
                    last5Years: n => [E.make(n.y - 4, 1, 1), n],
                    last10Years: n => [E.make(n.y - 9, 1, 1), n],
                    // to the second (date-time ranges)
                    last24Hours: (n, ws, now) => [addTime(now, -24, 'hour'), now, true],
                    next24Hours: (n, ws, now) => [now, addTime(now, 24, 'hour'), true]
                }
            };
            // the last k months: a month range's units (this month and the k - 1 before), else the days from the day after
            // the same date k months ago (as last30Days)
            function monthsBack(n, k) {
                return [$ctrl.hasUnits() ? E.addMonths(n, 1 - k) : E.addDays(E.addMonths(n, -k), 1), n];
            }
            const EXACT = {now: true, last24Hours: true, next24Hours: true};
            // one unit's names: for the month, quarter, year and week types only
            const UNIT_ONLY = {thisWeek: true, lastWeek: true, nextWeek: true, thisMonth: true, lastMonth: true, nextMonth: true,
                thisQuarter: true, lastQuarter: true, thisYear: true, lastYear: true, nextYear: true};

            // a rule of a shortcut ({offset}, {last}, {next}, {this}, {previous}, {from, to}) on today
            function fromRule(rule, now, ws) {
                const unit = E.unitOf(rule.unit || 'day') || 'day';
                const shift = (p, spec) => Object.keys(spec || {}).reduce((acc, key) => E.add(acc, spec[key], key), p);
                if (rule.offset) return shift(now, rule.offset);
                if (rule.last) return [E.addDays(E.add(now, -rule.last, unit), 1), now];
                if (rule.next) return [now, E.addDays(E.add(now, rule.next, unit), -1)];
                if (rule.this) return [E.startOf(now, rule.this, ws), E.startOf(E.endOf(now, rule.this, ws), 'day')];
                if (rule.previous) {
                    const start = E.add(E.startOf(now, rule.previous, ws), -1, rule.previous);
                    return [start, E.startOf(E.endOf(start, rule.previous, ws), 'day')];
                }
                if (rule.from || rule.to) return [shift(now, rule.from), shift(now, rule.to)];
                return null;
            }

            /**
             * The value of a shortcut now: a value (one) or {start, end} (a range), or null. Days get the picked day's
             * times (a date-time range: 00:00:00 to 23:59:59); now, last24Hours and next24Hours are to the second; the
             * unit types' values are the units the days are in.
             */
            function shortcutValue(item) {
                const now = E.now(offset);
                const day = E.startOf(now, 'day');
                const ws = weekStart();
                let v = null;
                let exact = false;
                let custom = false;
                try {
                    if (item.name) {
                        v = CATALOGUE[$ctrl.isRange() ? 'range' : 'day'][item.name](day, ws, now);
                        exact = EXACT[item.name] === true;
                    } else if (item.value instanceof Function) {
                        // ($now) => value, as documented: now to the second (a day's type takes its day)
                        v = item.value(now);
                        custom = true;
                    } else if (item.value && typeof item.value === 'object' && !Array.isArray(item.value) && item.value.y === undefined &&
                        !E.isDate(item.value)) {
                        v = fromRule(item.value, day, ws);
                    } else {
                        // a fixed value (a text, a Date, a number, parts)
                        v = item.value;
                        custom = true;
                    }
                } catch (e) {
                    v = null;
                }
                const read = (x, end) => (x && typeof x === 'object' && x.y !== undefined ? x : readValue(x, end));
                // a date-time shortcut of the page's whose value has its own time keeps it (it was set to the picked
                // day's time: 18:45:15 became 00:00:00); a date alone takes the day's time (default-time) as before
                const timed = x => E.isDate(x) || typeof x === 'number' || (x && typeof x === 'object' && x.h !== undefined) ||
                    (typeof x === 'string' && /\d{1,2}:\d{2}/.test(x));
                const asValue = (p, end, x) => (exact || (custom && $ctrl.hasClock() && !unit() && timed(x)) ? finish(E.copy(p), end)
                    : (unit() ? snap(p, end) : dayValue(E.startOf(p, 'day'), end)));
                if ($ctrl.isRange()) {
                    if (!Array.isArray(v) || v.length < 2) return null;
                    const s = read(v[0], false);
                    const e = read(v[1], true);
                    return good(s) && good(e) ? {start: asValue(s, false, v[0]), end: asValue(e, true, v[1])} : null;
                }
                const x = Array.isArray(v) ? v[0] : v;
                const d = read(x, singleEnd());
                return good(d) ? asValue(d, singleEnd(), x) : null;
            }

            function buildShortcuts() {
                const given = $ctrl.shortcuts;
                let list = [];
                if (given === true || given === 'true') list = SHORTCUTS[$ctrl.type] || [];
                else if (Array.isArray(given)) list = given;
                if (kind() === 'time' || $ctrl.isDates()) list = [];
                const catalogue = CATALOGUE[$ctrl.isRange() ? 'range' : 'day'];
                $ctrl.shortcutItems = list.map(item => {
                    if (typeof item === 'string') {
                        if (!catalogue[item] || (EXACT[item] && kind() !== 'datetime')) return null;
                        if (UNIT_ONLY[item] && !$ctrl.isRange() && !unit()) return null;
                        return {name: item, label: texts.shortcuts[item] || item};
                    }
                    return item && typeof item === 'object' && item.label ? {label: String(item.label), value: item.value} : null;
                }).filter(Boolean);
                // outside the limits (or a max-range): shown disabled, with the reason
                refreshShortcuts();
            }

            /** A shortcut's value is one the field cannot take now (outside the limits, a max-range, a disabled day). */
            function shortcutRefused(item) {
                const v = shortcutValue(item);
                if (!v) return true;
                if ($ctrl.isRange()) {
                    return !allowed(v.start, false) || !allowed(v.end, true) || E.compare(v.start, v.end) > 0 ||
                        !spanOk(v.start, v.end, $ctrl.maxRange, false) || !spanOk(v.start, v.end, $ctrl.minRange, true) ||
                        !clearBetween(v.start, v.end);
                }
                return !allowed(v, false);
            }

            // the shortcuts' states again (the limits changed while the panel is open)
            function refreshShortcuts() {
                $ctrl.shortcutItems.forEach(item => { item.disabled = shortcutRefused(item); });
            }

            // ------------------------------------------------------------------------------------- open, close, pick

            function canInput() {
                if ($ctrl.isDisabled() || $ctrl.isReadonly()) return false;
                // inside a disabled fieldset the browser disables the boxes: the trigger, Clear and the panel are off
                // too (they opened and cleared the field)
                const box = triggerEl ? triggerEl.querySelector('input.aui-date-picker__input') : null;
                return !(box && typeof box.matches === 'function' && box.matches(':disabled'));
            }

            function openPanel(focusInside) {
                if ($ctrl.isOpen || !canInput()) return;
                closeFinishing = false;
                refreshLimits();
                buildWeekdays();
                draft = copyValue(value);
                const r = rangeParts();
                const checked = datesOf(value).filter(good);
                const anchor = $ctrl.isDates() ? (checked.length ? checked[checked.length - 1] : null)
                    : $ctrl.isRange() ? (activeBox === 1 && good(r.end) ? r.end : (good(r.start) ? r.start : null))
                    : (good(value) ? value : null);
                const start = anchor && kind() !== 'time' ? anchor : clampToLimits(today());
                activeDay = E.startOf(unitStart(start), 'day');
                history = [];
                timeStep = null;
                touchedEnd = false;
                hoverDay = null;
                hoverEl = null;
                hoverByKeys = false;
                blockedDay = null;
                $ctrl.tip = null;
                $ctrl.activeEnd = $ctrl.isRange() ? activeBox : 0;
                $ctrl.mode = $ctrl.hasUnits() ? 'unit' : 'day';
                lastViewKey = '';
                $ctrl.isOpen = true;
                $ctrl.panelReady = true;
                window.addEventListener('resize', onWindowResize, {passive: true});
                buildBody();
                wakeBody();
                if ($ctrl.hasCalendar()) {
                    const two = $ctrl.calendarCount() === 2;
                    if (two && good(r.start) && anchor === r.end && (r.end.y * 12 + r.end.M) - (r.start.y * 12 + r.start.M) <= 1) {
                        setView(r.start.y, r.start.M);       // both ends in view
                    } else if (two && anchor && anchor === r.end) {
                        const left = E.addMonths(activeDay, -1);
                        setView(left.y, left.M);             // the end on the right
                    } else {
                        setView(activeDay.y, activeDay.M);
                    }
                }
                if ($ctrl.hasUnits()) {
                    const two = $ctrl.unitCount() === 2;
                    const step = kind() === 'year' ? 10 : 1;
                    const pageOf = p => (kind() === 'year' ? Math.floor(p.y / 10) * 10 : p.y);
                    if (two && good(r.start) && anchor === r.end && pageOf(r.end) - pageOf(r.start) <= step) {
                        setUnitView(pageOf(r.start));        // both ends in view
                    } else if (two && anchor && anchor === r.end) {
                        setUnitView(pageOf(activeDay) - step); // the end on the right
                    } else {
                        setUnitView(pageOf(activeDay));
                    }
                }
                buildShortcuts();
                buildTime();
                paintDraft();
                refreshRange(true);
                if (panelCtl) panelCtl.open();
                if (dismiss) dismiss.start();
                if (focusInside) focusInsideSoon();
                if ($ctrl.onOpen instanceof Function) pageAsk.ask(() => $ctrl.onOpen());
            }

            function clampToLimits(day) {
                if (kind() === 'time') return day;
                if (limits.min && E.compareDay(day, limits.min) < 0) return E.startOf(limits.min, 'day');
                if (limits.max && E.compareDay(day, limits.max) > 0) return E.startOf(limits.max, 'day');
                return day;
            }

            // the window's size changed while open (a phone turned, a split screen): as many months (pages) as now fit
            let resizeFrame = null;

            function onWindowResize() {
                if (resizeFrame !== null) return;
                resizeFrame = window.requestAnimationFrame(() => {
                    resizeFrame = null;
                    if (!$ctrl.isOpen || destroyed) return;
                    const months = $ctrl.hasCalendar() && $ctrl.mode === 'day' && $ctrl.calendarCount() !== $ctrl.calendars.length;
                    const pages = $ctrl.hasUnits() && $ctrl.unitCount() !== $ctrl.unitPages.length;
                    if (!months && !pages) return;
                    settle(false, () => {
                        if (months) {
                            buildCalendars();
                            if (activeDay) showMonthOf(activeDay);
                        }
                        if (pages) {
                            buildUnits();
                            if (activeDay) showUnitOf(activeDay);
                        }
                    });
                });
            }

            let bodyBuilt = false;

            function buildBody() {
                if (bodyBuilt || !panelEl) return;
                bodyBuilt = true;
                if (!bodyLinker) bodyLinker = $compile(PANEL_BODY);
                bodyLinker($scope, clone => angular.element(panelEl).append(clone));
            }

            function closePanel(restoreFocus) {
                if (!$ctrl.isOpen) return;
                pageAsk.flush();   // on-open still waiting for the opening's frame: now (on-open before on-close)
                $ctrl.isOpen = false;
                window.removeEventListener('resize', onWindowResize);
                keyboardAway(false);
                history = [];
                timeStep = null;
                hoverDay = null;
                hoverEl = null;
                hoverByKeys = false;
                blockedDay = null;
                $ctrl.tip = null;
                if (dismiss) dismiss.stop();
                if (restoreFocus) focusBox(activeBox);
                if (panelCtl) {
                    closeFinishing = true;
                    panelCtl.close();
                } else {
                    $ctrl.panelReady = false;
                }
            }

            function markTouched() {
                const m = model();
                if (m && !m.$touched) m.$setTouched();
            }

            /**
             * A close from the user's input, as the selects': this field's digest now, the page's code (touched,
             * on-close, then the value) in it, the page's bindings after the close's first frame.
             */
            function closeFromInput(restoreFocus, then) {
                if (!$ctrl.isOpen) {
                    if (then) then();
                    return;
                }
                closePanel(restoreFocus);
                markTouched();
                if ($ctrl.onClose instanceof Function) $scope.$evalAsync(() => $ctrl.onClose());
                if (then) $scope.$evalAsync(then);
                pageDigest.owe(!then);
            }

            // closed: the body is kept, hidden with the panel, its watchers aside (suspendScope) until it opens again
            function onPanelClosed() {
                if (!closeFinishing || $ctrl.isOpen || destroyed) return;
                closeFinishing = false;
                localDigest();
                const body = panelEl && panelEl.querySelector('.aui-date-picker__body');
                if (!body || bodyAside) return;
                bodyAside = suspendScope(angular.element(body).scope());
                keepBody(true);
            }

            function wakeBody() {
                if (bodyAside) resumeScope(bodyAside);
                bodyAside = null;
                keepBody(false);
            }

            // listed among the fields keeping a closed body (last), or off the list; past KEPT_BODIES the first gives its
            // body back (the next opening builds it again)
            function keepBody(on) {
                const at = keptBodies.indexOf(giveBodyBack);
                if (at >= 0) keptBodies.splice(at, 1);
                if (on) keptBodies.push(giveBodyBack);
                if (keptBodies.length > KEPT_BODIES) keptBodies.shift()();
            }

            function giveBodyBack() {
                if (destroyed || $ctrl.isOpen || !bodyAside) return;
                bodyAside = null;
                $ctrl.panelReady = false;
                $ctrl.timeGroups = [];
                $ctrl.slotItems = [];
                localDigest();
            }

            /** Next: a date-time range's start set, its end not yet (or not after it) - the end's day is chosen next; or
             * its end set first, no start yet - the start's day next. */
            $ctrl.canNext = () => stepsTime() && $ctrl.isOpen && !$ctrl.canTake()
                && (($ctrl.activeEnd === 0 && good(rangeOf(draft).start)) || endFirst());
            // Next names the end it goes on to (a range may be set from either end)
            $ctrl.okText = () => ($ctrl.canNext() ? ($ctrl.activeEnd === 0 ? texts.toEnd : texts.toStart) : texts.ok);

            // the time columns while the time of the end just picked is set: tinted (a glow as each step begins)
            $ctrl.clockClass = () => (stepOn() ? 'aui-date-picker__clock--step aui-date-picker__clock--pulse-' + (stepPulse % 2) : '');

            function goNext() {
                if (!$ctrl.canNext()) return;
                const inPanel = !!panelEl && panelEl.contains(document.activeElement);
                history.push({draft: copyValue(draft), active: $ctrl.activeEnd, step: timeStep});
                timeStep = null;
                $ctrl.activeEnd = $ctrl.activeEnd === 1 ? 0 : 1;
                activeBox = $ctrl.activeEnd;
                buildTime();
                refreshRange();
                // the keyboard back to the days; a box with the focus: the end's
                if (inPanel) focusActiveSoon();
                else followFocus();
            }

            // OK, or Enter in the time: the draft taken when it can be, else Next
            function confirmDraft() {
                if (!takeDraft('pick')) goNext();
            }

            /** The draft taken (OK, Enter, a close that keeps it): when it is whole and allowed. */
            function takeDraft(source, restoreFocus) {
                // the page's rule asked anew for the range taken (the footer's answer may be from before a change of it)
                crossings.clear();
                if (!$ctrl.canTake()) return false;
                const next = copyValue(draft);
                if ($ctrl.isRange()) {
                    next.start = finish(next.start, false);
                    next.end = finish(next.end, true);
                }
                const taken = $ctrl.isRange() ? next : finish(next, false);
                closeFromInput(restoreFocus !== false, () => commit(taken, source));
                return true;
            }

            /**
             * A close that is not OK (a press outside, the field left). A time's draft is taken when it is whole and
             * allowed (commit-on-close; a text typed into a box is in the draft already). Else what was typed is taken
             * as typed (a text that is not a value: the box kept, the field invalid), the rest shows the value again.
             */
            function closeKeeping() {
                const typed = typedBoxes();
                const boxes = boxEls();
                const unreadable = typed.some(i => readBox(boxes[i].value, i === 1) === null);
                const changed = !angular.equals(modelOf(draft), modelOf(value));
                if (drafts() && !unreadable && changed && (commitOnClose() || typed.length) && $ctrl.canTake()) {
                    takeDraft(typed.length ? 'input' : 'pick', false);
                    return;
                }
                for (let i = 0; i < boxes.length; i += 1) {
                    if (typed.indexOf(i) >= 0) {
                        const index = i;
                        $scope.$evalAsync(() => takeBox(index));
                    }
                }
                showTexts(valueTexts(), true);
                closeFromInput(false);
            }

            /**
             * A change with the panel open (dates checked one after another), as in aui-select: the value and the page's
             * code (ng-change, on-change) at once, in this field's own digest; the page's digest once the picking
             * pauses, or at the first input elsewhere (pageDigest.oweAfterPause).
             */
            function pickInPlace(fn) {
                if ($scope.$root.$$phase) {
                    fn();
                    return;
                }
                $scope.$evalAsync(fn);
                localDigest();
                pageDigest.oweAfterPause();
            }

            /** Type dates: a day checked or unchecked, the panel staying open (max-count: no more once reached). */
            function toggleDate(day) {
                const list = datesOf(value).filter(good).map(E.copy);
                let at = -1;
                list.forEach((d, i) => {
                    if (sameDay(d, day)) at = i;
                });
                if (at >= 0) {
                    list.splice(at, 1);
                } else {
                    if (maxCount() && list.length >= maxCount()) return;
                    list.push(dayValue(day, false));
                }
                const next = list.length ? sortDays(list) : null;
                pickInPlace(() => commit(next, 'pick'));
            }

            /**
             * A day picked: the value (a date; a week: its week), checked or unchecked (dates), the draft's day (a
             * date-time), a range's first and then second day.
             */
            function pickDay(day) {
                if (!pickable(day)) return;
                activeDay = E.startOf(day, 'day');
                if ($ctrl.isDates()) {
                    toggleDate(day);
                    return;
                }
                if ($ctrl.isWeek()) {
                    closeFromInput(true, () => commit(snap(day, singleEnd()), 'pick'));
                    return;
                }
                if (kind() === 'date' && !$ctrl.isRange()) {
                    closeFromInput(true, () => commit(dayValue(day, false), 'pick'));
                    return;
                }
                if (!$ctrl.isRange()) {
                    // a date-time: the day set in the draft, its time kept; the time is set next
                    setDraftEnd(0, finish(dayValue(day, false, good(draft) ? draft : null), false));
                    beginStep(0);
                    buildTime();
                    return;
                }
                pickRangeAt(E.startOf(day, 'day'));
            }

            // ------------------------------------------------------------------------------------- a range's ends

            /** A range's end as a picked day (unit) gives it: a day's default time (a date-time: the time it had), a
             * unit's first or last moment. */
            function endValue(day, end, had) {
                if (unit()) return snap(day, end);
                if (kind() === 'datetime') return finish(dayValue(day, end, good(had) ? had : null), end);
                return dayValue(day, end);
            }

            // the end kept when the start moves: after it and within the limits (a date-time's end time moved into
            // them when its day allows); null: the end is cleared
            function keptEnd(start, end) {
                if ((unit() ? compareUnit(end, start) : E.compareDay(end, start)) < 0) return null;
                const e = kind() === 'datetime' ? fitEnd(start, end) : end;
                if (!e || E.compare(e, start) < 0) return null;
                return spanOk(start, e, $ctrl.maxRange, false) && spanOk(start, e, $ctrl.minRange, true) && clearBetween(start, e) ? e : null;
            }

            /**
             * The range r with a day (unit) picked at its end `active` (0 start, 1 end): {start, end, active (the end
             * set next), ended (its end was set)}. The start: the day; the end kept if it still fits, else cleared; the
             * end next. The end: the day - or, before the start, the new start (the end next again); with no start yet,
             * the start next.
             */
            function rangeAfterPick(r, active, day) {
                const start = good(r.start) ? r.start : null;
                const end = good(r.end) ? r.end : null;
                const had = rangeOf(value);
                if (active === 0) {
                    const s = endValue(day, false, start || had.start);
                    return {start: s, end: end ? keptEnd(s, end) : null, active: 1, ended: false};
                }
                if (start && (unit() ? compareUnit(day, start) : E.compareDay(day, start)) < 0) {
                    return {start: endValue(day, false, start), end: null, active: 1, ended: false};
                }
                const e = endValue(day, true, end || had.end);
                if (!start) return {start: null, end: e, active: 0, ended: true};
                return {start: start, end: kind() === 'datetime' ? (fitEnd(start, e) || e) : e, active: 1, ended: true};
            }

            // the draft differs from the value: worked out once for each draft and value (the days ask it in every digest)
            let changedMemo = {draft: undefined, value: undefined, result: false};

            function draftChanged() {
                if (changedMemo.draft !== draft || changedMemo.value !== value) {
                    changedMemo = {draft: draft, value: value, result: !angular.equals(modelOf(draft), modelOf(value))};
                }
                return changedMemo.result;
            }

            /** The end the pick under the pointer would change (0 start, 1 end): a day before the start while the end is
             * set makes a new start. With no pick under the pointer, the end being set. */
            function barEnd() {
                const preview = previewRange();
                if (!preview) return $ctrl.activeEnd;
                const r = rangeOf(draft);
                const changed = (a, b) => (good(a) ? E.format(a, valueFormat()) : '') !== (good(b) ? E.format(b, valueFormat()) : '');
                if (changed(preview.start, r.start)) return 0;
                if (changed(preview.end, r.end)) return 1;
                return $ctrl.activeEnd;
            }

            // the focus in one of the boxes moves to the box of the end being set (typing goes where the underline is);
            // a focus in the panel (the keyboard in the calendar) stays
            function followFocus() {
                const focused = document.activeElement;
                if (!focused || !focused.classList || !focused.classList.contains('aui-date-picker__input') || !triggerEl.contains(focused)) return;
                if ((Number(focused.getAttribute('data-box')) || 0) !== $ctrl.activeEnd) focusBox($ctrl.activeEnd);
            }

            /** What a pick at the day (unit) under the pointer would make of the range: drawn before it is made. */
            function previewRange() {
                if (!hoverDay || !$ctrl.isRange() || !$ctrl.isOpen || kind() === 'time') return null;
                if (previewMemo.hover === hoverDay && previewMemo.draft === draft && previewMemo.active === $ctrl.activeEnd &&
                    previewMemo.step === timeStep) return previewMemo.result;
                const next = rangeAfterPick(rangeOf(draft), pickTarget(hoverDay), hoverDay);
                previewMemo = {hover: hoverDay, draft: draft, active: $ctrl.activeEnd, step: timeStep, result: {start: next.start, end: next.end}};
                return previewMemo.result;
            }

            /**
             * A day (unit) picked into a range: the end being set (the underline) takes it (rangeAfterPick), the step
             * kept for Escape. A range of days or units is taken once its end is picked with its start there (or its
             * start picked after its end). A date-time range: the time of the end whose day was picked is set next (a
             * new start's too; Next or a later day goes on to the end), and it waits for OK.
             */
            function pickRangeAt(day) {
                history.push({draft: copyValue(draft), active: $ctrl.activeEnd, step: timeStep});
                const next = rangeAfterPick(rangeOf(draft), pickTarget(day), day);
                if (next.ended) touchedEnd = true;
                draft = {start: next.start, end: next.end};
                timeStep = null;
                if (stepsTime()) {
                    $ctrl.activeEnd = next.ended ? 1 : 0;
                    beginStep($ctrl.activeEnd);
                } else {
                    $ctrl.activeEnd = next.active;
                }
                activeBox = $ctrl.activeEnd;
                hoverDay = null;
                hoverEl = null;
                hoverByKeys = false;
                blockedDay = null;
                $ctrl.tip = null;
                if (!$ctrl.hasClock() && good(draft.start) && good(draft.end) && (next.ended || touchedEnd)) {
                    const taken = copyValue(draft);
                    closeFromInput(true, () => commit(taken, 'pick'));
                    return;
                }
                paintDraft();
                buildTime();
                refreshRange();
                followFocus();
            }

            /** Escape while a range is set: its last pick undone (true), or none left (false). */
            function stepBack() {
                if (!history.length) return false;
                const last = history.pop();
                draft = last.draft;
                $ctrl.activeEnd = last.active;
                activeBox = last.active;
                timeStep = last.step === undefined ? null : last.step;
                hoverDay = null;
                hoverEl = null;
                hoverByKeys = false;
                blockedDay = null;
                $ctrl.tip = null;
                paintDraft();
                buildTime();
                refreshRange();
                followFocus();
                return true;
            }

            /** The underline, the duration chips and the boxes' preview follow the range being set. place: at once
             * (the opening: no slide from where it was). */
            function refreshRange(place) {
                if (!$ctrl.isRange()) return;
                placeBar(place, barEnd());
                buildDurations();
                showPreview();
                if (hoverDay) showTip();
                else if (blockedDay) tipAt(limitText(blockedDay), hoverEl);
            }

            // the underline under the text of the end being set, or of the end the pick under the pointer would change
            // (end: 0 or 1; shown while open: CSS), moved by transform only: as wide as the text (its placeholder while
            // empty), which the box centres; digits measured as 0s (tabular), so a date shown under the pointer is a
            // width known already
            function placeBar(atOnce, end) {
                const bar = triggerEl && triggerEl.querySelector('.aui-date-picker__bar');
                const index = end === undefined ? $ctrl.activeEnd : end;
                const box = boxEls()[index];
                if (!bar || !box) return;
                if (!geometry) geometry = {rooms: [], bars: []};
                let place = geometry.bars[index];
                if (!place) {
                    const t = bar.parentElement.getBoundingClientRect();
                    const b = box.getBoundingClientRect();
                    if (!b.width) return;
                    place = {left: Math.round(b.left - t.left), width: b.width};
                    geometry.bars[index] = place;
                }
                const text = (box.value || box.placeholder || '').replace(/\d/g, '0');
                const spacing = box.classList.contains('aui-date-picker__input--tight') ? TIGHT_SPACING : 'normal';
                const width = text ? Math.min(place.width, Math.ceil(textWidth(text, box, spacing)) + 4) : place.width;
                if (atOnce) bar.style.transition = 'none';
                bar.style.transform = 'translateX(' + (place.left + Math.round((place.width - width) / 2)) + 'px) scaleX(' + (width / 100) + ')';
                if (atOnce) {
                    void bar.offsetWidth;
                    bar.style.transition = '';
                }
            }

            /** The pick under the pointer shown in the boxes (muted, nothing taken); none: the draft again. A box the
             * user is typing in is left as it is. */
            function showPreview() {
                if (!$ctrl.isRange() || !$ctrl.isOpen) return;
                const preview = previewRange();
                const shown = textsOf(preview || draft);
                const own = textsOf(draft);
                const typed = typedBoxes();
                const boxes = boxEls();
                showTexts(shown, true);
                for (let i = 0; i < boxes.length; i += 1) {
                    if (typed.indexOf(i) >= 0) continue;
                    boxes[i].classList.toggle('aui-date-picker__input--preview', !!preview && shown[i] !== own[i]);
                }
            }

            /** The day (unit) under the pointer or the keyboard (byKeys): the pick previewed, its length beside it (el).
             * None (null): nothing previewed. */
            function setHover(p, el, byKeys) {
                // the tip's place read first, before anything is written (no layout forced afterwards)
                const place = p && el ? tipPlace(el) : null;
                hoverDay = p;
                hoverEl = p ? el : null;
                hoverByKeys = !!p && !!byKeys;
                blockedDay = null;
                showPreview();
                placeBar(false, barEnd());
                showTip(place);
            }

            // the tip above the day under the pointer: the length of the range its pick makes - named "Start" when the
            // pick sets the start (its length then counted from the pointer to the end kept: without the name it would
            // read as an end's); a new start alone (the end cleared): "New start"
            function showTip(place) {
                const preview = previewRange();
                const whole = preview && good(preview.start) && good(preview.end);
                const end = preview ? barEnd() : $ctrl.activeEnd;
                const text = whole ? (end === 0 ? texts.startAt.replace('{length}', lengthText(preview)) : lengthText(preview))
                    : (preview && end === 0 && good(preview.start) ? texts.newStart : '');
                tipAt(text, hoverEl, place);
            }

            // the tip with a text above el (none: no text, or el not in the panel any more); place: read before (tipPlace)
            function tipAt(text, el, place) {
                const at = text ? (place || tipPlace(el)) : null;
                if (!at) {
                    $ctrl.tip = null;
                    return;
                }
                $ctrl.tip = {text: text, style: {left: at.left + 'px', top: at.top + 'px'}};
                if (at.left < TIP_EDGE || at.left > at.width - TIP_EDGE) keepTipInside($ctrl.tip, at.width);
            }

            // a tip whose anchor is near the panel's side: measured once drawn (next frame) and moved inside the panel, so
            // that it never runs out of it (a panel that scrolls would get a scrollbar)
            const TIP_EDGE = 160;
            let tipFrame = null;

            function keepTipInside(tip, width) {
                if (tipFrame !== null) window.cancelAnimationFrame(tipFrame);
                tipFrame = window.requestAnimationFrame(() => {
                    tipFrame = null;
                    if (destroyed || $ctrl.tip !== tip || !panelEl) return;
                    const el = panelEl.querySelector('.aui-date-picker__tip');
                    if (!el || !el.offsetWidth) return;
                    const half = el.offsetWidth / 2;
                    const left = parseFloat(tip.style.left);
                    const inside = Math.round(Math.min(Math.max(left, half + 6), width - half - 6));
                    if (inside !== left) {
                        tip.style.left = inside + 'px';
                        el.style.left = tip.style.left;
                    }
                });
            }

            // where a tip above el goes, in the panel's layout pixels (the panel may still be scaled by its opening)
            function tipPlace(el) {
                if (!el || !panelEl || !panelEl.contains(el)) return null;
                const panel = panelEl.getBoundingClientRect();
                const r = el.getBoundingClientRect();
                const scale = panelEl.offsetHeight ? panel.height / panelEl.offsetHeight : 1;
                return {left: Math.round((r.left + r.width / 2 - panel.left) / scale), top: Math.round((r.top - panel.top) / scale),
                    width: panelEl.clientWidth};
            }

            /** A day (unit) a range's length rules out while its end is set: why ("At most 14 days", "At least 2 days");
             * '' for any other day (disabled, past a disabled day, pickable). */
            function limitText(day) {
                const anchor = anchorStart();
                if (!anchor || dayDisabled(day) || countFull(day)) return '';
                const from = E.startOf(unitStart(anchor), 'day');
                if (E.compareDay(day, from) < 0) return '';
                const block = blockAfter(from, day);
                if (block && E.compareDay(day, block) > 0) return '';
                let far = false;
                let near = false;
                if ($ctrl.hasClock()) {
                    if (kind() !== 'datetime' || dayFits(day, anchor)) return '';
                    const reach = reachFrom(anchor, true);
                    const dayFirst = E.make(day.y, day.M, day.d);
                    far = !!reach.hi && E.compare(E.compare(dayFirst, anchor) > 0 ? dayFirst : anchor, reach.hi) > 0;
                    near = !far && !!reach.lo && E.compare(E.make(day.y, day.M, day.d, 23, 59, 59), reach.lo) < 0;
                } else {
                    const reach = unitEnd(day);
                    const farthest = spanLimit(from, $ctrl.maxRange, true);
                    const nearest = spanLimit(from, $ctrl.minRange, true);
                    far = !!farthest && E.compareDay(reach, farthest) > 0;
                    near = !far && !!nearest && E.compareDay(reach, nearest) < 0;
                }
                const d = far || near ? E.parseDuration(far ? $ctrl.maxRange : $ctrl.minRange) : null;
                return d ? (far ? texts.atMost : texts.atLeast).replace('{length}', durationLabel(d)) : '';
            }

            /** A range's length as people count it: days (both ends counted), months, quarters, years; a date-time or
             * time range in days, hours and minutes (an end's last second counted). */
            function lengthText(r) {
                const L = texts.length;
                const count = (n, one, many) => (n === 1 ? one : many).replace('{n}', String(n));
                if (kind() === 'date') return count(E.dayNumber(r.end.y, r.end.M, r.end.d) - E.dayNumber(r.start.y, r.start.M, r.start.d) + 1, L.day, L.days);
                if (kind() === 'month' || kind() === 'quarter') {
                    const months = (r.end.y * 12 + r.end.M) - (r.start.y * 12 + r.start.M) + 1;
                    return kind() === 'month' ? count(months, L.month, L.months) : count(Math.round(months / 3), L.quarter, L.quarters);
                }
                if (kind() === 'year') return count(r.end.y - r.start.y + 1, L.year, L.years);
                let secs = Math.round((E.toTimestamp(r.end, 0) - E.toTimestamp(r.start, 0)) / 1000);
                if (secs < 0) return '';
                // an end's last second counts (an end at 23:59:59 closes its day: 9th 00:00 to 16th 23:59:59 is 8 days)
                if (r.end.s === 59) secs += 1;
                const parts = [];
                const d = Math.floor(secs / 86400);
                const h = Math.floor((secs % 86400) / 3600);
                const m = Math.floor((secs % 3600) / 60);
                if (d) parts.push(count(d, L.day, L.days));
                if (h) parts.push(L.hours.replace('{n}', String(h)));
                if (m) parts.push(L.minutes.replace('{n}', String(m)));
                if (shownUnits().s && secs % 60) parts.push(L.seconds.replace('{n}', String(secs % 60)));
                return parts.length ? parts.join(' ') : L.minutes.replace('{n}', '0');
            }

            /** The status of a range being set: what to choose next, or its length once whole. */
            $ctrl.rangeStatus = function () {
                if (!$ctrl.isRange() || !$ctrl.isOpen) return '';
                const r = rangeOf(draft);
                if (good(r.start) && good(r.end) && E.compare(r.start, r.end) <= 0) return lengthText(r);
                const name = texts.unitNames[kind()] || texts.unitNames.date;
                if (stepsTime() && stepOn() && timeStep === 0 && good(r.start)) return texts.setStartTime.replace('{unit}', name);
                if (stepsTime() && stepOn() && timeStep === 1 && good(r.end) && !good(r.start)) return texts.setEndTime.replace('{unit}', name);
                return ($ctrl.activeEnd === 1 ? texts.chooseEnd : texts.chooseStart).replace('{unit}', name);
            };

            // ---- duration chips (durations="['7d', '14d', '1M']"): the end that far from the start, once it is set
            $ctrl.durationList = [];

            // the end a duration gives from the start: a range of days or units, both ends counted (7d from the 1st:
            // the 7th); a date-time or time range, that time on (at the shown precision). A time range is of one day:
            // a duration that passes midnight gives no end (+2 h from 23:15 gave 01:15, a range read back as reversed)
            function durationEnd(start, spec) {
                const d = E.parseDuration(spec);
                if (!d) return null;
                if ($ctrl.hasClock()) {
                    const end = finish(E.add(start, d.n, d.unit), true);
                    return kind() === 'time' && end && E.compareDay(end, start) !== 0 ? null : end;
                }
                const last = spanLimit(E.startOf(unitStart(start), 'day'), spec, true);
                return last ? endValue(last, true) : null;
            }

            function durationLabel(d) {
                const L = texts.length;
                const count = (one, many) => (d.n === 1 ? one : many).replace('{n}', String(d.n));
                switch (d.unit) {
                    case 'week': return count(L.week, L.weeks);
                    case 'month': return count(L.month, L.months);
                    case 'quarter': return count(L.quarter, L.quarters);
                    case 'year': return count(L.year, L.years);
                    case 'hour': return L.hours.replace('{n}', String(d.n));
                    case 'minute': return L.minutes.replace('{n}', String(d.n));
                    case 'second': return L.seconds.replace('{n}', String(d.n));
                    default: return count(L.day, L.days);
                }
            }

            function buildDurations() {
                const given = Array.isArray($ctrl.durations) ? $ctrl.durations : [];
                const start = rangeOf(draft).start;
                if (!given.length || !$ctrl.isRange() || $ctrl.activeEnd !== 1 || !good(start)) {
                    if ($ctrl.durationList.length) $ctrl.durationList = [];
                    return;
                }
                $ctrl.durationList = given.map(spec => {
                    const d = E.parseDuration(spec);
                    if (!d) return null;
                    const end = durationEnd(start, spec);
                    const fits = !!end && E.compare(end, start) >= 0 && allowed(end, true) && spanOk(start, end, $ctrl.maxRange, false) &&
                        spanOk(start, end, $ctrl.minRange, true) && clearBetween(start, end);
                    return {spec: String(spec), label: durationLabel(d), disabled: !fits};
                }).filter(Boolean);
            }

            /** A duration chip: the end that far from the start (as a pick of the end). */
            function pickDuration(spec) {
                const start = rangeOf(draft).start;
                const item = $ctrl.durationList.filter(x => x.spec === spec)[0];
                if (!good(start) || !item || item.disabled) return;
                const end = durationEnd(start, spec);
                history.push({draft: copyValue(draft), active: $ctrl.activeEnd, step: timeStep});
                touchedEnd = true;
                draft = {start: start, end: end};
                $ctrl.activeEnd = 1;
                activeBox = 1;
                timeStep = null;
                if (stepsTime()) beginStep(1);
                if (!$ctrl.hasClock()) {
                    const taken = copyValue(draft);
                    closeFromInput(true, () => commit(taken, 'pick'));
                    return;
                }
                showValueOf(end);
                paintDraft();
                buildTime();
                refreshRange();
                followFocus();
            }

            /** A month, quarter or year picked: the value; a range's first and then second one. */
            function pickUnit(p) {
                if (!unitPickable(p)) return;
                const start = E.startOf(unitStart(p), 'day');
                activeDay = start;
                if (!$ctrl.isRange()) {
                    closeFromInput(true, () => commit(snap(start, singleEnd()), 'pick'));
                    return;
                }
                pickRangeAt(start);
            }

            function applyShortcut(item) {
                // checked again at the click: the limits may have changed since the list was drawn
                if (!item || item.disabled || !canInput() || shortcutRefused(item)) return;
                const v = shortcutValue(item);
                if (!v) return;
                closeFromInput(true, () => commit(v, 'shortcut'));
            }

            function takeNow() {
                const p = nowValue();
                if (!canInput() || !p) return;
                closeFromInput(true, () => commit(p, 'now'));
            }

            function clearValue(source) {
                history = [];
                timeStep = null;
                draft = null;
                if ($ctrl.isOpen) closeFromInput(false, () => commit(null, source || 'clear'));
                else settle(true, () => commit(null, source || 'clear'));
            }

            // ------------------------------------------------------------------------------------- keyboard

            function focusBox(index) {
                const boxes = boxEls();
                kit.focusQuietly(boxes[Math.min(index, boxes.length - 1)] || boxes[0]);
            }

            /** The keyboard into the panel: the calendar's day, or the first time column's chosen option. */
            function focusInsideSoon() {
                $timeout(() => {
                    if (!$ctrl.isOpen || !panelEl) return;
                    const target = panelEl.querySelector('.aui-date-picker__cell[tabindex="0"]') ||
                        panelEl.querySelector('.aui-date-picker__day[tabindex="0"]') ||
                        panelEl.querySelector('.aui-date-picker__unit[tabindex="0"]') ||
                        panelEl.querySelector('.aui-date-picker__time[tabindex="0"]');
                    if (target) kit.focusQuietly(target);
                }, 0, false);
            }

            // the keyboard on to the time of the end just picked (its first column's chosen option)
            function focusTimeSoon() {
                $timeout(() => {
                    if (!$ctrl.isOpen || !panelEl) return;
                    const group = $ctrl.isRange() ? $ctrl.activeEnd : 0;
                    const btn = panelEl.querySelector('.aui-date-picker__column[data-group="' + group + '"] .aui-date-picker__time[tabindex="0"]');
                    if (btn) kit.focusQuietly(btn);
                }, 0, false);
            }

            // the keys that move the keyboard's day or unit
            const MOVE_KEYS = {ArrowLeft: true, ArrowRight: true, ArrowUp: true, ArrowDown: true, PageUp: true, PageDown: true, Home: true, End: true};

            // the focus on the keyboard's day (unit) now, the panel drawn in this field's digest: a month changed under a
            // held key replaces the focused button, and a key repeat before a later focus would reach the page
            function focusActiveNow() {
                if (!$ctrl.isOpen || !panelEl) return;
                const btn = panelEl.querySelector('.aui-date-picker__day[tabindex="0"]') || panelEl.querySelector('.aui-date-picker__unit[tabindex="0"]');
                if (btn && btn !== document.activeElement) kit.focusQuietly(btn);
            }

            function focusActiveSoon() {
                $timeout(() => {
                    if (!$ctrl.isOpen || !panelEl) return;
                    const btn = panelEl.querySelector('.aui-date-picker__day[tabindex="0"]') ||
                        panelEl.querySelector('.aui-date-picker__unit[tabindex="0"]');
                    if (btn) kit.focusQuietly(btn);
                }, 0, false);
            }

            /** The keyboard's day moved by step days (or months / years): kept on a pickable day, the view following. */
            function moveActive(stepDays, by) {
                const from = activeDay || today();
                let next = by ? E.add(from, stepDays, by) : E.addDays(from, stepDays);
                const direction = stepDays < 0 ? -1 : 1;
                let tries = 0;
                while (!pickable(next) && tries < SEARCH_LIMIT) {
                    next = E.addDays(next, direction);
                    tries += 1;
                }
                if (!pickable(next)) return;
                activeDay = next;
                showMonthOf(next);
                if ($ctrl.isRange()) setHover(next, null, true);
                focusActiveSoon();
            }

            function onGridKeydown(event) {
                const ws = weekStart();
                switch (event.key) {
                    case 'ArrowLeft': moveActive(-1); break;
                    case 'ArrowRight': moveActive(1); break;
                    case 'ArrowUp': moveActive(-7); break;
                    case 'ArrowDown': moveActive(7); break;
                    case 'PageUp': moveActive(-1, event.shiftKey ? 'year' : 'month'); break;
                    case 'PageDown': moveActive(1, event.shiftKey ? 'year' : 'month'); break;
                    case 'Home': moveActive(-((E.weekday(activeDay) - ws + 7) % 7)); break;
                    case 'End': moveActive(6 - ((E.weekday(activeDay) - ws + 7) % 7)); break;
                    case 'Enter':
                    case ' ':
                        if (kit.isRepeat(event)) break;
                        event.preventDefault();
                        if (activeDay) {
                            pickDay(activeDay);
                            // a date-time: on to the time of the end just picked
                            if (stepOn()) focusTimeSoon();
                        }
                        return true;
                    default: return false;
                }
                event.preventDefault();
                return true;
            }

            // n units on from p (months, quarters, years)
            function unitStep(p, n) {
                if (kind() === 'month') return E.addMonths(p, n);
                if (kind() === 'quarter') return E.addMonths(p, n * 3);
                return E.add(p, n, 'year');
            }

            /** The keyboard's unit moved by n: kept on a pickable one, the pages following. */
            function moveUnit(n) {
                let next = unitStep(activeDay || unitStart(today()), n);
                const direction = n < 0 ? -1 : 1;
                let tries = 0;
                while (!unitPickable(next) && tries < 120) {
                    next = unitStep(next, direction);
                    tries += 1;
                }
                if (!unitPickable(next) || next.y < 1 || next.y > 9999) return;
                activeDay = E.startOf(unitStart(next), 'day');
                showUnitOf(activeDay);
                if ($ctrl.isRange()) setHover(activeDay, null, true);
                focusActiveSoon();
            }

            /** On a month, quarter or year: arrows by one and by a row, PageUp / PageDown by a page, Enter or Space picks. */
            function onUnitKeydown(event) {
                const row = UNIT_COLUMNS[kind()];
                const page = kind() === 'month' ? 12 : (kind() === 'quarter' ? 4 : 10);
                switch (event.key) {
                    case 'ArrowLeft': moveUnit(-1); break;
                    case 'ArrowRight': moveUnit(1); break;
                    case 'ArrowUp': moveUnit(-row); break;
                    case 'ArrowDown': moveUnit(row); break;
                    case 'PageUp': moveUnit(-page); break;
                    case 'PageDown': moveUnit(page); break;
                    case 'Enter':
                    case ' ':
                        if (kit.isRepeat(event)) break;
                        event.preventDefault();
                        if (activeDay) pickUnit(activeDay);
                        return;
                    default: return;
                }
                event.preventDefault();
            }

            /** In a time column: up and down choose (and set), left and right move between columns, Enter takes. */
            function onColumnKeydown(event, button) {
                const column = button.closest('.aui-date-picker__column');
                const items = Array.prototype.slice.call(column.querySelectorAll('.aui-date-picker__time:not(:disabled)'));
                const at = items.indexOf(button);
                const columns = Array.prototype.slice.call(panelEl.querySelectorAll('.aui-date-picker__column'));
                const col = columns.indexOf(column);
                let next = null;
                switch (event.key) {
                    case 'ArrowUp': next = items[Math.max(0, at - 1)]; break;
                    case 'ArrowDown': next = items[Math.min(items.length - 1, at + 1)]; break;
                    case 'Home': next = items[0]; break;
                    case 'End': next = items[items.length - 1]; break;
                    case 'ArrowLeft':
                    case 'ArrowRight': {
                        // the next column's chosen option, or its first one that can be chosen (its first one stayed, and when
                        // it was disabled the focus did not move)
                        const other = columns[col + (event.key === 'ArrowLeft' ? -1 : 1)];
                        if (other) {
                            const enabled = other.querySelector('.aui-date-picker__time--selected:not(:disabled)') ||
                                other.querySelector('.aui-date-picker__time:not(:disabled)');
                            if (enabled) kit.focusQuietly(enabled);
                        }
                        event.preventDefault();
                        return;
                    }
                    case 'Enter':
                        if (kit.isRepeat(event)) return;
                        event.preventDefault();
                        if ($ctrl.usesSlots()) {
                            pickSlot(button);
                            return;
                        }
                        confirmDraft();
                        return;
                    default: return;
                }
                event.preventDefault();
                if (!next || next === button) return;
                if ($ctrl.usesSlots()) {
                    kit.focusQuietly(next);
                    return;
                }
                chooseTime(next);
                $timeout(() => {
                    const again = panelEl && panelEl.querySelector('.aui-date-picker__column[data-unit="' + column.getAttribute('data-unit') +
                        '"][data-group="' + column.getAttribute('data-group') + '"] .aui-date-picker__time--selected');
                    if (again) kit.focusQuietly(again);
                }, 0, false);
            }

            function chooseTime(button) {
                setTime(Number(button.getAttribute('data-group')) === 1, button.getAttribute('data-unit'), Number(button.getAttribute('data-value')));
            }

            function pickSlot(button) {
                const item = $ctrl.slotItems[Number(button.getAttribute('data-index'))];
                // checked again at the click: the limits may have changed since the list was drawn
                if (!item || item.disabled || !canInput() || !allowed(item.parts, false)) return;
                closeFromInput(true, () => commit(item.parts, 'pick'));
            }

            const MODIFIERS = {Shift: true, Control: true, Alt: true, Meta: true, AltGraph: true, CapsLock: true};

            function onRootKeydown(event) {
                if (kit.isComposing(event) || event.defaultPrevented) return;
                const target = event.target;
                const inBox = target && target.classList && target.classList.contains('aui-date-picker__input');
                if (inBox && !MODIFIERS[event.key]) expandBox(target);
                const inPanel = panelEl && panelEl.contains(target);
                if (event.key === 'Escape') {
                    if (!$ctrl.isOpen && !inBox) return;
                    if ($ctrl.isOpen) {
                        event.preventDefault();
                        if (history.length) {
                            // a range's last pick undone first, one by one
                            settle(false, stepBack);
                            return;
                        }
                        // the draft dropped, the value as it was
                        settle(false, () => {
                            draft = copyValue(value);
                            paintBoxes();
                            closeFromInput(true);
                        });
                        return;
                    }
                    // closed: the box's text back to the value's (a text kept as typed, not a date, too)
                    const index = Number(target.getAttribute('data-box')) || 0;
                    const own = valueTexts()[index];
                    if (inBox && (target.value !== own || $ctrl.boxBad[index])) {
                        event.preventDefault();
                        settle(false, paintBoxes);
                    }
                    return;
                }
                // a field locked while open (disabled, readonly): its panel's keys take nothing
                if (inPanel && !canInput() && event.key !== 'Tab') {
                    event.preventDefault();
                    return;
                }
                if (inPanel && target.classList.contains('aui-date-picker__day')) {
                    settle(false, () => onGridKeydown(event));
                    if (MOVE_KEYS[event.key]) focusActiveNow();
                    return;
                }
                if (inPanel && target.classList.contains('aui-date-picker__unit')) {
                    settle(false, () => onUnitKeydown(event));
                    if (MOVE_KEYS[event.key]) focusActiveNow();
                    return;
                }
                if (inPanel && target.classList.contains('aui-date-picker__time')) {
                    settle(false, () => onColumnKeydown(event, target));
                    return;
                }
                if (inPanel && target.classList.contains('aui-date-picker__cell')) {
                    onCellKeydown(event, target);
                    return;
                }
                if (!inBox) return;
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    if (kit.isRepeat(event) && !$ctrl.isOpen) return;
                    if (!$ctrl.isOpen) openFromInput(true);
                    else settle(false, focusInsideSoon);
                    return;
                }
                if (event.key === 'Enter') {
                    if (kit.isRepeat(event)) return;
                    event.preventDefault();
                    settle(true, () => {
                        const index = Number(target.getAttribute('data-box')) || 0;
                        const typed = target.value !== written[index] || $ctrl.boxBad[index];
                        if (!$ctrl.isOpen || !drafts()) {
                            takeBox(index);
                            if ($ctrl.isOpen && !$ctrl.boxBad[index]) closeFromInput(false);
                            return;
                        }
                        // a whole range typed into one box: taken
                        if (typed && readPair(target.value)) {
                            takeBox(index);
                            closeFromInput(false);
                            return;
                        }
                        // a draft's panel: a typed text is in the draft already (one that is not a value stays invalid)
                        if (typed && readBox(target.value, index === 1) === null) {
                            takeBox(index);
                            return;
                        }
                        if (takeDraft(typed ? 'input' : 'pick', true)) return;
                        const other = index === 1 ? 0 : 1;
                        if ($ctrl.isRange() && !good(rangeOf(draft)[other === 1 ? 'end' : 'start'])) {
                            // a range's one end set: the other box next
                            activeBox = other;
                            timeStep = null;
                            $ctrl.activeEnd = other;
                            focusBox(other);
                            buildTime();
                            refreshRange();
                            return;
                        }
                        if (!draftProblem()) {
                            if (typed) takeBox(index);
                            closeFromInput(false);
                        }
                    });
                }
            }

            // ------------------------------------------------------------------------------------- pointer

            function dayOf(el) {
                const btn = el && el.closest ? el.closest('.aui-date-picker__day') : null;
                if (!btn || btn.classList.contains('aui-date-picker__day--hidden')) return null;
                const key = (btn.getAttribute('data-day') || '').split('-').map(Number);
                return key.length === 3 ? E.make(key[0], key[1], key[2]) : null;
            }

            function unitOf(el) {
                const btn = el && el.closest ? el.closest('.aui-date-picker__unit') : null;
                if (!btn || btn.classList.contains('aui-date-picker__unit--hidden')) return null;
                const y = Number(btn.getAttribute('data-y'));
                const M = Number(btn.getAttribute('data-m'));
                return y && M ? E.make(y, M, 1) : null;
            }

            function onPanelClick(event) {
                // a panel still fading out after its close: nothing (the picker is closed); a field locked while open
                // (disabled, readonly) takes nothing
                if (!$ctrl.isOpen || !canInput()) return;
                const target = event.target;
                const time = target && target.closest ? target.closest('.aui-date-picker__time') : null;
                if (time) {
                    if (time.disabled) return;
                    settle(false, () => ($ctrl.usesSlots() ? pickSlot(time) : chooseTime(time)));
                    return;
                }
                const act = target && target.closest ? target.closest('[data-act]') : null;
                if (act && !act.disabled) {
                    settle(false, () => navigate(act.getAttribute('data-act'), act));
                    return;
                }
                const shortcut = target && target.closest ? target.closest('[data-shortcut]') : null;
                if (shortcut) {
                    settle(false, () => applyShortcut($ctrl.shortcutItems[Number(shortcut.getAttribute('data-shortcut'))]));
                    return;
                }
                const cell = unitOf(target);
                if (cell) {
                    settle(false, () => pickUnit(cell));
                    return;
                }
                const day = dayOf(target);
                if (day) {
                    settle(false, () => pickDay(day));
                }
            }

            /**
             * The pointer over the panel: a range's pick previewed while the pointer is on a day (unit) that can be
             * picked - anything else (the space between the months, the header, the time columns, the footer, a day
             * that cannot be picked) clears it at once; on a day the range's length rules out, the tip says why. Type
             * week: the week under it.
             */
            function onPanelOver(event) {
                if (!$ctrl.isOpen) return;
                if ($ctrl.isWeek()) {
                    const day = dayOf(event.target);
                    const ws = weekStart();
                    if (!day || !pickable(day)) {
                        if (hoverDay) {
                            hoverDay = null;
                            localDigest();
                        }
                        return;
                    }
                    if (hoverDay && sameDay(E.startOf(hoverDay, 'week', ws), E.startOf(day, 'week', ws))) return;
                    hoverDay = day;
                    localDigest();
                    return;
                }
                if (!$ctrl.isRange() || kind() === 'time') return;
                const over = $ctrl.hasUnits() ? unitOf(event.target) : dayOf(event.target);
                const el = over ? event.target.closest('.aui-date-picker__day, .aui-date-picker__unit') : null;
                if (over && pickable(over)) {
                    if (!blockedDay && ($ctrl.hasUnits() ? sameUnit(over, hoverDay) : sameDay(over, hoverDay))) return;
                    setHover(over, el, false);
                    localDigest();
                    return;
                }
                const why = over ? limitText(over) : '';
                if (why) {
                    if (blockedDay && sameDay(over, blockedDay)) return;
                    const place = tipPlace(el);
                    setHover(null, null, false);
                    blockedDay = over;
                    hoverEl = el;
                    tipAt(why, el, place);
                    localDigest();
                    return;
                }
                if (!hoverDay && !blockedDay && !$ctrl.tip) return;
                setHover(null, null, false);
                localDigest();
            }

            function onPanelLeave() {
                if (!(hoverDay || blockedDay || $ctrl.tip) || !($ctrl.isWeek() || $ctrl.isRange())) return;
                if ($ctrl.isRange()) setHover(null, null, false);
                else hoverDay = null;
                localDigest();
            }

            // the keyboard's preview ends when the focus leaves the days (units): to the time columns, OK, a box (after
            // the move: a day re-drawn under the focus hands it on to the next)
            function onPanelFocusOut() {
                if (!hoverByKeys) return;
                setTimeout(() => {
                    if (destroyed || !hoverByKeys || !$ctrl.isOpen) return;
                    const now = document.activeElement;
                    if (now && panelEl && panelEl.contains(now) && now.closest('.aui-date-picker__day, .aui-date-picker__unit')) return;
                    setHover(null, null, false);
                    localDigest();
                }, 0);
            }

            // the panel's own buttons: months and years, the arrows, the views, the ends, Today, Now, OK
            function navigate(act, el) {
                switch (act) {
                    case 'prev-month': setView(E.addMonths(E.make(viewY, viewM, 1), -1).y, E.addMonths(E.make(viewY, viewM, 1), -1).M); break;
                    case 'next-month': setView(E.addMonths(E.make(viewY, viewM, 1), 1).y, E.addMonths(E.make(viewY, viewM, 1), 1).M); break;
                    case 'prev-year': setView(viewY - 1, viewM); break;
                    case 'next-year': setView(viewY + 1, viewM); break;
                    case 'month-view':
                        if ($ctrl.mode === 'day') modeTarget = Number(el.getAttribute('data-cal')) || 0;
                        $ctrl.mode = 'month';
                        break;
                    case 'prev-page': setUnitView(viewY - (kind() === 'year' ? 10 : 1)); break;
                    case 'next-page': setUnitView(viewY + (kind() === 'year' ? 10 : 1)); break;
                    case 'year-view':
                        if ($ctrl.mode === 'day' || $ctrl.mode === 'unit') modeTarget = Number(el.getAttribute('data-cal')) || 0;
                        yearPageStart = Math.floor($ctrl.modeYear() / 10) * 10 - 1;
                        $ctrl.mode = 'year';
                        break;
                    case 'prev-years': yearPageStart -= 10; break;
                    case 'next-years': yearPageStart += 10; break;
                    case 'pick-month': {
                        // chosen with the keyboard: the focus on to the view it opens (its button is gone)
                        if (el === document.activeElement) focusInsideSoon();
                        const cal = $ctrl.calendars[modeTarget] || {y: viewY};
                        const back = E.addMonths(E.make(cal.y, Number(el.getAttribute('data-value')), 1), -modeTarget);
                        $ctrl.mode = 'day';
                        setView(back.y, back.M);
                        break;
                    }
                    case 'pick-year': {
                        if (el === document.activeElement) focusInsideSoon();
                        const y = Number(el.getAttribute('data-value'));
                        if ($ctrl.hasUnits()) {
                            // months, quarters: back to their pages, the year chosen where it was opened
                            $ctrl.mode = 'unit';
                            setUnitView(y - modeTarget);
                            break;
                        }
                        const cal = $ctrl.calendars[modeTarget] || {M: viewM};
                        const back = E.addMonths(E.make(y, cal.M, 1), -modeTarget);
                        $ctrl.mode = 'month';
                        setView(back.y, back.M);
                        break;
                    }
                    case 'today': {
                        const now = today();
                        if (pickable(now)) pickDay(now);
                        break;
                    }
                    case 'end':
                        timeStep = null;
                        $ctrl.activeEnd = Number(el.getAttribute('data-end')) === 1 ? 1 : 0;
                        activeBox = $ctrl.activeEnd;
                        showEnd($ctrl.activeEnd);
                        buildTime();
                        refreshRange();
                        // a focus in a box goes to the chosen end's (typing goes where the underline is)
                        followFocus();
                        break;
                    case 'duration': pickDuration(el.getAttribute('data-spec')); break;
                    case 'now': takeNow(); break;
                    case 'clear': clearValue('clear'); break;
                    case 'ok': confirmDraft(); break;
                    case 'done': closeFromInput(true); break;
                    default: break;
                }
                buildPickerLists();
            }

            // ------------------------------------------------------------------------------------- lifecycle

            $ctrl.$onInit = function () {
                if (!KINDS[$ctrl.type]) {
                    const own = $element[0].tagName === 'AUI-TIME-PICKER' ? 'time' : 'date';
                    if ($ctrl.type) console.warn('aui-date-picker: type "' + $ctrl.type + '" is not supported; "' + own + '" is used');
                    $ctrl.type = own;
                }
                if (kind() === 'time' && $ctrl.valueType && $ctrl.valueType !== 'text') {
                    console.warn('aui-date-picker: a time type keeps its value as text');
                }
                $ctrl.compId = $ctrl.compId || 'aui-date-picker-' + $scope.$id;
                offset = $ctrl.utcOffset ? E.parseOffset($ctrl.utcOffset) : undefined;
                if (offset === null) offset = undefined;
                $ctrl.borderRounded = $attrs.hasOwnProperty('borderRounded') ? !($ctrl.borderRounded === false || $ctrl.borderRounded === 'false') : true;
                const leftNone = $attrs.hasOwnProperty('borderRoundedLeftNone') || $ctrl.borderRoundedLeftNone === true;
                const rightNone = $attrs.hasOwnProperty('borderRoundedRightNone') || $ctrl.borderRoundedRightNone === true;
                $ctrl.borderRadiusStyleVal = kit.borderRadius($ctrl.borderRounded, leftNone, rightNone);
                // the field's left and right corners on their own (as kit.borderRadius gives them): a corner of the
                // field past the panel's edge keeps its radius while the panel is joined to it
                const radius = 'var(--aui-control-radius)';
                $ctrl.cornerStart = !$ctrl.borderRounded || (leftNone && !rightNone) ? '0' : radius;
                $ctrl.cornerEnd = !$ctrl.borderRounded || rightNone ? '0' : radius;
                $ctrl.panelStyle = kit.panelBackgroundStyle($ctrl.dropDownPanelBackgroundOpacity === 'OPAQUE_LIKE' ? 'OPAQUE_LIKE' : 'FULL');
                $ctrl.showLabel = kit.readFlag($attrs, 'showLabel', $ctrl.showLabel, false);
                twoModels = $ctrl.isRange() && !$ctrl.ngModelCtrl && ($attrs.hasOwnProperty('startModel') || $attrs.hasOwnProperty('endModel'));
                $ctrl.twoModels = twoModels;
                if ($ctrl.ngModelCtrl && ($attrs.hasOwnProperty('startModel') || $attrs.hasOwnProperty('endModel'))) {
                    console.warn('aui-date-picker: ng-model and start-model / end-model together: ng-model is used');
                }
                setHints();
                refreshLimits();
                buildWeekdays();
                if ($ctrl.ngModelCtrl) attachModel($ctrl.ngModelCtrl);
                if (twoModels) {
                    $scope.$watchGroup([() => $ctrl.startModel, () => $ctrl.endModel], () => {
                        const list = $ctrl.mirrorValue;
                        const same = Array.isArray(list) && list[0] === $ctrl.startModel && list[1] === $ctrl.endModel;
                        if (!same) pullTwoModels();
                    });
                }
                $scope.$watch(() => $ctrl.api, bindApi);
                // locked while open (ng-disabled, ng-readonly, a disabled fieldset): the panel closes, taking nothing
                $scope.$watch(() => $ctrl.isOpen && !canInput(), locked => {
                    if (!locked) return;
                    closePanel(false);
                    // the boxes showed the draft: the value again
                    paintBoxes();
                });
            };

            /**
             * The hints in the boxes: the page's, else the built-in ones ("" too: server-side templates often write these
             * attributes empty when a field has none); show-placeholder="false" shows none. The boxes keep their names
             * for screen readers either way. Again when the page changes them.
             */
            function setHints() {
                const holders = {time: texts.timePlaceholder, datetime: texts.datetimePlaceholder, month: texts.monthPlaceholder,
                    quarter: texts.quarterPlaceholder, year: texts.yearPlaceholder, week: texts.weekPlaceholder, dates: texts.datesPlaceholder};
                const ends = {date: ['startPlaceholder', 'endPlaceholder'], datetime: ['startTime', 'endTime'], time: ['startTime', 'endTime'],
                    month: ['startMonth', 'endMonth'], quarter: ['startQuarter', 'endQuarter'], year: ['startYear', 'endYear']};
                const endNames = ends[kind()] || ends.date;
                $ctrl.nameText = $ctrl.placeholder || holders[kind()] || texts.placeholder;
                $ctrl.startName = $ctrl.startPlaceholder || texts[endNames[0]];
                $ctrl.endName = $ctrl.endPlaceholder || texts[endNames[1]];
                const hints = kit.readFlag($attrs, 'showPlaceholder', $ctrl.showPlaceholder, true);
                $ctrl.placeholderText = hints ? $ctrl.nameText : '';
                $ctrl.startText = hints ? $ctrl.startName : '';
                $ctrl.endTextHolder = hints ? $ctrl.endName : '';
            }

            $ctrl.$onChanges = function (changes) {
                const has = k => Object.prototype.hasOwnProperty.call(changes, k);
                // before the first link (Angular 1.5.3's change records have no isFirstChange): $onInit sets them all
                if (!triggerEl) return;
                const m = model();
                if (['placeholder', 'startPlaceholder', 'endPlaceholder', 'showPlaceholder'].some(has)) setHints();
                if (has('name')) writeFormValue();
                // another time zone: the page's value read again in it, the boxes and the panel again
                if (has('utcOffset')) {
                    offset = $ctrl.utcOffset ? E.parseOffset($ctrl.utcOffset) : undefined;
                    if (offset === null) offset = undefined;
                    todayDay = null;
                    if (m) {
                        value = viewOf(m.$modelValue);
                        given = value;
                    }
                }
                // a format, a time zone: the boxes in it (getText() already was)
                if (has('format') || has('utcOffset')) {
                    paintBoxes();
                    if ($ctrl.isOpen) paintDraft();
                }
                // the open panel's week start, steps and views
                if ($ctrl.isOpen && (has('weekStart') || has('showWeekNumbers'))) {
                    buildWeekdays();
                    if ($ctrl.hasCalendar()) buildCalendars();
                }
                if ($ctrl.isOpen && (has('hourStep') || has('minuteStep') || has('secondStep') || has('format') || has('utcOffset'))) buildTime();
                const limitKeys = ['min', 'max', 'maxRange', 'minRange', 'rangeCrossesDisabled', 'maxCount', 'utcOffset', 'disabledDate', 'disabledTime'];
                if (limitKeys.some(has)) {
                    refreshLimits();
                    // an open panel's shortcuts and time slots with the new limits (a click took a value now refused)
                    if ($ctrl.isOpen) {
                        refreshShortcuts();
                        if ($ctrl.usesSlots()) buildSlots();
                    }
                }
                // the value checked again
                if (m && (limitKeys.some(has) || has('format'))) m.$validate();
            };

            $ctrl.$postLink = function () {
                holdInvalid($ctrl.ngModelCtrl);
                triggerEl = $element[0].querySelector('.aui-date-picker__trigger');
                panelEl = $element[0].querySelector('.aui-date-picker__panel');
                if (triggerEl && panelEl) {
                    panelCtl = dropdownPanel.create({
                        trigger: triggerEl,
                        panel: panelEl,
                        classes: {
                            open: 'aui-select__panel--open',
                            panelTop: 'aui-date-picker__panel--top',
                            panelBottom: 'aui-date-picker__panel--bottom',
                            triggerTop: 'aui-date-picker__trigger--top',
                            triggerBottom: 'aui-date-picker__trigger--bottom'
                        },
                        strategy: () => ($ctrl.dropDownPositionStrategy === 'absolute' ? 'absolute' : 'fixed'),
                        ownWidth: () => true,
                        // a short window: the panel scrolls (its header and the focused day were off the screen)
                        fitPanel: true,
                        onShown: () => scrollColumnsSoon(),
                        onPlaced: joinCorners,
                        onClosed: onPanelClosed
                    });
                    panelEl.addEventListener('click', onPanelClick);
                    panelEl.addEventListener('mouseover', onPanelOver, {passive: true});
                    panelEl.addEventListener('mouseleave', onPanelLeave, {passive: true});
                    panelEl.addEventListener('focusout', onPanelFocusOut);
                    // a press in the panel keeps the focus where it is (a button takes it only from the keyboard)
                    panelEl.addEventListener('mousedown', event => {
                        if (!(event.target && event.target.closest && event.target.closest('input'))) event.preventDefault();
                    });
                    triggerEl.addEventListener('mousedown', onTriggerPress);
                    triggerEl.addEventListener('pointerdown', onTriggerPointer, {passive: true});
                    // focused after a pick with the pointer, the field looks as it does without focus (no ring, no
                    // caret) until a key is pressed, as the selects; the focus stays in its box for the keyboard
                    stopQuietFocus = kit.quietPointerFocus(triggerEl, 'aui-select__trigger--pointer-focus', true);
                    // the label cut with an ellipsis: its whole text on hover (as the other fields)
                    stopLabelTip = kit.labelTip($element[0]);
                    triggerEl.addEventListener('focusin', onBoxFocus);
                    triggerEl.addEventListener('input', onBoxInput);
                    triggerEl.addEventListener('focusout', onBoxBlur);
                    $element[0].addEventListener('focusout', onFieldLeave);
                    resetForm = (triggerEl.querySelector('input.aui-date-picker__input') || {}).form || null;
                    if (resetForm) resetForm.addEventListener('reset', onFormReset);
                    // a named field: its form value left out of the native form while the field is disabled
                    if (Object.prototype.hasOwnProperty.call($attrs, 'name')) $scope.$watch(() => $ctrl.isDisabled(), writeFormValue);
                    // a box's own native change goes no further: the field tells its change once, on the host (the
                    // page's listener got both, one without detail)
                    triggerEl.addEventListener('change', event => {
                        if (event.target !== triggerEl && event.target.classList && event.target.classList.contains('aui-date-picker__input')) {
                            event.stopPropagation();
                        }
                    });
                    // fitted again when the focus comes or goes (after the quiet focus is set) and when the size changes
                    triggerEl.addEventListener('focusin', refitSoon);
                    triggerEl.addEventListener('focusout', refitSoon);
                    const area = triggerEl.querySelector('.aui-date-picker__boxes');
                    if (typeof window.ResizeObserver === 'function' && area) {
                        const watch = new window.ResizeObserver(refitSoon);
                        watch.observe(area);
                        stopFit = () => watch.disconnect();
                    } else {
                        window.addEventListener('resize', refitSoon);
                        stopFit = () => window.removeEventListener('resize', refitSoon);
                    }
                    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { widthCache.clear(); refitSoon(); });
                }
                $element[0].addEventListener('keydown', onRootKeydown);
                dismiss = kit.createDismiss({
                    root: $element[0],
                    isOpen: () => $ctrl.isOpen && !destroyed,
                    close: () => settle(false, closeKeeping)
                });
                stopFocusLeave = kit.onFocusLeave($element[0], (next) => {
                    if (destroyed) return;
                    if (next && $ctrl.isOpen) {
                        settle(false, closeKeeping);
                    } else if (model() && !model().$touched) {
                        settle(false, markTouched);
                        pageDigest.owe(true);
                    }
                });
                paintBoxes();
            };

            /**
             * The panel is joined to the field, as the selects' (no gap; the side where they meet square, the panel's
             * shadow away from the field). It has its own width, so only the corners where the two meet are square: a
             * corner of either past the other's edge stays round (a range's months wider than the field, one month
             * narrower). Measured after each placement (the panel may be shifted into the screen).
             */
            function joinCorners() {
                if (!panelEl || !triggerEl) return;
                const p = panelEl.getBoundingClientRect();
                const t = triggerEl.getBoundingClientRect();
                const set = (el, name, on) => {
                    if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
                };
                set(panelEl, 'aui-date-picker__panel--wide-start', p.left < t.left - 1);
                set(panelEl, 'aui-date-picker__panel--wide-end', p.right > t.right + 1);
                set(triggerEl, 'aui-date-picker__trigger--wide-start', t.left < p.left - 1);
                set(triggerEl, 'aui-date-picker__trigger--wide-end', t.right > p.right + 1);
                if ($ctrl.isOpen && $ctrl.isRange()) placeBar(false, barEnd());
            }

            // a press by touch (or a pen): the panel opens without the on-screen keyboard over it (inputmode none while
            // it is open); a tap in a box of the open panel brings the keyboard back for typing
            function onTriggerPointer(event) {
                if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
                if (event.target.closest && event.target.closest('.aui-control-clear')) return;
                const box = event.target.closest ? event.target.closest('input.aui-date-picker__input') : null;
                if (!$ctrl.isOpen) keyboardAway(true);
                else if (box) keyboardAway(false);
            }

            function keyboardAway(away) {
                const boxes = boxEls();
                for (let i = 0; i < boxes.length; i += 1) {
                    if (away) boxes[i].setAttribute('inputmode', 'none');
                    else if (boxes[i].hasAttribute('inputmode')) boxes[i].removeAttribute('inputmode');
                }
            }

            function onTriggerPress(event) {
                if (event.button !== 0 || !canInput()) return;
                const target = event.target;
                if (target.closest && target.closest('.aui-control-clear')) return;
                const box = target.closest ? target.closest('input.aui-date-picker__input') : null;
                if (!box) {
                    // a press beside the boxes: the nearest box takes the focus
                    event.preventDefault();
                    const rect = triggerEl.getBoundingClientRect();
                    const index = $ctrl.isRange() && event.clientX > rect.left + rect.width / 2 ? 1 : 0;
                    activeBox = index;
                    focusBox(index);
                } else {
                    activeBox = Number(box.getAttribute('data-box')) || 0;
                }
                if (!$ctrl.isOpen) {
                    openFromInput(false);
                } else if ($ctrl.isRange() && $ctrl.activeEnd !== activeBox) {
                    // the other box of an open range: its end set next
                    settle(false, () => {
                        timeStep = null;
                        $ctrl.activeEnd = activeBox;
                        showEnd(activeBox);
                        buildTime();
                        refreshRange();
                    });
                }
            }

            function onBoxFocus(event) {
                const box = event.target;
                if (!box.classList || !box.classList.contains('aui-date-picker__input')) return;
                activeBox = Number(box.getAttribute('data-box')) || 0;
                // Tab between the boxes of an open range: the underline follows
                if ($ctrl.isOpen && $ctrl.isRange() && $ctrl.activeEnd !== activeBox) {
                    settle(false, () => {
                        timeStep = null;
                        $ctrl.activeEnd = activeBox;
                        showEnd(activeBox);
                        buildTime();
                        refreshRange();
                    });
                }
            }

            /** Typing: a whole value typed moves the panel to it (the value changes on Enter or leaving the box). */
            function onBoxInput(event) {
                const box = event.target;
                if (!box.classList || !box.classList.contains('aui-date-picker__input') || event.isComposing) return;
                const index = Number(box.getAttribute('data-box')) || 0;
                if ($ctrl.isOpen && $ctrl.isRange()) placeBar(false, barEnd());
                const pair = $ctrl.isOpen ? readPair(box.value) : null;
                if (pair) {
                    // a whole range typed or pasted: both ends in the draft
                    draft = pair;
                    activeDay = E.startOf(unitStart(pair.start), 'day');
                    showValueOf(pair.start);
                    buildTime();
                    refreshRange();
                    localDigest();
                    return;
                }
                const read = readBox(box.value, index === 1);
                if (read === null || !$ctrl.isOpen) return;
                // the panel follows a whole value typed (dates: the last one)
                const shown = $ctrl.isDates() ? (read ? read[read.length - 1] : null) : read;
                if (shown && ($ctrl.hasCalendar() || $ctrl.hasUnits())) {
                    activeDay = E.startOf(unitStart(shown), 'day');
                    showValueOf(shown);
                }
                if (drafts()) {
                    // a draft follows the text (an emptied box empties its end)
                    const next = read || null;
                    if ($ctrl.isRange()) $ctrl.activeEnd = index;
                    timeStep = null;
                    const r = rangeOf(draft);
                    draft = $ctrl.isRange() ? {start: index === 0 ? next : r.start, end: index === 1 ? next : r.end} : next;
                    if ($ctrl.isRange() && !draft.start && !draft.end) draft = null;
                    buildTime();
                    refreshRange();
                } else if (!read) {
                    return;
                }
                localDigest();
            }

            /*
             * The form's native reset (a reset button, form.reset()) empties the boxes behind Angular's back: the model
             * keeps its value (the model is the truth). The boxes show it again once the reset is done - also when the
             * field is left before that (the empty box was taken as a text typed, and cleared the value).
             */
            let resetForm = null;
            let resetPending = false;

            function onFormReset() {
                resetPending = true;
                setTimeout(afterReset, 0);
            }

            function afterReset() {
                if (!resetPending || destroyed) return;
                resetPending = false;
                paintBoxes();
            }

            function onBoxBlur(event) {
                afterReset();
                const box = event.target;
                if (!box.classList || !box.classList.contains('aui-date-picker__input')) return;
                const index = Number(box.getAttribute('data-box')) || 0;
                if (box.value === written[index] && !$ctrl.boxBad[index]) return;
                // a draft's panel open: a text that is a value is in the draft already (taken with it)
                if ($ctrl.isOpen && drafts() && (readBox(box.value, index === 1) !== null || readPair(box.value))) return;
                // the other box of a range takes the focus: the text is taken without closing
                settle(true, () => takeBox(index));
            }

            /** The field left (not for its other box or its panel): a value waiting for the blur (ng-model-options
             * updateOn: 'blur') is committed, as Angular's own inputs do - after the box's text was taken. */
            function onFieldLeave(event) {
                const next = event.relatedTarget;
                if (next && ($element[0].contains(next) || (panelEl && panelEl.contains(next)))) return;
                const m = model();
                if (m && kit.commitPending(m)) settle(true, () => kit.commitOnLeave(m));
            }

            $ctrl.clearClick = function ($event) {
                if ($event) {
                    $event.preventDefault();
                    $event.stopPropagation();
                }
                if (!canInput()) return;
                clearValue('clear');
                focusBox(0);
            };

            $ctrl.onClearKeydown = function ($event) {
                if ($event.key === 'Enter' || $event.key === ' ') {
                    if (kit.isRepeat($event)) return;
                    $ctrl.clearClick($event);
                }
            };

            // the footer's Clear: something to clear - the value, or the picks made in the panel
            $ctrl.canClear = () => $ctrl.hasValue() || ($ctrl.isRange() ? !!(rangeOf(draft).start || rangeOf(draft).end) : !!draft);

            $ctrl.hasValue = function () {
                if ($ctrl.isRange()) {
                    const r = rangeParts();
                    return !!(r.start || r.end);
                }
                return !!value;
            };

            $ctrl.focusFromLabel = () => focusBox(0);

            // the methods put on the page's api object, to take them off again (a page that replaces its api object, or
            // keeps it after the field is gone: the old object still drove the field, and kept it alive)
            let installedApi = null;

            function unbindApi() {
                if (!installedApi) return;
                const target = installedApi.target;
                Object.keys(installedApi.methods).forEach(name => {
                    if (target[name] === installedApi.methods[name]) delete target[name];
                });
                installedApi = null;
            }

            function bindApi(target) {
                unbindApi();
                if (!target || typeof target !== 'object') return;
                const before = Object.assign({}, target);
                installApi(target);
                const methods = {};
                Object.keys(target).forEach(name => {
                    if (typeof target[name] === 'function' && target[name] !== before[name]) methods[name] = target[name];
                });
                installedApi = {target: target, methods: methods};
            }

            function installApi(target) {
                target.open = () => openFromInput(false);
                target.close = () => settle(false, () => closeFromInput(false));
                target.focus = () => focusBox(0);
                target.clear = () => settle(true, () => commit(null, 'api'));
                target.setValue = (v) => settle(true, () => commit(viewOf(v), 'api'));
                target.getValue = () => (model() ? model().$modelValue : modelOf(value));
                target.getText = () => ($ctrl.isDates() ? datesOf(value).map(text)
                    : ($ctrl.isRange() ? [text(rangeParts().start), text(rangeParts().end)] : text(value)));
                target.getTimestamp = () => ($ctrl.isDates() ? (datesOf(value).length ? stamp(datesOf(value)[0]) : null)
                    : ($ctrl.isRange() ? stamp(rangeParts().start) : stamp(value)));
                target.getRange = () => {
                    // a month, quarter, year or week: its own first and last moment
                    if (unit() && !$ctrl.isRange()) {
                        const v = good(value) ? value : null;
                        return {start: v ? E.format(unitStart(v), 'YYYY-MM-DD HH:mm:ss') : null, end: v ? E.format(unitEnd(v), 'YYYY-MM-DD HH:mm:ss') : null,
                            timestamps: v ? [stamp(unitStart(v)), stamp(unitEnd(v))] : [null, null]};
                    }
                    const r = rangeParts();
                    const one = p => (good(p) ? writeValue(p) : emptyOne());
                    return {start: one(r.start), end: one(r.end), timestamps: [stamp(r.start), stamp(r.end)]};
                };
            }

            $ctrl.$onDestroy = function () {
                destroyed = true;
                unbindApi();
                pageAsk.cancel();
                pageDigest.forget();
                keepBody(false);
                if (dismiss) dismiss.stop();
                if (stopFocusLeave) stopFocusLeave();
                if (stopQuietFocus) stopQuietFocus();
                if (stopLabelTip) stopLabelTip();
                window.removeEventListener('resize', onWindowResize);
                if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
                if (stopFit) stopFit();
                if (fitFrame !== null) clearTimeout(fitFrame);
                if (resetForm) resetForm.removeEventListener('reset', onFormReset);
                resetForm = null;
                if (panelCtl) panelCtl.destroy();
                $element[0].removeEventListener('keydown', onRootKeydown);
            };
        }],
        template: `
                    <div class="aui-select aui-date-picker"
                         ng-class="{
                             'aui-select--open': $ctrl.isOpen,
                             'aui-select--disabled': $ctrl.isDisabled(),
                             'aui-select--readonly': $ctrl.isReadonly(),
                             'aui-select--small': $ctrl.field.size() === 'small',
                             'aui-select--large': $ctrl.field.size() === 'large',
                             'aui-select--label-top': $ctrl.field.isLabelTop(),
                             'aui-date-picker--range': $ctrl.isRange(),
                             'aui-date-picker--editing': $ctrl.isOpen && $ctrl.isRange(),
                             'aui-date-picker--time': !$ctrl.hasCalendar()
                         }"
                         style="--aui-select-border-radius: {{$ctrl.borderRadiusStyleVal}}; --aui-date-picker-corner-start: {{$ctrl.cornerStart}}; --aui-date-picker-corner-end: {{$ctrl.cornerEnd}};">
                        <!-- start-model / end-model: the field's own ngModel for the page's form (a plain element: an input's
                             text type would turn the pair into a string) -->
                        <span class="aui-date-picker__mirror" aria-hidden="true"
                              aui-if="$ctrl.twoModels" name="{{ $ctrl.name }}" ng-model="$ctrl.mirrorValue"
                              ng-required="$ctrl.isRequired()" aui-date-picker-mirror></span>
                        <div class="aui-field-label"
                             aui-if="$ctrl.showLabel && $ctrl.labelText && $ctrl.field.isLabelTop()"
                             ng-click="$ctrl.focusFromLabel()">{{$ctrl.labelText}}</div>
                        <div class="aui-select__trigger aui-date-picker__trigger"
                             id="{{$ctrl.compId}}"
                             role="group"
                             aria-label="{{ $ctrl.labelText || $ctrl.nameText }}"
                             ng-class="{'aui-select__trigger--required': $ctrl.isRequired(),
                                        'aui-select__trigger--clearable': $ctrl.isClearable() && $ctrl.hasValue() && !$ctrl.isDisabled() && !$ctrl.isReadonly(),
                                        'aui-select__trigger--invalid': $ctrl.showInvalid()}">
                            <div class="aui-control-label"
                                 aui-if="$ctrl.showLabel && $ctrl.labelText && !$ctrl.field.isLabelTop()">{{$ctrl.labelText}}</div>
                            <div class="aui-select__selected-display aui-date-picker__boxes">
                                <input type="text" class="aui-date-picker__input" data-box="0"
                                       ng-class="{'aui-date-picker__input--bad': $ctrl.boxBad[0]}"
                                       role="combobox" aria-haspopup="dialog" aria-autocomplete="none"
                                       aria-expanded="{{ $ctrl.isOpen }}" aria-controls="{{ $ctrl.compId }}-panel"
                                       aria-label="{{ $ctrl.isRange() ? $ctrl.startName : ($ctrl.labelText || $ctrl.nameText) }}"
                                       aria-required="{{ $ctrl.isRequired() }}" aria-invalid="{{ $ctrl.showInvalid() }}"
                                       ng-required="$ctrl.isRequired()"
                                       ng-attr-aria-describedby="{{ $ctrl.field.messageId() }}"
                                       ng-attr-placeholder="{{ $ctrl.isRange() ? $ctrl.startText : $ctrl.placeholderText }}"
                                       ng-disabled="$ctrl.isDisabled()" ng-readonly="$ctrl.isReadonly()"
                                       autocomplete="off" spellcheck="false">
                                <span class="aui-date-picker__to" role="img" aria-label="{{ $ctrl.texts.rangeTo }}"></span>
                                <input type="text" class="aui-date-picker__input aui-date-picker__input--end" data-box="1"
                                       ng-class="{'aui-date-picker__input--bad': $ctrl.boxBad[1]}"
                                       role="combobox" aria-haspopup="dialog" aria-autocomplete="none"
                                       aria-expanded="{{ $ctrl.isOpen }}" aria-controls="{{ $ctrl.compId }}-panel"
                                       aria-label="{{ $ctrl.endName }}"
                                       aria-required="{{ $ctrl.isRange() && $ctrl.isRequired() }}"
                                       aria-invalid="{{ $ctrl.showInvalid() }}"
                                       ng-attr-aria-describedby="{{ $ctrl.isRange() ? $ctrl.field.messageId() : undefined }}"
                                       ng-required="$ctrl.isRange() && $ctrl.isRequired()"
                                       ng-attr-placeholder="{{ $ctrl.endTextHolder }}"
                                       ng-disabled="!$ctrl.isRange() || $ctrl.isDisabled()" ng-readonly="$ctrl.isReadonly()"
                                       autocomplete="off" spellcheck="false">
                                <!-- a range being set: the underline under the text of the end the next pick sets (in
                                     the boxes' area, which clips it: never outside the field) -->
                                <span class="aui-date-picker__bar" aria-hidden="true" aui-if="$ctrl.isRange()"></span>
                            </div>
                            <span class="aui-control-clear"
                                  aui-if="$ctrl.isClearable()"
                                  ng-class="{'aui-control-clear--hidden': !$ctrl.hasValue() || $ctrl.isDisabled() || $ctrl.isReadonly()}"
                                  ng-click="$ctrl.clearClick($event)"
                                  ng-mousedown="$event.preventDefault()"
                                  ng-keydown="$ctrl.onClearKeydown($event)"
                                  tabindex="{{ (!$ctrl.hasValue() || $ctrl.isDisabled() || $ctrl.isReadonly()) ? -1 : 0 }}"
                                  role="button"
                                  aria-label="{{ $ctrl.texts.clear }}"
                                  title="{{ $ctrl.texts.clear }}">
                                <svg class="aui-control-clear-svg" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle class="aui-control-clear-bg" cx="10" cy="10" r="10"/>
                                    <path class="aui-control-clear-cross" d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke-linecap="round"/>
                                </svg>
                            </span>
                            <i class="aui-select__chevron aui-date-picker__icon" aria-hidden="true"></i>
                        </div>

                        <div class="aui-select__panel aui-date-picker__panel"
                             ng-class="{'aui-date-picker__panel--two': $ctrl.panelReady && ($ctrl.calendarCount() === 2 || $ctrl.unitCount() === 2),
                                        'aui-date-picker__panel--week': $ctrl.isWeek(),
                                        'aui-date-picker__panel--weeks': $ctrl.panelReady && $ctrl.weekNumbers()}"
                             id="{{ $ctrl.compId }}-panel"
                             role="dialog"
                             aria-label="{{ $ctrl.hasClock() && !$ctrl.hasCalendar() ? $ctrl.texts.dialogTime : $ctrl.texts.dialog }}"
                             ng-style="$ctrl.panelStyle">
                        </div>

                        <div class="aui-field-message"
                             aui-if="$ctrl.field.hasMessageLine()"
                             id="{{ $ctrl.field.messageId() }}"
                             aria-live="polite"
                             ng-class="{'aui-field-message--error': $ctrl.field.messageIsError()}"><span aui-if="!$ctrl.field.messageIsError()">{{ $ctrl.field.messageText() }}</span><span aui-if="$ctrl.field.messageIsError()" class="aui-field-message__error">{{ $ctrl.field.messageText() }}</span></div>
                    </div>`
        };
        // aui-time-picker: the same field, its type time unless given
        angular.module('aui').component('auiTimePicker', definition);
        return definition;
    }()))

    /** aui-date-picker's inner ngModel for start-model / end-model: handed to the picker, which keeps it as its own. */
    .directive('auiDatePickerMirror', [function () {
        return {
            restrict: 'A',
            require: ['ngModel', '?^^auiDatePicker', '?^^auiTimePicker'],
            link: function (scope, element, attrs, ctrls) {
                (ctrls[1] || ctrls[2]).attachMirror(ctrls[0]);
            }
        };
    }]);
