// Growth suite (page: growth.html, fixture: growth.fixture.js), aui-tree-select and aui-select:
// - the first data replacing a loading state that has been seen grows the open panel in one movement, by a transform
//   (Web Animations, on the compositor) anchored at the trigger's side; new content fades in;
// - data at hand when the panel opens needs no growth (the open animation shows the full panel);
// - closing during a growth closes cleanly, reopening starts clean; a branch opening keeps its height animation.
(function () {
    const {sleep, frames, outside} = AuiTest;
    const host = id => document.querySelector('#' + id + ' aui-select, #' + id + ' aui-tree-select');
    const isTree = id => host(id).tagName.toLowerCase() === 'aui-tree-select';
    const ctrl = id => angular.element(host(id)).controller(isTree(id) ? 'auiTreeSelect' : 'auiSelect');
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const panel = id => host(id).querySelector('.aui-select__panel');
    const rows = id => host(id).querySelectorAll('li.aui-select__option').length;
    const scope = () => angular.element(document.querySelector('[ng-controller]')).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const mouse = (el, typeName) => el.dispatchEvent(new MouseEvent(typeName, {bubbles: true, cancelable: true, button: 0}));
    const press = el => { mouse(el, 'mousedown'); mouse(el, 'mouseup'); mouse(el, 'click'); };
    async function close() { outside(); await sleep(450); }
    /** Animations started from script (Web Animations), not the CSS transitions and animations of the stylesheet. */
    function scripted(el) {
        if (!el || typeof el.getAnimations !== 'function') return [];
        return el.getAnimations().filter(a => !(window.CSSTransition && a instanceof CSSTransition) &&
            !(window.CSSAnimation && a instanceof CSSAnimation));
    }
    function scaleY(el) {
        const t = getComputedStyle(el).transform;
        const m = t && t !== 'none' ? /matrix\(([^)]+)\)/.exec(t) : null;
        return m ? +parseFloat(m[1].split(',')[3]).toFixed(3) : 1;
    }
    const startScale = a => parseFloat(/scaleY\(([^)]+)\)/.exec(a.effect.getKeyframes()[0].transform || '')[1]);
    const animates = (a, prop) => a.effect.getKeyframes().some(k => k[prop] !== undefined);
    /** Waits frame by frame (up to maxFrames) until test() is true; returns whether it became true. */
    async function until(test, maxFrames) {
        for (let i = 0; i < maxFrames; i++) {
            if (test()) return true;
            await frames(1);
        }
        return !!test();
    }

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('G1 tree: the first data after a loading state that was seen grows the panel by a transform, anchored at the trigger; it ends at full size',
        {seen: true, grew: true, fromSmall: true, transform: true, anchored: true, endScale: 1, rows: true, heightLeft: '', running: 0},
        async () => {
            apply(s => { s.delay.tree = 400; s.round.tree += 1; });
            press(trig('t'));
            // the loading state on screen (a first opening can take a moment: the browser's first drawing of a panel)
            const seen = await until(() => +getComputedStyle(panel('t')).opacity > 0.5 && rows('t') === 0, 30);
            const edge = Math.round(panel('t').getBoundingClientRect().top);
            const grew = await until(() => scripted(panel('t')).length > 0, 60);
            const growth = scripted(panel('t'))[0];
            const fromSmall = !!growth && startScale(growth) < 0.5;
            const transform = !!growth && animates(growth, 'transform');
            await frames(3);
            const anchored = Math.abs(Math.round(panel('t').getBoundingClientRect().top) - edge) <= 1;
            await sleep(350);
            const r = {seen, grew, fromSmall, transform, anchored, endScale: scaleY(panel('t')), rows: rows('t') > 0,
                heightLeft: panel('t').style.height, running: scripted(panel('t')).length};
            await close();
            return r;
        });

    T('G2 tree: data at hand when the panel opens needs no growth (the open animation shows the full panel)',
        {grew: false, rows: true, endScale: 1},
        async () => {
            apply(s => { s.delay.tree = -1; s.round.tree += 1; });
            press(trig('t'));
            let grew = false;
            for (let i = 0; i < 20; i++) {
                if (scripted(panel('t')).length > 0) grew = true;
                await frames(1);
            }
            await sleep(150);
            const r = {grew, rows: rows('t') > 0, endScale: scaleY(panel('t'))};
            await close();
            return r;
        });

    T('G3 aui-select: the first page replacing the placeholder rows grows the panel; the list fades in over the swap',
        {skeleton: true, grew: true, listFades: true, endScale: 1, rows: true, running: 0},
        async () => {
            apply(s => { s.delay.select = 400; s.round.select += 1; });
            press(trig('s'));
            const skeleton = await until(() => +getComputedStyle(panel('s')).opacity > 0.5 &&
                host('s').querySelectorAll('li.aui-select__skeleton').length > 0 && rows('s') === 0, 30);
            const grew = await until(() => scripted(panel('s')).length > 0, 60);
            const list = host('s').querySelector('.aui-select__options');
            const listFades = scripted(list).some(a => animates(a, 'opacity'));
            await sleep(400);
            const r = {skeleton, grew, listFades, endScale: scaleY(panel('s')), rows: rows('s') > 0,
                running: scripted(panel('s')).length + scripted(host('s').querySelector('.aui-select__options')).length};
            await close();
            return r;
        });

    T('G4 closing during a growth closes cleanly; reopening (data at hand) starts without a growth and ends at full size',
        {growing: true, closed: true, leftAfterClose: 0, reopenGrew: false, reopenRows: true, reopenScale: 1},
        async () => {
            apply(s => { s.delay.tree = 400; s.round.tree += 1; });
            press(trig('t'));
            await until(() => +getComputedStyle(panel('t')).opacity > 0.5, 30);
            const growing = await until(() => scripted(panel('t')).length > 0, 60);
            await frames(2);
            await close();
            const closed = !ctrl('t').isOpen && !panel('t').classList.contains('aui-select__panel--open');
            const leftAfterClose = scripted(panel('t')).length;
            press(trig('t'));
            let reopenGrew = false;
            for (let i = 0; i < 20; i++) {
                if (scripted(panel('t')).length > 0) reopenGrew = true;
                await frames(1);
            }
            await sleep(150);
            const r = {growing, closed, leftAfterClose, reopenGrew, reopenRows: rows('t') > 0, reopenScale: scaleY(panel('t'))};
            await close();
            return r;
        });

    T('G5 a branch opening in a panel that shows rows keeps its height animation (no growth by transform)',
        {grew: false, heightAnimated: true, more: true},
        async () => {
            press(trig('t'));
            await sleep(350);
            const before = rows('t');
            const caret = host('t').querySelector('li.aui-select__option .aui-tree-select__caret');
            mouse(caret, 'mousedown');
            mouse(caret, 'click');
            let heightAnimated = false;
            let grew = false;
            for (let i = 0; i < 12; i++) {
                if (panel('t').classList.contains('aui-tree-select__panel--resizing') || panel('t').style.height !== '') heightAnimated = true;
                if (scripted(panel('t')).length > 0) grew = true;
                await frames(1);
            }
            await sleep(300);
            const r = {grew, heightAnimated, more: rows('t') > before};
            await close();
            return r;
        });

    T('E1 no Angular errors in the whole suite',
        {errors: 0},
        async () => ({errors: window.__ngErrors.length}));

    AuiTest.run('aui-* family: the first data growing an open panel', tests, {delay: 0});
})();
