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
                let notify = null;   // on-change, once a deferred model has committed (kit.changeAfterCommit)
                const own = {};      // the page's own tabindex / aria-labelledby / aria-describedby, moved onto the box

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
                    input.addEventListener('click', checkbox.redirectClick);
                    input.addEventListener('change', onUserChange);
                    input.addEventListener('blur', onBlur);
                    kit.followNgFlags($attrs, paint);
                    // the page's tabindex (one Tab stop: the box, not the element too), aria-labelledby and
                    // aria-describedby (a name and a description from the page's own text) act on the box
                    checkbox.forward($element[0], $attrs, own, paint);
                    // required / ng-required: the box's own too (the browser's check of a native form)
                    $attrs.$observe('required', paint);
                    // a required one: red once it has been left empty
                    if ($attrs.required !== undefined || $attrs.ngRequired !== undefined) $scope.$watch(invalidShown, paint);
                    paint();
                    checkbox.fitToFont(root);   // the box on the middle of its label's digits, in its font
                };

                $ctrl.$onDestroy = function () {
                    checkbox.forget(root);
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
                    const values = checkbox.values($ctrl);
                    const checked = angular.equals($ctrl.ngModelCtrl.$viewValue, values.on);
                    const disabled = kit.readFlag($attrs, 'disabled', $ctrl.disabled, false);
                    const text = String($ctrl.label || '').trim();
                    input.checked = checked;
                    // a native reset of the form puts a box back to its default: the model's state (it unchecked the
                    // box under a checked look and took it out of the form's data, the model unchanged)
                    input.defaultChecked = checked;
                    input.indeterminate = mixed && !checked;
                    // a native form: checked, its true-value is sent ("on" was); required is the box's own too
                    input.value = checkbox.formText(values.on);
                    input.required = !!$attrs.required;
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
                    checkbox.attr(input, 'tabindex', $ctrl.tabIndex !== undefined && $ctrl.tabIndex !== '' ? $ctrl.tabIndex : own.tabindex);
                    checkbox.attr(input, 'aria-labelledby', own.ariaLabelledby);
                    checkbox.attr(input, 'aria-invalid', invalidShown() ? 'true' : null);
                    checkbox.attr(input, 'aria-describedby', checkbox.ids(own.ariaDescribedby, $ctrl.field.messageId()));
                }

                // the user's click or Space: the box shows its new state at once; the model, ng-change and on-change in
                // this event, in the component's own digest; the page's digest after (checkbox.act). on-change tells the
                // value chosen; with a deferred model (a debounce, updateOn blur) once the model has it (told at once,
                // it gave the old value as the new one, and nothing after)
                function onUserChange() {
                    checkbox.act($scope, function () {
                        const model = $ctrl.ngModelCtrl;
                        const values = checkbox.values($ctrl);
                        const before = model.$viewValue;
                        const value = input.checked ? values.on : values.off;
                        mixed = false;
                        model.$setViewValue(value);
                        paint();
                        if (!notify) {
                            notify = kit.changeAfterCommit(model, function (now, old) {
                                kit.reportChange($ctrl.onChange, {value: now, oldValue: old, triggerSource: 'toggle'},
                                    {$checked: angular.equals(now, checkbox.values($ctrl).on)}, null, 'aui-checkbox');
                            });
                        }
                        notify(value, before);
                    }, false, $attrs.indeterminate !== undefined);
                }

                // leaving the box: touched; a value waiting for the blur (updateOn: 'blur') committed, as Angular's own
                // checkbox does (its blur never reached the element, where ngModel waits for it)
                function onBlur() {
                    const model = $ctrl.ngModelCtrl;
                    if (model.$touched && !kit.commitPending(model)) return;
                    checkbox.act($scope, function () {
                        kit.commitOnLeave(model);
                        if (!model.$touched) model.$setTouched();
                    }, true);
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
                let lastModel;    // the model's array at the last look: the same one changed in place is validated again
                let liveVersion = 0;   // the options' own fields read again: a change inside an option (its label, its lock)
                let notify = null;     // on-change, once a deferred model has committed (kit.changeAfterCommit)
                let nativeDue = false;
                const own = {};        // the page's own aria-labelledby / aria-describedby, moved onto the group

                $ctrl.items = [];
                $ctrl.compId = 'aui-checkbox-group-' + $scope.$id;
                $ctrl.field = fieldExtras.create({
                    ctrl: $ctrl,
                    attrs: $attrs,
                    ngModel: () => $ctrl.ngModelCtrl,
                    invalidShown: invalidShown,
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
                    // (before the box gets it: a click meant for another box beside it goes there)
                    root.addEventListener('click', checkbox.redirectClick, true);
                    root.addEventListener('change', onUserChange);
                    // leaving the group: touched; a value waiting for the blur (updateOn: 'blur') committed
                    stopFocusLeave = kit.onFocusLeave(root, function () {
                        const model = $ctrl.ngModelCtrl;
                        if (model.$touched && !kit.commitPending(model)) return;
                        checkbox.act($scope, function () {
                            kit.commitOnLeave(model);
                            if (!model.$touched) model.$setTouched();
                        }, true);
                    });
                    kit.followNgFlags($attrs, refresh);
                    // the page's aria-labelledby / aria-describedby name and describe the group itself (role=group)
                    checkbox.forward($element[0], $attrs, own, refresh, ['ariaLabelledby', 'ariaDescribedby']);
                    checkbox.fitToFont(root);   // every option's box on the middle of its label's digits, in its font
                    // the options and the model's array, changed in place too
                    $scope.$watchCollection(() => $ctrl.options, build);
                    $scope.$watchCollection(() => $ctrl.ngModelCtrl.$modelValue, followModel);
                    // a field inside an option changed in place (its label, its lock, its value): the options read again
                    $scope.$watch(optionsLive, function (now, before) { if (now !== before) build(); });
                    // the group's look when it turns invalid or valid once left (red boxes, aria-invalid)
                    $scope.$watch(invalidShown, function (now, before) { if (now !== before) refresh(); });
                };

                $ctrl.$onChanges = function (changes) {
                    if ((changes.min || changes.max) && $ctrl.ngModelCtrl.$validate) $ctrl.ngModelCtrl.$validate();
                    if (!root || changes.options) return;
                    // the options' fields: their records made again; anything else (a hint, the limits, the look): drawn
                    // again only (a hint's change remade every option's record)
                    if (changes.labelField || changes.valueField || changes.disabledField) build();
                    else refresh();
                };

                $ctrl.$onDestroy = function () {
                    if (stopFocusLeave) stopFocusLeave();
                    checkbox.forget(root);
                };

                function limit(name) {
                    const n = Number($ctrl[name]);
                    return isFinite(n) && n > 0 ? Math.floor(n) : 0;
                }

                function chosen(value) {
                    return Array.isArray(value) ? value : [];
                }

                function invalidShown() {
                    const model = $ctrl.ngModelCtrl;
                    return !!(model && model.$invalid && model.$touched);
                }

                /**
                 * The model's array seen again: another array is ngModel's (it validates it); the same one changed in
                 * place (push, splice) is validated here as ngModel's watch does - without writing the model back
                 * (required, min and max stayed as they were before the change).
                 */
                function followModel(value) {
                    const model = $ctrl.ngModelCtrl;
                    if (value === lastModel && Array.isArray(value) && typeof model.$$runValidators === 'function') {
                        model.$$runValidators(model.$modelValue, model.$viewValue, angular.noop);
                    }
                    lastModel = value;
                    refresh();
                }

                // a value's option field read from an option (its value, label, lock)
                function optionValue(option) {
                    const plain = option === null || typeof option !== 'object';
                    return plain ? option : ($ctrl.valueField ? option[$ctrl.valueField]
                        : (Object.prototype.hasOwnProperty.call(option, 'value') ? option.value : option));
                }

                function optionLabel(option) {
                    const plain = option === null || typeof option !== 'object';
                    const label = plain ? option : option[$ctrl.labelField || 'label'];
                    return label === undefined || label === null ? '' : String(label);
                }

                function optionLocked(option) {
                    const plain = option === null || typeof option !== 'object';
                    return !plain && !!$ctrl.disabledField && !!option[$ctrl.disabledField];
                }

                // each digest: an option whose own label, lock or value differs from its record (a page that edits an
                // option object in place); only property reads
                function optionsLive() {
                    const items = $ctrl.items;
                    for (let i = 0; i < items.length; i += 1) {
                        const item = items[i];
                        const option = item.raw;
                        if (option === null || typeof option !== 'object') continue;
                        const value = optionValue(option);
                        // (NaN as itself: a NaN value differed from itself at every digest)
                        const sameValue = value === item.value || (value !== value && item.value !== item.value);
                        if (!sameValue || optionLabel(option) !== item.label || optionLocked(option) !== item.locked) {
                            liveVersion += 1;
                            break;
                        }
                    }
                    return liveVersion;
                }

                function build() {
                    const options = Array.isArray($ctrl.options) ? $ctrl.options : [];
                    $ctrl.items = options.map(function (option) {
                        return {raw: option, value: optionValue(option), label: optionLabel(option), locked: optionLocked(option)};
                    });
                    refresh();
                }

                // each box's state, and the select-all's, from the model; the group's look
                function refresh() {
                    if (!root) return;
                    const value = chosen($ctrl.ngModelCtrl.$viewValue);
                    const picked = checkbox.valueSet(value);
                    const off = kit.readFlag($attrs, 'disabled', $ctrl.disabled, false);
                    const max = limit('max');
                    // max counts every value the model holds (a saved one whose option is not loaded, a locked one): the
                    // model's own count, as its maxItems check (only the options' ones let a click go past max)
                    const full = max > 0 && value.length >= max;
                    const border = kit.readFlag($attrs, 'containerBorder', $ctrl.containerBorder, false);
                    const invalid = invalidShown();
                    $ctrl.items.forEach(function (item) {
                        item.on = picked.has(item.value);
                        item.off = off || item.locked || (full && !item.on);
                        item.cls = checkbox.classes($ctrl.size, border, {checked: item.on, disabled: item.off, bare: !item.label,
                            invalid: invalid && !item.off});
                    });
                    // select-all over the options that can change (a disabled group keeps showing what is checked: the
                    // mark was wiped); it checks them all only when max allows the values that makes, and always clears
                    const free = $ctrl.items.filter(item => !item.locked);
                    const onCount = free.filter(item => item.on).length;
                    const allBox = all.querySelector('input');
                    const allOn = free.length > 0 && onCount === free.length;
                    // the values select-all would leave: the ones it does not touch, and every free option's (once)
                    const freeSet = checkbox.valueSet(free.map(item => item.value));
                    const adding = value.filter(each => !freeSet.has(each)).length + freeSet.size;
                    allBox.checked = allOn;
                    allBox.defaultChecked = allOn;
                    allBox.indeterminate = onCount > 0 && onCount < free.length;
                    allBox.disabled = off || free.length === 0 || (!allOn && max > 0 && adding > max);
                    all.className = checkbox.classes($ctrl.size, border, {checked: allBox.checked, mixed: allBox.indeterminate,
                        disabled: allBox.disabled, invalid: invalid && !allBox.disabled}) + ' aui-checkbox--select-all';
                    all.lastElementChild.textContent = $ctrl.selectAllText || texts.list.selectAll;
                    const layout = ['column', 'grid'].indexOf($ctrl.layout) >= 0 ? $ctrl.layout : 'row';
                    root.className = 'aui-checkbox-group aui-checkbox-group--' + layout +
                        (kit.readFlag($attrs, 'showSelectAll', $ctrl.showSelectAll, false) ? ' aui-checkbox-group--all' : '') +
                        (invalid ? ' aui-checkbox-group--invalid' : '');
                    root.style.setProperty('--aui-checkbox-group-columns', String(Math.max(1, Number($ctrl.columns) || 3)));
                    checkbox.attr(root, 'aria-label', $ctrl.ariaLabel);
                    checkbox.attr(root, 'aria-labelledby', own.ariaLabelledby);
                    checkbox.attr(root, 'aria-describedby', checkbox.ids(own.ariaDescribedby, $ctrl.field.messageId()));
                    checkbox.attr(root, 'aria-invalid', invalid ? 'true' : null);
                    // the option boxes are drawn by the digest (ng-repeat): their native form parts after it
                    if (!nativeDue) {
                        nativeDue = true;
                        $scope.$$postDigest(writeNative);
                    }
                }

                /**
                 * A native form: each option box sends its value under the group's name (no entry was made); the
                 * group's error (required, min, max) is its first enabled box's own, so the browser's check of the form
                 * stops there too (a native checkbox group has no "at least one" of its own).
                 */
                function writeNative() {
                    nativeDue = false;
                    if (!root) return;
                    const inputs = root.querySelectorAll('.aui-checkbox-group__options input.aui-checkbox__native');
                    const name = $attrs.name ? String($attrs.name) : '';
                    const model = $ctrl.ngModelCtrl;
                    const errorKey = Object.keys(model.$error || {}).filter(key => model.$error[key])[0];
                    let carrier = null;
                    for (let i = 0; i < inputs.length; i += 1) {
                        const input = inputs[i];
                        const item = $ctrl.items[i];
                        if (!item) continue;
                        if (name) input.setAttribute('name', name);
                        else input.removeAttribute('name');
                        const text = checkbox.formText(item.value);
                        if (input.value !== text) input.value = text;
                        if (!carrier && !input.disabled) carrier = input;
                        if (typeof input.setCustomValidity === 'function') input.setCustomValidity('');
                    }
                    if (carrier && errorKey && typeof carrier.setCustomValidity === 'function') {
                        carrier.setCustomValidity($ctrl.field.textFor(errorKey));
                    }
                }

                // a box checked or cleared by the user (its own event), or the select-all. Options of one value are one
                // choice: they are checked and cleared together, and the value is in the model once (one could not be
                // cleared while its twin held it; select-all wrote it twice)
                function onUserChange(event) {
                    const target = event.target;
                    if (!target || !target.classList.contains('aui-checkbox__native')) return;
                    const model = $ctrl.ngModelCtrl;
                    const before = chosen(model.$viewValue);
                    const isAll = all.contains(target);
                    const item = isAll ? null : $ctrl.items[Number(target.getAttribute('data-i'))];
                    if (!isAll && !item) return;
                    const checked = target.checked;
                    const was = checkbox.valueSet(before);
                    const shown = checkbox.valueSet($ctrl.items.map(each => each.value));
                    const toggled = item ? checkbox.valueSet([item.value]) : null;
                    const taken = checkbox.valueSet([]);
                    const after = [];
                    $ctrl.items.forEach(function (each) {
                        let on;
                        if (isAll) on = !each.locked ? checked : was.has(each.value);
                        else on = toggled.has(each.value) ? checked : was.has(each.value);
                        if (on && !taken.has(each.value)) {
                            taken.add(each.value);
                            after.push(each.value);
                        }
                    });
                    before.forEach(function (value) {
                        if (!shown.has(value) && !taken.has(value)) {
                            taken.add(value);
                            after.push(value);
                        }
                    });
                    checkbox.act($scope, function () {
                        model.$setViewValue(after);
                        refresh();
                        if (!notify) {
                            notify = kit.changeAfterCommit(model, function (now, change, old) {
                                kit.reportChange($ctrl.onChange, {value: now, oldValue: old, triggerSource: change.source},
                                    {$option: change.option, $checked: change.checked}, null, 'aui-checkbox-group');
                            });
                        }
                        notify(after, {source: isAll ? 'select-all' : 'toggle', option: item ? item.raw : undefined, checked: checked}, before);
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
                if (fonts[i]) fontOf.set(root, fonts[i].weight + ' ' + fonts[i].family);
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

        // A page digest this short (the last one measured) is no wait for the next click: the page follows after the next
        // frame every time
        const SLOW_MS = 50;

        // one digest of the whole page owed for every aui-checkbox (a digest of the page is the whole page's). After the
        // next frame - held back only on a page whose digest is slow (over SLOW_MS) for boxes clicked one after another
        // (and leaving a box), until the clicking pauses (400 ms; 1 s over 100 ms), so that the next click of a row
        // rarely meets it. Never for a select-all box (master: the page's rows follow it; they came 400 ms to 1 s
        // late, the same on a fast page).
        function owePage(later, master) {
            if (!pageDigest) pageDigest = kit.createPageDigest($rootScope, function () { return boxes; }, timeDigest);
            const now = Date.now();
            const inRow = now - lastChange < ROW_MS;
            if (!later) lastChange = now;
            if (!master && pageDigestMs > SLOW_MS && (later || inRow)) pageDigest.oweAfterPause(pageDigestMs > 100 ? 1000 : 400);
            else pageDigest.owe();
        }

        /**
         * A value's key: values angular.equals takes as one have one key (an object's own fields in name order, without
         * the $-named ones and functions; a Date by its time). Lookups by it (a Set): a group of 800 checked values
         * compared every option with every value (320,000 comparisons a drawing).
         */
        function keyOf(value) {
            if (value === null) return 'null';
            const type = typeof value;
            if (type === 'number') return value !== value ? 'n:NaN' : 'n:' + value;
            if (type === 'string') return 's:' + value;
            if (type === 'boolean') return 'b:' + value;
            if (type === 'undefined') return 'u';
            if (type === 'function') return 'f';
            if (value instanceof Date) return 'd:' + value.getTime();
            if (value instanceof RegExp) return 'r:' + String(value);
            if (Array.isArray(value)) return '[' + value.map(keyOf).join(',') + ']';
            return '{' + Object.keys(value).filter(name => name.charAt(0) !== '$' && typeof value[name] !== 'function').sort()
                .map(name => JSON.stringify(name) + ':' + keyOf(value[name])).join(',') + '}';
        }

        // the page's tabindex, aria-labelledby and aria-describedby on the element: kept for the box, taken off the
        // element (now and when they change)
        const FORWARDED = ['tabindex', 'ariaLabelledby', 'ariaDescribedby'];

        // a ResizeObserver over the components' roots: a label that changes its size (the page's font changed) has its
        // box fitted again in its font (it kept the old font's middle)
        let sizeWatch = null;
        const fontOf = new WeakMap();
        let refitDue = [];

        function refitChanged() {
            const roots = refitDue;
            refitDue = [];
            const fonts = roots.map(function (root) {
                if (!root.isConnected) return null;
                const style = window.getComputedStyle(root);
                return style.fontFamily ? {family: style.fontFamily, weight: style.fontWeight || '400'} : null;
            });
            roots.forEach(function (root, i) {
                const font = fonts[i];
                if (!font) return;
                const key = font.weight + ' ' + font.family;
                if (fontOf.get(root) === key) return;
                fontOf.set(root, key);
                const mid = digitMiddle(font.family, font.weight);
                if (mid !== null) root.style.setProperty('--aui-checkbox-mid', mid + 'em');
            });
        }

        function watchSize(root) {
            if (typeof window.ResizeObserver !== 'function') return;
            if (!sizeWatch) {
                sizeWatch = new window.ResizeObserver(function (entries) {
                    const first = refitDue.length === 0;
                    entries.forEach(function (entry) { if (refitDue.indexOf(entry.target) < 0) refitDue.push(entry.target); });
                    // on the next frame: a box moved inside the observer would be a loop of it (an error of the page)
                    if (first && refitDue.length) window.requestAnimationFrame(refitChanged);
                });
            }
            sizeWatch.observe(root);
        }

        // a component gone: its root no longer watched (an observed element is kept by the observer)
        function unwatchSize(root) {
            if (sizeWatch && root) sizeWatch.unobserve(root);
            const at = refitDue.indexOf(root);
            if (at >= 0) refitDue.splice(at, 1);
        }

        return {
            // true-value / false-value (true and false by default)
            values: $ctrl => ({on: $ctrl.trueValue !== undefined ? $ctrl.trueValue : true,
                off: $ctrl.falseValue !== undefined ? $ctrl.falseValue : false}),
            /** A set of values by keyOf: has(value), add(value), size. */
            valueSet: function (list) {
                const keys = new Set();
                (list || []).forEach(function (value) { keys.add(keyOf(value)); });
                return {
                    has: value => keys.has(keyOf(value)),
                    add: function (value) { keys.add(keyOf(value)); },
                    get size() { return keys.size; }
                };
            },
            /** A value as a native form sends it: a text as it is, a number or a boolean as text, an object as JSON. */
            formText: function (value) {
                if (value === undefined || value === null) return 'on';
                if (typeof value === 'object') return angular.toJson(value);
                return String(value);
            },
            /** ids joined for aria-describedby (the page's own, the message line's). */
            ids: function () {
                const list = [];
                Array.prototype.forEach.call(arguments, function (part) {
                    String(part || '').split(/\s+/).forEach(function (id) { if (id && list.indexOf(id) < 0) list.push(id); });
                });
                return list.join(' ');
            },
            /** The page's tabindex / aria-labelledby / aria-describedby on the element into own (its names camel-cased),
             * taken off the element; changed() when one changes ({{ }}, ng-attr-). names: some of them only. */
            forward: function (host, attrs, own, changed, names) {
                (names || FORWARDED).forEach(function (name) {
                    if (!attrs.$attr[name]) return;
                    const htmlName = attrs.$attr[name];
                    const take = function (value) {
                        own[name] = value === undefined || value === null ? undefined : String(value);
                        host.removeAttribute(htmlName);
                        if (changed) changed();
                    };
                    own[name] = attrs[name] === undefined || attrs[name] === null ? undefined : String(attrs[name]);
                    host.removeAttribute(htmlName);
                    attrs.$observe(name, take);
                });
            },
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
                watchSize(root);
            },
            /**
             * A pointer's click on a box's 24px target (a box without a label reaches past its box) that lands on the
             * box of another checkbox drawn beside it: that one is clicked, this one not (two compact boxes side by side
             * shared 12px, and a click on the first one's box checked the second). A click outside every box, the
             * keyboard's Space (no pointer) and a click on its own box are left as they are.
             */
            redirectClick: function (event) {
                const input = event.target;
                if (!event.detail || !input || !input.classList || !input.classList.contains('aui-checkbox__native') ||
                    typeof document.elementsFromPoint !== 'function') return;
                const x = event.clientX;
                const y = event.clientY;
                const on = function (el) {
                    const box = el.nextElementSibling;
                    if (!box) return false;
                    const r = box.getBoundingClientRect();
                    return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
                };
                if (on(input)) return;
                const other = document.elementsFromPoint(x, y).filter(function (el) {
                    return el !== input && el.classList && el.classList.contains('aui-checkbox__native') && on(el);
                })[0];
                if (!other) return;
                event.preventDefault();
                event.stopPropagation();
                if (!other.disabled) other.click();
            },
            /** A component's root gone (its $onDestroy). */
            forget: function (root) {
                unwatchSize(root);
                const at = fitQueue.indexOf(root);
                if (at >= 0) fitQueue.splice(at, 1);
            },
            act: function (scope, fn, later, master) {
                if (scope.$root.$$phase) {
                    fn();
                    return;
                }
                scope.$evalAsync(fn);
                kit.digestOwn(scope);
                owePage(!!later, !!master);
            }
        };
    }]);
