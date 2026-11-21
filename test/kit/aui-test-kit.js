/**
 * aui test kit: helpers and the runner for the in-browser component suites.
 *
 * A suite page loads the runtime (lib/), the component code (src/), its fixture (the Angular module with the
 * component instances under test), this kit, and its spec. The spec lists checks and hands them to AuiTest.run:
 *
 *     AuiTest.run('aui-tree-select: core', [
 *         {name: 'S1 initial value shows its label', expect: {display: 'iOS'}, fn: async () => ({display: ...})},
 *         ['S2 ...', {model: 12}, async () => ({model: ...})]          // the same check as an array
 *     ]);
 *
 * A check passes when JSON.stringify(observed) equals JSON.stringify(expect). Checks run one after another; the
 * report is shown on the page and published as window.__result, which scripts/test.js collects.
 * A check of an animation's timing is marked {timing: true}: it runs again (3 runs in all) when it fails, as its
 * frames are sampled on the main thread, which a busy machine delays; the report names every one that ran again.
 * AuiTest.until(condition, ms) waits for a state (rows arrived, a request gone out) rather than for a fixed time.
 * Angular errors are expected in window.__ngErrors (the fixtures decorate $exceptionHandler to fill it).
 *
 * Opened by hand, a suite starts once its window is in front (visible and focused; else a notice asks for a click),
 * blocks real mouse and keyboard input while it runs, pauses while the window is in the background, and marks the
 * checks that ran while it was not in front. ?run=now skips the waiting (a browser driven without focus emulation).
 */
