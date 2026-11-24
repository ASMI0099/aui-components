// Services suite (page: services.html, fixture: services.fixture.js): the message services AuiMessage, AuiMessageBox,
// AuiModal with their hosts (all in the library script, the page loads nothing else of them):
// - aui-components.js alone brings them: the hosts mounted once, the services on window too;
// - AuiSafeHtml: a message with useHtml keeps its formatting and loses all that could run code or load content;
// - a message box and a toast with useHtml show the safe HTML only, and nothing of the rest runs;
// - closing a message box, or a dialog of AuiModal.open, costs the page the close's own two digests and none only to
//   tidy up; a dialog opened while another is open still waits and opens next; a toast's enter animation costs none;
// - a toast: updated, its countdown and bar start over together; updated while it leaves, it comes back; held just
//   as its time ran out, it leaves with the pointer; no digest of the page for it; usable over an open dialog.
(function () {
    const {sleep} = AuiTest;
    const svc = name => angular.element(document.body).injector().get(name);
    const digestsSince = t => window.__digests.filter(x => x >= t).length;
    const titles = () => Array.from(document.querySelectorAll('aui-modal-host .aui-imperative-modal__title')).map(e => e.textContent.trim());
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    const HTML = [
        ['<b>Bold</b> and <i>it</i><br><span style="color: red; position: fixed">red</span>',
            '<b>Bold</b> and <i>it</i><br><span style="color: red">red</span>'],
        ['<img src="x" onerror="window.__xss = 1">text', 'text'],
        ['<script>window.__xss = 2</script>after', 'after'],
        ['<a href="javascript:window.__xss = 3">x</a><a href=" JaVaScRiPt:window.__xss = 4">y</a><a href="data:text/html,x">z</a>',
            '<a>x</a><a>y</a><a>z</a>'],
        ['<a href="https://example.com/p" target="_blank" onclick="window.__xss = 5">link</a>',
            '<a href="https://example.com/p" target="_blank" rel="noopener noreferrer">link</a>'],
        ['<svg><script>window.__xss = 6</script><a href="https://example.com">s</a></svg>ok', 'ok'],
        ['<table class="table"><tr><td colspan="2" onmouseover="window.__xss = 7">cell</td></tr></table>',
            '<table class="table"><tbody><tr><td colspan="2">cell</td></tr></tbody></table>'],
        ['<custom-tag data-x="1">kept text</custom-tag><!-- a note -->', 'kept text'],
        ['<style>body { display: none }</style><p title="t">p</p>', '<p title="t">p</p>'],
        ['<div style="background-image: url(x); color: blue">d</div>', '<div style="color: blue">d</div>'],
        ['<a href="/relative/path">r</a>', '<a href="ORIGIN/relative/path">r</a>'],
        ['<iframe src="https://example.com"></iframe><form action="/x"><input name="a"><button>b</button></form>z', 'z'],
        ['text with &lt;b&gt; escaped &amp; kept', 'text with &lt;b&gt; escaped &amp; kept'],
        ['<p onclick="window.__xss = 8" style="font-weight: bold; text-align: center">p2</p>',
            '<p style="font-weight: bold; text-align: center">p2</p>'],
        [null, ''],
        ['<math><mi xlink:href="javascript:window.__xss = 9">m</mi></math><noscript><p title="</noscript><img src=x onerror=window.__xss=10>">n</p></noscript>end', 'end']
    ];

    T('S0 aui-components.js alone brings the services: their three hosts are mounted once in the body, and window.AuiMessage, window.AuiMessageBox and window.AuiModal are the services',
        {hosts: [1, 1, 1], globals: [true, true, true]},
        async () => ({
            hosts: ['aui-message-host', 'aui-message-box-host', 'aui-modal-host'].map(tag => document.body.querySelectorAll(tag).length),
            globals: ['AuiMessage', 'AuiMessageBox', 'AuiModal'].map(name => window[name] === svc(name))
        }));

    T('S1 AuiSafeHtml: formatting, tables and safe links kept; scripts, event handlers, unsafe links, images, svg, math, forms, styles and unknown tags removed; nothing runs',
        {out: HTML.map(x => x[1]), ran: null},
        async () => {
            const safe = svc('AuiSafeHtml');
            const out = HTML.map(x => safe.sanitize(x[0]).split(location.origin).join('ORIGIN'));
            await sleep(200);
            return {out, ran: window.__xss === undefined ? null : window.__xss};
        });

    T('S2 a message box and a toast with useHtml show the safe HTML only, and nothing else of it runs',
        {box: '<b>bold</b> text', toast: '<i>it</i>', ran: null},
        async () => {
            svc('AuiMessageBox').show({title: 'HTML', useHtml: true,
                message: '<img src="x" onerror="window.__xss = 11"><b>bold</b> text<script>window.__xss = 12</script>'});
            svc('AuiMessage').show({useHtml: true, duration: 0, message: '<i>it</i><img src="x" onerror="window.__xss = 13">'});
            await sleep(600);
            const box = document.querySelector('aui-message-box-host .aui-message-box__content');
            const toast = document.querySelector('.aui-message .aui-message__content');
            const r = {box: box ? box.innerHTML.trim() : null, toast: toast ? toast.innerHTML.trim() : null};
            svc('$rootScope').$apply(() => { svc('AuiMessageBox')._cancelCurrent(); svc('AuiMessage').clearAll(); });
            await sleep(700);
            r.ran = window.__xss === undefined ? null : window.__xss;
            return r;
        });

    T('S3 a message box closed with its button costs the page two digests (none only to remove the box); its promise has the answer',
        {digests: 2, answer: true, gone: true},
        async () => {
            let answer = null;
            svc('AuiMessageBox').confirm('Delete these records?', {title: 'Delete'}).then(v => { answer = v; });
            await sleep(700);
            const buttons = document.querySelectorAll('aui-message-box-host .aui-message-box__actions aui-button button');
            const t = performance.now();
            buttons[buttons.length - 1].click();
            await sleep(700);
            return {digests: digestsSince(t), answer, gone: !document.querySelector('aui-message-box-host dialog')};
        });

    T('S4 a dialog of AuiModal.open closed with Cancel costs the page two digests (none only to look at an empty queue); onCancel ran, its promise says cancel',
        {digests: 2, reason: 'cancel', onCancel: 1, gone: true},
        async () => {
            let reason = null;
            let cancels = 0;
            svc('AuiModal').open({title: 'Dialog', content: 'Body', onCancel: () => { cancels += 1; }}).then(r => { reason = r.reason; });
            await sleep(700);
            const cancel = document.querySelector('aui-modal-host .aui-imperative-modal__footer aui-button button');
            const t = performance.now();
            cancel.click();
            await sleep(700);
            return {digests: digestsSince(t), reason, onCancel: cancels, gone: !document.querySelector('aui-modal-host dialog')};
        });

    T('S5 a dialog opened while another is open waits for it, and opens right after it has closed',
        {first: 'A', waiting: true, next: 'B', open: true, firstReason: 'close'},
        async () => {
            const modal = svc('AuiModal');
            let firstReason = null;
            modal.open({title: 'A', content: 'A'}).then(r => { firstReason = r.reason; });
            await sleep(600);
            modal.open({title: 'B', content: 'B'});
            await sleep(300);
            const first = titles()[0];
            const waiting = titles().indexOf('B') < 0;
            document.querySelector('aui-modal-host .aui-imperative-modal__close').click();
            await sleep(900);
            const next = titles()[0];
            const open = !!document.querySelector('aui-modal-host dialog[open]');
            document.querySelector('aui-modal-host .aui-imperative-modal__close').click();
            await sleep(700);
            return {first, waiting, next, open, firstReason};
        });

    T('S6 a toast: its enter animation costs the page no digest; it still leaves and goes on time',
        {shown: true, digestsWhileShown: 0, gone: true},
        async () => {
            svc('AuiMessage').info('Saved', {duration: 900});
            await sleep(120);
            const shown = !!document.querySelector('.aui-message');
            const t = performance.now();
            await sleep(500);
            const digestsWhileShown = digestsSince(t);
            await sleep(900);
            return {shown, digestsWhileShown, gone: !document.querySelector('.aui-message')};
        });

    // when a message began to leave (from t), and how much of its bar was left: now (scale) and as it began to leave
    const watchMessage = (t) => {
        const seen = {leaving: null, scale: null, scaleAtLeaving: null};
        const timer = setInterval(() => {
            if (seen.leaving !== null) return;
            if (document.querySelector('.aui-message--leaving')) {
                seen.leaving = performance.now() - t;
                seen.scaleAtLeaving = seen.scale;
                return;
            }
            const bar = document.querySelector('.aui-message__progress');
            const m = bar ? /matrix\(([-\d.e]+)/.exec(getComputedStyle(bar).transform) : null;
            if (m) seen.scale = Number(m[1]);
        }, 10);
        seen.stop = () => clearInterval(timer);
        return seen;
    };

    T('S7 a message updated with a duration starts its countdown over, its bar with it (drawn again from full): the bar still runs 600 ms later and is out as the message leaves, with the new text',
        {barRedrawn: true, text: 'second', barStillRunning: true, leftOnTime: true, barOutAtLeaving: true},
        async () => {
            const handle = svc('AuiMessage').info('first', {duration: 1000});
            await sleep(500);
            const bar1 = document.querySelector('.aui-message__progress');
            const t = performance.now();
            const seen = watchMessage(t);
            handle.update({message: 'second', duration: 1000});
            await sleep(50);
            const bar2 = document.querySelector('.aui-message__progress');
            const text = document.querySelector('.aui-message .aui-message__content').textContent.trim();
            await sleep(550);
            const scaleAt600 = seen.scale;
            await sleep(900);
            seen.stop();
            await sleep(300);
            return {barRedrawn: !!bar2 && bar1 !== bar2, text,
                barStillRunning: scaleAt600 !== null && scaleAt600 > 0.25 && scaleAt600 < 0.6,
                leftOnTime: seen.leaving !== null && seen.leaving > 900 && seen.leaving < 1250,
                barOutAtLeaving: seen.scaleAtLeaving !== null && seen.scaleAtLeaving < 0.1};
        });

    T('S8 a message updated while it leaves comes back, with the new text and its whole time; on-close runs once, when it is gone at last',
        {back: true, text: 'again', closesWhileBack: 0, gone: true, closes: 1},
        async () => {
            let closes = 0;
            const handle = svc('AuiMessage').info('first', {duration: 300, onClose: () => { closes += 1; }});
            const t = performance.now();
            while (!document.querySelector('.aui-message--leaving') && performance.now() - t < 1500) await sleep(10);
            handle.update({message: 'again', duration: 700});
            await sleep(400);     // past its 300 ms exit
            const box = document.querySelector('.aui-message');
            const back = !!box && !box.classList.contains('aui-message--leaving');
            const text = box ? box.querySelector('.aui-message__content').textContent.trim() : null;
            const closesWhileBack = closes;
            await sleep(900);
            return {back, text, closesWhileBack, gone: !document.querySelector('.aui-message'), closes};
        });

    T('S9 a message held by the pointer just as its time ran out (the page busy, its timer not come yet) leaves as the pointer leaves, not after its whole time again',
        {leftAtOnce: true},
        async () => {
            const M = svc('AuiMessage');
            M.info('busy page', {duration: 300});
            await sleep(30);
            const list = M.state['top-right'];
            const item = list[list.length - 1];
            const box = document.querySelector('.aui-message[data-aui-message-id="' + item.id + '"]');
            const until = performance.now() + 400;
            while (performance.now() < until) { /* the page busy past the message's time */ }
            box.dispatchEvent(new MouseEvent('mouseenter'));
            await sleep(100);
            box.dispatchEvent(new MouseEvent('mouseleave'));
            await sleep(60);
            const leftAtOnce = item.state !== 'visible';
            await sleep(400);
            return {leftAtOnce};
        });

    T('S10 a message costs the page no digest: its showing, its countdown, the pointer on it, its leaving; with on-close, one (for that page code)',
        {plain: 0, withOnClose: 1, pointer: 0},
        async () => {
            const M = svc('AuiMessage');
            let t = performance.now();
            M.info('plain', {duration: 300});
            await sleep(700);
            const plain = digestsSince(t);
            t = performance.now();
            M.info('with on-close', {duration: 300, onClose: () => { }});
            await sleep(700);
            const withOnClose = digestsSince(t);
            M.info('pointer', {duration: 3000});
            await sleep(60);
            const box = document.querySelector('.aui-message:not(.aui-message--leaving)');
            t = performance.now();
            box.dispatchEvent(new MouseEvent('mouseenter'));
            await sleep(60);
            box.dispatchEvent(new MouseEvent('mouseleave'));
            await sleep(60);
            const pointer = digestsSince(t);
            M.clearAll();
            await sleep(400);
            return {plain, withOnClose, pointer};
        });

    T('S11 a toast while a dialog is open is inside the dialog (outside it everything is inert): the pointer reaches it and its close button, it looks the same; back in its own place once the dialog has closed',
        {inDialog: true, hit: true, closeHit: true, sameLook: true, backHome: true, hitAfter: true},
        async () => {
            const M = svc('AuiMessage');
            const look = el => { const s = getComputedStyle(el); return [s.fontSize, s.fontWeight, s.lineHeight, s.color, s.backgroundColor, s.width, s.textAlign, s.letterSpacing, s.fontFamily].join('|'); };
            const hitsAt = (el, sel) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(top && top.closest(sel) === el); };
            M.info('outside', {duration: 0});
            await sleep(100);
            const lookOut = look(document.querySelector('.aui-message'));
            M.clearAll();
            await sleep(400);
            const modal = svc('AuiModal').open({title: 'Dialog', content: 'body'});
            await sleep(700);
            M.info('over the dialog', {duration: 0});
            await sleep(150);
            const host = document.querySelector('.aui-message-host');
            const openDialog = document.querySelector('aui-modal-host dialog[open]');
            const box = document.querySelector('.aui-message');
            const r = {inDialog: !!openDialog && openDialog.contains(host), hit: hitsAt(box, '.aui-message'),
                closeHit: hitsAt(box.querySelector('.aui-message__close'), '.aui-message__close'), sameLook: look(box) === lookOut};
            modal.close();
            await sleep(800);
            r.backHome = document.querySelector('aui-message-host').contains(host) && host.matches(':popover-open');
            r.hitAfter = hitsAt(document.querySelector('.aui-message'), '.aui-message');
            M.clearAll();
            await sleep(400);
            return r;
        });

    T('S13 a toast never comes in twice when its host moves: shown while a confirm box closes (it moves out of the box as the box goes), and fully in when a box opens and closes - its look never falls back once in',
        {closing: {cameIn: true, fellBack: false}, settled: {fellBack: false}},
        async () => {
            const M = svc('AuiMessage');
            const B = svc('AuiMessageBox');
            // the least opacity of the newest toast, every frame for ms, after it first came in (0.95)
            const watch = ms => new Promise(done => {
                const t0 = performance.now();
                let inAt = false;
                let least = 1;
                const tick = () => {
                    const all = document.querySelectorAll('.aui-message');
                    const el = all[all.length - 1];
                    const op = el ? Number(getComputedStyle(el).opacity) : 0;
                    if (op >= 0.95) inAt = true;
                    else if (inAt) least = Math.min(least, op);
                    if (performance.now() - t0 < ms) requestAnimationFrame(tick);
                    else done({cameIn: inAt, fellBack: least < 0.9});
                };
                requestAnimationFrame(tick);
            });
            B.confirm('Delete it?', {title: 'Delete'}).then(ok => { if (ok) setTimeout(() => M.success('Deleted', {duration: 0}), 40); });
            await sleep(700);
            const buttons = document.querySelectorAll('aui-message-box-host .aui-message-box__actions aui-button button');
            buttons[buttons.length - 1].click();
            const closing = await watch(1200);
            B.alert('Another box');
            await sleep(600);
            const close = document.querySelectorAll('aui-message-box-host .aui-message-box__actions aui-button button');
            const watching = watch(900);
            close[close.length - 1].click();
            const settled = await watching;
            M.clearAll();
            await sleep(400);
            return {closing, settled: {fellBack: settled.fellBack}};
        });

    T('S12 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('aui-* family: the message services', tests);
})();
