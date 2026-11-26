// Label-gap suite (page: label-gap.html, fixture: label-gap.fixture.js): the two gaps around a field label's divider -
// from the label's text to the divider, and from the divider to the value (its first character, a tag's edge, the
// input's text) - are equal (8px) for every field kind with an inline label, on the page and inside an aui-modal (a
// scroll area), and stay so under a stylesheet that gives every element a scrollbar gutter
// (* { scrollbar-gutter: stable both-edges !important }). The divider's place is read from the label's real padding
// box and the divider's own offset, so a gutter, a padding or a border that moved it shows here. The divider lies
// inside the label's clip, never on its edge (where a browser's rounding at a fractional place cut it away).
(function () {
    const {sleep} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});
    const HOSTILE = '* { scrollbar-gutter: stable both-edges !important; }';
    let hostileStyle = null;
    const hostile = on => {
        if (on && !hostileStyle) { hostileStyle = document.createElement('style'); hostileStyle.textContent = HOSTILE; document.head.appendChild(hostileStyle); }
        if (!on && hostileStyle) { hostileStyle.remove(); hostileStyle = null; }
    };

    function charRect(el, last) {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {acceptNode: n => n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT});
        let n = w.nextNode(), node = n;
        if (last) while ((n = w.nextNode())) node = n;
        if (!node) return null;
        const v = node.nodeValue, i = last ? v.search(/\S\s*$/) : v.search(/\S/);
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + 1);
        return r.getBoundingClientRect();
    }

    /** Each field of the container: [label text -> divider, divider -> value], whole pixels at a quarter */
    function gaps(containerId) {
        const q = v => Math.round(v * 4) / 4;
        return Array.from(document.querySelectorAll('#' + containerId + ' aui-select, #' + containerId + ' aui-tree-select, #' + containerId + ' aui-input')).map(field => {
            const label = field.querySelector('.aui-control-label');
            const ls = getComputedStyle(label);
            const lr = label.getBoundingClientRect();
            const gutter = label.offsetWidth - label.clientWidth - parseFloat(ls.borderLeftWidth) - parseFloat(ls.borderRightWidth);
            const after = getComputedStyle(label, '::after');
            // the clip's edge (the padding box), and the divider set in from it by its own offset
            const dividerRight = lr.right - parseFloat(ls.borderRightWidth) - gutter - parseFloat(after.right);
            const dividerLeft = dividerRight - parseFloat(after.width);
            const text = charRect(label, true);
            let value;
            const input = field.querySelector('input.aui-input__form-field');
            const tag = field.querySelector('.aui-select__tag');
            if (input) {
                const is = getComputedStyle(input);
                value = input.getBoundingClientRect().left + parseFloat(is.borderLeftWidth) + parseFloat(is.paddingLeft);
            } else if (tag) {
                value = tag.getBoundingClientRect().left;
            } else {
                value = charRect(field.querySelector('.aui-select__display-text, .aui-select__placeholder'), false).left;
            }
            return [q(dividerLeft - text.right), q(value - dividerRight)];
        });
    }

    const EIGHT = [[8, 8], [8, 8], [8, 8], [8, 8], [8, 8]];

    T('G1 on the page: 8px on both sides of the divider in every field kind',
        {gaps: EIGHT},
        async () => ({gaps: gaps('on-page')}));

    T('G2 inside an aui-modal (a scroll area): the same',
        {gaps: EIGHT},
        async () => {
            apply(s => { s.modalOpen = true; });
            await sleep(600);
            return {gaps: gaps('in-modal')};
        });

    T('G3 a stylesheet that gives every element a scrollbar gutter: the same, on the page and inside the modal',
        {page: EIGHT, modal: EIGHT},
        async () => {
            hostile(true);
            await sleep(100);
            const r = {page: gaps('on-page'), modal: gaps('in-modal')};
            hostile(false);
            apply(s => { s.modalOpen = false; });
            await sleep(400);
            return r;
        });

    // Each field's divider: how far inside the label's clip its right edge lies (the clip: the padding box's right
    // edge, and past it by overflow-clip-margin where the label clips with overflow: clip)
    function insets(containerId) {
        return Array.from(document.querySelectorAll('#' + containerId + ' .aui-control-label')).map(label => {
            const after = getComputedStyle(label, '::after');
            const ls = getComputedStyle(label);
            if (ls.overflowX === 'visible') return 'not clipped';
            const margin = ls.overflowX === 'clip' ? parseFloat(ls.overflowClipMargin) || 0 : 0;
            return margin + parseFloat(after.right);
        });
    }

    T('G5 the divider lies 1px inside the label\'s clip in every field kind (on its edge, a browser\'s rounding at a fractional place cut it away), on the page and inside the modal',
        {page: [1, 1, 1, 1, 1], modal: [1, 1, 1, 1, 1]},
        async () => {
            apply(s => { s.modalOpen = true; });
            await sleep(600);
            const r = {page: insets('on-page'), modal: insets('in-modal')};
            apply(s => { s.modalOpen = false; });
            await sleep(400);
            return r;
        });

    T('G4 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('aui-* family: the gaps around a label\'s divider', tests);
})();
