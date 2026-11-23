// Fallback round suite (page: fallback-round.html, fixture: fallback-round.fixture.js): the fallback (no <dialog>, no
// jQuery) - the page behind it follows the page (children added later hidden, the page's own aria-hidden given back as
// it was last set, inert where the browser has it); Tab goes round through forms with a disabled fieldset, hidden and
// inert controls, a radio group and positive tabindex; the toasts over it can take the focus; a fixed size and the
// on-top place stay inside the window; content built by render() closed in its opening turn lets go of Angular's data.
(function () {
    const {sleep, until} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const svc = name => angular.element(document.body).injector().get(name);
    const ctrlOf = id => angular.element(document.getElementById(id)).isolateScope().$ctrl;
    const box = id => document.getElementById(ctrlOf(id).componentId);
    const overlay = id => box(id).parentNode;
    const shown = id => overlay(id) && overlay(id).parentNode === document.body && overlay(id).classList.contains('is-open');
    const gone = id => !overlay(id) || overlay(id).parentNode !== document.body;
    // a keydown of Tab where the focus is (the fallback goes round at the ends; between them the browser moves on)
    const tab = shift => {
        const target = document.activeElement || document.body;
        target.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', code: 'Tab', keyCode: 9, shiftKey: !!shift, bubbles: true, cancelable: true}));
    };
    const at = () => document.activeElement && (document.activeElement.id || document.activeElement.tagName);
    async function openAndWait(name) {
        apply(s => { s.open[name] = true; });
        await until(() => shown('f-' + name), 2000);
        await sleep(350);
    }
    async function closeAndWait(name) {
        apply(s => { s.open[name] = false; });
        await until(() => gone('f-' + name), 2000);
        await sleep(50);
    }
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('FR1 a part the page adds to the body while the fallback is open is hidden behind it too; on close it is as the page made it',
        {open: {hidden: 'true', inert: true}, closed: {hidden: null, inert: false}},
        async () => {
            await openAndWait('bg');
            const late = document.createElement('div');
            late.id = 'late-panel';
            late.innerHTML = '<h2>Late</h2><button type="button">Act</button>';
            document.body.appendChild(late);
            await sleep(30);
            const open = {hidden: late.getAttribute('aria-hidden'), inert: late.hasAttribute('inert')};
            await closeAndWait('bg');
            const closed = {hidden: late.getAttribute('aria-hidden'), inert: late.hasAttribute('inert')};
            late.parentNode.removeChild(late);
            return {open, closed};
        });

    T('FR2 the page changes its own aria-hidden behind the fallback (one panel shown, one folded): on close its latest values stay',
        {whileOpen: {a: 'true', b: 'true'}, closed: {a: 'false', b: 'true'}},
        async () => {
            await openAndWait('bg');
            apply(s => { s.panel.expanded = true; s.panel.collapsed = true; });
            await sleep(30);
            const whileOpen = {a: document.getElementById('toolbar-a').getAttribute('aria-hidden'),
                b: document.getElementById('toolbar-b').getAttribute('aria-hidden')};
            await closeAndWait('bg');
            const closed = {a: document.getElementById('toolbar-a').getAttribute('aria-hidden'),
                b: document.getElementById('toolbar-b').getAttribute('aria-hidden')};
            apply(s => { s.panel.expanded = false; s.panel.collapsed = false; });
            return {whileOpen, closed};
        });

    T('FR3 a page control raised above the overlay (z-index) is inert behind the fallback, and usable again after it',
        {open: true, closed: false},
        async () => {
            await openAndWait('bg');
            const open = document.getElementById('help').hasAttribute('inert') || !!document.getElementById('help').closest('[inert]');
            await closeAndWait('bg');
            return {open, closed: document.getElementById('help').hasAttribute('inert')};
        });

    T('FR4 a disabled fieldset at the start of the form: Tab from the last control goes round to the first usable one, Shift+Tab back',
        {forward: 'fs-on', back: 'fs-save'},
        async () => {
            await openAndWait('fs');
            document.getElementById('fs-save').focus();
            tab(false);
            const forward = at();
            tab(true);
            const back = at();
            await closeAndWait('fs');
            return {forward, back};
        });

    T('FR5 hidden and inert controls at the start are skipped by the round as by the browser',
        {forward: 'hid-on', back: 'hid-save'},
        async () => {
            await openAndWait('hid');
            document.getElementById('hid-save').focus();
            tab(false);
            const forward = at();
            tab(true);
            const back = at();
            await closeAndWait('hid');
            return {forward, back};
        });

    T('FR6 a radio group at the start: the round comes back to its checked button',
        {forward: 'r-card'},
        async () => {
            await openAndWait('radio');
            document.getElementById('r-save').focus();
            tab(false);
            const forward = at();
            await closeAndWait('radio');
            return {forward};
        });

    T('FR7 controls with a positive tabindex come first, in its order: the round from the last goes to tabindex 1',
        {forward: 'p-one', back: 'p-zero'},
        async () => {
            await openAndWait('pos');
            document.getElementById('p-zero').focus();
            tab(false);
            const forward = at();
            tab(true);
            const back = at();
            await closeAndWait('pos');
            return {forward, back};
        });

    T('FR8 a toast shown over the fallback goes into its overlay and can take the focus (it is not sent back to the box)',
        {inOverlay: true, focused: true},
        async () => {
            await openAndWait('bg');
            const m = svc('AuiMessage');
            const h = m.show({message: 'Saved', duration: 0});
            await until(() => !!document.querySelector('.aui-message[data-aui-message-id="' + h.id + '"]'), 1000);
            await sleep(50);
            const host = document.querySelector('.aui-message-host');
            const inOverlay = overlay('f-bg').contains(host);
            const close = document.querySelector('.aui-message[data-aui-message-id="' + h.id + '"] .aui-message__close');
            close.focus();
            await sleep(50);
            const focused = document.activeElement === close;
            m.clearAll();
            await sleep(250);
            await closeAndWait('bg');
            return {inOverlay, focused};
        });

    T('FR9 a fixed size larger than the window stays inside it (as a native modal dialog)',
        {inside: true},
        async () => {
            await openAndWait('big');
            const r = box('f-big').getBoundingClientRect();
            const inside = r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
            await closeAndWait('big');
            return {inside};
        });

    T('FR10 display-on-top with a tall height (98vh): the box stays inside the window (heading and footer on screen)',
        {inside: true},
        async () => {
            await openAndWait('top');
            const r = box('f-top').getBoundingClientRect();
            const inside = r.top >= -1 && r.bottom <= window.innerHeight + 1;
            await closeAndWait('top');
            return {inside};
        });

    T('FR11 content of render() closed in its opening turn lets go of Angular\'s data on it (its $destroy runs)',
        {destroyed: 3},
        async () => {
            const modal = svc('AuiModal');
            let destroyed = 0;
            for (let i = 0; i < 3; i += 1) {
                const handle = modal.open({
                    title: 'Quick ' + i,
                    render: function (container) {
                        const input = document.createElement('input');
                        container.appendChild(input);
                        angular.element(input).data('note', i);
                        angular.element(input).on('$destroy', function () { destroyed += 1; });
                    }
                });
                await sleep(0);
                scope().$apply(() => { handle.close('quick'); });
                await sleep(400);
            }
            return {destroyed};
        });

    T('FR99 no Angular errors on the page',
        {errors: []},
        async () => ({errors: window.__ngErrors.slice()}));

    AuiTest.run('aui-* family: aui-modal fallback, round checks', tests, {delay: 0});
})();
