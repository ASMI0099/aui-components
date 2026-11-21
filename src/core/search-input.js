/**
 * aui-search-input: the search box of a field's panel.
 */
angular.module('aui')
    /**
     * The search box of the aui-* dropdowns, in place of ng-model:
     *   <input aui-search-input="$ctrl.searchQuery" aui-search-input-change="$ctrl.onSearchText($text)">
     * The typed text is handed to the component, which digests what it needs (ng-model would digest the whole page on
     * every keystroke), and the box is no control of the surrounding form (with ng-model, typing a search made the
     * page's form dirty). Otherwise as ng-model on a text input: the text is trimmed (an added space changes nothing),
     * nothing is taken while an input method is composing (except on Android, as AngularJS does), and the box shows the
     * component's text when the component changes it (the reset on open and close).
     * aui-search-input-stop-click: clicks in the box do not bubble.
     */
    .directive('auiSearchInput', ['$parse', '$sniffer', function ($parse, $sniffer) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                const input = element[0];
                const getText = $parse(attrs.auiSearchInput);
                const change = $parse(attrs.auiSearchInputChange);
                let shown = null;        // the trimmed text last taken from the box or written to it
                let composing = false;

                function take() {
                    if (composing) return;
                    const text = String(input.value || '').trim();
                    if (text === shown) return;
                    shown = text;
                    change(scope, {$text: text});
                }

                function onCompositionStart() { composing = true; }
                function onCompositionEnd() { composing = false; take(); }
                function stopClick(event) { event.stopPropagation(); }

                if (!$sniffer.android) {
                    input.addEventListener('compositionstart', onCompositionStart);
                    input.addEventListener('compositionend', onCompositionEnd);
                }
                input.addEventListener('input', take);
                input.addEventListener('change', take);
                const stopsClicks = attrs.auiSearchInputStopClick !== undefined;
                if (stopsClicks) input.addEventListener('click', stopClick);

                scope.$watch(getText, function (value) {
                    const text = value === undefined || value === null ? '' : String(value);
                    if (text === shown) return;
                    shown = text;
                    input.value = text;
                });

                scope.$on('$destroy', function () {
                    input.removeEventListener('compositionstart', onCompositionStart);
                    input.removeEventListener('compositionend', onCompositionEnd);
                    input.removeEventListener('input', take);
                    input.removeEventListener('change', take);
                    if (stopsClicks) input.removeEventListener('click', stopClick);
                });
            }
        };
    }]);
