/**
 * aui-button: buttons in seven variants and five intents, five sizes, with icons and a loading state.
 */
angular.module('aui')
    /**
     * The buttons' sizes, followed by one ResizeObserver for all of them: watch(el, fn) calls fn(width) after each
     * layout that changed el's box (its border-box width, untransformed: the browser's layout is done then, reading it
     * costs nothing); unwatch(el). fn only reads: a change of a box there would be a loop of the observer (the browser
     * reports it as an error of the page). Without ResizeObserver (older browsers) nothing is called.
     */
    .factory('auiButtonSizes', [function () {
        // (by element, weakly: a button taken off the page without its scope's end holds nothing here)
        const callbacks = new WeakMap();
        let observer = null;
        return {
            watch: function (el, fn) {
                if (typeof window.ResizeObserver !== 'function' || !el) return;
                if (!observer) {
                    observer = new window.ResizeObserver(function (entries) {
                        entries.forEach(function (entry) {
                            const fn2 = callbacks.get(entry.target);
                            if (!fn2) return;
                            const box = entry.borderBoxSize;
                            const size = box && (box[0] || box);
                            fn2(size && typeof size.inlineSize === 'number' ? size.inlineSize : entry.target.offsetWidth);
                        });
                    });
                }
                callbacks.set(el, fn);
                observer.observe(el);
            },
            unwatch: function (el) {
                if (!observer || !el || !callbacks.has(el)) return;
                callbacks.delete(el);
                observer.unobserve(el);
            }
        };
    }])

    /**
     * aui-button: the family's button (a native <button> inside; the element itself is its place on the page: a
     * margin, a width or a class of the page work on it).
     * - variant: solid (default), soft, outline, elevated, dashed, ghost, link; intent: brand (default, the family's
     *   accent), neutral, success, warning, danger; size: xs, sm, md (default, the fields' 34px), lg, xl; shape: pill,
     *   square; block: as wide as its place; type: button (default), submit, reset.
     * - icon: a family icon by name (auiIcons: add, edit, delete, search, refresh, download, upload, filter, settings,
     *   more, info, help...) or the classes of an icon font ("fa fa-plus"); icon-position="right": after the text. An icon
     *   alone is square, and named (and its tooltip) by the icon's name (auiTexts.icons) unless aria-label / title say.
     *   A label written with {{ }} that becomes empty leaves an icon alone (named so), and its text back a text button.
     * - aria-describedby, aria-haspopup, aria-pressed and tabindex on the element are moved onto the native button.
     * - disabled (also a bare `disabled`, and ng-disabled on the element): the native disabled button.
     * - loading: its spinner over the icon (or the text), its width kept; it keeps the focus and its name, and takes no
     *   click (aria-disabled, aria-busy). loading-text="Saving...": meanwhile the spinner and this text in place of the
     *   label (no page flag needed with on-click's promise); the width never shrinks meanwhile, a longer text widens it.
     *   An icon alone keeps its square (no text).
     * - on-click: called with $event; a promise it returns keeps it loading until the promise settles (no second click:
     *   no double submit). ng-click on the element works as before, and gets no click while it is disabled or loading.
     * - expanded="row.open": a button that opens and closes something (a row's list of variants): the family chevron, pointing
     *   right while closed and turning down when open (as aui-tree-select's rows), aria-expanded; a click flips the value
     *   itself. on-click gets $expanded (the state the click asks for); a promise it returns (children loaded from the
     *   server) shows the spinner in the chevron's place, and the value changes only once it resolves (on a failure it
     *   stays as it was: the page tells why). The page may set the value itself too (expand all); a value the page cannot
     *   be written to (an expression) only shows the state. An icon alone is named Expand / Collapse (auiTexts.icons);
     *   controls="id": aria-controls, the element it opens. expand-icon: its look - chevron (the default: before the
     *   text, right turning down), show-more (after the text, down turning up: more shown below), show-more-double (as
     *   show-more, two chevrons: more of a whole section), caret (a filled triangle, right turning down), plus (a box
     *   with a plus that becomes a minus).
     * - copy-text="{{ vm.code }}": a click copies the text (the Clipboard API; the older way where it is missing or
     *   refused) and, for done-duration ms (2000; held between 300 and 10000), shows "Copied" (auiTexts.button) in place
     *   of its text - with a button that has an icon, a ring with a check that draws itself in, in place of the icon - or
     *   "Copy failed" (a ring with a cross), announced to screen readers. Only the latest copy's outcome shows.
     *   copy-feedback="none": it copies, its look stays. on-copy: $success, $text (every copy). It only writes to the
     *   clipboard, on a click, and never reads it.
     * - done-text="Saved": after on-click's promise resolves, this text (and the drawn check, with an icon) for
     *   done-duration ms. A new click ends it at once. Without copy-text or done-text nothing changes after a click. A
     *   text button keeps its width: it holds the room of its longest text from the start.
     * - on-click's promise may be $q's or the browser's own: it settles inside Angular's digest either way.
     * Drawn without watchers: its attributes and parts are set when its bindings change.
     */
    .component('auiButton', {
        transclude: true,
        bindings: {
            variant: '@?',
            intent: '@?',
            size: '@?',
            shape: '@?',
            type: '@?',
            icon: '@?',
            iconPosition: '@?',
            ariaLabel: '@?',
            title: '@?',
            disabled: '<?',
            loading: '<?',
            loadingText: '@?',
            expanded: '<?',
            controls: '@?',
            expandIcon: '@?',
            block: '<?',
            onClick: '&?',
            copyText: '@?',
            copyFeedback: '@?',
            onCopy: '&?',
            doneText: '@?',
            doneDuration: '@?'
        },
        template: '<button class="aui-button"><span class="aui-button__inner"><span class="aui-button__label" ng-transclude></span></span></button>',
        controller: ['$element', '$scope', '$attrs', '$parse', '$q', '$exceptionHandler', 'auiControlKit', 'auiTexts', 'auiIcons', 'auiButtonSizes',
            function ($element, $scope, $attrs, $parse, $q, $exceptionHandler, kit, texts, icons, sizes) {
                const $ctrl = this;
                const VARIANTS = ['solid', 'soft', 'outline', 'elevated', 'dashed', 'ghost', 'link'];
                const INTENTS = ['neutral', 'brand', 'success', 'warning', 'danger'];
                const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
                const SHAPES = ['pill', 'square'];
                const TYPES = ['button', 'submit', 'reset'];
                const host = $element[0];
                let button = null;
                let inner = null;
                let label = null;
                let iconBox = null;      // the icon in its box (the spinner goes over it)
                let drawnIcon = '';      // the icon drawn: drawn again only when it changes
                let feedback = '';       // copy-text / done-text: 'done' or 'failed' for a moment after a click, else ''
                let feedbackTimer = null;
                let fadeIcon = false;    // the next drawing of the icon fades in (the feedback coming or going)
                let status = null;       // the status element (aria-live) that tells screen readers (made when first needed)
                let spinner = null;
                let spinnerBox = null;   // loading-text without an icon: the spinner's place before the text
                let loadingLabel = null; // loading-text: shown in place of the label
                let roomEl = null;       // copy-text / done-text: the room of the feedback's texts (setRoom)
                let roomText = '';
                let textShown = false;   // loading-text shown now (the width held from before it)
                let waiting = false;     // on-click's promise not settled yet
                let copies = 0;          // copy-text: the clicks that copied so far (only the latest one's outcome shows)
                let announced = 0;       // the feedback read out so far (only the latest one's text is read)
                let labelShown = null;   // the label had something to show at the last drawing
                let labelWatch = null;   // follows the label's text (a {{ }} in it can become empty, or come back)
                let lastWidth = 0;       // the button's width at its last layout (auiButtonSizes): 0 not known yet
                let labelFrame = 0;      // a check of the label on the next frame, asked by a change of the button's size
                // expanded: a disclosure button; the page's value written through its expression (null: not writable)
                const disclosure = $attrs.expanded !== undefined;
                const writeExpanded = disclosure ? ($parse($attrs.expanded).assign || null) : null;
                let destroyed = false;

                // the page's ARIA states and relations and its tab order, written on the element, are the native button's
                // (the element has no role and is no tab stop of its own): moved onto the button
                const FORWARDED = ['ariaLabelledby', 'ariaDescribedby', 'ariaHaspopup', 'ariaPressed', 'tabindex'];

                $ctrl.$postLink = function () {
                    button = host.firstElementChild;
                    inner = button.firstElementChild;
                    label = inner.firstElementChild;
                    // a text of nothing but spaces and line breaks (an icon written over lines) leaves no label; the
                    // <span> Angular wraps a text in (no attribute but its ng- classes) is marked: a page's span rules are
                    // kept off it (a span of the page's own keeps them). A space between two words written in markup
                    // (<b>Save</b> <em>draft</em>) is the space between them: kept, one space (it was taken out with the
                    // others, and the button read "Savedraft"); the spaces at the label's ends and beside an icon go.
                    const nodes = Array.prototype.slice.call(label.childNodes);
                    const worded = node => !!node && ((node.nodeType === 3 && !!node.nodeValue.trim()) ||
                        (node.nodeType === 1 && !!String(node.textContent || '').trim()));
                    nodes.forEach(function (node, i) {
                        if (node.nodeType === 3 && !node.nodeValue.trim()) {
                            if (worded(nodes[i - 1]) && worded(nodes[i + 1])) node.nodeValue = ' ';
                            else label.removeChild(node);
                        } else if (node.nodeName === 'SPAN' && Array.prototype.every.call(node.attributes, function (a) {
                            return a.name === 'class' && /^\s*(ng-[\w-]+\s*)*$/.test(a.value);
                        })) node.classList.add('aui-button__text');
                    });
                    FORWARDED.forEach(forward);
                    // a label written with {{ }} (or ng-if inside it) changes without a change of the bindings: drawn
                    // again when it starts or stops having something to show (an icon with an empty label is an icon alone)
                    if (typeof MutationObserver === 'function') {
                        labelWatch = new MutationObserver(function () {
                            if (destroyed) return;
                            const shown = hasLabel();
                            if (shown !== labelShown) {
                                labelShown = shown;
                                render();
                            }
                        });
                        // (ng-show / ng-hide, [hidden] and an inline style inside it too: a text hidden there shows nothing)
                        labelWatch.observe(label, {childList: true, characterData: true, subtree: true,
                            attributes: true, attributeFilter: ['class', 'hidden', 'style']});
                    }
                    // after each layout that changed the button's box: its width (the one a loading text holds; read
                    // at that moment, a page whose buttons started loading at once laid itself out once per button);
                    // after one that changed the button's or the label's box: whether the label still shows - the
                    // page's own CSS can hide or show its words without a change in it (a toolbar that hides them on a
                    // narrow screen; a block button keeps its width then, its label does not)
                    sizes.watch(button, function (width) {
                        lastWidth = width;
                        checkLabelSoon();
                    });
                    sizes.watch(label, checkLabelSoon);
                    button.addEventListener('click', onClick);
                    kit.followNgFlags($attrs, render);
                    labelShown = hasLabel();
                    render();
                };

                $ctrl.$onChanges = function () {
                    if (button) render();
                };

                $ctrl.$onDestroy = function () {
                    destroyed = true;
                    clearTimeout(feedbackTimer);
                    if (labelWatch) labelWatch.disconnect();
                    if (labelFrame) window.cancelAnimationFrame(labelFrame);
                    sizes.unwatch(button);
                    sizes.unwatch(label);
                    if (button) button.removeEventListener('click', onClick);
                };

                /** One of FORWARDED: set on the button and taken off the element, now and whenever it changes ({{ }}). */
                function forward(name) {
                    // written on the element at all (ng-attr-* too, which may start out undefined and get its value later)
                    if (!$attrs.$attr[name]) return;
                    const htmlName = $attrs.$attr[name];
                    const move = function (value) {
                        set(htmlName, value === undefined || value === null ? null : String(value));
                        host.removeAttribute(htmlName);
                    };
                    move($attrs[name]);
                    $attrs.$observe(name, move);
                }

                /**
                 * The label has something to show: a text (not only spaces), or a picture (an image, a drawing, an icon
                 * font's element) - not inside a part the page hides (ng-show / ng-hide, [hidden], or its own CSS: a
                 * class or an inline style with display: none / visibility: hidden - an icon with such a text was left
                 * a wide, unnamed button). An element of the page's own counts by what it holds: a styled <span> left
                 * empty by its {{ }} is nothing, and an icon with nothing else is an icon alone, named by its icon.
                 * Asked when the label changes and after a change of the button's size, not at each drawing (the page's
                 * styles read for it would be worked out again for each button of a page drawn at once).
                 */
                function hasLabel() {
                    // hidden all together (a page's part hidden with visibility while it gets ready): nothing of its
                    // own counts as hidden then (it shows when the part shows, without a change of the button's size)
                    const look = window.getComputedStyle(label);
                    return shows(label, look.visibility === 'hidden');
                }

                /**
                 * Inside the observer of sizes (the layout done: the label's look costs nothing to read): when the label
                 * starts or stops showing, drawn again on the next frame - drawn inside the observer, the button's new
                 * size would be a loop of the observer (an error of the page).
                 */
                function checkLabelSoon() {
                    if (destroyed || labelFrame || hasLabel() === labelShown) return;
                    labelFrame = window.requestAnimationFrame(function () {
                        labelFrame = 0;
                        if (destroyed) return;
                        const shown = hasLabel();
                        if (shown !== labelShown) {
                            labelShown = shown;
                            render();
                        }
                    });
                }

                function shows(node, allHidden) {
                    for (let child = node.firstChild; child; child = child.nextSibling) {
                        if (child.nodeType === 3) {
                            if (child.nodeValue.trim()) return true;
                        } else if (child.nodeType === 1) {
                            if (child.classList.contains('ng-hide') || child.hasAttribute('hidden')) continue;
                            if (!/^(img|svg|i|canvas|picture|video|object)$/i.test(child.nodeName) && !shows(child, allHidden)) continue;
                            // something to show in it: shown unless the page's CSS hides it (looked at only then)
                            const look = window.getComputedStyle(child);
                            if (look.display === 'none' || (!allHidden && look.visibility === 'hidden')) continue;
                            return true;
                        }
                    }
                    return false;
                }

                function busy() {
                    return waiting || kit.readFlag($attrs, 'loading', $ctrl.loading, false);
                }

                function render() {
                    const loading = busy();
                    const block = kit.readFlag($attrs, 'block', $ctrl.block, false);
                    set('type', oneOf($ctrl.type, TYPES, 'button'));
                    set('data-variant', oneOf($ctrl.variant, VARIANTS, 'solid'));
                    set('data-intent', oneOf($ctrl.intent, INTENTS, 'brand'));
                    set('data-size', oneOf($ctrl.size, SIZES, 'md'));
                    set('data-shape', oneOf($ctrl.shape, SHAPES, null));
                    set('data-block', block ? 'true' : null);
                    host.classList.toggle('aui-button-host--block', block);
                    // loading keeps the focus (aria-disabled, not disabled): a keyboard user stays where they were
                    button.disabled = kit.readFlag($attrs, 'disabled', $ctrl.disabled, false) && !loading;
                    set('aria-disabled', loading ? 'true' : null);
                    set('aria-busy', loading ? 'true' : null);
                    set('data-loading', loading ? 'true' : null);
                    set('aria-expanded', disclosure ? String(!!$ctrl.expanded) : null);
                    set('aria-controls', $ctrl.controls || null);
                    const shownFeedback = loading ? '' : feedback;
                    set('data-feedback', shownFeedback || null);
                    drawIcon(shownFeedback);
                    // (followed by the label's observer; a browser without one asks at each drawing)
                    if (!labelWatch) labelShown = hasLabel();
                    // copy-text / done-text on a text button: the room of the feedback's texts ("Copied" and, for a copy,
                    // "Copy failed") held from the start, so that the button keeps its width whichever shows (setRoom)
                    const room = labelShown && feedbackOn() ? feedbackText('done') : '';
                    const failedRoom = room && $attrs.copyText !== undefined ? feedbackText('failed') : '';
                    setRoom([room, failedRoom].filter(Boolean));
                    // loading-text: the spinner (at the icon, or in a place of its own before the text) and the text in
                    // place of the label; the width from before is held as the least (no button shrinking under the
                    // pointer), a longer text widens it. Not for an icon alone (its square stays). The feedback of
                    // copy-text / done-text takes the same place, without the spinner.
                    const loadingText = String($ctrl.loadingText || '').trim();
                    const swapText = !labelShown ? '' :
                        (loading && loadingText ? loadingText : (shownFeedback ? feedbackText(shownFeedback) : ''));
                    const withText = !!swapText;
                    // held as the least: a button as wide as its text keeps its width in pixels (in min(.., 100%) the
                    // percentage is of a place its own width makes, and it shrank: "Approve settlement" with "OK" lost
                    // 82px, its neighbours moved); a block button never more than its place (whose place narrows
                    // meanwhile narrows with it; a browser without min() holds nothing). The width is the one kept after
                    // the last layout (read here, each button of a page that starts loading at once laid the page out)
                    if (withText && !textShown) {
                        const width = lastWidth || button.offsetWidth;
                        button.style.minWidth = block ? 'min(' + width + 'px, 100%)' : width + 'px';
                    } else if (!withText && textShown) button.style.minWidth = '';
                    textShown = withText;
                    showLoadingText(swapText, loading);
                    // the spinner over the icon, or over the text (hidden meanwhile): the width stays
                    const place = iconBox || (withText ? spinnerBox : inner);
                    if (loading) {
                        if (!spinner) {
                            spinner = document.createElement('span');
                            spinner.className = 'aui-button__spinner';
                            spinner.setAttribute('aria-hidden', 'true');
                        }
                        if (spinner.parentNode !== place) place.appendChild(spinner);
                    } else if (spinner && spinner.parentNode) {
                        spinner.parentNode.removeChild(spinner);
                    }
                    button.classList.toggle('aui-button--text-hidden', loading && !iconBox && !withText);
                    button.classList.toggle('aui-button--loading-text', withText);
                    // an icon alone: square, named by the icon (and its tooltip) unless aria-label / title say: the page's
                    // title is the name then (the browser names a button by its title when nothing else names it)
                    const iconOnly = !!iconBox && !labelShown;
                    let iconName = iconOnly && icons.has(drawnIcon.toLowerCase()) ? texts.icons[drawnIcon.toLowerCase()] : '';
                    if (iconOnly && turning()) iconName = $ctrl.expanded ? texts.icons.collapse : texts.icons.expand;
                    if (iconOnly && shownFeedback) iconName = feedbackText(shownFeedback);
                    button.classList.toggle('aui-button--icon-only', iconOnly);
                    // the feedback names an icon alone even over the page's own name, for its moment
                    set('aria-label', (iconOnly && shownFeedback ? iconName : $ctrl.ariaLabel) || ($ctrl.title ? '' : iconName) || null);
                    set('title', (iconOnly && shownFeedback ? iconName : $ctrl.title) || ($ctrl.ariaLabel ? '' : iconName) || null);
                    // the element itself names nothing (it has no role): its aria-label and title are the button's
                    host.removeAttribute('aria-label');
                    host.removeAttribute('title');
                }

                /**
                 * The room of the feedback's texts: hidden copies of them, beside the place of the icon that the
                 * feedback's mark takes, in the button's one cell under its content (CSS: .aui-button[data-room]). The
                 * button is as wide as the widest, and its content stays centred with its own gap: a label made as wide
                 * as the feedback's text (as before) centred its text in that width, away from its icon.
                 */
                function setRoom(lines) {
                    if (!lines.length) {
                        if (roomEl && roomEl.parentNode) roomEl.parentNode.removeChild(roomEl);
                        set('data-room', null);
                        return;
                    }
                    if (!roomEl) {
                        roomEl = document.createElement('span');
                        roomEl.className = 'aui-button__room';
                        roomEl.setAttribute('aria-hidden', 'true');
                    }
                    const text = lines.join('\n');
                    if (roomText !== text) {
                        roomText = text;
                        roomEl.textContent = '';
                        lines.forEach(function (line) {
                            const one = document.createElement('span');
                            one.textContent = line;
                            roomEl.appendChild(one);
                        });
                    }
                    if (roomEl.parentNode !== button) button.appendChild(roomEl);
                    set('data-room', iconBox ? 'icon' : 'text');
                }

                /**
                 * loading-text (and the feedback's text): its label in place of the button's, and, while loading without an
                 * icon, the spinner's place before it; '' takes them out.
                 */
                function showLoadingText(text, withSpinner) {
                    if (!text) {
                        if (loadingLabel && loadingLabel.parentNode) loadingLabel.parentNode.removeChild(loadingLabel);
                        if (spinnerBox && spinnerBox.parentNode) spinnerBox.parentNode.removeChild(spinnerBox);
                        return;
                    }
                    if (!loadingLabel) {
                        loadingLabel = document.createElement('span');
                        loadingLabel.className = 'aui-button__label aui-button__label--loading';
                    }
                    if (loadingLabel.textContent !== text) loadingLabel.textContent = text;
                    if (loadingLabel.parentNode !== inner || loadingLabel.previousSibling !== label) inner.insertBefore(loadingLabel, label.nextSibling);
                    if (iconBox || !withSpinner) {
                        if (spinnerBox && spinnerBox.parentNode) spinnerBox.parentNode.removeChild(spinnerBox);
                        return;
                    }
                    if (!spinnerBox) {
                        spinnerBox = document.createElement('span');
                        spinnerBox.className = 'aui-button__icon aui-button__icon--spinner';
                        spinnerBox.setAttribute('aria-hidden', 'true');
                    }
                    if (spinnerBox.parentNode !== inner || spinnerBox.nextSibling !== label) inner.insertBefore(spinnerBox, label);
                }

                // expanded without an icon of the page's: the family chevron (or the look expand-icon asks for), turned
                // by the state (CSS)
                const EXPAND_ICONS = {chevron: 'expand', 'show-more': 'expand', 'show-more-double': 'expand-double', caret: 'expand-caret',
                    plus: 'expand-plus'};
                function turning() {
                    return disclosure && !String($ctrl.icon || '').trim();
                }

                function expandLook() {
                    const look = toToken($ctrl.expandIcon);
                    return Object.prototype.hasOwnProperty.call(EXPAND_ICONS, look) ? look : 'chevron';
                }

                /**
                 * The icon: the page's, the expand look's, or for the feedback's moment a ring with a check (done; the
                 * ring draws itself, then the check) or a ring with a cross (failed; at once).
                 */
                function drawIcon(shownFeedback) {
                    const own = String($ctrl.icon || '').trim() || (disclosure ? EXPAND_ICONS[expandLook()] : '');
                    // a button without an icon shows the feedback by its text alone (no icon coming in to widen it)
                    const wanted = own && shownFeedback && !turning() ? (shownFeedback === 'done' ? 'circle-check' : 'circle-close') : own;
                    if (wanted !== drawnIcon) {
                        if (iconBox) iconBox.parentNode.removeChild(iconBox);
                        iconBox = null;
                        drawnIcon = wanted;
                        if (wanted) {
                            iconBox = document.createElement('span');
                            iconBox.className = fadeIcon ? 'aui-button__icon aui-button__icon--swap' : 'aui-button__icon';
                            iconBox.setAttribute('aria-hidden', 'true');
                            if (icons.has(wanted.toLowerCase())) {
                                const drawing = icons.draw(wanted.toLowerCase(), 'aui-button__svg');
                                // the feedback's marks a little larger than the icons (CSS: a scale, the button's width kept)
                                if (shownFeedback && wanted !== own) drawing.classList.add('aui-button__svg--mark');
                                // the done mark draws itself in: each line measured as 1, its dash moved from 1 to 0 (CSS)
                                if (shownFeedback === 'done' && wanted === 'circle-check') {
                                    drawing.classList.add('aui-button__svg--draw');
                                    Array.prototype.forEach.call(drawing.querySelectorAll('path'), function (path) {
                                        path.setAttribute('pathLength', '1');
                                    });
                                }
                                iconBox.appendChild(drawing);
                            } else {
                                const font = document.createElement('i');
                                font.className = wanted;
                                iconBox.appendChild(font);
                            }
                        }
                    }
                    fadeIcon = false;
                    if (iconBox) {
                        // show-more's chevrons come after the text unless icon-position says otherwise
                        const position = toToken($ctrl.iconPosition);
                        const after = /^(right|end)$/.test(position) || (!position && turning() && /^show-more/.test(expandLook()));
                        // moved only when it is not on its side of the text: inserting it again, even where it is,
                        // detaches it for a moment and cancels its transitions (the chevron's turn, the fades)
                        const side = label.compareDocumentPosition(iconBox);
                        const placed = iconBox.parentNode === inner &&
                            !!(side & (after ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING));
                        if (!placed) inner.insertBefore(iconBox, after ? label.nextSibling : label);
                        iconBox.classList.toggle('aui-button__icon--disclosure', turning());
                        // written only when it changes (each drawing wrote it again, for the page's observers to read)
                        const look = turning() ? expandLook() : null;
                        if (look !== iconBox.getAttribute('data-expand')) {
                            if (look) iconBox.setAttribute('data-expand', look);
                            else iconBox.removeAttribute('data-expand');
                        }
                    }
                }

                // while it is loading, no click reaches the page: ng-click on the element, a form's submit, a row's own click
                function onClick(event) {
                    if (busy()) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        return;
                    }
                    // a new action: the feedback of the one before is over (a failure after an earlier success must not
                    // show that success again)
                    endFeedback();
                    // copy-text: the copy starts in the click itself (the browser allows writing to the clipboard only
                    // while it handles the user's gesture)
                    const copying = $attrs.copyText !== undefined;
                    if (copying) copy();
                    if (!$ctrl.onClick && !disclosure) return;
                    // expanded: the state this click asks for, set now - or, when on-click returns a promise, once it
                    // resolves (the spinner meanwhile; a failure keeps the state)
                    const next = disclosure ? !$ctrl.expanded : undefined;
                    let result;
                    const run = function () {
                        if ($ctrl.onClick) result = $ctrl.onClick({$event: event, $expanded: next});
                        if (disclosure && !(result && typeof result.then === 'function')) showExpanded(next);
                    };
                    try {
                        if ($scope.$root.$$phase) run();
                        else $scope.$apply(run);
                    } catch (e) {
                        $exceptionHandler(e);
                    }
                    if (!result || typeof result.then !== 'function') return;
                    waiting = true;
                    render();
                    // through $q: a promise of the browser's own (async functions, fetch) settles outside Angular's
                    // digest, and the page would not show what the click opened (ng-show on the expanded value) until
                    // some other digest; $q settles it inside one
                    $q.when(result).then(function () {
                        waiting = false;
                        if (destroyed) return;
                        if (disclosure) showExpanded(next);
                        // done-text: the check and the text for a moment (a copy shows its own outcome)
                        if (!copying && $attrs.doneText !== undefined) showFeedback('done');
                        else render();
                    }, function () {
                        waiting = false;
                        if (!destroyed) render();
                    });
                }

                // ------------------------------------------------------------------ copy-text, done-text

                // a feedback that shows: a copy's outcome unless copy-feedback="none" (its done-text never shows then: no
                // room held for it - a silent Copy was as wide as its done-text); done-text after on-click's promise
                function feedbackOn() {
                    if ($attrs.copyText !== undefined) return toToken($ctrl.copyFeedback) !== 'none';
                    return $attrs.doneText !== undefined;
                }

                function feedbackText(kind) {
                    if (kind === 'failed') return texts.button.copyFailed;
                    const own = String($ctrl.doneText || '').trim();
                    return own || ($attrs.copyText !== undefined ? texts.button.copied : texts.icons.check);
                }

                /** The check (or the cross) and its text for done-duration ms, told to screen readers; a new one starts over. */
                function showFeedback(kind) {
                    clearTimeout(feedbackTimer);
                    if (feedback !== kind) fadeIcon = true;
                    feedback = kind;
                    render();
                    announce(feedbackText(kind));
                    feedbackTimer = setTimeout(function () {
                        feedbackTimer = null;
                        if (destroyed) return;
                        endFeedback();
                    }, feedbackDuration());
                }

                /** The feedback over: the button as it was, its status text cleared. */
                function endFeedback() {
                    clearTimeout(feedbackTimer);
                    feedbackTimer = null;
                    if (status) status.textContent = '';
                    if (!feedback) return;
                    feedback = '';
                    fadeIcon = true;
                    render();
                }

                /** done-duration in ms, held between 300 and 10000; unset or not a number: 2000. */
                function feedbackDuration() {
                    const raw = $ctrl.doneDuration === undefined || $ctrl.doneDuration === null ? '' : String($ctrl.doneDuration).trim();
                    const ms = raw === '' ? NaN : Number(raw);
                    return isFinite(ms) ? Math.min(Math.max(ms, 300), 10000) : 2000;
                }

                /** A polite status element (aria-live) next to the button: the feedback read once, the same text twice in a row too. */
                function announce(text) {
                    if (!status) {
                        status = document.createElement('span');
                        status.className = 'aui-button__status';
                        status.setAttribute('role', 'status');
                        status.setAttribute('aria-live', 'polite');
                        host.appendChild(status);
                    }
                    status.textContent = '';
                    // only the latest feedback is read: an earlier one whose moment comes after (a success, then a
                    // failure 25 ms later) says nothing
                    const shown = ++announced;
                    setTimeout(function () {
                        if (!destroyed && feedback && shown === announced) status.textContent = text;
                    }, 60);
                }

                function copy() {
                    const text = $ctrl.copyText === undefined || $ctrl.copyText === null ? '' : String($ctrl.copyText);
                    // the outcome shown is the latest copy's: an earlier one that ends later (a slow refusal) only
                    // reports to on-copy
                    const run = ++copies;
                    writeClipboard(text, run).then(function (copied) {
                        if (destroyed) return;
                        if (run === copies && toToken($ctrl.copyFeedback) !== 'none') showFeedback(copied ? 'done' : 'failed');
                        if (!$ctrl.onCopy) return;
                        const call = function () { $ctrl.onCopy({$success: copied, $text: text}); };
                        try {
                            if ($scope.$root.$$phase) call();
                            else $scope.$apply(call);
                        } catch (e) {
                            $exceptionHandler(e);
                        }
                    });
                }

                /**
                 * true once the text is on the clipboard: the Clipboard API, else (or when it refuses) the older way. A
                 * refusal that comes after a newer copy started is not tried the older way: it would put the older text
                 * over the newer one (that copy reports false to on-copy).
                 */
                function writeClipboard(text, run) {
                    const clipboard = window.navigator && window.navigator.clipboard;
                    if (clipboard && typeof clipboard.writeText === 'function' && window.isSecureContext !== false) {
                        let written;
                        try {
                            written = Promise.resolve(clipboard.writeText(text));
                        } catch (e) {
                            written = Promise.reject(e);
                        }
                        return written.then(function () { return true; }, function () {
                            return run === copies && !destroyed ? copyBySelection(text) : false;
                        });
                    }
                    return Promise.resolve(copyBySelection(text));
                }

                /**
                 * The older way (a page served over http, a browser without the Clipboard API): a hidden text box next to
                 * the button (inside an open modal dialog too, where the rest of the page is inert), its text selected and
                 * copied; the focus and the page's own selection are put back.
                 */
                function copyBySelection(text) {
                    const area = document.createElement('textarea');
                    area.value = text;
                    area.setAttribute('readonly', '');
                    area.setAttribute('aria-hidden', 'true');
                    area.setAttribute('tabindex', '-1');
                    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;margin:0;padding:0;border:0;opacity:0;pointer-events:none;';
                    const active = document.activeElement;
                    const selection = window.getSelection ? window.getSelection() : null;
                    const ranges = [];
                    if (selection) for (let i = 0; i < selection.rangeCount; i += 1) ranges.push(selection.getRangeAt(i));
                    host.appendChild(area);
                    let copied = false;
                    try {
                        area.focus({preventScroll: true});
                        area.select();
                        copied = typeof document.execCommand === 'function' && document.execCommand('copy') === true;
                    } catch (e) {
                        copied = false;
                    }
                    host.removeChild(area);
                    if (selection) {
                        selection.removeAllRanges();
                        ranges.forEach(function (range) { selection.addRange(range); });
                    }
                    if (active && typeof active.focus === 'function' && document.activeElement !== active) {
                        try {
                            active.focus({preventScroll: true});
                        } catch (e) {
                            active.focus();
                        }
                    }
                    return copied;
                }

                // the page's value (when it can be written to) and the button at once; inside a digest of the page (the
                // click's, or the promise's), which shows what it opens
                function showExpanded(value) {
                    if (writeExpanded) {
                        writeExpanded($scope.$parent, value);
                        $ctrl.expanded = value;
                    }
                    render();
                }

                function set(name, value) {
                    if (value === null || value === undefined || value === '') button.removeAttribute(name);
                    else if (button.getAttribute(name) !== value) button.setAttribute(name, value);
                }

                function oneOf(value, allowed, fallback) {
                    const token = toToken(value);
                    return allowed.indexOf(token) > -1 ? token : fallback;
                }

                function toToken(value) {
                    return value === undefined || value === null ? '' : String(value).trim().toLowerCase();
                }
            }]
    });
