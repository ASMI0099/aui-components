/**
 * aui-input and aui-textarea: text, number, password and search fields.
 */
angular.module('aui')
    .component('auiInput', {
        require: {
            ngModelCtrl: 'ngModel'
        },
        bindings: {
            disabled: '<?',      // optional
            onChange: '&?',      // the text changed: a call, on-change="fn($value, $oldValue, $triggerSource, $byUser)", or a
                                 // function reference, on-change="fn" (called with {value, oldValue, triggerSource, byUser});
                                 // triggerSource 'input' (typing) | 'clear' (the clear button) | 'api' (api.clear())
            onFinish: '&?',      // Enter finish callback
            name: '@?',
            inputStyleType: '@?',// optional
            inputType: '@?',// optional
            valueMaxLength: '@?',    // valueMaxLength attribute
            min: '@?',          // min attribute (for number/date)
            max: '@?',          // max attribute (for number/date)

            pattern: '@?',      // pattern attribute (for validation)
            inputTextBold: '<?',
            width: '@?',        // optional pixel width
            placeholder: '@?',   // optional placeholder
            clearable: '<?',     // optional clearable attribute
            readonly: '<?',
            showLabel: '<?',
            showCount: '<?',     // show the length of the text (out of value-max-length when set: "3/7"); off by default
            enforceLimits: '<?', // the limits stop the typing (value-max-length; max/min of a number), not only show an error; off by default
            prefixIcon: '@?',    // icon classes shown in the box before the text (e.g. "fa fa-search")
            prefixText: '@?',    // a short text shown in the box before the text (e.g. "#")
            suffixIcon: '@?',    // icon classes shown in the box after the text
            suffixText: '@?',    // a short text shown in the box after the text (a unit: "kg", "%")
            showPassword: '<?',  // input-type="password": an eye button shows / hides the password; off by default
            autocomplete: '@?',  // the box's autocomplete: "off" unless given (no browser list of earlier entries; "on" or a
                                 // token such as "email" or "username" brings it back); a password box: "current-password"
            inputmode: '@?',     // the box's inputmode: the keyboard of a phone ("numeric", "decimal", "tel", "email")
            autofocus: '<?',     // the box takes the focus once it is shown; off by default
            spellcheck: '<?',    // the browser's spell check of the box (a password box: always off); the browser's default unless given
            precision: '@?',     // input-type="number": at most this many decimals ("0": whole numbers); unset: no limit
            api: '<?',           // object that receives methods: focus, blur, clear, select
            onClear: '&?',       // after the value was cleared (the clear button or api.clear()): $event
            onFocus: '&?',       // the box took the focus: $event, $value
            onBlur: '&?',        // the box lost the focus: $event, $value (before on-finish of the blur)
            hintText: '@?',      // the message line under the field: a hint (see auiFieldExtras)
            errorText: '@?',     // the message line: one text for any failed check, while the field shows invalid
            errorMessages: '<?', // the message line: a text per check, {required: '...', maxlength: 'At most {length}'}
            showErrors: '<?',    // the message line with the shared texts (auiFieldMessages); off by default
            size: '@?',          // "small" (28px) or "large" (40px); unset: 34px
            labelPosition: '@?', // "top": the label above the box (form style), instead of in it
            search: '<?',        // a search field: the search icon, role searchbox, on-search; off by default
            onSearch: '&?',      // search: on Enter, when cleared, and with search-debounce while typing: $value
            searchDebounce: '@?',// search: also on-search this many ms after typing pauses; unset: Enter and clear only
            searching: '<?',     // search: the search runs (the selects' spinner in place of the icon, aria-busy)
            rows: '@?',          // aui-textarea: the lines shown (3 unless set)
            autoHeight: '<?',    // aui-textarea: grows with its text, from rows up to max-rows; off by default
            maxRows: '@?',       // aui-textarea with auto-height: the most lines before it scrolls (8 unless set)
            labelText: '@?',
            borderRounded: '<?',
            borderRoundedLeftNone: '<?',
            borderRoundedRightNone: '<?'
        },
        // The box (the inner <input>) sits in a form of its own (ng-form + aui-input-box-form), taken out of the page form:
        // the page form knows the host's ngModel only (see "The box's checks" in the controller). The box's ngModel takes
        // none of the field's ng-model-options (ng-model-options="{}" on it: AngularJS 1.5 hands them to every ngModel
        // inside the element): the field's updateOn, debounce and getterSetter act on the field's ngModel only, once.
        // Only the part of the template that the field's style and type use is kept (basic; the form and cell styles'
        // box; aui-textarea's box): Angular compiles a field's whole template, every part, for each field, so a page
        // with many fields paid for all three. A style or type set from an expression ({{...}}) keeps every part.
        template: ['$attrs', function ($attrs) {
            const html = `
                  <div class="aui-input {{ $ctrl.rootClass }}"
                       ng-class="{'aui-input--clearable-active': $ctrl.opt.clearable && $ctrl.hasValue() && !$ctrl.opt.disabled && !$ctrl.opt.readonly}"
                       style="--aui-input-border-radius: {{$ctrl.borderRadiusStyleVal}};"
                       ng-style="$ctrl.wrapperStyle">
                        <!--aui-part:basic-->
                        <div class="aui-input-container" aui-if="$ctrl.inputStyleType === 'basic' " ng-form aui-input-box-form
                             ng-class="{'aui-input-container--invalid': $ctrl.showInvalid()}">
                            <span class="aui-input__affix aui-input__affix--prefix"
                                  aui-if="$ctrl.prefixIcon || $ctrl.prefixText || $ctrl.isSearch()"
                                  ng-mousedown="$ctrl.focusBox($event)"><span aui-if="$ctrl.isSearching()" class="aui-select__spinner aui-input__search-spinner" aria-hidden="true"></span><svg aui-if="$ctrl.isSearch() && !$ctrl.isSearching() && !$ctrl.prefixIcon" class="aui-input__search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><i aui-if="$ctrl.prefixIcon && !$ctrl.isSearching()" class="aui-input__affix-icon {{ $ctrl.prefixIcon }}" aria-hidden="true"></i><span aui-if="$ctrl.prefixText" class="aui-input__affix-text" id="{{::'prefix-' + $ctrl.compId}}">{{ $ctrl.prefixText }}</span></span>
                            <input
                                  id="{{::'input-' + $ctrl.compId}}"
                                  name="{{$ctrl.name}}"
                                  class="aui-input-field"
                                  ng-model="$ctrl.internalValue"
                                  ng-model-options="{}"
                                  aui-input-box
                                  ng-disabled="$ctrl.opt.disabled"
                                  ng-readonly="$ctrl.opt.readonly"
                                  ng-change="$ctrl._onChange()"
                                  ng-blur="$ctrl._onBlur($event)"
                                  ng-keydown="$ctrl._interceptKey($event); $ctrl._onKeyDown($event)"
                                  ng-paste="$ctrl._interceptPaste($event)"
                                  ng-attr-placeholder="{{$ctrl.placeholder}}"
                                  ng-attr-type="{{ $ctrl.boxType() }}"
                                  ng-maxlength="$ctrl.lengthCheck()"
                                  ng-attr-min="{{$ctrl.min || undefined}}"
                                  ng-attr-max="{{$ctrl.max || undefined}}"

                                  ng-attr-pattern="{{$ctrl.pattern || undefined}}"
                                  >
                            <label for="{{::'input-' + $ctrl.compId}}" class="aui-input-label">{{$ctrl.placeholder}}</label>
                            <span class="aui-input-highlight"></span>
                            <span class="aui-control-clear"
                                  aui-if="$ctrl.opt.clearable"
                                  ng-class="{'aui-control-clear--hidden': !$ctrl.hasValue() || $ctrl.opt.disabled || $ctrl.opt.readonly}"
                                  ng-click="$ctrl.clearValue($event)"
                                  ng-mousedown="$event.preventDefault()"
                                  ng-keydown="$ctrl.onClearKeydown($event)"
                                  tabindex="{{ (!$ctrl.hasValue() || $ctrl.opt.disabled || $ctrl.opt.readonly) ? -1 : 0 }}"
                                  role="button"
                                  aria-label="{{ ::$ctrl.t.clearLabel }}"
                                  title="{{ ::$ctrl.t.clear }}">
                                <svg class="aui-control-clear-svg" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle class="aui-control-clear-bg" cx="10" cy="10" r="10"/>
                                    <path class="aui-control-clear-cross" d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke-linecap="round"/>
                                </svg>
                            </span>
                            <span class="aui-input__affix aui-input__affix--suffix"
                                  aui-if="$ctrl.suffixIcon || $ctrl.suffixText"
                                  ng-mousedown="$ctrl.focusBox($event)"><span aui-if="$ctrl.suffixText" class="aui-input__affix-text" id="{{::'suffix-' + $ctrl.compId}}">{{ $ctrl.suffixText }}</span><i aui-if="$ctrl.suffixIcon" class="aui-input__affix-icon {{ $ctrl.suffixIcon }}" aria-hidden="true"></i></span>
                            <span class="aui-input__eye"
                                  aui-if="$ctrl.hasEye()"
                                  ng-class="{'aui-input__eye--on': $ctrl.passwordShown}"
                                  role="button"
                                  tabindex="0"
                                  aria-label="{{ ::$ctrl.t.showPassword }}"
                                  title="{{ ::$ctrl.t.showPassword }}"
                                  aria-pressed="{{ $ctrl.passwordShown }}"
                                  aria-controls="{{::'input-' + $ctrl.compId}}"
                                  ng-mousedown="$event.preventDefault()"
                                  ng-click="$ctrl.togglePassword($event)"
                                  ng-keydown="$ctrl.onEyeKeydown($event)">
                                <svg class="aui-input__eye-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                    <path class="aui-input__eye-slash" d="M4 4l16 16"/>
                                </svg>
                            </span>
                            <span class="aui-input__count"
                                  aui-if="$ctrl.isCountShown()"
                                  id="{{::'count-' + $ctrl.compId}}"
                                  ng-class="{'aui-input__count--over': $ctrl.isCountOver()}">{{ $ctrl.countText() }}</span>
                        </div>
                        <!--/aui-part:basic-->
                        <!--aui-part:top-->
                        <label class="aui-field-label"
                               aui-if="$ctrl.isBoxStyle() && !$ctrl.isCell() && $ctrl.field.isLabelTop() && $ctrl.opt.showLabel && ($ctrl.labelText || $ctrl.placeholder)"
                               for="{{::'input-' + $ctrl.compId}}">{{$ctrl.labelText || $ctrl.placeholder}}</label>
                        <!--/aui-part:top-->
                        <!--aui-part:box-->
                        <div class="aui-input__form-trigger"
                             aui-if="$ctrl.isBoxStyle() && !$ctrl.isTextarea()"
                             ng-form aui-input-box-form
                             ng-class="{'aui-input__form-trigger--invalid': $ctrl.showInvalid()}"
                             ng-style="{'border-radius': $ctrl.borderRadiusStyleVal}">
                            <label aui-if="$ctrl.opt.showLabel && ($ctrl.labelText || $ctrl.placeholder) && !$ctrl.field.isLabelTop() && !$ctrl.isCell()"
                                   for="{{::'input-' + $ctrl.compId}}"
                                   class="aui-control-label">{{$ctrl.labelText || $ctrl.placeholder}}</label>
                            <span class="aui-input__affix aui-input__affix--prefix"
                                  aui-if="$ctrl.prefixIcon || $ctrl.prefixText || $ctrl.isSearch()"
                                  ng-mousedown="$ctrl.focusBox($event)"><span aui-if="$ctrl.isSearching()" class="aui-select__spinner aui-input__search-spinner" aria-hidden="true"></span><svg aui-if="$ctrl.isSearch() && !$ctrl.isSearching() && !$ctrl.prefixIcon" class="aui-input__search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><i aui-if="$ctrl.prefixIcon && !$ctrl.isSearching()" class="aui-input__affix-icon {{ $ctrl.prefixIcon }}" aria-hidden="true"></i><span aui-if="$ctrl.prefixText" class="aui-input__affix-text" id="{{::'prefix-' + $ctrl.compId}}">{{ $ctrl.prefixText }}</span></span>
                            <input id="{{::'input-' + $ctrl.compId}}"
                                  name="{{$ctrl.name}}"
                                  class="aui-input__form-field"
                                  ng-model="$ctrl.internalValue"
                                  ng-model-options="{}"
                                  aui-input-box
                                  ng-disabled="$ctrl.opt.disabled"
                                  ng-readonly="$ctrl.opt.readonly"
                                  ng-change="$ctrl._onChange()"
                                  ng-blur="$ctrl._onBlur($event)"
                                  ng-keydown="$ctrl._interceptKey($event); $ctrl._onKeyDown($event)"
                                  ng-paste="$ctrl._interceptPaste($event)"
                                  ng-attr-placeholder="{{$ctrl.placeholder}}"
                                  ng-attr-type="{{ $ctrl.boxType() }}"
                                  ng-maxlength="$ctrl.lengthCheck()"
                                  ng-attr-min="{{$ctrl.min || undefined}}"
                                  ng-attr-max="{{$ctrl.max || undefined}}"
                                  ng-attr-pattern="{{$ctrl.pattern || undefined}}">
                            <span class="aui-control-clear"
                                  aui-if="$ctrl.opt.clearable"
                                  ng-class="{'aui-control-clear--hidden': !$ctrl.hasValue() || $ctrl.opt.disabled || $ctrl.opt.readonly}"
                                  ng-click="$ctrl.clearValue($event)"
                                  ng-mousedown="$event.preventDefault()"
                                  ng-keydown="$ctrl.onClearKeydown($event)"
                                  tabindex="{{ (!$ctrl.hasValue() || $ctrl.opt.disabled || $ctrl.opt.readonly) ? -1 : 0 }}"
                                  role="button"
                                  aria-label="{{ ::$ctrl.t.clearLabel }}"
                                  title="{{ ::$ctrl.t.clear }}">
                                <svg class="aui-control-clear-svg" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle class="aui-control-clear-bg" cx="10" cy="10" r="10"/>
                                    <path class="aui-control-clear-cross" d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke-linecap="round"/>
                                </svg>
                            </span>
                            <span class="aui-input__affix aui-input__affix--suffix"
                                  aui-if="$ctrl.suffixIcon || $ctrl.suffixText"
                                  ng-mousedown="$ctrl.focusBox($event)"><span aui-if="$ctrl.suffixText" class="aui-input__affix-text" id="{{::'suffix-' + $ctrl.compId}}">{{ $ctrl.suffixText }}</span><i aui-if="$ctrl.suffixIcon" class="aui-input__affix-icon {{ $ctrl.suffixIcon }}" aria-hidden="true"></i></span>
                            <span class="aui-input__eye"
                                  aui-if="$ctrl.hasEye()"
                                  ng-class="{'aui-input__eye--on': $ctrl.passwordShown}"
                                  role="button"
                                  tabindex="0"
                                  aria-label="{{ ::$ctrl.t.showPassword }}"
                                  title="{{ ::$ctrl.t.showPassword }}"
                                  aria-pressed="{{ $ctrl.passwordShown }}"
                                  aria-controls="{{::'input-' + $ctrl.compId}}"
                                  ng-mousedown="$event.preventDefault()"
                                  ng-click="$ctrl.togglePassword($event)"
                                  ng-keydown="$ctrl.onEyeKeydown($event)">
                                <svg class="aui-input__eye-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                    <path class="aui-input__eye-slash" d="M4 4l16 16"/>
                                </svg>
                            </span>
                            <span class="aui-input__count"
                                  aui-if="$ctrl.isCountShown()"
                                  id="{{::'count-' + $ctrl.compId}}"
                                  ng-class="{'aui-input__count--over': $ctrl.isCountOver()}">{{ $ctrl.countText() }}</span>
                        </div>
                        <!--/aui-part:box-->
                        <!--aui-part:textarea-->
                        <!-- aui-textarea (input-type="textarea"): the form style's box around a <textarea>; the label in the
                             box at its top, the clear button at its top right, the count at its bottom right -->
                        <div class="aui-input__form-trigger aui-input__form-trigger--textarea"
                             aui-if="$ctrl.isTextarea()"
                             ng-form aui-input-box-form
                             ng-class="{'aui-input__form-trigger--invalid': $ctrl.showInvalid()}"
                             ng-style="{'border-radius': $ctrl.borderRadiusStyleVal}">
                            <label aui-if="$ctrl.opt.showLabel && ($ctrl.labelText || $ctrl.placeholder) && !$ctrl.field.isLabelTop()"
                                   for="{{::'input-' + $ctrl.compId}}"
                                   class="aui-control-label">{{$ctrl.labelText || $ctrl.placeholder}}</label>
                            <textarea id="{{::'input-' + $ctrl.compId}}"
                                  name="{{$ctrl.name}}"
                                  class="aui-input__form-field aui-input__textarea"
                                  rows="{{ $ctrl.rowsValue() }}"
                                  ng-model="$ctrl.internalValue"
                                  ng-model-options="{}"
                                  aui-input-box
                                  ng-disabled="$ctrl.opt.disabled"
                                  ng-readonly="$ctrl.opt.readonly"
                                  ng-change="$ctrl._onChange()"
                                  ng-blur="$ctrl._onBlur($event)"
                                  ng-keydown="$ctrl._onKeyDown($event)"
                                  ng-attr-placeholder="{{$ctrl.placeholder}}"
                                  ng-maxlength="$ctrl.lengthCheck()"
                                  ng-attr-pattern="{{$ctrl.pattern || undefined}}"></textarea>
                            <span class="aui-control-clear"
                                  aui-if="$ctrl.opt.clearable"
                                  ng-class="{'aui-control-clear--hidden': !$ctrl.hasValue() || $ctrl.opt.disabled || $ctrl.opt.readonly}"
                                  ng-click="$ctrl.clearValue($event)"
                                  ng-mousedown="$event.preventDefault()"
                                  ng-keydown="$ctrl.onClearKeydown($event)"
                                  tabindex="{{ (!$ctrl.hasValue() || $ctrl.opt.disabled || $ctrl.opt.readonly) ? -1 : 0 }}"
                                  role="button"
                                  aria-label="{{ ::$ctrl.t.clearLabel }}"
                                  title="{{ ::$ctrl.t.clear }}">
                                <svg class="aui-control-clear-svg" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle class="aui-control-clear-bg" cx="10" cy="10" r="10"/>
                                    <path class="aui-control-clear-cross" d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke-linecap="round"/>
                                </svg>
                            </span>
                            <span class="aui-input__count"
                                  aui-if="$ctrl.isCountShown()"
                                  id="{{::'count-' + $ctrl.compId}}"
                                  ng-class="{'aui-input__count--over': $ctrl.isCountOver()}">{{ $ctrl.countText() }}</span>
                        </div>
                        <!--/aui-part:textarea-->
                        <div class="aui-field-message"
                             aui-if="$ctrl.field.hasMessageLine()"
                             id="{{ $ctrl.field.messageId() }}"
                             aria-live="polite"
                             ng-class="{'aui-field-message--error': $ctrl.field.messageIsError()}"><span aui-if="!$ctrl.field.messageIsError()">{{ $ctrl.field.messageText() }}</span><span aui-if="$ctrl.field.messageIsError()" class="aui-field-message__error">{{ $ctrl.field.messageText() }}</span></div>
                  </div>
                  `;
            const style = String($attrs.inputStyleType || '');
            const type = String($attrs.inputType || '');
            if (style.indexOf('{{') >= 0 || type.indexOf('{{') >= 0) return html;   // known only at run time
            const parts = type === 'textarea' ? ['top', 'textarea'] : (style === 'form' || style === 'cell') ? ['top', 'box'] : ['basic'];
            return html.replace(/<!--aui-part:(\w+)-->([\s\S]*?)<!--\/aui-part:\1-->/g,
                (all, part, body) => parts.indexOf(part) >= 0 ? body : '');
        }],
        controller: ['$scope', '$element', '$attrs', '$timeout', 'auiControlKit', 'auiFieldExtras', 'auiTexts',
            function($scope, $element, $attrs, $timeout, kit, fieldExtras, texts) {
            const $ctrl = this;
            $ctrl.t = texts.input;
            $ctrl.compId = 'aui-input-' + $scope.$id;
            $ctrl.opt = {};
            $ctrl.passwordShown = false;   // show-password: the password is shown as text now

            // the message line, size and label-position (shared with the selects)
            $ctrl.field = fieldExtras.create({
                ctrl: $ctrl,
                attrs: $attrs,
                ngModel: () => $ctrl.ngModelCtrl,
                invalidShown: () => $ctrl.showInvalid(),
                limits: () => ({length: countLimit() || null, min: $ctrl.min, max: $ctrl.max, precision: readPrecision()}),
                id: () => $ctrl.compId
            });

            const STYLES = ['basic', 'form', 'cell'];

            /**
             * The options, read as aui-select and aui-tree-select read theirs (kit.readFlag): a bare attribute
             * (`<aui-input show-label readonly>`) is on; an expression or 'true'/'false' counts as given. Read again on
             * every change of a binding, and never written back into the bindings.
             */
            function readOptions() {
                const opt = $ctrl.opt;
                // the style: basic, form or cell; empty or unknown, the default basic style (a field always has its box)
                if (STYLES.indexOf($ctrl.inputStyleType) < 0) $ctrl.inputStyleType = 'basic';
                opt.disabled = kit.readFlag($attrs, 'disabled', $ctrl.disabled, false);
                opt.readonly = kit.readFlag($attrs, 'readonly', $ctrl.readonly, false);
                opt.showLabel = kit.readFlag($attrs, 'showLabel', $ctrl.showLabel, false);
                opt.clearable = kit.readFlag($attrs, 'clearable', $ctrl.clearable, false);
                opt.showCount = kit.readFlag($attrs, 'showCount', $ctrl.showCount, false);
                opt.enforceLimits = kit.readFlag($attrs, 'enforceLimits', $ctrl.enforceLimits, false);
                opt.showPassword = kit.readFlag($attrs, 'showPassword', $ctrl.showPassword, false);
                opt.autofocus = kit.readFlag($attrs, 'autofocus', $ctrl.autofocus, false);
                opt.spellcheck = kit.readFlag($attrs, 'spellcheck', $ctrl.spellcheck, null);   // null: the browser's default
                opt.search = kit.readFlag($attrs, 'search', $ctrl.search, false);
                opt.searching = kit.readFlag($attrs, 'searching', $ctrl.searching, false);
                opt.autoHeight = kit.readFlag($attrs, 'autoHeight', $ctrl.autoHeight, false);
                opt.textBold = kit.readFlag($attrs, 'inputTextBold', $ctrl.inputTextBold, false);
                // hidden again when it can no longer be hidden by the user, or the box is no password box
                if (!$ctrl.hasEye()) $ctrl.passwordShown = false;
                // corners as aui-select's (right-none wins over left-none)
                $ctrl.borderRadiusStyleVal = kit.borderRadius(
                    kit.readFlag($attrs, 'borderRounded', $ctrl.borderRounded, true),
                    kit.readFlag($attrs, 'borderRoundedLeftNone', $ctrl.borderRoundedLeftNone, false),
                    kit.readFlag($attrs, 'borderRoundedRightNone', $ctrl.borderRoundedRightNone, false));
                readWidth();
                // a search waiting for typing to pause is dropped once it can no longer come (disabled, no pause set)
                if ($ctrl.opt.disabled || !$ctrl.isSearch() || !readWhole($ctrl.searchDebounce, 0)) cancelPendingSearch();
                syncNativeLimit();
                syncTrim();
                syncStaticBoxAttrs();
                refreshRootClass();
                recheckPrecision();
                queueTakeOver();   // a limit or check may have changed (the box checks again in this digest)
            }

            // width (px): the field's width, read again when it changes
            let shownWidth = null;
            function readWidth() {
                const width = $ctrl.width ? String($ctrl.width) : '';
                if (width === shownWidth) return;
                shownWidth = width;
                $ctrl.wrapperStyle = width ? {width: width + 'px'} : {};
            }

            /*
             * The root's classes, from the options only (the style, the type, the options set, size, label-position):
             * worked out when an option changes, not in every digest (one ng-class of them all cost every field the
             * whole object, built and compared, on each digest). The one class that follows the value
             * (aui-input--clearable-active) stays in the template's ng-class.
             */
            function refreshRootClass() {
                const opt = $ctrl.opt;
                const classes = [];
                const add = (on, name) => { if (on) classes.push('aui-input--' + name); };
                add($ctrl.inputStyleType === 'basic', 'basic');
                add($ctrl.isBoxStyle(), 'form');
                add($ctrl.isCell(), 'cell');
                add($ctrl.isTextarea(), 'textarea');
                add($ctrl.isTextarea() && opt.autoHeight, 'auto-height');
                add($ctrl.isSearch(), 'search');
                add(opt.disabled, 'disabled');
                add(opt.readonly, 'readonly');
                add(opt.showLabel, 'with-label');
                add($ctrl.isCountShown(), 'with-count');
                add($ctrl.isRowLayout(), 'row');
                add($ctrl.hasEye(), 'with-eye');
                add($ctrl.field.size() === 'small', 'small');
                add($ctrl.field.size() === 'large', 'large');
                add($ctrl.field.isLabelTop(), 'label-top');
                // input-text-bold: a class, not an inline style (the boxes' weight and colour are !important against a
                // page's rules, which an inline style cannot win over)
                add(opt.textBold, 'text-bold');
                $ctrl.rootClass = classes.join(' ');
            }

            /** required / ng-required on the host, as Angular's required check reads it (aria-required, as the tree). */
            $ctrl.isRequired = () => !!$attrs.required;

            const isNumberType = () => $ctrl.inputType === 'number';
            $ctrl.isPassword = () => $ctrl.inputType === 'password';

            // the styles: form (a box) and cell (the box of a table cell) share the box; aui-textarea is the form style
            // around a <textarea> (its own tag, see auiTextarea: input-type="textarea" input-style-type="form")
            $ctrl.isCell = () => $ctrl.inputStyleType === 'cell';
            $ctrl.isTextarea = () => $ctrl.inputType === 'textarea';
            // (a textarea is always in the box, whatever input-style-type says)
            $ctrl.isBoxStyle = () => $ctrl.inputStyleType === 'form' || $ctrl.isCell() || $ctrl.isTextarea();
            $ctrl.isSearch = () => !!$ctrl.opt.search && !$ctrl.isTextarea();
            $ctrl.isSearching = () => $ctrl.isSearch() && !!$ctrl.opt.searching;

            const readWhole = (raw, fallback) => {
                const value = parseInt(raw, 10);
                return value > 0 ? value : fallback;
            };
            $ctrl.rowsValue = () => readWhole($ctrl.rows, 3);

            /*
             * A password box is never trimmed (ng-trim="false" on it): Angular reads the box's type when it links it,
             * before the type attribute is set, so it took the box for a text box and cut the spaces around a password.
             *
             * show-password. While shown, the box is a text box (still not trimmed). Shown only while the user is in the
             * field: it is hidden again once the focus
             * leaves the field (a click on the page's save button included), and before Enter acts (a form submitted
             * with Enter), so that a password is never sent, saved or left on the screen as plain text.
             */
            $ctrl.hasEye = () => $ctrl.isPassword() && !!$ctrl.opt.showPassword && !$ctrl.opt.disabled;

            // the text-like types only: another one (file, checkbox, range, date...) is a control of its own, which
            // this field's value, clear, length and number handling do not fit; it gives a text box
            $ctrl.boxType = () => ($ctrl.isPassword() && $ctrl.passwordShown) ? 'text'
                : (/^(text|password|number|email|tel|url|search)$/.test($ctrl.inputType) ? $ctrl.inputType : 'text');

            const hidePassword = () => {
                if (!$ctrl.passwordShown) return;
                $ctrl.passwordShown = false;
                // at once (the digest that changes the type attribute can come after the browser acted)
                if (boxEl && $ctrl.isPassword()) boxEl.type = 'password';
            };

            /*
             * The box takes no action of the field's (clearing, showing the password, the focus): disabled by the field,
             * or by a disabled fieldset around it - the box is :disabled then, while the field's own disabled option is
             * off. (Its clear button and eye are hidden then as well: input.css.)
             */
            const boxLocked = () => !!$ctrl.opt.disabled || (!!boxEl && typeof boxEl.matches === 'function' && boxEl.matches(':disabled'));

            $ctrl.togglePassword = ($event) => {
                if ($event && $event.stopPropagation) $event.stopPropagation();
                if (!$ctrl.hasEye()) return;
                if ($ctrl.passwordShown) {
                    hidePassword();
                    return;
                }
                if (boxLocked()) return;
                $ctrl.passwordShown = true;
                // shown while the user is in the field only: a press on the eye from outside the field (the eye keeps
                // the focus where it is) brings the focus into the box, so that leaving the field hides it again
                if (boxEl && !$element[0].contains(document.activeElement)) boxEl.focus();
            };

            $ctrl.onEyeKeydown = ($event) => {
                const keyCode = $event.which || $event.keyCode;
                if (keyCode === 13 || keyCode === 32 || $event.key === 'Enter' || $event.key === ' ') {
                    $event.preventDefault();
                    $ctrl.togglePassword($event);
                }
            };

            const isInField = (element) => !!element && $element[0].contains(element);

            // the focus left the whole field (not for the eye or the clear button inside it): the password is hidden; left
            // from the clear button or the eye, the field is finished here (left from the box: _onBlur)
            const onFieldFocusOut = (event) => {
                if (isInField(event.relatedTarget)) return;
                if ($ctrl.passwordShown) $scope.$evalAsync(hidePassword);
                if (event.target !== boxEl) $scope.$evalAsync(leaveField);
            };

            // the box's attributes the page can pass through: unset, they stay off the box (the browser's default)
            // autocomplete: off unless the page asks. The browser's list of what was typed before in boxes of this name
            // stays closed: on a shared PC it showed one user's entries (names, phones) to the next, and it covered the
            // family's own panels. A password box keeps "current-password" (the password manager fills it). Saved
            // addresses and passwords may still be offered by the browser for boxes it recognizes: its own choice.
            $ctrl.autocompleteValue = () => $ctrl.autocomplete || ($ctrl.isPassword() ? 'current-password' : 'off');

            $ctrl.spellcheckValue = () => {
                if ($ctrl.isPassword()) return 'false';   // no password text goes to a spell checker
                return $ctrl.opt.spellcheck === null || $ctrl.opt.spellcheck === undefined ? undefined : String(!!$ctrl.opt.spellcheck);
            };

            /*
             * precision (a number box): at most this many decimals, "0" for whole numbers; unset (or not a whole number
             * from 0 to 15): no limit, as before. Typing or pasting more decimals is undone (onBoxInput), a page value with
             * more is invalid (the box's "precision" check), and the box's step matches, so that the browser's own
             * check of the number agrees.
             */
            const readPrecision = () => {
                if ($ctrl.precision === undefined || $ctrl.precision === null || String($ctrl.precision).trim() === '') return null;
                const places = Number($ctrl.precision);
                return Number.isInteger(places) && places >= 0 && places <= 15 ? places : null;
            };

            // the decimals of a number's text, its exponent included (a page value 0.0000001 is the text "1e-7")
            const decimalsOf = (text) => {
                const match = /^[^.eE]*(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(text).trim());
                if (!match) return 0;
                return Math.max(0, (match[1] || '').length - (match[2] ? Number(match[2]) : 0));
            };

            /*
             * The number box's step, for the browser's own check of a form it submits and for the arrow keys. The browser
             * counts the steps from min, and without a step attribute takes 1: a valid 1.5 would stop the form's native
             * submit. With precision: one step per last decimal; without, or with a min off that grid: "any" (the
             * decimals are this field's precision check).
             */
            $ctrl.stepValue = () => {
                if (!isNumberType()) return undefined;
                const places = readPrecision();
                const minText = String($ctrl.min === undefined || $ctrl.min === null ? '' : $ctrl.min).trim();
                if (places === null || (minText !== '' && decimalsOf(minText) > places)) return 'any';
                return places === 0 ? '1' : '0.' + '0'.repeat(places - 1) + '1';
            };

            // precision changed: the box checks its value again (min, max, pattern and the length check their own)
            let checkedPrecision = null;
            function recheckPrecision() {
                const places = readPrecision();
                if (places === checkedPrecision) return;
                checkedPrecision = places;
                if (box) box.$validate();
            }

            $ctrl.isCountShown = () => !!$ctrl.opt.showCount && !$ctrl.isPassword();   // a password's length is not shown

            // the box's row holds more than the text and the clear button: all of them in the flow, nothing over the text
            // (not a textarea: its clear button and count stand in its corners)
            $ctrl.isRowLayout = () => !$ctrl.isTextarea() && ($ctrl.isCountShown() || $ctrl.isSearch() ||
                !!($ctrl.prefixIcon || $ctrl.prefixText || $ctrl.suffixIcon || $ctrl.suffixText) || $ctrl.hasEye());

            // the texts that tell more about the box: the count, the prefix and suffix texts (a unit; a textarea has none),
            // the message line, and the page's own aria-describedby on the field
            $ctrl.describedBy = () => {
                const ids = [];
                if ($ctrl.isCountShown()) ids.push('count-' + $ctrl.compId);
                if ($ctrl.prefixText && !$ctrl.isTextarea()) ids.push('prefix-' + $ctrl.compId);
                if ($ctrl.suffixText && !$ctrl.isTextarea()) ids.push('suffix-' + $ctrl.compId);
                if ($ctrl.field.hasMessageLine()) ids.push($ctrl.field.messageId());
                if ($attrs.ariaDescribedby) ids.push(String($attrs.ariaDescribedby).trim());
                return ids.length ? ids.join(' ') : undefined;
            };

            /*
             * The box's accessible name, as aria-label: the page's aria-label on the field, else label-text (it names the
             * field with or without show-label, in every style), else in the basic style its placeholder (its caption,
             * the label element there, is hidden at rest, and a hidden label left the box without a name). A label of
             * the form style that shows names the box by itself, with the same text. The page's aria-labelledby on the
             * field goes on the box as it is, and wins over aria-label.
             */
            $ctrl.boxLabel = () => $attrs.ariaLabel || $ctrl.labelText ||
                ($ctrl.inputStyleType === 'basic' ? $ctrl.placeholder : '') || undefined;

            // a press on a prefix or suffix puts the caret in the box, as a press on the box would
            $ctrl.focusBox = ($event) => {
                if ($event && $event.preventDefault) $event.preventDefault();
                if (boxEl && !boxLocked()) boxEl.focus();
            };

            /*
             * A press inside the field's frame but outside its box (the frame's padding around the box, the count, the
             * label in the box) puts the caret in the box, as a press on a native field's padding does. The box is
             * smaller than the frame (24px in 34px): such a press left the focus where it was (a dialog around the field
             * kept it), and the browser put a blinking caret at the end of the placeholder, where nothing could be typed.
             * The clear button and the eye act on their own; the prefix and suffix already do this (focusBox). A disabled
             * field is left to the browser, as a native disabled field is (its caret is hidden by its CSS). A native
             * listener: no page digest for a press.
             */
            const onFramePress = (event) => {
                if (event.button !== 0 || event.defaultPrevented || !boxEl || event.target === boxEl || boxLocked()) return;
                const target = event.target;
                const frame = target.closest ? target.closest('.aui-input__form-trigger, .aui-input-container') : null;
                if (!frame || !frame.contains(boxEl) || target.closest('[role="button"]')) return;
                event.preventDefault();   // no caret placed by the browser, the focus not taken elsewhere
                boxEl.focus();
            };

            /*
             * The value the host is given. An empty number box (the box's own value is null, the clear button sets '')
             * is no value: undefined, not a parse error. The host's number parser turns '' and null into a parse error,
             * which made the whole form invalid once an optional number field had been emptied; undefined passes the
             * parsers by, as Angular has it, so the field is just empty (and required still catches it).
             */
            const toHostView = (value) => (isNumberType() && (value === '' || value === null || value === undefined)) ? undefined : value;

            /*
             * The value the box shows. A number box shows numbers only (Angular's number formatter throws on anything
             * else, `ngModel:numfmt`, and the box stays empty): a numeric text from the page ("12", " 12.5 ") is shown
             * as its number, any other text as nothing. The model itself is left as it is.
             */
            const toBoxValue = (value) => {
                if (!isNumberType() || typeof value !== 'string') return value;
                const text = value.trim();
                if (text === '') return undefined;
                const number = Number(text);
                return isFinite(number) ? number : undefined;
            };

            this.$onInit = () => {
                $ctrl.placeholder = $ctrl.placeholder || '';

                readOptions();   // (the style too: basic unless form or cell)
                kit.followNgFlags($attrs, readOptions);
                // the page's aria-label / aria-labelledby / aria-describedby on the field go on the box (see boxLabel)
                ['ariaLabel', 'ariaLabelledby', 'ariaDescribedby'].forEach(name => {
                    if ($attrs[name] !== undefined) $attrs.$observe(name, syncStaticBoxAttrs);
                });

                if (!$ctrl.name) {
                    $ctrl.name = $ctrl.compId;
                }


                if ($ctrl.ngModelCtrl) {
                    if ($ctrl.inputType === 'number') {
                        $ctrl.ngModelCtrl.$parsers.push(function (viewValue) {
                            if (viewValue === '' || viewValue === null) return undefined;
                            const num = Number(viewValue);
                            return isFinite(num) ? num : undefined;
                        });
                    }
                }

            };

            this.$onChanges = () => {
                readOptions();
            };

            /*
             * The box's checks. The box (the inner <input>) has an ngModel of its own, which runs the checks of its
             * attributes: pattern, value-max-length (ng-maxlength), min/max and the number/email/url types. That ngModel
             * stays out of the page form (aui-input-box-form): the page form knows the host's ngModel only, so that
             * form.<name> is the field the page declared, with its required error and touched state. The host takes the
             * box's results over, under the same names: form.<name>.$error.pattern, form.$invalid and the invalid look
             * see them. A host validator of the same name (Angular's pattern directive also acts on the host's `pattern`
             * attribute) is combined with the box's result. Only validity is set: the model is never written here.
             */
            let box = null;            // the box's ngModel, while its style is shown
            let boxEl = null;          // the box's <input>
            let clearing = false;      // clearValue is putting '' into the box
            let reportedText = null;   // the text on-change last told the page of (or the page's value shown)
            let takenOver = {};        // the box errors the host carries now, by name
            const combined = {};       // the host validators combined with the box's result, by name

            /*
             * The mouse wheel over a focused number box steps its value in Chromium, and the page or the list around it
             * does not scroll: a value typed in, then the list scrolled with the wheel, would change by one per notch,
             * unseen. The box is left instead (as a click elsewhere leaves it: touched, on-finish with blur), and the
             * wheel scrolls the page as it does everywhere else. Not for Ctrl + wheel (the page zoom) or a readonly box.
             * Blocking the wheel event instead keeps the value too, but the page then does not scroll at all.
             */
            const onBoxWheel = (event) => {
                const input = event.currentTarget;
                if (!isNumberType() || event.ctrlKey || input.readOnly || document.activeElement !== input) return;
                input.blur();
            };

            /*
             * enforce-limits (off unless set) on a text: the box's own maxlength is value-max-length, so the browser types
             * and pastes no further (a longer paste is cut). It is the box's DOM attribute only: Angular's value-max-length
             * check stays as it is. A number box: see onBoxInput.
             */
            function syncNativeLimit() {
                if (!boxEl) return;
                const limit = countLimit();
                if ($ctrl.opt.enforceLimits && limit > 0 && !isNumberType()) boxEl.setAttribute('maxlength', String(limit));
                else boxEl.removeAttribute('maxlength');
            }

            let textBefore = null;     // the number box's text before the edit under way (beforeinput)
            const onBoxBeforeInput = (event) => {
                textBefore = event.currentTarget.value;
            };

            /*
             * A number box's edit - a key, a paste, a drop, text an input method or the browser puts in - is undone before
             * Angular reads it when it takes the number further from what the field accepts:
             * - longer than value-max-length (a number box has no maxlength of its own; its text is counted as the count
             *   and the check count it, the minus and the point included);
             * - more decimals than precision allows;
             * - with enforce-limits: further out of reach, above max or below a min under zero (a number between zero and
             *   a min above it stays: its next digit can bring it in).
             * An edit that brings the number closer is kept, so a value from the page beyond a limit can be corrected
             * digit by digit. Undone, the caret goes to the end of the text: a number box has no caret API to keep it.
             * Checked after the edit, not on its key: every way of entering text is covered, and a selection the browser
             * does not report for a number box (Firefox) cannot make a replacing key look like one too many.
             */
            const onBoxInput = (event) => {
                const input = event.target;
                if (input !== boxEl) return;
                const before = textBefore;
                textBefore = null;
                if (!isNumberType() || before === null || input.value === '') return;
                if (!movesFurtherOut(before, input.value)) return;
                input.value = before;
                event.stopImmediatePropagation();   // Angular's own input listener of the box does not see the edit
            };

            const numberLength = (text) => String(text).replace(/\s+/g, '').length;

            // how far a number is out of reach of enforce-limits (0: within it)
            const reachGap = (number) => {
                const max = parseFloat($ctrl.max);
                const min = parseFloat($ctrl.min);
                if (!Number.isFinite(number)) return 0;
                if (Number.isFinite(max) && number > max && number > 0) return number - max;
                if (Number.isFinite(min) && number < min && number < 0) return min - number;
                return 0;
            };

            // the edit from the text `before` to the text `after` takes the number further out (see onBoxInput)
            function movesFurtherOut(before, after) {
                const limit = countLimit();
                if (limit > 0 && numberLength(after) > limit && numberLength(after) > numberLength(before)) return true;
                // Not for precision="0": the text the box had before its first decimal is "-99." (with the point), which a
                // number box reads as "-99"; put back, the point went, and the next digits joined the whole number
                // (-99.99 became -999). Its decimals stay instead, and the precision check shows the field red.
                const places = readPrecision();
                if (places !== null && places > 0 && decimalsOf(after) > places && decimalsOf(after) > decimalsOf(before)) return true;
                return !!$ctrl.opt.enforceLimits && reachGap(Number(after)) > reachGap(Number(before));
            }

            // the box's own "precision" check: a value with more decimals than precision allows (one from the page)
            const precisionValidator = (modelValue, viewValue) => {
                const places = isNumberType() ? readPrecision() : null;
                return places === null || viewValue === undefined || viewValue === null || viewValue === '' || decimalsOf(viewValue) <= places;
            };

            let autofocused = false;

            /*
             * aui-textarea auto-height: the box as tall as its text, from rows up to max-rows lines (then it scrolls).
             * Measured after each change of the text (typing, a page value, clearing) and of the box's width (a narrower
             * box wraps the text into more lines): one layout read per change. Turned off, the box has its rows and the
             * browser's own height again (releaseTextarea).
             */
            let fittedWidth = -1;   // the box's width at its last fit; -1: not fitted
            const fitTextarea = () => {
                const el = boxEl;
                if (!el || !$ctrl.isTextarea() || !$ctrl.opt.autoHeight) return;
                // not shown (a closed modal, a hidden tab): nothing to measure, its rows stay (and it scrolls); it is
                // measured once it shows (its width changes)
                if (el.getClientRects().length === 0) return;
                const style = getComputedStyle(el);
                const line = parseFloat(style.lineHeight) || 20;
                const frame = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
                const most = readWhole($ctrl.maxRows, 8) * line + frame;
                el.style.height = 'auto';   // its rows' height, to read the text's own
                const needed = el.scrollHeight;
                el.style.height = Math.min(needed, most) + 'px';
                el.style.overflowY = needed > most ? 'auto' : 'hidden';
                fittedWidth = el.clientWidth;
            };
            const releaseTextarea = () => {
                if (!boxEl || fittedWidth < 0) return;
                fittedWidth = -1;
                boxEl.style.height = '';
                boxEl.style.overflowY = '';
            };
            const onTextareaInput = () => fitTextarea();

            /*
             * The box's size, watched (ResizeObserver) while it needs to be: the textarea's width for auto-height, and a
             * box hidden at first for autofocus. The work is done in the next frame, not in the observer's callback: a
             * height set there would be one more size change in the same frame (the browser reports that as an error).
             */
            const watchSize = (element, onChange) => {
                if (typeof ResizeObserver !== 'function') return null;
                let frame = 0;
                const observer = new ResizeObserver(() => {
                    if (frame) return;
                    frame = requestAnimationFrame(() => {
                        frame = 0;
                        onChange();
                    });
                });
                observer.observe(element);
                return () => {
                    observer.disconnect();
                    if (frame) cancelAnimationFrame(frame);
                };
            };
            let stopWidthWatch = null;
            let stopAutofocusWatch = null;

            const onTextareaResize = () => {
                if ($ctrl.opt.autoHeight && boxEl && boxEl.clientWidth > 0 && boxEl.clientWidth !== fittedWidth) fitTextarea();
            };

            /*
             * autofocus: once, when the box is first shown (the native attribute acts on page load only). A box hidden
             * at first (ng-show, a closed panel) takes it when it shows.
             */
            function autofocusOnceShown(element) {
                autofocused = true;
                const shown = () => element.getClientRects().length > 0;
                const focus = () => {
                    if (boxEl === element && !$ctrl.opt.disabled) element.focus();
                };
                $timeout(() => {
                    if (boxEl !== element) return;
                    if (shown()) {
                        focus();
                        return;
                    }
                    stopAutofocusWatch = watchSize(element, () => {
                        if (!shown()) return;
                        stopAutofocusWatch();
                        stopAutofocusWatch = null;
                        focus();
                    });
                }, 0, false);
            }

            /*
             * The box's attributes that tell the browser and assistive technology about the field, and that none of
             * Angular's checks read: set here, not from one interpolation each (every interpolation is a watcher, and a
             * page with many fields, a table of them, pays every one on every digest).
             * - from the options only: set when an option changes (readOptions) and when the box comes (attachBox);
             * - aria-invalid and aria-required (the validity, touched, ng-required): from one watch (syncBoxState).
             */
            const STATIC_BOX_ATTRS = ['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-busy', 'role', 'enterkeyhint',
                'autocomplete', 'inputmode', 'spellcheck', 'autocapitalize', 'step'];
            const staticBoxAttrValues = () => [$ctrl.boxLabel(), $attrs.ariaLabelledby || undefined, $ctrl.describedBy(),
                $ctrl.isSearching() ? 'true' : undefined, $ctrl.isSearch() ? 'searchbox' : undefined,
                $ctrl.isSearch() ? 'search' : undefined, $ctrl.autocompleteValue(), $ctrl.inputmode || undefined,
                $ctrl.spellcheckValue(), $ctrl.isPassword() ? 'off' : undefined, $ctrl.stepValue()];
            let boxStateShown = null;   // aria-invalid and aria-required on the box element now
            let boxAttrs = null;        // the box's Angular attributes (ng-trim, see syncTrim)

            function setBoxAttr(name, value) {
                if (value === undefined || value === null || value === '') boxEl.removeAttribute(name);
                else if (boxEl.getAttribute(name) !== value) boxEl.setAttribute(name, value);
            }

            function syncStaticBoxAttrs() {
                if (!boxEl) return;
                staticBoxAttrValues().forEach((value, i) => setBoxAttr(STATIC_BOX_ATTRS[i], value));
            }

            function syncBoxState() {
                if (!boxEl) return;
                const invalid = String($ctrl.showInvalid());
                const required = String($ctrl.isRequired());
                if (boxStateShown === invalid + required) return;
                boxStateShown = invalid + required;
                setBoxAttr('aria-invalid', invalid);
                setBoxAttr('aria-required', required);
                // the box's own required too: a form the browser checks (a native submit) stops at an empty required
                // field, as it does at a native one (a form with novalidate is not checked by the browser)
                boxEl.required = required === 'true';
            }

            /*
             * ng-trim of the box: Angular's input listener reads it from the box's attributes. Off for a password (see
             * isPassword), and where the page asks for the spaces around the text (ng-trim="false" on the field).
             */
            const keepsSpaces = () => $ctrl.isPassword() || String($attrs.ngTrim === undefined ? '' : $attrs.ngTrim).trim() === 'false';
            function syncTrim() {
                if (!boxAttrs) return;
                if (keepsSpaces()) boxAttrs.ngTrim = 'false';
                else delete boxAttrs.ngTrim;
            }

            /*
             * When the host takes the box's results over: each time the box checks its value (a typed text it parses,
             * a page value it formats, a limit that changed: its validators run) - not on every digest, which a page with
             * many fields would pay for each of them. In the digest of the change ($evalAsync), so that the invalid look
             * and form.$invalid follow at once.
             */
            let takeOverQueued = false;
            const queueTakeOver = () => {
                if (takeOverQueued) return;
                takeOverQueued = true;
                $scope.$evalAsync(() => {
                    takeOverQueued = false;
                    takeOverBoxState();
                });
            };
            // first of the box's parsers (a parser that fails stops those after it; its error is taken over too)
            const noteParse = (value) => {
                queueTakeOver();
                return value;
            };
            // the box's validators run on every check that gets past its parsers (typed, formatted, $validate)
            const boxCheck = (modelValue, viewValue) => {
                queueTakeOver();
                const valid = precisionValidator(modelValue, viewValue);
                syncNativePrecision(valid);
                return valid;
            };

            /*
             * precision for a form the browser checks (a native submit, checkValidity): the box's own validity says it
             * too, with the field's text for it. The step cannot always say it (a min off the precision's grid gives
             * the step "any", see stepValue).
             */
            function syncNativePrecision(valid) {
                if (!boxEl || typeof boxEl.setCustomValidity !== 'function') return;
                boxEl.setCustomValidity(valid ? '' : $ctrl.field.textFor('precision'));
            }

            /*
             * Whose change a change of the box's value is. Angular changes it in a commit of the box's text (typed,
             * pasted, cleared: the user's), and in a re-check of its validators when a rule of the page changes (max,
             * pattern, value-max-length, precision: $validate), which is no edit (see takeRecheckedValue). The box's
             * commits are marked here; its change listener (_onChange) runs inside them.
             */
            let committing = false;
            function markCommits(boxModel) {
                const commit = boxModel.$commitViewValue;
                boxModel.$commitViewValue = function () {
                    committing = true;
                    try {
                        return commit.apply(this, arguments);
                    } finally {
                        committing = false;
                    }
                };
            }

            $ctrl.attachBox = (boxModel, element, attrs) => {
                box = boxModel;
                boxEl = element;
                boxAttrs = attrs || null;
                boxStateShown = null;
                // before the box's first check (it runs in the digest after the link)
                if (boxModel && boxModel.$validators) {
                    boxModel.$validators.precision = boxCheck;
                    boxModel.$parsers.unshift(noteParse);
                    markCommits(boxModel);
                }
                syncTrim();
                syncStaticBoxAttrs();
                syncBoxState();
                queueTakeOver();
                if (element) {
                    // not passive: the box must be left before the browser acts on the wheel (a passive one can come late)
                    element.addEventListener('wheel', onBoxWheel, {passive: false});
                    element.addEventListener('beforeinput', onBoxBeforeInput, true);
                    element.addEventListener('focus', onBoxFocus);
                    element.addEventListener('input', onTextareaInput);
                    element.addEventListener('input', onBoxTyped);
                    element.addEventListener('compositionend', onBoxTyped);
                    if (element.parentNode) element.parentNode.addEventListener('input', onBoxInput, true);
                    if ($ctrl.isTextarea()) stopWidthWatch = watchSize(element, onTextareaResize);
                    if ($ctrl.opt.autofocus && !autofocused) autofocusOnceShown(element);
                }
                syncNativeLimit();
            };
            $ctrl.detachBox = (boxModel) => {
                if (box !== boxModel) return;
                if (boxEl) {
                    boxEl.removeEventListener('wheel', onBoxWheel, {passive: false});
                    boxEl.removeEventListener('beforeinput', onBoxBeforeInput, true);
                    boxEl.removeEventListener('focus', onBoxFocus);
                    boxEl.removeEventListener('input', onTextareaInput);
                    boxEl.removeEventListener('input', onBoxTyped);
                    boxEl.removeEventListener('compositionend', onBoxTyped);
                    if (boxEl.parentNode) boxEl.parentNode.removeEventListener('input', onBoxInput, true);
                }
                if (stopWidthWatch) stopWidthWatch();
                if (stopAutofocusWatch) stopAutofocusWatch();
                stopWidthWatch = null;
                stopAutofocusWatch = null;
                fittedWidth = -1;
                typedText = null;
                box = null;
                boxEl = null;
                boxAttrs = null;
                queueTakeOver();   // its results go with it
            };

            function combineHostValidator(name) {
                const host = $ctrl.ngModelCtrl;
                const own = host.$validators[name];
                if (!own || combined[name] === own) return;
                const both = function (modelValue, viewValue) {
                    return own(modelValue, viewValue) && !(box && box.$error[name]);
                };
                host.$validators[name] = both;
                combined[name] = both;
            }

            function takeOverBoxState() {
                const host = $ctrl.ngModelCtrl;
                const errors = box ? box.$error : {};
                const names = Object.keys(errors).concat(Object.keys(takenOver).filter(name => !errors[name]));
                const now = {};
                names.forEach(name => {
                    if (name === 'parse') return;   // the host's own parse error stays the host's
                    combineHostValidator(name);
                    const validator = host.$validators[name];
                    host.$setValidity(name, validator ? !!validator(host.$modelValue, host.$viewValue) : !errors[name]);
                    if (errors[name]) now[name] = true;
                });
                takenOver = now;
                // required reads the box's text (see $postLink), which the box has just checked
                const required = host.$validators.required;
                if (required) host.$setValidity('required', !!required(host.$modelValue, host.$viewValue));
                // typed in, even if the value did not change (an invalid text stays an undefined value): the field is
                // dirty - when the field takes its text as it is typed. With ng-model-options updateOn (blur...) it is
                // dirty once it commits, as Angular's own field is (form.$rollbackViewValue() before then leaves the
                // field and the form pristine).
                if (box && box.$dirty && host.$pristine && !(host.$options && host.$options.updateOnDefault === false)) host.$setDirty();
            }

            /*
             * The box has text (the clear button shows): the box's text as Angular reads it, which an invalid text keeps
             * (its value is undefined: "abc" in a digits-only field), or text a number box cannot read ("-", "1e").
             */
            $ctrl.hasValue = () => {
                if (boxEl && boxEl.validity && boxEl.validity.badInput) return true;
                const text = box ? box.$viewValue : $ctrl.internalValue;
                return !(text === undefined || text === null) && String(text).length > 0;
            };

            /*
             * show-count: the length of the text in the box, out of value-max-length when that is set ("3/7"), in UTF-16
             * units, as the length that limits it counts it. The check counts the value: the text without the spaces
             * around it (Angular's ng-trim), so the count does too, and it is never over while the field is valid.
             * With enforce-limits the box's own maxlength stops the typing, and it counts every character, the spaces
             * too: the count follows it there, and reaches the limit when the box takes no more. Angular reports no
             * change when only those spaces change: the count takes the box's text as it is typed (onBoxTyped); a value
             * from the page, or cleared, is counted as it is.
             */
            let typedText = null;    // the box's text as last typed; null: the value's
            let countShown = null;   // the length the count showed in the last digest

            // value-max-length as a limit: a whole number above 0; 0 or unset: no limit (the count, the check and the
            // typing all read it so)
            const countLimit = () => {
                const limit = parseInt($ctrl.valueMaxLength, 10);
                return limit > 0 ? limit : 0;
            };

            // the box's length check (ng-maxlength): the limit, or none
            $ctrl.lengthCheck = () => countLimit() || undefined;

            const countLength = () => {
                const text = typedText !== null ? typedText : (box ? box.$viewValue : $ctrl.internalValue);
                if (text === undefined || text === null) return 0;
                return ($ctrl.opt.enforceLimits || keepsSpaces()) ? String(text).length : String(text).trim().length;
            };

            $ctrl.countText = () => {
                const limit = countLimit();
                countShown = countLength();
                return limit ? countShown + '/' + limit : String(countShown);
            };

            /*
             * The box's text, typed: a search field searches (searchOnTyping), and the count follows, with this field's
             * own digest when only it changed (spaces around the text, which Angular does not pass on). Not while an
             * input method composes (pinyin and the like): its letters are not text yet; this runs when it ends.
             */
            const onBoxTyped = (event) => {
                if (event.isComposing || !boxEl) return;
                typedText = boxEl.value;
                if ($ctrl.isSearch()) searchOnTyping();
                if (!$ctrl.isCountShown() || countShown === countLength() || $scope.$root.$$phase) return;
                kit.digestOwn($scope);
            };

            $ctrl.isCountOver = () => {
                const limit = countLimit();
                return limit > 0 && countLength() > limit;
            };

            // the clear button: the value is cleared and the caret is put in the box
            $ctrl.clearValue = ($event) => clearField($event, true, 'clear');

            /**
             * The page's on-change for the text the box shows now (the call form's $value, as it always was), with the
             * text before (oldValue: textBefore, or the text last reported) and what changed it (kit.reportChange).
             */
            function reportText(source, textBefore) {
                const oldValue = textBefore === undefined ? reportedText : textBefore;
                reportedText = $ctrl.internalValue;
                kit.reportChange($ctrl.onChange, {value: $ctrl.internalValue, oldValue: oldValue, triggerSource: source}, {},
                    null, 'aui-input');
            }

            /**
             * Clears the value (not when disabled or readonly); api.clear() leaves the focus where it is. source: the
             * clear button ('clear') or the api ('api').
             */
            function clearField($event, moveFocus, source) {
                if (boxLocked() || $ctrl.opt.readonly) return;
                flushFocus();   // an on-focus still waiting came first
                const textBefore = $ctrl.internalValue;
                if ($event) {
                    if ($event.preventDefault) $event.preventDefault();
                    if ($event.stopPropagation) $event.stopPropagation();
                }

                // an empty field cleared again changes nothing: no on-change, no search, its model left as it is
                if (!$ctrl.hasValue()) {
                    if (moveFocus && boxEl) boxEl.focus();
                    if ($ctrl.onClear) $ctrl.onClear({ $event: $event || null });
                    return;
                }

                $ctrl.internalValue = '';
                typedText = null;
                const inputEl = boxEl || $element[0].querySelector('input');
                if (inputEl) {
                    inputEl.value = '';
                    if (moveFocus) inputEl.focus();
                }

                // The box checks the empty text first, so that the host is given the box's results for it, not those of
                // the text before (an invalid text would leave the field invalid, its value undefined). The host and
                // on-change are updated just below, as before: the box's own change is not passed on (clearing).
                if (box) {
                    clearing = true;
                    try {
                        box.$setViewValue('');
                    } finally {
                        clearing = false;
                    }
                }

                if ($ctrl.ngModelCtrl) {
                    $ctrl.ngModelCtrl.$setViewValue(toHostView(''));
                    $ctrl.ngModelCtrl.$render();
                }
                reportText(source, textBefore);
                if ($ctrl.onClear) {
                    $ctrl.onClear({ $event: $event || null });
                }
                if ($ctrl.isSearch()) fireSearch('');
            }

            $ctrl.onClearKeydown = ($event) => {
                const keyCode = $event.which || $event.keyCode;
                if (keyCode === 13 || keyCode === 32 || $event.key === 'Enter' || $event.key === ' ' || $event.key === 'Spacebar') {
                    if ($event.preventDefault) $event.preventDefault();
                    if ($event.stopPropagation) $event.stopPropagation();
                    $ctrl.clearValue($event);
                }
            };

            // bridge ngModel → our internal view
            $ctrl.$postLink = () => {
                const host = $ctrl.ngModelCtrl;
                // whenever model changes externally, re-render
                host.$render = () => {
                    typedText = null;   // the page's value: counted as it is
                    cancelPendingSearch();   // the text typed is replaced: its search does not come
                    $ctrl.internalValue = toBoxValue(host.$viewValue);
                    reportedText = $ctrl.internalValue;
                };
                host.$render();

                // required reads the text: a text the box's checks refuse ("abc" in a digits-only field) leaves the
                // value undefined, but the field is not empty, and only the box's own error is the field's (Angular's
                // required reads a field's text, not its value). Checked again with the box's checks (takeOverBoxState).
                const required = host.$validators.required;
                if (typeof required === 'function') {
                    host.$validators.required = (modelValue, viewValue) => required(modelValue, viewValue) ||
                        (modelValue === undefined && !!box && box.$invalid && $ctrl.hasValue());
                }

                // A number box's value is a number, which has no length: AngularJS's own length checks of a maxlength /
                // ng-maxlength / ng-minlength attribute on this element (a page's own, next to value-max-length)
                // failed for every number, and the model became undefined (the typed number lost). They measure the
                // number as its text, as the box shows it (222: 3 characters); a text is measured as before.
                ['maxlength', 'minlength'].forEach(name => {
                    const own = host.$validators[name];
                    if (typeof own !== 'function') return;
                    host.$validators[name] = (modelValue, viewValue) =>
                        own(modelValue, typeof viewValue === 'number' ? String(viewValue) : viewValue);
                });

                // The page form resets its fields through the host (form.$setPristine(), form.$setUntouched()): the box,
                // outside the page form, is reset with it (its ng-dirty / ng-touched classes go as well).
                const setPristine = host.$setPristine;
                host.$setPristine = function () {
                    setPristine.apply(host, arguments);
                    if (box) box.$setPristine();
                };
                const setUntouched = host.$setUntouched;
                host.$setUntouched = function () {
                    setUntouched.apply(host, arguments);
                    if (box) box.$setUntouched();
                };

                // aria-invalid and aria-required of the box (see syncBoxState): a watch function
                // only, which sets what changed and returns nothing (so it never makes the digest loop again)
                $scope.$watch(() => { syncBoxState(); });

                // aui-textarea auto-height: a text from the page, clearing, other rows (typing: onTextareaInput; its width:
                // onTextareaResize). Measured once the digest is over: its classes (and so its line height) are set in
                // the digest, after this watch. Turned off: the box's own height again. Only an aui-textarea has this watch.
                if ($ctrl.isTextarea()) {
                    $scope.$watch(() => ($ctrl.opt.autoHeight && box)
                        ? String(box.$viewValue) + '|' + $ctrl.rowsValue() + '|' + $ctrl.maxRows : '',
                        key => {
                            if (key) $scope.$$postDigest(fitTextarea);
                            else releaseTextarea();
                        });
                }

                $element[0].addEventListener('focusout', onFieldFocusOut);
                $element[0].addEventListener('mousedown', onFramePress);
                const stopLabelTip = kit.labelTip($element[0]);
                $scope.$watch(() => $ctrl.api, bindApi);
                $scope.$on('$destroy', () => {
                    $element[0].removeEventListener('focusout', onFieldFocusOut);
                    $element[0].removeEventListener('mousedown', onFramePress);
                    stopLabelTip();
                    unbindApi();
                });
            };

            /*
             * api (as aui-select's): the page's object receives focus, blur, clear and select; they are taken off it
             * again when the field goes, or when the page gives another object.
             */
            let installedApi = null;

            function bindApi() {
                unbindApi();
                const target = $ctrl.api;
                if (!target || typeof target !== 'object') return;
                const methods = {
                    focus: function () { if (boxEl && !boxLocked()) boxEl.focus(); },
                    blur: function () { if (boxEl) boxEl.blur(); },
                    /** Clears the value (as the clear button does, not when disabled or readonly); the focus stays where it is. */
                    clear: function () { $scope.$evalAsync(() => clearField(null, false, 'api')); },
                    /** Selects the text of the box (e.g. to be typed over). */
                    select: function () { if (boxEl && !boxLocked() && typeof boxEl.select === 'function') boxEl.select(); }
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

            // the box's value changed: typed (the page's model and on-change follow), or re-checked (takeRecheckedValue)
            $ctrl._onChange = () => {
                if (clearing) return;   // clearValue updates the host and calls on-change itself
                if (!committing) {
                    takeRecheckedValue();
                    return;
                }
                flushFocus();   // an on-focus still waiting came first
                $ctrl.ngModelCtrl.$setViewValue(toHostView($ctrl.internalValue));
                reportText('input');
            };

            /*
             * A value the box's re-check changed (a rule of the page changed: max, pattern, value-max-length, precision)
             * is the field's value as Angular's own re-check of a field has it: the model follows the check at once, the
             * field stays pristine, and no on-change is reported - nothing was typed. ($setViewValue marks a field dirty
             * in its commit, and the page form with it: that one call is held for the moment.)
             */
            function takeRecheckedValue() {
                const host = $ctrl.ngModelCtrl;
                const setDirty = host.$setDirty;
                host.$setDirty = angular.noop;
                try {
                    host.$setViewValue(toHostView($ctrl.internalValue));
                    host.$commitViewValue();   // at once, whatever the field's debounce or updateOn
                } finally {
                    host.$setDirty = setDirty;
                }
            }

            /*
             * Red as the selects are: the value is invalid and the field has been touched (left once), so that a value
             * still being typed is not called wrong. A text longer than value-max-length is red at once, as its count
             * is: past a hard limit, each further key is wrong, and the field and its count must say the same.
             */
            $ctrl.showInvalid = () => !!($ctrl.ngModelCtrl && $ctrl.ngModelCtrl.$invalid && ($ctrl.ngModelCtrl.$touched || $ctrl.isCountOver()));

            /*
             * on-focus. A listener of the box's own (attachBox), not ng-focus: ng-focus runs a digest of the whole page on
             * every focus, which the page then pays in the very frames that draw the focus look (its ring comes in mostly
             * within the first frames). The digest runs only when the page asked for on-focus. Its $value is the value
             * at the focus, and it comes before anything that follows the focus (a blur, a change, Enter, a clear),
             * which runs it first if it still waits (flushFocus).
             */
            let pendingFocus = null;   // on-focus waiting for its digest: the event and the value at the focus
            const onBoxFocus = (event) => {
                fitTextarea();   // a textarea first shown hidden (see fitTextarea)
                if (!$ctrl.onFocus) return;
                pendingFocus = {event: event || null, value: $ctrl.internalValue};
                $scope.$evalAsync(flushFocus);
            };

            function flushFocus() {
                if (!pendingFocus) return;
                const focus = pendingFocus;
                pendingFocus = null;
                $ctrl.onFocus({ $event: focus.event, $value: focus.value });
            }

            /*
             * The box lost the focus: on-blur. The field is left - committed, touched, on-finish with blur - when the
             * focus goes out of the whole field, not to its own clear button or eye (from those it is left in
             * onFieldFocusOut): a Tab to the clear button is no end of the field.
             */
            $ctrl._onBlur = ($event) => {
                flushFocus();   // an on-focus still waiting came first
                const native = $event && ($event.originalEvent || $event);
                const leaving = !isInField(native && native.relatedTarget);
                if (leaving) settleField();
                if ($ctrl.onBlur) {
                    $ctrl.onBlur({ $event: $event || null, $value: $ctrl.internalValue });
                }
                if (leaving) finishField();
            };

            function leaveField() {
                settleField();
                finishField();
            }

            function settleField() {
                const host = $ctrl.ngModelCtrl;
                if (!host) return;
                // ng-model-options="{updateOn: 'blur'}" on the field: Angular waits for a blur of the aui-input element,
                // which never has the focus (the box has it). The field's own blur commit runs here instead, with its
                // blur debounce (debounce: {blur: ms}) as Angular's blur listener would run it.
                const updateOn = host.$options && host.$options.updateOn;
                if (typeof updateOn === 'string' && /(^|\s)blur(\s|$)/.test(updateOn)) {
                    if (typeof host.$$debounceViewValueCommit === 'function') host.$$debounceViewValueCommit('blur');
                    else host.$commitViewValue();
                }
                // touched on leaving, as an Angular input (and aui-select) is
                if (!host.$touched) host.$setTouched();
            }

            function finishField() {
                if ($ctrl.onFinish) {
                    $ctrl.onFinish({
                        $value: $ctrl.internalValue,
                        $event: {type: 'blur'}
                    });
                }
            }

            /*
             * A key that an input method (IME) takes while it puts a word together: the Enter that confirms the word is
             * not the field's Enter. Browsers mark it with isComposing, or send it as key code 229.
             */
            const isComposing = (event) => {
                const native = event.originalEvent || event;
                return !!native.isComposing || event.keyCode === 229 || event.which === 229;
            };

            /*
             * search: on-search with the text on Enter, when the text is emptied ('': the clear button, Escape in a search
             * box, the text deleted), and with search-debounce also once typing pauses that long. A search that comes
             * sooner (Enter, emptied) replaces the one waiting for the pause; a text from the page, or the field
             * disabled, drops it. The text is the box's own: a text its checks refuse (a pattern) is still what was
             * typed, and what is searched for.
             */
            let searchTimer = null;

            const cancelPendingSearch = () => {
                if (searchTimer) $timeout.cancel(searchTimer);
                searchTimer = null;
            };

            const searchText = () => (box && typeof box.$viewValue === 'string') ? box.$viewValue : $ctrl.internalValue;

            const fireSearch = (value) => {
                cancelPendingSearch();
                if ($ctrl.isSearch() && $ctrl.onSearch) $ctrl.onSearch({ $value: value });
            };

            const searchAfterPause = () => {
                const delay = readWhole($ctrl.searchDebounce, 0);
                if (!$ctrl.isSearch() || !$ctrl.onSearch || !delay || $ctrl.opt.disabled) return;
                cancelPendingSearch();
                searchTimer = $timeout(() => {
                    searchTimer = null;
                    fireSearch(searchText());
                }, delay);
            };

            // typed (onBoxTyped, outside a digest): emptied, it searches at once; otherwise after the pause
            const searchOnTyping = () => {
                if (boxEl.value === '') $scope.$evalAsync(() => fireSearch(''));
                else searchAfterPause();
            };

            $scope.$on('$destroy', cancelPendingSearch);

            $ctrl._onKeyDown = (event) => {
                if (isComposing(event)) return;
                // a textarea's Enter is a new line, not the end of the field (on-finish comes when it is left)
                if (event.keyCode === 13 && $ctrl.isTextarea()) return;
                if (event.keyCode === 13) { // Enter key
                    flushFocus();     // an on-focus still waiting came first
                    hidePassword();   // before the browser acts on Enter (a form submitted with it)
                    if ($ctrl.isSearch()) fireSearch(searchText());
                    if ($ctrl.onFinish) {
                        $ctrl.onFinish({
                            $value: $ctrl.internalValue,
                            $event: {type: 'enter'}
                        });
                    }
                }
            };


            /*
             * value-max-length on a number box: a number's characters only (digits, minus, decimal point); the length
             * itself is held after each edit (onBoxInput). Keys that type nothing (Backspace, Delete, the arrows,
             * Home/End, Tab, Enter, Escape, F5...) and shortcuts (Ctrl, Alt, Cmd) pass; ArrowUp/ArrowDown stay blocked,
             * as they step the number (past the limit, too).
             */
            $ctrl._interceptKey = (event) => {
                if ($ctrl.inputType !== 'number' || !$ctrl.valueMaxLength) return;
                if (isComposing(event)) return;

                if (event.ctrlKey || event.metaKey || event.altKey) return;

                const pressKey = event.key;
                if (pressKey === 'ArrowUp' || pressKey === 'ArrowDown') {
                    event.preventDefault();
                    return;
                }
                if (typeof pressKey !== 'string' || pressKey.length !== 1) return;   // types nothing

                // The characters of a number pass: the digits, a minus and a decimal point. Dropped, a minus or a point
                // changed the number unseen (-99.99 became 9999); where one is not allowed, min, precision or the
                // number's own check shows the field red instead. Other characters type nothing here (e, +: an
                // exponent is no amount a page asks for).
                if (!/^[0-9.-]$/.test(pressKey)) event.preventDefault();
            };

            // value-max-length on a number box: a paste that is no number is not taken (its length: onBoxInput)
            $ctrl._interceptPaste = (event) => {
                if ($ctrl.inputType !== 'number' || !$ctrl.valueMaxLength) return;
                const clipboardData = (event.originalEvent && event.originalEvent.clipboardData) || event.clipboardData || window.clipboardData;
                if (!clipboardData) return;
                const pasteContent = clipboardData.getData('text').replace(/\s+/g, '');
                if (pasteContent === '' || !isFinite(Number(pasteContent))) event.preventDefault();
            };


        }]
    })

    /**
     * aui-input's box form: on the wrapper of the box, next to ng-form. The form is taken out of the page form at once,
     * so that the box's ngModel never shows in the page form (form.<name>, form.$error); see "The box's checks" in
     * auiInput.
     */
    .directive('auiInputBoxForm', function () {
        return {
            restrict: 'A',
            priority: -1,   // after ngForm's pre-link, which has added this form to the page form
            require: ['form', '^^?form'],
            link: {
                pre: function (scope, element, attrs, forms) {
                    if (forms[1]) forms[1].$removeControl(forms[0]);
                }
            }
        };
    })

    /**
     * aui-textarea: a multi-line aui-input. <aui-textarea ng-model="..." rows="4" auto-height show-count value-max-length="200">
     * holds an <aui-input input-type="textarea" input-style-type="form"> that gets its attributes, so that it is the
     * same field in all else (the page form, the checks, show-count, enforce-limits, the message line, api, events,
     * size, label-position). Its own: rows (3), auto-height with max-rows (8); its Enter is a new line.
     * - terminal at priority 500: the attributes' directives (ng-model, required, ...) act on the aui-input inside, not
     *   on aui-textarea; ng-if and ng-repeat (higher) have run on aui-textarea and are not handed on (they would run twice).
     * - class, style and id stay on aui-textarea (a block), so that a page's layout rules for it still apply; written
     *   with {{...}}, they go on to the aui-input (only there are they interpolated).
     */
    .directive('auiTextarea', ['$compile', function ($compile) {
        const KEPT = ['class', 'style', 'id'];
        const RAN = ['ng-if', 'ng-repeat', 'ng-repeat-start', 'ng-repeat-end', 'ng-switch-when', 'ng-switch-default'];
        return {
            restrict: 'E',
            priority: 500,
            terminal: true,
            link: function (scope, element) {
                const wrapper = element[0];
                const field = document.createElement('aui-input');
                Array.prototype.slice.call(wrapper.attributes).forEach(function (attr) {
                    const name = attr.name.toLowerCase();
                    // kept as they are; one with {{...}} goes on with the others (aui-textarea, terminal, is not
                    // interpolated: its own {{...}} would stay as it is written), where it is interpolated
                    if (KEPT.indexOf(name) >= 0 && attr.value.indexOf('{{') < 0) return;
                    wrapper.removeAttribute(attr.name);
                    if (RAN.indexOf(name.replace(/^(data|x)-/, '')) >= 0) return;
                    field.setAttribute(attr.name, attr.value);
                });
                field.setAttribute('input-type', 'textarea');
                field.setAttribute('input-style-type', 'form');
                wrapper.appendChild(field);
                $compile(field)(scope);
            }
        };
    }])

    /** aui-input's box (its inner <input>): hands the box's ngModel to the aui-input around it. */
    .directive('auiInputBox', function () {
        return {
            restrict: 'A',
            require: ['ngModel', '^^auiInput'],
            link: function (scope, element, attrs, ctrls) {
                ctrls[1].attachBox(ctrls[0], element[0], attrs);
                scope.$on('$destroy', function () {
                    ctrls[1].detachBox(ctrls[0]);
                });
            }
        };
    });
