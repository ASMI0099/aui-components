/**
 * AuiSafeHtml: HTML from a page, cleaned to a safe subset before it is shown.
 */
angular.module('aui')
    /**
     * Safe HTML for the message services below (AuiMessage, AuiMessageBox: useHtml).
     * The message is parsed by the browser in an inert document (nothing runs or loads there) and rebuilt from an
     * allowlist - text formatting, headings, lists, tables, links (http, https,
     * mailto, tel, or relative to the page); the attributes class, title, colspan, rowspan, a few text styles (colour,
     * background colour, weight, italics, decoration, alignment); nothing else. Elements that can hold code or load
     * content (script, style, iframe, object, embed, svg, math, img, media, form controls ...) are dropped with all they
     * hold; any other element gives its content only. Comments are dropped. trust(html): the clean HTML, trusted for
     * ng-bind-html (which inserts it with jQuery's html(), and that would also run script elements).
     */
    .factory('AuiSafeHtml', ['$sce', function ($sce) {
        const KEEP = {
            b: true, strong: true, i: true, em: true, u: true, s: true, del: true, ins: true, mark: true, small: true,
            sub: true, sup: true, code: true, kbd: true, pre: true, blockquote: true, br: true, hr: true, p: true,
            div: true, span: true, h1: true, h2: true, h3: true, h4: true, h5: true, h6: true, ul: true, ol: true,
            li: true, dl: true, dt: true, dd: true, a: true, table: true, caption: true, colgroup: true, col: true,
            thead: true, tbody: true, tfoot: true, tr: true, th: true, td: true
        };
        const DROP = {
            script: true, style: true, iframe: true, frame: true, frameset: true, object: true, embed: true,
            applet: true, svg: true, math: true, template: true, noscript: true, noembed: true, noframes: true,
            xmp: true, plaintext: true, textarea: true, title: true, select: true, option: true, optgroup: true,
            form: true, input: true, button: true, link: true, meta: true, base: true, img: true, picture: true,
            source: true, video: true, audio: true, track: true, canvas: true, portal: true, head: true
        };
        const ATTRIBUTES = {class: true, title: true, colspan: true, rowspan: true};
        // kept when their value has its own form only: a header cell's scope (a table read cell by cell), a part's
        // language and direction, where an ordered list starts (the steps of a checklist continued)
        const CHECKED = {
            scope: /^(row|col|rowgroup|colgroup)$/i,
            lang: /^[a-z]{1,8}(-[a-z0-9]{1,8})*$/i,
            dir: /^(ltr|rtl|auto)$/i
        };
        const START = /^-?\d{1,9}$/;
        const STYLES = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-align'];
        const SCHEMES = {'http:': true, 'https:': true, 'mailto:': true, 'tel:': true};
        const MAX_DEPTH = 32;
        let inert = null;

        function safeHref(value) {
            const text = String(value || '').trim();
            if (!text) return null;
            try {
                // a relative address goes where the page's own links go: from the document's base (a <base href> of the
                // application), not from the window's location
                const url = new URL(text, document.baseURI || window.location.href);
                return SCHEMES[url.protocol] ? url.href : null;
            } catch (e) {
                return null;
            }
        }

        function cleanStyle(style) {
            const out = [];
            STYLES.forEach(function (name) {
                const value = style.getPropertyValue(name);
                if (value && !/url\s*\(|expression|javascript:|[<>\\]/i.test(value)) out.push(name + ': ' + value);
            });
            return out.join('; ');
        }

        function copyAttributes(from, to, tag) {
            Array.prototype.forEach.call(from.attributes, function (attribute) {
                const name = attribute.name.toLowerCase();
                if (ATTRIBUTES[name]) {
                    to.setAttribute(name, attribute.value);
                } else if (CHECKED[name]) {
                    if (CHECKED[name].test(attribute.value.trim())) to.setAttribute(name, attribute.value.trim());
                } else if (tag === 'ol' && name === 'start') {
                    if (START.test(attribute.value.trim())) to.setAttribute('start', attribute.value.trim());
                } else if (name === 'style') {
                    const css = cleanStyle(from.style);
                    if (css) to.setAttribute('style', css);
                } else if (tag === 'a' && name === 'href') {
                    const href = safeHref(attribute.value);
                    if (href !== null) to.setAttribute('href', href);
                }
            });
            if (tag === 'a' && to.hasAttribute('href') && from.getAttribute('target') === '_blank') {
                to.setAttribute('target', '_blank');
                to.setAttribute('rel', 'noopener noreferrer');
            }
        }

        function cleanChildren(from, to, doc, depth) {
            for (let node = from.firstChild; node; node = node.nextSibling) {
                if (node.nodeType === 3) {
                    to.appendChild(doc.createTextNode(node.nodeValue));
                    continue;
                }
                if (node.nodeType !== 1 || depth >= MAX_DEPTH) continue;
                const tag = node.nodeName.toLowerCase();
                if (DROP[tag]) continue;
                if (!KEEP[tag] || node.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
                    cleanChildren(node, to, doc, depth + 1);
                    continue;
                }
                const copy = doc.createElement(tag);
                copyAttributes(node, copy, tag);
                cleanChildren(node, copy, doc, depth + 1);
                to.appendChild(copy);
            }
        }

        function sanitize(html) {
            if (!inert) inert = document.implementation.createHTMLDocument('');
            const source = inert.createElement('div');
            source.innerHTML = String(html == null ? '' : html);
            const clean = inert.createElement('div');
            cleanChildren(source, clean, inert, 0);
            return clean.innerHTML;
        }

        return {
            sanitize: sanitize,
            trust: function (html) {
                return $sce.trustAsHtml(sanitize(html));
            }
        };
    }]);
