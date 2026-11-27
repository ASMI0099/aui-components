/**
 * auiTexts: every word the components show, in one table that a page can change or translate.
 */
angular.module('aui')
    /**
     * auiTexts: the words the aui-* fields and dialogs show, in one table - English, changed once for the page in a
     * config block of its module: single texts (set), or a language the page defines and then uses:
     *
     *     angular.module('app', ['aui']).config(['auiTextsProvider', function (texts) {
     *         texts.define('custom', {list: {placeholder: 'Choose...'}, modal: {ok: 'Done'}});
     *         texts.use('custom');
     *         texts.set({list: {empty: 'Nothing found'}});
     *     }]);
     *
     * A text a language leaves out stays English; an unknown key, or a value not of the text's kind, is ignored. The
     * texts are shown as text, never as HTML. Groups: list (aui-select, aui-tree-select), input (aui-input), modal
     * (aui-modal, AuiModal, AuiMessageBox, AuiMessage; aui-popover's Cancel and Confirm), icons (the names of the
     * icons, which name an icon shown alone), field (the message line under a field: {length}, {min}, {max},
     * {precision} are the field's limits), date (aui-date-picker: weekdays begin with Sunday, months with January;
     * header is the day view's title, {month} (monthsLong) and {year}).
     */
    .provider('auiTexts', function () {
        const texts = {
            list: {
                placeholder: 'Select an option',
                search: 'Search...',
                searchLabel: 'Search options',
                clearAll: 'Clear all',
                selectAll: 'Select all',
                clearSelection: 'Clear selection',
                remove: 'Remove {label}',
                loading: 'Loading',
                loadingList: 'Loading...',
                searching: 'Searching...',
                loadingMore: 'Loading more...',
                moreFailed: 'Couldn\'t load more.',
                retry: 'Retry',
                failed: 'Failed to load.',
                timeout: 'The server did not answer.',
                minLength: 'Type at least {n} characters to search',
                empty: 'No results found',
                // the tooltip of the "+N" tag: the first hidden labels ({list}), then how many more ({n})
                moreTags: '{list}, … +{n} more',
                // aui-tree-select
                options: 'Options',
                retryNode: 'Failed to load. Click to retry',
                loadMore: 'Load more',
                loadMoreLeft: 'Load more ({n} left)',
                moreFailedRetry: 'Couldn\'t load more. Retry',
                searchFailed: 'Search failed.',
                showing: 'Showing {shown} of {total} matches. Type more to narrow the search.'
            },
            input: {
                clear: 'Clear',
                clearLabel: 'Clear input',
                showPassword: 'Show password'
            },
            modal: {
                close: 'Close',
                closeDialog: 'Close dialog',
                confirm: 'Confirm',
                ok: 'OK',
                cancel: 'Cancel',
                dialog: 'Dialog',
                contentFailed: 'The content could not be loaded',
                // AuiMessageBox: the title of each type when none is given
                titles: {success: 'Success', info: 'Notice', warning: 'Warning', error: 'Error', question: 'Confirm'}
            },
            // the names of the icons (auiIcons): an icon alone (aui-popover's trigger, aui-button) is named by them
            icons: {edit: 'Edit', pencil: 'Edit', 'square-pen': 'Edit', delete: 'Delete', copy: 'Copy', check: 'Done',
                close: 'Close', 'circle-check': 'Done', 'circle-close': 'Failed', info: 'Information', help: 'Help',
                more: 'More actions', filter: 'Filter', settings: 'Settings',
                add: 'Add', search: 'Search', refresh: 'Refresh', download: 'Download', upload: 'Upload', expand: 'Expand',
                collapse: 'Collapse'},
            // aui-button: what copy-text says for a moment after a click (shown, and announced to screen readers)
            button: {copied: 'Copied', copyFailed: 'Copy failed'},
            // aui-pagination: {total}, {size}, {page}, {pages}, {count}, {from}, {to} are filled in; range: total-text
            // "range"; pageOf: told to screen readers after a change; thousands: the separator of item counts ("60,000";
            // empty: none)
            pagination: {
                nav: 'Pagination',
                total: 'Total {total}',
                range: '{from}–{to} of {total}',
                pageOf: 'Page {page} of {pages}',
                thousands: ',',
                perPage: '{size} / page',
                perPageLabel: 'Items per page',
                goTo: 'Go to',
                goToLabel: 'Go to page',
                page: 'Page {page}',
                previous: 'Previous page',
                next: 'Next page',
                previousMore: 'Previous {count} pages',
                nextMore: 'Next {count} pages',
                simple: '{page} / {pages}',
                loading: 'Loading'
            },
            field: {
                required: 'This field is required',
                maxlength: 'At most {length} characters',
                minlength: 'At least {length} characters',
                pattern: 'The format is not valid',
                min: 'At least {min}',
                max: 'At most {max}',
                precision: 'At most {precision} decimals',
                integer: 'Whole numbers only',
                // aui-checkbox-group: how many options (min, max)
                minItems: 'Select at least {min}',
                maxItems: 'Select at most {max}',
                number: 'Enter a number',
                email: 'Enter a valid e-mail address',
                url: 'Enter a valid web address',
                invalid: 'The value is not valid',
                date: 'Enter a valid date',
                disabledDate: 'This date cannot be picked',
                disabledTime: 'This time cannot be set',
                rangeIncomplete: 'Enter both ends',
                rangeOrder: 'The start is after the end',
                rangeMax: 'The range is too long',
                rangeMin: 'The range is too short',
                rangeCrossesDisabled: 'The range includes a day that cannot be picked',
                maxCount: 'Too many dates are checked'
            },
            date: {
                weekdays: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
                weekdaysLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
                    'November', 'December'],
                header: '{month} {year}',
                placeholder: 'Select a date',
                startPlaceholder: 'Start date',
                endPlaceholder: 'End date',
                dialog: 'Choose a date',
                today: 'Today',
                clear: 'Clear',
                rangeTo: 'to',
                prevYear: 'Previous year',
                nextYear: 'Next year',
                prevMonth: 'Previous month',
                nextMonth: 'Next month',
                prevYears: 'Previous years',
                nextYears: 'Next years',
                chooseMonth: 'Choose a month',
                chooseYear: 'Choose a year',
                shortcutOutside: 'Outside the allowed dates',
                datetimePlaceholder: 'Select date and time',
                timePlaceholder: 'Select a time',
                dialogTime: 'Choose a time',
                startTime: 'Start time',
                endTime: 'End time',
                start: 'Start',
                end: 'End',
                notSet: 'Not set',
                now: 'Now',
                ok: 'OK',
                hours: 'Hours',
                minutes: 'Minutes',
                seconds: 'Seconds',
                // also what a 12-hour value's text shows and what typing reads (besides AM / PM)
                am: 'AM',
                pm: 'PM',
                endBeforeStart: 'The end is before the start',
                outsideLimits: 'Outside the allowed times',
                rangeTooLong: 'The range is too long',
                rangeTooShort: 'The range is too short',
                crossesDisabled: 'The range includes a day that cannot be picked',
                monthPlaceholder: 'Select a month',
                quarterPlaceholder: 'Select a quarter',
                yearPlaceholder: 'Select a year',
                weekPlaceholder: 'Select a week',
                datesPlaceholder: 'Select dates',
                startMonth: 'Start month',
                endMonth: 'End month',
                startQuarter: 'Start quarter',
                endQuarter: 'End quarter',
                startYear: 'Start year',
                endYear: 'End year',
                quarter: 'Q{q}',
                weekShort: 'Wk',
                weekNumber: 'Week',
                selectedCount: '{count} selected',
                // a range being set: what to choose next ({unit}: one of unitNames), and its length
                chooseStart: 'Choose the start {unit}',
                chooseEnd: 'Choose the end {unit}',
                newStart: 'New start',
                // the tip when the pick under the pointer sets a range's start, the end kept ({length}: as the tip's length)
                startAt: 'Start · {length}',
                // a date-time range: one end's day picked, its time next (the start's, or the end's set first)
                setStartTime: 'Set the start time, or choose the end {unit}',
                setEndTime: 'Set the end time, or choose the start {unit}',
                // the button on to the other end (Next)
                toEnd: 'Next: End time',
                toStart: 'Next: Start time',
                // the tip on a day a range's length rules out ({length}: as the duration chips, "14 days")
                atMost: 'At most {length}',
                atLeast: 'At least {length}',
                unitNames: {date: 'date', datetime: 'date', time: 'time', month: 'month', quarter: 'quarter', year: 'year'},
                length: {
                    day: '{n} day', days: '{n} days', week: '{n} week', weeks: '{n} weeks', month: '{n} month', months: '{n} months',
                    quarter: '{n} quarter', quarters: '{n} quarters', year: '{n} year', years: '{n} years',
                    hours: '{n} h', minutes: '{n} min', seconds: '{n} s'
                },
                shortcuts: {
                    today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow', weekAgo: 'A week ago',
                    startOfMonth: 'Start of month', endOfMonth: 'End of month',
                    last7Days: 'Last 7 days', last30Days: 'Last 30 days', thisWeek: 'This week', lastWeek: 'Last week',
                    thisMonth: 'This month', lastMonth: 'Last month', thisQuarter: 'This quarter', thisYear: 'This year',
                    next7Days: 'Next 7 days', next30Days: 'Next 30 days', next3Months: 'Next 3 months', next6Months: 'Next 6 months',
                    untilEndOfMonth: 'Until end of month',
                    now: 'Now', last24Hours: 'Last 24 hours', next24Hours: 'Next 24 hours',
                    nextWeek: 'Next week', nextMonth: 'Next month', lastQuarter: 'Last quarter', lastYear: 'Last year',
                    nextYear: 'Next year', last3Months: 'Last 3 months', last6Months: 'Last 6 months', last12Months: 'Last 12 months',
                    yearToDate: 'Year to date', last4Quarters: 'Last 4 quarters', last5Years: 'Last 5 years', last10Years: 'Last 10 years'
                }
            }
        };
        // the languages a page defines (define): the texts that differ from English
        const languages = {};

        // a patch merged into the table: only the texts it has, each as its kind (a text, a list as long, a group)
        function merge(into, patch) {
            Object.keys(patch || {}).forEach(function (key) {
                const now = into[key];
                const next = patch[key];
                if (typeof now === 'string') {
                    if (typeof next === 'string') into[key] = next;
                } else if (Array.isArray(now)) {
                    if (Array.isArray(next) && next.length === now.length && next.every(t => typeof t === 'string')) into[key] = next.slice();
                } else if (now && next && typeof next === 'object') {
                    merge(now, next);
                }
            });
        }

        // a language under a name of the page's choice: the texts that differ from English (a patch, as for set)
        this.define = function (language, patch) {
            if (typeof language === 'string' && patch && typeof patch === 'object') languages[language] = patch;
            return this;
        };
        // the language defined under that name, merged into the table (an unknown name changes nothing)
        this.use = function (language) {
            if (Object.prototype.hasOwnProperty.call(languages, language)) merge(texts, languages[language]);
            return this;
        };
        this.set = function (patch) {
            merge(texts, patch);
            return this;
        };
        this.$get = function () {
            return texts;
        };
    });
