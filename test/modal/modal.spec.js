// Modal suite (page: modal.html, fixture: modal.fixture.js): aui-modal's opening and closing as pages use it:
// - opening: shown at once with is-open; the body built in the open digest, or with defer-render its place first and
//   the body after the first frame; on-rendered once per opening, with the body there (none when it is opened again
//   while it fades out: the body was kept);
// - closing from inside (its Close button, aui-modal-close): the fade at once, is-open false after the first frame,
//   the button's action before that, on-close and the body's end after the fade, two digests of the page in all;
//   opened again while it fades out: it stays, with its body; closed in the turn it opened: shut at once;
// - Escape: closes with close-on-esc, never without it, a held key closes nothing more; its default always prevented;
// - a modal opened over another open one dims the page less (stacked); background-opacity="OPAQUE_LIKE".
(function () {
    const {sleep, until} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const svc = name => angular.element(document.body).injector().get(name);
    const dialog = id => document.querySelector('#' + id + ' dialog');
    const closeButton = id => dialog(id).querySelector('.aui-modal__footer aui-button button');
    const entries = what => scope().log.filter(e => e.what === what);
    const clearLog = () => { scope().log.length = 0; };
    const digestsSince = t => window.__digests.filter(x => x >= t).length;
    const boxDialog = () => document.querySelector('aui-message-box-host dialog');
    /** A keydown of Escape where the focus is (as a key press arrives); whether its default was prevented */
    const escape = (repeat) => {
        const target = document.activeElement || document.body;
        const event = new KeyboardEvent('keydown', {key: 'Escape', code: 'Escape', keyCode: 27, repeat: !!repeat, bubbles: true, cancelable: true});
        target.dispatchEvent(event);
        return event.defaultPrevented;
    };
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('M1 opening: shown at once with is-open; the body built in the open digest; with defer-render its place first and the body after the first frame',
        {plainBody: true, deferredAtOnce: {open: true, isOpen: true, deferredClass: true, pending: true, body: false}, deferredLater: {pending: false, body: true}},
        async () => {
            apply(s => { s.open.plain = true; });
            const plainBody = !!document.getElementById('plain-body');
            apply(s => { s.open.plain = false; });
            await sleep(400);
            apply(s => { s.open.deferred = true; });
            const d = dialog('m-deferred');
            const deferredAtOnce = {open: d.open, isOpen: d.classList.contains('is-open'), deferredClass: d.classList.contains('aui-modal--deferred'),
                pending: !!d.querySelector('.aui-modal__content--pending'), body: !!document.getElementById('deferred-body')};
            await sleep(300);
            const deferredLater = {pending: !!d.querySelector('.aui-modal__content--pending'), body: !!document.getElementById('deferred-body')};
            apply(s => { s.open.deferred = false; });
            await sleep(400);
            return {plainBody, deferredAtOnce, deferredLater};
        });

    T('M2 on-rendered: once per opening with the body there (deferred or not); none when opened again while it fades out',
        {deferred: [true], afterReopen: 1, rendered: [true], secondOpening: 2},
        async () => {
            clearLog();
            apply(s => { s.open.deferred = true; });
            await sleep(300);
            const deferred = entries('rendered deferred').map(e => e.body);
            apply(s => { s.open.deferred = false; });
            await sleep(60);
            apply(s => { s.open.deferred = true; });
            await sleep(300);
            const afterReopen = entries('rendered deferred').length;
            apply(s => { s.open.deferred = false; });
            await sleep(400);
            apply(s => { s.open.rendered = true; });
            await sleep(300);
            const rendered = entries('rendered rendered').map(e => e.body);
            apply(s => { s.open.rendered = false; });
            await sleep(400);
            apply(s => { s.open.rendered = true; });
            await sleep(300);
            const secondOpening = entries('rendered rendered').length;
            apply(s => { s.open.rendered = false; });
            await sleep(400);
            return {deferred, afterReopen, rendered, secondOpening};
        });

    T('M3 its Close button: the fade at once; is-open false after the first frame; on-close and the body gone after the fade; two digests of the page',
        {atOnce: {isOpen: false, closing: true, model: true}, afterFrame: {model: false, closed: 0, body: true, open: true}, end: {closed: 1, body: false, open: false, digests: 2}},
        async () => {
            apply(s => { s.open.plain = true; });
            await sleep(500);
            clearLog();
            const d = dialog('m-plain');
            const t = performance.now();
            closeButton('m-plain').click();
            const atOnce = {isOpen: d.classList.contains('is-open'), closing: d.classList.contains('aui-modal--closing'), model: scope().open.plain};
            // the first frame of the close, and the digest after it: the model false then, the fade still on
            while (scope().open.plain && performance.now() - t < 200) await new Promise(r => requestAnimationFrame(r));
            const afterFrame = {model: scope().open.plain, closed: entries('closed plain').length, body: !!document.getElementById('plain-body'), open: d.open};
            await sleep(500);
            const end = {closed: entries('closed plain').length, body: !!document.getElementById('plain-body'), open: d.open, digests: digestsSince(t)};
            return {atOnce, afterFrame, end};
        });

    T('M4 aui-modal-close: its action runs before is-open turns false (the model as it was), on-close after it',
        {action: true, modelThen: true, closed: true, actionFirst: true, model: false},
        async () => {
            apply(s => { s.open.actions = true; });
            await sleep(500);
            clearLog();
            document.querySelector('#cancel-action button').click();
            await sleep(500);
            const a = entries('cancel action')[0], c = entries('closed actions')[0];
            return {action: !!a, modelThen: a ? a.modelThen : null, closed: !!c, actionFirst: a && c ? a.at < c.at : null, model: scope().open.actions};
        });

    T('M5 opened again while it fades out: it stays open with its body, no on-close',
        {open: true, isOpen: true, closed: 0, sameBody: true, model: true},
        async () => {
            apply(s => { s.open.plain = true; });
            await sleep(500);
            clearLog();
            const body = document.getElementById('plain-body');
            closeButton('m-plain').click();
            await sleep(60);
            apply(s => { s.open.plain = true; });
            await sleep(500);
            const d = dialog('m-plain');
            const r = {open: d.open, isOpen: d.classList.contains('is-open'), closed: entries('closed plain').length,
                sameBody: document.getElementById('plain-body') === body, model: scope().open.plain};
            apply(s => { s.open.plain = false; });
            await sleep(400);
            return r;
        });

    T('M6 closed in the turn it opened (no frame of it drawn): shut at once, on-close called',
        {open: false, closed: 1, model: false},
        async () => {
            clearLog();
            apply(s => { s.open.plain = true; });
            apply(s => { s.open.plain = false; });
            const r = {open: dialog('m-plain').open, closed: entries('closed plain').length, model: scope().open.plain};
            await sleep(300);
            return r;
        });

    T('M7 Escape: never closes without close-on-esc (twice in a row either); a held key closes nothing; closes with close-on-esc; its default always prevented',
        {noesc: {prevented: [true, true], open: true}, held: {prevented: true, open: true}, plain: {prevented: true, open: false, model: false}},
        async () => {
            apply(s => { s.open.noesc = true; });
            await sleep(500);
            const p1 = escape();
            await sleep(60);
            const p2 = escape();
            await sleep(400);
            const noesc = {prevented: [p1, p2], open: dialog('m-noesc').open};
            apply(s => { s.open.noesc = false; });
            await sleep(400);
            apply(s => { s.open.plain = true; });
            await sleep(500);
            const ph = escape(true);
            await sleep(300);
            const held = {prevented: ph, open: dialog('m-plain').open};
            const pp = escape();
            await sleep(400);
            return {noesc, held, plain: {prevented: pp, open: dialog('m-plain').open, model: scope().open.plain}};
        });

    T('M8 a message box opened over an open modal dims the page less (stacked); opened alone it does not',
        {over: true, alone: false},
        async () => {
            apply(s => { s.open.plain = true; });
            await sleep(500);
            svc('AuiMessageBox').confirm('Over the modal');
            await sleep(500);
            const over = boxDialog().classList.contains('aui-modal--stacked');
            apply(() => { svc('AuiMessageBox')._cancelCurrent(); });
            await sleep(500);
            apply(s => { s.open.plain = false; });
            await sleep(400);
            svc('AuiMessageBox').confirm('Alone');
            await sleep(500);
            const alone = boxDialog().classList.contains('aui-modal--stacked');
            apply(() => { svc('AuiMessageBox')._cancelCurrent(); });
            await sleep(500);
            return {over, alone};
        });

    T('M9 background-opacity="OPAQUE_LIKE": a translucent, blurred box; without it opaque',
        {glass: {background: 'rgba(255, 255, 255, 0.8)', filter: 'blur(8px)'}, plain: {background: 'rgb(255, 255, 255)', filter: 'none'}},
        async () => {
            apply(s => { s.open.glass = true; s.open.plain = true; });
            await sleep(500);
            const look = id => { const st = getComputedStyle(dialog(id)); return {background: st.backgroundColor, filter: st.backdropFilter || st.webkitBackdropFilter}; };
            const r = {glass: look('m-glass'), plain: look('m-plain')};
            apply(s => { s.open.glass = false; s.open.plain = false; });
            await sleep(400);
            return r;
        });

    T('M10 the close takes the closing motion (the box 220 ms, its backdrop 260 ms) and then shuts the dialog at once',
        {inTime: true},
        async () => {
            apply(s => { s.open.plain = true; });
            await sleep(500);
            const d = dialog('m-plain');
            const t = performance.now();
            closeButton('m-plain').click();
            let shutAt = null;
            while (performance.now() - t < 1000) {
                await new Promise(r => requestAnimationFrame(r));
                if (!d.open) { shutAt = performance.now() - t; break; }
            }
            return {inTime: shutAt !== null && shutAt >= 170 && shutAt <= 400};
        });

    T('M11b a deferred body set up from on-rendered gets the page\'s broadcast even after a 400 ms opening; a 300 ms timer misses it',
        {timer: [], rendered: ['rendered']},
        async () => {
            const run = async way => {
                clearLog();
                apply(s => { s.openSearch(way, 400); });
                await sleep(900);
                const got = entries('search started').map(e => e.way);
                apply(s => { s.open.search = false; });
                await sleep(400);
                return got;
            };
            return {timer: await run('timer'), rendered: await run('rendered')};
        });

    // The page under an open modal, on this page that scrolls: what it shows before, at the opening (in the same turn,
    // before any frame) and after the close; the box's centre in each frame of its opening (it scales about its
    // centre: only a layout change moves it). lockAnyway: the registry answers that the browser does not hold the page
    // (an older browser), so the component locks it. rootRule: a rule for the page's root element.
    const scrollbar = () => window.innerWidth - document.documentElement.clientWidth;
    // whether this browser gives a scrollbar room of its own (classic scrollbars) or draws it over the page (overlay
    // scrollbars: no room, nothing to take away or give back): the checks below compare with that
    const classicScrollbars = () => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position: absolute; top: -200px; width: 100px; height: 100px; overflow: scroll;';
        document.body.appendChild(probe);
        const room = probe.offsetWidth - probe.clientWidth;
        probe.remove();
        return room > 0;
    };
    const pageStyles = () => (document.documentElement.getAttribute('style') || '') + ' | ' + (document.body.getAttribute('style') || '');
    async function openOnScrollingPage(lockAnyway, rootRule) {
        const registry = angular.element(document.body).injector().get('auiModalRegistry');
        const own = registry.cssHoldsPage;
        let rule = null;
        if (rootRule) { rule = document.createElement('style'); rule.textContent = rootRule; document.head.appendChild(rule); }
        if (lockAnyway) registry.cssHoldsPage = function () { return false; };
        try {
            const before = {scrollbar: scrollbar() > 0, styles: pageStyles()};
            apply(s => { s.open.plain = true; });
            const atOpen = {scrollbar: scrollbar(), bodyOverflow: getComputedStyle(document.body).overflowY,
                rootOverflow: getComputedStyle(document.documentElement).overflowY, styles: pageStyles()};
            const d = dialog('m-plain');
            const centres = [];
            for (let i = 0; i < 24; i++) {
                await new Promise(r => requestAnimationFrame(r));
                const r = d.getBoundingClientRect();
                centres.push(r.left + r.width / 2);
            }
            const boxMoved = Math.max.apply(null, centres) - Math.min.apply(null, centres) > 0.5;
            const hold = {box: getComputedStyle(d).overscrollBehaviorY, backdrop: getComputedStyle(d, '::backdrop').overscrollBehaviorY,
                backdropOverflow: getComputedStyle(d, '::backdrop').overflowY};
            apply(s => { s.open.plain = false; });
            await sleep(500);
            const after = {scrollbar: scrollbar() > 0, stylesBack: pageStyles() === before.styles};
            return {before: before.scrollbar, atOpen, boxMoved, hold, after};
        } finally {
            registry.cssHoldsPage = own;
            if (rule) rule.remove();
        }
    }

    T('M12 on a page with a scrollbar, where the browser holds the page (Chromium 144+): nothing on the page is touched - the scrollbar stays, no style of the page changes - and the box and its backdrop hold it',
        {cssHolds: true, r: {before: true, atOpen: {scrollbar: 15, bodyOverflow: 'visible', rootOverflow: 'visible', styles: ' | '}, boxMoved: false,
            hold: {box: 'contain', backdrop: 'contain', backdropOverflow: 'hidden'}, after: {scrollbar: true, stylesBack: true}}},
        async () => {
            const cssHolds = angular.element(document.body).injector().get('auiModalRegistry').cssHoldsPage();
            const r = await openOnScrollingPage(false, null);
            const classic = classicScrollbars();
            // where scrollbars take no room, there is none to keep: read as kept
            r.before = r.before || !classic;
            r.atOpen.scrollbar = r.atOpen.scrollbar > 0 || !classic ? 15 : r.atOpen.scrollbar;
            r.after.scrollbar = r.after.scrollbar || !classic;
            return {cssHolds, r};
        });

    T('M12b the lock (an older browser): the scrollbar goes as the modal opens, before its first frame (the box never moves once drawn); everything comes back after the close',
        {before: true, atOpen: {scrollbar: 0, bodyOverflow: 'hidden', rootOverflow: 'visible', stylesChanged: true}, boxMoved: false, after: {scrollbar: true, stylesBack: true}},
        async () => {
            const r = await openOnScrollingPage(true, null);
            const classic = classicScrollbars();
            return {before: r.before || !classic, atOpen: {scrollbar: r.atOpen.scrollbar, bodyOverflow: r.atOpen.bodyOverflow, rootOverflow: r.atOpen.rootOverflow,
                stylesChanged: r.atOpen.styles !== ' | '}, boxMoved: r.boxMoved, after: {scrollbar: r.after.scrollbar || !classic, stylesBack: r.after.stylesBack}};
        });

    T('M12c the lock on a page whose root scrolls itself (html { overflow-y: scroll }): the root is locked (a body lock would leave it scrolling), and put back',
        {before: true, atOpen: {scrollbar: 0, rootOverflow: 'hidden'}, boxMoved: false, after: {scrollbar: true, stylesBack: true}},
        async () => {
            const r = await openOnScrollingPage(true, 'html { overflow-y: scroll; }');
            const classic = classicScrollbars();
            return {before: r.before || !classic, atOpen: {scrollbar: r.atOpen.scrollbar, rootOverflow: r.atOpen.rootOverflow}, boxMoved: r.boxMoved,
                after: {scrollbar: r.after.scrollbar || !classic, stylesBack: r.after.stylesBack}};
        });

    T('M13 a confirm still saving when the modal is closed and opened again: its late answer neither closes the new opening nor ends its loading; the new opening\'s own confirm closes it',
        {loadingBefore: true, newOpeningLoading: false, answered: true, stillOpen: true, closes: 1, ownConfirmCloses: true},
        async () => {
            clearLog();
            apply(s => { s.saveMs = 900; s.open.confirm = true; });
            await sleep(600);
            const confirmButton = () => Array.from(dialog('m-confirm').querySelectorAll('.aui-modal__footer aui-button button')).pop();
            confirmButton().click();
            await sleep(60);
            const loadingBefore = !!dialog('m-confirm').querySelector('.aui-modal__footer aui-button[loading] , .aui-modal__footer .is-loading, .aui-modal__footer [aria-busy="true"]')
                || angular.element(document.getElementById('m-confirm')).isolateScope().$ctrl.confirmInFlight === true;
            closeButton('m-confirm').click();
            await sleep(450);
            apply(s => { s.open.confirm = true; });
            await sleep(100);
            const newOpeningLoading = angular.element(document.getElementById('m-confirm')).isolateScope().$ctrl.confirmInFlight;
            await sleep(700);     // the first save answers now, with the modal open again
            const answered = entries('save answered').length === 1;
            const stillOpen = dialog('m-confirm').open && scope().open.confirm === true;
            const closes = entries('closed confirm').length;
            // this opening's own confirm still closes it
            apply(s => { s.saveMs = 100; });
            confirmButton().click();
            await sleep(900);
            const ownConfirmCloses = !dialog('m-confirm').open && scope().open.confirm === false;
            return {loadingBefore, newOpeningLoading, answered, stillOpen, closes, ownConfirmCloses};
        });

    const ctrlOf = id => angular.element(document.getElementById(id)).isolateScope().$ctrl;
    const footerButtons = id => Array.from(dialog(id).querySelectorAll('.aui-modal__footer aui-button button'));

    T('M14 a <footer> of its own with show-confirm-button: only its own buttons are built (no default Close / Confirm, no Angular error)',
        {own: true, buttons: ['Done'], footers: 1},
        async () => {
            apply(s => { s.open.own = true; });
            await until(() => dialog('m-own').open, 2000);
            await sleep(100);
            const r = {own: ctrlOf('m-own').ownFooter, buttons: footerButtons('m-own').map(b => b.textContent.trim()),
                footers: dialog('m-own').querySelectorAll('.aui-modal__footer').length};
            apply(s => { s.open.own = false; });
            await sleep(400);
            return r;
        });

    T('M15 opened again from its own on-close (a microtask): the new opening stays open; the close event of the earlier close does not close it',
        {reopened: 1, open: true, model: true, closes: 1},
        async () => {
            clearLog();
            apply(s => { s.reopenNext = true; s.reopens = 0; s.open.reopen = true; });
            await sleep(500);
            closeButton('m-reopen').click();
            await until(() => scope().reopens === 1, 2000);
            await sleep(300);     // the earlier close's event has long arrived
            const r = {reopened: scope().reopens, open: dialog('m-reopen').open, model: scope().open.reopen, closes: entries('closed reopen').length};
            apply(s => { s.open.reopen = false; });
            await sleep(500);
            return r;
        });

    T('M16 on-confirm with a promise of the browser\'s own: resolved false or rejected, the Confirm button is ready again at once (no other digest needed); resolved, the dialog closes',
        {busyWhileSaving: true, afterFalse: {busy: false, open: true}, afterReject: {busy: false, open: true}, afterResolve: {open: false}},
        async () => {
            apply(s => { s.open.native = true; });
            await sleep(500);
            const confirm = () => footerButtons('m-native').pop();
            const busy = () => confirm().getAttribute('aria-busy') === 'true';
            confirm().click();
            await sleep(50);
            const busyWhileSaving = busy();
            scope().nativeAnswer.resolve(false);
            await sleep(100);
            const afterFalse = {busy: busy(), open: dialog('m-native').open};
            confirm().click();
            await sleep(50);
            scope().nativeAnswer.reject(new Error('refused'));
            await sleep(100);
            const afterReject = {busy: busy(), open: dialog('m-native').open};
            confirm().click();
            await sleep(50);
            scope().nativeAnswer.resolve(true);
            await until(() => !dialog('m-native').open, 2000);
            return {busyWhileSaving, afterFalse, afterReject, afterResolve: {open: dialog('m-native').open}};
        });

    T('M17 confirm-loading-text: shown in the Confirm button while the save runs (the label hidden meanwhile)',
        {text: 'Saving changes', visible: true, label: 'Save', labelHidden: true},
        async () => {
            apply(s => { s.open.native = true; });
            await sleep(500);
            const button = footerButtons('m-native').pop();
            button.click();
            await sleep(100);
            const loading = button.querySelector('.aui-button__label--loading');
            const label = button.querySelector('.aui-button__label:not(.aui-button__label--loading)');
            const shows = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible' &&
                Number(getComputedStyle(el).opacity) > 0.9;
            const r = {text: loading ? loading.textContent.trim() : null, visible: shows(loading),
                label: label ? label.textContent.trim() : null, labelHidden: !shows(label)};
            scope().nativeAnswer.resolve(true);
            await until(() => !dialog('m-native').open, 2000);
            await sleep(100);
            return r;
        });

    T('M18 width and height each on its own: CSS lengths as given, a number a share of the window, the other dimension from size; a preset dimension keeps a minimum, a page\'s own none',
        {px: ['480px', '260px', false, false], rem: ['30rem', 'calc(40vh - 40px)', false, true], share: ['55vw', '45vh', false, false],
            none: ['40vw', 'calc(40vh - 40px)', true, true], minWidth: true, minHeight: true, ownNoMin: true},
        async () => {
            const read = async (w, h) => {
                apply(s => { s.sized.w = w; s.sized.h = h; });
                await sleep(0);
                const d = dialog('m-sized');
                // the browser writes a calc() its own way: the small preset's height read back as it writes it
                const probe = document.createElement('div');
                probe.style.height = 'calc(40vh - 40px)';
                const small = h => h === probe.style.height ? 'calc(40vh - 40px)' : h;
                return [d.style.width, small(d.style.height), d.classList.contains('aui-modal--preset-width'), d.classList.contains('aui-modal--preset-height')];
            };
            const px = await read('480px', '260px');
            const rem = await read('30rem', '');
            const share = await read('55', '45');
            const none = await read('', '');
            // the preset's minimum: on this wide window the share is larger anyway, so the rule itself is read
            apply(s => { s.open.sized = true; });
            await sleep(400);
            const d = dialog('m-sized');
            const minWidth = ['0px', 'auto'].indexOf(getComputedStyle(d).minWidth) < 0;
            const minHeight = ['0px', 'auto'].indexOf(getComputedStyle(d).minHeight) < 0;
            await read('480px', '260px');
            const ownNoMin = ['0px', 'auto'].indexOf(getComputedStyle(d).minWidth) >= 0;
            apply(s => { s.open.sized = false; s.sized.w = ''; s.sized.h = ''; });
            await sleep(400);
            return {px, rem, share, none, minWidth, minHeight, ownNoMin};
        });

    T('M19 the default footer wraps its actions where the dialog is too narrow; the dialog does not scroll on a page without a border-box rule',
        {wrap: 'wrap', scrollsX: false, scrollsY: false},
        async () => {
            apply(s => { s.open.plain = true; });
            await sleep(500);
            const d = dialog('m-plain');
            const footer = d.querySelector('.aui-modal__footer');
            const r = {wrap: getComputedStyle(footer).flexWrap, scrollsX: d.scrollWidth > d.clientWidth, scrollsY: d.scrollHeight > d.clientHeight};
            apply(s => { s.open.plain = false; });
            await sleep(500);
            return r;
        });

    T('M20 two open, the lower one closed first: the one left dims the page as a single one does (no longer stacked)',
        {stackedOver: true, aloneAtOnce: true, alone: true},
        async () => {
            apply(s => { s.open.plain = true; });
            await sleep(400);
            apply(s => { s.open.upper = true; });
            await sleep(400);
            const stackedOver = dialog('m-upper').classList.contains('aui-modal--stacked');
            apply(s => { s.open.plain = false; });
            await sleep(50);
            const aloneAtOnce = !dialog('m-upper').classList.contains('aui-modal--stacked');
            await sleep(500);
            const alone = !dialog('m-upper').classList.contains('aui-modal--stacked');
            apply(s => { s.open.upper = false; });
            await sleep(500);
            return {stackedOver, aloneAtOnce, alone};
        });

    T('M21 AuiModal.open: once closed, the dialog lets go of its content and the page\'s functions (a page that keeps the returned promise keeps only a small record)',
        {resolved: 'close', content: null, render: null, onConfirm: null, onClose: null, closedCalled: true},
        async () => {
            const AuiModal = svc('AuiModal');
            const node = document.createElement('p');
            node.textContent = 'Kept by the page';
            let closedCalled = false;
            let resolved = null;
            const handle = AuiModal.open({content: node, onConfirm: function () { return true; }, onClose: function () { closedCalled = true; }});
            handle.then(r => { resolved = r.reason; });
            await until(() => document.querySelector('aui-modal-host dialog[open]'), 2000);
            const item = AuiModal.state.current;
            await sleep(400);
            handle.close();
            await until(() => resolved !== null, 2000);
            return {resolved, content: item.content, render: item.render, onConfirm: item._onConfirm, onClose: item._onClose, closedCalled};
        });

    T('M22 auto-size keeps the default layout\'s room: the header as far from the border as there, the footer as far from the bottom as the header from the top, 12px between body and footer; header and footer styled by the stylesheet (a page rule changes them); content-layout="fill" without room',
        {header: true, body: true, footer: true, plainFooter: true, gap: '12px', inline: [null, null], pageRule: true, ownFooter: true,
            fill: {padding: '0px', header: 1}},
        async () => {
            const measure = async (key, id) => {
                apply(s => { s.open[key] = true; });
                await sleep(500);
                const d = dialog(id);
                const b = d.getBoundingClientRect();
                const at = sel => {
                    const r = d.querySelector(sel).getBoundingClientRect();
                    return {left: r.left - b.left, top: r.top - b.top, bottom: b.bottom - r.bottom};
                };
                const footer = d.querySelector('.aui-modal__footer');
                const m = {header: at('.aui-modal__header'), body: at('.aui-modal__content'), footer: at('.aui-modal__footer'),
                    padding: getComputedStyle(d).paddingTop, gap: getComputedStyle(footer).paddingTop, justify: getComputedStyle(footer).justifyContent,
                    inline: [d.querySelector('.aui-modal__header').getAttribute('style'), footer.getAttribute('style')]};
                apply(s => { s.open[key] = false; });
                await sleep(500);
                return m;
            };
            const near = (a, b) => Math.abs(a - b) < 0.5;
            const plain = await measure('plain', 'm-plain');
            const auto = await measure('auto', 'm-auto');
            const own = await measure('autoOwn', 'm-auto-own');
            const fill = await measure('fill', 'm-fill');
            // the page's justify-content: flex-end, as this browser writes it back (newer Chrome reports "flow-end")
            const probe = document.createElement('div');
            probe.style.cssText = 'display: flex; justify-content: flex-end;';
            document.body.appendChild(probe);
            const flexEnd = getComputedStyle(probe).justifyContent;
            probe.remove();
            return {
                header: near(auto.header.left, plain.header.left) && near(auto.header.top, plain.header.top),
                body: near(auto.body.left, auto.header.left),
                footer: near(auto.footer.bottom, auto.header.top),
                plainFooter: near(plain.footer.bottom, plain.header.top),
                gap: auto.gap,
                inline: auto.inline,
                pageRule: own.justify === flexEnd && auto.justify !== flexEnd,
                ownFooter: near(own.footer.bottom, own.header.top),
                fill: {padding: fill.padding, header: Math.round(fill.header.left)}
            };
        });

    T('M23 the message box keeps its own frame (auto-size with content-layout fill): no room around it, the box within 92% x 88% of the window',
        {padding: '0px', at: [1, 1], within: true},
        async () => {
            svc('AuiMessageBox').alert('A message box');
            await until(() => boxDialog() && boxDialog().open, 2000);
            await sleep(500);
            const d = boxDialog();
            const b = d.getBoundingClientRect();
            const m = d.querySelector('.aui-message-box').getBoundingClientRect();
            const r = {padding: getComputedStyle(d).paddingTop, at: [Math.round(m.left - b.left), Math.round(m.top - b.top)],
                within: b.width <= window.innerWidth * 0.92 + 0.5 && b.height <= window.innerHeight * 0.88 + 0.5};
            apply(() => { svc('AuiMessageBox')._cancelCurrent(); });
            await sleep(700);
            return r;
        });

    T('M11 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('aui-* family: aui-modal', tests);
})();
