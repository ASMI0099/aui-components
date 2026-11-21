/**
 * aui-checkbox and aui-checkbox-group.
 */
angular.module('aui')
    /**
     * aui-checkbox: one box with its label, on ng-model (true-value / false-value: the values it writes; true and false
     * by default). The box is a native checkbox (Space, the label's click and assistive technology are the browser's
     * own) drawn by the family's look; the page's model is its only state.
     *
     * - label (label-position="left": before the box), aria-label (its name for screen readers, over the label too),
     *   size: compact, sm, normal (the default), lg, inherit (the text around it); container-border: in a field's box
     *   (a form row of fields).
     * - indeterminate: the mixed look while it is not checked (a select-all with some rows checked). The user's click
     *   leaves it, as a native checkbox's does, until the page sets indeterminate again.
     * - disabled or ng-disabled. required / ng-required: checked (its true-value) is its value. The fields' message line
     *   (show-errors, hint-text, error-text, error-messages), and its red, once it has been left.
     * - on-change, after the user's change: $value, $oldValue, $checked, $triggerSource ('toggle'), $byUser.
     * - name: its name in the page's form, which holds the field itself (its inner box has no ng-model of its own).
     */
    .component('auiCheckbox', {
        require: {ngModelCtrl: 'ngModel'},
        bindings: {
            label: '@?',
            ariaLabel: '@?',
            labelPosition: '@?',
            size: '@?',
            containerBorder: '<?',
            indeterminate: '<?',
            trueValue: '<?',
            falseValue: '<?',
            disabled: '<?',
            onChange: '&?',
            name: '@?',
            tabIndex: '@?',
            hintText: '@?',
            errorText: '@?',
            errorMessages: '<?',
            showErrors: '<?'
        },
        template: `
            <div class="aui-checkbox-field">
                <label class="aui-checkbox"><span class="aui-checkbox__control"><input type="checkbox" class="aui-checkbox__native custom"><span class="aui-checkbox__box" aria-hidden="true"></span></span><span class="aui-checkbox__label"></span></label>
                <div class="aui-field-message"
                     aui-if="$ctrl.field.hasMessageLine()"
                     id="{{ $ctrl.field.messageId() }}"
                     aria-live="polite"
                     ng-class="{'aui-field-message--error': $ctrl.field.messageIsError()}"><span aui-if="!$ctrl.field.messageIsError()">{{ $ctrl.field.messageText() }}</span><span aui-if="$ctrl.field.messageIsError()" class="aui-field-message__error">{{ $ctrl.field.messageText() }}</span></div>
            </div>`,
        controller: ['$element', '$scope', '$attrs', 'auiControlKit', 'auiFieldExtras', 'auiCheckboxKit',
            function ($element, $scope, $attrs, kit, fieldExtras, checkbox) {
                const $ctrl = this;
                let root = null;
                let input = null;
                let labelEl = null;
                let mixed = false;   // indeterminate as the page last set it; the user's click clears it

                $ctrl.compId = 'aui-checkbox-' + $scope.$id;
                $ctrl.field = fieldExtras.create({
                    ctrl: $ctrl,
                    attrs: $attrs,
                    ngModel: () => $ctrl.ngModelCtrl,
                    invalidShown: invalidShown,
                    id: () => $ctrl.compId
                });

                $ctrl.$onInit = function () {
                    const model = $ctrl.ngModelCtrl;
                    model.$render = paint;
                    // required: checked (its true-value) is a value, anything else is empty
                    model.$isEmpty = value => !angular.equals(value, checkbox.values($ctrl).on);
                    mixed = !!$ctrl.indeterminate;
                };

                $ctrl.$postLink = function () {
                    root = $element[0].firstElementChild.firstElementChild;
                    input = root.querySelector('input');
                    labelEl = root.lastElementChild;
                    input.addEventListener('change', onUserChange);
                    input.addEventListener('blur', onBlur);
                    kit.followNgFlags($attrs, paint);
                    // a required one: red once it has been left empty
                    if ($attrs.required !== undefined || $attrs.ngRequired !== undefined) $scope.$watch(invalidShown, paint);
                    paint();
                    checkbox.fitToFont(root);   // the box on the middle of its label's digits, in its font
                };

                $ctrl.$onChanges = function (changes) {
                    if (changes.indeterminate) mixed = !!$ctrl.indeterminate;
                    if ((changes.trueValue || changes.falseValue) && $ctrl.ngModelCtrl.$validate) $ctrl.ngModelCtrl.$validate();
                    paint();
                };

                function invalidShown() {
                    const model = $ctrl.ngModelCtrl;
                    return !!(model && model.$invalid && model.$touched);
                }

                // the box and its label as the model, the bindings and ng-disabled are now
                function paint() {
                    if (!input) return;
                    const checked = angular.equals($ctrl.ngModelCtrl.$viewValue, checkbox.values($ctrl).on);
                    const disabled = kit.readFlag($attrs, 'disabled', $ctrl.disabled, false);
                    const text = String($ctrl.label || '').trim();
                    input.checked = checked;
                    input.indeterminate = mixed && !checked;
                    input.disabled = disabled;
                    labelEl.textContent = text;
                    const border = kit.readFlag($attrs, 'containerBorder', $ctrl.containerBorder, false);
                    root.className = checkbox.classes($ctrl.size, border, {checked: checked, mixed: mixed && !checked, disabled: disabled,
                        bare: !text, invalid: invalidShown(), left: String($ctrl.labelPosition || '').trim().toLowerCase() === 'left'});
                    $element[0].classList.toggle('aui-checkbox-host--bare', !text);
                    $element[0].classList.toggle('aui-checkbox-host--block', border);
                    // aria-label names it for screen readers, over its label too (a row's number with "select row 3")
                    checkbox.attr(input, 'aria-label', $ctrl.ariaLabel);
                    checkbox.attr(input, 'name', $ctrl.name);
                    checkbox.attr(input, 'tabindex', $ctrl.tabIndex);
                    checkbox.attr(input, 'aria-invalid', invalidShown() ? 'true' : null);
                    checkbox.attr(input, 'aria-describedby', $ctrl.field.messageId());
                }

                // the user's click or Space: the box shows its new state at once; the model, ng-change and on-change in
                // this event, in the component's own digest; the page's digest after (checkbox.act)
                function onUserChange() {
                    checkbox.act($scope, function () {
                        const model = $ctrl.ngModelCtrl;
                        const values = checkbox.values($ctrl);
                        const before = model.$viewValue;
                        mixed = false;
                        model.$setViewValue(input.checked ? values.on : values.off);
                        paint();
                        kit.reportChange($ctrl.onChange, {value: model.$modelValue, oldValue: before, triggerSource: 'toggle'},
                            {$checked: input.checked}, null, 'aui-checkbox');
                    });
                }

                function onBlur() {
                    if ($ctrl.ngModelCtrl.$touched) return;
                    checkbox.act($scope, function () { $ctrl.ngModelCtrl.$setTouched(); }, true);
                }
            }
        ]
    })

    /**
     * aui-checkbox-group: a box for each option, on one array model (the values of the checked options, in the options'
     * order; values the options do not hold are kept, after them). Replace the array to change it from the page (it is
     * followed when changed in place too).
     *
     * - options: objects (label-field, "label" by default; value-field, the object itself without one or a "value";
     *   disabled-field) or plain values. layout: row (the default, wrapping), column, grid (columns, 3 by default).
     *   size and container-border as aui-checkbox's, for every box.
     * - show-select-all: a box above them for all the enabled ones (select-all-text), mixed while only some are checked.
     * - min, max: how many may be checked (max reached: the others disabled; fewer than min, more than max: an error,
     *   minItems / maxItems). required: at least one. disabled / ng-disabled. The fields' message line, once left.
     * - on-change, after the user's change: $value, $oldValue, $option (the option toggled; none for select-all),
     *   $checked, $triggerSource ('toggle', 'select-all'), $byUser.
     */
    .component('auiCheckboxGroup', {
        require: {ngModelCtrl: 'ngModel'},
        bindings: {
            options: '<?',
            labelField: '@?',
            valueField: '@?',
            disabledField: '@?',
            layout: '@?',
            columns: '@?',
            size: '@?',
            containerBorder: '<?',
            showSelectAll: '<?',
            selectAllText: '@?',
            min: '<?',
            max: '<?',
            disabled: '<?',
            onChange: '&?',
            ariaLabel: '@?',
            hintText: '@?',
            errorText: '@?',
            errorMessages: '<?',
            showErrors: '<?'
        },
        template: `
            <div class="aui-checkbox-group" role="group">
                <label class="aui-checkbox aui-checkbox--select-all"><span class="aui-checkbox__control"><input type="checkbox" class="aui-checkbox__native custom"><span class="aui-checkbox__box" aria-hidden="true"></span></span><span class="aui-checkbox__label"></span></label>
                <div class="aui-checkbox-group__options">
                    <label ng-repeat="item in $ctrl.items track by $index" class="{{ item.cls }}"><span class="aui-checkbox__control"><input type="checkbox" class="aui-checkbox__native custom" data-i="{{ ::$index }}" ng-checked="item.on" ng-disabled="item.off"><span class="aui-checkbox__box" aria-hidden="true"></span></span><span class="aui-checkbox__label">{{ item.label }}</span></label>
                </div>
                <div class="aui-field-message"
                     aui-if="$ctrl.field.hasMessageLine()"
                     id="{{ $ctrl.field.messageId() }}"
                     aria-live="polite"
                     ng-class="{'aui-field-message--error': $ctrl.field.messageIsError()}"><span aui-if="!$ctrl.field.messageIsError()">{{ $ctrl.field.messageText() }}</span><span aui-if="$ctrl.field.messageIsError()" class="aui-field-message__error">{{ $ctrl.field.messageText() }}</span></div>
            </div>`,
        controller: ['$element', '$scope', '$attrs', 'auiControlKit', 'auiFieldExtras', 'auiTexts', 'auiCheckboxKit',
            function ($element, $scope, $attrs, kit, fieldExtras, texts, checkbox) {
                const $ctrl = this;
                let root = null;
                let all = null;   // the select-all box
                let stopFocusLeave = null;

                $ctrl.items = [];
                $ctrl.compId = 'aui-checkbox-group-' + $scope.$id;
                $ctrl.field = fieldExtras.create({
                    ctrl: $ctrl,
                    attrs: $attrs,
                    ngModel: () => $ctrl.ngModelCtrl,
                    invalidShown: () => !!($ctrl.ngModelCtrl.$invalid && $ctrl.ngModelCtrl.$touched),
                    limits: () => ({min: limit('min'), max: limit('max')}),
                    id: () => $ctrl.compId
                });

                $ctrl.$onInit = function () {
                    const model = $ctrl.ngModelCtrl;
                    model.$render = refresh;
                    model.$isEmpty = value => !Array.isArray(value) || value.length === 0;
                    model.$validators.minItems = (modelValue, viewValue) => !limit('min') || chosen(viewValue).length >= limit('min');
                    model.$validators.maxItems = (modelValue, viewValue) => !limit('max') || chosen(viewValue).length <= limit('max');
                };

                $ctrl.$postLink = function () {
                    root = $element[0].firstElementChild;
                    all = root.firstElementChild;
                    root.addEventListener('change', onUserChange);
                    stopFocusLeave = kit.onFocusLeave(root, function () {
                        if ($ctrl.ngModelCtrl.$touched) return;
                        checkbox.act($scope, function () { $ctrl.ngModelCtrl.$setTouched(); }, true);
                    });
                    kit.followNgFlags($attrs, refresh);
                    checkbox.fitToFont(root);   // every option's box on the middle of its label's digits, in its font
                    // the options and the model's array, changed in place too
                    $scope.$watchCollection(() => $ctrl.options, build);
                    $scope.$watchCollection(() => $ctrl.ngModelCtrl.$modelValue, refresh);
                };

                $ctrl.$onChanges = function (changes) {
                    if ((changes.min || changes.max) && $ctrl.ngModelCtrl.$validate) $ctrl.ngModelCtrl.$validate();
                    if (root && !changes.options) build();
                };

                $ctrl.$onDestroy = function () {
                    if (stopFocusLeave) stopFocusLeave();
                };

                function limit(name) {
                    const n = Number($ctrl[name]);
                    return isFinite(n) && n > 0 ? Math.floor(n) : 0;
                }

                function chosen(value) {
                    return Array.isArray(value) ? value : [];
                }

                function has(list, value) {
                    for (let i = 0; i < list.length; i += 1) {
                        if (angular.equals(list[i], value)) return true;
                    }
                    return false;
                }

                function build() {
                    const options = Array.isArray($ctrl.options) ? $ctrl.options : [];
                    const labelField = $ctrl.labelField || 'label';
                    $ctrl.items = options.map(function (option) {
                        const plain = option === null || typeof option !== 'object';
                        const value = plain ? option : ($ctrl.valueField ? option[$ctrl.valueField]
                            : (Object.prototype.hasOwnProperty.call(option, 'value') ? option.value : option));
                        const label = plain ? option : option[labelField];
                        return {raw: option, value: value, label: label === undefined || label === null ? '' : String(label),
                            locked: !plain && !!$ctrl.disabledField && !!option[$ctrl.disabledField]};
                    });
                    refresh();
                }

                // each box's state, and the select-all's, from the model; the group's look
                function refresh() {
                    if (!root) return;
                    const value = chosen($ctrl.ngModelCtrl.$viewValue);
                    const off = kit.readFlag($attrs, 'disabled', $ctrl.disabled, false);
                    const max = limit('max');
                    const full = max > 0 && $ctrl.items.filter(item => has(value, item.value)).length >= max;
                    const border = kit.readFlag($attrs, 'containerBorder', $ctrl.containerBorder, false);
                    $ctrl.items.forEach(function (item) {
                        item.on = has(value, item.value);
                        item.off = off || item.locked || (full && !item.on);
                        item.cls = checkbox.classes($ctrl.size, border, {checked: item.on, disabled: item.off, bare: !item.label});
                    });
                    const free = $ctrl.items.filter(item => !off && !item.locked);
                    const onCount = free.filter(item => item.on).length;
                    const allBox = all.querySelector('input');
                    allBox.checked = free.length > 0 && onCount === free.length;
                    allBox.indeterminate = onCount > 0 && onCount < free.length;
                    allBox.disabled = free.length === 0 || (max > 0 && free.length > max);
                    all.className = checkbox.classes($ctrl.size, border, {checked: allBox.checked, mixed: allBox.indeterminate,
                        disabled: allBox.disabled}) + ' aui-checkbox--select-all';
                    all.lastElementChild.textContent = $ctrl.selectAllText || texts.list.selectAll;
                    const layout = ['column', 'grid'].indexOf($ctrl.layout) >= 0 ? $ctrl.layout : 'row';
                    root.className = 'aui-checkbox-group aui-checkbox-group--' + layout +
                        (kit.readFlag($attrs, 'showSelectAll', $ctrl.showSelectAll, false) ? ' aui-checkbox-group--all' : '') +
                        ($ctrl.ngModelCtrl.$invalid && $ctrl.ngModelCtrl.$touched ? ' aui-checkbox-group--invalid' : '');
                    root.style.setProperty('--aui-checkbox-group-columns', String(Math.max(1, Number($ctrl.columns) || 3)));
                    checkbox.attr(root, 'aria-label', $ctrl.ariaLabel);
                    checkbox.attr(root, 'aria-describedby', $ctrl.field.messageId());
                }

                // a box checked or cleared by the user (its own event), or the select-all
                function onUserChange(event) {
                    const target = event.target;
                    if (!target || !target.classList.contains('aui-checkbox__native')) return;
                    const before = chosen($ctrl.ngModelCtrl.$viewValue);
                    const isAll = all.contains(target);
                    const item = isAll ? null : $ctrl.items[Number(target.getAttribute('data-i'))];
                    if (!isAll && !item) return;
                    const shown = $ctrl.items.map(item => item.value);
                    const off = kit.readFlag($attrs, 'disabled', $ctrl.disabled, false);
                    const after = $ctrl.items.filter(function (each) {
                        if (isAll) return !off && !each.locked ? target.checked : has(before, each.value);
                        return each === item ? target.checked : has(before, each.value);
                    }).map(each => each.value).concat(before.filter(value => !has(shown, value)));
                    const checked = target.checked;
                    checkbox.act($scope, function () {
                        $ctrl.ngModelCtrl.$setViewValue(after);
                        refresh();
                        kit.reportChange($ctrl.onChange, {value: after, oldValue: before, triggerSource: isAll ? 'select-all' : 'toggle'},
                            {$option: item ? item.raw : undefined, $checked: checked}, null, 'aui-checkbox-group');
                    });
                }
            }
        ]
    })

    /** What aui-checkbox and aui-checkbox-group share: the values they write, a box's classes, an attribute, the digests. */
    .factory('auiCheckboxKit', ['auiControlKit', '$rootScope', function (kit, $rootScope) {
        const SIZES = ['compact', 'sm', 'normal', 'lg', 'inherit'];

        /*
         * The box beside its label: its middle where the label's digits have theirs, in the font they are drawn in. That
         * middle above the baseline differs by font (Segoe UI 0.355em, Arial 0.36, Tahoma 0.375):
         * one fixed value put the box up to half a pixel off (a whole screen pixel at 125%). The font's own glyphs tell
         * it (canvas measureText, the digits' ascent), once per font, kept; set as --aui-checkbox-mid on the component's
         * root (the CSS keeps 0.36em where a browser cannot tell). New components are measured together after the
         * digest that links them, before the frame is drawn: all styles read first, then all written (one style pass for
         * a table of them). A font still loading is measured again the next time (not kept).
         */
        const middles = new Map();
        let measureCtx = null;
        let fitQueue = [];
        let fitAgain = null;   // roots measured while fonts were loading: measured again once they have loaded

        function digitMiddle(family, weight) {
            const key = weight + ' ' + family;
            if (middles.has(key)) return middles.get(key);
            let mid = null;
            try {
                if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
                measureCtx.font = weight + ' 100px ' + family;
                const m = measureCtx.measureText('0123456789');
                const ascent = m && m.actualBoundingBoxAscent;
                if (typeof ascent === 'number' && ascent > 40 && ascent < 100) mid = Math.round(ascent * 5) / 1000;   // half the ascent, in em
            } catch (e) {
                mid = null;
            }
            const loading = document.fonts && document.fonts.status === 'loading';
            if (!loading) middles.set(key, mid);
            return mid;
        }

        function fitQueued() {
            const roots = fitQueue;
            fitQueue = [];
            const fonts = roots.map(function (root) {
                if (!root.isConnected) return null;
                const style = window.getComputedStyle(root);
                return style.fontFamily ? {family: style.fontFamily, weight: style.fontWeight || '400'} : null;
            });
            roots.forEach(function (root, i) {
                const mid = fonts[i] ? digitMiddle(fonts[i].family, fonts[i].weight) : null;
                if (mid !== null) root.style.setProperty('--aui-checkbox-mid', mid + 'em');
            });
            // fonts still loading: what was measured may be a fallback's - all of them again once they are in
            if (document.fonts && document.fonts.status === 'loading' && document.fonts.ready) {
                if (!fitAgain) {
                    fitAgain = [];
                    document.fonts.ready.then(function () {
                        const again = fitAgain.filter(function (root) { return root.isConnected; });
                        fitAgain = null;
                        if (again.length) {
                            fitQueue = fitQueue.concat(again);
                            fitQueued();
                        }
                    }, function () { fitAgain = null; });
                }
                fitAgain = fitAgain.concat(roots);
            }
        }
        // Boxes clicked one after another (rows of a table): a click this soon after the last counts as one of them
        const ROW_MS = 1000;
        // input on any box of the family does not run the page's digest they owe (the next box's click is not held up)
        const boxes = {contains: function (target) { return !!(target && target.closest && target.closest('aui-checkbox, aui-checkbox-group')); }};
        let pageDigest = null;
        let lastChange = 0;
        let pageDigestMs = 0;   // how long the last of these page digests took

        // the page's digest timed (its work runs first in it; $$postDigest after its last pass)
        function timeDigest() {
            const started = Date.now();
            $rootScope.$$postDigest(function () { pageDigestMs = Date.now() - started; });
        }

        // one digest of the whole page owed for every aui-checkbox (a digest of the page is the whole page's). The pause
        // waits longer on a page whose digest is slow (over 100 ms: 1 s), so that the next click of a row rarely meets it.
        function owePage(later) {
            if (!pageDigest) pageDigest = kit.createPageDigest($rootScope, function () { return boxes; }, timeDigest);
            const now = Date.now();
            const inRow = now - lastChange < ROW_MS;
            if (!later) lastChange = now;
            if (later || inRow) pageDigest.oweAfterPause(pageDigestMs > 100 ? 1000 : 400);
            else pageDigest.owe();
        }

        return {
            // true-value / false-value (true and false by default)
            values: $ctrl => ({on: $ctrl.trueValue !== undefined ? $ctrl.trueValue : true,
                off: $ctrl.falseValue !== undefined ? $ctrl.falseValue : false}),
            // a box's classes: its size (md: normal), its field's box, its state
            classes: function (size, border, state) {
                const word = String(size || '').trim().toLowerCase();
                const named = word === 'md' ? 'normal' : (SIZES.indexOf(word) >= 0 ? word : 'normal');
                return 'aui-checkbox aui-checkbox--' + named + (border ? ' aui-checkbox--container-border' : '') +
                    (state.checked ? ' aui-checkbox--checked' : '') + (state.mixed ? ' aui-checkbox--indeterminate' : '') +
                    (state.disabled ? ' aui-checkbox--disabled' : '') + (state.bare ? ' aui-checkbox--bare' : '') +
                    (state.invalid ? ' aui-checkbox--invalid' : '') + (state.left ? ' aui-checkbox--label-left' : '');
            },
            attr: function (el, name, value) {
                if (value === undefined || value === null || value === '') el.removeAttribute(name);
                else if (el.getAttribute(name) !== String(value)) el.setAttribute(name, String(value));
            },
            /**
             * The user's change (a click, Space, leaving the box): fn - the model, the page's ng-change and on-change -
             * runs at once in the component's own digest. (ngModel's $setViewValue outside a digest applies the whole
             * page: inside the click, before the box was drawn - on a large page the click seemed to do nothing for
             * that long.) The page's bindings follow in one digest of the page for every box: after the next frame; for
             * boxes clicked one after another (within ROW_MS of the last) and for leaving a box (later), once the
             * clicking pauses - no click waits for the page's digest of the one before. A press or key anywhere else
             * runs it first. Inside a digest (page code clicking it): at once, that digest shows it.
             */
            // the root of a new component: measured with the others after this digest (before the frame is drawn)
            fitToFont: function (root) {
                if (!root) return;
                fitQueue.push(root);
                if (fitQueue.length === 1) $rootScope.$$postDigest(fitQueued);
            },
            act: function (scope, fn, later) {
                if (scope.$root.$$phase) {
                    fn();
                    return;
                }
                scope.$evalAsync(fn);
                kit.digestOwn(scope);
                owePage(!!later);
            }
        };
    }]);
