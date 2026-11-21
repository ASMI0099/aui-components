/**
 * aui-highlight-text: a label with the parts that match a search marked.
 */
angular.module('aui')
    /**
     * Text with every case-insensitive occurrence of a query highlighted (.aui-select__hit), built from DOM text
     * nodes (never parsed as HTML). <span aui-highlight-text="label" aui-highlight-query="query"></span>
     * Strings and numbers are matched; other values are shown the way {{ }} shows them, without highlight.
     */
    .directive('auiHighlightText', ['$parse', 'auiControlKit', function ($parse, kit) {
        function displayText(value) {
            if (value === undefined || value === null) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'number') return '' + value;
            return angular.toJson(value);
        }

        /** Same value for a watch (NaN is the same as NaN, or the digest would never settle). */
        function same(a, b) {
            return a === b || (a !== a && b !== b);
        }

        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                const el = element[0];
                const getValue = $parse(attrs.auiHighlightText);
                const getQuery = $parse(attrs.auiHighlightQuery);
                // aui-highlight-pending (optional): while true, a loading placeholder instead of the text
                const getPending = attrs.auiHighlightPending ? $parse(attrs.auiHighlightPending) : null;
                let value;
                let rawQuery;
                let pending = false;
                let version = 0;
                let shownText = null;
                let shownQuery = null;
                let shownPending = false;
                // One watcher for the expressions: a $watchGroup schedules an extra digest pass, for every row it is on.
                scope.$watch(function () {
                    const v = getValue(scope);
                    const q = getQuery(scope);
                    const p = getPending ? !!getPending(scope) : false;
                    if (!same(v, value) || !same(q, rawQuery) || p !== pending) {
                        value = v;
                        rawQuery = q;
                        pending = p;
                        version += 1;
                    }
                    return version;
                }, function () {
                    if (pending) {
                        if (shownPending) return;
                        shownPending = true;
                        shownText = shownQuery = null;
                        while (el.firstChild) el.removeChild(el.firstChild);
                        el.classList.add('aui-select__pending');
                        el.setAttribute('aria-label', 'Loading');
                        return;
                    }
                    if (shownPending) {
                        shownPending = false;
                        el.classList.remove('aui-select__pending');
                        el.removeAttribute('aria-label');
                    }
                    const text = displayText(value);
                    const matchable = typeof value === 'string' || typeof value === 'number';
                    const query = matchable && rawQuery !== undefined && rawQuery !== null ? String(rawQuery).toLowerCase() : '';
                    if (text === shownText && query === shownQuery) return;
                    shownText = text;
                    shownQuery = query;
                    while (el.firstChild) el.removeChild(el.firstChild);
                    kit.highlightSegments(text, query).forEach(function (segment) {
                        if (!segment.hit) {
                            el.appendChild(document.createTextNode(segment.text));
                            return;
                        }
                        const mark = document.createElement('span');
                        mark.className = 'aui-select__hit';
                        mark.textContent = segment.text;
                        el.appendChild(mark);
                    });
                });
            }
        };
    }]);
