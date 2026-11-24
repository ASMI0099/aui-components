// Message round suite (page: round.html, fixture: round.fixture.js): AuiMessageBox - the queue's order when a box
// asks for another as it closes, a way out always, errors told to the application, the box's name and description,
// blank captions, no page digest for a queued box, formatting when shown, narrow layouts, a long message reachable;
// AuiMessage - holds (pointer, focus, touch), patches, errors, long durations, clearAll, formatting, no track by,
// focus kept across an update, defaults, the kind said, layout, rich content and colours; the exit, and the glide of the
// notices that stay when one is removed.
(function () {
    const {sleep, until} = AuiTest;
    const svc = name => angular.element(document.body).injector().get(name);
    const digestsSince = t => window.__digests.filter(x => x >= t).length;
    const boxDialog = () => document.querySelector('aui-message-box-host dialog');
    const boxText = () => {
        const el = document.querySelector('aui-message-box-host .aui-message-box__content');
        return el ? el.textContent.trim() : null;
    };
    const boxButtons = () => Array.prototype.slice.call(document.querySelectorAll('aui-message-box-host .aui-message-box__actions aui-button button'));
    const card = id => document.querySelector('.aui-message[data-aui-message-id="' + id + '"]');
    const hostScope = () => angular.element(document.querySelector('aui-message-host')).isolateScope();
    const pointer = (el, type, kind) => el.dispatchEvent(new PointerEvent(type, {pointerType: kind || 'mouse', bubbles: false}));
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});
    // a check of frames (sampled on the main thread): runs again when a busy machine dropped them
    const TT = (name, expect, fn) => tests.push({name, expect, fn, timing: true});

    // answers every box left (OK), until none shows
    async function drain() {
        for (let i = 0; i < 12; i += 1) {
            await sleep(60);
            const buttons = boxButtons();
            if (!boxDialog() || !buttons.length) {
                if (!svc('AuiMessageBox').state.queue.length && !svc('AuiMessageBox').state.next) return;
                continue;
            }
            buttons[buttons.length - 1].click();
            await until(() => !boxDialog() || boxText() === null, 1500);
        }
    }

    async function clearToasts() {
        svc('AuiMessage').clearAll();
        await sleep(400);     // past their 300 ms exit
    }

    T('MB01 a box asked for by the answer of one closed with Escape waits behind the box that was waiting: A, B, C',
        {shown: ['A', 'B', 'C']},
        async () => {
            const box = svc('AuiMessageBox');
            const shown = [];
            box.alert('A').then(() => { box.alert('C'); });
            box.alert('B');
            await until(() => boxText() === 'A', 2000);
            shown.push(boxText());
            document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
            await until(() => boxText() !== null && boxText() !== 'A', 2000);
            shown.push(boxText());
            boxButtons().pop().click();
            await until(() => boxText() !== null && boxText() !== shown[1], 2000);
            shown.push(boxText());
            await drain();
            return {shown};
        });

    T('MB04 a box with neither button nor Escape still has a way out: its OK button',
        {buttons: 1, answer: true},
        async () => {
            const box = svc('AuiMessageBox');
            let answer = null;
            box.show({message: 'Info', showConfirm: false, showCancel: false, closeOnEsc: false}).then(v => { answer = v; });
            await until(() => boxText() === 'Info', 2000);
            const buttons = boxButtons().length;
            boxButtons().pop().click();
            await until(() => answer !== null, 2000);
            await drain();
            return {buttons, answer};
        });

    T('MB05 a callback of the page that fails is told to the application\'s $exceptionHandler (the answer stays the user\'s)',
        {reported: true, answer: true},
        async () => {
            const box = svc('AuiMessageBox');
            let answer = null;
            const before = window.__purposeErrors.length;
            box.confirm('Save?', {confirmCallback: () => { throw new Error('confirm callback failed on purpose'); }}).then(v => { answer = v; });
            await until(() => boxText() === 'Save?', 2000);
            boxButtons().pop().click();
            await until(() => answer !== null, 2000);
            await drain();
            return {reported: window.__purposeErrors.length > before, answer};
        });

    T('MB06 MB07 MB21 the box is described by its message; without a title (empty or blank) it is named by its type',
        {described: true, empty: 'Error', blank: 'Error', blankHeading: false},
        async () => {
            const box = svc('AuiMessageBox');
            box.error('The export failed.', {title: ''});
            await until(() => boxText() === 'The export failed.', 2000);
            const dialog = boxDialog();
            const content = document.querySelector('aui-message-box-host .aui-message-box__content');
            const described = !!content.id && dialog.getAttribute('aria-describedby') === content.id;
            const empty = dialog.getAttribute('aria-label');
            await drain();
            box.error('Again failed.', {title: '   '});
            await until(() => boxText() === 'Again failed.', 2000);
            const blank = boxDialog().getAttribute('aria-label');
            const blankHeading = !!document.querySelector('aui-message-box-host .aui-message-box__title');
            await drain();
            return {described, empty, blank, blankHeading};
        });

    T('MB08 empty or blank captions: the buttons keep their default names',
        {captions: ['Cancel', 'OK']},
        async () => {
            const box = svc('AuiMessageBox');
            box.confirm('Go?', {confirmText: '', cancelText: '   '});
            await until(() => boxText() === 'Go?', 2000);
            const captions = boxButtons().map(b => b.textContent.trim());
            await drain();
            return {captions};
        });

    T('MB15 MB16 boxes asked for while one shows cost the page no digest, and their rich messages are formatted only when shown',
        {digests: 0, formatted: 0, later: true},
        async () => {
            const box = svc('AuiMessageBox');
            const html = svc('AuiSafeHtml');
            box.alert('Open');
            await until(() => boxText() === 'Open', 2000);
            await sleep(400);   // the opening's own digests are over
            const trust = html.trust;
            let formatted = 0;
            html.trust = function () { formatted += 1; return trust.apply(this, arguments); };
            const t = performance.now();
            try {
                for (let i = 0; i < 5; i += 1) {
                    box.show({message: '<b>Queued ' + i + '</b>', useHtml: true});
                    await sleep(5);
                }
                const digests = digestsSince(t);
                const queued = formatted;
                await drain();
                return {digests, formatted: queued, later: formatted === 5};
            } finally {
                html.trust = trust;
            }
        });

    T('MB09 MB10 a narrow box: its buttons wrap to another line, its long title wraps',
        {wrap: 'wrap', title: 'anywhere'},
        async () => {
            const box = svc('AuiMessageBox');
            box.confirm('Delete?', {title: 'Order-reference-' + new Array(30).join('X')});
            await until(() => boxText() === 'Delete?', 2000);
            const r = {wrap: getComputedStyle(document.querySelector('aui-message-box-host .aui-message-box__actions')).flexWrap,
                title: getComputedStyle(document.querySelector('aui-message-box-host .aui-message-box__title')).overflowWrap};
            await drain();
            return r;
        });

    T('MB20 a message that scrolls has a place in the Tab order (a short one has none)',
        {long: '0', short: null},
        async () => {
            const box = svc('AuiMessageBox');
            box.alert(new Array(120).join('A line of a long message\n'));
            await until(() => boxText() && boxText().length > 200, 2000);
            await sleep(80);
            const long = document.querySelector('aui-message-box-host .aui-message-box__content').getAttribute('tabindex');
            await drain();
            box.alert('Short');
            await until(() => boxText() === 'Short', 2000);
            await sleep(80);
            const short = document.querySelector('aui-message-box-host .aui-message-box__content').getAttribute('tabindex');
            await drain();
            return {long, short};
        });

    T('AM03 a notice held by the pointer keeps holding when it is given a duration later; let go, it leaves',
        {held: true, gone: true},
        async () => {
            const m = svc('AuiMessage');
            const h = m.show({message: 'Held', duration: 0});
            await until(() => !!card(h.id), 1000);
            pointer(card(h.id), 'pointerenter');
            h.update({duration: 250});
            await sleep(500);
            const held = !!card(h.id) && !card(h.id).classList.contains('aui-message--leaving');
            pointer(card(h.id), 'pointerleave');
            await until(() => !card(h.id), 1500);
            return {held, gone: !card(h.id)};
        });

    T('AM04 an update given as a plain dictionary (no hasOwnProperty) is applied',
        {text: 'Patched'},
        async () => {
            const m = svc('AuiMessage');
            const h = m.show({message: 'Before', duration: 0});
            await until(() => !!card(h.id), 1000);
            const patch = Object.create(null);
            patch.message = 'Patched';
            h.update(patch);
            await sleep(30);
            const text = card(h.id).querySelector('.aui-message__content').textContent.trim();
            await clearToasts();
            return {text};
        });

    T('AM05 an on-close of the page that fails is told to the application\'s $exceptionHandler',
        {reported: true},
        async () => {
            const m = svc('AuiMessage');
            const before = window.__purposeErrors.length;
            m.show({message: 'Bye', duration: 60, onClose: () => { throw new Error('on-close failed on purpose'); }});
            await until(() => window.__purposeErrors.length > before, 2000);
            return {reported: window.__purposeErrors.length > before};
        });

    T('AM06 a duration past a browser timer\'s limit keeps the notice (it left at once)',
        {there: true},
        async () => {
            const m = svc('AuiMessage');
            const h = m.show({message: 'Long', duration: 2147483648});
            await sleep(300);
            const there = !!card(h.id) && !card(h.id).classList.contains('aui-message--leaving');
            await clearToasts();
            return {there};
        });

    T('AM18 the keyboard\'s focus in a notice holds its countdown; once it leaves, the notice goes',
        {held: true, gone: true},
        async () => {
            const m = svc('AuiMessage');
            const h = m.show({message: '<a href="#receipt">Receipt</a>', useHtml: true, duration: 300});
            await until(() => !!card(h.id), 1000);
            card(h.id).querySelector('a').focus();
            await sleep(600);
            const held = !!card(h.id) && !card(h.id).classList.contains('aui-message--leaving');
            document.getElementById('outside').focus();
            await until(() => !card(h.id), 1500);
            return {held, gone: !card(h.id)};
        });

    T('AM24 a touch on a notice does not hold it (lifted, nothing holds it): it leaves on time',
        {gone: true},
        async () => {
            const m = svc('AuiMessage');
            const h = m.show({message: 'Tapped', duration: 250});
            await until(() => !!card(h.id), 1000);
            // a tap: the touch's pointer events, then the browser's compatibility mouse event
            pointer(card(h.id), 'pointerenter', 'touch');
            card(h.id).dispatchEvent(new MouseEvent('mouseenter', {bubbles: false}));
            await until(() => !card(h.id), 1500);
            return {gone: !card(h.id)};
        });

    T('AM23 a leaving notice takes no clicks',
        {pointer: 'none'},
        async () => {
            const m = svc('AuiMessage');
            const h = m.show({message: 'Leaving', duration: 0});
            await until(() => !!card(h.id), 1000);
            h.close();
            await sleep(20);
            const value = card(h.id) ? getComputedStyle(card(h.id)).pointerEvents : 'gone';
            await sleep(400);
            return {pointer: value};
        });

    T('AM25 AM29 clearAll of 20 notices draws them twice, not twice each; a pointer over a notice without a countdown draws nothing',
        {clearDraws: true, hoverDraws: 0},
        async () => {
            const m = svc('AuiMessage');
            for (let i = 0; i < 20; i += 1) m.show({message: 'N' + i, duration: 0});
            await sleep(60);
            const scope = hostScope();
            let draws = 0;
            const stop = scope.$watch(() => { draws += 1; });
            const persistent = document.querySelector('.aui-message');
            draws = 0;
            pointer(persistent, 'pointerenter');
            pointer(persistent, 'pointerleave');
            await sleep(30);
            const hoverDraws = draws;
            draws = 0;
            m.clearAll();
            await sleep(400);
            stop();
            return {clearDraws: draws <= 6, hoverDraws};
        });

    T('AM26 a title-only update does not format the rich message again',
        {formatted: 0},
        async () => {
            const m = svc('AuiMessage');
            const html = svc('AuiSafeHtml');
            const h = m.show({message: '<b>Rich</b> text', useHtml: true, duration: 0});
            await sleep(30);
            const trust = html.trust;
            let formatted = 0;
            html.trust = function () { formatted += 1; return trust.apply(this, arguments); };
            try {
                for (let i = 0; i < 10; i += 1) h.update({title: 'Step ' + i});
            } finally {
                html.trust = trust;
            }
            await clearToasts();
            return {formatted};
        });

    T('AM28 the notices are repeated without "track by" (ngRepeat keeps no closed notice through it)',
        {trackBy: false},
        async () => {
            const m = svc('AuiMessage');
            m.show({message: 'One', duration: 0});
            await sleep(30);
            const walker = document.createTreeWalker(document.querySelector('aui-message-host'), NodeFilter.SHOW_COMMENT);
            let trackBy = false;
            for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/track by/.test(n.nodeValue)) trackBy = true;
            const host = document.querySelector('.aui-message-host');
            if (host) {
                const w2 = document.createTreeWalker(host, NodeFilter.SHOW_COMMENT);
                for (let n = w2.nextNode(); n; n = w2.nextNode()) if (/track by/.test(n.nodeValue)) trackBy = true;
            }
            await clearToasts();
            return {trackBy};
        });

    T('AM34 a link in a notice keeps the focus when the notice\'s message is updated (same link, other numbers)',
        {focused: true},
        async () => {
            const m = svc('AuiMessage');
            const h = m.show({message: '<p>Ready: 7</p><a href="#deploy">View deployment</a>', useHtml: true, duration: 0});
            await until(() => !!card(h.id), 1000);
            card(h.id).querySelector('a').focus();
            h.update({message: '<p>Ready: 8</p><a href="#deploy">View deployment</a>'});
            await sleep(60);
            const active = document.activeElement;
            const focused = !!active && active.tagName === 'A' && active.getAttribute('href').indexOf('#deploy') >= 0 && card(h.id).contains(active);
            document.getElementById('outside').focus();
            await clearToasts();
            return {focused};
        });

    T('AM40 AM19 an undefined type is the default (info); a notice without a title says its kind as text',
        {info: true, kind: 'Error:'},
        async () => {
            const m = svc('AuiMessage');
            const a = m.show({message: 'Saved', duration: 0, type: undefined});
            const b = m.error('Upload failed', {duration: 0});
            await sleep(40);
            const r = {info: card(a.id).classList.contains('aui-message--info'),
                kind: (card(b.id).querySelector('.aui-message__type') || {textContent: ''}).textContent.trim()};
            await clearToasts();
            return r;
        });

    T('AM14 AM16 AM17 AM36 layout: a card counts its padding in its width (414px as always), a full stack keeps the size of its cards and has no scroll box, a long message and preformatted text scroll in the card',
        {box: 'border-box', width: 414, noScrollbar: true, cardsKeepHeight: true, messageCapped: true, pre: 'auto'},
        async () => {
            const m = svc('AuiMessage');
            const first = m.show({message: 'Notice', duration: 0});
            await sleep(80);
            const height = card(first.id).offsetHeight;
            for (let i = 0; i < 30; i += 1) m.show({message: 'Notice ' + i, duration: 0});
            const r = m.show({message: '<pre>' + new Array(40).join('build-step ') + '</pre>', useHtml: true, duration: 0});
            await sleep(80);
            const stack = document.querySelector('.aui-message-host__stack--top-right');
            const out = {box: getComputedStyle(card(r.id)).boxSizing,
                // on a wide window as wide as ever (380px of content), the padding counted in
                width: card(first.id).offsetWidth,
                // a full stack runs on below the window, as always: no scroll box beside the notices
                noScrollbar: getComputedStyle(stack).overflowY === 'visible',
                // the cards keep their height (a stack held to the window's height squashed them)
                cardsKeepHeight: card(first.id).offsetHeight === height,
                messageCapped: getComputedStyle(card(r.id).querySelector('.aui-message__content')).maxHeight !== 'none',
                pre: getComputedStyle(card(r.id).querySelector('pre')).overflowX};
            await clearToasts();
            return out;
        });

    T('AM37 AM39 AM38 rich content keeps scope, lang, dir and an ordered list\'s start (no id); a relative link resolves from the document\'s base',
        {start: '4', scope: 'col', lang: 'de', dir: 'ltr', id: null, href: true},
        async () => {
            const html = svc('AuiSafeHtml');
            const $sce = svc('$sce');
            const holder = document.createElement('div');
            holder.innerHTML = $sce.getTrustedHtml(html.trust('<ol start="4"><li>Step</li></ol><table><tr><th scope="col" id="h1">A</th></tr></table><span lang="de" dir="ltr">Teil</span>'));
            const base = document.createElement('base');
            base.href = location.origin + '/applications/billing/';
            document.head.appendChild(base);
            let href;
            try {
                const linkHolder = document.createElement('div');
                linkHolder.innerHTML = $sce.getTrustedHtml(html.trust('<a href="receipts/7">Receipt</a>'));
                href = linkHolder.querySelector('a').getAttribute('href');
            } finally {
                document.head.removeChild(base);
            }
            return {start: holder.querySelector('ol').getAttribute('start'), scope: holder.querySelector('th').getAttribute('scope'),
                lang: holder.querySelector('span').getAttribute('lang'), dir: holder.querySelector('span').getAttribute('dir'),
                id: holder.querySelector('th').getAttribute('id'), href: href.indexOf('/applications/billing/receipts/7') >= 0};
        });

    T('AM21 AM22 MB14 the Close cross is 3:1 or more on the card; the white surfaces take the light colour scheme',
        {close: 'rgb(107, 114, 128)', toast: 'light', dialog: 'light'},
        async () => {
            const m = svc('AuiMessage');
            const h = m.show({message: 'Colours', duration: 0});
            await sleep(30);
            const r = {close: getComputedStyle(card(h.id).querySelector('.aui-message__close')).color,
                toast: getComputedStyle(card(h.id)).colorScheme};
            await clearToasts();
            svc('AuiMessageBox').alert('Scheme');
            await until(() => boxText() === 'Scheme', 2000);
            r.dialog = getComputedStyle(boxDialog()).colorScheme;
            await drain();
            return r;
        });

    // a glide: a script animation of the card (not a CSS animation or transition)
    const glides = el => el.getAnimations().filter(x => !x.animationName && !x.transitionProperty).length;
    // a card's top in every frame for ms
    async function tops(el, ms) {
        const list = [];
        const t = performance.now();
        while (performance.now() - t < ms) {
            await frame();
            list.push(el.getBoundingClientRect().top);
        }
        return list;
    }

    TT('AM41 a notice removed: the one after it glides up into its place (it jumped there in one frame)',
        {moved: true, glided: true, end: true},
        async () => {
            const m = svc('AuiMessage');
            const a = m.show({message: 'First', duration: 0});
            const b = m.show({message: 'Second', duration: 0});
            m.show({message: 'Third', duration: 0});
            await sleep(400);
            const from = card(b.id).getBoundingClientRect().top;
            const to = card(a.id).getBoundingClientRect().top;
            const el = card(b.id);
            a.close();
            const list = await tops(el, 800);
            const r = {moved: from - to > 20, glided: list.filter(y => y < from - 1 && y > to + 1).length >= 3,
                end: Math.abs(list[list.length - 1] - to) < 1};
            await clearToasts();
            return r;
        });

    TT('AM44 two notices removed one after the other: the ones after them move on from where they are drawn, never back',
        {back: 0, smooth: true, end: true},
        async () => {
            const m = svc('AuiMessage');
            const a = m.show({message: 'First', duration: 0});
            const b = m.show({message: 'Second', duration: 0});
            m.show({message: 'Third', duration: 0});
            const d = m.show({message: 'Fourth', duration: 0});
            await sleep(400);
            const el = card(d.id);
            const from = el.getBoundingClientRect().top;
            const to = card(b.id).getBoundingClientRect().top;
            a.close();
            const list = [from];
            const t = performance.now();
            let closed = false;
            while (performance.now() - t < 800) {
                await frame();
                if (!closed && performance.now() - t >= 100) {
                    b.close();
                    closed = true;
                }
                list.push(el.getBoundingClientRect().top);
            }
            let back = 0;
            let step = 0;
            for (let i = 1; i < list.length; i += 1) {
                if (list[i] > list[i - 1] + 0.5) back += 1;
                step = Math.max(step, list[i - 1] - list[i]);
            }
            const r = {back, smooth: step < (from - to) * 0.35, end: Math.abs(list[list.length - 1] - to) < 1};
            await clearToasts();
            return r;
        });

    T('AM42 the exit is seen all the way (an even fade over 300 ms, a gentle slide), and the notice is removed when it has ended',
        {duration: '0.3s, 0.3s', easing: 'linear, cubic-bezier(0.4, 0, 0.2, 1)', removedAfterExit: true},
        async () => {
            const m = svc('AuiMessage');
            const a = m.show({message: 'Leaving', duration: 0});
            await sleep(400);
            const el = card(a.id);
            let removedAt = null;
            const t = performance.now();
            const observer = new MutationObserver(() => {
                if (removedAt === null && !document.contains(el)) removedAt = performance.now() - t;
            });
            observer.observe(document.body, {childList: true, subtree: true});
            a.close();
            await until(() => el.classList.contains('aui-message--leaving'), 1000);
            const style = getComputedStyle(el);
            const r = {duration: style.transitionDuration, easing: style.transitionTimingFunction};
            await until(() => removedAt !== null, 1500);
            observer.disconnect();
            r.removedAfterExit = removedAt !== null && removedAt >= 295;
            return r;
        });

    T('AM43 no glide when no notice comes or goes (an update, a hold), nor with reduced motion (the notices stand in their places at once)',
        {update: 0, hold: 0, reduced: 0, reducedEnd: true},
        async () => {
            const m = svc('AuiMessage');
            const a = m.show({message: 'First', duration: 0});
            const b = m.show({message: 'Second', duration: 5000});
            await sleep(400);
            a.update({message: 'First, and a longer message now', title: 'A title'});
            await sleep(30);
            const r = {update: glides(card(b.id))};
            pointer(card(b.id), 'pointerenter');
            await sleep(30);
            r.hold = glides(card(b.id));
            pointer(card(b.id), 'pointerleave');
            const real = window.matchMedia;
            window.matchMedia = q => /reduced-motion/.test(q) ? {matches: true, media: q} : real.call(window, q);
            try {
                const to = card(a.id).getBoundingClientRect().top;
                a.close();
                await until(() => !card(a.id), 1500);
                r.reduced = glides(card(b.id));
                r.reducedEnd = Math.abs(card(b.id).getBoundingClientRect().top - to) < 1;
            } finally {
                window.matchMedia = real;
            }
            await clearToasts();
            return r;
        });

    T('MR99 no Angular errors other than the ones thrown on purpose',
        {errors: []},
        async () => ({errors: window.__ngErrors.slice()}));

    AuiTest.run('aui-* family: message box and toasts, round checks', tests, {delay: 0});
})();
