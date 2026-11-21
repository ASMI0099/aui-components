// css-guard suite (page: css-guard.html): the gallery test/perf/page-css.html in two frames, clean and under a page's
// hostile general rules (test/perf/page-rules.hostile.css, after aui-components.css: span, label, div, ul, li, input,
// svg paths, [role="button"], [aria-hidden], *:focus with !important, box-sizing, transitions, a root font size). Every
// part of every field, the open panels with them, must have the same box (within half a pixel) and the same look in
// the two; and the focused parts the same focus look. The checks read the frames once nothing moves in them (settle),
// not after fixed sleeps.
(function () {
    const {sleep, until, frames} = AuiTest;
    const frame = id => document.getElementById(id).contentWindow;

    // the parts of a field; the ones that draw text are compared in their text look as well
    const PARTS = {
        root: ':scope > *', trigger: '.aui-input__form-trigger, .aui-select__trigger, .aui-input-container',
        label: '.aui-control-label, .aui-field-label, .aui-input-label',
        box: 'input.aui-input-field, input.aui-input__form-field, textarea.aui-input__form-field',
        placeholder: '.aui-select__placeholder', display: '.aui-select__display-text', clear: '.aui-control-clear',
        clearSvg: '.aui-control-clear-svg', chevron: '.aui-select__chevron', count: '.aui-input__count', affix: '.aui-input__affix',
        affixText: '.aui-input__affix-text', eye: '.aui-input__eye', searchIcon: '.aui-input__search-icon', tag: '.aui-select__tag',
        tagText: '.aui-select__tag-text', tagRemove: '.aui-select__tag-remove', message: '.aui-field-message', underline: '.aui-input-highlight',
        panel: '.aui-select__panel', search: '.aui-select__search', searchInput: '.aui-select__search-input', list: 'ul.aui-select__options',
        option: 'li.aui-select__option:not(.aui-select__option--selected)', selected: 'li.aui-select__option--selected',
        caret: '.aui-tree-select__caret', checkbox: '.aui-tree-select__checkbox', treeLabel: '.aui-tree-select__label',
        dpBox: 'input.aui-date-picker__input', dpTo: '.aui-date-picker__to', dpBar: '.aui-date-picker__bar', dpNav: '.aui-date-picker__arrow',
        dpTitle: '.aui-date-picker__title-part', dpWeekday: '.aui-date-picker__calendar th', dpCell: '.aui-date-picker__calendar td',
        dpDay: '.aui-date-picker__day:not(.aui-date-picker__day--selected):not(.aui-date-picker__day--outside)',
        dpDayText: '.aui-date-picker__day:not(.aui-date-picker__day--selected):not(.aui-date-picker__day--outside) > span',
        dpSelected: '.aui-date-picker__day--selected', dpEnd: '.aui-date-picker__end', dpEndLabel: '.aui-date-picker__end-label',
        dpEndValue: '.aui-date-picker__end-value', dpColumn: '.aui-date-picker__column', dpTime: '.aui-date-picker__time:not(.aui-date-picker__time--selected)',
        dpTimeSelected: '.aui-date-picker__time--selected', dpShortcut: '.aui-date-picker__shortcut', dpStatus: '.aui-date-picker__status',
        dpOk: '.aui-date-picker__ok', dpClearLink: '.aui-date-picker__clear',
        popTrigger: '.aui-popover__trigger', popIcon: '.aui-popover__trigger > svg', popIconPath: '.aui-popover__trigger > svg path',
        popPanel: '.aui-popover__panel', popTitle: '.aui-popover__title', popFooter: '.aui-popover__footer',
        popButton: '.aui-popover__footer button', popText: '.aui-popover__trigger-text',
        cbRoot: '.aui-checkbox', cbBox: '.aui-checkbox__box', cbLabel: '.aui-checkbox__label', cbOptions: '.aui-checkbox-group__options',
        cbOption: '.aui-checkbox-group__options .aui-checkbox:last-child', cbOptionLabel: '.aui-checkbox-group__options .aui-checkbox:last-child .aui-checkbox__label',
        btn: 'button.aui-button', btnLabel: '.aui-button__label', btnText: '.aui-button__label > span', btnIcon: '.aui-button__icon',
        btnSvg: '.aui-button__svg', btnSvgPath: '.aui-button__svg path', btnSpinner: '.aui-button__spinner'
    };
    const TEXT = ['label', 'box', 'placeholder', 'display', 'count', 'affixText', 'tagText', 'message', 'searchInput', 'option',
        'selected', 'treeLabel', 'dpBox', 'dpTitle', 'dpWeekday', 'dpDayText', 'dpSelected', 'dpEndLabel', 'dpEndValue', 'dpTime',
        'dpTimeSelected', 'dpShortcut', 'dpStatus', 'dpOk', 'dpClearLink', 'popTitle', 'popButton', 'popText', 'cbLabel', 'cbOptionLabel', 'btn', 'btnLabel', 'btnText'];
    const LOOK = ['display', 'float', 'visibility', 'opacity', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop',
        'marginRight', 'marginBottom', 'marginLeft', 'backgroundColor', 'backgroundImage', 'boxShadow', 'borderTopLeftRadius',
        'listStyleType', 'fill', 'stroke'];
    const TEXT_LOOK = ['color', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textTransform', 'textIndent',
        'textDecorationLine'];
    const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

    function measure(w) {
        const out = {};
        const round = n => Math.round(n * 2) / 2;
        w.document.querySelectorAll('[data-probe]').forEach(host => {
            const hr = host.getBoundingClientRect();
            Object.keys(PARTS).forEach(part => {
                const el = host.querySelector(PARTS[part]);
                if (!el) return;
                const r = el.getBoundingClientRect();
                const cs = w.getComputedStyle(el);
                const rec = out[host.getAttribute('data-probe') + ' / ' + part] = {box: [r.left - hr.left, r.top - hr.top, r.width, r.height].map(round)};
                LOOK.forEach(k => { rec[k] = cs[k]; });
                // a border's colour counts only where the border is drawn
                SIDES.forEach(s => { rec['border' + s] = cs['border' + s + 'Style'] === 'none' ? 'none' : cs['border' + s + 'Width'] + ' ' + cs['border' + s + 'Style'] + ' ' + cs['border' + s + 'Color']; });
                if (TEXT.indexOf(part) >= 0) TEXT_LOOK.forEach(k => { rec[k] = cs[k]; });
                if (part === 'label' || part === 'option' || part === 'selected') {
                    ['::before', '::after'].forEach(ps => {
                        const p = w.getComputedStyle(el, ps);
                        if (p.content === 'none' || p.content === 'normal') return;
                        rec[ps] = [p.width, p.height, p.backgroundColor, p.left, p.top].join(' ');
                    });
                }
            });
        });
        return out;
    }

    function compare(a, b) {
        const diffs = [];
        Object.keys(a).forEach(key => {
            if (!b[key]) { diffs.push(key + ': missing'); return; }
            Object.keys(a[key]).forEach(k => {
                const x = a[key][k], y = b[key][k];
                if (k === 'box') {
                    if (x.some((v, i) => Math.abs(v - y[i]) > 0.5)) diffs.push(key + ' box ' + x.join(' ') + ' -> ' + y.join(' '));
                } else if (x !== y) {
                    diffs.push(key + ' ' + k + ' ' + x + ' -> ' + y);
                }
            });
        });
        Object.keys(b).forEach(key => { if (!a[key]) diffs.push(key + ': only under the page rules'); });
        return diffs;
    }

    const both = fn => Promise.all(['clean', 'hostile'].map(id => fn(frame(id))));
    const scopeOf = w => w.angular.element(w.document.body).scope();

    /**
     * Resolves once nothing moves in the given frames: no CSS transition or animation that has an end (a spinner has
     * none) running in them for three animation frames in a row. After timeoutMs (default 5 s) it resolves with what
     * still moves, named, for the check to report: a read made while something moves then fails by name, not as a
     * difference of look. A fixed sleep is outrun on a busy machine: the hostile page animates every property for 0.3s
     * (* { transition: all }), and there a change of an inherited property (visibility) runs down the tree one level
     * after another, each level's transition starting as its parent's ends (three quiet frames in a row, not one: a
     * level's transition may start a frame after its parent's has ended).
     */
    async function settle(wins, timeoutMs) {
        const limit = Date.now() + (timeoutMs || 5000);
        let quiet = 0;
        for (;;) {
            await frames(1);
            const moving = [];
            wins.forEach(w => w.document.getAnimations().forEach(a => {
                if (a.playState === 'finished' || a.playState === 'idle' || !a.effect || a.effect.getComputedTiming().endTime === Infinity) return;
                const el = a.effect.target;
                const host = el.closest && el.closest('[data-probe]');
                const name = el.classList && ([].find.call(el.classList, c => /^aui-/.test(c)) || el.classList[0]);
                moving.push(w.frameElement.id + ': ' + (host ? host.getAttribute('data-probe') + ' / ' : '') + (name || el.nodeName.toLowerCase()) +
                    (a.effect.pseudoElement || '') + ' ' + (a.transitionProperty || a.animationName));
            }));
            quiet = moving.length ? 0 : quiet + 1;
            if (quiet === 3 || Date.now() > limit) return moving;
        }
    }

    async function ready() {
        await both(w => until(() => w.angular && w.document.querySelector('[data-probe] .aui-select__trigger') && w.document.querySelector('[data-probe] .aui-select__display-text'), 10000));
        // Both frames as tall as the taller gallery: a panel hides while its trigger is out of view (floating-ui's hide),
        // and the open fields at the gallery's end lie below the page's frame height, so CG2 would compare hidden panels;
        // the same height for both, so that both place their panels in the same room
        const height = Math.max.apply(null, ['clean', 'hostile'].map(id => frame(id).document.documentElement.scrollHeight));
        ['clean', 'hostile'].forEach(id => { document.getElementById(id).style.height = height + 'px'; });
        await both(async w => {
            const s = scopeOf(w);
            s.$apply(() => { s.f.req.$setTouched(); s.f.sreq.$setTouched(); s.f.dreq.$setTouched(); });
        });
        // the hostile page animates every property for 0.3s (* { transition: all }): read once the messages' colour
        // has arrived, not on its way
        return settle([frame('clean'), frame('hostile')]);
    }

    // CG2's open fields and their panels (the popover's: its card)
    const OPEN = {'select open': '.aui-select__panel', 'tree open': '.aui-select__panel', 'date open': '.aui-date-picker__panel',
        'popover open': '.aui-popover__panel'};
    const panelOf = (w, probe) => w.document.querySelector('[data-probe="' + probe + '"] ' + OPEN[probe]);
    const everyPanel = (w, test) => Object.keys(OPEN).every(probe => test(panelOf(w, probe)));
    // open: its open class set (the card: once it has come in); closed: the class gone (the card: taken away)
    const isOpen = el => !!el && (el.classList.contains('aui-select__panel--open') || el.classList.contains('aui-popover__panel--in'));
    const isClosed = el => !el || !(el.classList.contains('aui-select__panel--open') || el.classList.contains('aui-popover__panel--shown'));
    // shown: open, drawn, not hidden and fully faded in
    const isShown = (w, el) => {
        if (!isOpen(el)) return false;
        const cs = w.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility === 'visible' && cs.opacity === '1';
    };

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('CG1 closed fields: every part keeps its box and its look under the page\'s hostile rules (all three components, their states)',
        {differences: []}, async () => {
            const moving = await ready();
            const [a, b] = await both(async w => measure(w));
            return {differences: moving.map(m => 'still moving: ' + m).concat(compare(a, b)).slice(0, 60)};
        });

    T('CG2 open panels (aui-select, aui-tree-select multiple, aui-date-picker date-time range, aui-popover): rows, checkboxes, carets, search box, tags; days, time options, ends, shortcuts, OK; the card, its title and buttons keep their box and look',
        {differences: []}, async () => {
            const wins = [frame('clean'), frame('hostile')];
            await both(async w => { const s = scopeOf(w); s.apiS.open(); s.apiT.open(); s.apiD.open(); s.apiP.open(); s.$apply(); });
            // every panel open in both frames and its opening over (the search box has taken the focus by then)
            await both(w => until(() => everyPanel(w, isOpen), 5000));
            await settle(wins);
            // the search box takes the focus as a panel opens; only one frame can have it: the focus look is CG3's
            await both(async w => { if (w.document.activeElement && w.document.activeElement.blur) w.document.activeElement.blur(); });
            // read once nothing moves in either frame (the blur's fades), each panel shown: a panel compared while hidden
            // does not show its look
            const moving = await settle(wins);
            const notShown = [];
            wins.forEach(w => Object.keys(OPEN).forEach(probe => {
                if (!isShown(w, panelOf(w, probe))) notShown.push(w.frameElement.id + ': ' + probe + ' panel not shown');
            }));
            const [a, b] = await both(async w => measure(w));
            const onlyOpen = o => Object.keys(o).filter(k => /^(select open|tree open|date open|popover open) \//.test(k)).reduce((m, k) => { m[k] = o[k]; return m; }, {});
            await both(async w => { const s = scopeOf(w); s.apiS.close(); s.apiT.close(); s.apiD.close(); s.apiP.close(); s.$apply(); });
            await both(w => until(() => everyPanel(w, isClosed), 5000));
            await settle(wins);
            return {differences: notShown.concat(moving.map(m => 'still moving: ' + m), compare(onlyOpen(a), onlyOpen(b))).slice(0, 60)};
        });

    T('CG3 focused from the keyboard: the field\'s own focus look only (a page\'s *:focus outline with !important does not reach the trigger, the boxes, the eye)',
        {differences: []}, async () => {
            const targets = ['select value clear|.aui-select__trigger', 'tree single|.aui-select__trigger', 'input form label count clear|input',
                'input basic|input', 'textarea|textarea', 'input password eye|.aui-input__eye', 'date value clear|input.aui-date-picker__input'];
            // one frame after the other: only one of them can have the focus
            const focusLook = async (w, probe, sel) => {
                const host = w.document.querySelector('[data-probe="' + probe + '"]');
                const el = host.querySelector(sel);
                w.focus();
                w.document.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'Tab', bubbles: true}));
                el.focus();
                await sleep(300);
                // and nothing moving (the focus look's fades: 0.3s for every property under the hostile rules)
                const moving = await settle([w]);
                const trig = host.querySelector('.aui-input__form-trigger, .aui-select__trigger, .aui-input-container');
                const cs = w.getComputedStyle(el), ts = w.getComputedStyle(trig);
                const border = ts.borderTopStyle === 'none' ? 'none' : ts.borderTopColor;
                const look = {focused: w.document.activeElement === el, outline: cs.outlineStyle + ' ' + cs.outlineWidth, shadow: cs.boxShadow,
                    trigger: border + ' ' + ts.boxShadow};
                el.blur();
                await sleep(100);
                return {look, moving};
            };
            const diffs = [];
            for (const t of targets) {
                const [probe, sel] = t.split('|');
                const {look: a, moving: ma} = await focusLook(frame('clean'), probe, sel);
                const {look: b, moving: mb} = await focusLook(frame('hostile'), probe, sel);
                ma.concat(mb).forEach(m => diffs.push(probe + ' still moving: ' + m));
                Object.keys(a).forEach(k => { if (a[k] !== b[k]) diffs.push(probe + ' ' + k + ': ' + a[k] + ' -> ' + b[k]); });
            }
            return {differences: diffs};
        });

    T('E1 no Angular errors in either frame',
        {clean: 0, hostile: 0}, async () => ({clean: frame('clean').__ngErrors.length, hostile: frame('hostile').__ngErrors.length}));

    AuiTest.run('aui-* family: the fields against a page\'s general CSS rules', tests, {delay: 0});
})();
