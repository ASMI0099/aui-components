// Popover suite (page: popover.html, fixture: popover.fixture.js): aui-popover as pages use it:
// - closed: nothing of its card on the page, its trigger named for the keyboard and assistive technology;
// - opening: the trigger's click, Enter and Space (the focus goes into the card then), is-open, api.open(); on-open
//   once, and false from it cancels; the card in the top layer, under the trigger's start, never drawn anywhere else
//   first; open from the start;
// - closing: the trigger, Cancel, Confirm (false from on-confirm keeps it open), Escape (its default prevented, the
//   focus back on the trigger), a press outside or the focus moving out (not with close-on-click-outside="false"),
//   another popover opening, is-open, api.close(); on-close once each time; the content new at each opening; a click
//   again while it fades opens it;
// - place: the other side without room, inside the screen, centred, to the right, a card too tall scrolls;
// - cost: a click elsewhere runs nothing in the closed ones; a popover without callbacks starts no page digest;
// - its clicks stay in it (a row's own click); an aui-select inside; inside an aui-modal; taken away while open.
(function () {
    const {sleep, key, outside} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const host = id => document.getElementById(id);
    const trig = id => host(id).querySelector('.popover-trigger');
    const card = id => host(id).querySelector('.popover-panel');
    // what is seen of the trigger: its own icon (its 24px target reaches 4px past it), else the trigger
    const seen = id => box(trig(id).querySelector('.aui-popover__icon') || trig(id));
    const body = id => card(id).querySelector('.aui-popover__body');
    const isOpen = id => card(id).classList.contains('aui-popover__panel--in') && getComputedStyle(card(id)).display !== 'none';
    const isGone = id => getComputedStyle(card(id)).display === 'none' && !body(id) && !card(id).matches(':popover-open');
    const count = what => scope().log.filter(x => x === what).length;
    const clearLog = () => { scope().log.length = 0; };
    const digestsSince = t => window.__digests.filter(x => x >= t).length;
    const box = el => el.getBoundingClientRect();
    const near = (a, b, by) => Math.abs(a - b) <= (by === undefined ? 1 : by);
    /** A press as a pointer sends it: pointerdown, mousedown, and the focus to what takes it (unless the press's default is prevented). */
    const press = el => {
        el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
        const down = new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0, detail: 1});
        el.dispatchEvent(down);
        const takes = el.closest('button, input, a[href], [tabindex]');
        if (takes && !down.defaultPrevented) takes.focus();
    };
    // a click as a pointer sends it: the press, its release, its click (detail 1: a click without a press, detail 0, is the keyboard's)
    const click = el => {
        press(el);
        el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, cancelable: true, button: 0, detail: 1}));
        el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, detail: 1}));
    };
    const footerButtons = id => Array.from(card(id).querySelectorAll('.aui-popover__footer aui-button button'));
    const OPEN_MS = 350;
    const CLOSE_MS = 300;
    const openIt = async id => { click(trig(id)); await sleep(OPEN_MS); };
    const closeIt = async id => { if (isOpen(id)) click(trig(id)); await sleep(CLOSE_MS); };

    const tests = [];
    const T = (name, expect, fn, extra) => tests.push(Object.assign({name, expect, fn}, extra || {}));

    T('P0 is-open true when the page loads: open at once, on its own content, without taking the focus; closed by the page',
        {open: true, body: true, topLayer: true, focusInCard: false, closed: true},
        async () => {
            await sleep(OPEN_MS);
            const out = {open: isOpen('p-start'), body: !!document.getElementById('start-body'), topLayer: card('p-start').matches(':popover-open'),
                focusInCard: card('p-start').contains(document.activeElement)};
            apply(s => { s.open.start = false; });
            await sleep(CLOSE_MS);
            out.closed = isGone('p-start');
            return out;
        });

    T('P1 closed: no card on the page and no content built; the class names pages select; the edit icon is a button for the keyboard (named, says it opens a dialog); a control of the page\'s own in the trigger says so itself',
        {classes: true, gone: true, role: 'button', tab: '0', popup: 'dialog', expanded: 'false', label: 'Edit', controls: true, icon: true,
            own: {wrapperTab: null, wrapperRole: null, popup: 'dialog', expanded: 'false'}},
        async () => {
            const t = trig('p-default');
            const keep = document.getElementById('keep-box');
            return {
                classes: !!host('p-default').querySelector('.popover-container > .popover-trigger') && !!host('p-default').querySelector('.popover-container > .popover-panel'),
                gone: isGone('p-default'), role: t.getAttribute('role'), tab: t.getAttribute('tabindex'), popup: t.getAttribute('aria-haspopup'),
                expanded: t.getAttribute('aria-expanded'), label: t.getAttribute('aria-label'), controls: t.getAttribute('aria-controls') === card('p-default').id,
                icon: !!t.querySelector('svg.aui-popover__icon'),
                own: {wrapperTab: trig('p-keep').getAttribute('tabindex'), wrapperRole: trig('p-keep').getAttribute('role'),
                    popup: keep.getAttribute('aria-haspopup'), expanded: keep.getAttribute('aria-expanded')}
            };
        });

    T('P2 the trigger\'s click opens: on-open once; the card in the top layer, 4px under the trigger\'s icon (its target\'s edge), its start on the trigger\'s; named by its title; Cancel and Confirm; the focus in its first text box',
        {onOpen: 1, open: true, topLayer: true, expanded: 'true', containerOpen: true, labelled: true, footer: ['Cancel', 'Confirm'], below: true, start: true,
            focusInBox: true},
        async () => {
            clearLog();
            await openIt('p-default');
            const t = box(trig('p-default')), p = box(card('p-default'));
            const title = card('p-default').querySelector('.aui-popover__title');
            const out = {
                onOpen: count('open default'), open: isOpen('p-default'), topLayer: card('p-default').matches(':popover-open'),
                expanded: trig('p-default').getAttribute('aria-expanded'),
                containerOpen: host('p-default').querySelector('.popover-container').classList.contains('open'),
                labelled: !!title && card('p-default').getAttribute('aria-labelledby') === title.id && title.textContent.trim() === 'Edit the price',
                footer: footerButtons('p-default').map(b => b.textContent.trim()),
                below: near(p.top - seen('p-default').bottom, 4), start: near(p.left, t.left),
                focusInBox: document.activeElement === document.getElementById('default-box')
            };
            await closeIt('p-default');
            return out;
        });

    T('P3 the trigger\'s click closes: on-close once, the card gone after its fade, its content with it; the next opening builds the content again',
        {onClose: 1, expanded: 'false', gone: true, typed: 'abc', fresh: ''},
        async () => {
            clearLog();
            await openIt('p-default');
            document.getElementById('default-box').value = 'abc';
            const typed = document.getElementById('default-box').value;
            click(trig('p-default'));
            await sleep(CLOSE_MS);
            const out = {onClose: count('close default'), expanded: trig('p-default').getAttribute('aria-expanded'), gone: isGone('p-default'), typed};
            await openIt('p-default');
            out.fresh = document.getElementById('default-box').value;
            await closeIt('p-default');
            return out;
        });

    T('P4 opening: the card is never drawn anywhere but at its place (every frame it shows, it is within a few pixels of where it ends)',
        {frames: true, within: true},
        async () => {
            const seen = [];
            let on = true;
            (function tick() {
                if (!on) return;
                const p = card('p-default');
                if (Number(getComputedStyle(p).opacity) > 0.02 && getComputedStyle(p).display !== 'none') seen.push([box(p).left, box(p).top]);
                requestAnimationFrame(tick);
            })();
            click(trig('p-default'));
            await sleep(OPEN_MS + 100);
            on = false;
            const end = box(card('p-default'));
            const out = {frames: seen.length > 2, within: seen.every(f => near(f[0], end.left, 8) && near(f[1], end.top, 8))};
            await closeIt('p-default');
            return out;
        }, {timing: true});

    T('P5 a click again while it fades out opens it again (no click is lost)',
        {open: true, onOpen: 2, onClose: 1},
        async () => {
            clearLog();
            await openIt('p-default');
            click(trig('p-default'));
            await sleep(60);
            click(trig('p-default'));
            await sleep(OPEN_MS);
            const out = {open: isOpen('p-default'), onOpen: count('open default'), onClose: count('close default')};
            await closeIt('p-default');
            return out;
        });

    T('P6 the card\'s own footer: Cancel closes without on-confirm; Confirm with false from on-confirm keeps it open; Confirm closes, the focus back on the trigger',
        {afterCancel: {gone: true, confirms: 0, closes: 1}, kept: {open: true, confirms: 1, closes: 1}, afterConfirm: {gone: true, confirms: 2, closes: 2, focusOnTrigger: true}},
        async () => {
            clearLog();
            await openIt('p-default');
            click(footerButtons('p-default')[0]);
            await sleep(CLOSE_MS);
            const afterCancel = {gone: isGone('p-default'), confirms: count('confirm default'), closes: count('close default')};
            await openIt('p-default');
            scope().allow.confirm = false;
            click(footerButtons('p-default')[1]);
            await sleep(CLOSE_MS);
            const kept = {open: isOpen('p-default'), confirms: count('confirm default'), closes: count('close default')};
            scope().allow.confirm = true;
            click(footerButtons('p-default')[1]);
            await sleep(CLOSE_MS);
            const afterConfirm = {gone: isGone('p-default'), confirms: count('confirm default'), closes: count('close default'),
                focusOnTrigger: document.activeElement === trig('p-default')};
            return {afterCancel, kept, afterConfirm};
        });

    T('P7 false from on-open cancels the opening: no card, nothing built, the trigger as closed',
        {onOpen: 1, gone: true, expanded: 'false', onClose: 0},
        async () => {
            clearLog();
            scope().allow.open = false;
            await openIt('p-default');
            const out = {onOpen: count('open default'), gone: isGone('p-default'), expanded: trig('p-default').getAttribute('aria-expanded'), onClose: count('close default')};
            scope().allow.open = true;
            return out;
        });

    T('P8 Escape: closes it, its default prevented; from inside the card the focus goes back to the trigger; a held key and a closed popover use no key',
        {onTrigger: {gone: true, prevented: true}, closedUnused: false, fromCard: {gone: true, focusOnTrigger: true}, held: {open: true, prevented: true}},
        async () => {
            await openIt('p-default');
            let e = key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            const onTrigger = {gone: isGone('p-default'), prevented: e.defaultPrevented};
            const closedUnused = key(trig('p-default'), 'Escape').defaultPrevented;
            await openIt('p-default');
            document.getElementById('default-box').focus();
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            const fromCard = {gone: isGone('p-default'), focusOnTrigger: document.activeElement === trig('p-default')};
            await openIt('p-default');
            e = key(trig('p-default'), 'Escape', {repeat: true});
            await sleep(CLOSE_MS);
            const held = {open: isOpen('p-default'), prevented: e.defaultPrevented};
            await closeIt('p-default');
            return {onTrigger, closedUnused, fromCard, held};
        });

    T('P9 keyboard: Enter and Space on the trigger open it and the focus goes into the card; a held key opens nothing; Enter on a read-only box in the trigger opens it, the box says so; a button of the page\'s own in the trigger (its click without a press) moves the focus into the card too',
        {enter: {open: true, focusInCard: true, prevented: true}, afterEscape: true, space: true, held: false, readonly: {open: true, expanded: 'true'},
            ownButton: {open: true, focusInCard: true, focusBack: true}},
        async () => {
            const t = trig('p-default');
            t.focus();
            let e = key(t, 'Enter');
            await sleep(OPEN_MS);
            const enter = {open: isOpen('p-default'), focusInCard: card('p-default').contains(document.activeElement), prevented: e.defaultPrevented};
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            const afterEscape = document.activeElement === t && isGone('p-default');
            key(t, ' ');
            await sleep(OPEN_MS);
            const space = isOpen('p-default');
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            key(t, 'Enter', {repeat: true});
            await sleep(OPEN_MS);
            const held = isOpen('p-default');
            await closeIt('p-default');
            const keep = document.getElementById('keep-box');
            keep.focus();
            key(keep, 'Enter');
            await sleep(OPEN_MS);
            const readonly = {open: isOpen('p-keep'), expanded: keep.getAttribute('aria-expanded')};
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            const own = document.getElementById('bound-trigger');
            own.focus();
            own.click();   // Enter on a button: its click, detail 0
            await sleep(OPEN_MS);
            const ownButton = {open: isOpen('p-bound'), focusInCard: document.activeElement === card('p-bound')};
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            ownButton.focusBack = document.activeElement === own;
            return {enter, afterEscape, space, held, readonly, ownButton};
        });

    T('P10 outside: a press elsewhere closes it (on-close once), a press in the card does not, the focus moving to another control closes it; with close-on-click-outside="false" neither does',
        {press: {gone: true, closes: 1}, inside: true, focusOut: true, kept: {afterPress: true, afterFocus: true, closes: 0}},
        async () => {
            clearLog();
            await openIt('p-custom');
            outside();
            await sleep(CLOSE_MS);
            const pressed = {gone: isGone('p-custom'), closes: count('close custom')};
            await openIt('p-custom');
            press(document.getElementById('custom-inner'));
            await sleep(CLOSE_MS);
            const inside = isOpen('p-custom');
            document.getElementById('bound-trigger').focus();
            await sleep(CLOSE_MS);
            const focusOut = isGone('p-custom');
            await openIt('p-keep');
            outside();
            await sleep(CLOSE_MS);
            const afterPress = isOpen('p-keep');
            document.getElementById('bound-trigger').focus();
            await sleep(CLOSE_MS);
            const kept = {afterPress, afterFocus: isOpen('p-keep'), closes: count('close keep')};
            await closeIt('p-keep');
            document.activeElement.blur();
            return {press: pressed, inside, focusOut, kept};
        });

    T('P11 another popover\'s trigger: the open one closes, the other opens',
        {first: true, firstGone: true, second: true},
        async () => {
            await openIt('p-custom');
            const first = isOpen('p-custom');
            await openIt('p-default');
            const out = {first, firstGone: isGone('p-custom'), second: isOpen('p-default')};
            await closeIt('p-default');
            return out;
        });

    T('P12 is-open: the page opens it (on-open once) and closes it (on-close once); opened and closed by the user, the page\'s value follows: in the card from its first frame, on the rest of the page a frame later; false from on-open gives the page its false back',
        {byPage: {open: true, onOpen: 1}, closedByPage: {gone: true, onClose: 1}, byUser: {inCard: 'true', open: true, page: 'true'},
            closedByUser: {page: 'false', gone: true}, refused: {gone: true, value: false}},
        async () => {
            clearLog();
            apply(s => { s.open.bound = true; });
            await sleep(OPEN_MS);
            const byPage = {open: isOpen('p-bound'), onOpen: count('open bound')};
            apply(s => { s.open.bound = false; });
            await sleep(CLOSE_MS);
            const closedByPage = {gone: isGone('p-bound'), onClose: count('close bound')};
            const pageValue = () => document.getElementById('bound-value').textContent;
            click(document.getElementById('bound-trigger'));
            const inCard = document.getElementById('bound-in-card').textContent;
            await sleep(120);
            const byUser = {inCard, open: isOpen('p-bound'), page: pageValue()};
            await sleep(OPEN_MS);
            click(document.getElementById('bound-trigger'));
            await sleep(120);
            const closedByUser = {page: pageValue()};
            await sleep(CLOSE_MS);
            closedByUser.gone = isGone('p-bound');
            scope().allow.open = false;
            apply(s => { s.open.bound = true; });
            await sleep(OPEN_MS);
            const refused = {gone: isGone('p-bound'), value: scope().open.bound};
            scope().allow.open = true;
            return {byPage, closedByPage, byUser, closedByUser, refused};
        });

    T('P13 api: close() on a closed popover leaves it closed; open() opens (a second one changes nothing), close() closes, in a digest of the page or outside one',
        {closeOnClosed: true, opened: {open: true, onOpen: 1}, openAgain: 1, closed: true, outsideDigest: {open: true, gone: true}},
        async () => {
            clearLog();
            const api = scope().api.bound;
            apply(() => api.close());
            await sleep(OPEN_MS);
            const closeOnClosed = isGone('p-bound');
            apply(() => api.open());
            await sleep(OPEN_MS);
            const opened = {open: isOpen('p-bound'), onOpen: count('open bound')};
            apply(() => api.open());
            await sleep(100);
            const openAgain = count('open bound');
            apply(() => api.close());
            await sleep(CLOSE_MS);
            const closed = isGone('p-bound');
            api.open();
            await sleep(OPEN_MS);
            const open = isOpen('p-bound');
            api.close();
            await sleep(CLOSE_MS + 200);
            return {closeOnClosed, opened, openAgain, closed, outsideDigest: {open, gone: isGone('p-bound')}};
        });

    T('P14 cost: a press elsewhere with every popover closed runs no on-close and no digest of the page; a popover without callbacks opens and closes without one; one with on-close owes the page one each time',
        {elsewhere: {digests: 0, closes: 0}, plain: 0, withOnClose: 2},
        async () => {
            clearLog();
            await sleep(400);
            let t0 = performance.now();
            outside();
            await sleep(400);
            const elsewhere = {digests: digestsSince(t0), closes: scope().log.length};
            t0 = performance.now();
            await openIt('p-center');
            await sleep(200);
            await closeIt('p-center');
            await sleep(200);
            const plain = digestsSince(t0);
            t0 = performance.now();
            await openIt('p-custom');
            await sleep(200);
            await closeIt('p-custom');
            await sleep(200);
            return {elsewhere, plain, withOnClose: digestsSince(t0)};
        });

    T('P15 a click on the trigger, in the card, on Cancel goes no further up the page (a row with its own click); a click on the row itself does',
        {fromPopover: 0, fromRow: 1},
        async () => {
            const before = scope().rowClicks;
            await openIt('p-default');
            click(document.getElementById('default-box'));
            click(footerButtons('p-default')[0]);
            await sleep(CLOSE_MS);
            const fromPopover = scope().rowClicks - before;
            document.getElementById('row').click();
            return {fromPopover, fromRow: scope().rowClicks - before};
        });

    T('P16 place: above without room below; inside the screen at its right edge; placement="bottom-center" centred; to the right with right-start; a card taller than the screen scrolls inside it',
        {low: {above: true, side: true}, edge: {inside: true, whole: true}, centre: true, right: {beside: true, top: true}, tall: {scrolls: true, inside: true}},
        async () => {
            const view = {w: document.documentElement.clientWidth, h: document.documentElement.clientHeight};
            await openIt('p-low');
            let t = box(trig('p-low')), p = box(card('p-low'));
            const low = {above: near(seen('p-low').top - p.bottom, 4), side: card('p-low').getAttribute('data-side') === 'top'};
            await closeIt('p-low');
            await openIt('p-edge');
            p = box(card('p-edge'));
            const edge = {inside: p.right <= view.w - 8 + 0.5, whole: p.width >= 300};
            await closeIt('p-edge');
            await openIt('p-center');
            t = box(trig('p-center'));
            p = box(card('p-center'));
            const centre = near((p.left + p.right) / 2, (t.left + t.right) / 2);
            await closeIt('p-center');
            await openIt('p-right');
            t = box(trig('p-right'));
            p = box(card('p-right'));
            const right = {beside: near(p.left - seen('p-right').right, 4), top: near(p.top, t.top)};
            await closeIt('p-right');
            await openIt('p-tall');
            p = box(card('p-tall'));
            const c = card('p-tall');
            const tall = {scrolls: c.classList.contains('aui-popover__panel--scroll') && c.scrollHeight > c.clientHeight,
                inside: p.top >= 8 - 0.5 && p.bottom <= view.h - 8 + 0.5};
            await closeIt('p-tall');
            return {low, edge, centre, right, tall};
        });

    T('P17 an aui-select in the card: its list opens over the card, a press in the list keeps the card; Escape closes the list first, then the card',
        {listOpen: true, afterPress: true, afterFirstEscape: {list: false, card: true}, afterSecondEscape: true},
        async () => {
            await openIt('p-select');
            // the select's own trigger takes the focus, as with a real click on it
            const openList = async () => { const t = host('in-select').querySelector('.aui-select__trigger'); t.focus(); t.click(); await sleep(300); };
            await openList();
            const listOpen = !!host('in-select').querySelector('.aui-select__panel--open');
            press(host('in-select').querySelector('.aui-select__option'));
            await sleep(CLOSE_MS);
            const afterPress = isOpen('p-select');
            if (!host('in-select').querySelector('.aui-select__panel--open')) await openList();
            key(document.activeElement, 'Escape');
            await sleep(400);
            const afterFirstEscape = {list: !!host('in-select').querySelector('.aui-select__panel--open'), card: isOpen('p-select')};
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            const afterSecondEscape = isGone('p-select');
            return {listOpen, afterPress, afterFirstEscape, afterSecondEscape};
        });

    T('P18 in an aui-modal: the card is drawn over the dialog; Escape closes the card and the dialog stays',
        {open: true, onTop: true, afterEscape: {card: true, dialog: true, prevented: true}},
        async () => {
            apply(s => { s.modal.open = true; });
            await sleep(500);
            await openIt('p-in-modal');
            const p = box(card('p-in-modal'));
            const at = document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2);
            const out = {open: isOpen('p-in-modal'), onTop: !!at && card('p-in-modal').contains(at)};
            const e = key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            out.afterEscape = {card: isGone('p-in-modal'), dialog: host('m-host').querySelector('dialog').open, prevented: e.defaultPrevented};
            apply(s => { s.modal.open = false; });
            await sleep(500);
            return out;
        });

    T('P19 taken away by the page while open: no on-close afterwards, nothing left in the top layer, a press elsewhere is fine',
        {open: true, onClose: 0, left: 0},
        async () => {
            clearLog();
            await openIt('p-gone');
            const open = isOpen('p-gone');
            apply(s => { s.show.gone = false; });
            await sleep(400);
            outside();
            await sleep(200);
            return {open, onClose: count('close gone'), left: document.querySelectorAll('.popover-panel:popover-open').length};
        });

    T('P20 a label in the trigger (its click sends its box a second one): one press, one toggle',
        {open: true, closed: true},
        async () => {
            const label = document.getElementById('keep-label');
            click(label);
            await sleep(OPEN_MS);
            const open = isOpen('p-keep');
            click(label);
            await sleep(CLOSE_MS);
            return {open, closed: isGone('p-keep')};
        });

    T('P21 the press opens it (not its click, a tenth of a second later), as aui-select does: open after the press alone; its click does not close it again; a press on a read-only box in the trigger focuses that box (Escape then reaches the popover)',
        {afterPress: true, afterItsClick: true, closedByNextPress: true, ownFocused: true, escapeCloses: true},
        async () => {
            const t = trig('p-default');
            press(t);
            const afterPress = card('p-default').classList.contains('aui-popover__panel--shown');
            t.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, button: 0}));
            t.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 1}));
            await sleep(OPEN_MS);
            const afterItsClick = isOpen('p-default');
            click(t);
            await sleep(CLOSE_MS);
            const closedByNextPress = isGone('p-default');
            click(document.getElementById('keep-box'));
            await sleep(OPEN_MS);
            const ownFocused = document.activeElement === document.getElementById('keep-box');
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            return {afterPress, afterItsClick, closedByNextPress, ownFocused, escapeCloses: isGone('p-keep')};
        });

    // the Save button of p-save, its state: waiting (a spinner; it takes no click: aria-disabled, the focus kept) or not
    const saveButton = () => footerButtons('p-save')[1];
    const waiting = () => saveButton().getAttribute('aria-disabled') === 'true' && saveButton().getAttribute('data-loading') === 'true';
    const answer = (how, value) => apply(s => { s.save.deferred[how](value); });

    T('P22 a save that waits: Confirm (confirm-text, cancel-text: its words) waits with a spinner and the card stays; a second Confirm sends nothing; false or a failure: open again as the user left it; true: closed; closed meanwhile, the answer of that opening changes nothing',
        {words: ['Back', 'Save'], afterSave: {open: true, waiting: true, saves: 1, focusInCard: true}, again: 1, falseKept: {open: true, waiting: false, typed: 'x'},
            done: {gone: true, closes: 1}, failed: {open: true, waiting: false}, oldAnswer: {open: true, waiting: false}},
        async () => {
            clearLog();
            await openIt('p-save');
            const words = footerButtons('p-save').map(b => b.textContent.trim());
            document.getElementById('save-box').value = 'x';
            click(saveButton());
            await sleep(100);
            const afterSave = {open: isOpen('p-save'), waiting: waiting(), saves: count('confirm save'), focusInCard: card('p-save').contains(document.activeElement)};
            click(saveButton());
            const again = count('confirm save');
            answer('resolve', false);
            await sleep(100);
            const falseKept = {open: isOpen('p-save'), waiting: waiting(), typed: document.getElementById('save-box').value};
            click(saveButton());
            answer('resolve', true);
            await sleep(CLOSE_MS);
            const done = {gone: isGone('p-save'), closes: count('close save')};
            await openIt('p-save');
            click(saveButton());
            answer('reject', new Error('server'));
            await sleep(100);
            const failed = {open: isOpen('p-save'), waiting: waiting()};
            click(saveButton());
            const first = scope().save.deferred;
            click(footerButtons('p-save')[0]);   // Back, while it saves
            await sleep(CLOSE_MS);
            await openIt('p-save');
            apply(() => first.resolve(true));
            await sleep(100);
            const oldAnswer = {open: isOpen('p-save'), waiting: waiting()};
            await closeIt('p-save');
            return {words, afterSave, again, falseKept, done, failed, oldAnswer};
        });

    T('P23 Enter in a text box of the card confirms (its default prevented); false from on-confirm keeps it; not in a multi-line box or a search box, not with confirm-on-enter="false", not with a footer of the page\'s own',
        {confirmed: {confirms: 1, gone: true, prevented: true}, refused: {confirms: 2, open: true}, textarea: {saves: 0, prevented: false, search: {saves: 0, prevented: false}},
            off: {confirms: 0, open: true, prevented: true}, ownFooter: {open: true, prevented: true}},
        async () => {
            clearLog();
            await openIt('p-default');
            let e = key(document.getElementById('default-box'), 'Enter');
            await sleep(CLOSE_MS);
            const confirmed = {confirms: count('confirm default'), gone: isGone('p-default'), prevented: e.defaultPrevented};
            scope().allow.confirm = false;
            await openIt('p-default');
            key(document.getElementById('default-box'), 'Enter');
            await sleep(100);
            const refused = {confirms: count('confirm default'), open: isOpen('p-default')};
            scope().allow.confirm = true;
            await closeIt('p-default');
            await openIt('p-save');
            e = key(document.getElementById('save-area'), 'Enter');
            const textarea = {saves: count('confirm save'), prevented: e.defaultPrevented};
            e = key(document.getElementById('save-find'), 'Enter');
            textarea.search = {saves: count('confirm save'), prevented: e.defaultPrevented};
            await closeIt('p-save');
            await openIt('p-quiet');
            e = key(document.getElementById('quiet-box'), 'Enter');
            await sleep(100);
            const off = {confirms: count('confirm quiet'), open: isOpen('p-quiet'), prevented: e.defaultPrevented};
            await closeIt('p-quiet');
            await openIt('p-custom');
            e = key(document.getElementById('custom-box'), 'Enter');
            await sleep(100);
            const ownFooter = {open: isOpen('p-custom'), prevented: e.defaultPrevented};
            await closeIt('p-custom');
            return {confirmed, refused, textarea, off, ownFooter};
        });

    T('P24 the first text box takes the focus at an opening from the trigger (the mouse or the keyboard); not with auto-focus="false" (the keyboard: the card), not when the page opens it',
        {mouse: true, key: true, off: {mouse: true, key: true}, byApi: false},
        async () => {
            await openIt('p-save');
            const mouse = document.activeElement === document.getElementById('save-box');
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            key(trig('p-save'), 'Enter');
            await sleep(OPEN_MS);
            const byKey = document.activeElement === document.getElementById('save-box');
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            await openIt('p-quiet');
            const offMouse = document.activeElement === trig('p-quiet');
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            key(trig('p-quiet'), 'Enter');
            await sleep(OPEN_MS);
            const offKey = document.activeElement === card('p-quiet');
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            document.activeElement.blur();
            apply(s => s.api.save.open());
            await sleep(OPEN_MS);
            const byApi = document.activeElement === document.getElementById('save-box');
            apply(s => s.api.save.close());
            await sleep(CLOSE_MS);
            return {mouse, key: byKey, off: {mouse: offMouse, key: offKey}, byApi};
        });

    T('P25 disabled: the trigger does not open it (the mouse, the keyboard), it says so (aria-disabled); the page still can (api); enabled again, it opens',
        {look: {cls: true, aria: 'true'}, mouse: false, key: false, byApi: true, enabled: {open: true, aria: null}},
        async () => {
            const t = trig('p-off');
            const look = {cls: t.classList.contains('aui-popover__trigger--disabled'), aria: t.getAttribute('aria-disabled')};
            click(t);
            await sleep(OPEN_MS);
            const mouse = isOpen('p-off');
            key(t, 'Enter');
            await sleep(OPEN_MS);
            const byKey = isOpen('p-off');
            apply(s => s.api.off.open());
            await sleep(OPEN_MS);
            const byApi = isOpen('p-off');
            apply(s => s.api.off.close());
            await sleep(CLOSE_MS);
            apply(s => { s.flags.off = false; });
            click(t);
            await sleep(OPEN_MS);
            const enabled = {open: isOpen('p-off'), aria: t.getAttribute('aria-disabled')};
            await closeIt('p-off');
            apply(s => { s.flags.off = true; });
            return {look, mouse, key: byKey, byApi, enabled};
        });

    const ownTrigger = id => {
        const t = trig(id);
        return {parts: Array.from(t.children).map(el => (el.tagName === 'svg' ? 'icon' : el.textContent)),
            looks: ['icon', 'labelled', 'link', 'muted', 'text', 'danger'].filter(n => t.classList.contains('aui-popover__trigger--' + n)),
            label: t.getAttribute('aria-label'), title: t.getAttribute('title')};
    };

    T('P26 trigger-icon: each icon its own drawing and its name (aria-label and tooltip, from auiTexts.icons); one not known: the edit icon; an icon alone is muted',
        {names: [['edit', 'Edit'], ['pencil', 'Edit'], ['square-pen', 'Edit'], ['delete', 'Delete'], ['copy', 'Copy'], ['info', 'Information'], ['help', 'Help'],
            ['more', 'More actions'], ['filter', 'Filter'], ['settings', 'Settings'], ['add', 'Add'], ['unknown', 'Edit']], drawings: 11,
            unknownIsEdit: true, looks: ['icon', 'muted']},
        async () => {
            const hosts = Array.from(document.querySelectorAll('#icons [data-icon]'));
            const d = h => h.querySelector('.popover-trigger svg.aui-popover__icon path').getAttribute('d');
            return {
                names: hosts.map(h => [h.getAttribute('data-icon'), h.querySelector('.popover-trigger').getAttribute('aria-label')]),
                drawings: new Set(hosts.map(d)).size,
                unknownIsEdit: d(hosts[hosts.length - 1]) === d(hosts[0]),
                looks: ownTrigger(hosts[0].id || (hosts[0].id = 'icon-edit')).looks
            };
        });

    T('P27 trigger-text: the icon and its text, a link; the text first with trigger-icon-position="end"; show-trigger-text="false": the icon alone, the text its name and tooltip; trigger-tone; a new text redrawn, the open look kept; trigger-icon="none": the text alone',
        {first: {parts: ['icon', 'Change the price'], looks: ['labelled', 'link'], label: null, title: null}, end: ['Change the price', 'icon'],
            hidden: {parts: ['icon'], looks: ['icon', 'muted'], label: 'Change the price', title: 'Change the price'}, tone: ['labelled', 'danger'],
            renamed: {parts: ['icon', 'Edit stock'], open: true}, alone: ['Only text']},
        async () => {
            const first = ownTrigger('p-text');
            apply(s => { s.trig.pos = 'end'; });
            const end = ownTrigger('p-text').parts;
            apply(s => { s.trig.pos = ''; s.trig.show = false; });
            const hidden = ownTrigger('p-text');
            apply(s => { s.trig.show = true; s.trig.tone = 'danger'; });
            const tone = ownTrigger('p-text').looks;
            apply(s => { s.trig.tone = ''; });
            await openIt('p-text');
            apply(s => { s.trig.text = 'Edit stock'; });
            const renamed = {parts: ownTrigger('p-text').parts, open: trig('p-text').classList.contains('aui-popover__trigger--open')};
            await closeIt('p-text');
            apply(s => { s.trig.text = 'Change the price'; });
            return {first, end, hidden, tone, renamed, alone: ownTrigger('p-none').parts};
        });

    T('P28 a delete confirmation: the trigger red (trigger-tone="danger"), its Confirm red (confirm-intent="danger")',
        {trigger: ['labelled', 'danger'], confirm: 'danger', cancel: 'neutral'},
        async () => {
            await openIt('p-danger');
            const out = {trigger: ownTrigger('p-danger').looks, confirm: footerButtons('p-danger')[1].getAttribute('data-intent'),
                cancel: footerButtons('p-danger')[0].getAttribute('data-intent')};
            await closeIt('p-danger');
            return out;
        });

    const hover = (el, type, pointerType) => el.dispatchEvent(new PointerEvent(type, {pointerType: pointerType || 'mouse'}));

    T('P29 trigger-on="hover": the mouse resting on the trigger opens it (not passing over it, not a touch), the focus stays; on its way into the card it stays; leaving both closes it; the focus in the card keeps it; a press on the trigger keeps it open',
        {passing: false, touch: false, rested: {open: true, focusMoved: false}, intoCard: true, left: {gone: true, closes: 1}, focusKeeps: true, pressKeeps: true, hoverNoTooltip: true},
        async () => {
            clearLog();
            const t = trig('p-hover');
            hover(t, 'pointerenter');
            await sleep(80);
            hover(t, 'pointerleave');
            await sleep(300);
            const passing = isOpen('p-hover');
            hover(t, 'pointerenter', 'touch');
            await sleep(300);
            const touch = isOpen('p-hover');
            hover(t, 'pointerenter');
            await sleep(500);
            const rested = {open: isOpen('p-hover'), focusMoved: card('p-hover').contains(document.activeElement)};
            hover(t, 'pointerleave');
            await sleep(100);
            hover(card('p-hover'), 'pointerenter');
            await sleep(400);
            const intoCard = isOpen('p-hover');
            hover(card('p-hover'), 'pointerleave');
            await sleep(450);
            const left = {gone: isGone('p-hover'), closes: count('close hover')};
            hover(t, 'pointerenter');
            await sleep(500);
            document.getElementById('hover-box').focus();
            hover(t, 'pointerleave');
            await sleep(450);
            const focusKeeps = isOpen('p-hover');
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            hover(t, 'pointerenter');
            await sleep(500);
            click(t);
            hover(t, 'pointerleave');
            await sleep(450);
            const pressKeeps = isOpen('p-hover');
            await closeIt('p-hover');
            return {passing, touch, rested, intoCard, left, focusKeeps, pressKeeps, hoverNoTooltip: !trig('p-hover').hasAttribute('title')};
        });

    const titleOf = id => { const t = card(id).querySelector('.aui-popover__title'); return t ? t.textContent.trim() : null; };
    const labelled = id => card(id).getAttribute('aria-labelledby') === card(id).id + '-title';

    T('P30 title-text: the title from it (it follows the page), the card named by it; a popover-title slot wins; show-title bound: none, and no name pointing at none',
        {fromText: {title: 'Stock of Change the price', labelled: true}, follows: 'Stock of Edit stock', slotWins: 'The slot wins',
            hidden: {title: null, labelled: false}},
        async () => {
            await openIt('p-texttitle');
            const fromText = {title: titleOf('p-texttitle'), labelled: labelled('p-texttitle')};
            apply(s => { s.trig.text = 'Edit stock'; });
            const follows = titleOf('p-texttitle');
            await closeIt('p-texttitle');
            await openIt('p-titled');
            const slotWins = titleOf('p-titled');
            await closeIt('p-titled');
            apply(s => { s.trig.text = 'Change the price'; s.trig.showTitle = false; });
            await openIt('p-texttitle');
            const hidden = {title: titleOf('p-texttitle'), labelled: card('p-texttitle').hasAttribute('aria-labelledby')};
            await closeIt('p-texttitle');
            apply(s => { s.trig.showTitle = true; });
            return {fromText, follows, slotWins, hidden};
        });

    T('P31 the analysis\' cases: Enter in a card inside a page form confirms and never submits that form (with confirm-on-enter="false" too); an is-open the page computes opens and closes it with no error and no reopening; a box of the page\'s own as the trigger keeps its press (caret) and opens on its click; a long note wraps at a reading width; a trigger text cut by its cell ends with an ellipsis and shows its whole text as a tooltip; an api given later works',
        {form: {confirmed: 1, prevented: true, offPrevented: true, offConfirmed: 0}, computed: {opened: true, closedByUser: true, stays: true, reopened: true},
            editable: {pressPrevented: false, focused: true, opened: true}, note: {wraps: true, atMost: true}, narrow: {ellipsis: true, tooltip: 'A trigger text far longer than its cell'},
            late: true},
        async () => {
            clearLog();
            await openIt('p-inform');
            let e = key(document.getElementById('inform-box'), 'Enter');
            await sleep(CLOSE_MS);
            const form = {confirmed: count('confirm inform'), prevented: e.defaultPrevented};
            await openIt('p-inform-off');
            e = key(document.getElementById('inform-off-box'), 'Enter');
            form.offPrevented = e.defaultPrevented;
            form.offConfirmed = count('confirm inform-off');
            await closeIt('p-inform-off');
            apply(s => { s.computed.id = 1; });
            await sleep(OPEN_MS);
            const computed = {opened: isOpen('p-computed')};
            click(trig('p-computed'));
            await sleep(CLOSE_MS);
            computed.closedByUser = isGone('p-computed');
            apply(s => { s.computed.id = 2; });
            await sleep(OPEN_MS);
            computed.stays = isGone('p-computed');
            apply(s => { s.computed.id = 1; });
            await sleep(OPEN_MS);
            computed.reopened = isOpen('p-computed');
            apply(s => { s.computed.id = 0; });
            await sleep(CLOSE_MS);
            const editBox = document.getElementById('editable-box');
            const down = new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0, detail: 1});
            editBox.dispatchEvent(down);
            if (!down.defaultPrevented) editBox.focus();
            editBox.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, button: 0, detail: 1}));
            editBox.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 1}));
            await sleep(OPEN_MS);
            const editable = {pressPrevented: down.defaultPrevented, focused: document.activeElement === editBox, opened: isOpen('p-editable')};
            key(document.activeElement, 'Escape');
            await sleep(CLOSE_MS);
            await openIt('p-note');
            const nb = box(card('p-note'));
            const note = {wraps: nb.height > 60, atMost: nb.width <= 480.5};
            await closeIt('p-note');
            const t = trig('p-narrow');
            const span = t.querySelector('.aui-popover__trigger-text');
            t.dispatchEvent(new PointerEvent('pointerenter', {pointerType: 'mouse'}));
            const narrow = {ellipsis: getComputedStyle(span).textOverflow === 'ellipsis' && span.scrollWidth > span.clientWidth, tooltip: t.getAttribute('title')};
            apply(s => { s.late.api = {}; });
            apply(s => s.late.api.open());
            await sleep(OPEN_MS);
            const late = isOpen('p-late');
            apply(s => s.late.api.close());
            await sleep(CLOSE_MS);
            return {form, computed, editable, note, narrow, late};
        });

    T('P32 layout: the content 16px from the sides as the title and the footer, 8px under the title, 12px below; its parts 12px apart; content-padding compact and none; width (a number: px), wider than the reading width too',
        {normal: ['8px', '16px', '12px', '16px'], title: '16px', footer: ['16px', '16px'], stack: 12, compact: ['8px', '12px', '8px', '12px'],
            none: ['0px', '0px', '0px', '0px'], width280: 280, width600: 600},
        async () => {
            const pad = () => { const cs = getComputedStyle(card('p-layout').querySelector('.aui-popover__content')); return [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft]; };
            await openIt('p-layout');
            const normal = pad();
            const title = getComputedStyle(card('p-layout').querySelector('.aui-popover__title')).paddingLeft;
            const fcs = getComputedStyle(card('p-layout').querySelector('.aui-popover__footer'));
            const footer = [fcs.paddingLeft, fcs.paddingRight];
            const stack = Math.round(box(document.getElementById('lay-b')).top - box(document.getElementById('lay-a')).bottom);
            apply(s => { s.layout.padding = 'compact'; });
            const compact = pad();
            apply(s => { s.layout.padding = 'none'; });
            const none = pad();
            apply(s => { s.layout.width = '280'; });
            await sleep(100);
            const width280 = Math.round(box(card('p-layout')).width);
            apply(s => { s.layout.width = '600'; });
            await sleep(100);
            const width600 = Math.round(box(card('p-layout')).width);
            await closeIt('p-layout');
            apply(s => { s.layout.padding = ''; s.layout.width = ''; });
            return {normal, title, footer, stack, compact, none, width280, width600};
        });

    T('P33 in a box that scrolls (a dialog\'s body): the side where all of the card fits in the box; while the box scrolls it flips at the box\'s edge, not over what is around it (the window has room below)',
        {opened: 'bottom', nearEnd: {side: 'top', inBox: true}, back: {side: 'bottom', inBox: true}},
        async () => {
            const area = document.getElementById('area-box');
            // the trigger's bottom `gap` px above the box's bottom
            const at = gap => { area.scrollTop += box(trig('p-area')).bottom - (box(area).bottom - gap); };
            const inBox = () => { const a = box(area); const c = box(card('p-area')); return c.top >= a.top - 0.5 && c.bottom <= a.bottom + 0.5; };
            const side = () => card('p-area').getAttribute('data-side');
            at(150);
            await openIt('p-area');
            const opened = side();
            at(40);
            await sleep(150);
            const nearEnd = {side: side(), inBox: inBox()};
            at(150);
            await sleep(150);
            const back = {side: side(), inBox: inBox()};
            await closeIt('p-area');
            return {opened, nearEnd, back};
        });

    T('P34 the targets: an icon alone 24px both ways around its 16px icon, its place in the line the icon\'s; a text trigger whole in its place under a page\'s box-sizing: border-box, and cut in a cell narrower than it',
        {icon: {target: [24, 24], place: 16}, text: {whole: true, cutInNarrow: true}},
        async () => {
            const t = box(trig('p-right'));
            const icon = {target: [Math.round(t.width), Math.round(t.height)], place: Math.round(box(host('p-right').querySelector('.popover-container')).width)};
            const reset = document.createElement('style');
            reset.textContent = '*, ::before, ::after { box-sizing: border-box; }';
            document.head.appendChild(reset);
            const span = trig('p-none').querySelector('.aui-popover__trigger-text');
            const narrow = trig('p-narrow').querySelector('.aui-popover__trigger-text');
            const text = {whole: span.scrollWidth <= span.clientWidth, cutInNarrow: narrow.scrollWidth > narrow.clientWidth};
            reset.remove();
            return {icon, text};
        });

    T('E1 no Angular errors', {errors: 0}, async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-* family: aui-popover', tests);
})();
