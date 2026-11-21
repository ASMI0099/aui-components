/**
 * aui-button: buttons in seven variants and five intents, five sizes, with icons and a loading state.
 */
angular.module('aui')
    /**
     * aui-button: the family's button (a native <button> inside; the element itself is its place on the page: a
     * margin, a width or a class of the page work on it).
     * - variant: solid (default), soft, outline, elevated, dashed, ghost, link; intent: brand (default, the family's
     *   accent), neutral, success, warning, danger; size: xs, sm, md (default, the fields' 34px), lg, xl; shape: pill,
     *   square; block: as wide as its place; type: button (default), submit, reset.
     * - icon: a family icon by name (auiIcons: add, edit, delete, search, refresh, download, upload, filter, settings,
     *   more, info, help...) or the classes of an icon font ("fa fa-plus"); icon-position="right": after the text. An icon
     *   alone is square, and named (and its tooltip) by the icon's name (auiTexts.icons) unless aria-label / title say.
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
     *   refused) and, for done-duration ms (2000), shows a ring with a check that draws itself in and "Copied"
     *   (auiTexts.button) in place of its icon and text - or a ring with a cross and "Copy failed" - announced to screen
     *   readers. copy-feedback="none": it copies, its look
     *   stays. on-copy: $success, $text. It only writes to the clipboard, on a click, and never reads it.
     * - done-text="Saved": after on-click's promise resolves, the drawn check and this text for done-duration ms. Without
     *   copy-text or done-text nothing changes after a click. A text button keeps its width: it holds the room of the
     *   longer text from the start.
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
        controller: ['$element', '$scope', '$attrs', '$parse', '$exceptionHandler', 'auiControlKit', 'auiTexts', 'auiIcons',
            function ($element, $scope, $attrs, $parse, $exceptionHandler, kit, texts, icons) {
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
                let textShown = false;   // loading-text shown now (the width held from before it)
                let waiting = false;     // on-click's promise not settled yet
                // expanded: a disclosure button; the page's value written through its expression (null: not writable)
                const disclosure = $attrs.expanded !== undefined;
                const writeExpanded = disclosure ? ($parse($attrs.expanded).assign || null) : null;
                let destroyed = false;

                $ctrl.$postLink = function () {
                    button = host.firstElementChild;
                    inner = button.firstElementChild;
                    label = inner.firstElementChild;
                    // a text of nothing but spaces and line breaks (an icon written over lines) leaves no label; the
                    // <span> Angular wraps a text in (no attribute but its ng- classes) is marked: a page's span rules are
                    // kept off it (a span of the page's own keeps them)
                    Array.prototype.slice.call(label.childNodes).forEach(function (node) {
                        if (node.nodeType === 3 && !node.nodeValue.trim()) label.removeChild(node);
                        else if (node.nodeName === 'SPAN' && Array.prototype.every.call(node.attributes, function (a) {
                            return a.name === 'class' && /^\s*(ng-[\w-]+\s*)*$/.test(a.value);
                        })) node.classList.add('aui-button__text');
                    });
                    button.addEventListener('click', onClick);
                    kit.followNgFlags($attrs, render);
                    render();
                };

                $ctrl.$onChanges = function () {
                    if (button) render();
                };

                $ctrl.$onDestroy = function () {
                    destroyed = true;
                    clearTimeout(feedbackTimer);
                    if (button) button.removeEventListener('click', onClick);
                };

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
                    // copy-text / done-text on a text button: the label holds the room of the feedback's text from the
                    // start (a hidden copy of it under the text), so that the button keeps its width when it shows
                    const room = label.firstChild && feedbackOn() ? feedbackText('done') : '';
                    if (room) {
                        if (label.getAttribute('data-room') !== room) label.setAttribute('data-room', room);
                    } else if (label.hasAttribute('data-room')) {
                        label.removeAttribute('data-room');
                    }
                    // loading-text: the spinner (at the icon, or in a place of its own before the text) and the text in
                    // place of the label; the width from before is held as the least (no button shrinking under the
                    // pointer), a longer text widens it. Not for an icon alone (its square stays). The feedback of
                    // copy-text / done-text takes the same place, without the spinner.
                    const loadingText = String($ctrl.loadingText || '').trim();
                    const swapText = !label.firstChild ? '' :
                        (loading && loadingText ? loadingText : (shownFeedback ? feedbackText(shownFeedback) : ''));
                    const withText = !!swapText;
                    if (withText && !textShown) button.style.minWidth = button.offsetWidth + 'px';
                    else if (!withText && textShown) button.style.minWidth = '';
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
                    // an icon alone: square, named by the icon (and its tooltip) unless aria-label / title say
                    const iconOnly = !!iconBox && !label.firstChild;
                    let iconName = iconOnly && icons.has(drawnIcon.toLowerCase()) ? texts.icons[drawnIcon.toLowerCase()] : '';
                    if (iconOnly && turning()) iconName = $ctrl.expanded ? texts.icons.collapse : texts.icons.expand;
                    if (iconOnly && shownFeedback) iconName = feedbackText(shownFeedback);
                    button.classList.toggle('aui-button--icon-only', iconOnly);
                    // the feedback names an icon alone even over the page's own name, for its moment
                    set('aria-label', (iconOnly && shownFeedback ? iconName : $ctrl.ariaLabel) || iconName || null);
                    set('title', (iconOnly && shownFeedback ? iconName : $ctrl.title) || ($ctrl.ariaLabel ? '' : iconName) || null);
                    // the element itself names nothing (it has no role): its aria-label and title are the button's
                    host.removeAttribute('aria-label');
                    host.removeAttribute('title');
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
                        if (turning()) iconBox.setAttribute('data-expand', expandLook());
                        else iconBox.removeAttribute('data-expand');
                    }
                }

                // while it is loading, no click reaches the page: ng-click on the element, a form's submit, a row's own click
                function onClick(event) {
                    if (busy()) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        return;
                    }
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
                    result.then(function () {
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

                function feedbackOn() {
                    return ($attrs.copyText !== undefined && toToken($ctrl.copyFeedback) !== 'none') || $attrs.doneText !== undefined;
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
                    const ms = Number($ctrl.doneDuration);
                    feedbackTimer = setTimeout(function () {
                        feedbackTimer = null;
                        feedback = '';
                        fadeIcon = true;
                        if (destroyed) return;
                        render();
                        if (status) status.textContent = '';
                    }, isFinite(ms) && ms >= 300 ? Math.min(ms, 10000) : 2000);
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
                    setTimeout(function () {
                        if (!destroyed && feedback) status.textContent = text;
                    }, 60);
                }

                function copy() {
                    const text = $ctrl.copyText === undefined || $ctrl.copyText === null ? '' : String($ctrl.copyText);
                    writeClipboard(text).then(function (copied) {
                        if (destroyed) return;
                        if (toToken($ctrl.copyFeedback) !== 'none') showFeedback(copied ? 'done' : 'failed');
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

                /** true once the text is on the clipboard: the Clipboard API, else (or when it refuses) the older way. */
                function writeClipboard(text) {
                    const clipboard = window.navigator && window.navigator.clipboard;
                    if (clipboard && typeof clipboard.writeText === 'function' && window.isSecureContext !== false) {
                        let written;
                        try {
                            written = Promise.resolve(clipboard.writeText(text));
                        } catch (e) {
                            written = Promise.reject(e);
                        }
                        return written.then(function () { return true; }, function () { return copyBySelection(text); });
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
