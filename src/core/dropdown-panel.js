/**
 * auiDropdownPanel: places a field's panel next to its trigger (Floating UI), opens and closes it.
 */
angular.module('aui')
    /**
     * Dropdown panel engine shared by aui-select and aui-tree-select: Floating UI positioning, top-layer popover
     * and the open/close animation. Works on plain DOM and never starts an Angular digest.
     */
    .factory('auiDropdownPanel', [function () {
        const CLOSE_CLASS_DELAY_MS = 200;
        const CLOSE_POPOVER_DELAY_MS = 220;
        const VIEWPORT_PADDING_PX = 8;      // the panel keeps this far from the edges of the screen
        const SWITCH_BELOW_PX = 160;        // an open panel moves to the other side only when its side has less room
        const MIN_LIST_PX = 96;             // the list is never made shorter than this (about three rows)
        const DEFAULT_LIST_MAX_PX = 300;    // .aui-select__options max-height, when no list is rendered yet
        const SEARCH_ALLOWANCE_PX = 56;     // the search box, counted while content is coming and it is not shown yet
        const LIST_MAX_VAR = '--aui-panel-list-max';
        // First content growing the open panel (growNext): as long and with the same curve as the open animation (CSS)
        const GROW_MS = 220;
        const GROW_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
        const FADE_IN_MS = 170;             // content shown by the growth fades in, so its brief squash is not seen
        const FADE_IN_DELAY_MS = 30;
        const GROW_WATCH_MS = 1000;         // how long growNext waits for the content to make the panel taller

        /**
         * Viewport origin of the containing block that a `position: fixed` element placed next to `el` would use.
         * A probe sibling is measured instead of walking ancestors.
         */
        function fixedContainingBlockOrigin(el) {
            const parent = el && el.parentElement;
            if (!parent) return {left: 0, top: 0};
            const probe = document.createElement('div');
            probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;margin:0;padding:0;border:0;' +
                'visibility:hidden;pointer-events:none;contain:strict;';
            parent.appendChild(probe);
            const rect = probe.getBoundingClientRect();
            parent.removeChild(probe);
            return {left: rect.left, top: rect.top};
        }

        /**
         * A position or a length in CSS px moved onto whole device pixels. The panel has a compositor layer of its own,
         * which the browser does not move onto the screen's pixels as it does the page's boxes: placed on a fraction of
         * a pixel (a field in a grid of fractional widths), its borders and text were drawn soft.
         */
        function onDevicePixels(value) {
            const ratio = window.devicePixelRatio || 1;
            return Math.round(value * ratio) / ratio;
        }

        // The aui-select class names (the default); a caller can pass its own set.
        const DEFAULT_CLASSES = Object.freeze({
            open: 'aui-select__panel--open',
            panelTop: 'aui-select__panel--top',
            panelBottom: 'aui-select__panel--bottom',
            triggerTop: 'aui-select__trigger--top',
            triggerBottom: 'aui-select__trigger--bottom'
        });

        /**
         * cfg: {trigger, panel, classes?: {open, panelTop, panelBottom, triggerTop, triggerBottom},
         *       strategy(): 'fixed' | 'absolute', minWidth?(): px, growable?(): boolean, onShown?(), onClosed?(),
         *       ownWidth?(): boolean (the panel keeps the width of its content, its left edge on the trigger's: a
         *       calendar), onPlaced?() (after each placement, the side classes set: a panel of its own width
         *       measures where its edges meet the trigger's), onListLimited?() (the open list was given another
         *       height to fit its side: a short viewport; the field keeps its active row in view)}
         *
         * Placement: the side of the trigger (below or above) is chosen when the panel opens, by the height it will
         * need, and kept while it stays open: content that changes (data arriving, a search narrowing the list, nodes
         * opening) never moves it to the other side. growable() says whether the content can still grow; then the
         * panel is counted at its full height (search box and the list at its maximum height). It moves to the other
         * side only when scrolling or resizing leaves less than SWITCH_BELOW_PX on its side and the other side has
         * more. When its side has less room than the content needs, the list gets shorter and scrolls, so the panel
         * never runs off the screen.
         */
        function create(cfg) {
            const floating = window.FloatingUIDOM;
            const trigger = cfg.trigger;
            const panel = cfg.panel;
            const cls = cfg.classes || DEFAULT_CLASSES;
            const usePopover = !!panel && typeof panel.showPopover === 'function';
            if (usePopover) {
                panel.setAttribute('popover', 'manual');
            }

            let opened = false;
            let destroyed = false;
            let entering = false;
            let token = 0;
            let closeTimer = null;
            let hideTimer = null;
            let stopAutoUpdate = null;
            let placementGroup = null;
            let side = null;        // 'bottom' | 'top' while open; null until it is chosen (on open)
            let growWatch = null;       // growNext: the ResizeObserver waiting for the content (and following its growth)
            let growWatchTimer = null;
            let growAnimations = [];
            let growTransform = null;   // the panel's growth animation (of growAnimations)

            /** Vertical padding and border of an element: its height beyond the content. */
            function boxExtra(el) {
                const style = window.getComputedStyle(el);
                return (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) +
                    (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
            }

            /**
             * The panel at its full height: padding and border, the search box, and the list at its maximum height.
             * While the content is still coming, the search box may not be there yet (a tree shows it once it has
             * more than a few nodes): room for one is counted then.
             */
            function fullHeight() {
                const search = panel.querySelector('.aui-select__search');
                const list = panel.querySelector('.aui-select__options');
                const listMax = list ? parseFloat(window.getComputedStyle(list).maxHeight) : NaN;
                return boxExtra(panel) + (search ? search.offsetHeight : SEARCH_ALLOWANCE_PX) +
                    (isFinite(listMax) ? listMax : DEFAULT_LIST_MAX_PX) + (list ? boxExtra(list) : 8);
            }

            /** The height the panel needs: what it shows now, or its full height while the content can still grow. */
            function neededHeight(current) {
                return cfg.growable && cfg.growable() ? Math.max(current, fullHeight()) : current;
            }

            /**
             * The side: chosen once the panel has a height (it is laid out only after the first position), then
             * kept; changed only when scrolling or resizing leaves less than SWITCH_BELOW_PX on it and the other
             * side has more. Room on a side is measured as Floating UI's flip does: how far a panel of the needed
             * height placed there would overflow the boundary.
             */
            function sideMiddleware(myToken, boundary) {
                return {
                    name: 'auiSide',
                    fn: function (state) {
                        if (myToken !== token) return {};
                        const shown = state.rects.floating.height;
                        if (!shown) return {};   // not laid out yet: the side is chosen at the next position
                        const needed = neededHeight(shown);
                        const ref = state.rects.reference;
                        const room = function (which) {
                            const y = which === 'bottom' ? ref.y + ref.height : ref.y - needed;
                            const probe = Object.assign({}, state, {
                                y: y,
                                rects: {reference: ref, floating: {x: state.x, y: y, width: state.rects.floating.width, height: needed}}
                            });
                            return Promise.resolve(floating.detectOverflow(probe, {
                                boundary: boundary, rootBoundary: 'viewport', padding: VIEWPORT_PADDING_PX
                            })).then(function (overflow) {
                                return needed - (which === 'bottom' ? overflow.bottom : overflow.top);
                            });
                        };
                        return Promise.all([room('bottom'), room('top')]).then(function (rooms) {
                            const below = rooms[0];
                            const above = rooms[1];
                            let next = side;
                            if (next === null) {
                                next = below >= needed ? 'bottom' : (above >= needed ? 'top' : (above > below ? 'top' : 'bottom'));
                            } else {
                                const here = next === 'bottom' ? below : above;
                                const there = next === 'bottom' ? above : below;
                                if (here < Math.min(SWITCH_BELOW_PX, needed) && there > here) next = next === 'bottom' ? 'top' : 'bottom';
                            }
                            if (myToken !== token) return {};
                            side = next;
                            const placement = next + '-start';
                            return state.placement === placement ? {} : {reset: {placement: placement}};
                        });
                    }
                };
            }

            /**
             * Height of the panel apart from the list: from the panel's top edge to the list (border, padding, search
             * box, through positioned wrappers), and from the list to the panel's bottom edge (what follows it,
             * padding and border of each wrapper). Built from offsetTop and offsetHeight, which the opening
             * transform and a height animation of the panel do not change. null while the list is not shown.
             */
            function heightAroundList(list) {
                let above = 0;
                let el = list;
                while (el !== panel) {
                    const parent = el.offsetParent;
                    if (!parent) return null;
                    above += el.offsetTop + parent.clientTop;
                    el = parent;
                }
                let below = 0;
                for (let child = list; child !== panel; child = child.parentElement) {
                    const parent = child.parentElement;
                    if (!parent) return null;
                    for (let next = child.nextElementSibling; next; next = next.nextElementSibling) below += next.offsetHeight;
                    const style = window.getComputedStyle(parent);
                    below += (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
                }
                return above + below;
            }

            /**
             * The list never makes the panel taller than the room on its side: its maximum content height (CSS
             * variable LIST_MAX_VAR) is that room less the rest of the panel and the list's own padding and border.
             */
            function limitList(available) {
                const list = panel.querySelector('.aui-select__options');
                const around = list ? heightAroundList(list) : null;
                if (around === null) return;   // not shown (yet): measured at the next position
                const value = Math.max(MIN_LIST_PX, Math.floor(available - around - boxExtra(list))) + 'px';
                if (panel.style.getPropertyValue(LIST_MAX_VAR) === value) return;
                panel.style.setProperty(LIST_MAX_VAR, value);
                // The first placement of an opening comes before the panel is shown, so it cannot measure the list: its
                // height is fitted at the next one, after the field brought its selected row into view for the list's
                // full height - in a short viewport (a high zoom) that row was then below the list's end.
                if (cfg.onListLimited) cfg.onListLimited();
            }

            // Panel width follows the trigger, never narrower than cfg.minWidth(). The width is
            // compared as a number: browsers read fractional widths back rounded ("454.4px"), and a string compare
            // would re-measure on every pass and use up Floating UI's reset budget, so the side could no longer change.
            const matchWidth = {
                name: 'auiMatchWidth',
                fn: function (state) {
                    if (cfg.ownWidth && cfg.ownWidth()) return {};
                    const minWidth = cfg.minWidth ? cfg.minWidth() : 0;
                    // between the trigger's edges as the page draws them (on whole device pixels): the panel lines up
                    const reference = state.rects.reference;
                    const edges = onDevicePixels(reference.x + reference.width) - onDevicePixels(reference.x);
                    const width = Math.max(edges, minWidth > 0 ? onDevicePixels(minWidth) : 0);
                    const current = parseFloat(state.elements.floating.style.width);
                    if (!(Math.abs(current - width) <= 0.5)) {
                        state.elements.floating.style.width = width + 'px';
                        return {reset: {rects: true}};
                    }
                    return {};
                }
            };

            function clearTimers() {
                if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
                if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
            }

            function stopTracking() {
                if (stopAutoUpdate) {
                    stopAutoUpdate();
                    stopAutoUpdate = null;
                }
            }

            function inTopLayer() {
                if (!usePopover) return false;
                try {
                    return panel.matches(':popover-open');
                } catch (e) {
                    return false;
                }
            }

            function setPlacement(group) {
                if (group === placementGroup) return;
                placementGroup = group;
                trigger.classList.remove(cls.triggerTop, cls.triggerBottom);
                panel.classList.remove(cls.panelTop, cls.panelBottom);
                if (group === 'top') {
                    trigger.classList.add(cls.triggerTop);
                    panel.classList.add(cls.panelTop);
                    panel.style.transformOrigin = 'bottom center';
                } else if (group === 'bottom') {
                    trigger.classList.add(cls.triggerBottom);
                    panel.classList.add(cls.panelBottom);
                    panel.style.transformOrigin = 'top center';
                }
            }

            function reveal() {
                entering = false;
                // prefers-reduced-motion: reduce - the panel fades in where it stands, it does not grow (theming.md)
                const still = reducedMotion();
                if (!panel.classList.contains(cls.open)) {
                    panel.classList.add(cls.open);
                    // First frame in the closed pose, then animate in.
                    panel.style.opacity = '0';
                    panel.style.transform = still ? 'none' : 'scaleY(0.7)';
                    void panel.offsetHeight;
                }
                if (cfg.onShown) cfg.onShown();
                // Into the open pose at once: the closed pose is in place (the reflow above), so this starts the
                // transition (a timer here only delayed the opening by a frame).
                panel.style.opacity = '1';
                panel.style.transform = still ? 'none' : 'scaleY(1)';
                panel.style.pointerEvents = '';
            }

            function compute(myToken) {
                if (!floating || destroyed || myToken !== token || !opened) return;
                const strategy = cfg.strategy();
                // Room for the side, shift and size: in the top layer nothing but the viewport can clip the panel; otherwise its
                // real clipping ancestors do. (A boundary of document.documentElement would measure a viewport-high
                // box at the document top, which is wrong once the page is scrolled.)
                const boundary = inTopLayer() ? [] : 'clippingAncestors';
                floating.computePosition(trigger, panel, {
                    strategy: strategy,
                    placement: (side || 'bottom') + '-start',
                    middleware: [
                        matchWidth,
                        floating.offset(0),
                        sideMiddleware(myToken, boundary),
                        floating.shift({padding: VIEWPORT_PADDING_PX, boundary: boundary, rootBoundary: 'viewport'}),
                        floating.size({
                            padding: VIEWPORT_PADDING_PX, boundary: boundary, rootBoundary: 'viewport',
                            apply: function (state) {
                                if (myToken === token) limitList(state.availableHeight);
                            }
                        }),
                        floating.hide({strategy: 'referenceHidden'})
                    ]
                }).then(function (pos) {
                    // A close, reopen or destroy since this request makes the result stale.
                    if (destroyed || myToken !== token || !opened) return;
                    let left = onDevicePixels(pos.x);
                    let top = onDevicePixels(pos.y);
                    if (strategy === 'fixed' && !inTopLayer()) {
                        const origin = fixedContainingBlockOrigin(panel);
                        left -= origin.left;
                        top -= origin.top;
                    }
                    // While the trigger is scrolled out of its container, the panel would float over unrelated
                    // content: hide it until the trigger is visible again.
                    const referenceHidden = !!(pos.middlewareData.hide && pos.middlewareData.hide.referenceHidden);
                    Object.assign(panel.style, {
                        left: left + 'px',
                        top: top + 'px',
                        right: 'auto',
                        bottom: 'auto',
                        margin: '0',
                        position: strategy,
                        visibility: referenceHidden ? 'hidden' : ''
                    });
                    setPlacement(pos.placement.indexOf('top') === 0 ? 'top' : 'bottom');
                    if (cfg.onPlaced) cfg.onPlaced();
                    if (entering) reveal();
                }, function () {
                    // Positioning failed (element detached): keep the last position.
                });
            }

            function open() {
                if (destroyed || opened || !trigger || !panel) return;
                clearTimers();
                stopGrowth();
                token += 1;
                opened = true;
                entering = true;
                side = null;                              // each opening chooses the side again
                panel.style.removeProperty(LIST_MAX_VAR); // and starts from the list's own maximum height
                if (usePopover && !inTopLayer()) {
                    try { panel.showPopover(); } catch (e) { /* already shown or detached */ }
                }
                const myToken = token;
                compute(myToken);
                if (floating && floating.autoUpdate) {
                    stopAutoUpdate = floating.autoUpdate(trigger, panel, function () { compute(myToken); });
                }
            }

            function close() {
                if (destroyed || !opened) return;
                opened = false;
                entering = false;
                side = null;
                token += 1;
                const myToken = token;
                clearTimers();
                stopTracking();
                // A growth still running stops at the size drawn and the panel fades out there (a running animation of
                // the transform would keep the close transition from starting); any other close shrinks and fades.
                const growing = !!growTransform && growTransform.playState === 'running';
                const drawn = growing ? drawnScaleY() : 0;
                stopGrowth();
                panel.style.opacity = '0';
                // reduced motion: it fades out where it stands (a growth never runs then)
                panel.style.transform = reducedMotion() ? 'none' : (growing ? 'scaleY(' + drawn + ')' : 'scaleY(0.7)');
                // still drawn while it fades (its open class kept), it takes no pointer: a click there would reach a
                // field that is closed already (a quick second click on an option or a day)
                panel.style.pointerEvents = 'none';
                closeTimer = setTimeout(function () {
                    closeTimer = null;
                    if (myToken !== token) return;
                    // The joined corners of the field and the panel stay square until the panel has faded out: they
                    // close as one (rounded at the start of the close, the field's corners came apart from the panel
                    // still drawn under it). A reopen meanwhile keeps them (its side is chosen again).
                    setPlacement(null);
                    panel.classList.remove(cls.open);
                    if (cfg.onClosed) cfg.onClosed();
                }, CLOSE_CLASS_DELAY_MS);
                if (usePopover) {
                    hideTimer = setTimeout(function () {
                        hideTimer = null;
                        if (myToken !== token) return;
                        try { panel.hidePopover(); } catch (e) { /* not shown or detached */ }
                    }, CLOSE_POPOVER_DELAY_MS);
                }
            }

            function update() {
                if (opened) compute(token);
            }

            function reducedMotion() {
                try {
                    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
                } catch (e) {
                    return false;
                }
            }

            /** The vertical scale the panel is drawn with at this frame (the open animation or a growth running). */
            function drawnScaleY() {
                const transform = window.getComputedStyle(panel).transform;
                const m = transform && transform !== 'none' ? /^matrix\(([^)]+)\)$/.exec(transform) : null;
                const scale = m ? parseFloat(m[1].split(',')[3]) : 1;
                return scale > 0 && scale <= 1 ? scale : 1;
            }

            function stopWatchingGrowth() {
                if (growWatch) {
                    growWatch.disconnect();
                    growWatch = null;
                }
                if (growWatchTimer) {
                    clearTimeout(growWatchTimer);
                    growWatchTimer = null;
                }
            }

            function stopGrowth() {
                stopWatchingGrowth();
                growAnimations.forEach(function (animation) {
                    try { animation.cancel(); } catch (e) { /* already gone */ }
                });
                growAnimations = [];
                growTransform = null;
            }

            /**
             * Grows the panel from its height before (from) to its height now (to), starting at the size it is drawn
             * with: a growth still running and the open animation's transform give way to this one in the same frame
             * (no jump); the open animation's fade goes on. Parts of the panel not shown before (shownBefore given)
             * and the elements in fadeIn fade in.
             */
            function startGrowth(from, to, shownBefore, fadeIn) {
                const start = Math.max(0.05, Math.min(1, from * drawnScaleY() / to));
                growAnimations.forEach(function (animation) {
                    try { animation.cancel(); } catch (e) { /* already gone */ }
                });
                growAnimations = [];
                panel.getAnimations().forEach(function (animation) {
                    if (animation.transitionProperty === 'transform') animation.cancel();
                });
                growTransform = panel.animate([{transform: 'scaleY(' + start + ')'}, {transform: 'scaleY(1)'}],
                    {duration: GROW_MS, easing: GROW_EASING});
                growAnimations.push(growTransform);
                if (!shownBefore) return;
                const fading = Array.prototype.filter.call(panel.children, function (child) {
                    return shownBefore.indexOf(child) === -1 && child.offsetHeight > 0;
                });
                if (fadeIn) {
                    Array.prototype.forEach.call(panel.querySelectorAll(fadeIn), function (el) {
                        if (fading.indexOf(el) === -1) fading.push(el);
                    });
                }
                fading.forEach(function (el) {
                    growAnimations.push(el.animate([{opacity: 0}, {opacity: 1}],
                        {duration: FADE_IN_MS, delay: FADE_IN_DELAY_MS, easing: 'ease-out', fill: 'backwards'}));
                });
            }

            /**
             * The first content is about to replace a loading state in the open panel (data arriving). When the panel
             * becomes taller (a ResizeObserver: after layout, before that frame is drawn, so no frame shows the new
             * height without it), it grows to its new height from the size it is drawn with, by a transform anchored
             * at the trigger's side: on the compositor, so work on the main thread cannot stall it, and continuing the
             * open animation while that still runs (one movement). A further step of the same content while it grows
             * (rows rendered in parts) is followed the same way. Parts of the panel that were not shown before, and
             * the elements in fadeIn (selector, inside the panel), fade in, so their brief squash is not seen. Content
             * in place before anything of the panel was seen (data at hand when it opens, a very fast answer) needs no
             * growth: the open animation shows it at its full size. Returns true when it takes care of the resize,
             * false where it cannot (closed, reduced motion, no Web Animations or ResizeObserver): the caller then
             * resizes its own way.
             */
            function growNext(options) {
                if (!opened || destroyed || !panel || reducedMotion() || typeof panel.animate !== 'function' ||
                    typeof panel.getAnimations !== 'function' || typeof window.ResizeObserver !== 'function') return false;
                let last = panel.offsetHeight;
                if (!last) return false;
                // Nothing seen yet (the open animation's first frames are transparent): the content just joins it.
                if (!(parseFloat(window.getComputedStyle(panel).opacity) > 0.02)) return true;
                const fadeIn = options && options.fadeIn;
                const shownBefore = Array.prototype.filter.call(panel.children, function (child) { return child.offsetHeight > 0; });
                const myToken = token;
                let started = false;
                stopWatchingGrowth();
                growWatch = new window.ResizeObserver(function () {
                    if (destroyed || !opened || myToken !== token) {
                        stopWatchingGrowth();
                        return;
                    }
                    const now = panel.offsetHeight;
                    if (now > last + 2) {
                        startGrowth(last, now, started ? null : shownBefore, started ? null : fadeIn);
                        started = true;
                        // follow a further step of the same content while this growth runs, then stop watching
                        if (growWatchTimer) clearTimeout(growWatchTimer);
                        growWatchTimer = setTimeout(stopWatchingGrowth, GROW_MS);
                    }
                    last = now;
                });
                growWatch.observe(panel);
                // content that never makes the panel taller (an empty answer): stop watching
                growWatchTimer = setTimeout(stopWatchingGrowth, GROW_WATCH_MS);
                return true;
            }

            function destroy() {
                if (destroyed) return;
                destroyed = true;
                opened = false;
                token += 1;
                stopGrowth();
                clearTimers();
                stopTracking();
                if (usePopover) {
                    try { panel.hidePopover(); } catch (e) { /* not shown or detached */ }
                }
            }

            return {
                open: open,
                close: close,
                update: update,
                growNext: growNext,
                destroy: destroy,
                isOpen: function () { return opened; }
            };
        }

        return {create: create};
    }]);
