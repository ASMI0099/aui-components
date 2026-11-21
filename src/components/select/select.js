/**
 * aui-select: one or several values from a list, static or from a server.
 */
angular.module('aui')
    .component("auiSelect", {
        require: {
            ngModelCtrl: '^ngModel'
        },
        bindings: {
            options: '<?',              // Array of options
            selectedItems: '=?',    // Array of selected data items
            multipleFlag: '<?multiple', // Enable multiple selection (read as $ctrl.multiple, see "The on/off options")
            maxTagCount: '<?',          // Multiple mode: show at most this many tags, then one "+N" tag
            name: '@?',
            labelText: '@?',
            compId: '@?',
            placeholder: '@?',          // Placeholder text
            disabledFlag: '<?disabled', // Disable component (read as $ctrl.disabled)
            readonly: '<?',             // The value shows, the field takes the focus, nothing opens or changes
            required: '<?ngRequired',
            disabledValues: '<?',             // Disable option value (Array)
            disabledField: '@?',       // Field that marks an option as not pickable (e.g. 'disabled'); unset: none
            loadingFlag: '<?loading',   // Show loading state (read as $ctrl.loading)
            searchable: '<?',          // Enable search (default: true if >5 options)
            clearableFlag: '<?clearable',
            showLabelFlag: '<?showLabel',
            autoSelectOnSingleRequiredFlag: '<?autoSelectOnSingleRequired',
            borderRounded: '<?',
            borderRoundedLeftNone: '<?',
            borderRoundedRightNone: '<?',
            labelField: '@?',          // Field to use for display (default: 'label')
            valueField: '@?',          // Field to use for value (default: 'id')
            dropDownPositionStrategy: '@?',
            dropDownPanelBackgroundOpacity: '@?', // OPAQUE_LIKE , FULL
            searchPlaceholder: '@?',   // Search box placeholder (default 'Search...')
            emptyText: '@?',           // Text when no option matches (default 'No results found')
            panelMinWidth: '@?',       // Minimum dropdown width in px (default: the trigger width)
            selectedLabels: '<?',      // {value: label} for selected values whose option is not loaded (yet)
            // Options from the server (auiRemoteData). Without page-size everything is loaded at once and searched
            // here; with page-size the list loads page by page and the search goes to the server.
            loadOptions: '&?',         // load-options="fn($request)" -> array or {items}, or a promise of one
            loadParams: '<?',          // What the options depend on, e.g. {storeId: vm.form.storeId}; compared by value
            loadEnabled: '<?',         // false: nothing is loaded yet (e.g. no store chosen yet)
            loadDisabledText: '@?',    // Shown in the panel instead of the list while load-enabled is false
            pageSize: '@?',            // Items per page; turns on paged loading and server search
            searchDelay: '@?',         // Server search: ms after the last keystroke (default 300)
            searchMinLength: '@?',     // Server search: characters needed before a request (default 0)
            cacheTtl: '@?',            // ms a loaded list is reused on reopen before a background refresh (default 60000)
            loadTimeout: '@?',         // ms before a request counts as failed (default: no timeout)
            preload: '<?',             // Load as soon as loading is enabled instead of on the first open
            valueOptions: '<?',        // Options the page already has for the current value(s), e.g. from the record
            lookupEnabled: '<?',       // Look up selected values that are not loaded (through load-options by default)
            lookupOptions: '&?',       // lookup-options="fn($request)": a dedicated lookup ($request.values)
            lookupGroup: '@?',         // Components with the same group send their lookups as one request
            resetOnParams: '@?',       // 'clear': clear the value when load-params change while the value stays
            api: '<?',                 // Object that receives methods: open, close, toggle, focus, reload, clear
            onChange: '&?',            // a function reference, on-change="fn" (called with one object: selectedValues,
                                       // value, oldValue, option, triggerSource, byUser), or a call:
                                       // on-change="fn($value, $oldValue, $items, $option, $triggerSource, $byUser)"
            onOpen: '&?',              // Open callback
            onClose: '&?',             // Close callback
            hintText: '@?',            // the message line under the field: a hint (see auiFieldExtras)
            errorText: '@?',           // the message line: one text for any failed check, while the field shows invalid
            errorMessages: '<?',       // the message line: a text per check, {required: '...'}
            showErrors: '<?',          // the message line with the shared texts (auiFieldMessages); off by default
            size: '@?',                // "small" (28px) or "large" (40px); unset: 34px
            labelPosition: '@?'        // "top": the label above the box, instead of in it
        },
        controller: ['$scope', '$element', '$timeout', '$attrs', '$parse', 'auiControlKit', 'auiDropdownPanel', 'auiRemoteData', 'auiFieldExtras', 'auiTexts',
            function ($scope, $element, $timeout, $attrs, $parse, kit, dropdownPanel, remote, fieldExtras, texts) {
            const $ctrl = this;
            $ctrl.t = texts.list;

            // The on/off options, read as the other fields read theirs (kit.readFlag) each time they are used: a bare
            // attribute or one written the HTML way (disabled="disabled") is on, an expression follows its value, and
            // ng-disabled (no disabled binding of its own) is the element's flag Angular sets. Their bindings are kept
            // as <name>Flag: Angular writes a binding's own value there on every change.
            ['multiple', 'disabled', 'loading', 'clearable', 'showLabel', 'autoSelectOnSingleRequired'].forEach((name) => {
                Object.defineProperty($ctrl, name, {
                    configurable: true,
                    enumerable: true,
                    get: () => kit.readFlag($attrs, name, $ctrl[name + 'Flag'], false)
                });
            });

            /** Red as the tree and aui-input are: the value is invalid and the field has been touched (left once). */
            $ctrl.showInvalid = function () {
                return !!($ctrl.ngModelCtrl && $ctrl.ngModelCtrl.$invalid && $ctrl.ngModelCtrl.$touched);
            };

            // the message line, size and label-position (shared with aui-input and aui-tree-select)
            $ctrl.field = fieldExtras.create({
                ctrl: $ctrl,
                attrs: $attrs,
                ngModel: () => $ctrl.ngModelCtrl,
                invalidShown: () => $ctrl.showInvalid(),
                id: () => $ctrl.compId
            });

            const VIRTUAL_MIN_ROWS = 80;          // render a scroll window above this many rows
            const OVERSCAN_ROWS = 8;
            const DEFAULT_ROW_PITCH = 33;         // px, until the real row height is measured (32px rows, 1px apart)
            const DEFAULT_SEARCH_DELAY_MS = 300;
            const DEFAULT_CACHE_TTL_MS = 60000;
            const MORE_MARGIN_PX = 200;           // ask for the next page this far before the end of the list
            const AUTO_FILL_PAGES = 5;            // pages loaded in a row to fill a panel nobody has scrolled yet
            const LOOKUP_CHUNK = 100;

            // Dropdown panel: positioning, top layer and the open/close animation (the shared auiDropdownPanel engine).
            let panelCtl = null;
            // A close whose fade-out is still running: the search is reset when it ends, or on a reopen before that.
            let closeFinishing = false;
            let pendingSearchFocus = null;
            // max-tag-count="responsive": the tag fitter and how many tags fit on one line.
            let tagFit = null;
            let tagFitCount = Infinity;
            // While open: an outside press or focus moving into an iframe closes it; focus leaving marks it touched.
            let dismiss = null;
            let stopFocusLeave = null;
            const typeahead = kit.createTypeahead(600);

            // Remote data: the option list (load-options) and the lookup of selected values that are not loaded.
            let list = null;
            let lookup = null;
            let paramsId = null;                 // params key of the current list; null while loading is not enabled
            const picked = new Map();            // key -> copy of an option the user picked (kept while selected)
            let valueOptionsByKey = new Map();   // value-options by key
            let pendingKeys = new Set();         // selected values whose label is being looked up
            let shownSession = null;             // the list whose rows are shown (kept while a new query loads)
            let searchTimer = null;
            let interacted = false;              // scrolled, typed or used the keyboard since opening
            let autoFill = 0;
            let installedApi = null;
            let destroyed = false;
            const warned = {};

            // Rows of the open panel and the scroll window over them.
            let virtual = false;
            let pitch = 0;
            let windowStart = 0;
            let windowEnd = 0;
            let scrollFrame = null;
            let tipRowEl = null;

            // DOM elements
            let triggerElement = null;
            let panelElement = null;
            let searchElement = null;
            let hiddenInputElement = null;
            let stopTriggerPress = null;
            let stopQuietFocus = null;
            let stopLabelTip = null;

            const cancelSearchFocus = () => {
                if (pendingSearchFocus) {
                    $timeout.cancel(pendingSearchFocus);
                    pendingSearchFocus = null;
                }
            };

            // Watchers this component registers, removed on destroy (AngularJS 1.5 keeps the watcher list of a
            // destroyed child scope, and with it the watched data).
            const ownWatchers = [];
            const own = {
                $watch: (getter, listener, deep) => {
                    const stop = $scope.$watch(getter, listener, deep);
                    ownWatchers.push(stop);
                    return stop;
                },
                $watchCollection: (getter, listener) => {
                    const stop = $scope.$watchCollection(getter, listener);
                    ownWatchers.push(stop);
                    return stop;
                }
            };

            // The digest of the whole page that a close from the user's input owes it (closeFromInput,
            // kit.createPageDigest)
            const pageDigest = kit.createPageDigest($scope, () => $element[0]);

            const resetSearch = () => {
                $ctrl.searchQuery = '';
                $ctrl.updateFilteredOptions();
            };

            // State management
            $ctrl.isOpen = false;
            $ctrl.panelReady = false;   // the options exist in the page only while the panel is shown
            $ctrl.searchQuery = '';
            $ctrl.filteredOptions = [];
            $ctrl.rows = [];
            $ctrl.viewRows = [];
            $ctrl.padTop = 0;
            $ctrl.padBottom = 0;
            $ctrl.view = {status: '', more: '', stale: false, refreshing: false, timeout: false, minLength: 0, setSize: null, searching: false};
            $ctrl.skeleton = [0, 1, 2, 3];
            $ctrl.showSearch = false;
            $ctrl.selectedKeysSet = new Set();
            $ctrl.disabledOptionsKeySet = new Set();
            $ctrl.displayPending = false;
            $ctrl.labelsPending = false;   // a selected value's label is being looked up (trigger aria-busy)
            $ctrl.unresolvedCount = 0;

            $ctrl.borderRadiusStyleVal = kit.borderRadius(true, false, false);


            // Default configuration
            $ctrl.DEFAULTS = {
                LABEL_FIELD: 'label',
                VALUE_FIELD: 'id',
                MULTIPLE: false,
                SEARCH_THRESHOLD: 5 // Show search when options exceed this count
            };

            $ctrl.validationValue = '';
            $ctrl.selectedItems = [];

            function isUndefined(value) {
                return typeof value === 'undefined';
            }

            const isSelectionKey = kit.isSelectionKey;

            const hasOptionKey = function (option) {
                return option !== null &&
                    typeof option === 'object' &&
                    isSelectionKey(option[$ctrl.valueField]);
            };

            /** An option's value as a string (values are compared as strings), or null when it has none. */
            const keyOf = function (option) {
                return hasOptionKey(option) ? String(option[$ctrl.valueField]) : null;
            };

            const warnOnce = function (text) {
                if (warned[text]) return;
                warned[text] = true;
                if (typeof console !== 'undefined' && console.warn) console.warn('aui-select: ' + text);
            };

            // --- Remote data settings ---

            const readNumber = function (raw, fallback) {
                const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
                return Number.isFinite(n) && n >= 0 ? n : fallback;
            };
            const readPageSize = () => Math.floor(readNumber($ctrl.pageSize, 0));
            const readSearchDelay = () => readNumber($ctrl.searchDelay, DEFAULT_SEARCH_DELAY_MS);
            const readMinLength = () => Math.floor(readNumber($ctrl.searchMinLength, 0));
            const readTtl = () => readNumber($ctrl.cacheTtl, DEFAULT_CACHE_TTL_MS);
            const readTimeout = () => readNumber($ctrl.loadTimeout, 0);
            const readPreload = () => kit.readFlag($attrs, 'preload', $ctrl.preload, false);

            /** Where the options come from: 'static' (options), 'all' (load-options at once) or 'paged'. */
            const dataMode = function () {
                if (typeof $ctrl.loadOptions !== 'function') return 'static';
                return readPageSize() > 0 ? 'paged' : 'all';
            };

            /** Lookups run with lookup-enabled; giving lookup-options turns them on unless lookup-enabled="false". */
            const lookupActive = function () {
                if (!lookup) return false;
                const dedicated = typeof $ctrl.lookupOptions === 'function';
                if (!kit.readFlag($attrs, 'lookupEnabled', $ctrl.lookupEnabled, dedicated)) return false;
                return dedicated || dataMode() !== 'static';
            };

            const searchText = () => String($ctrl.searchQuery === undefined || $ctrl.searchQuery === null ? '' : $ctrl.searchQuery).trim();

            const hasSelectedLabel = function (key) {
                const labels = $ctrl.selectedLabels;
                return !!labels && typeof labels === 'object' && Object.prototype.hasOwnProperty.call(labels, key)
                    && labels[key] !== undefined && labels[key] !== null;
            };

            /** Label of a selected value whose option is not loaded: selected-labels, else the value itself. */
            const unknownLabel = function (value) {
                const labels = $ctrl.selectedLabels;
                const key = String(value);
                if (labels && typeof labels === 'object' && Object.prototype.hasOwnProperty.call(labels, key)) {
                    const label = labels[key];
                    if (label !== undefined && label !== null) return label;
                }
                return value;
            };

            /**
             * The best option for a selected value outside the static options: a loaded list, an option the user
             * picked, value-options, a lookup. Loaded data comes first: it is the freshest.
             */
            const knownItem = function (value) {
                const key = String(value);
                if (list) {
                    const loaded = list.find(key);
                    if (loaded) return loaded;
                }
                if (picked.has(key)) return picked.get(key);
                if (valueOptionsByKey.has(key)) return valueOptionsByKey.get(key);
                if (lookup) {
                    const entry = lookup.found(key);
                    if (entry) return entry.item;
                }
                return null;
            };

            const resolveSelectionItems = function (values) {
                const options = (dataMode() === 'static' && Array.isArray($ctrl.options) && $ctrl.options.length > 0) ? $ctrl.options : [];
                const byKey = new Map();
                const byStringKey = new Map();

                options.forEach(option => {
                    if (hasOptionKey(option)) {
                        const k = option[$ctrl.valueField];
                        if (!byKey.has(k)) {
                            byKey.set(k, option);
                        }
                        const sk = String(k);
                        if (!byStringKey.has(sk)) {
                            byStringKey.set(sk, option);
                        }
                    }
                });

                return (Array.isArray(values) && values.length > 0 ? values : []).filter(isSelectionKey).map(value => {
                    if (byKey.has(value)) {
                        return angular.copy(byKey.get(value));
                    }
                    if (byStringKey.has(String(value))) {
                        return angular.copy(byStringKey.get(String(value)));
                    }
                    const known = knownItem(value);
                    if (known) return angular.copy(known);
                    // No matching option: preserve the value in a local display object
                    const item = {};
                    item[$ctrl.valueField] = value;
                    item[$ctrl.labelField] = unknownLabel(value);
                    return item;
                });
            };

            /**
             * After each render of the selection: forget picked options and lookups of values that are no longer
             * selected, and find labels for the values no source knows (a lookup, or the whole list in load-all mode).
             */
            const syncLabels = function (values, items) {
                if (!lookup && dataMode() === 'static') {
                    // Static options and nothing to look up: selected-labels or the raw value are all there is.
                    $ctrl.unresolvedCount = 0;
                    pendingKeys = new Set();
                    $ctrl.displayPending = false;
                    $ctrl.labelsPending = false;
                    return;
                }
                const keys = new Set(values.map(String));
                picked.forEach((item, key) => {
                    if (!keys.has(key)) picked.delete(key);
                });
                if (lookup) lookup.retain(keys);
                const unresolved = new Map();
                const staticKeys = new Set();
                if (dataMode() === 'static' && Array.isArray($ctrl.options)) {
                    $ctrl.options.forEach(option => {
                        const key = keyOf(option);
                        if (key !== null) staticKeys.add(key);
                    });
                }
                values.forEach(value => {
                    const key = String(value);
                    if (!staticKeys.has(key) && !knownItem(value) && !hasSelectedLabel(key)) unresolved.set(key, value);
                });
                $ctrl.unresolvedCount = unresolved.size;
                // Always tell the lookup what is unknown now: a value that became known is not asked any more.
                if (lookupActive()) lookup.want(unresolved);
                if (unresolved.size > 0 && !lookupActive()) {
                    if (dataMode() === 'all') {
                        ensureList('values');   // the whole list has the labels
                    } else if (dataMode() === 'paged') {
                        warnOnce('a selected value is not among the loaded options; set lookup-enabled, lookup-options ' +
                            'or value-options so that its label can be shown');
                    }
                }
                pendingKeys = new Set();
                if (lookup) {
                    unresolved.forEach((value, key) => {
                        if (lookup.pending(key)) pendingKeys.add(key);
                    });
                }
                $ctrl.displayPending = !$ctrl.multiple && items.length > 0 && pendingKeys.has(keyOf(items[0]));
                $ctrl.labelsPending = pendingKeys.size > 0;
            };

            /** A selected value whose label is still being looked up (shown as a placeholder, never as the raw value). */
            $ctrl.isPendingItem = function (item) {
                const key = keyOf(item);
                return key !== null && pendingKeys.has(key);
            };

            $ctrl.itemLabel = function (item) {
                if (!item) return '';
                const label = item[$ctrl.labelField];
                const value = (label !== undefined && label !== null)
                    ? label
                    : item[$ctrl.valueField];
                return (value === undefined || value === null) ? '' : String(value);
            };

            /** A selected value the user cannot remove: the field is disabled, or the value is in disabled-values. */
            /** readonly: the value shows and the field takes the focus, but nothing opens or changes. */
            $ctrl.isReadonly = function () {
                return kit.readFlag($attrs, 'readonly', $ctrl.readonly, false);
            };

            /** label-position="top": a press on the label gives the field the focus, as a label does (nothing opens). */
            $ctrl.focusFromLabel = function () {
                if (triggerElement && !$ctrl.disabled) triggerElement.focus();
            };

            $ctrl.isItemLocked = function (item) {
                return !!$ctrl.disabled || $ctrl.isReadonly() || $ctrl.isOptionDisabled(item);
            };

            /** Something for the clear button to remove (in multiple mode, locked values stay). */
            $ctrl.hasClearable = function () {
                if ($ctrl.selectedKeysSet.size === 0) return false;
                if (!$ctrl.multiple) return true;
                return Array.isArray($ctrl.selectedItems) && $ctrl.selectedItems.some(item => !$ctrl.isOptionDisabled(item));
            };

            /**
             * max-tag-count: a number, or "responsive" (as many tags as fit on one line). Read again only when the attribute
             * or its value changes: it is asked several times per digest.
             */
            let tagModeFor = null;
            const tagMode = function () {
                if (!tagModeFor || tagModeFor.raw !== $attrs.maxTagCount || tagModeFor.bound !== $ctrl.maxTagCount) {
                    tagModeFor = {raw: $attrs.maxTagCount, bound: $ctrl.maxTagCount, mode: kit.readTagMode($attrs, $ctrl.maxTagCount)};
                }
                return tagModeFor.mode;
            };

            $ctrl.tagsResponsive = function () {
                return tagMode().responsive;
            };

            /**
             * Multiple mode: how many tags to show before the rest collapse into one "+N" tag. Unset, empty, negative
             * or non-numeric values mean no limit, but never more than kit.TAG_RENDER_CAP tags are rendered.
             */
            $ctrl.visibleTagLimit = function () {
                const mode = tagMode();
                return Math.min(mode.responsive ? tagFitCount : mode.limit, kit.TAG_RENDER_CAP);
            };

            $ctrl.hiddenTagCount = function () {
                const total = Array.isArray($ctrl.selectedItems) ? $ctrl.selectedItems.length : 0;
                return Math.max(0, total - $ctrl.visibleTagLimit());
            };

            // Built once per selection and limit, not on every digest.
            let hiddenTitleCache = null;
            $ctrl.hiddenTagTitle = function () {
                const items = $ctrl.selectedItems;
                const limit = $ctrl.visibleTagLimit();
                if (!Array.isArray(items) || items.length <= limit) return '';
                if (!hiddenTitleCache || hiddenTitleCache.items !== items || hiddenTitleCache.length !== items.length
                    || hiddenTitleCache.limit !== limit) {
                    hiddenTitleCache = {
                        items: items,
                        length: items.length,
                        limit: limit,
                        title: kit.hiddenTagsTitle(items.slice(limit).map(item => $ctrl.itemLabel(item)))
                    };
                }
                return hiddenTitleCache.title;
            };

            // --- Initialization ---
            $ctrl.$onInit = function () {
                $ctrl.isOpen = false;
                // Set defaults for optional bindings
                $ctrl.labelField = $ctrl.labelField || $ctrl.DEFAULTS.LABEL_FIELD;
                $ctrl.valueField = $ctrl.valueField || $ctrl.DEFAULTS.VALUE_FIELD;
                $ctrl.compId = (undefined !== $ctrl.compId && null !== $ctrl.compId && '' !== $ctrl.compId) ? $ctrl.compId : 'aui-select-comp__' + $scope.$id;
                // Is required (multiple, disabled, loading, clearable, show-label: see "The on/off options")
                $ctrl.required = $attrs.hasOwnProperty('required') ? !($ctrl.required === false || $ctrl.required === 'false') : false;

                $ctrl.borderRounded = $attrs.hasOwnProperty('borderRounded') ? !($ctrl.borderRounded === false || $ctrl.borderRounded === 'false') : true;
                $ctrl.borderRoundedLeftNone = ($attrs.hasOwnProperty('borderRoundedLeftNone') || ($ctrl.borderRoundedLeftNone === true || $ctrl.borderRoundedLeftNone === 'true'));
                $ctrl.borderRoundedRightNone = ($attrs.hasOwnProperty('borderRoundedRightNone') || ($ctrl.borderRoundedRightNone === true || $ctrl.borderRoundedRightNone === 'true'));
                $ctrl.borderRadiusStyleVal = kit.borderRadius($ctrl.borderRounded, $ctrl.borderRoundedLeftNone, $ctrl.borderRoundedRightNone);



                $ctrl.dropDownPositionStrategy = $ctrl.dropDownPositionStrategy ? $ctrl.dropDownPositionStrategy : 'fixed';
                $ctrl.dropDownPanelBackgroundOpacity = $ctrl.dropDownPanelBackgroundOpacity === 'OPAQUE_LIKE' ? $ctrl.dropDownPanelBackgroundOpacity : 'FULL';
                $ctrl.panelStyle = kit.panelBackgroundStyle($ctrl.dropDownPanelBackgroundOpacity);

                if (!($ctrl.selectedKeysSet instanceof Set)) $ctrl.selectedKeysSet = new Set();
                $ctrl.selectedKeysSet.clear();

                setUpRemoteData();

                const ngModelCtrl = $ctrl.ngModelCtrl;
                if (ngModelCtrl) {
                    // Define $formatters: External $modelValue → Internal $viewValue (object array)
                    ngModelCtrl.$formatters.push(function (modelValue) {
                        const values = $ctrl.multiple
                            ? (Array.isArray(modelValue) ? modelValue : [])
                            : (modelValue !== undefined && modelValue !== null && modelValue !== '' ? [modelValue] : []);
                        // Preserve selected keys even when options do not contain them
                        return resolveSelectionItems(values);
                    });
                    // Define $parsers: Internal $viewValue → External $modelValue
                    ngModelCtrl.$parsers.push(function (viewValue) {
                        if (!Array.isArray(viewValue) || viewValue.length === 0) {
                            return $ctrl.multiple ? [] : '';
                        }
                        const values = viewValue.map(item => {
                            if (null === item || undefined === item || typeof item !== 'object') {
                                return undefined;
                            }
                            return item[$ctrl.valueField];
                        }).filter(val => isSelectionKey(val));

                        if (values.length === 0) {
                            return $ctrl.multiple ? [] : '';
                        }
                        return $ctrl.multiple ? values : values[0];
                    });
                    // Define $render(): Sync $viewValue → UI (presentation only)
                    ngModelCtrl.$render = function () {
                        $ctrl.updateUIDataViewValue('render');
                    };

                    ngModelCtrl.$isEmpty = function (value) {
                        if (value && Array.isArray(value)) {
                            return value.length === 0;
                        }
                        return isUndefined(value) || value === '' || value === null || value !== value;
                    };

                } else {
                    $ctrl.selectedItems = [];
                    $ctrl.selectedKeysSet.clear();
                    $ctrl.displayText = '';
                }

                // Watch for options changes
                own.$watchCollection(() => $ctrl.options, (newVal) => {
                    if (dataMode() !== 'static') {
                        if (Array.isArray(newVal)) warnOnce('options and load-options are both set; load-options is used');
                        return;
                    }
                    if (newVal && Array.isArray(newVal)) {
                        $ctrl.refreshViewValueFromModel();
                        $ctrl.updateFilteredOptions();
                        if ($ctrl.activeIndex >= $ctrl.filteredOptions.length) $ctrl.activeIndex = $ctrl.filteredOptions.length - 1;
                        $ctrl.determineSearchVisibility();

                        if ($ctrl.autoSelectOnSingleRequired) {
                            $ctrl.autoSelectHandler();
                        }
                    }
                });

                // Watch for options changes
                own.$watch(() => $ctrl.disabledValues, (newVal) => {
                    $ctrl.disabledOptionsKeySet.clear();
                    if (newVal && Array.isArray(newVal)) {
                        newVal.forEach(item => {
                            if (isSelectionKey(item)) {
                                $ctrl.disabledOptionsKeySet.add(item);
                                $ctrl.disabledOptionsKeySet.add(String(item));
                            }
                        });
                    }
                }, true);

                // max-tag-count="responsive": fit the tags again whenever one of them changes (a value, a label, a lock).
                own.$watch(() => (tagMode().responsive && tagFit ? tagFit.sync() : 0), (version) => {
                    if (version && tagFit) tagFit.schedule();
                });

                // selected-labels: labels for selected values whose option is not loaded (yet).
                own.$watchCollection(() => $ctrl.selectedLabels, (labels, previous) => {
                    if (labels !== previous) $ctrl.refreshViewValueFromModel();
                });

                // value-options: options the page already has for the current value(s).
                own.$watch(() => $ctrl.valueOptions, (options, previous) => {
                    valueOptionsByKey = new Map();
                    (Array.isArray(options) ? options : (options && typeof options === 'object' ? [options] : [])).forEach(option => {
                        const key = keyOf(option);
                        if (key !== null && !valueOptionsByKey.has(key)) valueOptionsByKey.set(key, option);
                    });
                    if (options !== previous) $ctrl.refreshViewValueFromModel();
                }, true);

                // Disabled or readonly while open: close, as aui-tree-select does.
                own.$watch(() => !!$ctrl.disabled || $ctrl.isReadonly(), (off) => {
                    if (off && $ctrl.isOpen) $ctrl.closeDropdown();
                });

                // Loading turned off while the search box has the focus: the box leaves the panel, the keyboard
                // stays on the field (focus moving inside the component does not close it).
                own.$watch(() => !!($ctrl.isOpen && $ctrl.loadNotice()), (notice) => {
                    const active = document.activeElement;
                    if (notice && active && active.classList && active.classList.contains('aui-select__search-input')
                        && $element[0].contains(active)) {
                        kit.focusQuietly(triggerElement);
                    }
                });

                own.$watch(() => $ctrl.api, bindApi);

                // Cleanup on destroy
                $scope.$on('$destroy', $ctrl.cleanup);
            };


            // --- Remote data ---

            function setUpRemoteData() {
                const remoteList = typeof $ctrl.loadOptions === 'function';
                if (!remoteList && typeof $ctrl.lookupOptions !== 'function') return;
                // A function as the answer: the attribute names the function without calling it
                // (load-options="vm.load"). It still counts as a failed load; the warning says how to write it.
                const pageAnswer = (attribute, example, answer) => {
                    if (typeof answer === 'function') {
                        warnOnce(attribute + ' gave back a function instead of data: call it in the attribute, e.g. ' + example);
                    }
                    return answer;
                };
                if (remoteList) {
                    list = remote.createList({
                        load: (request) => pageAnswer('load-options', 'load-options="vm.load($request)"',
                            $ctrl.loadOptions({$request: request})),
                        keyOf: keyOf,
                        pageSize: readPageSize,
                        timeoutMs: readTimeout,
                        ttlMs: readTtl,
                        // A background refresh replaces the rows only when nobody is looking at them.
                        canReplace: () => !$ctrl.isOpen || !interacted,
                        onUpdate: onListUpdate,
                        // after the page's digest the answer arrives in (one pass of it, not two); what the page shows
                        // of this field (its model, validity, selected-items) still gets that digest when it changes
                        deliver: kit.createDelivery($scope, () => {
                            const m = $ctrl.ngModelCtrl;
                            return m ? [m.$viewValue, m.$modelValue, m.$valid, m.$pending, Object.keys(m.$error).join(','), $ctrl.selectedItems]
                                : [$ctrl.selectedItems];
                        }),
                        warn: warnOnce
                    });
                }
                lookup = remote.createLookup({
                    run: (request) => (typeof $ctrl.lookupOptions === 'function'
                        ? pageAnswer('lookup-options', 'lookup-options="vm.lookup($request)"', $ctrl.lookupOptions({$request: request}))
                        : pageAnswer('load-options', 'load-options="vm.load($request)"', $ctrl.loadOptions({$request: request}))),
                    keyOf: keyOf,
                    // Through load-options a lookup is a page request: never ask for more ids than a page holds.
                    chunkSize: () => (typeof $ctrl.lookupOptions === 'function' ? LOOKUP_CHUNK : (readPageSize() || LOOKUP_CHUNK)),
                    timeoutMs: readTimeout,
                    paramsFor: () => angular.copy($ctrl.loadParams),
                    // Through load-options it waits until loading is enabled and for a list that is loading (it may
                    // have the value); a dedicated lookup needs neither.
                    blocked: () => typeof $ctrl.lookupOptions !== 'function' && (paramsId === null || (!!list && list.busy())),
                    group: () => ($ctrl.lookupGroup
                        ? $ctrl.lookupGroup + '\n' + (typeof $ctrl.lookupOptions === 'function' ? '' : String(paramsId))
                        : ''),
                    onUpdate: () => {
                        $ctrl.refreshViewValueFromModel();
                        if ($ctrl.isOpen) rebuildRows();
                    },
                    warn: warnOnce
                });
                if (!remoteList) return;

                // load-params / load-enabled: compared by value, so a literal written in the template is fine.
                own.$watch(() => (kit.readFlag($attrs, 'loadEnabled', $ctrl.loadEnabled, true) ? remote.paramsKey($ctrl.loadParams) : null),
                    onParamsChange);

                if ($attrs.resetOnParams === 'clear' && $attrs.ngModel) {
                    const getValue = $parse($attrs.ngModel);
                    const reset = remote.paramsResetWatch(
                        () => remote.paramsKey($ctrl.loadParams),
                        () => kit.readFlag($attrs, 'loadEnabled', $ctrl.loadEnabled, true),
                        () => getValue($scope.$parent),
                        clearForParams);
                    own.$watch(reset.watch, reset.listener);
                }
            }

            function onParamsChange(id, previous) {
                if (destroyed || !list) return;
                paramsId = id;
                list.configure(id, id === null ? null : $ctrl.loadParams);
                if (lookup) {
                    if (id !== previous) lookup.newRound();
                    lookup.kick();
                }
                shownSession = null;
                if (id !== null && ($ctrl.isOpen || readPreload())) ensureList($ctrl.isOpen ? 'params' : 'preload');
                // Labels may come from the new list, or need a lookup.
                $ctrl.refreshViewValueFromModel();
                if ($ctrl.isOpen) {
                    $ctrl.activeIndex = -1;
                    rebuildRows();
                }
            }

            /** reset-on-params="clear": the params changed under an unchanged value. */
            function clearForParams() {
                const ngModelCtrl = $ctrl.ngModelCtrl;
                if (!ngModelCtrl) return;
                const oldValue = modelNow();
                ngModelCtrl.$setViewValue([], 'paramsChanged');
                $ctrl.updateUIDataViewValue('paramsChanged');
                $ctrl.checkAndCallOnChangeFunc('params-reset', null, oldValue);
            }

            /**
             * Start what the current list needs (page 1, or a background refresh). With search-min-length a paged
             * list has nothing to show before a long enough query: no request then.
             */
            function ensureList(reason) {
                if (!list || paramsId === null) return;
                if (dataMode() === 'paged' && list.query() === '' && readMinLength() > 0) {
                    if ($ctrl.isOpen) rebuildRows();
                    return;
                }
                list.ensure(reason);
                if ($ctrl.isOpen) rebuildRows();
            }

            function onListUpdate(session, info) {
                if (destroyed) return;
                // Labels first (the new items may know values a lookup waits for), then let waiting lookups go.
                if ($ctrl.unresolvedCount > 0 || info.page === 1) $ctrl.refreshViewValueFromModel();
                if (lookup) lookup.kick();
                if (info.page === 1 && !info.error && session.query === '' && $ctrl.autoSelectOnSingleRequired) $ctrl.autoSelectHandler();
                if (!$ctrl.isOpen) return;
                if (dataMode() === 'all') $ctrl.determineSearchVisibility();
                // The first rows replace the placeholder rows: the panel grows to them in one movement (panel engine);
                // the list fades in over the swap.
                if (info.page === 1 && !info.error && panelCtl && panelElement && !panelElement.querySelector('li.aui-select__option')) {
                    panelCtl.growNext({fadeIn: '.aui-select__options'});
                }
                rebuildRows();
                if (choicePending && info.page === 1 && !info.error) showChoiceOnArrival();
                $ctrl.updatePosition();
                afterRender(checkMore);   // a short page may leave the panel unfilled: ask for the next one
            }

            /**
             * A server search is under way: the rows shown do not answer the typed text yet (typing pauses, or the
             * request runs), until the rows of that text are shown. The search box shows a spinner and the progress
             * line runs, as in aui-tree-select. Never for a list searched in the browser, below search-min-length, or
             * after a failure (rebuildRows sets view.stale / view.searching only for a paged list's server search).
             */
            $ctrl.searching = function () {
                return !!$ctrl.view.stale || ($ctrl.view.status === 'loading' && !!$ctrl.view.searching);
            };

            /** Server search: ask once typing pauses (search-delay); an empty box shows the plain list at once. */
            function onRemoteQuery() {
                if (searchTimer) {
                    $timeout.cancel(searchTimer);
                    searchTimer = null;
                }
                if (!list || paramsId === null) return;
                const query = searchText();
                const min = readMinLength();
                if (query !== '' && query.length < min) return;
                if (query === list.query()) return;
                if (query === '') {
                    list.setQuery('');
                    if ($ctrl.isOpen && min === 0) list.ensure('search');
                    return;
                }
                searchTimer = $timeout(() => {
                    searchTimer = null;
                    if (!$ctrl.isOpen || destroyed) return;
                    const now = searchText();
                    if (now === '' || now.length < readMinLength()) return;
                    list.setQuery(now);
                    list.ensure('search');
                    rebuildRows();
                }, readSearchDelay());
            }

            /** Near the end of the list, or a list that does not fill the panel yet: ask for the next page. */
            function checkMore() {
                if (!$ctrl.isOpen || destroyed || !list || dataMode() !== 'paged' || paramsId === null) return;
                if ($ctrl.view.status !== '' || $ctrl.view.stale || $ctrl.view.more !== 'idle') return;
                const el = optionsList();
                if (!el) return;
                if (el.scrollHeight - el.scrollTop - el.clientHeight > MORE_MARGIN_PX) return;
                const filling = el.scrollTop === 0 && el.scrollHeight <= el.clientHeight + 1;
                if (filling) {
                    if (autoFill >= AUTO_FILL_PAGES) return;
                    autoFill += 1;
                }
                if (list.more()) $scope.$evalAsync(rebuildRows);
            }

            $ctrl.retryLoad = function ($event) {
                if ($event) $event.stopPropagation();
                if (!list) return;
                if (list.retry()) rebuildRows();
            };

            /** The only option, when the whole list for the current params is known to have exactly one. */
            const singleOption = function () {
                if (dataMode() === 'static') {
                    return Array.isArray($ctrl.options) && $ctrl.options.length === 1 && typeof $ctrl.options[0] === 'object'
                        ? $ctrl.options[0] : null;
                }
                if (!list || paramsId === null) return null;
                const session = list.plain();
                return session && session.status === 'ready' && session.ended && session.items.length === 1 ? session.items[0] : null;
            };


            /**
             * Keep the hidden validation input's value equal to validationValue. The input exists only for native
             * required validation and form serialization; it is deliberately not an ngModel, so it never registers
             * in the parent form next to the real control.
             */
            const syncHiddenValidationInput = function () {
                if (!hiddenInputElement) {
                    hiddenInputElement = $element[0].querySelector('.aui-select > input');
                }
                const value = typeof $ctrl.validationValue === 'string' ? $ctrl.validationValue : '';
                if (hiddenInputElement && hiddenInputElement.value !== value) {
                    hiddenInputElement.value = value;
                }
            };

            $ctrl.updateUIDataViewValue = function (trigger) {
                const ngModelCtrl = $ctrl.ngModelCtrl;
                if (ngModelCtrl) {
                    let values = [];
                    if (Array.isArray(ngModelCtrl.$viewValue)) {
                        values = ngModelCtrl.$viewValue
                            .map(item => {
                                if (hasOptionKey(item)) {
                                    return item[$ctrl.valueField];
                                }
                                if (isSelectionKey(item)) {
                                    return item;
                                }
                                return undefined;
                            })
                            .filter(isSelectionKey);
                    } else if (isSelectionKey(ngModelCtrl.$viewValue)) {
                        values = [ngModelCtrl.$viewValue];
                    }

                    // Fallback to $modelValue if $viewValue didn't yield values but $modelValue has one
                    if (values.length === 0 && ngModelCtrl.$modelValue !== undefined && ngModelCtrl.$modelValue !== null && ngModelCtrl.$modelValue !== '' && !Number.isNaN(ngModelCtrl.$modelValue)) {
                        const mVal = ngModelCtrl.$modelValue;
                        values = $ctrl.multiple
                            ? (Array.isArray(mVal) ? mVal.filter(isSelectionKey) : [])
                            : (isSelectionKey(mVal) ? [mVal] : []);
                    }

                    const items = resolveSelectionItems(values);
                    $ctrl.selectedItems = items;
                    $ctrl.selectedKeysSet = new Set();
                    items.forEach(item => {
                        if (hasOptionKey(item)) {
                            const k = item[$ctrl.valueField];
                            $ctrl.selectedKeysSet.add(k);
                            $ctrl.selectedKeysSet.add(String(k));
                        }
                    });
                    syncLabels(values, items);

                    $ctrl.displayText = (!$ctrl.multiple && items.length > 0)
                        ? $ctrl.itemLabel(items[0])
                        : '';

                    $ctrl.validationValue = items
                        .filter(hasOptionKey)
                        .map(item => item[$ctrl.valueField])
                        .join(',');

                    const modelValue = ngModelCtrl.$modelValue;
                    $element[0].value = Array.isArray(modelValue)
                        ? modelValue.slice()
                        : (modelValue !== undefined && modelValue !== null ? modelValue : '');
                } else {
                    $ctrl.selectedItems = [];
                    $ctrl.selectedKeysSet.clear();
                    $ctrl.displayText = '';
                    $ctrl.validationValue = '';
                    $element[0].value = '';
                }
                syncHiddenValidationInput();
                // Pinned rows show the selection: keep them current while the panel is open.
                if ($ctrl.isOpen && dataMode() !== 'static' && trigger !== 'rows') rebuildRows();
            };

            $ctrl.refreshViewValueFromModel = function () {
                const ngModelCtrl = $ctrl.ngModelCtrl;
                if (ngModelCtrl) {
                    ngModelCtrl.$render();
                }
            };

            // Pending auto-select timers, cancelled on destroy so none can run against a removed select.
            const pendingAutoSelects = new Set();

            $ctrl.autoSelectHandler = function () {
                if ($ctrl.autoSelectOnSingleRequired) {
                    const pendingAutoSelect = $timeout(() => {
                        pendingAutoSelects.delete(pendingAutoSelect);
                        if ($ctrl.required && $ctrl.ngModelCtrl) {
                            const only = singleOption();
                            if (only) {
                                if ($ctrl.ngModelCtrl.$isEmpty($ctrl.ngModelCtrl.$viewValue) && $ctrl.ngModelCtrl.$isEmpty($ctrl.ngModelCtrl.$modelValue)) {
                                    const _defaultSelected = angular.copy(only);
                                    $ctrl.selectOption(_defaultSelected, null, 'programmatic');
                                }
                            }
                        }
                    }, 1000);
                    pendingAutoSelects.add(pendingAutoSelect);
                }
            }

            // Post-link to get DOM references
            $ctrl.$postLink = function () {
                triggerElement = $element[0].querySelector('.aui-select__trigger');
                panelElement = $element[0].querySelector('.aui-select__panel');
                searchElement = $element[0].querySelector('.aui-select__search-input');
                if (triggerElement && panelElement) {
                    panelCtl = dropdownPanel.create({
                        trigger: triggerElement,
                        panel: panelElement,
                        strategy: () => ($ctrl.dropDownPositionStrategy === 'absolute' ? 'absolute' : 'fixed'),
                        minWidth: () => {
                            const width = parseFloat($ctrl.panelMinWidth);
                            return Number.isFinite(width) && width > 0 ? width : 0;
                        },
                        // A list from the server can still grow (loading, more pages, other results); static
                        // options shown on open are the most there will be (a search only narrows them).
                        growable: () => dataMode() !== 'static',
                        onShown: onPanelShown,
                        onClosed: onPanelClosed
                    });
                    panelElement.addEventListener('mousemove', onPanelMouse, {passive: true});
                    panelElement.addEventListener('mousedown', onPanelMousedownEvent);
                    panelElement.addEventListener('click', onPanelClick);
                    stopQuietFocus = kit.quietPointerFocus(triggerElement, 'aui-select__trigger--pointer-focus');
                    stopTriggerPress = kit.onTriggerPress({
                        trigger: triggerElement,
                        ignore: '.aui-select__tag-remove, .aui-control-clear',
                        enabled: () => !$ctrl.disabled && !$ctrl.loading && !$ctrl.isReadonly(),
                        // (no event: the press goes on to the page as before, only the click is kept inside). A close:
                        // closeFromInput (the panel and the page's code at once, the page's digest after the close's
                        // first frame).
                        press: () => {
                            if ($ctrl.isOpen) settle(false, () => closeFromInput());
                            else if (openAsksPage()) pageAsk.open(() => $ctrl.toggleDropdown(null));
                            else settle(false, () => $ctrl.toggleDropdown(null));
                        },
                        click: (event, afterPress) => {
                            if (!afterPress) {
                                onTriggerClick(event);
                                return;
                            }
                            // the press has toggled: the click stays inside, as the toggle keeps it
                            if (!$ctrl.disabled && !$ctrl.loading && !$ctrl.isReadonly()) event.stopPropagation();
                        }
                    });
                    // The list is created and removed with the panel: listen on the panel (scroll does not bubble,
                    // so in the capture phase).
                    panelElement.addEventListener('scroll', onPanelScroll, true);
                    panelElement.addEventListener('mouseover', onPanelOver, {passive: true});
                }
                $element[0].addEventListener('keydown', onRootKeydown);
                stopLabelTip = kit.labelTip($element[0]);
                dismiss = kit.createDismiss({
                    root: $element[0],
                    isOpen: () => $ctrl.isOpen && !destroyed,
                    close: () => settle(false, () => closeFromInput())
                });
                stopFocusLeave = kit.onFocusLeave($element[0], (next) => {
                    if (destroyed) return;
                    // Focus moved to another control (Tab, or a click on it): close, touched with it. A press on the
                    // page itself is handled by the outside-press listener. Closed: touched alone (the field's look at
                    // once, the page's bindings of it once the field's ring has faded out).
                    if (next && $ctrl.isOpen) {
                        settle(false, () => closeFromInput());
                    } else if ($ctrl.ngModelCtrl && !$ctrl.ngModelCtrl.$touched) {
                        settle(false, markTouched);
                        pageDigest.owe(true);
                    }
                });
                tagFit = kit.createTagFit({
                    scope: $scope,
                    root: $element[0],
                    total: () => (Array.isArray($ctrl.selectedItems) ? $ctrl.selectedItems.length : 0),
                    text: (i) => ($ctrl.isPendingItem($ctrl.selectedItems[i]) ? '' : $ctrl.itemLabel($ctrl.selectedItems[i])),
                    locked: (i) => $ctrl.isItemLocked($ctrl.selectedItems[i]),
                    pending: (i) => $ctrl.isPendingItem($ctrl.selectedItems[i]),
                    onFit: (count) => {
                        tagFitCount = count;
                        localDigest();
                    }
                });
            };

            /** Re-measure the open panel (the trigger can change height, e.g. when a tag is added or removed). */
            $ctrl.updatePosition = function () {
                if (panelCtl) panelCtl.update();
            };

            /** Called by the panel engine once the close animation has ended (outside the digest). */
            const onPanelClosed = function () {
                if (!closeFinishing || $ctrl.isOpen || destroyed) return;
                closeFinishing = false;
                // The panel is hidden now: its options leave the page and the field lets go of its rows; the search
                // is reset here, so the content does not jump during the fade-out. This component's own state: a
                // digest of its own (one of the whole page here was a long task on a large page, at the end of every
                // close).
                $ctrl.panelReady = false;
                resetSearch();
                tipRowEl = null;
                localDigest();
            };

            /** Called by the panel engine once the panel is shown: bring the active (selected) option into view. */
            const onPanelShown = function () {
                if (!$ctrl.isOpen || !panelElement) return;
                measurePitch();
                revealActive('center-if-hidden');
                checkMore();
            };

            /**
             * Moving the mouse ends the keyboard highlight (a digest only when it was on). Only a real move counts: a
             * browser may send mousemove at the same place when rows change or scroll under a resting pointer.
             */
            let lastPointer = null;
            const onPanelMouse = function (event) {
                const moved = lastPointer !== null && (event.screenX !== lastPointer.x || event.screenY !== lastPointer.y);
                lastPointer = {x: event.screenX, y: event.screenY};
                if (moved && $ctrl.keyboardMode) {
                    $ctrl.keyboardMode = false;
                    localDigest();
                }
            };

            /** The list scrolled: move the scroll window, and ask for the next page near the end. */
            const onPanelScroll = function (event) {
                const el = optionsList();
                if (!el || event.target !== el || scrollFrame !== null) return;
                scrollFrame = window.requestAnimationFrame(() => {
                    scrollFrame = null;
                    if (!$ctrl.isOpen || destroyed) return;
                    if (el.scrollTop > 0) interacted = true;
                    if (virtual && updateWindow(false)) localDigest();
                    checkMore();
                });
            };

            /** Option tooltip, set on hover: the full label, only when the one-line row cuts it off. */
            const onPanelOver = function (event) {
                const target = event.target;
                const li = target && target.closest ? target.closest('li.aui-select__option') : null;
                if (!li || li === tipRowEl) return;
                tipRowEl = li;
                if (kit.isCutOff(li)) li.setAttribute('title', li.textContent.trim());
                else li.removeAttribute('title');
            };

            /** Digest this component only (its list, its tags change nothing outside it; see kit.digestOwn). */
            const localDigest = function () {
                if (destroyed) return;
                if ($scope.$root.$$phase) $scope.$evalAsync(angular.noop);
                else kit.digestOwn($scope);
            };

            // an opening by the user that asks the page: the panel drawn first, the page asked after its first frame
            const pageAsk = kit.createOpening($scope, localDigest);
            let choicePending = false;   // opened before its options: the keyboard goes to the choice when they arrive
            let openUntold = false;      // an opening whose on-open waits for its frame: the page does not know of it yet

            const afterRender = function (fn) {
                $scope.$$postDigest(() => {
                    if (!destroyed) fn();
                });
            };

            /**
             * The first options arrived after the opening (a list loading on open): the keyboard goes to the (first)
             * selected option, which comes into view, as in an opening with the options at hand. Not after a search was
             * typed meanwhile (the user has moved on).
             */
            const showChoiceOnArrival = function () {
                choicePending = false;
                if (String($ctrl.searchQuery || '').trim() !== '' || $ctrl.filteredOptions.length === 0) return;
                const selectedIndex = firstSelectedIndex();
                if (selectedIndex < 0) {
                    if ($ctrl.activeIndex < 0) $ctrl.activeIndex = 0;
                    return;
                }
                $ctrl.activeIndex = selectedIndex;
                // Before the next paint, not right after this digest: the options replace the loading rows through
                // Angular's class changes, which run after this digest; a hidden list cannot scroll.
                afterRender(() => window.requestAnimationFrame(() => {
                    if ($ctrl.isOpen && !destroyed) revealActive('center-if-hidden');
                }));
            };

            /**
             * Touched like a native input: when the user leaves the field or closes the dropdown, not when opening it.
             * A value change marks the model dirty itself ($setViewValue).
             */
            const markTouched = function () {
                const ngModelCtrl = $ctrl.ngModelCtrl;
                if (ngModelCtrl && !ngModelCtrl.$touched) ngModelCtrl.$setTouched();
            };

            // --- Selection Management ---

            /** The option can be picked now (what selectOption checks first): the field takes input, the option is pickable. */
            const canPick = (option) => !$ctrl.disabled && !$ctrl.loading && !$ctrl.isReadonly() && hasOptionKey(option)
                && !$ctrl.isOptionDisabled(option);

            /**
             * Handle option selection
             */
            $ctrl.selectOption = function (option, $event, triggerSource) {
                if ($ctrl.disabled || $ctrl.loading || $ctrl.isReadonly()) return;
                if (!hasOptionKey(option)) {
                    return;
                }
                if ($ctrl.isOptionDisabled(option)) return;
                if ($event) $event.stopPropagation();
                let targetOption = Object.assign({}, option);
                const isSelected = $ctrl.isOptionSelected(targetOption);
                if (!isSelected) {
                    targetOption = angular.copy(targetOption);
                    // An option of a remote list may be gone after the next search: keep it while it is selected.
                    if (dataMode() !== 'static') picked.set(keyOf(targetOption), angular.copy(targetOption));
                }
                if (!targetOption) return;

                let selectedItems = [];
                const ngModelCtrl = $ctrl.ngModelCtrl;
                const oldValue = modelNow();
                // ngModel's trigger name: the only option chosen by the field itself is not the user's
                const modelTrigger = triggerSource === 'programmatic' ? 'programmatic' : 'userInteracted';
                if (ngModelCtrl) {
                    selectedItems = Array.isArray(ngModelCtrl.$viewValue) ? ngModelCtrl.$viewValue.slice() : [];
                    if ($ctrl.multiple) {
                        if (isSelected) {
                            selectedItems = selectedItems.filter(item => item && String(item[$ctrl.valueField]) !== String(targetOption[$ctrl.valueField]));
                        } else {
                            selectedItems.push(targetOption);
                        }
                    } else {
                        selectedItems = [targetOption];
                        if (triggerSource !== 'programmatic') {
                            $ctrl.closeDropdown({restoreFocus: true}); // Close after selection; focus back on the field
                        }

                    }
                    ngModelCtrl.$setViewValue(selectedItems.slice(), modelTrigger);
                    $ctrl.updateUIDataViewValue(modelTrigger);
                }

                $ctrl.checkAndCallOnChangeFunc(triggerSource === 'programmatic' ? 'auto-select'
                    : (triggerSource === 'keyboard' ? 'keyboard' : 'option'), targetOption, oldValue);

                if ($ctrl.isOpen && triggerSource !== 'programmatic') {
                    $ctrl.updatePosition();
                }
            };

            /**
             * Check if an option is selected
             * @param option
             * @returns {boolean}
             */
            /**
             * The index of the first selected option among the rows, -1 if none (with nothing selected the rows are not
             * searched). As isOptionSelected decides, without its work for every row: a long list (148,000 options) was
             * searched from the top at every opening, a value near its end cost 40 ms more each time. selectedKeysSet
             * holds each value as it is and as text: a row's value is found as it is, a number value given as text ("7"
             * for 7) through the numbers of those texts, a true / false given as text as text.
             */
            const firstSelectedIndex = function () {
                const keys = $ctrl.selectedKeysSet;
                if (keys.size === 0) return -1;
                const numbers = new Set();
                keys.forEach(key => {
                    if (typeof key === 'string' && key !== '' && String(Number(key)) === key) numbers.add(Number(key));
                });
                const options = $ctrl.filteredOptions;
                const field = $ctrl.valueField;
                for (let i = 0; i < options.length; i += 1) {
                    const option = options[i];
                    if (option === null || typeof option !== 'object') continue;
                    const value = option[field];
                    if (!isSelectionKey(value)) continue;
                    if (keys.has(value)) return i;
                    const asText = typeof value === 'number' ? numbers.has(value)
                        : (typeof value === 'boolean' && keys.has(String(value)));
                    if (asText) return i;
                }
                return -1;
            };

            $ctrl.isOptionSelected = function (option) {
                return hasOptionKey(option) && ($ctrl.selectedKeysSet.has(option[$ctrl.valueField]) || $ctrl.selectedKeysSet.has(String(option[$ctrl.valueField])));
            };

            /**
             * Check if an option is disabled: its value is in disabled-values, or its disabled-field is true.
             * @param option
             * @returns {boolean}
             */
            $ctrl.isOptionDisabled = function (option) {
                if (!hasOptionKey(option)) return false;
                if ($ctrl.disabledField && option[$ctrl.disabledField] === true) return true;
                return $ctrl.disabledOptionsKeySet.has(option[$ctrl.valueField]) || $ctrl.disabledOptionsKeySet.has(String(option[$ctrl.valueField]));
            };

            /**
             * Remove a tag in multiple selection mode
             */
            $ctrl.removeTag = function (option, $event) {
                if ($ctrl.disabled || $ctrl.loading || $ctrl.isReadonly()) return;
                if (!option) return;
                if ($ctrl.isItemLocked(option)) return;   // a value in disabled-values stays
                if ($event) $event.stopPropagation();

                const ngModelCtrl = $ctrl.ngModelCtrl;
                const oldValue = modelNow();
                if (ngModelCtrl) {
                    ngModelCtrl.$setViewValue(Array.isArray(ngModelCtrl.$viewValue) ? ngModelCtrl.$viewValue.filter(item => item && String(item[$ctrl.valueField]) !== String(option[$ctrl.valueField])).slice() : [], 'userInteracted');
                    $ctrl.updateUIDataViewValue('userInteracted');
                }
                $ctrl.checkAndCallOnChangeFunc('remove-tag', option, oldValue);

                if ($ctrl.isOpen === true) {
                    $ctrl.updatePosition();
                }
            };

            /**
             * Clear all selections. source: the clear button ('clear', the default) or the api ('api').
             */
            $ctrl.clearSelection = function ($event, source) {
                if ($ctrl.disabled || $ctrl.loading || $ctrl.isReadonly()) return;
                if ($event) $event.stopPropagation();
                if (!$ctrl.hasClearable()) return;

                const ngModelCtrl = $ctrl.ngModelCtrl;
                const oldValue = modelNow();
                if (ngModelCtrl) {
                    // Multiple: values in disabled-values stay selected, as in aui-tree-select.
                    const kept = $ctrl.multiple && Array.isArray(ngModelCtrl.$viewValue)
                        ? ngModelCtrl.$viewValue.filter(item => $ctrl.isOptionDisabled(item))
                        : [];
                    ngModelCtrl.$setViewValue(kept, source === 'api' ? 'api' : 'userInteracted');
                    $ctrl.updateUIDataViewValue(source === 'api' ? 'api' : 'userInteracted');
                }
                $ctrl.checkAndCallOnChangeFunc(source || 'clear', null, oldValue);

                if ($ctrl.isOpen === true) {
                    $ctrl.updatePosition();
                }
            };

            /**
             * Keyboard handler for clear button (Enter / Space activation per W3C APG button pattern)
             */
            $ctrl.onClearKeydown = function ($event) {
                if (!$event || $ctrl.disabled || $ctrl.loading || $ctrl.isReadonly()) return;
                const keyCode = $event.keyCode || $event.which;
                if (keyCode === 13 || keyCode === 32 || $event.key === 'Enter' || $event.key === ' ' || $event.key === 'Spacebar') {
                    if ($event.preventDefault) $event.preventDefault();
                    if ($event.stopPropagation) $event.stopPropagation();
                    if (kit.isRepeat($event)) return;   // a held key clears once
                    $ctrl.clearSelection($event);
                    // The button hides once nothing is left to clear: keep the keyboard on the field, not the page.
                    kit.focusQuietly(triggerElement);
                }
            };


            /** The value now, as a copy (an on-change's oldValue: the page cannot change the field's value through it). */
            function modelNow() {
                return $ctrl.ngModelCtrl ? angular.copy($ctrl.ngModelCtrl.$modelValue) : undefined;
            }

            /**
             * The page's on-change, then a native "change" event on the element (kit.reportChange). source: what made
             * the change (kit's triggerSource); option: the option picked or removed (a copy; null for a clear); the
             * value before. The object of the reference form keeps selectedValues as it always was.
             */
            $ctrl.checkAndCallOnChangeFunc = function (source, option, oldValue) {
                const selectedValues = $ctrl.multiple ? $ctrl.selectedItems : $ctrl.selectedItems[0] || null;
                const item = option && typeof option === 'object' ? Object.assign({}, option) : null;
                kit.reportChange($ctrl.onChange, {
                    selectedValues: selectedValues,
                    value: $ctrl.ngModelCtrl ? $ctrl.ngModelCtrl.$modelValue : undefined,
                    oldValue: oldValue,
                    option: item,
                    triggerSource: source
                }, {$items: selectedValues, $option: item, selectedValues: selectedValues}, $element[0], 'aui-select');
            };

            // --- UI Management ---
            /**
             * Toggle dropdown open/closed
             */
            $ctrl.toggleDropdown = function ($event) {
                if ($ctrl.disabled || $ctrl.loading || $ctrl.isReadonly()) return;
                if ($event) $event.stopPropagation();

                if ($ctrl.isOpen) {
                    $ctrl.closeDropdown();
                } else {
                    $ctrl.openDropdown();
                }
            };

            /**
             * Open dropdown
             */
            $ctrl.openDropdown = function () {
                if ($ctrl.isOpen || $ctrl.disabled || $ctrl.isReadonly()) return;

                // A close that is still fading out has not reset the search yet: do it now.
                if (closeFinishing) {
                    closeFinishing = false;
                    resetSearch();
                }

                $ctrl.isOpen = true;
                $ctrl.panelReady = true;
                $ctrl.keyboardMode = false;
                lastPointer = null;
                interacted = false;
                autoFill = 0;
                shownSession = null;
                // What asks the page goes through pageAsk.ask: right after the panel's first frame when the user opens
                // it (kit.createOpening; the placeholder rows meanwhile), at once otherwise. Opening is a natural moment
                // to ask again for labels that were not found before.
                if (lookup && $ctrl.unresolvedCount > 0) {
                    pageAsk.ask(() => {
                        lookup.newRound();
                        $ctrl.refreshViewValueFromModel();
                    });
                }
                if (list) {
                    pageAsk.ask(() => {
                        if (dataMode() === 'paged') onRemoteQuery();
                        ensureList('open');
                    });
                }
                $ctrl.updateFilteredOptions();
                if (dataMode() !== 'static') $ctrl.determineSearchVisibility();
                // The keyboard starts on the (first) selected option, else on the first option.
                const selectedIndex = firstSelectedIndex();
                $ctrl.activeIndex = selectedIndex >= 0 ? selectedIndex : ($ctrl.filteredOptions.length > 0 ? 0 : -1);
                // still loading its list (only the selected values pinned meanwhile): the choice once the list is in
                choicePending = !!list && $ctrl.view.status === 'loading';
                if (panelCtl) panelCtl.open();
                if (dismiss) dismiss.start();

                // Focus the search box once it is rendered
                cancelSearchFocus();
                // (No digest: focusing changes nothing a binding shows.)
                pendingSearchFocus = $timeout(() => {
                    pendingSearchFocus = null;
                    searchElement = $element[0].querySelector('input.aui-select__search-input');
                    if ($ctrl.isOpen && searchElement) searchElement.focus();
                }, 100, false);

                // Trigger open callback
                if ($ctrl.onOpen instanceof Function) {
                    openUntold = true;
                    pageAsk.ask(() => {
                        openUntold = false;
                        $ctrl.onOpen();
                    });
                }
            };

            /**
             * Close dropdown
             */
            $ctrl.closeDropdown = function (options) {
                if (!$ctrl.isOpen) return;
                closePanel(options);
                closeAftermath();
            };

            /** The close itself: the panel goes, the field's own look follows (no page state, no page code). */
            function closePanel(options) {
                pageAsk.flush();   // an opening's calls still waiting for its frame: now (on-open before on-close)
                cancelSearchFocus();
                $ctrl.isOpen = false;
                $ctrl.keyboardMode = false;
                if (searchTimer) {
                    $timeout.cancel(searchTimer);
                    searchTimer = null;
                }
                // Nobody needs the running request any more; the searches are dropped too.
                if (list) list.stop();
                if (dismiss) dismiss.stop();
                if (options && options.restoreFocus && triggerElement && !$ctrl.disabled) kit.focusQuietly(triggerElement);
                if (panelCtl) {
                    // The search is reset when the fade-out has ended (onPanelClosed).
                    closeFinishing = true;
                    panelCtl.close();
                } else {
                    $ctrl.panelReady = false;
                    resetSearch();
                }
            }

            /** What the page sees of a close: the field is touched, on-close. */
            function closeAftermath() {
                markTouched();
                if ($ctrl.onClose instanceof Function) {
                    $ctrl.onClose();
                }
            }

            /**
             * A close from the user's input (a press outside or on the field, Escape, Tab, an option picked in single
             * mode): the panel starts to close now, with a digest of this component only (the caller's settle). The
             * page's code runs at once, in that digest, in the order of every close (closeDropdown, selectOption):
             * touched, on-close, then `then` (the value picked, with ng-change and on-change), each on its own (an
             * exception goes to $exceptionHandler). The page so handles what follows after it, as before: its own click
             * of the same press (even one that removes the field), its keys of the same Enter. (In a digest, ngModel
             * takes the value without a digest of the whole page, and what the page's code starts, as a request, goes
             * out there too.) The page's bindings of it follow in one digest of the whole page (pageDigest): with a
             * value after the close's first frame, without one once the close's motion has ended, so that the field's
             * ring fades out without a stop.
             * On a large page that digest is long: before, the whole close waited for it, and two more page digests
             * followed (onPanelClosed, ng-if's promise).
             */
            function closeFromInput(options, then) {
                if (!$ctrl.isOpen) return;
                closePanel(options);
                markTouched();
                if ($ctrl.onClose instanceof Function) $scope.$evalAsync(() => $ctrl.onClose());
                if (then) $scope.$evalAsync(then);
                pageDigest.owe(!then);
            }


            /**
             * Rows of the panel: the options to show, in order. Static options and a load-all list are filtered here;
             * a paged list comes filtered by the server. With an empty search box, selected values the loaded rows
             * lack are pinned on top (remote lists only), so the selection is always visible.
             */
            const rebuildRows = function () {
                const mode = dataMode();
                const view = {status: '', more: '', stale: false, refreshing: false, timeout: false, minLength: 0, setSize: null, searching: false};
                let base = [];
                if (mode === 'static') {
                    base = (Array.isArray($ctrl.options) ? $ctrl.selectFilter($ctrl.options, $ctrl.searchQuery, $ctrl.labelField) : []) || [];
                } else if (paramsId === null || !list) {
                    view.status = 'off';
                } else if (mode === 'all') {
                    const session = list.plain();
                    if (!session || (session.page === 0 && session.status !== 'error')) {
                        view.status = 'loading';
                    } else if (session.page === 0) {
                        view.status = 'error';
                        view.timeout = session.error === 'timeout';
                    } else {
                        base = $ctrl.selectFilter(session.items, $ctrl.searchQuery, $ctrl.labelField) || [];
                        view.refreshing = session.refreshing;
                    }
                } else {
                    const query = searchText();
                    const min = readMinLength();
                    if (min > 0 && query.length < min) {
                        view.status = 'min-length';
                        view.minLength = min;
                    } else {
                        // Never created while rendering: a list is created when it is asked to load (ensure).
                        const session = list.peek() || {query: list.query(), paramsId: paramsId, page: 0, status: 'empty', items: []};
                        const typing = session.query !== query;
                        if (session.page === 0 && session.status === 'error') {
                            view.status = 'error';
                            view.timeout = session.error === 'timeout';
                        } else if (session.page === 0) {
                            // Nothing for this query yet: keep the previous rows (dimmed) instead of an empty flash.
                            if (shownSession && shownSession !== session && shownSession.paramsId === session.paramsId
                                && shownSession.page > 0) {
                                base = shownSession.items;
                                view.stale = true;
                            } else {
                                view.status = 'loading';
                                view.searching = query !== '';   // "Searching..." instead of placeholder rows
                            }
                        } else {
                            base = session.items;
                            shownSession = session;
                            view.stale = typing;
                            view.refreshing = session.refreshing;
                            if (!session.ended) {
                                view.more = session.status === 'loading' ? 'loading' : (session.status === 'error' ? 'error' : 'idle');
                                view.setSize = -1;   // the total is unknown (ARIA)
                            }
                        }
                    }
                }

                const rows = [];
                const seen = new Set();
                if (mode !== 'static' && searchText() === '' && view.status !== 'off' && view.status !== 'min-length') {
                    const inBase = new Set();
                    base.forEach(item => {
                        const key = keyOf(item);
                        if (key !== null) inBase.add(key);
                    });
                    (Array.isArray($ctrl.selectedItems) ? $ctrl.selectedItems : []).forEach(item => {
                        const key = keyOf(item);
                        if (key === null || inBase.has(key) || seen.has(key)) return;
                        seen.add(key);
                        // A pinned value whose label is still being looked up shows the placeholder, not its raw value.
                        rows.push({uid: 'p' + key, index: rows.length, item: item, cls: ' aui-select__option--pinned', pending: pendingKeys.has(key)});
                    });
                    if (rows.length > 0) rows[rows.length - 1].cls += ' aui-select__option--pinned-last';
                }
                base.forEach((item, i) => {
                    if (mode === 'static') {
                        rows.push({uid: 'i' + i, index: rows.length, item: item, cls: ''});
                        return;
                    }
                    const key = keyOf(item);
                    if (key === null || seen.has(key)) return;
                    seen.add(key);
                    rows.push({uid: 'k' + key, index: rows.length, item: item, cls: ''});
                });
                if (rows.length === 0 && view.status === '' && !view.stale && view.more !== 'loading') view.status = 'empty';
                // A long static list is shown through the scroll window, with only some rows in the page: tell screen
                // readers the whole count and each row's position (aria-setsize / aria-posinset).
                if (mode === 'static' && rows.length > VIRTUAL_MIN_ROWS) view.setSize = rows.length;

                $ctrl.rows = rows;
                $ctrl.filteredOptions = rows.map(row => row.item);
                $ctrl.view = view;
                tipRowEl = null;   // rows are reused for other options: work out tooltips again
                if ($ctrl.activeIndex >= rows.length) $ctrl.activeIndex = rows.length - 1;
                updateWindow(true);
            };

            /**
             * Update filtered options based on search query
             */
            /** A closed field lets go of its rows (see updateFilteredOptions). */
            const releaseRows = function () {
                if ($ctrl.rows.length === 0 && $ctrl.filteredOptions.length === 0) return;
                $ctrl.rows = [];
                $ctrl.filteredOptions = [];
                $ctrl.viewRows = [];
                $ctrl.padTop = 0;
                $ctrl.padBottom = 0;
                $ctrl.activeIndex = -1;
            };

            /**
             * The rows of the panel: built while it is open (on opening, and when its options or search change); a
             * closed field keeps none once its close has faded out. (Before, it kept the rows of its last opening -
             * about 300 KB for 10,000 options - and built all of them again at every close, for the next opening to
             * build them once more.)
             */
            $ctrl.updateFilteredOptions = function () {
                if ($ctrl.isOpen) rebuildRows();
                else if (!$ctrl.panelReady) releaseRows();
            };


            /**
             * Determine if search should be visible
             */
            $ctrl.determineSearchVisibility = function () {
                if ($attrs.hasOwnProperty('searchable')) {
                    $ctrl.showSearch = !($ctrl.searchable === false || $ctrl.searchable === 'false');
                } else if (dataMode() === 'paged') {
                    $ctrl.showSearch = true;   // the size of a paged list is unknown
                } else if (dataMode() === 'all') {
                    // While loading the count is unknown: show it (most remote lists are long), then go by the count.
                    const session = list && paramsId !== null ? list.plain() : null;
                    $ctrl.showSearch = !session || session.page === 0 || session.items.length > $ctrl.DEFAULTS.SEARCH_THRESHOLD;
                } else {
                    // Auto-show search when there are many options
                    $ctrl.showSearch = ($ctrl.options && $ctrl.options.length > $ctrl.DEFAULTS.SEARCH_THRESHOLD) || false;
                }
            };

            /**
             * load-disabled-text, while loading is off (load-enabled false): the panel shows it instead of the list
             * and has no search box. '' when not set or loading is on.
             */
            $ctrl.loadNotice = function () {
                if (!$ctrl.view || $ctrl.view.status !== 'off') return '';
                const text = $ctrl.loadDisabledText;
                return typeof text === 'string' ? text.trim() : '';
            };


            const isSearchInputEvent = function ($event) {
                const target = $event && $event.target;
                return !!(target && target.classList && target.classList.contains('aui-select__search-input'));
            };

            // --- Scroll window over many rows (as in aui-tree-select) ---

            const viewportHeight = function () {
                const el = optionsList();
                return (el && el.clientHeight) || 300;
            };

            /** Rows to render: all of them, or a scroll window plus spacers when there are many. */
            const updateWindow = function (force) {
                const rows = $ctrl.rows;
                if (rows.length <= VIRTUAL_MIN_ROWS) {
                    virtual = false;
                    if (force || $ctrl.viewRows !== rows) {
                        $ctrl.viewRows = rows;
                        $ctrl.padTop = 0;
                        $ctrl.padBottom = 0;
                    }
                    windowStart = 0;
                    windowEnd = rows.length;
                    return true;
                }
                virtual = true;
                const rowPitch = pitch || DEFAULT_ROW_PITCH;
                const el = optionsList();
                const scrollTop = el ? el.scrollTop : 0;
                const start = Math.max(0, Math.floor(scrollTop / rowPitch) - OVERSCAN_ROWS);
                const end = Math.min(rows.length, start + Math.ceil(viewportHeight() / rowPitch) + OVERSCAN_ROWS * 2);
                if (!force && start === windowStart && end === windowEnd) return false;
                windowStart = start;
                windowEnd = end;
                $ctrl.viewRows = rows.slice(start, end);
                $ctrl.padTop = start * rowPitch;
                $ctrl.padBottom = (rows.length - end) * rowPitch;
                return true;
            };

            /** The real row height (rows are one line, so it is the same for all). */
            const measurePitch = function () {
                const el = optionsList();
                if (!el) return;
                const items = el.querySelectorAll('li.aui-select__option');
                if (items.length < 2) return;
                const measured = items[1].offsetTop - items[0].offsetTop;
                if (measured > 0 && Math.abs(measured - pitch) > 0.5) {
                    pitch = measured;
                    if (virtual && updateWindow(true)) localDigest();
                }
            };

            // --- Keyboard and active option (the same model as aui-tree-select) ---

            const optionId = (i) => 'aui-select-options-' + $scope.$id + '-o' + i;
            $ctrl.optionId = optionId;
            $ctrl.activeIndex = -1;
            $ctrl.keyboardMode = false;

            $ctrl.activeOptionId = function () {
                return $ctrl.isOpen && $ctrl.activeIndex >= 0 && $ctrl.activeIndex < $ctrl.filteredOptions.length
                    ? optionId($ctrl.activeIndex) : '';
            };

            const optionsList = () => (panelElement ? panelElement.querySelector('ul.aui-select__options') : null);

            /** Scroll the active option into view (mode: see kit.revealInList). */
            const revealActive = function (mode) {
                const i = $ctrl.activeIndex;
                if (i < 0) return;
                const el = optionsList();
                if (!el) return;
                if (!virtual) {
                    kit.revealInList(el, document.getElementById(optionId(i)), mode);
                    return;
                }
                // Scroll window: the row may not be rendered; place it by the row height.
                const rowPitch = pitch || DEFAULT_ROW_PITCH;
                const top = i * rowPitch;
                const height = el.clientHeight;
                const hidden = top < el.scrollTop || top + rowPitch > el.scrollTop + height;
                if (mode === 'center' || (mode === 'center-if-hidden' && hidden)) {
                    el.scrollTop = Math.max(0, top - (height - rowPitch) / 2);
                } else if (mode === 'nearest') {
                    if (top < el.scrollTop) el.scrollTop = top;
                    else if (top + rowPitch > el.scrollTop + height) el.scrollTop = top + rowPitch - height;
                }
                if (updateWindow(false)) localDigest();
            };

            /** Make option i active; with a mode, scroll it into view once this digest has rendered it. */
            const setActive = function (i, mode) {
                const count = $ctrl.filteredOptions.length;
                $ctrl.activeIndex = count === 0 || i < 0 ? -1 : Math.min(count - 1, i);
                if (mode) {
                    $scope.$$postDigest(() => {
                        if ($ctrl.isOpen) revealActive(mode);
                    });
                }
            };

            const moveActive = function (delta) {
                const count = $ctrl.filteredOptions.length;
                if (count === 0) return;
                let i = $ctrl.activeIndex;
                if (i === -1) i = delta > 0 ? -1 : count;
                setActive(Math.max(0, Math.min(count - 1, i + delta)), 'nearest');
            };

            /** Rows moved by PageUp / PageDown: those that fit in the list, less one. */
            const keyboardPageStep = function () {
                const el = optionsList();
                const first = el ? el.querySelector('li.aui-select__option') : null;
                const rowPitch = (first && first.offsetHeight) || DEFAULT_ROW_PITCH;
                return Math.max(1, Math.floor(((el && el.clientHeight) || 300) / rowPitch) - 1);
            };

            const optionText = function (i) {
                const option = $ctrl.filteredOptions[i];
                const label = option ? option[$ctrl.labelField] : '';
                return (label === undefined || label === null ? '' : String(label)).toLowerCase();
            };

            $ctrl.onOptionClick = function (option, i, $event) {
                $ctrl.activeIndex = i;
                $ctrl.selectOption(option, $event, 'userInteracted');
            };

            $ctrl.onPanelMousedown = function ($event) {
                $ctrl.keyboardMode = false;
                // Keep focus where it is (the field or the search box) while clicking options.
                if ($event && !isSearchInputEvent($event)) $event.preventDefault();
            };

            /** Typing in the search box is keyboard use: the first match gets the keyboard highlight (see pickActive). */
            $ctrl.onSearchTyped = function () {
                $ctrl.keyboardMode = true;
            };

            // --- DOM events and digests ---
            // AngularJS's ng-click / ng-keydown / ng-model digest the whole page for every event: on a big page each
            // digest costs a lot, and the opening animation loses frames. These events are handled here: the whole
            // page is digested only when the handler can change something outside this component (a value, the
            // touched state, a page callback, or page code called through load-options / lookup-options); otherwise
            // only this component is. A close from the user's input runs the page's code at once and digests the page
            // just after it (closeFromInput).

            /** Run fn for a DOM event, then digest the whole page or only this component. */
            const settle = (pageWide, fn) => {
                if ($scope.$root.$$phase) {   // already inside a digest (e.g. a click called by page code)
                    fn();
                    return;
                }
                if (pageWide) {
                    pageDigest.forget();   // this digest of the whole page is the one a close still owes it
                    $scope.$apply(fn);
                    return;
                }
                fn();
                localDigest();
            };

            /**
             * A value checked or unchecked while the panel stays open (several values). The value and the page's code
             * (ng-change, on-change) run at once, in this component's own digest (inside a digest ngModel commits
             * without one of the whole page); the page's digest follows once the picking pauses, or at the first input
             * elsewhere (pageDigest.oweAfterPause): picks one after another are not held up by a digest of a large page
             * after each.
             */
            const pickInPlace = (fn) => {
                if ($scope.$root.$$phase) {   // already inside a digest (page code)
                    fn();
                    return;
                }
                $scope.$evalAsync(fn);
                localDigest();
                pageDigest.oweAfterPause();
            };

            /**
             * What an opening asks of the page now (page code): an on-open callback, labels to look up, a list the page's
             * function has to load (list.wouldLoad). Such an opening digests the page in the press, as it always did, so
             * that a request goes out at once (a fast answer is then in before the panel is seen, which opens once, at its
             * full size). A list loaded and recent asks nothing: reopened, the field opens with its own digest only, as a
             * static one does.
             */
            function openAsksPage() {
                if ($ctrl.onOpen instanceof Function) return true;
                if (lookup && $ctrl.unresolvedCount > 0) return true;
                if (!list || paramsId === null) return false;
                if (dataMode() === 'paged' && list.query() !== searchText()) return true;
                return list.wouldLoad('open');
            }

            const onTriggerClick = (event) => {
                // A close: closeFromInput (the panel at once; touched and on-close in the page's digest after it)
                if ($ctrl.isOpen && !$ctrl.disabled && !$ctrl.loading && !$ctrl.isReadonly()) {
                    if (event) event.stopPropagation();
                    settle(false, () => closeFromInput());
                    return;
                }
                // an opening that asks the page (openAsksPage): the panel first, the page after its first frame (pageAsk;
                // open, but not taking input: nothing)
                if (!$ctrl.isOpen && openAsksPage()) pageAsk.open(() => $ctrl.toggleDropdown(event));
                else settle(false, () => $ctrl.toggleDropdown(event));
            };

            const NAVIGATION_KEYS = Object.freeze({ArrowDown: true, ArrowUp: true, PageDown: true, PageUp: true, Home: true, End: true});

            /**
             * Keys: Escape / Tab / Alt+ArrowUp close, as does Enter / Space picking a value in single mode
             * (closeFromInput: the page's code at once, the page's digest after the close's first frame); Enter /
             * Space on several values: the value at once, the page's digest once the picking pauses (pickInPlace);
             * Enter / Space otherwise: the whole page; an opening key as a click; moving through the list and
             * typeahead change only this component (near the end of a paged list, checkMore asks for the next page and
             * digests the page itself); keys typed into the search box need no digest here (the search box hands the
             * text over itself).
             */
            const onRootKeydown = (event) => {
                const key = event.key;
                const fromSearch = isSearchInputEvent(event);
                let scope = 'none';
                if (!$ctrl.isOpen) {
                    if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 'ArrowDown' || key === 'ArrowUp') {
                        scope = openAsksPage() ? 'opening' : 'own';
                    }
                } else if (key === 'Escape' || key === 'Tab' || (key === 'ArrowUp' && event.altKey)) {
                    scope = 'own';   // a close: closeFromInput
                } else if (key === 'Enter' || ((key === ' ' || key === 'Spacebar') && !fromSearch)) {
                    // a value picked in single mode closes the panel (closeFromInput); several values: in place
                    scope = pickCloses(event) ? 'own' : ($ctrl.multiple ? 'in place' : 'page');
                } else if (NAVIGATION_KEYS[key] || (!fromSearch && key && key.length === 1)) {
                    scope = 'own';
                }
                if (scope === 'none') $ctrl.handleKeydown(event);
                else if (scope === 'in place') pickInPlace(() => $ctrl.handleKeydown(event));
                else if (scope === 'opening') pageAsk.open(() => $ctrl.handleKeydown(event));
                else settle(scope === 'page', () => $ctrl.handleKeydown(event));
            };

            /** Enter / Space would pick the active option and so close the panel (single mode, see pickActive). */
            const pickCloses = (event) => {
                if ($ctrl.multiple || kit.isRepeat(event) || !$ctrl.keyboardMode || $ctrl.view.stale || searchTimer) return false;
                return canPick($ctrl.activeIndex >= 0 ? $ctrl.filteredOptions[$ctrl.activeIndex] : null);
            };

            const onPanelMousedownEvent = (event) => {
                const highlighted = $ctrl.keyboardMode;
                $ctrl.onPanelMousedown(event);
                if (highlighted) localDigest();
            };

            /** A click on an option row (one listener for all rows; aui-select-row keeps each element's row). */
            const onPanelClick = (event) => {
                const li = event.target && event.target.closest ? event.target.closest('li.aui-select__option') : null;
                if (!li || !panelElement || !panelElement.contains(li)) return;
                const row = li.__auiSelectRow;
                if (!row) return;
                // One value (single mode): the panel closes and the value is set now, the page's digest follows after
                // the close's first frame (closeFromInput). Several values: the panel stays, the value is set now and
                // the page's digest follows once the picking pauses (pickInPlace).
                if (!$ctrl.multiple && canPick(row.item)) {
                    event.stopPropagation();
                    settle(false, () => {
                        $ctrl.activeIndex = row.index;
                        closeFromInput({restoreFocus: true}, () => $ctrl.selectOption(row.item, null, 'userInteracted'));
                    });
                    return;
                }
                if ($ctrl.multiple) pickInPlace(() => $ctrl.onOptionClick(row.item, row.index, event));
                else settle(true, () => $ctrl.onOptionClick(row.item, row.index, event));
            };

            /**
             * Text typed into the search box (aui-search-input). A server search starts once typing pauses (its timer
             * digests the page: onRemoteQuery); only a search box emptied asks the page at once (the first page
             * again): the whole page then.
             */
            $ctrl.onSearchText = function (text) {
                const emptied = !!list && dataMode() === 'paged' && list.query() !== '' &&
                    String(text === undefined || text === null ? '' : text).trim() === '';
                settle(emptied, () => {
                    $ctrl.searchQuery = text;
                    $ctrl.onSearchTyped();
                });
            };

            /**
             * Enter / Space pick the active option only when it is plain to see what they act on: the keyboard
             * highlight is on, and the rows answer the search text as it is now (not the dimmed rows of the previous
             * search while the new results are on their way). A held key (auto-repeat) never picks, so it cannot
             * toggle an option on and off. Without the highlight, the first press only shows where the keyboard is.
             */
            const pickActive = function ($event, active) {
                if (kit.isRepeat($event) || !active || $ctrl.view.stale || searchTimer) return;
                if (!$ctrl.keyboardMode) {
                    $ctrl.keyboardMode = true;
                    return;
                }
                if (!$ctrl.multiple && canPick(active)) {
                    closeFromInput({restoreFocus: true}, () => $ctrl.selectOption(active, null, 'keyboard'));
                    return;
                }
                $ctrl.selectOption(active, null, 'keyboard');
            };

            /**
             * Handle keyboard events for accessibility
             */
            $ctrl.handleKeydown = function ($event) {
                if (!$event || $ctrl.disabled || $ctrl.isReadonly()) return;
                // While an input method is composing (e.g. pinyin), Enter, arrows and Escape belong to it.
                if (kit.isComposing($event)) return;
                const key = $event.key;
                const fromSearch = isSearchInputEvent($event);

                if (!$ctrl.isOpen) {
                    if ($ctrl.loading) return;
                    if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 'ArrowDown' || key === 'ArrowUp') {
                        $event.preventDefault();
                        if (kit.isRepeat($event)) return;   // a held key opens once, it does not go on into the panel
                        $ctrl.openDropdown();
                        // Opened from the keyboard: show where the keyboard is at once.
                        if ($ctrl.isOpen) $ctrl.keyboardMode = true;
                    }
                    return;
                }

                interacted = true;
                const active = $ctrl.activeIndex >= 0 ? $ctrl.filteredOptions[$ctrl.activeIndex] : null;
                switch (key) {
                    case 'Escape':
                        // Close only the dropdown, not a surrounding dialog.
                        $event.preventDefault();
                        $event.stopPropagation();
                        closeFromInput({restoreFocus: true});
                        return;
                    case 'Tab':
                        closeFromInput();
                        return;
                    case 'ArrowDown':
                        $event.preventDefault();
                        $ctrl.keyboardMode = true;
                        moveActive(1);
                        return;
                    case 'ArrowUp':
                        $event.preventDefault();
                        if ($event.altKey) {
                            closeFromInput({restoreFocus: true});
                            return;
                        }
                        $ctrl.keyboardMode = true;
                        moveActive(-1);
                        return;
                    case 'PageDown':
                    case 'PageUp':
                        $event.preventDefault();
                        $ctrl.keyboardMode = true;
                        moveActive(key === 'PageDown' ? keyboardPageStep() : -keyboardPageStep());
                        return;
                    case 'Home':
                    case 'End':
                        if (fromSearch) return;
                        $event.preventDefault();
                        $ctrl.keyboardMode = true;
                        setActive(key === 'Home' ? 0 : $ctrl.filteredOptions.length - 1, 'nearest');
                        return;
                    case 'Enter':
                        // Never submit a surrounding form from inside the dropdown.
                        $event.preventDefault();
                        pickActive($event, active);
                        return;
                    case ' ':
                    case 'Spacebar':
                        if (fromSearch) return;   // a space typed into the search box
                        $event.preventDefault();
                        pickActive($event, active);
                        return;
                    case 'Backspace':
                    case 'Delete':
                        // Only edit the search text. A selection is removed only by its own x, the clear button or
                        // unchecking its row: a held or extra Backspace after the text is gone must never remove one.
                        return;
                    default:
                        if (!fromSearch && key && key.length === 1 && !$event.ctrlKey && !$event.metaKey && !$event.altKey) {
                            $ctrl.keyboardMode = true;
                            const i = typeahead(key, $ctrl.filteredOptions.length, $ctrl.activeIndex, optionText);
                            if (i >= 0) setActive(i, 'nearest');
                        }
                }
            };

            // --- api ---

            function bindApi() {
                unbindApi();
                const target = $ctrl.api;
                if (!target || typeof target !== 'object') return;
                const methods = {
                    open: function () { $scope.$evalAsync(() => $ctrl.openDropdown()); },
                    close: function () { $scope.$evalAsync(() => $ctrl.closeDropdown()); },
                    toggle: function () { $scope.$evalAsync(() => ($ctrl.isOpen ? $ctrl.closeDropdown() : $ctrl.openDropdown())); },
                    focus: function () { if (triggerElement) triggerElement.focus(); },
                    /** Load the options again (e.g. after the page created one), and look up missing labels again. */
                    reload: function () {
                        $scope.$evalAsync(() => {
                            if (list && paramsId !== null) {
                                shownSession = null;
                                // Closed and nothing needs the list now: forget it; the next open loads it fresh.
                                if ($ctrl.isOpen || readPreload()) list.reload();
                                else list.drop();
                            }
                            if (lookup) lookup.newRound();
                            $ctrl.refreshViewValueFromModel();
                            if ($ctrl.isOpen) rebuildRows();
                        });
                    },
                    clear: function () { $scope.$evalAsync(() => $ctrl.clearSelection(null, 'api')); },
                    getSelectedItems: function () { return angular.copy($ctrl.selectedItems || []); }
                };
                Object.keys(methods).forEach(name => { target[name] = methods[name]; });
                installedApi = {target: target, methods: methods};
            }

            function unbindApi() {
                if (!installedApi) return;
                const target = installedApi.target;
                const methods = installedApi.methods;
                Object.keys(methods).forEach(name => {
                    if (target[name] === methods[name]) delete target[name];
                });
                installedApi = null;
            }

            /**
             * Cleanup resources. Runs on $destroy — important to cancel ALL pending $timeouts
             * so they don't fire on a torn-down component (which would either no-op silently
             * or, worse, touch detached DOM).
             */
            $ctrl.cleanup = function () {
                destroyed = true;
                pageAsk.cancel();
                pageDigest.forget();
                cancelSearchFocus();
                pendingAutoSelects.forEach(pendingAutoSelect => $timeout.cancel(pendingAutoSelect));
                pendingAutoSelects.clear();
                if (searchTimer) {
                    $timeout.cancel(searchTimer);
                    searchTimer = null;
                }
                if (scrollFrame !== null) {
                    window.cancelAnimationFrame(scrollFrame);
                    scrollFrame = null;
                }
                // Close-time work (onClose) applies only when the panel is open.
                // (removed before its on-open ran: the page never knew it opened, so no on-close either)
                if ($ctrl.isOpen) {
                    $ctrl.isOpen = false;
                    if ($ctrl.onClose instanceof Function && !openUntold) {
                        try { $ctrl.onClose(); } catch (e) { console.error('Error in aui-select on-close:', e); }
                    }
                }
                if (list) {
                    list.destroy();
                    list = null;
                }
                if (lookup) {
                    lookup.destroy();
                    lookup = null;
                }
                unbindApi();
                if (panelCtl) {
                    panelCtl.destroy();
                    panelCtl = null;
                }
                if (tagFit) {
                    tagFit.destroy();
                    tagFit = null;
                }
                if (dismiss) {
                    dismiss.stop();
                    dismiss = null;
                }
                if (stopFocusLeave) {
                    stopFocusLeave();
                    stopFocusLeave = null;
                }
                if (panelElement) {
                    panelElement.removeEventListener('mousemove', onPanelMouse);
                    panelElement.removeEventListener('mousedown', onPanelMousedownEvent);
                    panelElement.removeEventListener('click', onPanelClick);
                    panelElement.removeEventListener('scroll', onPanelScroll, true);
                    panelElement.removeEventListener('mouseover', onPanelOver);
                }
                if (stopTriggerPress) {
                    stopTriggerPress();
                    stopTriggerPress = null;
                }
                if (stopQuietFocus) {
                    stopQuietFocus();
                    stopQuietFocus = null;
                }
                if (stopLabelTip) {
                    stopLabelTip();
                    stopLabelTip = null;
                }
                $element[0].removeEventListener('keydown', onRootKeydown);
                closeFinishing = false;
                // AngularJS 1.5 keeps the watchers of a destroyed child scope, and ng-repeat keeps its last scope (and
                // so this controller): remove our watchers and let go of the option data.
                ownWatchers.splice(0).forEach(stop => stop());
                $ctrl.filteredOptions = [];
                $ctrl.rows = [];
                $ctrl.viewRows = [];
                $ctrl.options = null;
                $ctrl.valueOptions = null;
                picked.clear();
                valueOptionsByKey = new Map();
                shownSession = null;
                triggerElement = panelElement = searchElement = hiddenInputElement = tipRowEl = null;
            };

            // Watch for search changes
            own.$watch(() => $ctrl.searchQuery, (query, previous) => {
                if (dataMode() === 'paged') onRemoteQuery();
                $ctrl.updateFilteredOptions();
                // Typing in the search box puts the keyboard on the first match.
                if (query !== previous && $ctrl.isOpen) {
                    interacted = true;
                    const el = optionsList();
                    if (el) el.scrollTop = 0;
                    setActive(0, 'nearest');
                }
            });


            $ctrl.selectFilter = function (options, searchQuery, labelField) {
                if (!options || !Array.isArray(options) || !searchQuery) return options;
                if (options.length === 0) return options;
                if (!labelField) return options;

                const query = searchQuery.toLowerCase();
                return options.filter(option => {
                    if (!option) return false;
                    const label = option[labelField];
                    // Numeric labels are matched by their text instead of throwing; other non-string labels never match.
                    const labelText = typeof label === 'number' ? String(label) : label;
                    return typeof labelText === 'string' && labelText.toLowerCase().indexOf(query) !== -1;
                });
            }


        }],
        template: ` <div class="aui-select"
                         ng-class="{
                             'aui-select--open': $ctrl.isOpen,
                             'aui-select--disabled': $ctrl.disabled,
                             'aui-select--readonly': $ctrl.isReadonly(),
                             'aui-select--small': $ctrl.field.size() === 'small',
                             'aui-select--large': $ctrl.field.size() === 'large',
                             'aui-select--label-top': $ctrl.field.isLabelTop()
                         }"
                         style="min-width: 100px;--aui-select-border-radius: {{$ctrl.borderRadiusStyleVal}};">


                        <!-- Hidden native input for browser required validation -->
                        <input
                            type="text"
                            name="{{ $ctrl.name }}"
                            ng-required="$ctrl.required"
                            class="aui-select__hidden-input"
                            tabindex="-1"
                            aria-hidden="true"
                            autocomplete="off"
                        >

                        <!-- label-position="top": the label above the box; a press on it gives the field the focus -->
                        <div class="aui-field-label"
                             aui-if="$ctrl.showLabel && $ctrl.labelText && $ctrl.field.isLabelTop()"
                             ng-click="$ctrl.focusFromLabel()">{{$ctrl.labelText}}</div>

                        <!-- Trigger/Input -->
                        <div class="aui-select__trigger"
                             id="{{$ctrl.compId}}"
                             ng-class="{'aui-select__trigger--multiple': $ctrl.multiple,
                                        'aui-select__trigger--required': $ctrl.required,
                                        'aui-select__trigger--clearable': $ctrl.clearable && $ctrl.hasClearable() && !$ctrl.disabled && !$ctrl.loading && !$ctrl.isReadonly(),
                                        'aui-select__trigger--busy': $ctrl.loading,
                                        'aui-select__trigger--invalid': $ctrl.showInvalid()}"
                             tabindex="{{ $ctrl.disabled ? -1 : 0 }}"
                             role="combobox"
                             aria-expanded="{{$ctrl.isOpen}}"
                             aria-haspopup="listbox"
                             aria-label="{{ $ctrl.labelText || $ctrl.placeholder || $ctrl.t.placeholder }}"
                             aria-required="{{ $ctrl.required }}"
                             aria-disabled="{{ !!$ctrl.disabled }}"
                             aria-readonly="{{ $ctrl.isReadonly() }}"
                             aria-invalid="{{ $ctrl.showInvalid() }}"
                             aria-busy="{{ !!($ctrl.labelsPending || $ctrl.loading) }}"
                             aria-controls="aui-select-options-{{ ::$id }}"
                             ng-attr-aria-describedby="{{ $ctrl.field.messageId() }}"
                             ng-attr-aria-activedescendant="{{ $ctrl.activeOptionId() || undefined }}">

                            <div class="aui-control-label"
                                 aui-if="$ctrl.showLabel && $ctrl.labelText && !$ctrl.field.isLabelTop()">{{$ctrl.labelText}}</div>


                            <div class="aui-select__selected-display">
                                <!-- Tags for multiple selection -->
                                <div class="aui-select__tags" aui-if="$ctrl.multiple && $ctrl.selectedItems.length > 0"
                                     ng-class="{'aui-select__tags--responsive': $ctrl.tagsResponsive()}">
                                    <div class="aui-select__tag" ng-repeat="item in $ctrl.selectedItems | limitTo: $ctrl.visibleTagLimit() track by $index"
                                         ng-class="{'aui-select__tag--locked': $ctrl.isItemLocked(item)}"
                                         title="{{ $ctrl.isPendingItem(item) ? '' : $ctrl.itemLabel(item) }}">
                                        <span class="aui-select__tag-text" aui-if="!$ctrl.isPendingItem(item)">{{ $ctrl.itemLabel(item) }}</span>
                                        <span class="aui-select__tag-text aui-select__pending" aui-if="$ctrl.isPendingItem(item)" aria-label="{{ ::$ctrl.t.loading }}"></span>
                                        <span class="aui-select__tag-remove"
                                              aui-if="!$ctrl.isItemLocked(item)"
                                              ng-click="$ctrl.removeTag(item, $event)"
                                              aria-label="{{ $ctrl.t.remove.split('{label}').join($ctrl.itemLabel(item)) }}"></span>
                                    </div>
                                    <!-- Selected items beyond max-tag-count, collapsed into one count -->
                                    <div class="aui-select__tag aui-select__tag--count"
                                         aui-if="$ctrl.hiddenTagCount() > 0"
                                         title="{{ $ctrl.hiddenTagTitle() }}">+{{ $ctrl.hiddenTagCount() }}</div>
                                </div>
                                <!-- max-tag-count="responsive": the hidden copy of the tags it measures is plain DOM (kit.createTagFit) -->

                                <!-- Placeholder -->
                                <span class="aui-select__placeholder"
                                      aui-if="!($ctrl.selectedKeysSet.size > 0)">
                                    {{ $ctrl.placeholder || '' }}
                                </span>
                                <!-- Selected Display text (a placeholder bar while its label is being looked up) -->
                                <span class="aui-select__display-text"
                                      title="{{ $ctrl.displayPending ? '' : ($ctrl.displayText || '') }}"
                                      aui-if="($ctrl.multiple !== true && $ctrl.selectedKeysSet.size > 0)">
                                    <span class="aui-select__pending" aui-if="$ctrl.displayPending" aria-label="{{ ::$ctrl.t.loading }}"></span>{{ $ctrl.displayPending ? '' : ($ctrl.displayText || '') }}
                                </span>

                            </div>


                            <!-- Clear button -->
                            <span class="aui-control-clear"
                                  aui-if="$ctrl.clearable"
                                  ng-class="{'aui-control-clear--hidden': !$ctrl.hasClearable() || $ctrl.disabled || $ctrl.loading || $ctrl.isReadonly()}"
                                  ng-click="$ctrl.clearSelection($event)"
                                  ng-mousedown="$event.preventDefault()"
                                  ng-keydown="$ctrl.onClearKeydown($event)"
                                  tabindex="{{ (!$ctrl.hasClearable() || $ctrl.disabled || $ctrl.loading || $ctrl.isReadonly()) ? -1 : 0 }}"
                                  role="button"
                                  aria-label="{{ ::$ctrl.t.clearSelection }}"
                                  title="{{ ::$ctrl.t.clearAll }}">
                                <svg class="aui-control-clear-svg" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle class="aui-control-clear-bg" cx="10" cy="10" r="10"/>
                                    <path class="aui-control-clear-cross" d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke-linecap="round"/>
                                </svg>
                            </span>

                            <!-- Chevron Icon (mask-image via CSS); while loading, a spinner in its place -->
                            <i class="aui-select__chevron" aria-hidden="true"></i>
                            <span class="aui-select__busy" aria-hidden="true" aui-if="$ctrl.loading"></span>
                        </div>

                        <!-- Dropdown Panel -->
                        <div class="aui-select__panel"
                             id="aui-select-options-{{ ::$id }}"
                             ng-class="{'aui-select__panel--multiple': $ctrl.multiple, 'aui-select__panel--keyboard': $ctrl.keyboardMode}"
                             ng-style="$ctrl.panelStyle"
                             aria-multiselectable="{{ !!$ctrl.multiple }}"
                             role="listbox">

                            <!-- The list is being updated: a server search (with the spinner in the search box) or a background refresh -->
                            <div class="aui-select__progress" aria-hidden="true"
                                 aui-if="$ctrl.panelReady && ($ctrl.searching() || $ctrl.view.refreshing)"></div>

                            <!-- Search (none while loading is off with a load-disabled-text: nothing to search) -->
                            <div class="aui-select__search" aui-if="$ctrl.showSearch && !$ctrl.loadNotice()"
                                 ng-class="{'aui-select__search--busy': $ctrl.searching()}">
                                <i class="aui-select__search-icon" aria-hidden="true"></i>
                                <span class="aui-select__spinner aui-select__search-spinner" aria-hidden="true" aui-if="$ctrl.searching()"></span>
                                <input type="text"
                                       id="aui-select__search-input-{{ ::$id }}"
                                       class="aui-select__search-input"
                                       aui-search-input="$ctrl.searchQuery"
                                       aui-search-input-change="$ctrl.onSearchText($text)"
                                       aui-search-input-stop-click
                                       placeholder="{{ $ctrl.searchPlaceholder !== undefined ? $ctrl.searchPlaceholder : $ctrl.t.search }}"
                                       aria-label="{{ ::$ctrl.t.searchLabel }}"
                                       aria-controls="aui-select-options-{{ ::$id }}"
                                       aria-autocomplete="list"
                                       ng-attr-aria-activedescendant="{{ $ctrl.activeOptionId() || undefined }}"
                                       autocomplete="off"
                                       spellcheck="false">
                            </div>

                            <!-- Loading state -->
                            <div class="aui-select__loading" aui-if="$ctrl.loading">
                                <div class="aui-select__spinner"></div>
                                <span style="margin-left: 8px;">{{ ::$ctrl.t.loadingList }}</span>
                            </div>

                            <!-- Options list: in the page only while the panel is shown -->
                            <ul class="aui-select__options aui-scroll" aui-if="$ctrl.panelReady && !$ctrl.loading"
                                ng-class="{'aui-select__options--stale': $ctrl.view.stale}"
                                aria-busy="{{ !!($ctrl.view.status === 'loading' || $ctrl.view.more === 'loading' || $ctrl.view.stale) }}">
                                <li class="aui-select__spacer" role="none"
                                    aui-if="$ctrl.padTop > 0"
                                    ng-style="{height: $ctrl.padTop + 'px'}"></li>
                                <!-- aui-select-row sets the row's id, classes and ARIA state; the panel has one click listener -->
                                <li class="aui-select__option" role="option"
                                    ng-repeat="row in $ctrl.viewRows track by row.uid"
                                    aui-select-row="row">
                                    <span aui-highlight-text="row.item[$ctrl.labelField]" aui-highlight-query="$ctrl.searchQuery"
                                          aui-highlight-pending="row.pending"></span>
                                </li>
                                <li class="aui-select__spacer" role="none"
                                    aui-if="$ctrl.padBottom > 0"
                                    ng-style="{height: $ctrl.padBottom + 'px'}"></li>

                                <!-- First load: placeholder rows; a search with nothing to show yet: "Searching..." -->
                                <li class="aui-select__no-results aui-select__searching" role="status"
                                    aui-if="$ctrl.view.status === 'loading' && $ctrl.view.searching"><span class="aui-select__spinner" aria-hidden="true"></span><span>{{ ::$ctrl.t.searching }}</span></li>
                                <li class="aui-select__skeleton" role="none" aria-hidden="true"
                                    ng-repeat="n in ($ctrl.view.status === 'loading' && !$ctrl.view.searching ? $ctrl.skeleton : []) track by n">
                                    <span class="aui-select__pending" ng-style="{width: (78 - n * 14) + '%'}"></span>
                                </li>
                                <!-- Paged lists: the next page -->
                                <li class="aui-select__status" role="status" aui-if="$ctrl.view.more === 'loading'">
                                    <span class="aui-select__spinner" aria-hidden="true"></span><span>{{ ::$ctrl.t.loadingMore }}</span>
                                </li>
                                <li class="aui-select__status aui-select__status--retry" role="none"
                                    aui-if="$ctrl.view.more === 'error'"
                                    ng-click="$ctrl.retryLoad($event)">{{ ::$ctrl.t.moreFailed }} <span class="aui-select__retry-link">{{ ::$ctrl.t.retry }}</span></li>
                                <li class="aui-select__no-results aui-select__status--retry" role="none"
                                    aui-if="$ctrl.view.status === 'error'"
                                    ng-click="$ctrl.retryLoad($event)">{{ $ctrl.view.timeout ? $ctrl.t.timeout : $ctrl.t.failed }} <span class="aui-select__retry-link">{{ ::$ctrl.t.retry }}</span></li>
                                <li class="aui-select__no-results" role="none"
                                    aui-if="$ctrl.view.status === 'min-length'">{{ $ctrl.t.minLength.replace('{n}', $ctrl.view.minLength) }}</li>
                                <!-- Loading is off (load-enabled false): what to do first -->
                                <li class="aui-select__notice" role="status" aui-if="$ctrl.loadNotice()">
                                    <span class="aui-select__notice-icon" aria-hidden="true"></span><span class="aui-select__notice-text">{{ $ctrl.loadNotice() }}</span>
                                </li>
                                <!-- No results -->
                                <li class="aui-select__no-results" role="none"
                                    aui-if="$ctrl.view.status === 'empty' || ($ctrl.view.status === 'off' && !$ctrl.loadNotice())">
                                    {{ $ctrl.emptyText || $ctrl.t.empty }}
                                </li>
                            </ul>
                        </div>

                        <!-- The message line under the field (hint-text, error-text, error-messages, show-errors) -->
                        <div class="aui-field-message"
                             aui-if="$ctrl.field.hasMessageLine()"
                             id="{{ $ctrl.field.messageId() }}"
                             aria-live="polite"
                             ng-class="{'aui-field-message--error': $ctrl.field.messageIsError()}"><span aui-if="!$ctrl.field.messageIsError()">{{ $ctrl.field.messageText() }}</span><span aui-if="$ctrl.field.messageIsError()" class="aui-field-message__error">{{ $ctrl.field.messageText() }}</span></div>
                    </div>`
    })

    /**
     * One option row of aui-select (an li of its ng-repeat): its id, classes and ARIA state, from one watcher. In the
     * template that took a dozen bindings per row (class, id, ng-class, aria-*), and two ng-if blocks and an ng-click
     * handler, all built again for every row on every opening. The row object is kept on the element
     * (__auiSelectRow) for the panel's one click listener.
     */
    .directive('auiSelectRow', ['$parse', function ($parse) {
        const SELECTED = 'aui-select__option--selected';
        const DISABLED = 'aui-select__option--disabled';
        const ACTIVE = 'aui-select__option--active';

        function tokens(cls) {
            return cls ? cls.split(' ').filter(Boolean) : [];
        }

        return {
            restrict: 'A',
            require: '^auiSelect',
            link: function (scope, element, attrs, select) {
                const el = element[0];
                const getRow = $parse(attrs.auiSelectRow);
                let next = null;    // the state to show (from the watch)
                let version = 0;
                let shown = {};     // the state shown
                scope.$watch(function () {
                    const row = getRow(scope);
                    if (!row) return version;
                    const size = select.view && select.view.setSize ? select.view.setSize : 0;
                    const selected = select.isOptionSelected(row.item);
                    const disabled = select.isOptionDisabled(row.item);
                    const active = row.index === select.activeIndex;
                    if (!next || next.row !== row || next.index !== row.index || next.cls !== (row.cls || '') ||
                        next.selected !== selected || next.disabled !== disabled || next.active !== active || next.size !== size) {
                        next = {row: row, index: row.index, cls: row.cls || '', selected: selected, disabled: disabled,
                            active: active, size: size};
                        version += 1;
                    }
                    return version;
                }, function () {
                    const state = next;
                    if (!state) return;
                    el.__auiSelectRow = state.row;
                    if (state.index !== shown.index) el.id = select.optionId(state.index);
                    if (state.cls !== shown.cls) {
                        tokens(shown.cls).forEach(function (c) { el.classList.remove(c); });
                        tokens(state.cls).forEach(function (c) { el.classList.add(c); });
                    }
                    if (state.selected !== shown.selected) {
                        el.classList.toggle(SELECTED, state.selected);
                        el.setAttribute('aria-selected', String(state.selected));
                    }
                    if (state.disabled !== shown.disabled) {
                        el.classList.toggle(DISABLED, state.disabled);
                        el.setAttribute('aria-disabled', String(state.disabled));
                    }
                    if (state.active !== shown.active) el.classList.toggle(ACTIVE, state.active);
                    if (state.size !== shown.size || state.index !== shown.index) {
                        // a long static list (scroll window) or a paged one (-1: total unknown): the count for screen readers
                        if (state.size) {
                            el.setAttribute('aria-setsize', String(state.size));
                            el.setAttribute('aria-posinset', String(state.index + 1));
                        } else {
                            el.removeAttribute('aria-setsize');
                            el.removeAttribute('aria-posinset');
                        }
                    }
                    shown = state;
                });
                scope.$on('$destroy', function () { el.__auiSelectRow = null; });
            }
        };
    }]);
