// Modal fallback suite (page: fallback.html, fixture: fallback.fixture.js): aui-modal where the browser has no
// <dialog> (the fixed box over an overlay, moved under the body), on a page without jQuery:
// - a <footer> of its own with show-confirm-button builds no default buttons (they threw without jQuery);
// - Tab and Shift+Tab go round inside the box; the page behind is hidden from screen readers while it is open, and its
//   own aria-hidden values come back;
// - a tall auto-size box scrolls itself, so its footer can be reached;
// - closed dialogs of AuiModal leave nothing in AngularJS's element cache;
// - the backdrop colour set around the modal is taken along; the scroll lock gives back !important values;
// - a modal left alone (the lower one closed first) dims the page as a single one does.
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
    const footerButtons = id => Array.from(box(id).querySelectorAll('.aui-modal__footer aui-button button'));
    /** A keydown of Tab where the focus is; whether its default was prevented */
    const tab = shift => {
        const target = document.activeElement || document.body;
        const event = new KeyboardEvent('keydown', {key: 'Tab', code: 'Tab', keyCode: 9, shiftKey: !!shift, bubbles: true, cancelable: true});
        target.dispatchEvent(event);
        return event.defaultPrevented;
    };
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

    T('F1 the fallback runs (no <dialog>), without jQuery',
        {fallback: true, jqLite: true},
        async () => ({fallback: !svc('auiModalRegistry').useNativeDialog(), jqLite: !window.jQuery && !angular.element.prototype.jquery}));

    T('F2 a <footer> of its own with show-confirm-button: only its own buttons, no Angular error',
        {buttons: ['Done'], errors: []},
        async () => {
            await openAndWait('own');
            const r = {buttons: footerButtons('f-own').map(b => b.textContent.trim()), errors: AuiTest.angularErrors().slice()};
            await closeAndWait('own');
            return r;
        });

    T('F3 Tab and Shift+Tab go round inside the box: from the box (it holds the focus as it opens) or the first control back to the last, from the last on to the first; between them the browser moves on',
        {start: 'box', fromBox: 'Confirm', onToFirst: 'tab-first', fromFirst: 'Confirm', middleLeftToBrowser: true},
        async () => {
            await openAndWait('tab');
            const name = el => el === box('f-tab') ? 'box' : (el.id || el.textContent.trim());
            const start = name(document.activeElement);
            tab(true);
            const fromBox = name(document.activeElement);
            tab(false);
            const onToFirst = name(document.activeElement);
            tab(true);
            const fromFirst = name(document.activeElement);
            document.getElementById('tab-first').focus();
            const middleLeftToBrowser = !tab(false);
            await closeAndWait('tab');
            return {start, fromBox, onToFirst, fromFirst, middleLeftToBrowser};
        });

    T('F4 while it is open the page behind is hidden from screen readers (the toasts\' host stays readable); on close the page\'s own aria-hidden values come back',
        {open: {main: 'true', note: 'true', box: null, toasts: null}, closed: {main: null, note: 'false'}},
        async () => {
            await openAndWait('tab');
            const hidden = el => el ? el.getAttribute('aria-hidden') : 'missing';
            const open = {main: hidden(document.getElementById('page-main')), note: hidden(document.getElementById('page-note')),
                box: hidden(overlay('f-tab')), toasts: hidden(document.querySelector('aui-message-host'))};
            await closeAndWait('tab');
            const closed = {main: hidden(document.getElementById('page-main')), note: hidden(document.getElementById('page-note'))};
            return {open, closed};
        });

    T('F5 a tall auto-size box scrolls itself: its footer can be brought into view (the page under it is locked)',
        {overflow: 'auto', scrolls: true, footerInView: true},
        async () => {
            await openAndWait('tall');
            const b = box('f-tall');
            const done = document.querySelector('#tall-done button');
            done.focus();
            await sleep(50);
            const r = done.getBoundingClientRect();
            const result = {overflow: getComputedStyle(b).overflowY, scrolls: b.scrollHeight > b.clientHeight,
                footerInView: r.top >= 0 && r.bottom <= window.innerHeight};
            await closeAndWait('tall');
            return result;
        });

    T('F6 AuiModal.open, closed again and again: nothing of the closed dialogs stays in AngularJS\'s element cache',
        {added: 0},
        async () => {
            const AuiModal = svc('AuiModal');
            const cycle = async () => {
                let done = false;
                const handle = AuiModal.open({title: 'A dialog', content: 'Some text'});
                handle.then(() => { done = true; });
                await until(() => document.querySelector('.aui-modal--fallback-overlay.is-open'), 2000);
                await sleep(350);
                handle.close();
                await until(() => done, 2000);
                await until(() => !document.querySelector('.aui-modal--fallback-overlay'), 2000);
                await sleep(50);
            };
            await cycle();    // anything made once (the first opening) is not counted
            const before = Object.keys(angular.element.cache).length;
            for (let i = 0; i < 3; i += 1) await cycle();
            return {added: Object.keys(angular.element.cache).length - before};
        });

    T('F7 a backdrop colour set on the modal\'s section is taken along to the overlay under the body',
        {backdrop: 'rgba(10, 120, 60, 0.5)'},
        async () => {
            await openAndWait('theme');
            const backdrop = getComputedStyle(overlay('f-theme'), '::before').backgroundColor;
            await closeAndWait('theme');
            return {backdrop};
        });

    T('F8 the scroll lock gives the page\'s own inline values back with their !important',
        {overflow: ['auto', 'important'], padding: ['13px', 'important']},
        async () => {
            const body = document.body.style;
            body.setProperty('overflow', 'auto', 'important');
            body.setProperty('padding-right', '13px', 'important');
            await openAndWait('theme');
            await closeAndWait('theme');
            const r = {overflow: [body.getPropertyValue('overflow'), body.getPropertyPriority('overflow')],
                padding: [body.getPropertyValue('padding-right'), body.getPropertyPriority('padding-right')]};
            body.removeProperty('overflow');
            body.removeProperty('padding-right');
            return r;
        });

    T('F9 two open, the lower one closed first: the one left dims the page as a single one does',
        {stackedOver: true, alone: true},
        async () => {
            await openAndWait('lower');
            await openAndWait('upper');
            const stackedOver = overlay('f-upper').classList.contains('aui-modal--stacked');
            apply(s => { s.open.lower = false; });
            await sleep(50);
            const alone = !overlay('f-upper').classList.contains('aui-modal--stacked');
            await until(() => gone('f-lower'), 2000);
            await closeAndWait('upper');
            return {stackedOver, alone};
        });

    T('F10 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('aui-* family: aui-modal fallback', tests);
})();
