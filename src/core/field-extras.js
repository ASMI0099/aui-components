/**
 * auiFieldExtras: the message line, the label above the box and the sizes the fields share.
 */
angular.module('aui')
    // auiFieldMessages: the field group of auiTexts (its set kept for the pages that use it)
    .provider('auiFieldMessages', ['auiTextsProvider', function (texts) {
        this.set = function (patch) {
            texts.set({field: patch});
            return this;
        };
        this.$get = ['auiTexts', function (all) {
            return all.field;
        }];
    }])

    /**
     * What aui-input, aui-select and aui-tree-select share around the box, each one off unless the page sets it:
     * - the message line under the field: hint-text (a hint), and while the field shows invalid, why: error-messages
     *   (a text per check, {required: '...', maxlength: '...'}), error-text (one text for any check), or the texts of
     *   auiFieldMessages (show-errors, or when nothing else is given). The line keeps its room, so that a message
     *   coming or going never moves the page; aria-live, and the box is described by it.
     * - size: "small" (28px) or "large" (40px); unset: the 34px of today.
     * - label-position: "top" puts the label above the box (an edit form) instead of in it.
     */
    .factory('auiFieldExtras', ['auiFieldMessages', 'auiControlKit', function (messages, kit) {
        // the check that is told first, when the value fails several (a page's own checks after these). "required"
        // last: told only when it is the only one, as a text that fails a check leaves the value empty (so required
        // fails too), and the text is the cause.
        const ORDER = ['maxlength', 'minlength', 'pattern', 'min', 'max', 'precision', 'number', 'email', 'url',
            'date', 'datetimelocal', 'time', 'week', 'month', 'parse'];
        const PLACEHOLDER = /\{(length|min|max|precision)\}/g;

        const rank = key => key === 'required' ? ORDER.length + 1 : (ORDER.indexOf(key) < 0 ? ORDER.length : ORDER.indexOf(key));

        function firstError(errors) {
            const keys = Object.keys(errors || {}).filter(key => errors[key]);
            if (keys.length === 0) return null;
            keys.sort((a, b) => rank(a) - rank(b));
            return keys[0];
        }

        // parameter names of their own: an older minifier (uglify-es 3.3.9) puts a one-line function into its caller,
        // and parameters named as the caller's constants (limits) became assignments to those constants there
        function fill(textTemplate, textLimits) {
            return String(textTemplate).replace(PLACEHOLDER, (all, name) =>
                (textLimits[name] === undefined || textLimits[name] === null) ? '' : String(textLimits[name]));
        }

        /**
         * options: ctrl (the component's controller, with the bindings hintText, errorText, errorMessages, showErrors,
         * size, labelPosition), attrs, ngModel() (its ngModel), invalidShown() (the field looks invalid now), limits()
         * ({length, min, max, precision} for the texts), id() (a base for the message line's id).
         */
        function create(options) {
            const $ctrl = options.ctrl;
            const field = {};

            field.hasMessageLine = () => !!($ctrl.hintText || $ctrl.errorText || $ctrl.errorMessages ||
                kit.readFlag(options.attrs, 'showErrors', $ctrl.showErrors, false));

            field.errorText = () => {
                if (!field.hasMessageLine() || !options.invalidShown()) return '';
                const model = options.ngModel();
                const key = model ? firstError(model.$error) : null;
                if (!key) return '';
                const limits = options.limits ? options.limits() : {};
                const own = ($ctrl.errorMessages && typeof $ctrl.errorMessages === 'object') ? $ctrl.errorMessages[key] : undefined;
                const shared = messages[key === 'precision' && limits.precision === 0 ? 'integer' : key];
                return fill((typeof own === 'string' && own) || $ctrl.errorText || shared || messages.invalid, limits);
            };

            field.messageText = () => field.errorText() || $ctrl.hintText || '';
            field.messageIsError = () => !!field.errorText();
            field.messageId = () => field.hasMessageLine() ? 'msg-' + options.id() : undefined;
            field.isLabelTop = () => $ctrl.labelPosition === 'top';
            field.size = () => ($ctrl.size === 'small' || $ctrl.size === 'large') ? $ctrl.size : '';
            return field;
        }

        return {create: create};
    }]);
