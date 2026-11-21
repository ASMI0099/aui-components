/**
 * aui-tree-select: one or several values from a tree, static or loaded level by level.
 */
angular.module('aui')
    .component('auiTreeSelect', {
        require: {
            ngModelCtrl: 'ngModel'
        },
        bindings: {
            options: '<?',                   // Tree data: nested (children-field) or flat (parent-field)
            selectedItems: '=?',             // Output: copies of the selected data items (children left out)
            multiple: '<?',
            maxTagCount: '<?',               // Multiple: show at most this many tags, then one "+N" tag
            name: '@?',
            labelText: '@?',
            compId: '@?',
            placeholder: '@?',
            disabled: '<?',
            readonly: '<?',                  // The value shows, the field takes the focus, nothing opens or changes
            disabledValues: '<?',            // Values whose nodes are disabled (Array)
            loading: '<?',
            searchable: '<?',                // Default: shown when the tree has more than 5 nodes
            clearable: '<?',
            showLabel: '<?',
            autoSelectOnSingleRequired: '<?',
            borderRounded: '<?',
            borderRoundedLeftNone: '<?',
            borderRoundedRightNone: '<?',
            labelField: '@?',                // default 'label'
            valueField: '@?',                // default 'id'
            childrenField: '@?',             // default 'children'
            parentField: '@?',               // Flat data: the field holding the parent's value
            disabledField: '@?',             // default 'disabled'
            selectableField: '@?',           // false in this field marks a group: shown, never picked (default: none)
            leafField: '@?',                 // Lazy data: true marks a node without children; default 'isLeaf'
            checkStrictly: '<?',             // Multiple: parents and children are checked independently
            valueStrategy: '@?',             // Multiple, linked checking: 'all' (default) | 'parent' | 'child'
            leafOnly: '<?',                  // Single: only leaf nodes can be selected
            showPath: '<?',                  // Show the selected node as its full path ("A / B / C")
            showLine: '<?',                  // Guide lines connecting the levels
            pathSeparator: '@?',             // default ' / '
            defaultExpandLevel: '@?',        // Levels open when data first arrives: a number, or all
            panelMinWidth: '@?',             // Minimum dropdown width in px (default: the trigger width)
            searchPlaceholder: '@?',
            emptyText: '@?',
            selectedLabels: '<?',            // {value: label} for selected values that are not loaded yet
            dropDownPositionStrategy: '@?',  // 'fixed' (default) | 'absolute'
            dropDownPanelBackgroundOpacity: '@?', // OPAQUE_LIKE | FULL
            api: '<?',                       // Object that receives methods: open, close, expandAll, reload, ...
            loadChildren: '&?',              // Lazy children: load-children="fn($node, $level, $value)" -> array or promise
            filterMethod: '&?',              // Custom search: filterMethod({$node, $query, $label}) -> boolean
            remoteSearch: '&?',              // Server-side search: remote-search="fn($query, $signal, $cancel)" -> nodes or {items, total}
            searchDelay: '@?',               // ms after the last keystroke before a server-side search starts (default 300)
            // Options from the server (auiRemoteData), as in aui-select. load-options loads the whole tree for the
            // current load-params; load-children and remote-search receive the params as $params.
            loadOptions: '&?',               // load-options="fn($request)" -> nodes (nested or flat) or {items}
            loadParams: '<?',                // What the data depends on, e.g. {storeId: vm.form.storeId}; compared by value
            loadEnabled: '<?',               // false: nothing is loaded yet
            loadDisabledText: '@?',          // Shown in the panel instead of the tree while load-enabled is false
            cacheTtl: '@?',                  // ms the loaded tree is reused before a background refresh (default 60000)
            loadTimeout: '@?',               // ms before a request counts as failed (default: no timeout)
            preload: '<?',                   // Load as soon as loading is enabled instead of on the first open
            valueOptions: '<?',              // Options the page already has for the current value(s)
            lookupEnabled: '<?',             // Look up selected values the tree has not loaded (needs load-options or lookup-options)
            lookupOptions: '&?',             // lookup-options="fn($request)": nodes or root-to-node chains for $request.values
            lookupGroup: '@?',               // Components with the same group send their lookups as one request
            resetOnParams: '@?',             // 'clear': clear the value when load-params change while the value stays
            revealSelected: '<?',            // Single, lazy tree: on open, load the branches down to a looked-up value
            onChange: '&?',                  // "fn" (called with one object: selectedValues, value, oldValue, node,
                                             // triggerSource, byUser) or "fn($value, $oldValue, $nodes, $node,
                                             // $triggerSource, $byUser)"
            onOpen: '&?',
            onClose: '&?',
            onExpand: '&?',                  // "fn($node, $expanded)"
            hintText: '@?',                  // the message line under the field: a hint (see auiFieldExtras)
            errorText: '@?',                 // the message line: one text for any failed check, while the field shows invalid
            errorMessages: '<?',             // the message line: a text per check, {required: '...'}
            showErrors: '<?',                // the message line with the shared texts (auiFieldMessages); off by default
            size: '@?',                      // "small" (28px) or "large" (40px); unset: 34px
            labelPosition: '@?'              // "top": the label above the box, instead of in it
        },
        controller: ['$scope', '$element', '$attrs', '$q', '$timeout', '$parse', 'auiControlKit', 'auiDropdownPanel', 'auiTreeEngine', 'auiRemoteData', 'auiFieldExtras', 'auiTexts',
            function ($scope, $element, $attrs, $q, $timeout, $parse, kit, dropdownPanel, engine, remoteData, fieldExtras, texts) {
            const $ctrl = this;
            const T = texts.list;
            $ctrl.t = T;
            const ROOT_SID = engine.ROOT_SID;

            // the message line, size and label-position (shared with aui-input and aui-select)
            $ctrl.field = fieldExtras.create({
                ctrl: $ctrl,
                attrs: $attrs,
                ngModel: () => $ctrl.ngModelCtrl,
                invalidShown: () => $ctrl.showInvalid(),
                id: () => ($ctrl.ids && $ctrl.ids.trigger) || ('tree-' + $scope.$id)
            });
            const VIRTUAL_MIN_ROWS = 80;      // render a scroll window above this many visible rows
            const OVERSCAN_ROWS = 8;
            const DEFAULT_ROW_PITCH = 33;     // px, until the real row height is measured (32px rows, 1px apart)
            const SEARCH_DEBOUNCE_MIN_NODES = 2000;
            const SEARCH_DEBOUNCE_MS = 120;
            const REMOTE_SEARCH_DELAY_MS = 300;
            const TYPEAHEAD_RESET_MS = 600;
            const AUTO_SELECT_DELAY_MS = 1000; // same delay as aui-select
            const HEIGHT_ANIMATION_MS = 220;   // panel resize; same duration and easing as the open animation (CSS)
            const LOADING_FADE_OUT_MS = 160;
            const DEFAULT_CACHE_TTL_MS = 60000;
            const MORE_MARGIN_PX = 200;        // a "Load more" row this close to the visible area loads by itself
            const EMPTY_FIELDS = Object.freeze({value: 'id', label: 'label', children: 'children', disabled: 'disabled', leaf: 'isLeaf'});

            let ngm = null;
            let initialized = false;
            let destroyed = false;
            let fields = null;
            let index = engine.build([], EMPTY_FIELDS);
            let lastOptionsRef;
            let defaultExpandApplied = false;
            let disabledValueKeys = new Set();
            let reportedWarnings = new Set();

            // Selection. Multiple: checked/half hold node keys. Unknown: model values that match no loaded node.
            const selection = {selectedKey: null, checked: new Set(), half: new Set(), unknown: []};
            let lastViewSignature = '';
            let lastItemsSignature = null;

            // Tree view state.
            const expanded = new Set();
            let searchState = null;
            let searchQueryUsed = '';
            let searchOpen = new Set();
            let searchClosed = new Set();
            let enterParents = new Set();
            // Children on demand. pending: sid -> request in flight ({promise, stop}); more: sid -> state of children
            // that come in pages ({page, cursor, total, loading, error}).
            const lazy = {pending: new Map(), loaded: new Map(), errors: new Set(), timeouts: new Set(), more: new Map()};
            // Server-side search: the result tree of the current query, shown instead of the tree while it is set.
            // raw / index: the result data and its index; keys: values in the result; parents: values that have
            // children in the result; pending: the request in flight ({query, cancel, controller}).
            const remote = {query: '', text: '', raw: null, index: null, keys: null, parents: null, total: null, matched: 0,
                pending: null, error: false, timer: null};
            // Values picked from search results that the tree has not loaded: their item, label, path and ancestor
            // keys, for tags, the trigger text, selected-items and the half state of their ancestors.
            const remembered = new Map();
            // Options from the server: the whole tree per params (load-options) and lookups of selected values.
            let list = null;
            let lookup = null;
            let paramsId = '{}';               // params key; null while loading is not enabled
            let valueOptionsByKey = new Map(); // value-options as known entries
            let pendingKeys = new Set();       // selected values whose label is being looked up
            let knownVersion = 0;              // changes whenever a label source changes (selected-items is rebuilt then)
            let unresolvedCount = 0;
            let moreRowIndexes = [];           // positions of the "Load more" rows in $ctrl.rows
            let revealRun = 0;
            // The paths to the choice (openChoicePaths): an opening before the data opens them once the first rows
            // arrive (choicePending); a value the page sets starts the next opening from its paths (freshPaths).
            let choicePending = false;
            let freshPaths = false;
            let openUntold = false;   // an opening whose on-open waits for its frame: the page does not know of it yet
            const warnedOnce = {};
            const domIds = new Map();
            let domSeq = 0;
            let rowIndex = new Map();
            let rowsByDomId = new Map();
            let tipRowEl = null;
            let virtual = false;
            let pitch = 0;
            let windowStart = -1;
            let windowEnd = -1;

            // DOM and timers.
            let rootEl = null;
            let triggerEl = null;
            let stopTriggerPress = null;
            let stopQuietFocus = null;
            let stopLabelTip = null;
            let panelEl = null;
            let listEl = null;
            let hiddenInputEl = null;
            let panelCtl = null;
            let scrollFrame = null;
            let searchTimer = null;
            let autoSelectTimer = null;
            let heightTimer = null;
            let heightFrame = null;
            const typeahead = kit.createTypeahead(TYPEAHEAD_RESET_MS);
            let installedApi = null;
            let dismiss = null;
            let stopFocusLeave = null;
            let tagFit = null;
            let tagFitCount = Infinity;      // max-tag-count="responsive": tags that fit on one line
            let pickSource = 'option';       // what a pick being handled is made with: 'option' (pointer), 'keyboard'
            let hiddenTitleCache = null;
            // The digest of the whole page that a close from the user's input owes it (closeFromInput,
            // kit.createPageDigest)
            const pageDigest = kit.createPageDigest($scope, function () { return $element[0]; });
            // Watchers this component registers, removed on destroy (AngularJS 1.5 keeps the watcher list of a
            // destroyed child scope, and with it the watched data).
            const ownWatchers = [];
            const own = {
                $watch: function (getter, listener, deep) {
                    const stop = $scope.$watch(getter, listener, deep);
                    ownWatchers.push(stop);
                    return stop;
                },
                $watchCollection: function (getter, listener) {
                    const stop = $scope.$watchCollection(getter, listener);
                    ownWatchers.push(stop);
                    return stop;
                }
            };

            const opt = {};
            $ctrl.opt = opt;
            $ctrl.isOpen = false;
            $ctrl.searchQuery = '';
            $ctrl.rows = [];
            $ctrl.viewRows = [];
            $ctrl.padTop = 0;
            $ctrl.padBottom = 0;
            $ctrl.tags = [];
            $ctrl.hasValue = false;
            $ctrl.displayText = '';
            $ctrl.displayTitle = '';
            $ctrl.activeSid = null;
            $ctrl.keyboardMode = false;
            $ctrl.radius = kit.borderRadius(true, false, false);
            $ctrl.panelStyle = null;

            const baseId = 'aui-tree-select-' + $scope.$id;
            $ctrl.ids = {
                trigger: baseId,
                panel: baseId + '-panel',
                tree: baseId + '-tree'
            };

            // ------------------------------------------------------------------ options and flags

            function readFields() {
                fields = {
                    value: $ctrl.valueField || 'id',
                    label: $ctrl.labelField || 'label',
                    children: $ctrl.childrenField || 'children',
                    parent: $ctrl.parentField || null,
                    disabled: $ctrl.disabledField || 'disabled',
                    selectable: $ctrl.selectableField || null,
                    leaf: $ctrl.leafField || 'isLeaf'
                };
            }

            function readOptions() {
                opt.multiple = kit.readFlag($attrs, 'multiple', $ctrl.multiple, false);
                opt.disabled = kit.readFlag($attrs, 'disabled', $ctrl.disabled, false);
                opt.readonly = kit.readFlag($attrs, 'readonly', $ctrl.readonly, false);
                opt.loading = kit.readFlag($attrs, 'loading', $ctrl.loading, false);
                opt.clearable = kit.readFlag($attrs, 'clearable', $ctrl.clearable, false);
                opt.showLabel = kit.readFlag($attrs, 'showLabel', $ctrl.showLabel, false);
                opt.autoSelectOnSingleRequired = kit.readFlag($attrs, 'autoSelectOnSingleRequired', $ctrl.autoSelectOnSingleRequired, false);
                opt.checkStrictly = kit.readFlag($attrs, 'checkStrictly', $ctrl.checkStrictly, false);
                opt.leafOnly = kit.readFlag($attrs, 'leafOnly', $ctrl.leafOnly, false);
                opt.showPath = kit.readFlag($attrs, 'showPath', $ctrl.showPath, false);
                opt.showLine = kit.readFlag($attrs, 'showLine', $ctrl.showLine, false);
                opt.searchable = kit.readFlag($attrs, 'searchable', $ctrl.searchable, null);
                const strategy = String($ctrl.valueStrategy || '').trim().toLowerCase();
                opt.strategy = (strategy === 'parent' || strategy === 'child') ? strategy : 'all';
                const level = String($ctrl.defaultExpandLevel === undefined || $ctrl.defaultExpandLevel === null ? '' : $ctrl.defaultExpandLevel).trim().toLowerCase();
                opt.expandLevel = level === 'all' ? Infinity
                    : (level !== '' && Number(level) >= 0 ? Math.floor(Number(level)) : 0);
                opt.positionStrategy = $ctrl.dropDownPositionStrategy === 'absolute' ? 'absolute' : 'fixed';
                const minWidth = parseFloat($ctrl.panelMinWidth);
                opt.panelMinWidth = Number.isFinite(minWidth) && minWidth > 0 ? minWidth : 0;
                $ctrl.radius = kit.borderRadius(
                    kit.readFlag($attrs, 'borderRounded', $ctrl.borderRounded, true),
                    kit.readFlag($attrs, 'borderRoundedLeftNone', $ctrl.borderRoundedLeftNone, false),
                    kit.readFlag($attrs, 'borderRoundedRightNone', $ctrl.borderRoundedRightNone, false));
                $ctrl.panelStyle = kit.panelBackgroundStyle($ctrl.dropDownPanelBackgroundOpacity);
            }

            function cascade() {
                return opt.multiple && !opt.checkStrictly;
            }

            function hasLoader() {
                return typeof $ctrl.loadChildren === 'function';
            }

            function hasListLoader() {
                return typeof $ctrl.loadOptions === 'function';
            }

            /** Loading is enabled (load-enabled) for the current params. */
            function loadReady() {
                return paramsId !== null;
            }

            function readNumber(raw, fallback) {
                const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
                return Number.isFinite(n) && n >= 0 ? n : fallback;
            }

            function readTimeout() {
                return readNumber($ctrl.loadTimeout, 0);
            }

            function readTtl() {
                return readNumber($ctrl.cacheTtl, DEFAULT_CACHE_TTL_MS);
            }

            function readPreload() {
                return kit.readFlag($attrs, 'preload', $ctrl.preload, false);
            }

            function paramsSnapshot() {
                return angular.copy($ctrl.loadParams);
            }

            /** Lookups run with lookup-enabled (through load-options) or lookup-options (on unless lookup-enabled="false"). */
            function lookupActive() {
                if (!lookup) return false;
                const dedicated = typeof $ctrl.lookupOptions === 'function';
                if (!kit.readFlag($attrs, 'lookupEnabled', $ctrl.lookupEnabled, dedicated)) return false;
                return dedicated || hasListLoader();
            }

            function warnOnce(text) {
                if (warnedOnce[text]) return;
                warnedOnce[text] = true;
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('aui-tree-select (' + ($ctrl.name || $ctrl.ids.trigger) + '): ' + text);
                }
            }

            /** A raw node's value as a string, or null when it has none. */
            function rawKey(raw) {
                return raw !== null && typeof raw === 'object' && kit.isSelectionKey(raw[fields.value]) ? String(raw[fields.value]) : null;
            }

            function rawLabel(raw) {
                const label = raw ? raw[fields.label] : undefined;
                return label === undefined || label === null ? String(raw ? raw[fields.value] : '') : String(label);
            }

            // Angular's own required state (required / ng-required), as the required validator sees it.
            $ctrl.isRequired = function () {
                return !!$attrs.required;
            };

            /** label-position="top": a press on the label gives the field the focus, as a label does (nothing opens). */
            $ctrl.focusFromLabel = function () {
                if (triggerEl && !$ctrl.opt.disabled) triggerEl.focus();
            };

            function isDisabled(node) {
                return node.disabled || (node.key !== null && disabledValueKeys.has(node.key));
            }

            function isLeafNode(node) {
                return node.children !== null && node.children.length === 0;
            }

            // Single mode: can this node become the value? (A group never can.)
            function isSelectable(node) {
                return node.key !== null && !node.group && !isDisabled(node) && (!opt.leafOnly || isLeafNode(node));
            }

            // Multiple mode: does this node get a checkbox? (Disabled nodes keep a disabled checkbox; groups get none.)
            function isCheckable(node) {
                return node.key !== null && !node.group && (cascade() || !opt.leafOnly || isLeafNode(node));
            }

            // Groups (selectable-field) with nothing to check below them: no child that is enabled and not such a
            // group, and the children are known. Memo per node; a change of disabled-values starts it over.
            let inertGroups = new WeakMap();

            function isInertGroup(node) {
                if (!node.group) return false;
                if (inertGroups.has(node)) return inertGroups.get(node);
                // Post-order without recursion: a group's answer needs those of the groups below it.
                const stack = [node];
                while (stack.length) {
                    const current = stack[stack.length - 1];
                    if (inertGroups.has(current)) {
                        stack.pop();
                        continue;
                    }
                    let inert = Array.isArray(current.children);   // unknown children (lazy) may hold something
                    const open = [];
                    for (let i = 0; inert && i < (current.children || []).length; i += 1) {
                        const child = current.children[i];
                        if (isDisabled(child)) continue;
                        if (!child.group) inert = false;
                        else if (!inertGroups.has(child)) open.push(child);
                        else if (!inertGroups.get(child)) inert = false;
                    }
                    if (inert && open.length > 0) {
                        open.forEach(function (child) { stack.push(child); });
                        continue;
                    }
                    inertGroups.set(current, inert);
                    stack.pop();
                }
                return inertGroups.get(node);
            }

            /**
             * Linked checking: nodes that keep their own state and pass no checks through. Disabled nodes, and groups
             * with nothing to check below them (they would keep a parent from ever counting as fully checked). Other
             * groups take part like any parent: checks pass through them, but their own value is never picked.
             */
            function conductDisabled(node) {
                return isDisabled(node) || (node.group && isInertGroup(node));
            }

            function reportWarnings(warnings) {
                warnings.forEach(function (message) {
                    if (reportedWarnings.has(message)) return;
                    reportedWarnings.add(message);
                    if (typeof console !== 'undefined' && console.warn) {
                        console.warn('aui-tree-select (' + ($ctrl.name || $ctrl.ids.trigger) + '): ' + message);
                    }
                });
            }

            // ------------------------------------------------------------------ data

            function rootData() {
                if (hasListLoader()) {
                    const session = list && loadReady() ? list.plain() : null;
                    return session && session.page > 0 ? session.items : [];
                }
                const options = $ctrl.options;
                if (Array.isArray(options) && (options.length > 0 || !hasLoader())) return options;
                return lazy.loaded.get(ROOT_SID) || (Array.isArray(options) ? options : []);
            }

            function rebuildIndex() {
                index = engine.build(rootData(), fields, {lazy: hasLoader(), loaded: lazy.loaded});
                reportWarnings(index.warnings);
                if (!defaultExpandApplied && index.nodes.length > 0) {
                    defaultExpandApplied = true;
                    applyDefaultExpand();
                }
                const entering = enterParents;   // rows that cascade in now (rebuildRows starts a new set)
                renderFromView();
                showChoiceOnArrival(entering);
                if (remote.raw) refreshResultIndex();
                else if (searchState && !hasRemoteSearch()) runSearch();
                scheduleAutoSelect();
            }

            function applyDefaultExpand() {
                if (opt.expandLevel <= 0) return;
                index.nodes.forEach(function (node) {
                    if (node.depth < opt.expandLevel && node.children && node.children.length > 0) expanded.add(node.sid);
                });
            }

            function onOptionsChange(newValue) {
                if (hasListLoader()) {
                    if (Array.isArray(newValue)) warnOnce('options and load-options are both set; load-options is used');
                    return;
                }
                if (newValue !== lastOptionsRef) {
                    // A new data set: on-demand children of the old one no longer apply.
                    lastOptionsRef = newValue;
                    resetLazy();
                }
                rebuildIndex();
            }

            /** Forget every child loaded on demand (and stop the loads still running). */
            function resetLazy() {
                lazy.pending.forEach(function (handle) { handle.stop(); });
                lazy.pending.clear();
                lazy.more.forEach(function (more) { if (more.loading) more.loading.stop(); });
                lazy.more.clear();
                lazy.loaded.clear();
                lazy.errors.clear();
                lazy.timeouts.clear();
            }

            /** The request for children of a node (null: the top level), page 1 or a later one. */
            function childRequest(node, page, cursor) {
                return {
                    reason: page > 1 ? 'more' : (node ? 'children' : 'roots'),
                    node: node ? node.raw : null,
                    level: node ? node.depth + 1 : 0,
                    value: node ? node.value : null,
                    page: page,
                    cursor: cursor,
                    params: paramsSnapshot()
                };
            }

            /**
             * The answer of a page function, passed on as it is. A function as the answer means the attribute names
             * the function without calling it (load-options="vm.load"): it still counts as a failed load; the warning
             * says how to write it.
             */
            function pageAnswer(attribute, example, answer) {
                if (typeof answer === 'function') {
                    warnOnce(attribute + ' gave back a function instead of data: call it in the attribute, e.g. ' + example);
                }
                return answer;
            }

            function callLoader(request) {
                return remoteData.call(function (req) {
                    return pageAnswer('load-children', 'load-children="vm.loadChildren($request)"',
                        $ctrl.loadChildren({$node: req.node, $level: req.level, $value: req.value, $params: req.params, $request: req}));
                }, request, readTimeout());
            }

            /**
             * A children answer: an array is all of them; {items, hasMore | nextCursor | total} may continue in pages.
             * Returns {items, ended, cursor, total} (ended judged against `loaded` items already there), or null.
             */
            function readChildren(answer, loaded) {
                const read = remoteData.readAnswer(answer);
                if (!read) return null;
                let ended = true;
                if (!Array.isArray(answer) && read.items.length > 0) {
                    if (read.hasMore !== null) ended = !read.hasMore;
                    else if (read.hasCursor) ended = read.cursor === null || read.cursor === undefined || read.cursor === '';
                    else if (read.total !== null) ended = loaded + read.items.length >= read.total;
                }
                return {items: read.items, ended: ended, cursor: read.hasCursor ? read.cursor : undefined, total: read.total};
            }

            function loadChildren(node) {
                if (!hasLoader() || destroyed || !loadReady()) return;
                const sid = node ? node.sid : ROOT_SID;
                if (lazy.pending.has(sid)) return;
                lazy.errors.delete(sid);
                lazy.timeouts.delete(sid);
                lazy.more.delete(sid);
                if (pageAsk.queuing()) {
                    loadAfterFrame(node, sid);
                    rebuildRows();
                    return;
                }
                const handle = callLoader(childRequest(node, 1, undefined));
                lazy.pending.set(sid, handle);
                handle.promise.then(function (answer) {
                    if (destroyed || lazy.pending.get(sid) !== handle) return;   // reloaded, replaced or destroyed
                    const read = readChildren(answer, 0);
                    if (!read) {
                        warnOnce('load-children answered neither an array nor {items: [...]}');
                        failChildren(node, sid, null);
                        return;
                    }
                    if (!node) fadeOutLoadingBlock();
                    (node ? withHeightAnimation : withFirstRows)(function () {
                        lazy.pending.delete(sid);
                        lazy.loaded.set(sid, read.items.slice());
                        if (!read.ended) lazy.more.set(sid, {page: 1, cursor: read.cursor, total: read.total, loading: null, error: false});
                        enterParents.add(sid);
                        rebuildIndex();
                    });
                    if ($ctrl.isOpen && panelCtl) panelCtl.update();
                    afterRender(checkMoreRows);
                }, function (error) {
                    if (destroyed || lazy.pending.get(sid) !== handle || (error && error.stopped)) return;
                    if (handle.timedOut()) lazy.timeouts.add(sid);
                    failChildren(node, sid, error);
                });
                rebuildRows();
            }

            /**
             * A branch opened by the user (pageAsk): it shows its loading row now; load-children (page code) is called
             * right after that frame, in the page's digest. The stand-in handle follows the real load (its promise
             * settles with it; stopped, it ends the wait: resetLazy, a reload).
             */
            function loadAfterFrame(node, sid) {
                const done = $q.defer();
                const stand = {
                    promise: done.promise,
                    stop: function () { done.reject({stopped: true}); },
                    timedOut: function () { return false; }
                };
                lazy.pending.set(sid, stand);
                pageAsk.ask(function () {
                    if (destroyed || lazy.pending.get(sid) !== stand) return;   // stopped, reloaded or replaced meanwhile
                    lazy.pending.delete(sid);
                    loadChildren(node);
                    const real = lazy.pending.get(sid);
                    if (real) real.promise.then(done.resolve, done.reject);
                    else done.reject({stopped: true});
                });
            }

            function failChildren(node, sid, error) {
                if (error && typeof console !== 'undefined' && console.warn) console.warn('aui-tree-select: loading children failed', error);
                if (!node) fadeOutLoadingBlock();
                withHeightAnimation(function () {
                    lazy.pending.delete(sid);
                    lazy.errors.add(sid);
                    rebuildRows();
                });
            }

            /** The next page of a node's children (its "Load more" row); null: the top level. */
            function loadMoreChildren(node) {
                const sid = node ? node.sid : ROOT_SID;
                const more = lazy.more.get(sid);
                if (!more || more.loading || destroyed || !loadReady()) return;
                more.error = false;
                const handle = callLoader(childRequest(node, more.page + 1, more.cursor));
                more.loading = handle;
                handle.promise.then(function (answer) {
                    if (destroyed || lazy.more.get(sid) !== more || more.loading !== handle) return;
                    more.loading = null;
                    const current = lazy.loaded.get(sid) || [];
                    const read = readChildren(answer, current.length);
                    if (!read) {
                        warnOnce('load-children answered neither an array nor {items: [...]}');
                        more.error = true;
                        rebuildRows();
                        return;
                    }
                    const seen = new Set();
                    current.forEach(function (raw) {
                        const key = rawKey(raw);
                        if (key !== null) seen.add(key);
                    });
                    const next = current.slice();
                    let added = 0;
                    read.items.forEach(function (raw) {
                        const key = rawKey(raw);
                        if (key !== null && seen.has(key)) return;
                        if (key !== null) seen.add(key);
                        next.push(raw);
                        added += 1;
                    });
                    let ended = read.ended;
                    if (read.total !== null) ended = next.length >= read.total;
                    if (!ended && added === 0) {
                        ended = true;
                        warnOnce('a page of children brought only nodes that were already loaded; check that the page ' +
                            'parameter reaches the server');
                    }
                    more.page += 1;
                    more.cursor = read.cursor;
                    more.total = read.total;
                    lazy.loaded.set(sid, next);
                    if (ended) lazy.more.delete(sid);
                    withHeightAnimation(rebuildIndex);
                    if ($ctrl.isOpen && panelCtl) panelCtl.update();
                    afterRender(checkMoreRows);
                }, function (error) {
                    if (destroyed || lazy.more.get(sid) !== more || more.loading !== handle || (error && error.stopped)) return;
                    more.loading = null;
                    more.error = true;
                    if (typeof console !== 'undefined' && console.warn) console.warn('aui-tree-select: loading more children failed', error);
                    rebuildRows();
                });
                rebuildRows();
            }

            /** A "Load more" row near the visible part of the list loads by itself. */
            function checkMoreRows() {
                if (!$ctrl.isOpen || destroyed || !listEl || moreRowIndexes.length === 0) return;
                const top = listEl.scrollTop;
                const bottom = top + listEl.clientHeight + MORE_MARGIN_PX;
                const rowPitch = pitch || DEFAULT_ROW_PITCH;
                moreRowIndexes.forEach(function (i) {
                    const row = $ctrl.rows[i];
                    if (!row || !row.more) return;
                    const more = lazy.more.get(row.moreSid);
                    if (!more || more.loading || more.error) return;
                    const el = virtual ? null : document.getElementById(row.domId);
                    const y = virtual ? i * rowPitch : (el ? el.offsetTop : Infinity);
                    if (y >= top - rowPitch && y <= bottom) {
                        $scope.$evalAsync(function () { loadMoreChildren(row.node); });
                    }
                });
            }

            function listSession() {
                return hasListLoader() && list && loadReady() ? list.plain() : null;
            }

            $ctrl.rootLoading = function () {
                if (index.nodes.length > 0) return false;
                // asked for right after the panel's first frame (an opening by the user: kit.createOpening)
                if (pageAsk.waiting()) return true;
                if (lazy.pending.has(ROOT_SID)) return true;
                const session = listSession();
                return !!session && session.page === 0 && session.status === 'loading';
            };

            $ctrl.rootError = function () {
                if (index.nodes.length > 0) return false;
                if (lazy.errors.has(ROOT_SID)) return true;
                const session = listSession();
                return !!session && session.page === 0 && session.status === 'error';
            };

            $ctrl.rootTimeout = function () {
                if (lazy.timeouts.has(ROOT_SID)) return true;
                const session = listSession();
                return !!session && session.error === 'timeout';
            };

            $ctrl.retryRoot = function ($event) {
                if ($event) $event.stopPropagation();
                if (hasListLoader()) {
                    if (list && list.retry()) rebuildRows();
                    return;
                }
                loadChildren(null);
            };

            // ------------------------------------------------------------------ options from the server

            function setUpRemoteData() {
                const listMode = hasListLoader();
                if (listMode) {
                    list = remoteData.createList({
                        load: function (request) {
                            return pageAnswer('load-options', 'load-options="vm.loadTree($request)"', $ctrl.loadOptions({$request: request}));
                        },
                        keyOf: rawKey,
                        pageSize: function () { return 0; },   // a tree loads at once (children may still come on demand)
                        timeoutMs: readTimeout,
                        ttlMs: readTtl,
                        // A background refresh rebuilds the tree: only while nobody is looking at it.
                        canReplace: function () { return !$ctrl.isOpen; },
                        onUpdate: onTreeListUpdate,
                        // after the page's digest the answer arrives in (one pass of it, not two); what the page shows
                        // of this field (its model, validity, selected-items) still gets that digest when it changes
                        deliver: kit.createDelivery($scope, function () {
                            return ngm ? [ngm.$viewValue, ngm.$modelValue, ngm.$valid, ngm.$pending, Object.keys(ngm.$error).join(','), $ctrl.selectedItems]
                                : [$ctrl.selectedItems];
                        }),
                        warn: warnOnce
                    });
                }
                if (listMode || typeof $ctrl.lookupOptions === 'function') {
                    lookup = remoteData.createLookup({
                        run: function (request) {
                            return typeof $ctrl.lookupOptions === 'function'
                                ? pageAnswer('lookup-options', 'lookup-options="vm.paths($request)"', $ctrl.lookupOptions({$request: request}))
                                : pageAnswer('load-options', 'load-options="vm.loadTree($request)"', $ctrl.loadOptions({$request: request}));
                        },
                        keyOf: rawKey,
                        scan: scanLookup,
                        chunkSize: function () { return 100; },
                        timeoutMs: readTimeout,
                        paramsFor: paramsSnapshot,
                        blocked: function () {
                            return typeof $ctrl.lookupOptions !== 'function' && (!loadReady() || (!!list && list.busy()));
                        },
                        group: function () {
                            return $ctrl.lookupGroup
                                ? $ctrl.lookupGroup + '\n' + (typeof $ctrl.lookupOptions === 'function' ? '' : String(paramsId))
                                : '';
                        },
                        onUpdate: function () {
                            knownVersion += 1;
                            renderFromView();
                            // A value's chain arrived after the panel opened: reveal it now.
                            if ($ctrl.isOpen) revealSelected();
                        },
                        warn: warnOnce
                    });
                }
                if (listMode || $attrs.loadParams !== undefined || $attrs.loadEnabled !== undefined) {
                    own.$watch(function () {
                        return kit.readFlag($attrs, 'loadEnabled', $ctrl.loadEnabled, true) ? remoteData.paramsKey($ctrl.loadParams) : null;
                    }, onTreeParamsChange);
                }
                if ($attrs.resetOnParams === 'clear' && $attrs.ngModel) {
                    const getValue = $parse($attrs.ngModel);
                    const reset = remoteData.paramsResetWatch(function () {
                        return remoteData.paramsKey($ctrl.loadParams);
                    }, function () {
                        return kit.readFlag($attrs, 'loadEnabled', $ctrl.loadEnabled, true);
                    }, function () {
                        return getValue($scope.$parent);
                    }, function () {
                        selection.selectedKey = null;
                        selection.checked = new Set();
                        selection.half = new Set();
                        selection.unknown = [];
                        commitSelection(null, 'params-reset');
                    });
                    own.$watch(reset.watch, reset.listener);
                }
            }

            function onTreeParamsChange(id, previous) {
                if (destroyed) return;
                const changed = id !== previous;
                paramsId = id;
                if (list) list.configure(id, id === null ? null : $ctrl.loadParams);
                if (changed) {
                    // Another data set: what was loaded for the old params no longer applies.
                    resetLazy();
                    expanded.clear();
                    defaultExpandApplied = false;
                    choicePending = $ctrl.isOpen;   // the new data shows the choice when it arrives
                    // Search results of the old params no longer apply; a typed query runs again on the new data.
                    clearRemote();
                    if (lookup) lookup.newRound();
                    rebuildIndex();
                    if ($ctrl.isOpen && hasRemoteSearch() && normalizedQuery()) onRemoteQuery();
                }
                if (lookup) lookup.kick();
                if (id !== null && ($ctrl.isOpen || readPreload())) {
                    if (list) ensureTreeList($ctrl.isOpen ? 'params' : 'preload');
                    else if (hasLoader() && $ctrl.isOpen && index.nodes.length === 0 && !lazy.loaded.has(ROOT_SID)) loadChildren(null);
                }
                if ($ctrl.isOpen) rebuildRows();
            }

            function ensureTreeList(reason) {
                if (!list || !loadReady()) return;
                list.ensure(reason);
                if ($ctrl.isOpen) rebuildRows();
            }

            function onTreeListUpdate(session, info) {
                if (destroyed) return;
                if (info.page === 1 && !info.error && session.page > 0) {
                    if ($ctrl.isOpen) fadeOutLoadingBlock();
                    withFirstRows(function () {
                        enterParents.add(ROOT_SID);
                        rebuildIndex();
                    });
                } else {
                    if ($ctrl.isOpen) fadeOutLoadingBlock();
                    rebuildRows();
                }
                if (lookup) lookup.kick();
                if ($ctrl.isOpen && panelCtl) panelCtl.update();
            }

            /**
             * A lookup answer: nodes (nested trees are walked), or root-to-node chains (arrays) that also give the
             * path and the ancestors of the value.
             */
            function scanLookup(answer) {
                const read = remoteData.readAnswer(answer);
                if (!read) return null;
                const out = new Map();
                const visit = function (raw, chain) {
                    if (!raw || typeof raw !== 'object') return;
                    const key = rawKey(raw);
                    if (key !== null && !out.has(key)) out.set(key, {item: raw, chain: chain});
                    const kids = raw[fields.children];
                    if (Array.isArray(kids)) kids.forEach(function (kid) { visit(kid, chain.concat([raw])); });
                };
                read.items.forEach(function (entry) {
                    if (Array.isArray(entry)) {
                        const node = entry[entry.length - 1];
                        const key = rawKey(node);
                        if (key !== null && !out.has(key)) out.set(key, {item: node, chain: entry.slice(0, -1)});
                    } else {
                        visit(entry, []);
                    }
                });
                return out;
            }

            /** What a lookup found, in the shape of a remembered value: {item, label, path, ancestors (nearest first)}. */
            function lookupEntry(key) {
                const found = lookup ? lookup.found(key) : null;
                if (!found) return null;
                if (!found.entry) {
                    const chain = found.chain || [];
                    const labels = chain.map(rawLabel).concat([rawLabel(found.item)]);
                    found.entry = {
                        item: copyItem(found.item),
                        label: rawLabel(found.item),
                        path: labels.join($ctrl.pathSeparator || ' / '),
                        ancestors: chain.map(rawKey).filter(function (k) { return k !== null; }).reverse()
                    };
                }
                return found.entry;
            }

            /** What is known about a value the tree has not loaded: picked from a search, value-options, a lookup. */
            function knownEntry(value) {
                const key = String(value);
                return remembered.get(key) || valueOptionsByKey.get(key) || lookupEntry(key) || null;
            }

            function hasSelectedLabel(key) {
                const labels = $ctrl.selectedLabels;
                return !!labels && typeof labels === 'object' && Object.prototype.hasOwnProperty.call(labels, key)
                    && labels[key] !== undefined && labels[key] !== null;
            }

            /**
             * After each render: keep lookups only for selected values, and find labels for the unknown values no
             * source knows (a lookup, or the whole tree from load-options).
             */
            function syncLabels() {
                const keys = new Set(viewValues().map(String));
                if (lookup) lookup.retain(keys);
                const unresolved = new Map();
                selection.unknown.forEach(function (value) {
                    const key = String(value);
                    if (!knownEntry(value) && !hasSelectedLabel(key)) unresolved.set(key, value);
                });
                unresolvedCount = unresolved.size;
                if (lookupActive()) lookup.want(unresolved);
                else if (unresolved.size > 0 && hasListLoader()) ensureTreeList('values');
                pendingKeys = new Set();
                if (lookup) {
                    unresolved.forEach(function (value, key) {
                        if (lookup.pending(key)) pendingKeys.add(key);
                    });
                }
                $ctrl.labelsPending = pendingKeys.size > 0;
            }

            /**
             * reveal-selected (single, lazy tree): on open, load the branches down to a selected value the tree has not
             * loaded yet, along its known ancestors, then show it.
             */
            function revealSelected() {
                if (opt.multiple || !hasLoader() || !kit.readFlag($attrs, 'revealSelected', $ctrl.revealSelected, false)) return;
                if (selection.selectedKey !== null || selection.unknown.length !== 1) return;
                const value = selection.unknown[0];
                const entry = knownEntry(value);
                if (!entry || !entry.ancestors || entry.ancestors.length === 0) return;
                const chain = entry.ancestors.slice().reverse();   // root first
                const run = revealRun += 1;
                const waitFor = function (sid, next) {
                    const handle = lazy.pending.get(sid);
                    if (!handle) {
                        next();
                        return;
                    }
                    handle.promise.then(function () { $scope.$evalAsync(next); }, angular.noop);
                };
                const step = function (i) {
                    if (run !== revealRun || !$ctrl.isOpen || destroyed) return;
                    if (i >= chain.length) {
                        const node = index.byKey.get(String(value));
                        if (!node) return;
                        revealNode(node);
                        rebuildRows();
                        if (rowIndex.has(node.sid)) setActiveIndex(rowIndex.get(node.sid), true);
                        return;
                    }
                    const node = index.byKey.get(chain[i]);
                    if (!node) return;   // the chain does not match this tree
                    expanded.add(node.sid);
                    if (node.children === null) {
                        loadChildren(node);
                        waitFor(node.sid, function () { step(i + 1); });
                    } else {
                        rebuildRows();
                        step(i + 1);
                    }
                };
                waitFor(ROOT_SID, function () { step(0); });
            }

            // ------------------------------------------------------------------ ngModel

            function formatModel(modelValue) {
                if (opt.multiple) {
                    return Array.isArray(modelValue) ? modelValue.filter(kit.isSelectionKey) : [];
                }
                return kit.isSelectionKey(modelValue) ? [modelValue] : [];
            }

            function parseView(viewValue) {
                const values = Array.isArray(viewValue) ? viewValue : [];
                if (opt.multiple) return values.slice();
                return values.length > 0 ? values[0] : '';
            }

            function viewValues() {
                return Array.isArray(ngm.$viewValue) ? ngm.$viewValue : [];
            }

            function signature(values) {
                return values.map(function (value) { return typeof value + ':' + String(value); }).join('\u0001');
            }

            /** Rebuild selection state from the current $viewValue against the current index (never writes the model). */
            function renderFromView() {
                const values = viewValues();
                lastViewSignature = signature(values);
                applyValues(values);
                forgetUnselected(new Set(values.map(String)));
                rememberLoadedValues();
                syncLabels();
                refreshSelectionView();
                rebuildRows();
            }

            /** Selection state from a list of values, against the current index (never writes the model). */
            function applyValues(values) {
                const known = [];
                const unknown = [];
                const seen = new Set();
                values.forEach(function (value) {
                    const key = String(value);
                    if (seen.has(key)) return;
                    seen.add(key);
                    if (index.byKey.has(key)) known.push(key);
                    else unknown.push(value);
                });
                if (opt.multiple) {
                    if (cascade()) {
                        const conducted = engine.conductCheck(index, new Set(known), conductDisabled);
                        selection.checked = conducted.checked;
                        selection.half = conducted.half;
                    } else {
                        selection.checked = new Set(known);
                        selection.half = new Set();
                    }
                    selection.selectedKey = null;
                    selection.unknown = unknown;
                } else {
                    selection.selectedKey = known.length > 0 ? known[0] : null;
                    selection.unknown = known.length === 0 && unknown.length > 0 ? [unknown[0]] : [];
                    selection.checked = new Set();
                    selection.half = new Set();
                }
            }

            /**
             * Re-run formatters and validators for a model array changed in place (push/splice): ngModel only watches
             * the reference. Mirrors ngModelWatch, which validates without writing the model back.
             */
            function refreshFromModel() {
                const modelValue = ngm.$modelValue;
                let viewValue = modelValue;
                for (let i = ngm.$formatters.length - 1; i >= 0; i -= 1) viewValue = ngm.$formatters[i](viewValue);
                if (typeof ngm.$$updateEmptyClasses === 'function') ngm.$$updateEmptyClasses(viewValue);
                ngm.$viewValue = ngm.$$lastCommittedViewValue = viewValue;
                ngm.$render();
                if (typeof ngm.$$runValidators === 'function') ngm.$$runValidators(modelValue, viewValue, angular.noop);
            }

            /** Values for the model, derived from the selection state. */
            function deriveValues() {
                if (!opt.multiple) {
                    if (selection.selectedKey !== null) return [index.byKey.get(selection.selectedKey).value];
                    return selection.unknown.slice(0, 1);
                }
                const nodes = cascade()
                    ? engine.strategyNodes(index, selection.checked, opt.strategy, conductDisabled)
                    : index.nodes.filter(function (node) { return node.key !== null && selection.checked.has(node.key); });
                return nodes.map(function (node) { return node.value; }).concat(selection.unknown);
            }

            function sameValues(a, b) {
                return signature(a) === signature(b);
            }

            /**
             * Commit a change: write the model (marks dirty), refresh the view, notify listeners. source: what made it
             * (kit.reportChange's triggerSource); unset: the pick being handled (pickSource).
             */
            function commitSelection(sourceNode, source) {
                const values = deriveValues();
                // Values that are no longer selected need not be remembered, nor looked up.
                const selectedKeys = new Set(values.map(String));
                forgetUnselected(selectedKeys);
                if (lookup) lookup.retain(selectedKeys);
                if (sameValues(values, viewValues())) {
                    refreshSelectionView();
                    rebuildRows();
                    return false;
                }
                const oldValue = angular.copy(ngm.$modelValue);
                ngm.$setViewValue(values.slice());
                lastViewSignature = signature(values);
                rememberLoadedValues();
                refreshSelectionView();
                rebuildRows();
                notifyChange(sourceNode, source || pickSource, oldValue);
                if ($ctrl.isOpen && panelCtl) panelCtl.update();
                return true;
            }

            function copyItem(raw) {
                const item = {};
                Object.keys(raw).forEach(function (field) {
                    if (field !== fields.children) item[field] = raw[field];
                });
                return item;
            }

            function unknownLabel(value) {
                const known = knownEntry(value);
                if (known) return known.label;
                const labels = $ctrl.selectedLabels;
                const key = String(value);
                if (labels && typeof labels === 'object' && Object.prototype.hasOwnProperty.call(labels, key)) {
                    const label = labels[key];
                    if (label !== undefined && label !== null) return String(label);
                }
                return key;
            }

            /** Path of a value the tree has not loaded: known from a search result, else just its label. */
            function unknownPath(value) {
                const known = knownEntry(value);
                return known ? known.path : unknownLabel(value);
            }

            // Selected values found in the loaded data, remembered once per node (a WeakSet: old data is not kept
            // alive by it). When that data goes (other load-params, a reload), the trigger, tags and selected-items
            // still show the value's label and path instead of the bare value, as aui-select keeps picked options.
            // Loaded data always comes first; the copy only fills in while the node is not loaded.
            let rememberedNodes = new WeakSet();

            function rememberLoadedValues() {
                viewValues().forEach(function (value) {
                    const node = index.byKey.get(String(value));
                    if (node && !rememberedNodes.has(node)) {
                        rememberedNodes.add(node);
                        remember(node);
                    }
                });
            }

            /** Forget the copies of values that are no longer selected. */
            function forgetUnselected(selectedKeys) {
                remembered.forEach(function (entry, key) {
                    if (!selectedKeys.has(key)) remembered.delete(key);
                });
            }

            /** Keep what the trigger needs to show a value whose node is not loaded (picked from a search result, or loaded before). */
            function remember(node) {
                const ancestors = [];
                for (let parent = node.parent; parent; parent = parent.parent) {
                    if (parent.key !== null) ancestors.push(parent.key);
                }
                remembered.set(node.key, {
                    item: copyItem(node.raw),
                    label: node.label,
                    path: engine.pathLabel(node, $ctrl.pathSeparator || ' / '),
                    ancestors: ancestors
                });
            }

            function itemFor(value) {
                const node = index.byKey.get(String(value));
                if (node) return copyItem(node.raw);
                const known = knownEntry(value);
                if (known) return angular.extend({}, known.item);
                const item = {};
                item[fields.value] = value;
                item[fields.label] = unknownLabel(value);
                return item;
            }

            /** Tags, display text, hidden input, host value and selected-items from the current state and model. */
            function refreshSelectionView() {
                const separator = $ctrl.pathSeparator || ' / ';
                if (opt.multiple) {
                    const nodes = cascade()
                        ? engine.strategyNodes(index, selection.checked, 'parent', conductDisabled)
                        : index.nodes.filter(function (node) { return node.key !== null && selection.checked.has(node.key); });
                    const tags = nodes.map(function (node) {
                        return {
                            id: node.sid,
                            label: node.label,
                            title: engine.pathLabel(node, separator),
                            node: node,
                            removable: !isDisabled(node)
                        };
                    });
                    selection.unknown.forEach(function (value) {
                        const pending = pendingKeys.has(String(value));
                        tags.push({id: 'u:' + typeof value + ':' + String(value), label: unknownLabel(value),
                            title: pending ? '' : unknownPath(value), node: null, value: value, removable: true, pending: pending});
                    });
                    $ctrl.tags = tags;
                    $ctrl.hasValue = tags.length > 0;
                    $ctrl.displayText = '';
                    $ctrl.displayTitle = '';
                    $ctrl.displayPending = false;
                } else {
                    $ctrl.displayPending = false;
                    const node = selection.selectedKey !== null ? index.byKey.get(selection.selectedKey) : null;
                    $ctrl.tags = [];
                    if (node) {
                        const path = engine.pathLabel(node, separator);
                        $ctrl.displayText = opt.showPath ? path : node.label;
                        $ctrl.displayTitle = path;
                        $ctrl.hasValue = true;
                    } else if (selection.unknown.length > 0) {
                        const value = selection.unknown[0];
                        $ctrl.displayPending = pendingKeys.has(String(value));
                        $ctrl.displayText = $ctrl.displayPending ? '' : (opt.showPath ? unknownPath(value) : unknownLabel(value));
                        $ctrl.displayTitle = $ctrl.displayPending ? '' : unknownPath(value);
                        $ctrl.hasValue = true;
                    } else {
                        $ctrl.displayText = '';
                        $ctrl.displayTitle = '';
                        $ctrl.hasValue = false;
                    }
                }

                const values = viewValues();
                if (hiddenInputEl) {
                    // Carries the value for native required validation and form serialization (not an ngModel).
                    const text = values.map(String).join(',');
                    if (hiddenInputEl.value !== text) hiddenInputEl.value = text;
                }
                const modelValue = ngm.$modelValue;
                $element[0].value = Array.isArray(modelValue)
                    ? modelValue.slice()
                    : (modelValue !== undefined && modelValue !== null ? modelValue : '');

                // selected-items: replaced only when the selection or the data changed (avoids two-way churn).
                const itemsSignature = signature(values) + '\u0002' + index.nodes.length + '\u0002' + (index.roots[0] ? index.roots[0].id : 0)
                    + '\u0002' + knownVersion;
                if (itemsSignature !== lastItemsSignature) {
                    lastItemsSignature = itemsSignature;
                    $ctrl.selectedItems = values.map(itemFor);
                }
            }

            /**
             * The page's on-change, then a native "change" event on the element (kit.reportChange): what changed it, the
             * value before; the node it came from (a copy, without its children; null for a clear). The object of the
             * reference form keeps aui-select's selectedValues.
             */
            function notifyChange(sourceNode, source, oldValue) {
                const items = Array.isArray($ctrl.selectedItems) ? $ctrl.selectedItems : [];
                const selectedValues = opt.multiple ? items : (items[0] || null);
                const node = sourceNode ? copyItem(sourceNode.raw) : null;
                kit.reportChange($ctrl.onChange, {
                    selectedValues: selectedValues,
                    value: ngm.$modelValue,
                    oldValue: oldValue,
                    node: node,
                    triggerSource: source
                }, {$nodes: items, $node: node, selectedValues: selectedValues}, $element[0], 'aui-tree-select');
            }

            function markTouched() {
                if (ngm && !ngm.$touched) ngm.$setTouched();
            }

            $ctrl.showInvalid = function () {
                return !!(ngm && ngm.$invalid && ngm.$touched);
            };

            // ------------------------------------------------------------------ selection actions

            function selectSingle(node, programmatic) {
                if (!isSelectable(node)) return;
                if (selection.selectedKey === node.key && selection.unknown.length === 0) {
                    if (!programmatic) close({restoreFocus: true});
                    return;
                }
                selection.selectedKey = node.key;
                selection.unknown = [];
                if (!programmatic) close({restoreFocus: true});
                commitSelection(node, programmatic ? 'auto-select' : undefined);
            }

            function toggleCheck(node) {
                if (!isCheckable(node) || isDisabled(node)) return;
                const willCheck = !selection.checked.has(node.key);
                if (cascade()) {
                    const next = willCheck
                        ? engine.check(index, selection.checked, node, conductDisabled)
                        : engine.uncheck(index, selection.checked, selection.half, node, conductDisabled);
                    selection.checked = next.checked;
                    selection.half = next.half;
                } else {
                    const checked = new Set(selection.checked);
                    if (willCheck) checked.add(node.key);
                    else checked.delete(node.key);
                    selection.checked = checked;
                    selection.half = new Set();
                }
                commitSelection(node);
            }

            $ctrl.removeTag = function (tag, $event) {
                if ($event) $event.stopPropagation();
                if (opt.disabled || opt.readonly || opt.loading || !tag || !tag.removable) return;
                if (tag.node) {
                    // Remove the value directly: the node may have no checkbox (check-strictly + leaf-only).
                    const node = tag.node;
                    if (!selection.checked.has(node.key) || isDisabled(node)) return;
                    if (cascade()) {
                        const next = engine.uncheck(index, selection.checked, selection.half, node, conductDisabled);
                        selection.checked = next.checked;
                        selection.half = next.half;
                    } else {
                        const checked = new Set(selection.checked);
                        checked.delete(node.key);
                        selection.checked = checked;
                    }
                    commitSelection(node, 'remove-tag');
                    return;
                }
                const key = String(tag.value);
                selection.unknown = selection.unknown.filter(function (value) { return String(value) !== key; });
                commitSelection(null, 'remove-tag');
            };

            function hasClearable() {
                if (!opt.multiple) return $ctrl.hasValue;
                return $ctrl.tags.some(function (tag) { return tag.removable; });
            }

            $ctrl.showClear = function () {
                return opt.clearable && !opt.disabled && !opt.readonly && !opt.loading && hasClearable();
            };

            $ctrl.clearSelection = function ($event) {
                if ($event) $event.stopPropagation();
                if (!$ctrl.showClear()) return;
                if (opt.multiple) {
                    // Disabled nodes are locked: clearing keeps them.
                    const locked = [];
                    selection.checked.forEach(function (key) {
                        const node = index.byKey.get(key);
                        if (node && isDisabled(node)) locked.push(key);
                    });
                    if (cascade()) {
                        const conducted = engine.conductCheck(index, new Set(locked), conductDisabled);
                        selection.checked = conducted.checked;
                        selection.half = conducted.half;
                    } else {
                        selection.checked = new Set(locked);
                        selection.half = new Set();
                    }
                } else {
                    selection.selectedKey = null;
                }
                selection.unknown = [];
                commitSelection(null, 'clear');
            };

            $ctrl.onClearKeydown = function ($event) {
                if (!$event) return;
                if ($event.key === 'Enter' || $event.key === ' ' || $event.key === 'Spacebar') {
                    $event.preventDefault();
                    $event.stopPropagation();
                    if (kit.isRepeat($event)) return;   // a held key clears once
                    $ctrl.clearSelection($event);
                    // The button hides once nothing is left to clear: keep the keyboard on the field, not the page.
                    kit.focusQuietly(triggerEl);
                }
            };

            // ------------------------------------------------------------------ max-tag-count

            // max-tag-count, read again only when the attribute or its value changes (asked several times per digest)
            let tagModeFor = null;
            function tagMode() {
                if (!tagModeFor || tagModeFor.raw !== $attrs.maxTagCount || tagModeFor.bound !== $ctrl.maxTagCount) {
                    tagModeFor = {raw: $attrs.maxTagCount, bound: $ctrl.maxTagCount, mode: kit.readTagMode($attrs, $ctrl.maxTagCount)};
                }
                return tagModeFor.mode;
            }

            $ctrl.tagsResponsive = function () {
                return tagMode().responsive;
            };


            /** Tags shown before the rest collapse into one "+N" tag: max-tag-count, never more than kit.TAG_RENDER_CAP. */
            $ctrl.visibleTagLimit = function () {
                const mode = tagMode();
                return Math.min(mode.responsive ? tagFitCount : mode.limit, kit.TAG_RENDER_CAP);
            };

            $ctrl.hiddenTagCount = function () {
                return Math.max(0, $ctrl.tags.length - $ctrl.visibleTagLimit());
            };

            // Built once per tag list and limit, not on every digest (the list can hold thousands of labels).
            $ctrl.hiddenTagTitle = function () {
                const tags = $ctrl.tags;
                const limit = $ctrl.visibleTagLimit();
                if (tags.length <= limit) return '';
                if (!hiddenTitleCache || hiddenTitleCache.tags !== tags || hiddenTitleCache.limit !== limit) {
                    hiddenTitleCache = {
                        tags: tags,
                        limit: limit,
                        title: kit.hiddenTagsTitle(tags.slice(limit).map(function (tag) { return tag.label; }))
                    };
                }
                return hiddenTitleCache.title;
            };

            // ------------------------------------------------------------------ smooth resizing

            function prefersReducedMotion() {
                try {
                    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
                } catch (e) {
                    return false;
                }
            }

            function finishHeightAnimation() {
                if (heightFrame !== null) {
                    window.cancelAnimationFrame(heightFrame);
                    heightFrame = null;
                }
                if (heightTimer) {
                    clearTimeout(heightTimer);
                    heightTimer = null;
                }
                if (panelEl) {
                    panelEl.style.height = '';
                    panelEl.classList.remove('aui-tree-select__panel--resizing');
                }
            }

            /**
             * Fade the whole-panel loading block out over the arriving content, starting from its current opacity
             * (0 when it never became visible, e.g. a fast load: then nothing is animated). The block keeps its
             * hidden state underneath; the animation only overrides opacity and visibility while it runs.
             */
            function fadeOutLoadingBlock() {
                const block = panelEl ? panelEl.querySelector('.aui-tree-select__loading') : null;
                if (!block || typeof block.animate !== 'function' || prefersReducedMotion()) return;
                const from = parseFloat(window.getComputedStyle(block).opacity);
                if (!(from > 0.01)) return;
                try {
                    block.animate([
                        {opacity: from, visibility: 'visible'},
                        {opacity: 0, visibility: 'visible'}
                    ], {duration: LOADING_FADE_OUT_MS, easing: 'ease'});
                } catch (e) {
                    // Animation not supported: the block simply disappears.
                }
            }

            /**
             * The first rows replace the loading state of the open panel (data arriving): the panel grows to them on
             * the compositor, in one movement with the open animation (panel engine growNext; the rows play their own
             * enter animation). Elsewhere (closed, rows already shown, reduced motion, no Web Animations) the usual
             * height animation.
             */
            function withFirstRows(change) {
                if ($ctrl.isOpen && panelCtl && panelEl && !panelEl.querySelector('li.aui-select__option')) {
                    finishHeightAnimation();
                    if (panelCtl.growNext()) {
                        change();
                        return;
                    }
                }
                withHeightAnimation(change);
            }

            /**
             * Apply a change that alters the panel's content height (data arriving, a branch opening or closing) and let
             * the panel grow or shrink smoothly instead of jumping (FLIP):
             * 1. lock the panel at its current height, so the new content cannot resize it in one step;
             * 2. on the next animation frame (after the digest, including Angular's batched ng-show/ng-hide class
             *    changes) measure the new natural height;
             * 3. animate from the old to the new height, then release the lock.
             */
            function withHeightAnimation(change) {
                const from = $ctrl.isOpen && panelEl && !prefersReducedMotion() ? panelEl.offsetHeight : 0;
                if (from) {
                    if (heightFrame !== null) window.cancelAnimationFrame(heightFrame);
                    if (heightTimer) clearTimeout(heightTimer);
                    heightFrame = null;
                    heightTimer = null;
                    panelEl.classList.add('aui-tree-select__panel--resizing');
                    panelEl.style.height = from + 'px';
                }
                change();
                if (!from) return;
                heightFrame = window.requestAnimationFrame(function () {
                    heightFrame = null;
                    if (destroyed || !$ctrl.isOpen || !panelEl) {
                        finishHeightAnimation();
                        return;
                    }
                    panelEl.style.height = '';
                    const to = panelEl.offsetHeight;
                    if (!to || Math.abs(to - from) < 2) {
                        finishHeightAnimation();
                        return;
                    }
                    panelEl.style.height = from + 'px';
                    void panelEl.offsetHeight;
                    panelEl.style.height = to + 'px';
                    heightTimer = setTimeout(finishHeightAnimation, HEIGHT_ANIMATION_MS + 40);
                });
            }

            // ------------------------------------------------------------------ rows

            function domIdFor(sid) {
                if (!domIds.has(sid)) {
                    domSeq += 1;
                    domIds.set(sid, baseId + '-n' + domSeq);
                }
                return domIds.get(sid);
            }

            function decorate(visible, enterIndex, marks) {
                const node = visible.node;
                const multiple = opt.multiple;
                const disabled = isDisabled(node);
                let checked;
                let half;
                let selected;
                if (marks.result) {
                    checked = multiple && marks.checked.has(node.sid);
                    half = multiple && !checked && marks.half.has(node.sid);
                    selected = !multiple && node.key !== null && node.key === marks.selectedKey;
                } else {
                    checked = multiple && node.key !== null && selection.checked.has(node.key);
                    half = multiple && !checked && node.key !== null && (selection.half.has(node.key) || marks.extraHalf.has(node.key));
                    selected = !multiple && node.key !== null && node.key === selection.selectedKey;
                }
                // A group has no checkbox: it shows no check state of its own.
                if (node.group) checked = half = false;
                const loading = lazy.pending.has(node.sid);
                const error = lazy.errors.has(node.sid);
                const entering = enterParents.has(node.parent ? node.parent.sid : ROOT_SID);
                // Opened by the user but still loading: the caret already shows "open" (immediate feedback).
                const opening = loading && (searchState ? searchOpen.has(node.sid) : expanded.has(node.sid));
                let cls = '';
                if (selected || checked) cls += ' aui-select__option--selected';
                if (disabled) cls += ' aui-select__option--disabled';
                if (visible.expanded || opening) cls += ' aui-tree-select__node--expanded';
                if (!visible.expandable) cls += ' aui-tree-select__node--leaf';
                if (node.group) cls += ' aui-tree-select__node--group';
                if (loading) cls += ' aui-tree-select__node--loading';
                if (error) cls += ' aui-tree-select__node--error';
                if (checked) cls += ' aui-tree-select__node--checked';
                if (half) cls += ' aui-tree-select__node--half';
                if (entering) cls += ' aui-tree-select__node--enter';
                return {
                    sid: node.sid,
                    domId: domIdFor(node.sid),
                    node: node,
                    depth: node.depth,
                    level: node.depth + 1,
                    pos: node.pos,
                    size: node.setSize,
                    expandable: visible.expandable,
                    expanded: visible.expanded,
                    disabled: disabled,
                    selected: selected,
                    checkbox: multiple && isCheckable(node),
                    ariaChecked: multiple && isCheckable(node) ? (checked ? 'true' : (half ? 'mixed' : 'false')) : undefined,
                    cls: cls,
                    busy: loading,
                    enterIndex: entering ? enterIndex() : 0,
                    caretTitle: error ? T.retryNode : '',
                    segs: kit.highlightSegments(node.label, searchState ? searchQueryUsed : '', node.lower)
                };
            }

            function rebuildRows() {
                const source = remote.index || index;
                const visible = resultsPending() ? [] : engine.visibleRows(source, expanded, searchState, searchOpen, searchClosed);
                const marks = remote.index ? resultMarks() : {result: false, extraHalf: unknownAncestorKeys()};
                let entered = 0;
                const nextEnterIndex = function () { entered += 1; return entered - 1; };
                const decorated = visible.map(function (item) { return decorate(item, nextEnterIndex, marks); });
                // Children that come in pages: a "Load more" row after the last loaded child (not in search results).
                const rows = lazy.more.size > 0 ? withMoreRows(decorated) : decorated;
                moreRowIndexes = [];
                rows.forEach(function (row, i) {
                    if (row.more) moreRowIndexes.push(i);
                });
                enterParents = new Set();   // the enter animation plays once, for the rows just revealed
                rowIndex = new Map();
                rowsByDomId = new Map();
                rows.forEach(function (row, i) {
                    rowIndex.set(row.sid, i);
                    rowsByDomId.set(row.domId, row);
                });
                tipRowEl = null;
                $ctrl.rows = rows;
                if ($ctrl.activeSid !== null && !rowIndex.has($ctrl.activeSid)) $ctrl.activeSid = null;
                updateWindow(true);
            }

            function moreRow(sid, node, depth) {
                const more = lazy.more.get(sid);
                const loading = !!more.loading;
                const loaded = (lazy.loaded.get(sid) || []).length;
                const left = more.total !== null && more.total !== undefined ? more.total - loaded : 0;
                const text = loading ? T.loadingList
                    : (more.error ? T.moreFailedRetry : (left > 0 ? T.loadMoreLeft.replace('{n}', left.toLocaleString('en-US')) : T.loadMore));
                let cls = ' aui-tree-select__node--leaf aui-tree-select__more-row';
                if (loading) cls += ' aui-tree-select__more-row--loading';
                if (more.error) cls += ' aui-tree-select__more-row--error';
                return {
                    sid: 'm:' + sid, moreSid: sid, more: true, domId: domIdFor('m:' + sid), node: node,
                    depth: depth, level: depth + 1, pos: undefined, size: undefined,
                    expandable: false, expanded: false, disabled: false, selected: false, checkbox: false, ariaChecked: undefined,
                    cls: cls, busy: loading, enterIndex: 0, caretTitle: '', segs: [{text: text, hit: false}]
                };
            }

            /** Rows plus a "Load more" row at the end of each open node whose children continue in pages. */
            function withMoreRows(rows) {
                const out = [];
                const open = [];   // open nodes with more children, innermost last
                const flush = function (depth) {
                    while (open.length > 0 && open[open.length - 1].depth >= depth) {
                        const node = open.pop();
                        out.push(moreRow(node.sid, node, node.depth + 1));
                    }
                };
                rows.forEach(function (row) {
                    flush(row.depth);
                    out.push(row);
                    // While searching, only a node the user opened shows all its children; an ancestor opened by the
                    // search shows the matching ones, so "Load more" would not fit there.
                    if (row.expanded && lazy.more.has(row.sid) && (!searchState || searchOpen.has(row.sid))) open.push(row.node);
                });
                flush(0);
                if (lazy.more.has(ROOT_SID) && !searchState) out.push(moreRow(ROOT_SID, null, 0));
                return out;
            }

            function viewportHeight() {
                return (listEl && listEl.clientHeight) || 300;
            }

            /** Rows to render: all of them, or a scroll window plus spacers when there are many. */
            function updateWindow(force) {
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
                const scrollTop = listEl ? listEl.scrollTop : 0;
                const start = Math.max(0, Math.floor(scrollTop / rowPitch) - OVERSCAN_ROWS);
                const end = Math.min(rows.length, start + Math.ceil(viewportHeight() / rowPitch) + OVERSCAN_ROWS * 2);
                if (!force && start === windowStart && end === windowEnd) return false;
                windowStart = start;
                windowEnd = end;
                $ctrl.viewRows = rows.slice(start, end);
                $ctrl.padTop = start * rowPitch;
                $ctrl.padBottom = (rows.length - end) * rowPitch;
                return true;
            }

            // Digest this component only (its list changes nothing outside it; see kit.digestOwn)
            function localDigest() {
                if (!destroyed) kit.digestOwn($scope);
            }

            // an opening by the user that asks the page: the panel drawn first, the page asked after its first frame
            const pageAsk = kit.createOpening($scope, localDigest);

            function afterRender(fn) {
                $scope.$$postDigest(function () {
                    if (!destroyed) fn();
                });
            }

            function measurePitch() {
                if (!listEl) return;
                const items = listEl.querySelectorAll('li.aui-tree-select__node');
                if (items.length < 2) return;
                const measured = items[1].offsetTop - items[0].offsetTop;
                if (measured > 0 && Math.abs(measured - pitch) > 0.5) {
                    pitch = measured;
                    if (virtual && updateWindow(true)) localDigest();
                }
            }

            function onListScroll() {
                if (scrollFrame !== null || (!virtual && lazy.more.size === 0)) return;
                scrollFrame = window.requestAnimationFrame(function () {
                    scrollFrame = null;
                    if (virtual && updateWindow(false)) localDigest();
                    checkMoreRows();
                });
            }

            /**
             * Row tooltip, set on hover: the full label (as a path below the top level) when it is cut off, and the
             * path while searching or with show-path. Short labels that are fully visible get no tooltip.
             */
            function onListOver(event) {
                const target = event.target;
                const li = target && target.closest ? target.closest('li.aui-tree-select__node') : null;
                if (!li || li === tipRowEl) return;
                tipRowEl = li;
                const row = rowsByDomId.get(li.id);
                if (!row || row.more) return;
                const labelEl = li.querySelector('.aui-tree-select__label');
                const truncated = kit.isCutOff(labelEl);
                const path = row.depth > 0 ? engine.pathLabel(row.node, $ctrl.pathSeparator || ' / ') : row.node.label;
                const tip = truncated ? path : ((searchState || opt.showPath) && row.depth > 0 ? path : '');
                if (tip) li.setAttribute('title', tip);
                else li.removeAttribute('title');
            }

            /**
             * Moving the mouse ends the keyboard highlight. Only a real move counts: a browser may send mousemove at the
             * same place when rows change or scroll under a resting pointer.
             */
            let lastPointer = null;
            function onListMouse(event) {
                const moved = lastPointer !== null && (event.screenX !== lastPointer.x || event.screenY !== lastPointer.y);
                lastPointer = {x: event.screenX, y: event.screenY};
                if (moved && $ctrl.keyboardMode) {
                    $ctrl.keyboardMode = false;
                    localDigest();
                }
            }

            /** Scroll the list so row i is visible (centred when `center`). */
            function revealRow(i, center) {
                if (!listEl || i < 0 || i >= $ctrl.rows.length) return;
                if (virtual) {
                    const rowPitch = pitch || DEFAULT_ROW_PITCH;
                    const top = i * rowPitch;
                    const height = viewportHeight();
                    const current = listEl.scrollTop;
                    if (center) listEl.scrollTop = Math.max(0, top - (height - rowPitch) / 2);
                    else if (top < current) listEl.scrollTop = top;
                    else if (top + rowPitch > current + height) listEl.scrollTop = top + rowPitch - height;
                    updateWindow(false);
                    return;
                }
                const sid = $ctrl.rows[i].sid;
                afterRender(function () {
                    kit.revealInList(listEl, document.getElementById(domIdFor(sid)), center ? 'center' : 'nearest');
                });
            }

            $ctrl.activeDomId = function () {
                return $ctrl.activeSid !== null ? domIdFor($ctrl.activeSid) : '';
            };

            function activeIndex() {
                return $ctrl.activeSid !== null && rowIndex.has($ctrl.activeSid) ? rowIndex.get($ctrl.activeSid) : -1;
            }

            function setActiveIndex(i, center) {
                const row = $ctrl.rows[i];
                if (!row) return;
                $ctrl.activeSid = row.sid;
                revealRow(i, center);
            }

            function moveActive(delta) {
                const count = $ctrl.rows.length;
                if (count === 0) return;
                let i = activeIndex();
                if (i === -1) i = delta > 0 ? -1 : count;
                setActiveIndex(Math.max(0, Math.min(count - 1, i + delta)), false);
            }

            function pageSize() {
                return Math.max(1, Math.floor(viewportHeight() / (pitch || DEFAULT_ROW_PITCH)) - 1);
            }

            // ------------------------------------------------------------------ expand / collapse

            function setExpanded(node, open) {
                if (!node) return;
                const expandable = node.children === null || node.children.length > 0;
                if (!expandable) return;
                const sid = node.sid;
                if (searchState) {
                    if (open) { searchOpen.add(sid); searchClosed.delete(sid); }
                    else { searchOpen.delete(sid); searchClosed.add(sid); }
                } else if (open) {
                    expanded.add(sid);
                } else {
                    expanded.delete(sid);
                }
                withHeightAnimation(function () {
                    if (open) {
                        if (node.children === null) loadChildren(node);
                        else enterParents.add(sid);
                    }
                    rebuildRows();
                });
                if ($ctrl.onExpand) {
                    const raw = copyItem(node.raw);
                    // page code: by the user, right after the branch is drawn (pageAsk); at once otherwise
                    pageAsk.ask(function () {
                        try {
                            $ctrl.onExpand({$node: raw, $expanded: open});
                        } catch (e) {
                            console.error('Error in aui-tree-select on-expand:', e);
                        }
                    });
                }
            }

            function toggleRowExpanded(row) {
                if (!row || !row.expandable) return;
                if (lazy.errors.has(row.sid)) {
                    // Retry a failed load (setExpanded starts the load again) and keep the node open.
                    setExpanded(row.node, true);
                    return;
                }
                setExpanded(row.node, !row.expanded);
            }

            function revealNode(node) {
                for (let parent = node.parent; parent; parent = parent.parent) expanded.add(parent.sid);
            }

            /**
             * Open the branches down to the choice, so an opening shows it. Single: the parents of the selected node.
             * Multiple: the parents of every checked node, except inside a fully checked branch of linked checking (its
             * own checkbox already says that all of it is checked; it stays folded). Branches opened by hand stay open.
             * Each parent is visited once: linear in the checked nodes, also for a large selection. Returns the branches
             * it opened.
             */
            function openChoicePaths() {
                const opened = [];
                const openBranch = function (sid) {
                    if (expanded.has(sid)) return;
                    expanded.add(sid);
                    opened.push(sid);
                };
                if (!opt.multiple) {
                    const node = selection.selectedKey !== null ? index.byKey.get(selection.selectedKey) : null;
                    for (let parent = node ? node.parent : null; parent; parent = parent.parent) openBranch(parent.sid);
                    return opened;
                }
                const folded = cascade();
                const visited = new Set();
                selection.checked.forEach(function (key) {
                    const node = index.byKey.get(key);
                    if (!node || (folded && node.parent && selection.checked.has(node.parent.key))) return;
                    for (let parent = node.parent; parent && !visited.has(parent.sid); parent = parent.parent) {
                        visited.add(parent.sid);
                        openBranch(parent.sid);
                    }
                });
                return opened;
            }

            /**
             * The first rows arrived after the opening (a list loading on open, the top level of a lazy tree, options
             * the page gave late): open the paths to the choice, put the keyboard on it and bring it into view, as an
             * opening with the data does. Not while a search is shown (the user has moved on). entering: the branches
             * whose rows cascade in with these first rows; the opened branches' rows join them.
             */
            function showChoiceOnArrival(entering) {
                if (!choicePending || index.nodes.length === 0) return;
                choicePending = false;
                if (!$ctrl.isOpen || searchState || remote.raw || normalizedQuery()) return;
                const opened = openChoicePaths();
                if (opened.length > 0) {
                    if (entering && entering.size > 0) {
                        enterParents = entering;
                        opened.forEach(function (sid) { enterParents.add(sid); });
                    }
                    rebuildRows();
                }
                const first = initialActiveIndex();
                $ctrl.activeSid = first >= 0 ? $ctrl.rows[first].sid : null;
                // Before the next paint, not right after this digest: the list replaces the loading block through
                // Angular's class changes, which run after this digest; a hidden list cannot scroll.
                if (first > 0) afterRender(function () { window.requestAnimationFrame(centerActiveRow); });
            }

            /** Bring the keyboard's row into view, centred when it is out of view (an opening, data arriving). */
            function centerActiveRow() {
                const i = activeIndex();
                if (i < 0 || !listEl || !$ctrl.isOpen) return;
                if (virtual) {
                    revealRow(i, true);
                    localDigest();
                } else {
                    kit.revealInList(listEl, document.getElementById(domIdFor($ctrl.rows[i].sid)), 'center-if-hidden');
                }
            }

            // ------------------------------------------------------------------ search

            // Automatic when searchable is unset: shown for more than 5 nodes, as in aui-select. With on-demand loading
            // only the top level counts (it is always complete), so the box does not appear while branches load.
            $ctrl.showSearch = function () {
                if (opt.searchable !== null) return opt.searchable;
                if (hasRemoteSearch()) return true;
                return (hasLoader() ? index.roots.length : index.nodes.length) > 5;
            };

            /**
             * load-disabled-text, while loading is off (load-enabled false) and the tree has nothing to show: the
             * panel shows it instead of the tree and has no search box. '' otherwise.
             */
            $ctrl.loadNotice = function () {
                const text = typeof $ctrl.loadDisabledText === 'string' ? $ctrl.loadDisabledText.trim() : '';
                if (!text || loadReady() || opt.loading) return '';
                if (!hasListLoader() && !hasLoader() && !hasRemoteSearch()) return '';
                return $ctrl.rows.length === 0 ? text : '';
            };

            function normalizedQuery() {
                return String($ctrl.searchQuery === undefined || $ctrl.searchQuery === null ? '' : $ctrl.searchQuery).trim().toLowerCase();
            }

            function runSearch() {
                if (searchTimer) {
                    $timeout.cancel(searchTimer);
                    searchTimer = null;
                }
                const query = normalizedQuery();
                const custom = typeof $ctrl.filterMethod === 'function';
                const rawQuery = String($ctrl.searchQuery || '').trim();
                searchQueryUsed = query;
                searchOpen = new Set();
                searchClosed = new Set();
                searchState = query ? engine.search(index, function (node) {
                    if (custom) {
                        try {
                            return !!$ctrl.filterMethod({$node: node.raw, $query: rawQuery, $label: node.label});
                        } catch (e) {
                            return false;
                        }
                    }
                    return node.lower.indexOf(query) !== -1;
                }) : null;
                showSearchRows();
            }

            /** After a search: rows from the top, the keyboard on the first match. */
            function showSearchRows() {
                rebuildRows();
                if (listEl) listEl.scrollTop = 0;
                updateWindow(true);
                const first = $ctrl.rows.findIndex(function (row) { return !searchState || searchState.matched.has(row.sid); });
                $ctrl.activeSid = first >= 0 ? $ctrl.rows[first].sid : null;
                if (first >= 0) revealRow(first, false);
                if ($ctrl.isOpen && panelCtl) panelCtl.update();
            }

            function onSearchQuery(query, previous) {
                if (query === previous || !initialized) return;
                if (hasRemoteSearch()) {
                    onRemoteQuery();
                    return;
                }
                if (searchTimer) $timeout.cancel(searchTimer);
                searchTimer = null;
                // Same effective query as the one shown (e.g. the reset on open, or added spaces): nothing to redo.
                if (normalizedQuery() === searchQueryUsed) return;
                if (index.nodes.length >= SEARCH_DEBOUNCE_MIN_NODES && normalizedQuery() !== '') {
                    // a filter-method is page code: the whole page then; the tree's own search needs its own digest
                    searchTimer = typeof $ctrl.filterMethod === 'function'
                        ? $timeout(runSearch, SEARCH_DEBOUNCE_MS)
                        : $timeout(function () {
                            runSearch();
                            localDigest();
                        }, SEARCH_DEBOUNCE_MS, false);
                } else {
                    runSearch();
                }
            }

            function clearSearch() {
                if (searchTimer) {
                    $timeout.cancel(searchTimer);
                    searchTimer = null;
                }
                const wasRemote = !!(remote.raw || remote.pending || remote.error);
                clearRemote();
                const wasSearching = wasRemote || searchState !== null || $ctrl.searchQuery !== '';
                $ctrl.searchQuery = '';
                searchState = null;
                searchQueryUsed = '';
                searchOpen = new Set();
                searchClosed = new Set();
                if (wasSearching) rebuildRows();
            }

            // ------------------------------------------------------------------ server-side search

            function hasRemoteSearch() {
                return typeof $ctrl.remoteSearch === 'function';
            }

            function remoteDelay() {
                const ms = parseFloat($ctrl.searchDelay);
                return Number.isFinite(ms) && ms >= 0 ? ms : REMOTE_SEARCH_DELAY_MS;
            }

            /** Nothing to show for the query yet: the first request is in flight, or it failed. */
            function resultsPending() {
                return hasRemoteSearch() && !remote.index && (remote.pending !== null || remote.error);
            }

            function cancelRemoteTimer() {
                if (remote.timer) {
                    $timeout.cancel(remote.timer);
                    remote.timer = null;
                }
            }

            /** Stop a search request: its $signal aborts, its $cancel resolves, its answer is ignored. */
            function stopTicket(ticket) {
                if (ticket.stopped) return;
                ticket.stopped = true;
                ticket.handle.stop();
            }

            function cancelRemote() {
                cancelRemoteTimer();
                const pending = remote.pending;
                remote.pending = null;
                if (pending) stopTicket(pending);
            }

            /**
             * The panel is closing: stop the search on the server now. The rows stay as they are while the panel fades
             * out; the search resets once it is hidden (or on a reopen before that).
             */
            function stopRemoteOnClose() {
                cancelRemoteTimer();
                if (remote.pending) stopTicket(remote.pending);
            }

            function clearRemote() {
                cancelRemote();
                if (remote.index) engine.release(remote.index);
                remote.query = '';
                remote.text = '';
                remote.raw = null;
                remote.index = null;
                remote.keys = null;
                remote.parents = null;
                remote.total = null;
                remote.matched = 0;
                remote.error = false;
            }

            /** The query went empty: back to the tree at once. */
            function clearRemoteSearch() {
                const had = !!(remote.raw || remote.pending || remote.error || remote.timer);
                clearRemote();
                searchState = null;
                searchQueryUsed = '';
                searchOpen = new Set();
                searchClosed = new Set();
                if (had) {
                    withHeightAnimation(rebuildRows);
                    if ($ctrl.isOpen && panelCtl) panelCtl.update();
                }
            }

            /** A new query typed: ask the server once typing pauses (search-delay). */
            function onRemoteQuery() {
                if (remote.timer) {
                    $timeout.cancel(remote.timer);
                    remote.timer = null;
                }
                const query = normalizedQuery();
                if (!query) {
                    clearRemoteSearch();
                    return;
                }
                // The text is sent as typed (case kept): a case change is a new search, outer spaces are not.
                const text = String($ctrl.searchQuery || '').trim();
                const current = remote.pending ? remote.pending.text : (remote.raw || remote.error ? remote.text : null);
                if (text === current) return;
                remote.timer = $timeout(runRemoteSearch, remoteDelay());
            }

            function runRemoteSearch() {
                cancelRemote();
                const query = normalizedQuery();
                if (!query || destroyed) return;
                const ticket = {query: query, text: String($ctrl.searchQuery || '').trim(), stopped: false, handle: null};
                ticket.handle = remoteData.call(function (request) {
                    return pageAnswer('remote-search', 'remote-search="vm.search($query)"',
                        $ctrl.remoteSearch({$query: request.query, $signal: request.signal, $cancel: request.cancel, $params: request.params}));
                }, {reason: 'search', query: ticket.text, params: paramsSnapshot()}, readTimeout());
                remote.pending = ticket;
                remote.error = false;
                ticket.handle.promise.then(function (data) {
                    if (destroyed || remote.pending !== ticket || ticket.stopped) return;   // superseded, cleared, closed or destroyed
                    const read = remoteData.readAnswer(data);
                    if (!read) {
                        warnOnce('remote-search answered neither an array nor {items: [...]}');
                        return $q.reject(new Error('invalid search answer'));
                    }
                    remote.pending = null;
                    withHeightAnimation(function () {
                        showResults(query, read.items, read.total);
                        remote.text = ticket.text;
                    });
                }).then(null, function (error) {
                    if (destroyed || remote.pending !== ticket || ticket.stopped || (error && error.stopped)) return;
                    remote.pending = null;
                    if (typeof console !== 'undefined' && console.warn) console.warn('aui-tree-select: search failed', error);
                    withHeightAnimation(function () {
                        clearRemote();
                        remote.query = query;
                        remote.text = ticket.text;
                        remote.error = true;
                        searchState = null;
                        rebuildRows();
                    });
                    if ($ctrl.isOpen && panelCtl) panelCtl.update();
                });
                rebuildRows();   // "Searching..." while nothing is shown for the query yet
            }

            /** Values in the result data, and the values that have children there (the branches leading to matches). */
            function scanResult(items) {
                const keys = new Set();
                const parents = new Set();
                const seen = new Set();
                const stack = items.slice();
                while (stack.length) {
                    const raw = stack.pop();
                    if (!raw || typeof raw !== 'object' || seen.has(raw)) continue;
                    seen.add(raw);
                    const value = raw[fields.value];
                    if (kit.isSelectionKey(value)) keys.add(String(value));
                    if (fields.parent) {
                        const parent = raw[fields.parent];
                        if (kit.isSelectionKey(parent)) parents.add(String(parent));
                        continue;
                    }
                    const kids = raw[fields.children];
                    if (Array.isArray(kids) && kids.length > 0) {
                        if (kit.isSelectionKey(value)) parents.add(String(value));
                        for (let i = 0; i < kids.length; i += 1) stack.push(kids[i]);
                    }
                }
                return {keys: keys, parents: parents};
            }

            /**
             * Search state of the result tree: all of it is visible, the branches leading to matches start open. A match
             * is a result node without children in the result, or one whose label contains the query.
             */
            function resultSearchState() {
                const state = {matched: new Set(), ancestors: new Set(), visible: new Set()};
                remote.index.nodes.forEach(function (node) {
                    state.visible.add(node.sid);
                    if (node.key === null || !remote.keys.has(node.key)) return;   // loaded later, below a match
                    const parent = remote.parents.has(node.key);
                    if (parent) state.ancestors.add(node.sid);
                    if (!parent || (remote.query && node.lower.indexOf(remote.query) !== -1)) state.matched.add(node.sid);
                });
                return state;
            }

            function showResults(query, items, total) {
                if (remote.index) engine.release(remote.index);
                const scan = scanResult(items);
                remote.query = query;
                remote.raw = items.slice();
                remote.keys = scan.keys;
                remote.parents = scan.parents;
                remote.total = total;
                remote.error = false;
                remote.index = engine.build(remote.raw, fields, {lazy: hasLoader(), loaded: lazy.loaded});
                reportWarnings(remote.index.warnings);
                searchQueryUsed = query;
                searchOpen = new Set();
                searchClosed = new Set();
                searchState = resultSearchState();
                remote.matched = searchState.matched.size;
                showSearchRows();
            }

            /** Children loaded (or the data changed) while results are shown: index the result again. */
            function refreshResultIndex() {
                if (remote.index) engine.release(remote.index);
                remote.index = engine.build(remote.raw, fields, {lazy: hasLoader(), loaded: lazy.loaded});
                searchState = resultSearchState();
                remote.matched = searchState.matched.size;
                rebuildRows();
            }

            /** Keys of the ancestors of the selected values, wherever they are known (tree, search result, remembered). */
            function selectedAncestorKeys(valueKeys) {
                const keys = new Set();
                const addAncestors = function (node) {
                    for (let parent = node.parent; parent; parent = parent.parent) {
                        if (parent.key !== null) keys.add(parent.key);
                    }
                };
                valueKeys.forEach(function (key) {
                    const loaded = index.byKey.get(key);
                    if (loaded) {
                        addAncestors(loaded);
                        return;
                    }
                    const known = knownEntry(key);
                    if (known) {
                        known.ancestors.forEach(function (ancestor) { keys.add(ancestor); });
                        return;
                    }
                    const result = remote.index ? remote.index.byKey.get(key) : null;
                    if (result) addAncestors(result);
                });
                return keys;
            }

            /** Tree rows: ancestors of values picked from search results show half checked until those values load. */
            function unknownAncestorKeys() {
                if (!opt.multiple || !cascade() || selection.unknown.length === 0) return new Set();
                return selectedAncestorKeys(selection.unknown.map(String));
            }

            /**
             * Check state of the result rows: checked when the value is selected (or, with linked checking, when an
             * ancestor in the result is), half when a selected value lies below.
             */
            function resultMarks() {
                const values = viewValues();
                const marks = {result: true, checked: new Set(), half: new Set(), selectedKey: values.length ? String(values[0]) : null};
                if (!opt.multiple) return marks;
                const valueKeys = new Set(values.map(String));
                const linked = cascade();
                remote.index.levels.forEach(function (level) {
                    level.forEach(function (node) {
                        if (node.key === null) return;
                        const parent = node.parent;
                        const direct = selection.checked.has(node.key) || valueKeys.has(node.key);
                        const inherited = linked && !!parent && marks.checked.has(parent.sid) && !conductDisabled(parent) && !conductDisabled(node);
                        if (direct || inherited) marks.checked.add(node.sid);
                    });
                });
                if (linked) {
                    const below = selectedAncestorKeys(valueKeys);
                    remote.index.nodes.forEach(function (node) {
                        if (node.key === null || marks.checked.has(node.sid)) return;
                        if (below.has(node.key) || selection.half.has(node.key)) marks.half.add(node.sid);
                    });
                }
                return marks;
            }

            function inResult(node) {
                return !!(remote.index && node && remote.index.bySid.get(node.sid) === node);
            }

            /** Click / Enter on a search result row. A value the tree has loaded follows the tree's rules. */
            function activateResult(row) {
                const node = row.node;
                const loaded = node.key !== null ? index.byKey.get(node.key) : null;
                if (opt.multiple) {
                    if (!row.checkbox || row.disabled) {
                        if (row.expandable) toggleRowExpanded(row);
                        return;
                    }
                    if (loaded) {
                        toggleCheck(loaded);
                        return;
                    }
                    if (cascade()) {
                        toggleResultLinked(node, row.ariaChecked !== 'true');
                        return;
                    }
                    const key = node.key;
                    if (selection.unknown.some(function (value) { return String(value) === key; })) {
                        selection.unknown = selection.unknown.filter(function (value) { return String(value) !== key; });
                    } else {
                        remember(node);
                        selection.unknown = selection.unknown.concat([node.value]);
                    }
                    commitSelection(node);
                    return;
                }
                if (!isSelectable(node)) {
                    if (row.expandable) toggleRowExpanded(row);
                    return;
                }
                if (loaded) {
                    selectSingle(loaded, false);
                    return;
                }
                remember(node);
                selection.selectedKey = null;
                selection.unknown = [node.value];
                close({restoreFocus: true});
                commitSelection(node);
            }

            // Result nodes being toggled while their missing levels load (a second click waits for the first).
            const resultToggles = new Set();

            /** Children of a node are completely known: loaded on demand, with no page left to load. */
            function childrenComplete(node) {
                return lazy.loaded.has(node.sid) && !lazy.more.has(node.sid);
            }

            /**
             * Load the children of the node with this key completely (every page); resolves when done, rejects on a
             * failure. Each step looks the node up again: a load rebuilds the indexes and releases the old nodes.
             */
            function completeChildren(key) {
                const sid = 'k:' + key;
                const live = function () {
                    return (remote.index && remote.index.byKey.get(key)) || index.byKey.get(key) || null;
                };
                const step = function () {
                    if (destroyed) return $q.reject({stopped: true});
                    if (lazy.pending.has(sid)) return lazy.pending.get(sid).promise.then(step);
                    if (lazy.errors.has(sid)) return $q.reject(new Error('loading the children failed'));
                    const more = lazy.more.get(sid);
                    if (lazy.loaded.has(sid) && !more) return $q.when();
                    const node = live();
                    if (!node) return $q.reject(new Error('the node is no longer shown'));
                    if (more) {
                        if (more.error) return $q.reject(new Error('loading more children failed'));
                        if (!more.loading) loadMoreChildren(node);
                        return more.loading ? more.loading.promise.then(step) : $q.reject(new Error('children not loadable'));
                    }
                    loadChildren(node);
                    const handle = lazy.pending.get(sid);
                    return handle ? handle.promise.then(step) : $q.reject(new Error('children not loadable'));
                };
                return step();
            }

            /**
             * Multiple, linked checks: check or uncheck a search result the tree has not loaded, with the same rules
             * as in the tree. The rules run on the subtree that is completely known (children loaded on demand):
             * unchecking a node that is checked through a selected ancestor keeps its siblings at every level down
             * from that ancestor; checking every child checks the parent; a checked parent takes over its children.
             * Levels an uncheck needs but whose children are not all known are loaded first.
             */
            function toggleResultLinked(node, willCheck) {
                if (resultToggles.has(node.key)) return;
                const valueKeys = new Set(viewValues().map(String));
                const isSelected = function (n) {
                    return n.key !== null && (valueKeys.has(n.key) || selection.checked.has(n.key));
                };
                // The chain from the node up to its root, in the result.
                const chain = [];
                for (let current = node; current; current = current.parent) chain.push(current);
                let root = node;
                if (!willCheck) {
                    // Unchecking: from the topmost selected ancestor (or the node itself) down.
                    for (let i = chain.length - 1; i >= 0; i -= 1) {
                        if (isSelected(chain[i])) {
                            root = chain[i];
                            break;
                        }
                    }
                    const missing = [];
                    for (let current = node.parent; current && current !== root.parent; current = current.parent) {
                        if (!childrenComplete(current)) missing.unshift(current.key);
                    }
                    if (missing.length > 0 && hasLoader() && missing.indexOf(null) === -1) {
                        const key = node.key;
                        resultToggles.add(key);
                        missing.reduce(function (done, level) {
                            return done.then(function () { return completeChildren(level); });
                        }, $q.when()).then(function () {
                            resultToggles.delete(key);
                            if (!$ctrl.isOpen || destroyed) return;
                            // The loads may have brought the node into the tree: then the tree's own rules apply.
                            const loadedNow = index.byKey.get(key);
                            if (loadedNow) {
                                if (selection.checked.has(key)) toggleCheck(loadedNow);
                                return;
                            }
                            const fresh = remote.index ? remote.index.byKey.get(key) : null;
                            if (fresh) toggleResultLinked(fresh, false);
                        }, function (error) {
                            resultToggles.delete(key);
                            if (error && !error.stopped && typeof console !== 'undefined' && console.warn) {
                                console.warn('aui-tree-select: could not load the levels needed to uncheck this node', error);
                            }
                        });
                        rebuildRows();
                        return;
                    }
                    if (missing.length > 0) return;   // nothing can load them: the structure stays unknown
                } else {
                    // Checking: as high as the children are completely known (a parent may become checked).
                    for (let current = node.parent; current && childrenComplete(current); current = current.parent) root = current;
                }

                // The known subtree under root: at every level the children loaded on demand (complete) win over the
                // search result's own children (only the branches to the matches).
                const knownSubtree = function (raw) {
                    const copy = copyItem(raw);
                    const key = engine.keyOf(raw[fields.value]);
                    const loaded = key !== null ? lazy.loaded.get('k:' + key) : null;
                    const kids = loaded || (Array.isArray(raw[fields.children]) ? raw[fields.children] : null);
                    if (kids) copy[fields.children] = kids.map(knownSubtree);
                    return copy;
                };
                const sub = engine.build([knownSubtree(root.raw)], angular.extend({}, fields, {parent: null}), {lazy: true, loaded: new Map()});
                const target = sub.byKey.get(node.key);
                if (!target) {
                    engine.release(sub);
                    return;
                }
                const start = new Set();
                sub.nodes.forEach(function (n) {
                    if (isSelected(n)) start.add(n.key);
                });
                const state = engine.conductCheck(sub, start, conductDisabled);
                const next = willCheck
                    ? engine.check(sub, state.checked, target, conductDisabled)
                    : engine.uncheck(sub, state.checked, state.half, target, conductDisabled);
                const chosen = engine.strategyNodes(sub, next.checked, opt.strategy, conductDisabled);

                // Values outside the subtree stay; inside it they follow the new state.
                const subKeys = new Set();
                sub.nodes.forEach(function (n) {
                    if (n.key !== null) subKeys.add(n.key);
                });
                const values = viewValues().filter(function (value) { return !subKeys.has(String(value)); });
                const separator = $ctrl.pathSeparator || ' / ';
                const above = [];
                for (let current = root.parent; current; current = current.parent) {
                    if (current.key !== null) above.push(current.key);
                }
                const pathAbove = root.parent ? engine.pathLabel(root.parent, separator) : '';
                chosen.forEach(function (n) {
                    values.push(n.value);
                    if (index.byKey.has(n.key)) return;
                    // Not in the tree: keep its label, path and ancestors for tags, the trigger and half states.
                    const ancestors = [];
                    for (let current = n.parent; current; current = current.parent) {
                        if (current.key !== null) ancestors.push(current.key);
                    }
                    const path = engine.pathLabel(n, separator);
                    remembered.set(n.key, {
                        item: copyItem(n.raw),
                        label: n.label,
                        path: pathAbove ? pathAbove + separator + path : path,
                        ancestors: ancestors.concat(above)
                    });
                });
                engine.release(sub);
                applyValues(values);
                commitSelection(node);
            }

            /** Panel status of the server-side search: 'searching' (nothing to show yet), 'error', or ''. */
            $ctrl.remoteState = function () {
                if (!hasRemoteSearch()) return '';
                if (remote.pending && !remote.index) return 'searching';
                if (remote.error && !remote.pending) return 'error';
                return '';
            };

            /**
             * A server search is under way: the rows shown do not answer the typed text yet (typing pauses, or the
             * request runs), until its results are shown. The search box shows a spinner and the progress line runs,
             * as in aui-select. Never for a search in the loaded tree, or after a failure (its retry row shows).
             */
            $ctrl.searching = function () {
                if (!hasRemoteSearch() || normalizedQuery() === '') return false;
                if (remote.error && !remote.pending && !remote.timer) return false;
                return !$ctrl.rowsAnswerQuery();
            };

            /** The loaded list (load-options) is being refreshed in the background: the progress line runs. */
            $ctrl.listRefreshing = function () {
                const session = list ? listSession() : null;
                return !!session && !!session.refreshing;
            };

            /** "Showing 100 of 5,589 matches..." when the server found more than it returned. */
            $ctrl.remoteMoreText = function () {
                if (!remote.index || remote.total === null || remote.total <= remote.matched) return '';
                return T.showing.replace('{shown}', remote.matched.toLocaleString('en-US')).replace('{total}', remote.total.toLocaleString('en-US'));
            };

            $ctrl.retryRemoteSearch = function ($event) {
                if ($event) $event.stopPropagation();
                runRemoteSearch();
            };

            // ------------------------------------------------------------------ open / close

            function initialActiveIndex() {
                const rows = $ctrl.rows;
                for (let i = 0; i < rows.length; i += 1) {
                    if (opt.multiple ? rows[i].ariaChecked === 'true' : rows[i].selected) return i;
                }
                return rows.length > 0 ? 0 : -1;
            }

            function open() {
                if ($ctrl.isOpen || destroyed || opt.disabled || opt.readonly || opt.loading || !panelCtl) return;
                clearSearch();
                // Show the choice: the branches down to it open. After a value the page set (another record, a reset),
                // branches opened by hand for the old value close first.
                if (freshPaths) {
                    freshPaths = false;
                    expanded.clear();
                    applyDefaultExpand();
                }
                openChoicePaths();
                choicePending = index.nodes.length === 0;
                // What asks the page goes through pageAsk.ask: right after the panel's first frame when the user opens
                // it (kit.createOpening; the loading look meanwhile, see rootLoading), at once otherwise. Opening is a
                // natural moment to ask again for labels that were not found before.
                if (lookup && unresolvedCount > 0) {
                    pageAsk.ask(function () {
                        lookup.newRound();
                        renderFromView();
                    });
                }
                if (hasListLoader()) {
                    pageAsk.ask(function () { ensureTreeList('open'); });
                } else if (rootLazyUnloaded()) {
                    pageAsk.ask(function () { loadChildren(null); });
                }
                $ctrl.isOpen = true;
                $ctrl.keyboardMode = false;
                lastPointer = null;
                rebuildRows();
                const first = initialActiveIndex();
                $ctrl.activeSid = first >= 0 ? $ctrl.rows[first].sid : null;
                if (listEl) listEl.scrollTop = 0;
                updateWindow(true);
                finishHeightAnimation();
                panelCtl.open();
                if (dismiss) dismiss.start();
                if (revealAsksPage()) pageAsk.ask(revealSelected);
                else revealSelected();
                if ($ctrl.onOpen) {
                    openUntold = true;
                    pageAsk.ask(function () {
                        openUntold = false;
                        $ctrl.onOpen();
                    });
                }
            }

            /** Called by the panel engine once the panel is displayed (outside the digest). */
            function onPanelShown() {
                if (destroyed || !$ctrl.isOpen) return;
                const search = panelEl ? panelEl.querySelector('input.aui-select__search-input') : null;
                if (search) {
                    kit.focusQuietly(search);
                }
                measurePitch();
                centerActiveRow();
            }

            /** Called by the panel engine after the close animation (outside the digest). */
            function onPanelClosed() {
                if (destroyed || $ctrl.isOpen) return;
                // Reset the search only once the panel is hidden, so its content does not jump while fading out. This
                // component's own state: a digest of its own (one of the whole page here was a long task on a large
                // page, at the end of every close).
                clearSearch();
                localDigest();
            }

            function close(options) {
                if (!$ctrl.isOpen) return;
                closePanel(options);
                closeAftermath();
            }

            /** The close itself: the panel goes, the field's own look follows (no page state, no page code). */
            function closePanel(options) {
                pageAsk.flush();   // an opening's calls still waiting for its frame: now (on-open before on-close)
                $ctrl.isOpen = false;
                $ctrl.keyboardMode = false;
                stopRemoteOnClose();
                if (dismiss) dismiss.stop();
                if (panelCtl) panelCtl.close();
                if (options && options.restoreFocus && triggerEl && !opt.disabled) {
                    kit.focusQuietly(triggerEl);
                }
            }

            /** What the page sees of a close: the field is touched, on-close. */
            function closeAftermath() {
                markTouched();
                if ($ctrl.onClose) $ctrl.onClose();
            }

            /**
             * A close from the user's input (a press outside or on the field, Escape, Tab, a value picked in single
             * mode): the panel starts to close now, with a digest of this component only (the caller's settle). The
             * page's code runs at once, in that digest, in the order of every close (close, selectSingle): touched,
             * on-close, then `then` (the value picked, with ng-change and on-change), each on its own. The page so
             * handles what follows after it, as before: its own click of the same press (even one that removes the
             * field), its keys of the same Enter. The page's bindings of it follow in one digest of the whole page
             * (pageDigest): with a value after the close's first frame, without one once the close's motion has ended,
             * as in aui-select.
             */
            function closeFromInput(options, then) {
                if (!$ctrl.isOpen) return;
                closePanel(options);
                markTouched();
                if ($ctrl.onClose) $scope.$evalAsync(function () { $ctrl.onClose(); });
                if (then) $scope.$evalAsync(then);
                pageDigest.owe(!then);
            }

            /**
             * A click or Enter on this row picks a value and so closes the panel (single mode; see activateRow,
             * activateResult and selectSingle).
             */
            function pickCloses(row) {
                if (!row || opt.multiple || row.more || opt.disabled || opt.readonly || opt.loading) return false;
                const node = row.node;
                if (!isSelectable(node)) return false;
                if (!inResult(node)) return true;
                const loaded = node.key !== null ? index.byKey.get(node.key) : null;
                return !loaded || isSelectable(loaded);
            }

            /** Enter / Space would pick the active row and so close the panel (see pickRow). */
            function keyPickCloses(event) {
                if (kit.isRepeat(event) || !$ctrl.keyboardMode || !$ctrl.rowsAnswerQuery()) return false;
                const active = activeIndex();
                return pickCloses(active >= 0 ? $ctrl.rows[active] : null);
            }

            /** Enter / Space would only check or uncheck the active row (see pickRow, togglesInPlace). */
            function keyTogglesInPlace(event) {
                if (kit.isRepeat(event) || !$ctrl.keyboardMode || !$ctrl.rowsAnswerQuery()) return false;
                const active = activeIndex();
                return togglesInPlace(active >= 0 ? $ctrl.rows[active] : null);
            }

            /** Enter / Space would only open or close the active row's branch (see pickRow, rowOnlyToggles). */
            function keyOnlyToggles(event) {
                if (kit.isRepeat(event) || !$ctrl.keyboardMode || !$ctrl.rowsAnswerQuery()) return false;
                const active = activeIndex();
                return rowOnlyToggles(active >= 0 ? $ctrl.rows[active] : null);
            }

            /**
             * What an opening asks of the page (right after the panel's first frame, pageAsk): on-open, labels to look
             * up, the first level of load-children, the branch of the value to reveal, a tree load-options has to load
             * (list.wouldLoad). A tree loaded and recent asks nothing: reopened, it opens with its own digest only, as a
             * static one does.
             */
            function openAsksPage() {
                if ($ctrl.onOpen) return true;
                if (lookup && unresolvedCount > 0) return true;
                if (rootLazyUnloaded()) return true;
                if (revealAsksPage()) return true;
                return hasListLoader() && !!list && loadReady() && list.wouldLoad('open');
            }

            /** reveal-selected on a lazy tree (one value): an opening may load the branches down to the value. */
            function revealAsksPage() {
                return !opt.multiple && hasLoader() && kit.readFlag($attrs, 'revealSelected', $ctrl.revealSelected, false);
            }

            /** load-children, and nothing of the tree loaded yet: an opening loads its first level. */
            function rootLazyUnloaded() {
                return hasLoader() && loadReady() && index.nodes.length === 0 && !(Array.isArray($ctrl.options) && $ctrl.options.length > 0)
                    && !lazy.loaded.has(ROOT_SID);
            }

            $ctrl.onTriggerClick = function ($event) {
                if ($event) $event.stopPropagation();
                if (opt.disabled || opt.readonly || opt.loading) return;
                if ($ctrl.isOpen) closeFromInput({restoreFocus: false});
                else open();
            };

            $ctrl.onPanelMousedown = function ($event) {
                $ctrl.keyboardMode = false;
                // Keep focus where it is (trigger or search box) while clicking rows.
                if ($event && !isSearchInput($event.target)) $event.preventDefault();
            };

            $ctrl.onRowClick = function (row, $event) {
                if ($event) $event.stopPropagation();
                if (!row || opt.disabled || opt.readonly || opt.loading) return;
                $ctrl.activeSid = row.sid;
                activateRow(row);
            };

            $ctrl.onCaretClick = function (row, $event) {
                if ($event) $event.stopPropagation();
                if (!row || opt.loading) return;
                $ctrl.activeSid = row.sid;
                toggleRowExpanded(row);
            };

            /** Typing in the search box is keyboard use: the first match gets the keyboard highlight (see pickRow). */
            $ctrl.onSearchTyped = function () {
                $ctrl.keyboardMode = true;
            };

            // DOM events and digests: as in aui-select, the whole page is digested only when a handler can change
            // something outside this component (a value, the touched state, a page callback, or page code called to
            // load or look up data); otherwise only this component is (AngularJS's ng-click / ng-keydown / ng-model
            // would digest the whole page for every event). A close from the user's input runs the page's code at once
            // and digests the page just after it (closeFromInput).

            /** Run fn for a DOM event, then digest the whole page or only this component. */
            function settle(pageWide, fn) {
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
            }

            /**
             * A check toggled while the panel stays open (several values), as in aui-select: the value and the page's
             * code (ng-change, on-change) at once, in this component's own digest; the page's digest once the picking
             * pauses, or at the first input elsewhere (pageDigest.oweAfterPause).
             */
            function pickInPlace(fn) {
                if ($scope.$root.$$phase) {   // already inside a digest (page code)
                    fn();
                    return;
                }
                $scope.$evalAsync(fn);
                localDigest();
                pageDigest.oweAfterPause();
            }

            /**
             * A click or Enter on this row only checks or unchecks a value (several values): no page code to load or look
             * up anything (not a row that loads more, not a search result of a linked tree the tree has not loaded).
             */
            function togglesInPlace(row) {
                if (!row || !opt.multiple || row.more || !row.checkbox || row.disabled || opt.disabled || opt.readonly || opt.loading) return false;
                const node = row.node;
                if (!inResult(node)) return true;
                return !cascade() || (node.key !== null && index.byKey.has(node.key));
            }

            /**
             * A click or Enter on this row only opens or closes its branch (see activateRow): a node that cannot be
             * picked (leaf-only, a group, disabled) or has no checkbox to toggle.
             */
            function rowOnlyToggles(row) {
                if (!row || row.more || !row.expandable || opt.disabled || opt.readonly || opt.loading) return false;
                const node = row.node;
                if (inResult(node)) return false;
                return opt.multiple ? !(row.checkbox && !row.disabled) : !isSelectable(node);
            }

            /**
             * A branch opened or closed by the user: the tree changes and is drawn in its own digest; what asks the page
             * (on-expand, load-children of a branch not loaded yet) runs right after that frame, in a digest of the
             * page (pageAsk). A tree with its data at hand (options, a load-options list) digests only itself (before,
             * a tree that loads or looks up through the page digested the whole page in every such press).
             */
            function branchScope() {
                return $ctrl.onExpand || hasLoader() ? 'opening' : 'own';
            }

            function branchAction(fn) {
                if (branchScope() === 'opening') pageAsk.open(fn);
                else settle(false, fn);
            }

            function onTriggerClickEvent(event) {
                // A close: closeFromInput (the panel at once; touched and on-close in the page's digest after it). An
                // opening that asks the page (openAsksPage): the panel first, the page after its first frame (pageAsk).
                if (!$ctrl.isOpen && openAsksPage()) pageAsk.open(function () { $ctrl.onTriggerClick(event); });
                else settle(false, function () { $ctrl.onTriggerClick(event); });
            }

            const NAVIGATION_KEYS = Object.freeze({ArrowDown: true, ArrowUp: true, PageDown: true, PageUp: true,
                Home: true, End: true});

            /**
             * Keys: Escape / Tab / Alt+ArrowUp close, as does Enter / Space picking a value in single mode
             * (closeFromInput: the page's code at once, the page's digest after the close's first frame); Enter /
             * Space opening or closing a branch, and ArrowLeft / ArrowRight: a branch action (branchScope); Enter /
             * Space otherwise: the whole page; an opening key as a click; moving through the rows and typeahead change
             * only this component (near the end of loaded rows, checkMoreRows asks for more and digests the page
             * itself); keys typed into the search box need no digest here (the search box hands the text over itself).
             */
            function onRootKeydown(event) {
                const key = event.key;
                const fromSearch = isSearchInput(event.target);
                let scope = 'none';
                if (!$ctrl.isOpen) {
                    if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 'ArrowDown' || key === 'ArrowUp') {
                        scope = openAsksPage() ? 'opening' : 'own';
                    }
                } else if (key === 'Escape' || key === 'Tab' || (key === 'ArrowUp' && event.altKey)) {
                    scope = 'own';   // a close: closeFromInput
                } else if (key === 'Enter' || ((key === ' ' || key === 'Spacebar') && !fromSearch)) {
                    // a value picked in single mode closes the panel (closeFromInput); a check in place; anything
                    // else: the page now
                    if (keyPickCloses(event)) scope = 'own';
                    else if (keyTogglesInPlace(event)) scope = 'in place';
                    else scope = keyOnlyToggles(event) ? branchScope() : 'page';
                } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
                    scope = branchScope();
                } else if (NAVIGATION_KEYS[key] || (!fromSearch && key && key.length === 1)) {
                    scope = 'own';
                }
                if (scope === 'none') $ctrl.onKeydown(event);
                else if (scope === 'in place') pickInPlace(function () { $ctrl.onKeydown(event); });
                else if (scope === 'opening') pageAsk.open(function () { $ctrl.onKeydown(event); });
                else settle(scope === 'page', function () { $ctrl.onKeydown(event); });
            }

            function onPanelMousedownEvent(event) {
                const highlighted = $ctrl.keyboardMode;
                $ctrl.onPanelMousedown(event);
                if (highlighted) localDigest();
            }

            /**
             * A click on a row or on its caret (one listener for all rows). A row click selects or checks (the whole
             * page); opening or closing a branch is a branch action (branchAction: the tree first, then what it asks of
             * the page).
             */
            function onListClick(event) {
                const target = event.target;
                const li = target && target.closest ? target.closest('li.aui-tree-select__node') : null;
                if (!li || !listEl || !listEl.contains(li)) return;
                const row = rowsByDomId.get(li.id);
                if (!row) return;
                if (target.closest('.aui-tree-select__caret')) {
                    branchAction(function () { $ctrl.onCaretClick(row, event); });
                } else if (pickCloses(row)) {
                    // A value picked (single mode): the panel closes and the value is set now, the page's digest
                    // follows after the close's first frame (closeFromInput)
                    event.stopPropagation();
                    settle(false, function () {
                        $ctrl.activeSid = row.sid;
                        closeFromInput({restoreFocus: true}, function () { $ctrl.onRowClick(row, null); });
                    });
                } else if (togglesInPlace(row)) {
                    // A check (several values): the value now, the page's digest once the picking pauses
                    pickInPlace(function () { $ctrl.onRowClick(row, event); });
                } else if (rowOnlyToggles(row)) {
                    branchAction(function () { $ctrl.onRowClick(row, event); });
                } else {
                    settle(true, function () { $ctrl.onRowClick(row, event); });
                }
            }

            /**
             * Text typed into the search box (aui-search-input). A server search starts from a timer (which digests
             * the page); a filter-method is page code: the whole page then.
             */
            $ctrl.onSearchText = function (text) {
                settle(typeof $ctrl.filterMethod === 'function', function () {
                    $ctrl.searchQuery = text;
                    $ctrl.onSearchTyped();
                });
            };

            /**
             * The rows on screen answer the search text as it is now: no local search waits for its delay, no server
             * search for its delay or its answer, and a failed one does not count. Otherwise they are the rows of the
             * previous text (shown dimmed).
             */
            $ctrl.rowsAnswerQuery = function () {
                if (hasRemoteSearch()) {
                    if (remote.timer || remote.pending) return false;
                    if (normalizedQuery() === '') return true;
                    return !!remote.index && !remote.error && remote.text === String($ctrl.searchQuery || '').trim();
                }
                return !searchTimer && normalizedQuery() === searchQueryUsed;
            };

            /**
             * Enter / Space act on the active row only when it is plain to see what they act on: the keyboard
             * highlight is on and the rows answer the search text as it is now (not the rows of the previous text
             * while a search is on its way). A held key (auto-repeat) never acts, so it cannot toggle a row on and
             * off. Without the highlight, the first press only shows where the keyboard is.
             */
            function pickRow($event, row) {
                if (kit.isRepeat($event) || !row || !$ctrl.rowsAnswerQuery()) return;
                if (!$ctrl.keyboardMode) {
                    $ctrl.keyboardMode = true;
                    return;
                }
                if (pickCloses(row)) {
                    closeFromInput({restoreFocus: true}, function () { byKeyboard(function () { activateRow(row); }); });
                    return;
                }
                byKeyboard(function () { activateRow(row); });
            }

            /** fn's changes are the keyboard's (on-change's triggerSource 'keyboard'; else a pick is the pointer's). */
            function byKeyboard(fn) {
                pickSource = 'keyboard';
                try {
                    fn();
                } finally {
                    pickSource = 'option';
                }
            }

            /** Enter / click on a row: select (single), toggle the check (multiple), or open/close a branch. */
            function activateRow(row) {
                if (row.more) {
                    loadMoreChildren(row.node);
                    return;
                }
                const node = row.node;
                if (inResult(node)) {
                    activateResult(row);
                    return;
                }
                if (opt.multiple) {
                    if (row.checkbox && !row.disabled) toggleCheck(node);
                    else if (row.expandable) toggleRowExpanded(row);
                    return;
                }
                if (isSelectable(node)) selectSingle(node, false);
                else if (row.expandable) toggleRowExpanded(row);
            }

            // ------------------------------------------------------------------ keyboard

            function isSearchInput(target) {
                return !!(target && target.classList && target.classList.contains('aui-select__search-input'));
            }

            function caretAt(input, atEnd) {
                try {
                    if (input.selectionStart !== input.selectionEnd) return false;
                    return atEnd ? input.selectionStart === input.value.length : input.selectionStart === 0;
                } catch (e) {
                    return true;
                }
            }

            function typeaheadTo(char) {
                const rows = $ctrl.rows;
                const i = typeahead(char, rows.length, activeIndex(), function (j) { return rows[j].more ? '' : rows[j].node.lower; });
                if (i >= 0) setActiveIndex(i, false);
            }

            $ctrl.onKeydown = function ($event) {
                if (!$event || opt.disabled || opt.readonly) return;
                // While an input method is composing (e.g. pinyin), Enter, arrows and Escape belong to it.
                if (kit.isComposing($event)) return;
                const key = $event.key;
                const fromSearch = isSearchInput($event.target);

                if (!$ctrl.isOpen) {
                    if (opt.loading) return;
                    if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 'ArrowDown' || key === 'ArrowUp') {
                        $event.preventDefault();
                        if (kit.isRepeat($event)) return;   // a held key opens once, it does not go on into the panel
                        open();
                        // Opened from the keyboard: show where the keyboard is at once.
                        if ($ctrl.isOpen) $ctrl.keyboardMode = true;
                    }
                    return;
                }

                const active = activeIndex();
                const row = active >= 0 ? $ctrl.rows[active] : null;
                switch (key) {
                    case 'Escape':
                        // Close only the dropdown, not a surrounding dialog.
                        $event.preventDefault();
                        $event.stopPropagation();
                        closeFromInput({restoreFocus: true});
                        return;
                    case 'Tab':
                        closeFromInput({restoreFocus: false});
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
                        moveActive(key === 'PageDown' ? pageSize() : -pageSize());
                        return;
                    case 'Home':
                    case 'End':
                        if (fromSearch) return;
                        $event.preventDefault();
                        $ctrl.keyboardMode = true;
                        setActiveIndex(key === 'Home' ? 0 : $ctrl.rows.length - 1, false);
                        return;
                    case 'ArrowRight':
                        if (fromSearch && !caretAt($event.target, true)) return;
                        $event.preventDefault();
                        $ctrl.keyboardMode = true;
                        if (!row || !row.expandable) return;
                        if (!row.expanded || lazy.errors.has(row.sid)) toggleRowExpanded(row);
                        else moveActive(1);
                        return;
                    case 'ArrowLeft':
                        if (fromSearch && !caretAt($event.target, false)) return;
                        $event.preventDefault();
                        $ctrl.keyboardMode = true;
                        if (!row) return;
                        if (row.more) {
                            // A "Load more" row belongs to the node above it.
                            if (row.node && rowIndex.has(row.node.sid)) setActiveIndex(rowIndex.get(row.node.sid), false);
                        } else if (row.expanded) {
                            toggleRowExpanded(row);
                        } else if (row.node.parent && rowIndex.has(row.node.parent.sid)) {
                            setActiveIndex(rowIndex.get(row.node.parent.sid), false);
                        }
                        return;
                    case 'Enter':
                        // Never submit a surrounding form from inside the dropdown.
                        $event.preventDefault();
                        pickRow($event, row);
                        return;
                    case ' ':
                    case 'Spacebar':
                        if (fromSearch) return;   // a space typed into the search box
                        $event.preventDefault();
                        pickRow($event, row);
                        return;
                    case 'Backspace':
                    case 'Delete':
                        // Only edit the search text. A selection is removed only by its own x, the clear button or
                        // unchecking its row: a held or extra Backspace after the text is gone must never remove one.
                        return;
                    default:
                        if (!fromSearch && key && key.length === 1 && !$event.ctrlKey && !$event.metaKey && !$event.altKey) {
                            $ctrl.keyboardMode = true;
                            typeaheadTo(key);
                        }
                }
            };

            // ------------------------------------------------------------------ auto-select

            function scheduleAutoSelect() {
                if (!opt.autoSelectOnSingleRequired || opt.multiple) return;
                if (autoSelectTimer) $timeout.cancel(autoSelectTimer);
                autoSelectTimer = $timeout(function () {
                    autoSelectTimer = null;
                    if (destroyed || opt.multiple || opt.disabled || opt.readonly || !$ctrl.isRequired() || !ngm.$isEmpty(ngm.$viewValue)) return;
                    let only = null;
                    for (let i = 0; i < index.nodes.length; i += 1) {
                        if (!isSelectable(index.nodes[i])) continue;
                        if (only) return;   // more than one candidate
                        only = index.nodes[i];
                    }
                    if (only) selectSingle(only, true);
                }, AUTO_SELECT_DELAY_MS);
            }

            // ------------------------------------------------------------------ api

            function bindApi() {
                unbindApi();
                const target = $ctrl.api;
                if (!target || typeof target !== 'object') return;
                const nodeFor = function (value) { return index.byKey.get(String(value)) || null; };
                const methods = {
                    open: function () { $scope.$evalAsync(open); },
                    close: function () { $scope.$evalAsync(function () { close({restoreFocus: false}); }); },
                    toggle: function () { $scope.$evalAsync(function () { if ($ctrl.isOpen) close({restoreFocus: false}); else open(); }); },
                    focus: function () { if (triggerEl) triggerEl.focus(); },
                    expandAll: function () {
                        $scope.$evalAsync(function () {
                            freshPaths = false;   // the page's own expansion is its latest word
                            withHeightAnimation(function () {
                                index.nodes.forEach(function (node) {
                                    if (node.children && node.children.length > 0) expanded.add(node.sid);
                                });
                                rebuildRows();
                            });
                        });
                    },
                    collapseAll: function () {
                        $scope.$evalAsync(function () {
                            freshPaths = false;
                            withHeightAnimation(function () {
                                expanded.clear();
                                rebuildRows();
                            });
                        });
                    },
                    expand: function (value) { $scope.$evalAsync(function () { freshPaths = false; setExpanded(nodeFor(value), true); }); },
                    collapse: function (value) { $scope.$evalAsync(function () { freshPaths = false; setExpanded(nodeFor(value), false); }); },
                    reveal: function (value) {
                        $scope.$evalAsync(function () {
                            const node = nodeFor(value);
                            if (!node) return;
                            freshPaths = false;
                            revealNode(node);
                            rebuildRows();
                            if (rowIndex.has(node.sid)) setActiveIndex(rowIndex.get(node.sid), true);
                        });
                    },
                    reload: function (value) {
                        $scope.$evalAsync(function () {
                            if (value === undefined || value === null) {
                                resetLazy();
                                if (lookup) lookup.newRound();
                                if (list && loadReady()) {
                                    if ($ctrl.isOpen || readPreload()) list.reload();
                                    else list.drop();
                                }
                                rebuildIndex();
                                if ($ctrl.isOpen && hasLoader() && !hasListLoader() && index.nodes.length === 0) loadChildren(null);
                                return;
                            }
                            const node = nodeFor(value);
                            if (!node) return;
                            [node].concat(engine.descendants(node)).forEach(function (item) {
                                const handle = lazy.pending.get(item.sid);
                                if (handle) handle.stop();
                                const more = lazy.more.get(item.sid);
                                if (more && more.loading) more.loading.stop();
                                lazy.loaded.delete(item.sid);
                                lazy.pending.delete(item.sid);
                                lazy.more.delete(item.sid);
                                lazy.errors.delete(item.sid);
                            });
                            rebuildIndex();
                            const fresh = nodeFor(value);
                            if (fresh && fresh.children === null && expanded.has(fresh.sid)) loadChildren(fresh);
                        });
                    },
                    refresh: function () { $scope.$evalAsync(rebuildIndex); },
                    clear: function () {
                        $scope.$evalAsync(function () {
                            if (!$ctrl.hasValue) return;
                            selection.selectedKey = null;
                            selection.checked = new Set();
                            selection.half = new Set();
                            selection.unknown = [];
                            commitSelection(null, 'api');
                        });
                    },
                    getNode: function (value) {
                        const node = nodeFor(value);
                        if (node) return copyItem(node.raw);
                        const known = remembered.get(String(value));
                        return known ? angular.extend({}, known.item) : null;
                    },
                    getSelectedNodes: function () {
                        return viewValues().map(itemFor);
                    }
                };
                Object.keys(methods).forEach(function (name) { target[name] = methods[name]; });
                installedApi = {target: target, methods: methods};
            }

            function unbindApi() {
                if (!installedApi) return;
                const target = installedApi.target;
                const methods = installedApi.methods;
                Object.keys(methods).forEach(function (name) {
                    if (target[name] === methods[name]) delete target[name];
                });
                installedApi = null;
            }

            // ------------------------------------------------------------------ lifecycle

            $ctrl.$onInit = function () {
                ngm = $ctrl.ngModelCtrl;
                readFields();
                readOptions();
                kit.followNgFlags($attrs, readOptions);
                if ($ctrl.compId) $ctrl.ids.trigger = $ctrl.compId;

                ngm.$formatters.push(formatModel);
                ngm.$parsers.push(parseView);
                ngm.$isEmpty = function (value) {
                    if (Array.isArray(value)) return value.length === 0;
                    return value === undefined || value === null || value === '' || value !== value;
                };
                // A value the page set (not a pick here; also a model array changed in place, refreshFromModel): the
                // next opening starts from its paths. A copy of the same values is no new value.
                ngm.$render = function () {
                    if (signature(viewValues()) !== lastViewSignature) freshPaths = true;
                    renderFromView();
                };
                setUpRemoteData();
                own.$watch(function () { return $ctrl.valueOptions; }, function (options, previous) {
                    valueOptionsByKey = new Map();
                    (Array.isArray(options) ? options : (options && typeof options === 'object' ? [options] : [])).forEach(function (raw) {
                        const key = rawKey(raw);
                        if (key !== null && !valueOptionsByKey.has(key)) {
                            valueOptionsByKey.set(key, {item: copyItem(raw), label: rawLabel(raw), path: rawLabel(raw), ancestors: []});
                        }
                    });
                    if (options !== previous) {
                        knownVersion += 1;
                        renderFromView();
                    }
                }, true);

                own.$watchCollection(function () { return $ctrl.options; }, onOptionsChange);
                own.$watchCollection(function () { return $ctrl.disabledValues; }, function (values) {
                    const keys = new Set();
                    if (Array.isArray(values)) {
                        values.forEach(function (value) {
                            if (kit.isSelectionKey(value)) keys.add(String(value));
                        });
                    }
                    disabledValueKeys = keys;
                    inertGroups = new WeakMap();
                    renderFromView();
                });
                own.$watchCollection(function () { return $ctrl.selectedLabels; }, function (labels, previous) {
                    if (labels === previous) return;
                    lastItemsSignature = null;
                    refreshSelectionView();
                });
                // A model array changed in place (push/splice) is invisible to ngModel; pick it up here.
                own.$watchCollection(function () { return opt.multiple ? ngm.$modelValue : null; }, function (value) {
                    if (!opt.multiple || !Array.isArray(value)) return;
                    if (signature(value.filter(kit.isSelectionKey)) !== lastViewSignature) refreshFromModel();
                });
                own.$watch(function () { return $ctrl.searchQuery; }, onSearchQuery);
                // max-tag-count="responsive": fit the tags again whenever one of them changes (a value, a label, a lock).
                own.$watch(function () { return $ctrl.tagsResponsive() && tagFit ? tagFit.sync() : 0; }, function (version) {
                    if (version && tagFit) tagFit.schedule();
                });
                // Loading turned off while the search box has the focus: the box leaves the panel, the keyboard
                // stays on the field (focus moving inside the component does not close it).
                own.$watch(function () { return !!($ctrl.isOpen && $ctrl.loadNotice()); }, function (notice) {
                    const active = document.activeElement;
                    if (notice && active && isSearchInput(active) && $element[0].contains(active)) kit.focusQuietly(triggerEl);
                });
                bindApi();
                initialized = true;
            };

            $ctrl.$onChanges = function (changes) {
                if (!initialized) return;
                const wasMultiple = opt.multiple;
                readOptions();
                if (changes.labelField || changes.valueField || changes.childrenField || changes.parentField
                    || changes.disabledField || changes.selectableField || changes.leafField) {
                    readFields();
                    rebuildIndex();
                } else if (wasMultiple !== opt.multiple) {
                    refreshFromModel();
                } else if (changes.checkStrictly || changes.valueStrategy || changes.leafOnly) {
                    renderFromView();
                } else if (changes.showPath || changes.pathSeparator) {
                    refreshSelectionView();
                    rebuildRows();
                }
                if (changes.api) bindApi();
                if (changes.loading && $ctrl.isOpen && !opt.loading) {
                    fadeOutLoadingBlock();
                    withHeightAnimation(function () {
                        enterParents.add(ROOT_SID);
                        rebuildRows();
                    });
                }
                if ($ctrl.isOpen && (opt.disabled || opt.readonly)) close({restoreFocus: false});
                if (changes.autoSelectOnSingleRequired) scheduleAutoSelect();
            };

            $ctrl.$postLink = function () {
                rootEl = $element[0].querySelector('.aui-tree-select');
                triggerEl = $element[0].querySelector('.aui-select__trigger');
                panelEl = $element[0].querySelector('.aui-select__panel');
                listEl = $element[0].querySelector('.aui-tree-select__tree');
                hiddenInputEl = $element[0].querySelector('.aui-select__hidden-input');
                if (triggerEl && panelEl) {
                    panelCtl = dropdownPanel.create({
                        trigger: triggerEl,
                        panel: panelEl,
                        strategy: function () { return opt.positionStrategy; },
                        minWidth: function () { return opt.panelMinWidth; },
                        growable: function () { return true; },   // a tree grows when nodes are opened
                        onShown: onPanelShown,
                        onClosed: onPanelClosed
                    });
                }
                if (rootEl) {
                    dismiss = kit.createDismiss({
                        root: rootEl,
                        isOpen: function () { return $ctrl.isOpen && !destroyed; },
                        close: function () { settle(false, function () { closeFromInput({restoreFocus: false}); }); }
                    });
                    stopFocusLeave = kit.onFocusLeave(rootEl, function (next) {
                        if (destroyed) return;
                        // Focus moved to another control (Tab): close, touched with it. A null target (a press on the
                        // page) is handled by the outside-press listener. Closed: touched alone (the field's look at once,
                        // the page's bindings of it once the field's ring has faded out).
                        if (next && $ctrl.isOpen) {
                            settle(false, function () { closeFromInput({restoreFocus: false}); });
                        } else if (ngm && !ngm.$touched) {
                            settle(false, markTouched);
                            pageDigest.owe(true);
                        }
                    });
                }
                if (listEl) {
                    listEl.addEventListener('scroll', onListScroll, {passive: true});
                    listEl.addEventListener('mousemove', onListMouse, {passive: true});
                    listEl.addEventListener('mouseover', onListOver, {passive: true});
                }
                if (triggerEl) {
                    stopQuietFocus = kit.quietPointerFocus(triggerEl, 'aui-select__trigger--pointer-focus');
                    stopTriggerPress = kit.onTriggerPress({
                        trigger: triggerEl,
                        ignore: '.aui-select__tag-remove, .aui-control-clear',
                        enabled: function () { return !opt.disabled && !opt.readonly && !opt.loading; },
                        // (no event: the press goes on to the page as before, only the click is kept inside)
                        press: function () {
                            // a close: closeFromInput (the panel and the page's code at once, the page's digest after
                            // the close's first frame); an opening: the whole page when it asks the page for something
                            // now (openAsksPage)
                            if (!$ctrl.isOpen && openAsksPage()) pageAsk.open(function () { $ctrl.onTriggerClick(null); });
                            else settle(false, function () { $ctrl.onTriggerClick(null); });
                        },
                        click: function (event, afterPress) {
                            if (!afterPress) {
                                onTriggerClickEvent(event);
                                return;
                            }
                            event.stopPropagation();   // the press has toggled; onTriggerClick keeps every click inside
                        }
                    });
                }
                if (panelEl) panelEl.addEventListener('mousedown', onPanelMousedownEvent);
                if (listEl) listEl.addEventListener('click', onListClick);
                $element[0].addEventListener('keydown', onRootKeydown);
                stopLabelTip = kit.labelTip($element[0]);
                tagFit = kit.createTagFit({
                    scope: $scope,
                    root: $element[0],
                    total: function () { return $ctrl.tags.length; },
                    text: function (i) { return $ctrl.tags[i].pending ? '' : $ctrl.tags[i].label; },
                    locked: function (i) { return !$ctrl.tags[i].removable || !!$ctrl.opt.disabled || !!$ctrl.opt.readonly; },
                    pending: function (i) { return !!$ctrl.tags[i].pending; },
                    onFit: function (count) {
                        tagFitCount = count;
                        if ($scope.$root.$$phase) $scope.$evalAsync(angular.noop);
                        else localDigest();
                    }
                });
                refreshSelectionView();
            };

            $ctrl.$onDestroy = function () {
                const wasOpen = $ctrl.isOpen;
                destroyed = true;
                pageAsk.cancel();
                pageDigest.forget();
                $ctrl.isOpen = false;
                if (searchTimer) $timeout.cancel(searchTimer);
                if (autoSelectTimer) $timeout.cancel(autoSelectTimer);
                cancelRemote();
                if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
                if (heightTimer) clearTimeout(heightTimer);
                if (heightFrame !== null) window.cancelAnimationFrame(heightFrame);
                if (dismiss) dismiss.stop();
                if (stopFocusLeave) stopFocusLeave();
                if (listEl) {
                    listEl.removeEventListener('scroll', onListScroll);
                    listEl.removeEventListener('mousemove', onListMouse);
                    listEl.removeEventListener('mouseover', onListOver);
                }
                if (stopTriggerPress) stopTriggerPress();
                if (stopQuietFocus) stopQuietFocus();
                if (stopLabelTip) stopLabelTip();
                if (panelEl) panelEl.removeEventListener('mousedown', onPanelMousedownEvent);
                if (listEl) listEl.removeEventListener('click', onListClick);
                $element[0].removeEventListener('keydown', onRootKeydown);
                if (panelCtl) panelCtl.destroy();
                if (tagFit) tagFit.destroy();
                resetLazy();
                if (list) list.destroy();
                if (lookup) lookup.destroy();
                list = null;
                lookup = null;
                unbindApi();
                // (removed before its on-open ran: the page never knew it opened, so no on-close either)
                if (wasOpen && $ctrl.onClose && !openUntold) {
                    try { $ctrl.onClose(); } catch (e) { console.error('Error in aui-tree-select on-close:', e); }
                }
                releaseState();
            };

            /**
             * Let go of the data. AngularJS 1.5 keeps the watchers of a destroyed child scope, and ng-repeat keeps its
             * last scope and repeated item: either would keep this controller, and through it the whole tree, in memory.
             */
            function releaseState() {
                ownWatchers.splice(0).forEach(function (stop) { stop(); });
                clearRemote();
                remembered.clear();
                rememberedNodes = new WeakSet();
                valueOptionsByKey = new Map();
                engine.release(index);
                index = engine.build([], EMPTY_FIELDS);
                selection.selectedKey = null;
                selection.checked = new Set();
                selection.half = new Set();
                selection.unknown = [];
                expanded.clear();
                searchState = null;
                searchOpen = new Set();
                searchClosed = new Set();
                enterParents = new Set();
                lazy.loaded.clear();
                lazy.errors.clear();
                lazy.more.clear();
                domIds.clear();
                rowIndex = new Map();
                rowsByDomId = new Map();
                hiddenTitleCache = null;
                lastOptionsRef = undefined;
                $ctrl.rows = [];
                $ctrl.viewRows = [];
                $ctrl.tags = [];
                $ctrl.options = null;
                tipRowEl = null;
                rootEl = triggerEl = panelEl = listEl = hiddenInputEl = null;
                panelCtl = null;
                tagFit = null;
            }
        }],
        template: `
                    <div class="aui-select aui-tree-select"
                         ng-class="{'aui-select--open': $ctrl.isOpen, 'aui-select--disabled': $ctrl.opt.disabled,
                                    'aui-select--readonly': $ctrl.opt.readonly, 'aui-tree-select--lines': $ctrl.opt.showLine,
                                    'aui-select--small': $ctrl.field.size() === 'small', 'aui-select--large': $ctrl.field.size() === 'large',
                                    'aui-select--label-top': $ctrl.field.isLabelTop()}"
                         style="min-width: 100px;--aui-select-border-radius: {{$ctrl.radius}};">

                        <!-- Hidden native input: carries the value for native required validation and form serialization (not an ngModel) -->
                        <input type="text"
                               class="aui-select__hidden-input"
                               name="{{ $ctrl.name }}"
                               ng-required="$ctrl.isRequired()"
                               tabindex="-1"
                               aria-hidden="true"
                               autocomplete="off">

                        <!-- label-position="top": the label above the box; a press on it gives the field the focus -->
                        <div class="aui-field-label"
                             aui-if="$ctrl.opt.showLabel && $ctrl.labelText && $ctrl.field.isLabelTop()"
                             ng-click="$ctrl.focusFromLabel()">{{ $ctrl.labelText }}</div>

                        <!-- Trigger -->
                        <div class="aui-select__trigger"
                             id="{{ $ctrl.ids.trigger }}"
                             ng-class="{'aui-select__trigger--multiple': $ctrl.opt.multiple,
                                        'aui-select__trigger--required': $ctrl.isRequired(),
                                        'aui-select__trigger--clearable': $ctrl.showClear(),
                                        'aui-select__trigger--busy': $ctrl.opt.loading,
                                        'aui-select__trigger--invalid': $ctrl.showInvalid()}"
                             tabindex="{{ $ctrl.opt.disabled ? -1 : 0 }}"
                             role="combobox"
                             aria-haspopup="tree"
                             aria-expanded="{{ $ctrl.isOpen }}"
                             aria-controls="{{ ::$ctrl.ids.tree }}"
                             ng-attr-aria-activedescendant="{{ ($ctrl.isOpen && $ctrl.activeDomId()) || undefined }}"
                             aria-label="{{ $ctrl.labelText || $ctrl.placeholder || $ctrl.t.placeholder }}"
                             aria-required="{{ $ctrl.isRequired() }}"
                             aria-disabled="{{ !!$ctrl.opt.disabled }}"
                             aria-readonly="{{ !!$ctrl.opt.readonly }}"
                             aria-busy="{{ !!($ctrl.labelsPending || $ctrl.opt.loading) }}"
                             ng-attr-aria-describedby="{{ $ctrl.field.messageId() }}"
                             aria-invalid="{{ $ctrl.showInvalid() }}">

                            <div class="aui-control-label"
                                 aui-if="$ctrl.opt.showLabel && $ctrl.labelText && !$ctrl.field.isLabelTop()">{{ $ctrl.labelText }}</div>

                            <div class="aui-select__selected-display">
                                <!-- Tags (multiple) -->
                                <div class="aui-select__tags" aui-if="$ctrl.opt.multiple && $ctrl.tags.length > 0"
                                     ng-class="{'aui-select__tags--responsive': $ctrl.tagsResponsive()}">
                                    <div class="aui-select__tag"
                                         ng-repeat="tag in $ctrl.tags | limitTo: $ctrl.visibleTagLimit() track by tag.id"
                                         ng-class="{'aui-select__tag--locked': !tag.removable || $ctrl.opt.disabled || $ctrl.opt.readonly}"
                                         title="{{ tag.title }}">
                                        <span class="aui-select__tag-text" aui-if="!tag.pending">{{ tag.label }}</span>
                                        <span class="aui-select__tag-text aui-select__pending" aui-if="tag.pending" aria-label="{{ ::$ctrl.t.loading }}"></span>
                                        <span class="aui-select__tag-remove"
                                              aui-if="tag.removable && !$ctrl.opt.disabled && !$ctrl.opt.readonly"
                                              ng-click="$ctrl.removeTag(tag, $event)"
                                              aria-label="{{ $ctrl.t.remove.split('{label}').join(tag.label) }}"></span>
                                    </div>
                                    <!-- Selected items beyond max-tag-count, collapsed into one count -->
                                    <div class="aui-select__tag aui-select__tag--count"
                                         aui-if="$ctrl.hiddenTagCount() > 0"
                                         title="{{ $ctrl.hiddenTagTitle() }}">+{{ $ctrl.hiddenTagCount() }}</div>
                                </div>
                                <!-- max-tag-count="responsive": the hidden copy of the tags it measures is plain DOM (kit.createTagFit) -->

                                <span class="aui-select__placeholder"
                                      aui-if="!$ctrl.hasValue">{{ $ctrl.placeholder || '' }}</span>
                                <span class="aui-select__display-text"
                                      aui-if="!$ctrl.opt.multiple && $ctrl.hasValue"
                                      title="{{ $ctrl.displayTitle }}"><span class="aui-select__pending" aui-if="$ctrl.displayPending" aria-label="{{ ::$ctrl.t.loading }}"></span>{{ $ctrl.displayText }}</span>
                            </div>

                            <!-- Clear button -->
                            <span class="aui-control-clear"
                                  aui-if="$ctrl.opt.clearable"
                                  ng-class="{'aui-control-clear--hidden': !$ctrl.showClear()}"
                                  ng-click="$ctrl.clearSelection($event)"
                                  ng-mousedown="$event.preventDefault()"
                                  ng-keydown="$ctrl.onClearKeydown($event)"
                                  tabindex="{{ $ctrl.showClear() ? 0 : -1 }}"
                                  role="button"
                                  aria-label="{{ ::$ctrl.t.clearSelection }}"
                                  title="{{ ::$ctrl.t.clearAll }}">
                                <svg class="aui-control-clear-svg" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle class="aui-control-clear-bg" cx="10" cy="10" r="10"/>
                                    <path class="aui-control-clear-cross" d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke-linecap="round"/>
                                </svg>
                            </span>

                            <i class="aui-select__chevron" aria-hidden="true"></i>
                            <span class="aui-select__busy" aria-hidden="true" aui-if="$ctrl.opt.loading"></span>
                        </div>

                        <!-- Dropdown panel -->
                        <div class="aui-select__panel aui-tree-select__panel"
                             id="{{ ::$ctrl.ids.panel }}"
                             ng-class="{'aui-tree-select__panel--multiple': $ctrl.opt.multiple,
                                        'aui-select__panel--keyboard': $ctrl.keyboardMode}"
                             ng-style="$ctrl.panelStyle">

                            <!-- The list is being updated: a server search (with the spinner in the search box) or a background refresh -->
                            <div class="aui-select__progress" aria-hidden="true"
                                 aui-if="$ctrl.isOpen && ($ctrl.searching() || $ctrl.listRefreshing())"></div>

                            <div class="aui-select__search" aui-if="$ctrl.showSearch() && !$ctrl.loadNotice()"
                                 ng-class="{'aui-select__search--busy': $ctrl.searching()}">
                                <i class="aui-select__search-icon" aria-hidden="true"></i>
                                <span class="aui-select__spinner aui-select__search-spinner" aria-hidden="true" aui-if="$ctrl.searching()"></span>
                                <input type="text"
                                       class="aui-select__search-input"
                                       aui-search-input="$ctrl.searchQuery"
                                       aui-search-input-change="$ctrl.onSearchText($text)"
                                       placeholder="{{ $ctrl.searchPlaceholder !== undefined ? $ctrl.searchPlaceholder : $ctrl.t.search }}"
                                       aria-label="{{ ::$ctrl.t.searchLabel }}"
                                       aria-controls="{{ ::$ctrl.ids.tree }}"
                                       aria-autocomplete="list"
                                       ng-attr-aria-activedescendant="{{ $ctrl.activeDomId() || undefined }}"
                                       autocomplete="off"
                                       spellcheck="false">
                            </div>

                            <div class="aui-tree-select__body">
                            <div class="aui-select__loading aui-tree-select__loading"
                                 ng-class="{'aui-tree-select__loading--hidden': !($ctrl.opt.loading || $ctrl.rootLoading())}"
                                 aria-hidden="{{ !($ctrl.opt.loading || $ctrl.rootLoading()) }}">
                                <div class="aui-select__spinner"></div>
                                <span style="margin-left: 8px;">{{ ::$ctrl.t.loadingList }}</span>
                            </div>

                            <ul class="aui-select__options aui-scroll aui-tree-select__tree"
                                ng-class="{'aui-select__options--stale': !$ctrl.rowsAnswerQuery()}"
                                id="{{ ::$ctrl.ids.tree }}"
                                role="tree"
                                aria-label="{{ $ctrl.labelText || $ctrl.placeholder || $ctrl.t.options }}"
                                aria-multiselectable="{{ !!$ctrl.opt.multiple }}"
                                aria-busy="{{ !!($ctrl.opt.loading || $ctrl.rootLoading() || $ctrl.searching()) }}"
                                ng-show="!$ctrl.opt.loading && !$ctrl.rootLoading()">
                                <li class="aui-tree-select__spacer" role="none"
                                    aui-if="$ctrl.padTop > 0"
                                    ng-style="{height: $ctrl.padTop + 'px'}"></li>
                                <!-- aui-tree-row sets the row's classes, ARIA state, depth, checkbox and label; the list has one
                                     click listener (row and caret) -->
                                <li class="aui-select__option aui-tree-select__node" role="treeitem"
                                    ng-repeat="row in $ctrl.viewRows track by row.sid"
                                    aui-tree-row="row">
                                    <span class="aui-tree-select__caret" aria-hidden="true"></span>
                                    <span class="aui-tree-select__label"></span>
                                </li>
                                <li class="aui-tree-select__spacer" role="none"
                                    aui-if="$ctrl.padBottom > 0"
                                    ng-style="{height: $ctrl.padBottom + 'px'}"></li>

                                <!-- Loading is off (load-enabled false): what to do first -->
                                <li class="aui-select__notice" role="status" aui-if="$ctrl.loadNotice()">
                                    <span class="aui-select__notice-icon" aria-hidden="true"></span><span class="aui-select__notice-text">{{ $ctrl.loadNotice() }}</span>
                                </li>
                                <li class="aui-select__no-results" role="none"
                                    aui-if="$ctrl.rows.length === 0 && !$ctrl.rootError() && !$ctrl.remoteState() && !$ctrl.loadNotice()">{{ $ctrl.emptyText || $ctrl.t.empty }}</li>
                                <li class="aui-select__no-results aui-tree-select__searching" role="status"
                                    aui-if="$ctrl.remoteState() === 'searching'"><span class="aui-select__spinner" aria-hidden="true"></span><span>{{ ::$ctrl.t.searching }}</span></li>
                                <li class="aui-select__no-results aui-tree-select__retry" role="none"
                                    aui-if="$ctrl.remoteState() === 'error'"
                                    ng-click="$ctrl.retryRemoteSearch($event)">{{ ::$ctrl.t.searchFailed }} <span class="aui-tree-select__retry-link">{{ ::$ctrl.t.retry }}</span></li>
                                <li class="aui-tree-select__more" role="note"
                                    aui-if="$ctrl.remoteMoreText()">{{ $ctrl.remoteMoreText() }}</li>
                                <li class="aui-select__no-results aui-tree-select__retry" role="none"
                                    aui-if="$ctrl.rootError()"
                                    ng-click="$ctrl.retryRoot($event)">{{ $ctrl.rootTimeout() ? $ctrl.t.timeout : $ctrl.t.failed }} <span class="aui-tree-select__retry-link">{{ ::$ctrl.t.retry }}</span></li>
                            </ul>
                            </div>
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
     * One row of aui-tree-select (an li of its ng-repeat): classes, ARIA state, depth, the checkbox and the label with
     * its search hits, from one watcher. Rows are snapshots (built again when something changes), so the element is
     * updated when its row object or the active row changes; only what differs is written. In the template that took
     * about fifteen bindings per row, an ng-if and an ng-repeat for the label parts.
     */
    .directive('auiTreeRow', ['$parse', function ($parse) {
        const ACTIVE = 'aui-select__option--active';
        const NONE = {};

        function tokens(cls) {
            return cls ? cls.split(' ').filter(Boolean) : [];
        }

        /** Set the attribute, or remove it for undefined / null (as ng-attr-* does). */
        function setAttr(el, name, value) {
            if (value === undefined || value === null) el.removeAttribute(name);
            else el.setAttribute(name, String(value));
        }

        function sameSegments(a, b) {
            if (a === b) return true;
            if (!a || !b || a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (a[i].text !== b[i].text || !!a[i].hit !== !!b[i].hit) return false;
            }
            return true;
        }

        return {
            restrict: 'A',
            require: '^auiTreeSelect',
            link: function (scope, element, attrs, tree) {
                const el = element[0];
                const caret = el.querySelector('.aui-tree-select__caret');
                const label = el.querySelector('.aui-tree-select__label');
                const getRow = $parse(attrs.auiTreeRow);
                let checkbox = null;
                let next = null;
                let version = 0;
                let shown = NONE;
                let shownSegments = null;
                scope.$watch(function () {
                    const row = getRow(scope);
                    if (!row) return version;
                    const active = row.sid === tree.activeSid;
                    const single = !(tree.opt && tree.opt.multiple);
                    if (!next || next.row !== row || next.active !== active || next.single !== single) {
                        next = {row: row, active: active, single: single};
                        version += 1;
                    }
                    return version;
                }, function () {
                    const state = next;
                    if (!state) return;
                    const row = state.row;
                    const was = shown === NONE ? NONE : shown.row;
                    const changed = function (field) { return was === NONE || row[field] !== was[field]; };
                    if (changed('domId')) el.id = row.domId;
                    if (changed('cls')) {
                        if (was !== NONE) tokens(was.cls).forEach(function (c) { el.classList.remove(c); });
                        tokens(row.cls).forEach(function (c) { el.classList.add(c); });
                    }
                    if (shown === NONE || state.active !== shown.active) el.classList.toggle(ACTIVE, state.active);
                    if (changed('level')) setAttr(el, 'aria-level', row.level);
                    if (changed('size')) setAttr(el, 'aria-setsize', row.size);
                    if (changed('pos')) setAttr(el, 'aria-posinset', row.pos);
                    if (changed('expandable') || changed('expanded')) setAttr(el, 'aria-expanded', row.expandable ? row.expanded : undefined);
                    if (shown === NONE || changed('selected') || state.single !== shown.single) {
                        setAttr(el, 'aria-selected', state.single ? row.selected : undefined);
                    }
                    if (changed('ariaChecked')) setAttr(el, 'aria-checked', row.ariaChecked);
                    if (changed('disabled')) setAttr(el, 'aria-disabled', row.disabled);
                    if (changed('busy')) setAttr(el, 'aria-busy', row.busy ? true : undefined);
                    if (changed('depth')) el.style.setProperty('--aui-tree-depth', String(row.depth));
                    if (changed('enterIndex')) el.style.setProperty('--aui-tree-enter-index', String(row.enterIndex));
                    if (caret && changed('caretTitle')) setAttr(caret, 'title', row.caretTitle || undefined);
                    if (row.checkbox && !checkbox) {
                        checkbox = document.createElement('span');
                        checkbox.className = 'aui-tree-select__checkbox';
                        checkbox.setAttribute('aria-hidden', 'true');
                        el.insertBefore(checkbox, label);
                    } else if (!row.checkbox && checkbox) {
                        el.removeChild(checkbox);
                        checkbox = null;
                    }
                    if (label && !sameSegments(row.segs, shownSegments)) {
                        shownSegments = row.segs;
                        while (label.firstChild) label.removeChild(label.firstChild);
                        (row.segs || []).forEach(function (seg) {
                            const part = document.createElement('span');
                            if (seg.hit) part.className = 'aui-select__hit';
                            part.textContent = seg.text;
                            label.appendChild(part);
                        });
                    }
                    shown = state;
                });
            }
        };
    }]);
