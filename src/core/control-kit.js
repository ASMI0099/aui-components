/**
 * auiControlKit: the helpers the field components share (keys, focus, text measuring, values).
 */
angular.module('aui')
    /**
     * Shared helpers for the aui-* form controls (aui-select, aui-tree-select).
     */
    .factory('auiControlKit', ['auiTexts', function (texts) {
        const FALSE_WORDS = ['false', '0', 'no', 'off'];
        // the fields' corner radius is the CSS token (in px there, see :root in aui-components.css)
        const RADIUS = 'var(--aui-control-radius-default)';
        const BORDER_RADIUS = Object.freeze({
            NONE: '0',
            DEFAULT: RADIUS,
            LEFT_NONE: '0 ' + RADIUS + ' ' + RADIUS + ' 0',
            RIGHT_NONE: RADIUS + ' 0 0 ' + RADIUS
        });

        /** A selectable value: a non-empty string, a number other than NaN, or a boolean (same rule as aui-select). */
        function isSelectionKey(value) {
            const type = typeof value;
            return value !== '' && (type === 'string' || type === 'boolean' || (type === 'number' && value === value));
        }

        /**
         * Read a boolean option. A bare attribute (`<x multiple>`) is true, and so is the HTML way of writing one, its
         * own name as its value (`<x disabled="disabled">`, `<x show-label="show-label">`) while the scope has nothing
         * by that name. An expression that evaluates to undefined/null counts as unset (fallback); otherwise it is true
         * unless it is false, 0, '' or one of the strings 'false', '0', 'no', 'off'.
         */
        function readFlag($attrs, attrName, value, fallback) {
            if (!Object.prototype.hasOwnProperty.call($attrs, attrName)) return fallback;
            const written = $attrs[attrName];
            if (written === '') return true;
            // the flag Angular's ng-disabled / ng-readonly set on the element (true / false), with no binding of its own
            if (typeof written === 'boolean' && (value === undefined || value === null)) return written;
            if (value === undefined && typeof written === 'string' && written.trim().toLowerCase() === htmlName(attrName)) return true;
            if (value === undefined || value === null) return fallback;
            if (typeof value === 'boolean') return value;
            if (typeof value === 'number') return value !== 0 && value === value;
            if (typeof value === 'string') {
                const word = value.trim().toLowerCase();
                return word !== '' && FALSE_WORDS.indexOf(word) === -1;
            }
            return true;
        }

        /** An attribute's name as written in HTML, from Angular's normalized one ('showLabel' -> 'show-label'). */
        function htmlName(attrName) {
            return attrName.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
        }

        /**
         * ng-disabled / ng-readonly on a field: Angular's directives set the element's disabled / readonly flag (true or
         * false), which kit.readFlag reads while the field has no binding of its own; fn runs when it changes (a field that
         * reads its options once per binding change reads them again). Without ng-disabled / ng-readonly: nothing.
         */
        function followNgFlags($attrs, fn) {
            if ($attrs.ngDisabled !== undefined) $attrs.$observe('disabled', fn);
            if ($attrs.ngReadonly !== undefined) $attrs.$observe('readonly', fn);
        }

        /** Trigger corner radius, with the same precedence as aui-select (right-none wins over left-none). */
        function borderRadius(rounded, leftNone, rightNone) {
            if (!rounded) return BORDER_RADIUS.NONE;
            if (rightNone) return BORDER_RADIUS.RIGHT_NONE;
            if (leftNone) return BORDER_RADIUS.LEFT_NONE;
            return BORDER_RADIUS.DEFAULT;
        }

        /** A whole number >= 0, or Infinity when unset or invalid (max-tag-count). */
        function readLimit(raw) {
            const count = typeof raw === 'number' ? raw
                : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
            return (Number.isFinite(count) && count >= 0) ? Math.floor(count) : Infinity;
        }

        // At most this many tags are rendered; more selected values always collapse into the "+N" tag, so a very
        // large selection cannot flood the trigger with elements.
        const TAG_RENDER_CAP = 100;
        // Labels listed in the "+N" tag's tooltip; the rest are only counted.
        const TAG_TITLE_LIMIT = 50;
        // max-tag-count="responsive": a tag cut with an ellipsis keeps at least this much of its text (about two
        // letters), or it is not shown (see createTagFit)
        const TAG_MIN_TEXT_PX = 24;

        /** True while an input method (e.g. pinyin) is composing: Enter, arrows and Escape belong to it then. */
        function isComposing($event) {
            if (!$event) return false;
            const nativeEvent = $event.originalEvent || $event;
            return !!nativeEvent.isComposing || $event.keyCode === 229 || $event.key === 'Process';
        }

        /**
         * True for the auto-repeat of a held key. Read from the native event: with jQuery on the page, ng-keydown hands
         * over a jQuery event, which does not copy `repeat`.
         */
        function isRepeat($event) {
            if (!$event) return false;
            return !!($event.originalEvent || $event).repeat;
        }

        /**
         * max-tag-count: a number, or "responsive" (as many tags as fit on one line). The plain attribute text
         * max-tag-count="responsive" counts as well, although as an expression it evaluates to undefined.
         */
        function readTagMode($attrs, value) {
            const word = typeof value === 'string' ? value
                : (value === undefined && $attrs && typeof $attrs.maxTagCount === 'string' ? $attrs.maxTagCount : '');
            if (word.trim().toLowerCase() === 'responsive') return {responsive: true, limit: Infinity};
            return {responsive: false, limit: readLimit(value)};
        }

        /** Tooltip of the "+N" tag: the hidden labels (the first TAG_TITLE_LIMIT of them, then a count). */
        function hiddenTagsTitle(labels) {
            if (labels.length <= TAG_TITLE_LIMIT) return labels.join(', ');
            return texts.list.moreTags.replace('{n}', String(labels.length - TAG_TITLE_LIMIT)).split('{list}')
                .join(labels.slice(0, TAG_TITLE_LIMIT).join(', '));
        }

        /**
         * `label` split into text segments, every occurrence of `query` (lower case) marked as a hit. `lower` is the
         * label in lower case (computed when omitted). No highlight when lower-casing changed the length, since the
         * offsets would not line up.
         */
        function highlightSegments(label, query, lower) {
            const lowered = lower === undefined ? label.toLowerCase() : lower;
            if (!query || lowered.length !== label.length) return [{text: label, hit: false}];
            let at = lowered.indexOf(query);
            if (at === -1) return [{text: label, hit: false}];
            const segments = [];
            let from = 0;
            while (at !== -1) {
                if (at > from) segments.push({text: label.slice(from, at), hit: false});
                segments.push({text: label.slice(at, at + query.length), hit: true});
                from = at + query.length;
                at = lowered.indexOf(query, from);
            }
            if (from < label.length) segments.push({text: label.slice(from), hit: false});
            return segments;
        }

        /** drop-down-panel-background-opacity: OPAQUE_LIKE is slightly see-through with a blur; FULL (default) is the CSS background. */
        function panelBackgroundStyle(value) {
            return value === 'OPAQUE_LIKE'
                ? {'background-color': 'rgba(255, 255, 255, 0.8)', 'backdrop-filter': 'blur(8px)', '-webkit-backdrop-filter': 'blur(8px)'}
                : null;
        }

        /**
         * max-tag-count="responsive": keeps the tags on one line. A hidden copy of the tags (.aui-select__tags-measure:
         * plain DOM with the tags' own classes, so it lays out exactly like them, without Angular bindings) is measured
         * after a render in which the tags changed (scope.$$postDigest) and whenever a size changes (ResizeObserver);
         * onFit(count) is called only when the number of tags that fit changes.
         * cfg: {scope, root: host element, total(): number of tags, text(i), locked(i), pending(i): what tag i shows
         *       (asked for the first TAG_RENDER_CAP tags), onFit(count)}
         * sync() is for a watch: it compares the tags with what the copy shows (allocating nothing while nothing
         * changed) and returns a number that changes whenever they changed.
         */
        function createTagFit(cfg) {
            let scheduled = false;
            let destroyed = false;
            let fitted = -1;
            let observer = null;
            let observedTags = null;
            let observedMeasure = null;
            // what the copy shows: the tags' texts and states (1 locked, 2 pending), the total in its count tag
            const texts = [];
            const flags = [];
            let total = 0;
            let version = 0;
            let builtVersion = -1;
            let holder = null;      // .aui-select__tags-measure
            let box = null;         // its .aui-select__tags

            function sync() {
                const all = cfg.total();
                const n = Math.min(all, TAG_RENDER_CAP);
                let changed = all !== total || n !== texts.length;
                for (let i = 0; i < n; i += 1) {
                    const text = cfg.text(i);
                    const flag = (cfg.locked(i) ? 1 : 0) + (cfg.pending(i) ? 2 : 0);
                    if (texts[i] !== text || flags[i] !== flag) {
                        texts[i] = text;
                        flags[i] = flag;
                        changed = true;
                    }
                }
                texts.length = n;
                flags.length = n;
                total = all;
                if (changed) version += 1;
                return version;
            }

            /** The copy, next to the tags (same inherited font), with what sync() last found. */
            function build(display) {
                if (!holder) {
                    holder = document.createElement('div');
                    holder.className = 'aui-select__tags-measure';
                    holder.setAttribute('aria-hidden', 'true');
                    box = document.createElement('div');
                    box.className = 'aui-select__tags';
                    holder.appendChild(box);
                }
                if (holder.parentNode !== display) display.appendChild(holder);
                if (builtVersion === version) return;
                builtVersion = version;
                const tags = document.createDocumentFragment();
                for (let i = 0; i < texts.length; i += 1) {
                    const tag = document.createElement('div');
                    tag.className = (flags[i] & 1) ? 'aui-select__tag aui-select__tag--locked' : 'aui-select__tag';
                    const text = document.createElement('span');
                    text.className = (flags[i] & 2) ? 'aui-select__tag-text aui-select__pending' : 'aui-select__tag-text';
                    text.textContent = texts[i];
                    tag.appendChild(text);
                    if (!(flags[i] & 1)) {
                        const remove = document.createElement('span');
                        remove.className = 'aui-select__tag-remove';
                        tag.appendChild(remove);
                    }
                    tags.appendChild(tag);
                }
                const count = document.createElement('div');
                count.className = 'aui-select__tag aui-select__tag--count';
                count.textContent = '+' + total;
                tags.appendChild(count);
                box.textContent = '';
                box.appendChild(tags);
            }

            function observe(tagsEl, measureEl) {
                if (typeof window.ResizeObserver !== 'function') return;
                if (tagsEl === observedTags && measureEl === observedMeasure) return;
                if (!observer) observer = new window.ResizeObserver(function () { measure(); });
                observer.disconnect();
                observedTags = tagsEl;
                observedMeasure = measureEl;
                if (tagsEl) observer.observe(tagsEl);
                if (measureEl) observer.observe(measureEl);
            }

            function measure() {
                scheduled = false;
                if (destroyed) return;
                const tagsEl = cfg.root.querySelector('.aui-select__tags--responsive');
                if (!tagsEl) return;
                sync();
                build(tagsEl.parentNode);
                observe(tagsEl, box);
                const available = tagsEl.clientWidth;
                if (!(available > 0)) return;   // not laid out (e.g. in a hidden tab): keep the last count
                const tags = box.children;
                const countTag = tags[texts.length];
                const gap = parseFloat(window.getComputedStyle(tagsEl).columnGap) || 0;
                const countWidth = countTag ? countTag.getBoundingClientRect().width : 0;
                let used = 0;
                let fit = 0;
                for (let i = 0; i < texts.length; i += 1) {
                    const next = used + (i > 0 ? gap : 0) + tags[i].getBoundingClientRect().width;
                    const rest = i + 1 < total ? gap + countWidth : 0;
                    if (next + rest > available + 0.5) break;
                    used = next;
                    fit = i + 1;
                }
                // When even the first tag does not fit, it shows cut with an ellipsis, as long as a readable part of
                // its text is left (TAG_MIN_TEXT_PX); else only the count tag shows ("+N", its tooltip lists them).
                if (fit === 0 && texts.length > 0) {
                    const textEl = tags[0].firstChild;
                    const textWidth = textEl ? textEl.getBoundingClientRect().width : 0;
                    const frame = tags[0].getBoundingClientRect().width - textWidth;
                    const rest = total > 1 ? gap + countWidth : 0;
                    if (frame + TAG_MIN_TEXT_PX + rest <= available + 0.5) fit = 1;
                }
                if (fit !== fitted) {
                    fitted = fit;
                    cfg.onFit(fit);
                }
            }

            return {
                sync: sync,
                schedule: function () {
                    if (scheduled || destroyed) return;
                    scheduled = true;
                    cfg.scope.$$postDigest(measure);
                },
                destroy: function () {
                    destroyed = true;
                    if (observer) observer.disconnect();
                    observer = null;
                    observedTags = null;
                    observedMeasure = null;
                    if (holder && holder.parentNode) holder.parentNode.removeChild(holder);
                    holder = null;
                    box = null;
                }
            };
        }

        const POINTER_DOWN = typeof window.PointerEvent === 'function' ? 'pointerdown' : 'mousedown';

        /**
         * While a dropdown is open, close it on a press outside `root` (capture phase, so a handler that stops
         * propagation cannot hide the press) and when focus moves into an iframe (a click there never reaches this
         * document). Listens only between start() and stop(); a press that changes nothing starts no digest.
         * close() is called in the event itself, outside a digest: the component closes its panel at once with a
         * digest of its own; the page's code of the close runs at once, the page's digest after the close's first
         * frame or its motion (createPageDigest). (A digest of the whole page here held the close back: on a large
         * page its first frames were lost.)
         * cfg: {root: Element, isOpen(): boolean, close()}
         */
        function createDismiss(cfg) {
            let listening = false;

            function onPointerDown(event) {
                if (!cfg.isOpen() || cfg.root.contains(event.target)) return;
                cfg.close();
            }

            function onWindowBlur() {
                setTimeout(function () {
                    const active = document.activeElement;
                    if (!listening || !cfg.isOpen() || !active || active.tagName !== 'IFRAME') return;
                    cfg.close();
                }, 0);
            }

            return {
                start: function () {
                    if (listening) return;
                    listening = true;
                    document.addEventListener(POINTER_DOWN, onPointerDown, true);
                    window.addEventListener('blur', onWindowBlur);
                },
                stop: function () {
                    if (!listening) return;
                    listening = false;
                    document.removeEventListener(POINTER_DOWN, onPointerDown, true);
                    window.removeEventListener('blur', onWindowBlur);
                }
            };
        }

        /**
         * Focus leaving `root` (Tab, a click on another control): fn(next) with the element that receives focus, or
         * null when focus goes nowhere (a click on the page). Called in the event (no digest: fn starts what it needs,
         * see createPageDigest). Returns a function that stops it.
         */
        function onFocusLeave(root, fn) {
            function handler(event) {
                const next = event.relatedTarget;
                if (next && root.contains(next)) return;
                fn(next || null);
            }

            root.addEventListener('focusout', handler);
            return function () { root.removeEventListener('focusout', handler); };
        }

        /**
         * The trigger of a dropdown opens and closes on the press of the primary mouse button, as a native select does:
         * the click comes only when the button is let go, a tenth of a second or so later, and opening on it feels
         * slow. The press keeps the focus on the trigger itself (its default action could take the focus back from a
         * search box the opening has just focused). The click of that press is then not a second toggle; a click
         * without a press (keyboard activation by assistive technology, element.click()) toggles as before. Presses on
         * `ignore` (a tag's remove button, the clear button) are left to their own click.
         *   cfg: {trigger, ignore: selector, enabled(): boolean, press(event), click(event, afterPress),
         *        focus?: the element the press focuses (the trigger)}
         * Returns a function that removes the listeners.
         */
        function onTriggerPress(cfg) {
            const trigger = cfg.trigger;
            let pressed = false;
            let releaseTimer = null;
            function released() {
                document.removeEventListener('mouseup', released, true);
                // after the click of this press (it comes right after)
                releaseTimer = setTimeout(function () {
                    releaseTimer = null;
                    pressed = false;
                }, 0);
            }
            function onMousedown(event) {
                if (event.button !== 0 || !cfg.enabled()) return;
                if (cfg.ignore && event.target && event.target.closest && event.target.closest(cfg.ignore)) return;
                event.preventDefault();
                focusQuietly(cfg.focus || trigger);
                // a press right after the last one (input sent by a script) is a press of its own: the last one's
                // reset is not for it
                clearTimeout(releaseTimer);
                releaseTimer = null;
                pressed = true;
                document.addEventListener('mouseup', released, true);
                cfg.press(event);
            }
            function onClick(event) {
                const afterPress = pressed;
                pressed = false;
                cfg.click(event, afterPress);
            }
            trigger.addEventListener('mousedown', onMousedown);
            trigger.addEventListener('click', onClick);
            return function () {
                trigger.removeEventListener('mousedown', onMousedown);
                trigger.removeEventListener('click', onClick);
                document.removeEventListener('mouseup', released, true);
                clearTimeout(releaseTimer);
            };
        }

        // The last kind of input on the page: a pointer (mouse, touch, pen) or the keyboard (see quietPointerFocus).
        let lastInputPointer = false;
        let inputKindTracked = false;
        const MODIFIER_KEYS = {Shift: true, Control: true, Alt: true, Meta: true, AltGraph: true, CapsLock: true};
        // trigger -> {cls: its quiet class, within: it holds the focusable boxes}, while its component lives
        const quietTriggers = new WeakMap();

        // the trigger that has the focus: the focused element, or the one of several boxes around it
        function quietTriggerOf(focused) {
            if (!focused) return null;
            if (quietTriggers.has(focused)) return focused;
            for (let el = focused.parentElement; el; el = el.parentElement) {
                const entry = quietTriggers.get(el);
                if (entry) return entry.within ? el : null;
            }
            return null;
        }

        function trackInputKind() {
            if (inputKindTracked) return;
            inputKindTracked = true;
            // A pointer in use also quiets the trigger that has the focus already (a press on it, on a row of a panel
            // without a search box; a day picked while a date picker's box keeps the focus): no focus event comes there.
            const pointer = function () {
                lastInputPointer = true;
                const trigger = quietTriggerOf(document.activeElement);
                if (trigger) trigger.classList.add(quietTriggers.get(trigger).cls);
            };
            document.addEventListener('pointerdown', pointer, true);
            document.addEventListener('mousedown', pointer, true);
            document.addEventListener('keydown', function (event) {
                if (!MODIFIER_KEYS[event.key]) lastInputPointer = false;
            }, true);
        }

        /**
         * A trigger shows its focus ring only while the keyboard is used, as a native select does: focused just after
         * pointer input (a choice made with the mouse, a press on the trigger) it gets `cls` and looks as it does
         * without focus, until a key other than a modifier is pressed (or it loses the focus). It keeps the focus all
         * the time, so the keyboard goes on from it. (The browser's own :focus-visible cannot be used: after a choice
         * the focus comes back from the search box, a text field, and so would always show the ring.)
         * within: the trigger holds the focusable boxes (aui-date-picker's text boxes): the focus coming into it or
         * moving inside it, and leaving it. Returns a function that removes the listeners.
         */
        function quietPointerFocus(trigger, cls, within) {
            trackInputKind();
            quietTriggers.set(trigger, {cls: cls, within: !!within});
            const focusType = within ? 'focusin' : 'focus';
            const blurType = within ? 'focusout' : 'blur';
            function onFocus() {
                if (lastInputPointer) trigger.classList.add(cls);
            }
            function onKeydown(event) {
                if (!MODIFIER_KEYS[event.key]) trigger.classList.remove(cls);
            }
            function onBlur(event) {
                if (within && event.relatedTarget && trigger.contains(event.relatedTarget)) return;
                trigger.classList.remove(cls);
            }
            trigger.addEventListener(focusType, onFocus);
            trigger.addEventListener('keydown', onKeydown);
            trigger.addEventListener(blurType, onBlur);
            return function () {
                trigger.removeEventListener(focusType, onFocus);
                trigger.removeEventListener('keydown', onKeydown);
                trigger.removeEventListener(blurType, onBlur);
                quietTriggers.delete(trigger);
                trigger.classList.remove(cls);
            };
        }

        /**
         * fn once the browser has drawn the next frame: an animation started now is on screen then (one of opacity or
         * transform runs on the compositor from there, whatever the main thread does), before long work. A document in
         * the background draws no frames: a timer then, and a safety timer if the frame does not come. Returns a
         * function that cancels it.
         */
        function afterFrame(fn) {
            let done = false;
            let frame = null;
            let timer = null;
            let safety = null;
            function run() {
                if (done) return;
                done = true;
                clearTimeout(timer);
                clearTimeout(safety);
                fn();
            }
            if (!document.hidden && typeof window.requestAnimationFrame === 'function') {
                frame = window.requestAnimationFrame(function () {
                    frame = null;
                    timer = setTimeout(run, 0);   // after this frame is drawn
                });
                safety = setTimeout(run, 100);
            } else {
                timer = setTimeout(run, 0);
            }
            return function () {
                done = true;
                if (frame !== null && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame);
                clearTimeout(timer);
                clearTimeout(safety);
            };
        }

        // The fields' and panels' motion (--aui-motion-duration-shape, 0.22s), and a frame
        const MOTION_MS = 280;

        /**
         * The digest of the whole page that a close from the user's input owes it. The close digests its component
         * only: a digest of the whole page is long on a large page, and the field's colours (its ring, its border) are
         * drawn on the main thread, so before, the close waited for it and its first frames were lost. The page's own
         * code of the close runs at once, in its order, in the component's own digest (touched, on-close, the value
         * picked with ng-change: see closeFromInput); the page's bindings show what it changed in the digest owed here:
         * - owe(): after the close's first frame (afterFrame): the panel's fade and scale have started by then and go
         *   on on the compositor meanwhile. For a value: the page shows it soon.
         * - owe(true): once the motion has ended (MOTION_MS), so that no digest cuts into it. Owed both ways, the
         *   sooner wins.
         * - oweAfterPause(ms): values checked one after another with the panel open (several values): once the picking
         *   pauses (ms, PICK_PAUSE_MS by default, after the last pick; each pick starts it again). Meanwhile input in this field
         *   (ownElement: the next pick, a key in its list) does not run it, input anywhere else does.
         * The user's next input anywhere (a press, a key) runs it first, before the page handles that input: the
         * page's bindings are current then (e.g. a button that the new value enables). (Watched from the task after
         * the input that owed it, not to take that input's own events.) forget(): a digest of the whole page runs now
         * anyway (the caller's), or the component is destroyed. work: run first in that digest (the modal: the close's
         * actions and is-open).
         */
        const NEXT_INPUT_EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'keydown'];
        const PICK_PAUSE_MS = 400;

        function createPageDigest(scope, ownElement, work) {
            let owed = false;
            let cancelFrame = null;
            let motionTimer = null;
            let pauseTimer = null;
            let inPlace = false;     // owed by picks with the panel open only: input in this field does not run it
            let guardTimer = null;
            let guarding = false;

            function onNextInput(event) {
                const own = inPlace && ownElement ? ownElement() : null;
                if (own && event.target && own.contains(event.target)) return;
                digest();
            }

            function guard() {
                if (guarding || guardTimer) return;
                guardTimer = setTimeout(function () {
                    guardTimer = null;
                    if (!owed || guarding) return;
                    guarding = true;
                    NEXT_INPUT_EVENTS.forEach(function (type) { document.addEventListener(type, onNextInput, true); });
                }, 0);
            }

            function forget() {
                owed = false;
                if (cancelFrame) cancelFrame();
                cancelFrame = null;
                if (motionTimer) clearTimeout(motionTimer);
                motionTimer = null;
                if (pauseTimer) clearTimeout(pauseTimer);
                pauseTimer = null;
                inPlace = false;
                if (guardTimer) clearTimeout(guardTimer);
                guardTimer = null;
                if (!guarding) return;
                guarding = false;
                NEXT_INPUT_EVENTS.forEach(function (type) { document.removeEventListener(type, onNextInput, true); });
            }

            function digest() {
                if (!owed) return;
                forget();
                // inside a digest already (page code that sent an input): the whole page right after it
                if (scope.$root && scope.$root.$$phase) scope.$applyAsync(work);
                else scope.$apply(work);
            }

            return {
                owe: function (afterMotion) {
                    owed = true;
                    inPlace = false;                             // a close or a focus leaving: the usual rules
                    if (pauseTimer) clearTimeout(pauseTimer);    // its own time replaces the pause (never inside its motion)
                    pauseTimer = null;
                    guard();
                    if (cancelFrame) return;                     // owed after the frame already: that comes first
                    if (afterMotion) {
                        if (!motionTimer) motionTimer = setTimeout(digest, MOTION_MS);
                        return;
                    }
                    if (motionTimer) clearTimeout(motionTimer);  // sooner now: after the frame
                    motionTimer = null;
                    cancelFrame = afterFrame(digest);
                },
                oweAfterPause: function (ms) {
                    owed = true;
                    guard();
                    if (cancelFrame || motionTimer) return;      // owed sooner already (a close): that comes first
                    inPlace = true;
                    if (pauseTimer) clearTimeout(pauseTimer);
                    pauseTimer = setTimeout(digest, ms > 0 ? ms : PICK_PAUSE_MS);
                },
                forget: forget
            };
        }

        /**
         * An action of the user that asks the page for something (an opening: its loader, its on-open, a lookup; a
         * branch: on-expand, its children): the component first, the page after. Asked first, the page's digest (long
         * on a large page) ran inside the press, before the component was drawn: the press seemed to do nothing for
         * that long, and the loading look never showed.
         * - open(fn): fn changes the component now; the page's calls it makes through ask(call) wait (queuing() is
         *   true while fn runs); the component is drawn in its own digest (draw), its loading look on while waiting()
         *   (nothing of the page is queued then, so that digest stays its own); right after that frame the calls run,
         *   in their order, in one digest of the page. Calls still waiting from an action just before (two within one
         *   frame) go first. Inside a digest (page code acting) everything runs at once, as before.
         * - flush(): the waiting calls now (a close before the frame: on-open before on-close); cancel(): dropped (the
         *   component destroyed).
         */
        function createOpening(scope, draw) {
            let queue = null;        // while fn runs: the page's calls it asked for
            let pending = null;      // asked for, waiting for the frame
            let cancelFrame = null;

            // every call runs, a failing one too; the first error goes on to the digest's exception handler
            function runCalls(calls) {
                let failure = null;
                calls.forEach(function (call) {
                    try { call(); } catch (e) { if (!failure) failure = e; }
                });
                if (failure) throw failure;
            }

            function take() {
                if (cancelFrame) cancelFrame();
                cancelFrame = null;
                const calls = pending;
                pending = null;
                return calls;
            }

            function runAfterFrame() {
                cancelFrame = null;
                const calls = take();
                if (calls) scope.$apply(function () { runCalls(calls); });
            }

            return {
                open: function (fn) {
                    if (scope.$root.$$phase) {
                        fn();
                        return;
                    }
                    queue = take() || [];   // an action just before, still waiting: its calls first, after this frame
                    let failed = true;
                    try {
                        fn();
                        failed = false;
                    } finally {
                        pending = queue.length ? queue : null;
                        queue = null;
                        // an fn that failed midway: what it asked for still runs (no loading look left on)
                        if (failed && pending) cancelFrame = afterFrame(runAfterFrame);
                    }
                    draw();
                    // after draw: the component's own frame callbacks (its panel's open animation) come first in that
                    // frame, so the animation is on screen before the page's digest
                    if (pending && !cancelFrame) cancelFrame = afterFrame(runAfterFrame);
                },
                ask: function (call) {
                    if (queue) queue.push(call);
                    else call();
                },
                queuing: function () {
                    return !!queue;
                },
                waiting: function () {
                    return !!(queue || pending);
                },
                flush: function () {
                    const calls = take();
                    if (!calls) return;
                    // (an error does not stop the close it runs in: reported on its own)
                    try { runCalls(calls); } catch (e) { setTimeout(function () { throw e; }, 0); }
                },
                cancel: function () {
                    take();
                }
            };
        }


        /**
         * An answer of the page's loader arrives in a digest of the page ($http, $timeout). Changed there, the
         * component's rows made that digest run every watcher of the page a second time (its first pass found them
         * changed): on a large page the longest stall after an answer. deliver(fn) runs fn after that digest instead
         * ($$postDigest) and shows it with the component's own digest (digestOwn: work of the page queued meanwhile,
         * e.g. a lookup's request, still gets the page's) - the page's digest ends after one pass. watch() lists what
         * the page itself shows of the component (its model, its validity, selected-items): when any of it differs
         * after fn, the page's digest runs at once, as before. Outside a digest: fn at once (its caller digests).
         * fn checks for itself that what it answers is still wanted (it runs a moment later, in the same task).
         */
        function createDelivery(scope, watch) {
            // the same for the page: each the same value, or an equal copy (selected-items is built anew with the
            // data; an equal copy shows the page nothing new)
            const same = function (a, b) {
                if (a.length !== b.length) return false;
                for (let i = 0; i < a.length; i += 1) {
                    if (a[i] !== b[i] && !(a[i] !== null && typeof a[i] === 'object' && angular.equals(a[i], b[i]))) return false;
                }
                return true;
            };
            return function deliver(fn) {
                const root = scope.$root;
                if (!root || !root.$$phase) {
                    fn();
                    return;
                }
                root.$$postDigest(function () {
                    if (scope.$$destroyed) return;
                    const before = watch();
                    try {
                        fn();
                    } finally {
                        if (!scope.$$destroyed) {
                            if (same(before, watch())) digestOwn(scope);
                            else root.$apply();
                        }
                    }
                });
            };
        }

        /**
         * A digest of the component's own scope only (what it changed shows nowhere else on the page) - unless the
         * page waits for a digest: work of the page's own scopes queued outside a digest (page code's $evalAsync, a
         * promise's callbacks) waits in Angular's one queue for a digest of the page asked for a moment later, and any
         * digest runs that queue. The component's own digest would run the page's work then, and the page's digest,
         * finding the queue empty, would not come: the page's bindings would not show that work until some later
         * digest. So then the digest of the page runs instead, now. Work the component queued on its own scopes (its
         * on-close, its pick, run in its own digest) is its own: no digest of the page for it. Inside a digest:
         * nothing (that digest shows it). ($rootScope.$$asyncQueue: Angular 1.5's queue.)
         */
        function digestOwn(scope) {
            const root = scope.$root;
            if (root.$$phase) return;
            if (pageWorkWaits(scope)) root.$apply();
            else scope.$digest();
        }

        // work of a scope outside the component's (scope and the scopes under it) waits in Angular's queue
        function pageWorkWaits(scope) {
            const queue = scope.$root.$$asyncQueue;
            if (!queue || !queue.length) return false;
            for (let i = 0; i < queue.length; i += 1) {
                let owner = queue[i].scope;
                while (owner && owner !== scope) owner = owner.$parent;
                if (!owner) return true;
            }
            return false;
        }

        /**
         * What caused a field's value to change (on-change's triggerSource), and whether the user made it (byUser): a
         * pick with the pointer ('option') or with the keyboard ('keyboard'), a tag removed ('remove-tag'), the clear
         * button ('clear'), typing ('input'), a date or time picked in a date picker ('pick'), one of its shortcuts
         * ('shortcut') or its Now ('now'), a checkbox checked or cleared ('toggle'), a group's select-all ('select-all');
         * page code through the field's api ('api'); the field itself, choosing the only option of a required field
         * ('auto-select') or emptying a value its load-params no longer have ('params-reset'). A source not listed here
         * counts as not made by the user.
         */
        const CHANGE_BY_USER = Object.freeze({option: true, keyboard: true, 'remove-tag': true, clear: true, input: true,
            pick: true, shortcut: true, now: true, toggle: true, 'select-all': true});

        /**
         * Tells the page that a field's value changed. change: {value, oldValue, triggerSource} and the component's own
         * fields; locals: the component's own names for the call form. on-change written as a call
         * (on-change="vm.changed($value, $byUser)") runs with the locals $value, $oldValue, $triggerSource, $byUser and
         * the component's; written as a reference (on-change="vm.changed") the expression gives the function, which is
         * called with one object: change and byUser. element (aui-select, aui-tree-select): a native "change" event on
         * it after that, its detail {value, oldValue, triggerSource, byUser}. An error in the page's function is
         * reported and does not stop the field.
         */
        function reportChange(onChange, change, locals, element, name) {
            const byUser = CHANGE_BY_USER[change.triggerSource] === true;
            if (typeof onChange === 'function') {
                try {
                    const result = onChange(angular.extend({
                        $value: change.value,
                        $oldValue: change.oldValue,
                        $triggerSource: change.triggerSource,
                        $byUser: byUser
                    }, locals));
                    if (typeof result === 'function') result(angular.extend({}, change, {byUser: byUser}));
                } catch (e) {
                    console.error('Error in ' + name + ' on-change:', e);
                }
            }
            if (!element) return;
            try {
                element.dispatchEvent(new CustomEvent('change', {
                    bubbles: true,
                    cancelable: true,
                    detail: {value: change.value, oldValue: change.oldValue, triggerSource: change.triggerSource, byUser: byUser}
                }));
            } catch (e) {
                console.error('Error while dispatching the ' + name + ' change event:', e);
            }
        }

        /** Focus without scrolling the page (plain focus where preventScroll is not supported). */
        function focusQuietly(el) {
            if (!el) return;
            try {
                el.focus({preventScroll: true});
            } catch (e) {
                el.focus();
            }
        }

        /** Scroll `list` so `el` is in view. mode: 'nearest', 'center', or 'center-if-hidden' (centre only if not fully visible). */
        function revealInList(list, el, mode) {
            if (!list || !el) return;
            const listRect = list.getBoundingClientRect();
            // The panel can still be scaled by its opening animation: measure in layout pixels.
            const scale = list.offsetHeight > 0 && listRect.height > 0 ? listRect.height / list.offsetHeight : 1;
            const rect = el.getBoundingClientRect();
            const top = (rect.top - listRect.top) / scale + list.scrollTop;
            const itemHeight = rect.height / scale;
            const height = list.clientHeight;
            const hidden = top < list.scrollTop || top + itemHeight > list.scrollTop + height;
            if (mode === 'center' || (mode === 'center-if-hidden' && hidden)) {
                list.scrollTop = Math.max(0, top - (height - itemHeight) / 2);
            } else if (mode === 'nearest') {
                if (top < list.scrollTop) list.scrollTop = top;
                else if (top + itemHeight > list.scrollTop + height) list.scrollTop = top + itemHeight - height;
            }
        }

        /**
         * True when the text of `el` is cut off (wider than its box). The browser draws an ellipsis for any part of a
         * pixel too long, which the whole-pixel scrollWidth and clientWidth may round away: within that pixel, the text's
         * width is measured against the box's room.
         */
        function isCutOff(el) {
            if (!el) return false;
            const over = el.scrollWidth - el.clientWidth;
            if (over > 1) return true;
            if (over < 0 || !el.firstChild) return false;
            const range = document.createRange();
            range.selectNodeContents(el);
            const cs = window.getComputedStyle(el);
            const room = el.getBoundingClientRect().width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) -
                (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0);
            return range.getBoundingClientRect().width > room + 0.01;
        }

        /**
         * The field's label in its box is cut with an ellipsis when it is longer than its room (half the field by
         * default, see .aui-control-label): on hover it then shows its whole text as a tooltip, and none while it
         * shows whole, as an option row does. Returns a function that removes the listener.
         */
        function labelTip(root) {
            function onOver(event) {
                const label = event.target && event.target.closest ? event.target.closest('.aui-control-label') : null;
                if (!label || !root.contains(label)) return;
                const text = isCutOff(label) ? label.textContent.trim() : '';
                if (text) {
                    if (label.getAttribute('title') !== text) label.setAttribute('title', text);
                } else if (label.hasAttribute('title')) {
                    label.removeAttribute('title');
                }
            }
            root.addEventListener('mouseover', onOver, {passive: true});
            return function () { root.removeEventListener('mouseover', onOver); };
        }

        /**
         * Typeahead for a list: returns fn(char, count, from, textAt) -> the next index after `from` whose text
         * (textAt(i), lower case) starts with the letters typed within resetMs of each other, or -1.
         */
        function createTypeahead(resetMs) {
            let typed = '';
            let at = 0;
            return function (char, count, from, textAt) {
                const now = Date.now();
                typed = now - at > resetMs ? char : typed + char;
                at = now;
                if (count === 0) return -1;
                const query = typed.toLowerCase();
                const startAt = typed.length === 1 ? from + 1 : Math.max(0, from);
                for (let step = 0; step < count; step += 1) {
                    const i = (startAt + step) % count;
                    if (textAt(i).indexOf(query) === 0) return i;
                }
                return -1;
            };
        }

        return {
            TAG_RENDER_CAP: TAG_RENDER_CAP,
            isSelectionKey: isSelectionKey,
            readFlag: readFlag,
            borderRadius: borderRadius,
            readLimit: readLimit,
            isComposing: isComposing,
            isRepeat: isRepeat,
            readTagMode: readTagMode,
            hiddenTagsTitle: hiddenTagsTitle,
            highlightSegments: highlightSegments,
            panelBackgroundStyle: panelBackgroundStyle,
            createTagFit: createTagFit,
            createDismiss: createDismiss,
            onFocusLeave: onFocusLeave,
            createPageDigest: createPageDigest,
            createOpening: createOpening,
            createDelivery: createDelivery,
            digestOwn: digestOwn,
            afterFrame: afterFrame,
            reportChange: reportChange,
            focusQuietly: focusQuietly,
            onTriggerPress: onTriggerPress,
            quietPointerFocus: quietPointerFocus,
            revealInList: revealInList,
            isCutOff: isCutOff,
            labelTip: labelTip,
            followNgFlags: followNgFlags,
            createTypeahead: createTypeahead
        };
    }]);