(function () {
    'use strict';

    const sleep = function (ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    };

    /** Resolves after n animation frames (layout and the panel animation have had a chance to run). */
    const frames = function (n) {
        return new Promise(function (resolve) {
            let left = n;
            (function next() {
                if (left-- <= 0) resolve();
                else requestAnimationFrame(next);
            })();
        });
    };

    /** Dispatches a keydown on el and returns the event (to check defaultPrevented). */
    const key = function (el, name, extra) {
        const event = new KeyboardEvent('keydown', Object.assign({key: name, bubbles: true, cancelable: true}, extra || {}));
        el.dispatchEvent(event);
        return event;
    };

    /** Types into an input the way ngModel notices it. */
    const type = function (input, text) {
        input.value = text;
        input.dispatchEvent(new Event('input', {bubbles: true}));
    };

    /** A press on the page outside every component: pointerdown, then mousedown, as a real click sends them. */
    const outside = function () {
        if (typeof PointerEvent === 'function') document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
        document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    };

    const angularErrors = function () {
        return window.__ngErrors || [];
    };

    /**
     * The look a field box shows (a select's trigger, aui-input's form box): the box with the skin of its focused look
     * over it (::after, focused or open), the skin's fade read at its end. border: the skin's colour when it shows,
     * else the box's; shadow: the shadow lists of the box and of the skin shown; ring: the skin shows; halo: the alpha
     * of the red 3px halo they draw together (0 without one).
     */
    const fieldLook = function (box) {
        box.getAnimations({subtree: true}).forEach(function (animation) {
            try { animation.finish(); } catch (e) { /* endless (a spinner) or gone */ }
        });
        const own = getComputedStyle(box);
        const st = getComputedStyle(box, '::after');
        const focused = st.content !== 'none' && st.display !== 'none' && st.visibility === 'visible' && parseFloat(st.opacity) > 0.99 ? st : null;
        const top = focused;
        const shadows = [own, focused].filter(Boolean).map(function (style) { return style.boxShadow; })
            .filter(function (value) { return value && value !== 'none'; });
        let clear = 1;
        // the red 3px halos, as rgba(220, 53, 69, a) or, drawn by color-mix(), color(srgb 0.86 0.21 0.27 / a)
        shadows.forEach(function (list) {
            const re = /(?:rgba\(220, 53, 69, ([0-9.]+)\)|color\(srgb 0\.86\d* 0\.20\d* 0\.27\d* \/ ([0-9.]+)\)) 0px 0px 0px 3px/g;
            let halo;
            while ((halo = re.exec(list))) clear *= 1 - parseFloat(halo[1] || halo[2]);
        });
        return {border: top ? top.borderTopColor : own.borderTopColor, shadow: shadows.join(', ') || 'none',
            ring: !!focused, halo: Math.round((1 - clear) * 100) / 100};
    };

    function normalize(checks) {
        return checks.map(function (check) {
            return Array.isArray(check) ? {name: check[0], expect: check[1], fn: check[2]} : check;
        });
    }

    /**
     * Resolves true once condition() is truthy, or false after timeoutMs (polled every 10 ms): to wait for what a
     * check needs (rows arrived, a request gone out) instead of a fixed sleep, which a busy machine outruns.
     */
    const until = function (condition, timeoutMs) {
        const limit = Date.now() + (timeoutMs === undefined ? 2000 : timeoutMs);
        return new Promise(function (resolve) {
            (function poll() {
                let ok = false;
                try { ok = !!condition(); } catch (e) { ok = false; }
                if (ok) resolve(true);
                else if (Date.now() >= limit) resolve(false);
                else setTimeout(poll, 10);
            })();
        });
    };

    // A check of an animation's timing ({timing: true}) samples frames on the main thread, which a busy machine
    // drops (the animation itself runs on): such a check runs again, up to this many times in all, when it fails.
    // The report names every check that needed more than one run, so that one that keeps failing still fails.
    const TIMING_RUNS = 3;

    function pageLoaded() {
        return document.readyState === 'complete'
            ? Promise.resolve()
            : new Promise(function (resolve) { window.addEventListener('load', resolve, {once: true}); });
    }

    // ------------------------------------------------------------------ run conditions
    // The checks drive the components with scripted events and measure layout and focus after short waits. Opened by
    // hand, three things change what they see: a person using the page meanwhile (a click, a key, the mouse over a
    // panel), a window in the background (timers and animation frames are slowed or paused) and a window without the
    // focus (focus moves are not real). The scripts/test.js browser has none of them. So the kit starts only
    // while the page is visible and focused, blocks real input while the checks run (scripted events are not trusted
    // and pass), waits between checks while the window is hidden or without focus, and marks the checks that were
    // running at such a moment.

    const BLOCKED_INPUT = ['pointerdown', 'pointerup', 'pointermove', 'pointerover', 'pointerout', 'pointerenter',
        'pointerleave', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
        'click', 'dblclick', 'auxclick', 'contextmenu', 'wheel', 'touchstart', 'touchmove', 'touchend', 'keydown',
        'keyup', 'keypress', 'beforeinput', 'input', 'paste', 'cut', 'drop', 'dragstart', 'compositionstart'];

    // ?run=now: no waiting for the window to be in front (a browser driven without focus emulation, where
    // document.hasFocus() stays false although focus works); the checks that run meanwhile are still marked.
    const RUN_NOW = /[?&]run=now(&|$)/.test(location.search);

    function inFront() {
        return document.visibilityState === 'visible' && document.hasFocus();
    }

    function banner(text, kind) {
        const el = document.createElement('div');
        el.className = 'aui-test-banner aui-test-banner--' + kind;
        el.setAttribute('role', 'status');
        el.textContent = text;
        document.body.appendChild(el);
        return el;
    }

    /** Resolves once the page is visible and has the focus (at once when it has); shows `text` meanwhile. */
    function untilInFront(text, kind) {
        if (RUN_NOW || inFront()) return Promise.resolve(false);
        return new Promise(function (resolve) {
            const el = banner(text, kind);
            const check = function () {
                if (!inFront()) return;
                clearInterval(timer);
                window.removeEventListener('focus', check);
                document.removeEventListener('visibilitychange', check);
                el.parentNode.removeChild(el);
                resolve(true);
            };
            const timer = setInterval(check, 200);
            window.addEventListener('focus', check);
            document.addEventListener('visibilitychange', check);
        });
    }

    /**
     * Blocks real (trusted) input to the page until the returned function is called. The start / pause banners stay
     * clickable, and browser keys (F5, Ctrl/Alt combinations) keep working.
     */
    function blockRealInput() {
        const stop = function (event) {
            if (!event.isTrusted) return;
            const target = event.target;
            if (target && typeof target.closest === 'function' && target.closest('.aui-test-banner--start, .aui-test-banner--paused')) return;
            if (event.type.indexOf('key') === 0 && (event.ctrlKey || event.metaKey || event.altKey || /^F\d+$/.test(event.key || ''))) return;
            if (event.cancelable) event.preventDefault();
            event.stopImmediatePropagation();
        };
        BLOCKED_INPUT.forEach(function (type) { window.addEventListener(type, stop, {capture: true, passive: false}); });
        let badge = null;
        const end = function () {
            BLOCKED_INPUT.forEach(function (type) { window.removeEventListener(type, stop, {capture: true, passive: false}); });
            if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
        };
        end.running = function () {
            badge = banner('Running the checks: mouse and keyboard are paused until they finish.', 'running');
        };
        return end;
    }

    /** Notes when the window goes to the background or loses the focus; taken() reports and resets it. */
    function watchFront() {
        let lost = false;
        const note = function () { if (!inFront()) lost = true; };
        window.addEventListener('blur', note);
        document.addEventListener('visibilitychange', note);
        return {
            taken: function () {
                const was = lost || !inFront();
                lost = false;
                return was;
            },
            stop: function () {
                window.removeEventListener('blur', note);
                document.removeEventListener('visibilitychange', note);
            }
        };
    }

    function reportElement() {
        let el = document.getElementById('aui-test-report');
        if (!el) {
            el = document.createElement('section');
            el.id = 'aui-test-report';
            document.body.insertBefore(el, document.body.firstChild);
        }
        return el;
    }

    function render(title, pass, total, errors, lines, extra) {
        const el = reportElement();
        el.className = 'aui-test-report ' + (pass === total && errors.length === 0 ? 'aui-test-report--pass' : 'aui-test-report--fail');
        el.textContent = '';
        const head = document.createElement('header');
        head.className = 'aui-test-report__head';
        head.textContent = title + ': ' + pass + '/' + total + ' passed; angular errors: ' + errors.length + (extra ? '; ' + extra : '');
        const again = document.createElement('button');
        again.type = 'button';
        again.className = 'aui-test-report__again';
        again.textContent = 'Run again';
        again.addEventListener('click', function () { location.reload(); });
        head.appendChild(again);
        el.appendChild(head);
        if (errors.length) {
            const pre = document.createElement('pre');
            pre.className = 'aui-test-report__errors';
            pre.textContent = errors.join('\n');
            el.appendChild(pre);
        }
        const list = document.createElement('ol');
        list.className = 'aui-test-report__list';
        lines.forEach(function (line) {
            const item = document.createElement('li');
            item.className = (line.ok ? 'is-pass' : 'is-fail') + (line.shaky ? ' is-shaky' : '');
            item.textContent = (line.ok ? 'PASS ' : 'FAIL ') + line.name +
                (line.shaky ? '  (ran while the window was not in front: not reliable)' : '');
            if (!line.ok) {
                const detail = document.createElement('pre');
                detail.textContent = 'observed: ' + line.observed + '\nexpected: ' + line.expected;
                item.appendChild(detail);
            }
            list.appendChild(item);
        });
        el.appendChild(list);
    }

    /**
     * Runs the checks. options: {delay: ms after page load before the first check (default 300),
     * summary(): extra text for the report header}.
     */
    async function run(title, checks, options) {
        const opts = options || {};
        const list = normalize(checks);
        await pageLoaded();
        const unblock = blockRealInput();
        await untilInFront('Click here to start the checks. Keep this window in front while they run: they move the ' +
            'focus and measure the panels, which a window in the background or without the focus does differently.', 'start');
        unblock.running();
        await sleep(opts.delay === undefined ? 300 : opts.delay);
        const front = watchFront();
        const lines = [];
        const retried = [];   // timing checks that needed more than one run
        let pass = 0;
        let unreliable = 0;
        try {
            for (const check of list) {
                if (await untilInFront('Paused: this window is in the background or has lost the focus. Click here to ' +
                    'go on.', 'paused')) {
                    await sleep(300);
                }
                front.taken();
                let observed;
                let ok = false;
                let runs = 0;
                const allowed = check.timing ? TIMING_RUNS : 1;
                while (!ok && runs < allowed) {
                    runs += 1;
                    try {
                        observed = await check.fn();
                    } catch (e) {
                        observed = {exception: String(e && (e.stack || e.message) || e)};
                    }
                    ok = JSON.stringify(observed) === JSON.stringify(check.expect);
                }
                if (runs > 1) retried.push(check.name.split(' ')[0] + (ok ? ' passed on run ' + runs : ' failed ' + runs + ' runs'));
                const shaky = front.taken();
                if (ok) pass += 1;
                if (shaky) unreliable += 1;
                lines.push({name: check.name + (runs > 1 ? '  [timing check: run ' + runs + ' of ' + allowed + ']' : ''), ok: ok, shaky: shaky,
                    observed: JSON.stringify(observed), expected: JSON.stringify(check.expect)});
            }
        } finally {
            front.stop();
            unblock();
        }
        const errors = angularErrors().slice();
        const extra = [typeof opts.summary === 'function' ? opts.summary() : '',
            unreliable ? unreliable + ' check(s) ran while the window was not in front (marked): run again' : '',
            retried.length ? 'timing checks run again: ' + retried.join(', ') : '']
            .filter(Boolean).join('; ');
        render(title, pass, list.length, errors, lines, extra);
        window.__result = {
            suite: title,
            pass: pass,
            total: list.length,
            errors: errors,
            summary: extra,
            unreliable: unreliable,
            lines: lines.map(function (line) {
                return (line.ok ? 'PASS ' : 'FAIL ') + line.name + (line.shaky ? ' [ran while the window was not in front]' : '') +
                    (line.ok ? '' : '\n      observed: ' + line.observed + '\n      expected: ' + line.expected);
            })
        };
        document.title = document.title + ' [done]';
        return window.__result;
    }

    window.AuiTest = {sleep: sleep, until: until, frames: frames, key: key, type: type, outside: outside, angularErrors: angularErrors,
        fieldLook: fieldLook, run: run};
})();
