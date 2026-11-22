// Button suite (page: button.html, fixture: button.fixture.js):
// - its look: the defaults (a button, solid, brand, 34px), the page's font, the family's accent (a container's own
//   accent too), plain colours; the element is its place (a margin, a class, block); no watchers;
// - disabled (bound, bare, ng-disabled on the element): no click reaches the page; the pointer stays on it (its cursor,
//   its tooltip), a click on it does not reach the row behind;
// - loading: the focus and the name kept, no click (ng-click, a form's submit, the row), the spinner over the icon or
//   the text and the width kept;
// - on-click: $event; a promise keeps it loading, no second click until it settles;
// - icons: the family's by name (an icon alone square, named by it), icon classes, icon-position; aria-label / title on
//   the button, not on the element;
// - a page's span rules do not reach its text (Angular's wrapper), a span of the page's own keeps them.
(function () {
    const {sleep, until} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const host = id => document.getElementById(id);
    const btn = id => host(id).querySelector('button');
    const rect = el => el.getBoundingClientRect();
    const near = (a, b, by) => Math.abs(a - b) <= (by === undefined ? 1 : by);
    const log = () => scope().log.slice();
    const clearLog = () => { scope().log.length = 0; };
    const click = el => el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, detail: 1}));
    // a colour as rgb() (a color-mix() result is given as color(srgb r g b))
    const rgb = c => { const m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(c); return m ? 'rgb(' + [m[1], m[2], m[3]].map(v => Math.round(v * 255)).join(', ') + ')' : c; };
    const count = s => { let n = (s.$$watchers || []).length; for (let c = s.$$childHead; c; c = c.$$nextSibling) n += count(c); return n; };

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('B1 the defaults: a <button type="button">, solid, brand, md 34px, in the page\'s font; the element is its place (inline-flex); no watchers for 100 buttons',
        {type: 'button', variant: 'solid', intent: 'brand', size: 'md', height: 34, font: 'Courier New', host: true, watchers: 0},
        async () => {
            const b = btn('b-plain');
            // the 100 buttons' own scopes (each repeated item's, with the button's scopes under it), not the page's
            let watchers = 0;
            Array.prototype.forEach.call(host('many').children, el => { watchers += count(angular.element(el).scope()); });
            return {type: b.getAttribute('type'), variant: b.getAttribute('data-variant'), intent: b.getAttribute('data-intent'),
                // (the family's name without the quotes some browsers write around it)
                size: b.getAttribute('data-size'), height: Math.round(rect(b).height), font: getComputedStyle(b).fontFamily.split(',')[0].replace(/["']/g, ''),
                host: getComputedStyle(host('b-plain')).display !== 'contents', watchers};
        });

    T('B2 disabled: bound, a bare `disabled`, and ng-disabled on the element disable the button; no click reaches ng-click; ng-disabled false enables it',
        {bound: true, bare: true, ngDisabled: true, clicks: [], enabled: true, afterEnable: ['ngdis']},
        async () => {
            clearLog();
            ['b-dis', 'b-bare', 'b-ngdis'].forEach(id => btn(id).click());
            const clicks = log();
            const out = {bound: btn('b-dis').disabled, bare: btn('b-bare').disabled, ngDisabled: btn('b-ngdis').disabled, clicks};
            apply(s => { s.state.off = false; });
            await sleep(30);
            out.enabled = !btn('b-ngdis').disabled;
            clearLog();
            btn('b-ngdis').click();
            out.afterEnable = log();
            apply(s => { s.state.off = true; });
            return out;
        });

    T('B3 a disabled button in a clickable row: the pointer stays on it (its "not allowed" cursor, its tooltip), nothing reaches the row; a loading one stops the click too',
        {under: 'BUTTON', cursor: 'not-allowed', title: true, rowFromBusy: []},
        async () => {
            const b = btn('b-row');
            const r = rect(b);
            const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            clearLog();
            click(btn('b-row-busy'));
            return {under: at.tagName, cursor: getComputedStyle(b).cursor, title: !!btn('b-dis').getAttribute('title'), rowFromBusy: log()};
        });

    T('B4 loading: the focus stays on it, named and busy (aria-disabled, aria-busy, not disabled); no click; the spinner over the text, which keeps its place (the width kept)',
        {focus: true, ariaDisabled: 'true', busy: 'true', disabled: false, clicks: [], width: true, spinnerCentred: true, textHidden: '0', after: {busy: null, focus: true}},
        async () => {
            const b = btn('b-load');
            const w0 = rect(b).width;
            b.focus();
            apply(s => { s.state.loading = true; });
            await sleep(30);
            clearLog();
            b.click();
            const sp = b.querySelector('.aui-button__spinner');
            const spr = sp ? rect(sp) : null, br = rect(b);
            const out = {focus: document.activeElement === b, ariaDisabled: b.getAttribute('aria-disabled'), busy: b.getAttribute('aria-busy'),
                disabled: b.disabled, clicks: log(), width: near(rect(b).width, w0, 0.5),
                spinnerCentred: !!spr && near(spr.left + spr.width / 2, br.left + br.width / 2) && near(spr.top + spr.height / 2, br.top + br.height / 2),
                textHidden: getComputedStyle(b.querySelector('.aui-button__label')).opacity};
            apply(s => { s.state.loading = false; });
            await sleep(30);
            out.after = {busy: b.getAttribute('aria-busy'), focus: document.activeElement === b};
            b.blur();
            return out;
        });

    T('B5 loading with an icon: the spinner over the icon (hidden meanwhile), the text shown, the width kept',
        {inIcon: true, iconHidden: '0', textShown: '1', width: true},
        async () => {
            const b = btn('b-load-icon');
            const w0 = rect(b).width;
            apply(s => { s.state.loading = true; });
            await sleep(250);   // the icon fades out over 0.15 s (cross-fade with the spinner)
            const box = b.querySelector('.aui-button__icon');
            const icon = box.querySelector('svg.aui-button__svg');
            // its end state: a page that draws no frames for a while (a busy machine, a page not in front) has not moved
            // the fade on yet, whatever the time
            icon.getAnimations().forEach(a => a.finish());
            const out = {inIcon: !!box && !!box.querySelector('.aui-button__spinner'), iconHidden: getComputedStyle(icon).opacity,
                textShown: getComputedStyle(b.querySelector('.aui-button__label')).opacity, width: near(rect(b).width, w0, 0.5)};
            apply(s => { s.state.loading = false; });
            return out;
        });

    T('B6 type="submit" in a form: submits; while loading, its click submits nothing',
        {loadingSubmit: [], submit: ['submitted']},
        async () => {
            apply(s => { s.state.submitting = true; });
            await sleep(30);
            clearLog();
            btn('b-submit').click();
            const loadingSubmit = log();
            apply(s => { s.state.submitting = false; });
            await sleep(30);
            clearLog();
            btn('b-submit').click();
            return {loadingSubmit, submit: log()};
        });

    T('B7 on-click: called with $event; its promise keeps the button loading (focus kept), a second click calls nothing (ng-click on the element neither) until it settles',
        {first: {saves: 1, event: 'click', busy: 'true', ng: ['wait-ng']}, second: {saves: 1, ng: ['wait-ng']}, settled: {busy: null, saved: true}},
        async () => {
            clearLog();
            const b = btn('b-wait');
            b.click();
            const first = {saves: scope().saves, event: scope().lastEvent, busy: b.getAttribute('aria-busy'), ng: log()};
            b.click();
            const second = {saves: scope().saves, ng: log()};
            await sleep(450);
            return {first, second, settled: {busy: b.getAttribute('aria-busy'), saved: log().indexOf('saved') >= 0}};
        });

    T('B8 icons: a family icon by name (an icon alone written over lines: square, named and its tooltip by the icon); aria-label wins (no tooltip of the icon); icon classes after the text with icon-position="right"',
        {alone: {svg: true, square: true, name: 'Add', title: 'Add'}, named: {name: 'Delete the row', title: null}, fa: {font: 'fa fa-plus', after: true}},
        async () => {
            const a = btn('b-icon'), n = btn('b-icon-named'), f = btn('b-fa');
            const ar = rect(a);
            const icon = f.querySelector('.aui-button__icon'), text = f.querySelector('.aui-button__label');
            return {alone: {svg: !!a.querySelector('svg.aui-button__svg'), square: near(ar.width, ar.height) && near(ar.height, 34), name: a.getAttribute('aria-label'), title: a.getAttribute('title')},
                named: {name: n.getAttribute('aria-label'), title: n.getAttribute('title')},
                fa: {font: icon.firstElementChild.className, after: rect(icon).left >= rect(text).right}};
        });

    T('B9 aria-label and title: on the button, not on the element (it has no role)',
        {button: ['Close the dialog', 'Close'], element: [false, false]},
        async () => ({button: [btn('b-label').getAttribute('aria-label'), btn('b-label').getAttribute('title')],
            element: [host('b-label').hasAttribute('aria-label'), host('b-label').hasAttribute('title')]}));

    T('B10 the element is its place: a margin and a class on it work; block: as wide as its place; narrower than its text: cut with an ellipsis',
        {margin: 40, cls: true, block: 300, narrow: {width: 90, cut: true}},
        async () => {
            const lab = btn('b-narrow').querySelector('.aui-button__label');
            // the row's own gap (12px) and the element's margin
            return {margin: Math.round(rect(btn('b-margin')).left - rect(host('before-gap')).right) - 12, cls: host('b-margin').classList.contains('page-class'),
                block: Math.round(rect(btn('b-block')).width), narrow: {width: Math.round(rect(btn('b-narrow')).width), cut: lab.scrollWidth > lab.clientWidth}};
        });

    T('B11 a page\'s span rules (padding, size, weight, colour, line height) do not reach its text (Angular\'s wrapper span); a span of the page\'s own (a class) keeps them',
        {width: true, wrapper: {padding: '0px', size: '14px', weight: '500', color: 'rgb(255, 255, 255)'}, own: '10px'},
        async () => {
            const w = btn('b-hostile').querySelector('.aui-button__label > span');
            const c = getComputedStyle(w);
            return {width: near(rect(btn('b-hostile')).width, rect(btn('b-clean')).width),
                wrapper: {padding: c.paddingLeft, size: c.fontSize, weight: c.fontWeight, color: c.color},
                own: getComputedStyle(host('b-hostile-own').querySelector('.badge-of-page')).paddingLeft};
        });

    T('B12 colours: a solid brand button is the family\'s accent itself (#0d6efd, white text 4.50:1), the same blue as the checkboxes; soft text its text shade; a container\'s own accent the same way; danger the fields\' error red',
        {brand: 'rgb(13, 110, 253)', softText: 'rgb(10, 88, 202)', green: {fromItsAccent: true, notBlue: true}, danger: 'rgb(220, 53, 69)'},
        async () => {
            // the green container's own shade, drawn by a sample with the button's class next to it
            const sample = document.createElement('span');
            sample.className = 'aui-button';
            sample.style.cssText = 'background: var(--aui-control-accent-color); position: absolute; visibility: hidden;';
            host('b-green').parentNode.appendChild(sample);
            const shade = rgb(getComputedStyle(sample).backgroundColor);
            sample.remove();
            const green = rgb(getComputedStyle(btn('b-green')).backgroundColor);
            return {brand: rgb(getComputedStyle(btn('b-brand')).backgroundColor), softText: rgb(getComputedStyle(btn('b-soft')).color),
                green: {fromItsAccent: green === shade, notBlue: green !== 'rgb(13, 110, 253)'},
                danger: getComputedStyle(btn('b-danger')).backgroundColor};
        });

    T('E1 no Angular errors', {errors: 0}, async () => ({errors: window.__ngErrors.length}));

    // loading-text: what is shown (the visible text of the button, the spinner's place) and the width
    const shown = id => {
        const b = btn(id);
        const visible = el => el && el.getClientRects().length > 0 && getComputedStyle(el).opacity !== '0';
        const labels = Array.from(b.querySelectorAll('.aui-button__label')).filter(visible).map(el => el.textContent.trim());
        const spin = b.querySelector('.aui-button__spinner');
        // the spinner displayed (it fades in from 0 over 0.15 s: its opacity at this moment says nothing)
        return {text: labels.join('|'), spinner: !!spin && spin.getClientRects().length > 0 && getComputedStyle(spin).visibility !== 'hidden', spinnerFirst: !!spin && (spin.compareDocumentPosition(b.querySelector('.aui-button__label--loading') || b) & Node.DOCUMENT_POSITION_FOLLOWING) > 0};
    };

    T('B13 loading-text: while loading, the spinner and the text in place of the label (before it), named busy; the width never smaller (a longer text widens it); after: the label back, the width its own again',
        {idle: {text: 'Save'}, busy: {text: 'Saving...', spinner: true, spinnerFirst: true, ariaBusy: 'true', notNarrower: true},
         long: {text: 'Saving the record, please wait', wider: true}, done: {text: 'Save', minWidth: '', width: true}},
        async () => {
            const w0 = rect(btn('b-lt')).width, l0 = rect(btn('b-lt-long')).width;
            const idle = {text: shown('b-lt').text};
            apply(s => { s.state.lt = true; });
            const s1 = shown('b-lt');
            const busy = {text: s1.text, spinner: s1.spinner, spinnerFirst: s1.spinnerFirst, ariaBusy: btn('b-lt').getAttribute('aria-busy'),
                notNarrower: rect(btn('b-lt')).width >= w0 - 0.5};
            const long = {text: shown('b-lt-long').text, wider: rect(btn('b-lt-long')).width > l0 + 20};
            apply(s => { s.state.lt = false; });
            return {idle, busy, long, done: {text: shown('b-lt').text, minWidth: btn('b-lt').style.minWidth, width: near(rect(btn('b-lt')).width, w0)}};
        });

    T('B14 loading-text with an icon: the spinner at the icon (the icon hidden), the text in place of the label; an icon alone keeps its square and shows no text',
        {icon: {text: 'Refreshing...', spinnerInIcon: true}, alone: {text: '', square: true}},
        async () => {
            const square0 = rect(btn('b-lt-only'));
            apply(s => { s.state.lt = true; });
            const spin = btn('b-lt-icon').querySelector('.aui-button__spinner');
            const out = {icon: {text: shown('b-lt-icon').text, spinnerInIcon: !!spin && spin.parentNode.classList.contains('aui-button__icon') && !spin.parentNode.classList.contains('aui-button__icon--spinner')},
                alone: {text: shown('b-lt-only').text, square: near(rect(btn('b-lt-only')).width, square0.width) && near(rect(btn('b-lt-only')).height, square0.height)}};
            apply(s => { s.state.lt = false; });
            return out;
        });

    T('B15 loading-text with on-click\'s promise: shown while it runs (no page flag), the label back once it settles',
        {running: 'Saving...', settled: 'Save'},
        async () => {
            btn('b-lt-wait').click();
            const running = shown('b-lt-wait').text;
            await sleep(450);
            return {running, settled: shown('b-lt-wait').text};
        });

    const turn = id => { const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(btn(id).querySelector('.aui-button__svg')).transform);
        return m ? Math.round(Math.atan2(+m[1].split(',')[1], +m[1].split(',')[0]) * 180 / Math.PI) : 0; };

    T('B16 expanded: the family chevron pointing right while closed, aria-expanded false, named Expand; a click flips the page\'s value itself (what it opens shows), the chevron turns down, named Collapse; aria-controls; again: closed',
        {closed: {expanded: 'false', name: 'Expand', turn: -90, controls: 'variants-a'}, open: {model: true, expanded: 'true', name: 'Collapse', turn: 0, list: true},
         again: {model: false, expanded: 'false', list: false}},
        async () => {
            const b = btn('b-x');
            const closed = {expanded: b.getAttribute('aria-expanded'), name: b.getAttribute('aria-label'), turn: turn('b-x'), controls: b.getAttribute('aria-controls')};
            b.click();
            await sleep(300);
            const open = {model: scope().rows.a, expanded: b.getAttribute('aria-expanded'), name: b.getAttribute('aria-label'), turn: turn('b-x'),
                list: !!document.getElementById('variants-a')};
            b.click();
            await sleep(300);
            return {closed, open, again: {model: scope().rows.a, expanded: b.getAttribute('aria-expanded'), list: !!document.getElementById('variants-a')}};
        });

    T('B17 expanded with on-click returning a promise (variants from the server): the spinner in the chevron\'s place and still closed while it runs, no second call; open once it resolves; closing asks on-click with $expanded false and closes at once; a failure keeps it closed',
        {running: {model: false, busy: 'true', spinner: true, calls: [true]}, done: {model: true, busy: null}, closed: {model: false, calls: [true, false]},
         failed: {model: false, busy: null}},
        async () => {
            const b = btn('b-x-load');
            b.click();
            b.click();
            const running = {model: scope().rows.b, busy: b.getAttribute('aria-busy'), spinner: !!b.querySelector('.aui-button__icon .aui-button__spinner'),
                calls: scope().variantCalls.slice()};
            await sleep(300);
            const done = {model: scope().rows.b, busy: b.getAttribute('aria-busy')};
            b.click();
            await sleep(50);
            const closed = {model: scope().rows.b, calls: scope().variantCalls.slice()};
            apply(s => { s.variantFails = true; });
            b.click();
            await sleep(300);
            apply(s => { s.variantFails = false; });
            return {running, done, closed, failed: {model: scope().rows.b, busy: b.getAttribute('aria-busy')}};
        });

    T('B18 the page sets the value itself (expand all): the button follows; with text the chevron comes before it and the text names the button',
        {followed: {expanded: 'true', turn: 0}, text: {first: true, label: null, expanded: 'true'}},
        async () => {
            apply(s => { s.rows.c = true; });
            await sleep(300);
            const b = btn('b-x-text');
            const icon = b.querySelector('.aui-button__icon');
            const out = {followed: {expanded: b.getAttribute('aria-expanded'), turn: turn('b-x-text')},
                text: {first: !!icon && icon.nextElementSibling === b.querySelector('.aui-button__label'), label: b.getAttribute('aria-label'), expanded: b.getAttribute('aria-expanded')}};
            apply(s => { s.rows.c = false; });
            return out;
        });

    T('B20 the chevron turns (a running transform transition after a click: the icon is not inserted again, which would cancel it); its box narrower than the drawing, the gap to the text as other icons\'',
        {turning: true, narrow: true},
        async () => {
            const b = btn('b-x');
            b.click();
            const svg = b.querySelector('.aui-button__svg');
            getComputedStyle(svg).transform;   // the browser starts the transition here
            const turning = svg.getAnimations().some(a => a.transitionProperty === 'transform' && a.playState === 'running');
            const narrow = b.querySelector('.aui-button__icon').getBoundingClientRect().width < svg.getBoundingClientRect().width;
            await sleep(300);
            b.click();
            await sleep(300);
            return {turning, narrow};
        });

    T('B21 expand-icon looks: chevron (before the text, -90 -> 0), show-more and show-more-double (after the text, 0 -> 180), caret (filled, -90 -> 0), plus (no turn, its vertical bar fades out); an unknown look is the chevron',
        {chevron: {after: false, closed: -90, open: 0}, more: {after: true, closed: 0, open: 180}, double: {after: true, closed: 0, open: 180},
         caret: {after: false, closed: -90, open: 0, filled: true}, plus: {after: false, closed: 0, open: 0, bar: ['1', '0']},
         odd: {after: false, closed: -90, open: 0}},
        async () => {
            const out = {};
            for (const [key, id] of [['chevron', 'b-l-chevron'], ['more', 'b-l-more'], ['double', 'b-l-double'], ['caret', 'b-l-caret'],
                ['plus', 'b-l-plus'], ['odd', 'b-l-odd']]) {
                const b = btn(id);
                const icon = b.querySelector('.aui-button__icon');
                const after = !!(b.querySelector('.aui-button__label').compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING);
                const bar = () => { const p = b.querySelector('.aui-icon-plus-bar'); return p ? getComputedStyle(p).opacity : null; };
                const closed = turn(id), barClosed = bar();
                b.click();
                await sleep(300);
                const r = {after, closed: Math.abs(closed) === 180 ? 180 : closed, open: Math.abs(turn(id)) === 180 ? 180 : turn(id)};
                if (key === 'caret') { const f = b.querySelector('.aui-icon-fill'); r.filled = !!f && getComputedStyle(f).fill !== 'none'; }
                if (key === 'plus') r.bar = [barClosed, bar()];
                b.click();
                await sleep(250);
                out[key] = r;
            }
            return out;
        });

    T('B22 nothing moves: no transform pressed (every variant) nor hovered (elevated: a shadow, no lift); the press shows in its colour',
        {pressed: 'none', elevatedHover: 'none', transition: false},
        async () => {
            const b = btn('b-plain');
            const rule = (sel, prop) => {
                for (const sheet of document.styleSheets) {
                    let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
                    for (const r of rules) if (r.selectorText && r.selectorText.indexOf(sel) >= 0 && r.style.getPropertyValue(prop)) return r.style.getPropertyValue(prop);
                }
                return 'none';
            };
            return {pressed: rule('.aui-button:active', 'transform'), elevatedHover: rule('[data-variant="elevated"]:hover', 'transform'),
                transition: /transform/.test(getComputedStyle(b).transitionProperty) && getComputedStyle(b).transitionDuration !== '0s'};
        });

    T('B19 expanded on an expression the page cannot be written to: a click only calls on-click ($expanded), the state follows the expression; no error',
        {calls: ['ro true'], expanded: 'false', errors: 0},
        async () => {
            clearLog();
            const errors = (window.__ngErrors || []).length;
            btn('b-x-ro').click();
            await sleep(50);
            return {calls: log().filter(x => x.indexOf('ro') === 0), expanded: btn('b-x-ro').getAttribute('aria-expanded'), errors: (window.__ngErrors || []).length - errors};
        });

    // ------------------------------------------------------------------ copy-text, done-text, show-more-double

    const pathsOf = svg => Array.prototype.map.call(svg.querySelectorAll('path'), p => p.getAttribute('d')).join(' ');
    const drawing = name => pathsOf(angular.element(document.body).injector().get('auiIcons').draw(name, 'x'));
    const iconOf = id => { const svg = btn(id).querySelector('.aui-button__icon svg'); return svg ? pathsOf(svg) : null; };
    const shownText = id => { const l = btn(id).querySelector('.aui-button__label--loading'); return l && l.parentNode ? l.textContent : null; };
    const statusOf = id => { const s = host(id).querySelector('.aui-button__status'); return s ? s.textContent : null; };
    /**
     * The clipboard as the page sees it, for one check: mode 'api' (writeText takes the text), 'missing' (no writeText:
     * the older way), 'refused' (writeText refuses and the older way fails too). What reached either way is recorded.
     */
    async function withClipboard(mode, fn) {
        const written = [];
        const clip = navigator.clipboard;
        const exec = document.execCommand;
        if (clip) {
            if (mode === 'api') clip.writeText = text => { written.push(['api', text]); return Promise.resolve(); };
            else if (mode === 'missing') clip.writeText = undefined;
            else clip.writeText = () => Promise.reject(new Error('refused'));
        }
        document.execCommand = function (command) {
            const el = document.activeElement;
            written.push(['older way', command, el && el.tagName === 'TEXTAREA' ? el.value : null]);
            return mode !== 'refused';
        };
        try {
            return await fn(written);
        } finally {
            if (clip) delete clip.writeText;
            document.execCommand = exec;
        }
    }

    T('B23 copy-text, an icon alone: a click copies the page\'s text (Clipboard API); for done-duration a ring with a check that draws itself in (the ring, then the check), in the success green, named "Copied" (aria-label, tooltip, read out through an aria-live status), on-copy with $success and $text; then the copy icon and its name again',
        {written: [['api', 'Order 1042']], during: {icon: 'circle-check', label: 'Copied', title: 'Copied', status: 'Copied', feedback: 'done', colour: 'rgb(25, 135, 84)',
             draws: ['aui-button-draw 1', 'aui-button-draw 1'], scale: 'matrix(1.06, 0, 0, 1.06, 0, 0)', sameWidth: true},
         copies: [[true, 'Order 1042']], after: {icon: 'copy', label: 'Copy', title: 'Copy', status: '', feedback: null}},
        async () => withClipboard('api', async written => {
            scope().copies.length = 0;
            const b = btn('b-copy');
            const width = b.getBoundingClientRect().width;
            const look = () => ({icon: iconOf('b-copy') === drawing('circle-check') ? 'circle-check' : iconOf('b-copy') === drawing('copy') ? 'copy' : iconOf('b-copy'),
                label: b.getAttribute('aria-label'), title: b.getAttribute('title'), status: statusOf('b-copy'), feedback: b.getAttribute('data-feedback')});
            click(b);
            await sleep(150);
            const svg = b.querySelector('.aui-button__icon svg');
            const draws = Array.prototype.map.call(svg.querySelectorAll('path'), p => p.getAnimations().map(a => a.animationName + ' ' + p.getAttribute('pathLength')).join(','));
            const during = Object.assign(look(), {colour: getComputedStyle(b.querySelector('.aui-button__icon')).color, draws: draws,
                scale: getComputedStyle(svg).transform, sameWidth: near(b.getBoundingClientRect().width, width, 0.5)});
            await sleep(650);
            return {written: written.slice(), during, copies: scope().copies.slice(), after: look()};
        }));

    T('B24 copy-text on text buttons: the text becomes "Copied" in place, the width kept (the room held from the start); without an icon none comes in; on a solid button the check keeps the white text colour',
        {text: {shown: 'Copied', icon: 'circle-check', sameWidth: true}, plain: {shown: 'Copied', icons: 0, sameWidth: true}, solid: {icon: 'circle-check', white: true},
         back: [null, null, null]},
        async () => withClipboard('api', async () => {
            const w = id => btn(id).getBoundingClientRect().width;
            const before = {text: w('b-copy-text'), plain: w('b-copy-plain')};
            click(btn('b-copy-text'));
            click(btn('b-copy-plain'));
            click(btn('b-copy-solid'));
            await sleep(150);
            const out = {
                text: {shown: shownText('b-copy-text'), icon: iconOf('b-copy-text') === drawing('circle-check') ? 'circle-check' : iconOf('b-copy-text'),
                    sameWidth: near(w('b-copy-text'), before.text, 0.5)},
                plain: {shown: shownText('b-copy-plain'), icons: btn('b-copy-plain').querySelectorAll('.aui-button__icon').length,
                    sameWidth: near(w('b-copy-plain'), before.plain, 0.5)},
                solid: {icon: iconOf('b-copy-solid') === drawing('circle-check') ? 'circle-check' : iconOf('b-copy-solid'),
                    white: getComputedStyle(btn('b-copy-solid').querySelector('.aui-button__icon')).color === 'rgb(255, 255, 255)'}
            };
            await sleep(650);
            out.back = [shownText('b-copy-text'), shownText('b-copy-plain'), btn('b-copy-solid').getAttribute('data-feedback')];
            return out;
        }));

    T('B25 the older way where the Clipboard API is missing (a hidden text box, the focus put back on the button); where both ways fail: a cross in the error red, "Copy failed", on-copy $success false',
        {older: {written: [['older way', 'copy', 'Order 1042']], icon: 'circle-check', focusBack: true, boxGone: true},
         failed: {icon: 'circle-close', label: 'Copy failed', status: 'Copy failed', colour: 'rgb(220, 53, 69)', copies: [[false, 'Order 1042']]}},
        async () => {
            const b = btn('b-copy');
            const older = await withClipboard('missing', async written => {
                b.focus();
                click(b);
                await sleep(150);
                const r = {written: written.slice(), icon: iconOf('b-copy') === drawing('circle-check') ? 'circle-check' : iconOf('b-copy'),
                    focusBack: document.activeElement === b, boxGone: !host('b-copy').querySelector('textarea')};
                await sleep(650);
                return r;
            });
            scope().copies.length = 0;
            const failed = await withClipboard('refused', async () => {
                click(b);
                await sleep(150);
                const r = {icon: iconOf('b-copy') === drawing('circle-close') ? 'circle-close' : iconOf('b-copy'), label: b.getAttribute('aria-label'),
                    status: statusOf('b-copy'), colour: getComputedStyle(b.querySelector('.aui-button__icon')).color, copies: scope().copies.slice()};
                await sleep(650);
                return r;
            });
            b.blur();
            return {older, failed};
        });

    T('B26 copy-feedback="none": it copies and on-copy reports, its look and name stay (a fixed copy icon); a button without copy-text or done-text never changes after a click',
        {written: [['api', 'quiet']], copies: [[true, 'quiet']], quiet: {icon: 'copy', label: 'Copy', feedback: null, status: null},
         plainWait: {feedback: null}},
        async () => withClipboard('api', async written => {
            scope().copies.length = 0;
            click(btn('b-copy-quiet'));
            await sleep(150);
            const quiet = {icon: iconOf('b-copy-quiet') === drawing('copy') ? 'copy' : iconOf('b-copy-quiet'),
                label: btn('b-copy-quiet').getAttribute('aria-label'), feedback: btn('b-copy-quiet').getAttribute('data-feedback'),
                status: statusOf('b-copy-quiet')};
            click(btn('b-wait'));
            await sleep(450);
            return {written: written.slice(), copies: scope().copies.slice(), quiet, plainWait: {feedback: btn('b-wait').getAttribute('data-feedback')}};
        }));

    T('B27 done-text: while on-click\'s promise runs, loading; once it resolves a check and "Saved" in place of the icon and text, the width kept; then the button as it was',
        {loading: true, done: {icon: 'circle-check', shown: 'Saved', status: 'Saved', sameWidth: true}, after: {icon: 'upload', shown: null, feedback: null}},
        async () => {
            const b = btn('b-done');
            const width = b.getBoundingClientRect().width;
            click(b);
            await sleep(100);
            const loading = b.getAttribute('aria-busy') === 'true';
            // each state waited for, not timed: a busy machine delays the promise (300 ms) and the status text (60 ms
            // after the check), so fixed waits read them too early
            await until(() => statusOf('b-done') === 'Saved', 2000);
            const done = {icon: iconOf('b-done') === drawing('circle-check') ? 'circle-check' : iconOf('b-done'), shown: shownText('b-done'), status: statusOf('b-done'),
                sameWidth: near(b.getBoundingClientRect().width, width, 0.5)};
            await until(() => !b.getAttribute('data-feedback'), 2000);
            return {loading, done, after: {icon: iconOf('b-done') === drawing('upload') ? 'upload' : iconOf('b-done'), shown: shownText('b-done'),
                feedback: b.getAttribute('data-feedback')}};
        });

    T('B28 show-more and show-more-double: the chevrons after the text at the gap of an icon before its text (8.5 to 10.5 px at 14px), the double one two chevrons as wide as the one',
        {more: true, double: true, sameWidth: true, twoChevrons: true},
        async () => {
            // the gap from the text to the drawn line, from the path's geometry (getBBox: the same in every browser,
            // where a path's screen box differs) less half the line's width (1 of the icon's 24 units)
            const inkGap = id => {
                const b = btn(id);
                const range = document.createRange();
                range.selectNodeContents(b.querySelector('.aui-button__label'));
                const svg = b.querySelector('.aui-button__icon svg');
                const box = svg.getBoundingClientRect();
                const unit = box.width / 24;
                return box.left + (svg.querySelector('path').getBBox().x - 1) * unit - range.getBoundingClientRect().right;
            };
            const inRange = g => g >= 8.5 && g <= 10.5;
            const width = id => btn(id).querySelector('.aui-button__icon svg path').getBoundingClientRect().width;
            return {more: inRange(inkGap('b-l-more')), double: inRange(inkGap('b-l-double')),
                sameWidth: near(width('b-l-more'), width('b-l-double'), 0.5), twoChevrons: (iconOf('b-l-double') || '').split('M').length - 1 === 2};
        });

    // ------------------------------------------------------------------ settled promises, feedback, names, forwarding

    T('B29 on-click returning a promise of the browser\'s own (not $q): once it resolves, what it opens shows at once, with no other digest of the page',
        {open: true, shown: true, expanded: 'true'},
        async () => {
            click(btn('b-native'));
            await until(() => btn('b-native').getAttribute('aria-busy') !== 'true', 2000);
            const out = {open: !!scope().state.nativeOpen, shown: getComputedStyle(document.getElementById('native-panel')).display !== 'none',
                expanded: btn('b-native').getAttribute('aria-expanded')};
            apply(s => { s.state.nativeOpen = false; });
            return out;
        });

    T('B30 done-text: a second save during the first one\'s "Saved" that fails shows no "Saved" (nor its status): the button as it was',
        {first: 'Saved', afterFailure: {shown: null, feedback: null, status: '', icon: 'upload'}},
        async () => {
            apply(s => { s.saveFails = false; });
            click(btn('b-retry'));
            await until(() => shownText('b-retry') === 'Saved', 2000);
            const first = shownText('b-retry');
            apply(s => { s.saveFails = true; });
            click(btn('b-retry'));
            await until(() => btn('b-retry').getAttribute('aria-busy') === 'true', 1000);
            await until(() => btn('b-retry').getAttribute('aria-busy') !== 'true', 2000);
            await sleep(100);
            const b = btn('b-retry');
            const afterFailure = {shown: shownText('b-retry'), feedback: b.getAttribute('data-feedback'), status: statusOf('b-retry'),
                icon: iconOf('b-retry') === drawing('upload') ? 'upload' : iconOf('b-retry')};
            apply(s => { s.saveFails = false; });
            return {first, afterFailure};
        });

    T('B31 copy-text, two clicks whose copies end in the other order (the first one refused, last): the latest copy\'s outcome shows; on-copy reports both',
        {shown: 'Copied', feedback: 'done', races: [[true, 'B'], [false, 'A']]},
        async () => {
            const clip = navigator.clipboard;
            const exec = document.execCommand;
            const pending = [];
            clip.writeText = text => new Promise((resolve, reject) => pending.push({text, resolve, reject}));
            document.execCommand = () => false;   // the older way fails too
            try {
                scope().races.length = 0;
                apply(s => { s.raceText = 'A'; });
                click(btn('b-race'));
                apply(s => { s.raceText = 'B'; });
                click(btn('b-race'));
                pending[1].resolve();
                await sleep(50);
                pending[0].reject(new Error('refused'));
                await sleep(100);
                return {shown: shownText('b-race'), feedback: btn('b-race').getAttribute('data-feedback'), races: scope().races.slice()};
            } finally {
                delete clip.writeText;
                document.execCommand = exec;
            }
        });

    T('B32 an icon with a {{ }} label: empty, an icon alone (square, named by its icon); with text, a text button; empty again, an icon alone again',
        {empty: {iconOnly: true, name: 'Settings'}, text: {iconOnly: false, name: null}, again: {iconOnly: true, name: 'Settings'}},
        async () => {
            const look = () => ({iconOnly: btn('b-dyn').classList.contains('aui-button--icon-only'), name: btn('b-dyn').getAttribute('aria-label')});
            const empty = look();
            apply(s => { s.dynLabel = 'Settings of this page'; });
            await sleep(30);
            const text = look();
            apply(s => { s.dynLabel = ''; });
            await sleep(30);
            return {empty, text, again: look()};
        });

    T('B33 an icon alone with a title: the title names it (no aria-label of the icon\'s name over it) and is its tooltip',
        {ariaLabel: null, title: 'Remove this item'},
        async () => ({ariaLabel: btn('b-titled').getAttribute('aria-label'), title: btn('b-titled').getAttribute('title')}));

    T('B34 shape="square" on a link: a link has no box, so it keeps its own size (no 34px-wide rectangle)',
        {notStretched: true, square: true},
        async () => {
            const r = rect(btn('b-sqlink'));
            return {notStretched: r.width < 30, square: near(r.width, r.height, 1)};
        });

    T('B35 copy-text on a text button: "Copy failed" fits the room it holds from the start (the button does not grow)',
        {failed: 'Copy failed', sameWidth: true},
        async () => withClipboard('refused', async () => {
            const w0 = rect(btn('b-copy-width')).width;
            click(btn('b-copy-width'));
            await until(() => btn('b-copy-width').getAttribute('data-feedback') === 'failed', 1000);
            return {failed: shownText('b-copy-width'), sameWidth: near(rect(btn('b-copy-width')).width, w0, 0.5)};
        }));

    T('B36 done-duration below 300 ms is held at 300 ms (not the 2000 ms default)',
        {shown: 'Done', held: true},
        async () => {
            click(btn('b-dur'));
            await until(() => shownText('b-dur') === 'Done', 1000);
            const shown = shownText('b-dur');
            const from = performance.now();
            await until(() => shownText('b-dur') === null, 3000);
            const lasted = performance.now() - from;
            return {shown, held: lasted >= 200 && lasted < 1500};
        });

    T('B37 aria-describedby, aria-haspopup, aria-pressed and tabindex on the element: on the native button (following {{ }}), none left on the element',
        {button: {describedby: 'b-aria-help', haspopup: 'menu', pressed: null, tabindex: '-1'},
            element: {describedby: null, haspopup: null, pressed: null, tabindex: null}, pressedLater: 'true'},
        async () => {
            const read = el => ({describedby: el.getAttribute('aria-describedby'), haspopup: el.getAttribute('aria-haspopup'),
                pressed: el.getAttribute('aria-pressed'), tabindex: el.getAttribute('tabindex')});
            const out = {button: read(btn('b-aria')), element: read(host('b-aria'))};
            apply(s => { s.state.pressed = true; });
            await sleep(30);
            out.pressedLater = btn('b-aria').getAttribute('aria-pressed');
            apply(s => { s.state.pressed = undefined; });
            return out;
        });

    T('B38 the warning text reads at 4.5:1 on its hover tint too (#a34a08); the focus ring is the accent at 2px around a 2px gap, for every variant',
        {warning: 'rgb(163, 74, 8)', ring: true},
        async () => ({warning: getComputedStyle(btn('b-warn')).color,
            ring: /rgb\(13, 110, 253\)/.test(getComputedStyle(btn('b-plain')).getPropertyValue('--aui-button-focus-ring'))}));

    AuiTest.run('aui-* family: aui-button', tests);
})();
