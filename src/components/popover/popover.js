/**
 * aui-popover: a card next to a trigger - a note, a confirmation, a small form.
 */
angular.module('aui')
    /**
     * aui-popover: a card next to its trigger with a title (title-text, or the page's popover-title; show-title="false":
     * none), the page's content and a footer: Cancel and Confirm (confirm-intent="danger": a red Confirm), or the page's
     * own popover-footer (an empty one: no footer).
     *
     * Layout: title, content and footer 16px from the card's sides; the content's parts one under the other, 12px apart
     * (content-padding: compact, smaller; none, the content brings its own). width: the card's (a number: px); without
     * it, its content's, 160 to 480px (--aui-popover-max-width).
     *
     * Trigger: the page's own popover-trigger (in the page's look), or the popover's own: an icon (trigger-icon: edit,
     * the default, pencil, square-pen, delete, copy, info, help, more, filter, settings, add; none) with a text (trigger-text;
     * show-trigger-text="false": the icon alone, the text its tooltip and its name; trigger-icon-position="end": the
     * text first), in a tone (trigger-tone: link, the default with a text; muted, the default for an icon alone; text;
     * danger).
     * trigger-on="hover": the mouse over the trigger opens it too, and it closes when the mouse has left the trigger
     * and the card (not while the focus is in the card; a press on the trigger keeps it open).
     *
     * Place: placement="bottom-start" by default (top, bottom, left or right, with -start or -end, or centred), 4px
     * from the trigger; on the other side when its side has no room, 8px inside the screen, and a card taller than its
     * room scrolls. It is shown in the top layer, so no container of the page clips or covers it (a browser without
     * the Popover API: fixed, or absolute with strategy="absolute", over the page). Needs Floating UI, as the fields do.
     *
     * Opens: the trigger (its press; Enter or Space on it), is-open, api.open(); not the trigger while disabled. on-open
     * returning false cancels it. Opened from the trigger, the focus goes into its first text box (auto-focus="false":
     * not), or into the card from the keyboard.
     * Closes: the trigger, Cancel, Confirm (on-confirm returning false keeps it open; a promise: Confirm waits, a spinner
     * on it, and closes it when the promise resolves to anything but false), Enter in a text box of the card as Confirm
     * (with its own footer; confirm-on-enter="false": not), Escape, a press outside it or the focus moving out of it
     * (neither with close-on-click-outside="false"), is-open, api.close(). on-close: once for each close, none once
     * the popover is destroyed. The content is new at each opening. confirm-text, cancel-text: its buttons' words.
     *
     * A click in the trigger or the card goes no further up the page (a row that opens on a click does not). The class
     * names popover-container, popover-trigger and popover-panel are the ones pages select.
     */
    .component('auiPopover', {
        bindings: {
            isOpen: '=?',
            api: '<?',
            onOpen: '&?',
            onClose: '&?',
            onConfirm: '&?',
            showTitle: '<?',
            titleText: '@?',
            contentPadding: '@?',
            width: '@?',
            closeOnClickOutside: '<?',
            strategy: '@?',
            placement: '@?',
            disabled: '<?',
            autoFocus: '<?',
            confirmOnEnter: '<?',
            confirmText: '@?',
            cancelText: '@?',
            confirmIntent: '@?',
            triggerIcon: '@?',
            triggerText: '@?',
            showTriggerText: '<?',
            triggerIconPosition: '@?',
            triggerTone: '@?',
            triggerOn: '@?'
        },
        transclude: {
            trigger: '?popoverTrigger',
            title: '?popoverTitle',
            content: 'popoverContent',
            footer: '?popoverFooter'
        },
        // the trigger's content: the page's popover-trigger, or the popover's own icon and text (drawTrigger)
        template: `
            <div class="popover-container aui-popover">
                <div class="popover-trigger aui-popover__trigger" ng-transclude="trigger"></div>
                <div class="popover-panel aui-popover__panel" role="dialog" tabindex="-1">
                    <div class="aui-popover__body" aui-if="$ctrl.bodyOn">
                        <div class="aui-popover__title" id="{{ ::$ctrl.uid }}-title" aui-if="$ctrl.titleOn()" ng-transclude="title">{{ $ctrl.titleText }}</div>
                        <div class="aui-popover__content" ng-transclude="content"></div>
                        <div aui-if="$ctrl.hasFooter" ng-transclude="footer"></div>
                        <div class="aui-popover__footer" aui-if="!$ctrl.hasFooter">
                            <aui-button size="sm" variant="outline" intent="neutral" data-act="cancel">{{ $ctrl.cancelText || $ctrl.t.cancel }}</aui-button>
                            <aui-button size="sm" intent="{{ $ctrl.confirmIntent || 'brand' }}" data-act="confirm" loading="$ctrl.confirming">{{ $ctrl.confirmText || $ctrl.t.confirm }}</aui-button>
                        </div>
                    </div>
                </div>
            </div>`,
        controller: ['$element', '$scope', '$attrs', '$transclude', '$parse', '$exceptionHandler', 'auiControlKit', 'auiTexts', 'auiIcons',
            function ($element, $scope, $attrs, $transclude, $parse, $exceptionHandler, kit, texts, icons) {
                const $ctrl = this;
                const GAP_PX = 4;            // between what is seen of the trigger and the card (see gapOn)
                const EDGE_PX = 8;           // the card keeps this far from the edges of the screen
                const MIN_HEIGHT_PX = 120;   // a card that scrolls is never made shorter than this
                const CLOSE_MS = 150;        // the closing fade (0.12s, in the CSS) and a frame: then the card is taken away
                const PLACEMENT = /^(top|bottom|left|right)(-start|-end)?$/;
                // a control of the page's own in the trigger: the keyboard reaches that one
                const OWN_CONTROL = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
                // the text boxes of the content: the first takes the focus at an opening (auto-focus), Enter in one confirms
                const TEXT_BOX = 'input:not([type]), input[type="text"], input[type="number"], input[type="search"], ' +
                    'input[type="email"], input[type="tel"], input[type="url"], input[type="password"], textarea';
                // boxes whose Enter is their own (a pick, a typed date, a search, a new line): it does not confirm the card
                const OWN_ENTER = 'aui-select *, aui-tree-select *, aui-date-picker *, textarea, [type="search"], [role="searchbox"]';
                // controls of the page's own in its trigger that a press must reach (a caret placed, a list opened)
                const OWN_PRESS = 'input:not([readonly]), textarea:not([readonly]), select';
                const SHOWN = 'aui-popover__panel--shown';
                const IN = 'aui-popover__panel--in';
                // the popover's own trigger: its icons (auiIcons), its tones, its looks
                const TONES = ['link', 'muted', 'text', 'danger'];
                const LOOKS = ['icon', 'labelled'].concat(TONES).map(function (name) { return 'aui-popover__trigger--' + name; });
                const HOVER_OPEN_MS = 200;    // trigger-on="hover": the mouse rests on the trigger this long (passing over it opens nothing)
                const HOVER_CLOSE_MS = 250;   // the mouse away this long (on its way from the trigger into the card it is not)
                // is-open written to the page's own value at once: the card's content, drawn in the card's own digest,
                // shows the page's new value from its first frame (the binding alone copies it in a digest of the page).
                // An is-open the page computes (vm.editing === row.id) has no value to write: it is only followed.
                const setPageOpen = $attrs.isOpen ? $parse($attrs.isOpen).assign : null;

                let root = null;
                let trigger = null;
                let panel = null;
                let named = null;         // says "opens a dialog" and "open" to assistive technology, and takes the focus back
                let usePopover = false;
                let opened = false;
                let token = 0;            // each opening and closing: what an older one still has under way is dropped
                let closeTimer = null;
                let stopTracking = null;
                let areas = [];           // while open: the trigger's own scrolling areas (see sideMiddleware)
                let stopFocusLeave = null;
                let dismiss = null;
                let pageDigest = null;
                let clickSeen = false;
                let destroyed = false;
                let ownTrigger = false;   // the trigger is the popover's own (no popover-trigger)
                let hoverTimer = null;
                let byHover = false;      // opened by the mouse resting on the trigger: it closes when the mouse leaves

                $ctrl.t = texts.modal;
                $ctrl.uid = 'aui-popover-' + $scope.$id;
                $ctrl.bodyOn = false;
                $ctrl.hasTitle = $transclude.isSlotFilled('title');
                // the title: the page's popover-title (it wins), or title-text; show-title="false": none
                $ctrl.titleOn = function () {
                    return ($ctrl.hasTitle || !!String($ctrl.titleText || '').trim()) && flag('showTitle', true);
                };
                $ctrl.hasFooter = $transclude.isSlotFilled('footer');

                $ctrl.confirming = false;   // on-confirm's promise not answered yet: Confirm shows a spinner

                $ctrl.$onChanges = function (changes) {
                    if (changes.api) bindApi();   // an api object the page gives later
                    if (!trigger) return;   // before $postLink: drawn there
                    if (changes.disabled) markDisabled();
                    if (changes.contentPadding || changes.width) layOut();
                    if (ownTrigger && (changes.triggerIcon || changes.triggerText || changes.showTriggerText ||
                        changes.triggerIconPosition || changes.triggerTone)) drawTrigger();
                };

                $ctrl.$onInit = bindApi;

                function bindApi() {
                    if (!angular.isObject($ctrl.api)) return;
                    $ctrl.api.open = function () { open(); };
                    $ctrl.api.close = function () { close(true); };
                }

                $ctrl.$postLink = function () {
                    root = $element[0].firstElementChild;
                    trigger = root.children[0];
                    panel = root.children[1];
                    usePopover = typeof panel.showPopover === 'function';
                    if (usePopover) panel.setAttribute('popover', 'manual');
                    panel.id = $ctrl.uid;
                    ownTrigger = !$transclude.isSlotFilled('trigger');
                    const own = ownTrigger ? null : trigger.querySelector(OWN_CONTROL);
                    named = own || trigger;
                    if (!own) {
                        trigger.setAttribute('tabindex', '0');
                        trigger.setAttribute('role', 'button');
                    }
                    if (ownTrigger) drawTrigger();
                    named.setAttribute('aria-haspopup', 'dialog');
                    named.setAttribute('aria-expanded', 'false');
                    named.setAttribute('aria-controls', panel.id);
                    markDisabled();
                    layOut();
                    // opens on the press of the mouse button, as aui-select does (on its click, a tenth of a second later,
                    // the opening felt slow); a click without a press (the keyboard, assistive technology) toggles too
                    kit.onTriggerPress({
                        trigger: trigger,
                        focus: named,
                        ignore: OWN_PRESS,   // their press is theirs; their click toggles
                        enabled: function () { return !destroyed && !flag('disabled', false); },
                        press: function () { toggle('press'); },
                        click: onTriggerClick
                    });
                    panel.addEventListener('click', onPanelClick);
                    if ($attrs.triggerOn !== undefined) {
                        [trigger, panel].forEach(function (el) {
                            el.addEventListener('pointerenter', onHover);
                            el.addEventListener('pointerleave', onHover);
                        });
                    }
                    if (ownTrigger) trigger.addEventListener('pointerenter', tipCutText);
                    root.addEventListener('click', function (event) { event.stopPropagation(); });
                    root.addEventListener('keydown', onKeydown);
                    pageDigest = kit.createPageDigest($scope);
                    // is-open set by the page: followed when the page's value changes (a '=' binding gets no $onChanges);
                    // its own writes are the state already (and a computed is-open, which it cannot write, keeps its value
                    // while the user closes the card: no new opening from it)
                    if ($attrs.isOpen !== undefined) {
                        let first = true;
                        $scope.$watch(function () { return !!$ctrl.isOpen; }, function (wanted, was) {
                            const changed = first || wanted !== was;
                            first = false;
                            if (!changed || wanted === opened) return;
                            if (wanted) open();
                            else close(true);
                        });
                    }
                };

                $ctrl.$onDestroy = function () {
                    destroyed = true;
                    opened = false;
                    token += 1;
                    unlisten();
                    if (stopTracking) stopTracking();
                    clearTimeout(closeTimer);
                    clearTimeout(hoverTimer);
                    if (pageDigest) pageDigest.forget();
                };

                function flag(name, fallback) {
                    return kit.readFlag($attrs, name, $ctrl[name], fallback);
                }

                /**
                 * The popover's own trigger: its icon (none: a text alone; no text: the edit icon all the same, never an
                 * empty trigger) and its text, in its tone. The icon alone is named by the text (or the icon's name in
                 * auiTexts.icons), which is its tooltip too.
                 */
                function drawTrigger() {
                    const text = String($ctrl.triggerText || '').trim();
                    const wanted = String($ctrl.triggerIcon || '').trim().toLowerCase();
                    const icon = wanted === 'none' && text ? null : (icons.has(wanted) ? wanted : 'edit');
                    const showText = !!text && (!icon || flag('showTriggerText', true));
                    const tone = TONES.indexOf($ctrl.triggerTone) >= 0 ? $ctrl.triggerTone : (showText ? 'link' : 'muted');
                    trigger.textContent = '';
                    if (icon) trigger.appendChild(icons.draw(icon, 'aui-popover__icon'));
                    if (showText) {
                        const span = document.createElement('span');
                        span.className = 'aui-popover__trigger-text';
                        span.textContent = text;
                        trigger.insertBefore(span, $ctrl.triggerIconPosition === 'end' ? trigger.firstChild : null);
                    }
                    LOOKS.forEach(function (cls) { trigger.classList.remove(cls); });
                    trigger.classList.add('aui-popover__trigger--' + (showText ? 'labelled' : 'icon'), 'aui-popover__trigger--' + tone);
                    const name = showText ? '' : (text || texts.icons[icon]);
                    if (name) trigger.setAttribute('aria-label', name);
                    else trigger.removeAttribute('aria-label');
                    // its tooltip: the name of an icon alone (not with trigger-on="hover": the card itself opens there)
                    if (name && $ctrl.triggerOn !== 'hover') trigger.setAttribute('title', name);
                    else trigger.removeAttribute('title');
                }

                // a text cut off by its room (a narrow cell): its whole text as the tooltip while it is cut
                function tipCutText() {
                    const span = trigger.querySelector('.aui-popover__trigger-text');
                    if (!span) return;
                    if (kit.isCutOff(span)) trigger.setAttribute('title', span.textContent);
                    else if (!trigger.hasAttribute('aria-label')) trigger.removeAttribute('title');
                }

                // trigger-on="hover": the mouse (not a touch) resting on the trigger opens it; leaving the trigger and the card closes
                // what it opened (a press on the trigger keeps it: byHover off)
                function onHover(event) {
                    if ($ctrl.triggerOn !== 'hover' || event.pointerType === 'touch') return;
                    clearTimeout(hoverTimer);
                    if (event.type === 'pointerenter') {
                        if (!opened && event.currentTarget === trigger) {
                            hoverTimer = setTimeout(function () {
                                if (opened || flag('disabled', false)) return;
                                open('hover');
                                byHover = opened;
                            }, HOVER_OPEN_MS);
                        }
                    } else if (opened && byHover) {
                        hoverTimer = setTimeout(function () {
                            // the keyboard in the card keeps it
                            if (byHover && !panel.contains(document.activeElement)) close(false);
                        }, HOVER_CLOSE_MS);
                    }
                }

                // content-padding (compact, none: the card's CSS) and width (a number: px; any CSS length; as wide as the
                // page asks, up to the screen's width)
                function layOut() {
                    const padding = String($ctrl.contentPadding || '').trim().toLowerCase();
                    if (padding === 'compact' || padding === 'none') panel.setAttribute('data-padding', padding);
                    else panel.removeAttribute('data-padding');
                    const width = String($ctrl.width || '').trim();
                    panel.style.width = /^\d+(\.\d+)?$/.test(width) ? width + 'px' : width;
                    panel.style.maxWidth = panel.style.width ? 'calc(100vw - 16px)' : '';
                }

                // disabled: the trigger does not open it (is-open and api.open() still do)
                function markDisabled() {
                    const off = flag('disabled', false);
                    trigger.classList.toggle('aui-popover__trigger--disabled', off);
                    if (off) named.setAttribute('aria-disabled', 'true');
                    else named.removeAttribute('aria-disabled');
                }

                /** The page's own code (on-open, on-close, on-confirm): its error is the page's, the popover goes on. */
                function callPage(fn) {
                    try { return fn(); } catch (e) { $exceptionHandler(e); }
                }

                /**
                 * The digest of the whole page that an opening or a closing from the user's input owes it: is-open, and
                 * what the page's on-open, on-close and on-confirm changed. The card itself is drawn by a digest of its
                 * own; the page's comes after the motion's first frame (opacity and transform go on on the compositor),
                 * or before the user's next input (kit.createPageDigest).
                 */
                function settle() {
                    if ($scope.$root.$$phase) return;
                    if (setPageOpen || $ctrl.onOpen || $ctrl.onClose || $ctrl.onConfirm) pageDigest.owe();
                }

                function setOpen(value) {
                    if (!setPageOpen) return;   // no is-open, or one the page computes (written, it would throw)
                    $ctrl.isOpen = value;
                    setPageOpen($scope.$parent, value);
                }

                function inTopLayer() {
                    return usePopover && panel.matches(':popover-open');
                }

                /** from: the trigger ('press', 'key': the focus goes into the card; 'hover'), or nothing (is-open, api.open()). */
                function open(from) {
                    if (destroyed || opened || !panel) return;
                    if ($ctrl.onOpen && callPage($ctrl.onOpen) === false) {
                        setOpen(false);
                        settle();
                        return;
                    }
                    finishClose();   // a close still fading: ended now, this opening starts from nothing
                    opened = true;
                    $ctrl.confirming = false;
                    token += 1;
                    const myToken = token;
                    setOpen(true);
                    $ctrl.bodyOn = true;
                    root.classList.add('open');
                    trigger.classList.add('aui-popover__trigger--open');
                    named.setAttribute('aria-expanded', 'true');
                    // the content first (this digest, or one of the card's own), then the card with its size known
                    if ($scope.$root.$$phase) {
                        $scope.$$postDigest(function () { show(myToken, from); });
                    } else {
                        kit.digestOwn($scope);
                        show(myToken, from);
                    }
                    settle();
                }

                function show(myToken, from) {
                    if (myToken !== token) return;
                    panel.classList.add(SHOWN);
                    if (usePopover) {
                        try { panel.showPopover(); } catch (e) { /* not in the page */ }
                    }
                    // named by its title when it shows one
                    if ($ctrl.titleOn()) panel.setAttribute('aria-labelledby', $ctrl.uid + '-title');
                    else panel.removeAttribute('aria-labelledby');
                    listen();
                    areas = scrollAreas();
                    // places it now, and again while it is open: scrolling, resizing, its content changing
                    stopTracking = window.FloatingUIDOM.autoUpdate(trigger, panel, function () { place(myToken); });
                    if (from !== 'press' && from !== 'key') return;
                    // opened from the trigger: its first text box takes the focus (to type at once), or from the keyboard the card
                    const box = flag('autoFocus', true) && firstBox();
                    if (box) kit.focusQuietly(box);
                    else if (from === 'key') kit.focusQuietly(panel);
                }

                function firstBox() {
                    const boxes = panel.querySelectorAll('.aui-popover__content ' + TEXT_BOX.split(', ').join(', .aui-popover__content '));
                    for (let i = 0; i < boxes.length; i += 1) {
                        if (!boxes[i].disabled && !boxes[i].readOnly && boxes[i].getClientRects().length) return boxes[i];
                    }
                    return null;
                }

                function place(myToken) {
                    if (myToken !== token) return;
                    const floating = window.FloatingUIDOM;
                    const top = inTopLayer();
                    // in the top layer only the screen can clip the card; otherwise its real clipping ancestors do
                    const strategy = !top && $ctrl.strategy === 'absolute' ? 'absolute' : 'fixed';
                    const room = {padding: EDGE_PX, rootBoundary: 'viewport', boundary: top ? [] : 'clippingAncestors'};
                    const word = String($ctrl.placement || '').trim().toLowerCase().replace(/-center$/, '');
                    const placement = PLACEMENT.test(word) ? word : 'bottom-start';
                    floating.computePosition(trigger, panel, {
                        strategy: strategy,
                        placement: placement,
                        middleware: [
                            floating.offset(function (state) { return gapOn(state.placement.split('-')[0]); }),
                            /^(top|bottom)/.test(placement) ? sideMiddleware() : floating.flip(room),
                            floating.shift(room),
                            floating.size(angular.extend({apply: fitHeight}, room)),
                            floating.hide({strategy: 'referenceHidden'})
                        ]
                    }).then(function (pos) {
                        if (myToken !== token) return;
                        // onto whole device pixels: the card has a layer of its own, drawn soft on a fraction of a pixel
                        const ratio = window.devicePixelRatio || 1;
                        // the trigger scrolled out of its container: the card would lie over other content
                        const away = !!(pos.middlewareData.hide && pos.middlewareData.hide.referenceHidden);
                        Object.assign(panel.style, {
                            position: strategy,
                            left: Math.round(pos.x * ratio) / ratio + 'px',
                            top: Math.round(pos.y * ratio) / ratio + 'px',
                            visibility: away ? 'hidden' : ''
                        });
                        panel.setAttribute('data-side', pos.placement.split('-')[0]);   // it comes from the trigger's side (CSS)
                        if (panel.classList.contains(IN)) return;
                        void panel.offsetWidth;   // its closed pose is in place first: the fade and the growth start from it
                        panel.classList.add(IN);
                    }, angular.noop);   // the trigger left the page: the last place is kept
                }

                /**
                 * Above or under the trigger: the first side (the asked one, then the other) where all of the card fits
                 * in the trigger's own scrolling areas (a dialog's body, a box of rows: while they scroll it flips at
                 * their edge, not over what is around them), else in the window (in the top layer nothing else cuts
                 * it); on neither, the side with more room in the window (it then scrolls, see fitHeight). Measured
                 * with the card's whole height: a side that once made it shorter does not keep it.
                 */
                function sideMiddleware() {
                    return {
                        name: 'auiSide',
                        fn: function (state) {
                            const ref = state.rects.reference;
                            const height = naturalHeight();
                            const asked = state.initialPlacement.split('-')[0];
                            const sides = [asked, asked === 'top' ? 'bottom' : 'top'];
                            const rects = {reference: ref, floating: angular.extend({}, state.rects.floating, {height: height})};
                            const over = function (side, boundary) {
                                const y = side === 'bottom' ? ref.y + ref.height + gapOn(side) : ref.y - height - gapOn(side);
                                return Promise.resolve(window.FloatingUIDOM.detectOverflow(angular.extend({}, state, {y: y, rects: rects}),
                                    {boundary: boundary, rootBoundary: 'viewport', padding: EDGE_PX})).then(function (o) { return Math.max(0, o[side]); });
                            };
                            const tries = [[sides[0], areas], [sides[1], areas], [sides[0], []], [sides[1], []]];
                            return Promise.all(tries.map(function (t) { return over(t[0], t[1]); })).then(function (o) {
                                const fit = o.indexOf(0);
                                const side = fit >= 0 ? tries[fit][0] : (o[3] < o[2] ? sides[1] : sides[0]);
                                const next = side + state.initialPlacement.slice(asked.length);
                                return next === state.placement ? {} : {reset: {placement: next}};
                            });
                        }
                    };
                }

                // GAP_PX from what is seen of the trigger: the target of its own icon or text reaches past it (a negative
                // margin: 4px around the icon, 2px over and under the text), the card does not
                function gapOn(side) {
                    const margin = parseFloat(getComputedStyle(trigger)['margin' + side.charAt(0).toUpperCase() + side.slice(1)]);
                    return GAP_PX + Math.min(0, margin || 0);
                }

                // the trigger's ancestors that scroll up and down (the page itself is the window)
                function scrollAreas() {
                    return window.FloatingUIDOM.getOverflowAncestors(trigger).filter(function (el) {
                        return el.nodeType === 1 && el.ownerDocument === document && el !== document.documentElement &&
                            el !== document.body && el.scrollHeight > el.clientHeight;
                    });
                }

                // all of the card, scrolling or not: its content and its border
                function naturalHeight() {
                    const body = panel.firstElementChild;
                    return (body ? body.offsetHeight : 0) + panel.offsetHeight - panel.clientHeight;
                }

                // a card taller than the room on its side: as tall as the room, and it scrolls
                function fitHeight(state) {
                    const natural = naturalHeight();
                    const room = Math.max(MIN_HEIGHT_PX, Math.floor(state.availableHeight));
                    panel.style.maxHeight = natural > room ? room + 'px' : '';
                    panel.classList.toggle('aui-popover__panel--scroll', natural > room);
                }

                /** focusBack: the focus, when it is in the card, goes back to the trigger (not for a press elsewhere). */
                function close(focusBack) {
                    if (!opened) return;
                    opened = false;
                    byHover = false;
                    clearTimeout(hoverTimer);
                    token += 1;
                    const myToken = token;
                    unlisten();
                    if (stopTracking) stopTracking();
                    stopTracking = null;
                    setOpen(false);
                    root.classList.remove('open');
                    trigger.classList.remove('aui-popover__trigger--open');
                    named.setAttribute('aria-expanded', 'false');
                    if (focusBack && panel.contains(document.activeElement)) kit.focusQuietly(named);
                    panel.classList.remove(IN);   // the fade starts; the card takes no pointer
                    closeTimer = setTimeout(function () {
                        closeTimer = null;
                        if (myToken === token) hide();
                    }, CLOSE_MS);
                    if ($ctrl.onClose) callPage($ctrl.onClose);
                    settle();
                }

                function hide() {
                    panel.classList.remove(SHOWN, 'aui-popover__panel--scroll');
                    panel.style.maxHeight = '';
                    areas = [];
                    if (inTopLayer()) panel.hidePopover();
                    $ctrl.bodyOn = false;   // the content goes: the next opening builds it again
                    if (!destroyed) kit.digestOwn($scope);
                }

                function finishClose() {
                    if (!closeTimer) return;
                    clearTimeout(closeTimer);
                    closeTimer = null;
                    hide();
                }

                function toggle(from) {
                    clearTimeout(hoverTimer);
                    if (opened && byHover) byHover = false;   // opened by the mouse resting on it: the press keeps it open
                    else if (opened) close(true);
                    else if (!flag('disabled', false)) open(from);
                }

                // only while open: a press outside (kit.createDismiss), the focus moving to another control of the page
                function listen() {
                    if (!dismiss) dismiss = kit.createDismiss({root: root, isOpen: function () { return opened; }, close: closeFromOutside});
                    dismiss.start();
                    stopFocusLeave = kit.onFocusLeave(root, function (next) {
                        if (next) closeFromOutside();
                    });
                }

                function unlisten() {
                    if (dismiss) dismiss.stop();
                    if (stopFocusLeave) stopFocusLeave();
                    stopFocusLeave = null;
                }

                function closeFromOutside() {
                    if (kit.readFlag($attrs, 'closeOnClickOutside', $ctrl.closeOnClickOutside, true)) close(false);
                }

                function onTriggerClick(event, afterPress) {
                    // one press, one toggle: its own click, and the second click a label in the trigger sends its control
                    const seen = clickSeen;
                    clickSeen = true;
                    setTimeout(function () { clickSeen = false; }, 0);
                    if (afterPress || seen) return;
                    // a click with no press (detail 0): the keyboard on a button of the page's own in the trigger
                    toggle(event.detail === 0 ? 'key' : 'press');
                }

                // Cancel and Confirm of the card's own footer
                function onPanelClick(event) {
                    const footer = panel.firstElementChild && panel.firstElementChild.lastElementChild;
                    if (!footer || !footer.classList.contains('aui-popover__footer') || !footer.contains(event.target)) return;
                    const button = event.target.closest('[data-act]');
                    if (!button) return;
                    if (button.getAttribute('data-act') === 'confirm') confirm();
                    else close(true);
                }

                /**
                 * Confirm (its button, Enter in a text box): on-confirm, then the close; false from it keeps the card open; a
                 * promise (a save): Confirm waits with a spinner, and the card closes when it resolves to anything but false
                 * (rejected, false: it stays, as the user left it). Closed meanwhile, the answer is the closed opening's: it
                 * changes nothing (as aui-modal's).
                 */
                function confirm() {
                    if ($ctrl.confirming) return;
                    const result = $ctrl.onConfirm ? callPage($ctrl.onConfirm) : undefined;
                    if (result && typeof result.then === 'function') {
                        const own = token;
                        // the focus kept in the card while Confirm is disabled (Escape still reaches it)
                        if (panel.contains(document.activeElement)) kit.focusQuietly(panel);
                        $ctrl.confirming = true;
                        kit.digestOwn($scope);
                        settle();
                        result.then(function (value) { answered(own, value !== false); }, function () { answered(own, false); });
                    } else if (result === false) {
                        kit.digestOwn($scope);   // kept open: what the page's check changed in the card shows now
                        settle();
                    } else {
                        close(true);
                    }
                }

                function answered(own, done) {
                    if (own !== token || destroyed) return;
                    $ctrl.confirming = false;
                    if (done) close(true);
                    else kit.digestOwn($scope);
                    settle();
                }

                function onKeydown(event) {
                    // a key a control inside used already (its own dropdown closing), or an input method's
                    if (event.defaultPrevented || kit.isComposing(event)) return;
                    const key = event.key;
                    if (key === 'Escape' || key === 'Esc') {
                        if (!opened) return;
                        event.preventDefault();   // used here: a dialog around the popover stays open
                        if (!kit.isRepeat(event)) close(true);
                        return;
                    }
                    if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
                    const target = event.target;
                    // Enter in a text box of the card (one line, not a field's own, not in a form of the card's content): it
                    // never submits a form of the page around the popover; with the card's own footer, it confirms
                    if (key === 'Enter' && opened && panel.contains(target) && target.matches(TEXT_BOX) && !target.matches(OWN_ENTER) &&
                        !(target.form && panel.contains(target.form))) {
                        event.preventDefault();
                        if (!$ctrl.hasFooter && flag('confirmOnEnter', true) && !kit.isRepeat(event)) confirm();
                        return;
                    }
                    // on the trigger itself, or on a read-only box in it (a button or a link of the page's sends its own click)
                    if (target !== trigger && !(trigger.contains(target) && target.readOnly === true)) return;
                    event.preventDefault();
                    if (!kit.isRepeat(event)) toggle('key');
                }
            }
        ]
    });
