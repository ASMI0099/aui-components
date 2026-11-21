// Shared UI of the family (aui-select and aui-tree-select): dropdown, tags, search highlight, scrolled pages.
(function () {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const frames = n => new Promise(res => { let k = 0; (function f() { if (++k > n) res(); else requestAnimationFrame(f); })(); });
    const apply = fn => window.unifyScope.$apply(fn);
    const host = id => document.querySelector('#h-' + id + ' aui-select, #h-' + id + ' aui-tree-select');
    const ctrl = id => { const el = angular.element(host(id)); return el.controller('auiSelect') || el.controller('auiTreeSelect'); };
    const trig = id => host(id).querySelector('.aui-select__trigger');
    const panel = id => host(id).querySelector('.aui-select__panel');
    const key = (el, k, extra) => el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({key: k, bubbles: true, cancelable: true}, extra || {})));
    const typeSearch = (id, text) => {
        const input = host(id).querySelector('.aui-select__search-input');
        input.value = text;
        input.dispatchEvent(new Event('input', {bubbles: true}));
    };
    const visibleTags = id => host(id).querySelector('.aui-select__selected-display > .aui-select__tags');
    const storeIds = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 10; c++) for (let s = 0; s < 10; s++) storeIds.push('r' + r + '-' + c + '-' + s);

    function tagState(id) {
        const box = visibleTags(id);
        if (!box) return {k: 0, count: '', fits: false, oneLine: false};
        const tags = Array.from(box.children).filter(el => el.classList.contains('aui-select__tag') && !el.classList.contains('aui-select__tag--count'));
        const count = box.querySelector('.aui-select__tag--count');
        const right = box.getBoundingClientRect().right;
        const last = box.lastElementChild;
        return {
            k: tags.length,
            count: count ? count.textContent.trim() : '',
            fits: !!last && last.getBoundingClientRect().right <= right + 0.5,
            oneLine: tags.every(t => Math.abs(t.offsetTop - tags[0].offsetTop) < 1)
        };
    }

    /** The tags that fit by the hidden copy's widths (the fit's own rule): to check that a fit is up to date. */
    function expectedFit(id) {
        const box = visibleTags(id);
        const copy = host(id).querySelector('.aui-select__tags-measure > .aui-select__tags');
        if (!box || !copy) return -1;
        const tags = Array.from(copy.children).filter(el => !el.classList.contains('aui-select__tag--count'));
        const countTag = copy.querySelector('.aui-select__tag--count');
        const total = Number(countTag.textContent.replace('+', ''));
        const gap = parseFloat(getComputedStyle(box).columnGap) || 0;
        const countWidth = countTag.getBoundingClientRect().width;
        let used = 0;
        let fit = 0;
        for (let i = 0; i < tags.length; i += 1) {
            const next = used + (i > 0 ? gap : 0) + tags[i].getBoundingClientRect().width;
            if (next + (i + 1 < total ? gap + countWidth : 0) > box.clientWidth + 0.5) break;
            used = next;
            fit = i + 1;
        }
        return fit === 0 && total > 0 ? 1 : fit;
    }

    const tests = [
        ['U1 IME: Enter or Escape during composition leaves the dropdown alone', {composingEnterOpened: false, enterOpened: true, composingEscapeClosed: false, escapeClosed: true}, async () => {
            const t = trig('s1');
            t.focus();
            key(t, 'Enter', {isComposing: true});
            await sleep(80);
            const composingEnterOpened = ctrl('s1').isOpen;
            key(t, 'Enter');
            await sleep(350);
            const enterOpened = ctrl('s1').isOpen;
            const search = host('s1').querySelector('.aui-select__search-input');
            key(search || t, 'Escape', {isComposing: true});
            await sleep(80);
            const composingEscapeClosed = !ctrl('s1').isOpen;
            key(search || t, 'Escape');
            await sleep(400);
            return {composingEnterOpened, enterOpened, composingEscapeClosed, escapeClosed: !ctrl('s1').isOpen};
        }],
        ['U2 reopen within 200 ms of a close: the panel is visible again; callbacks once per open/close', {open: true, openClass: true, opacity: '1', topLayer: true, opens: 2, closes: 2}, async () => {
            const before = Object.assign({}, window.unifyScope.counts);
            trig('s1').click();
            await sleep(300);
            trig('s1').click();
            await sleep(60);
            trig('s1').click();
            await sleep(400);
            const p = panel('s1');
            const out = {open: ctrl('s1').isOpen, openClass: p.classList.contains('aui-select__panel--open'),
                opacity: getComputedStyle(p).opacity, topLayer: p.matches(':popover-open')};
            key(trig('s1'), 'Escape');
            await sleep(400);
            out.opens = window.unifyScope.counts.open - before.open;
            out.closes = window.unifyScope.counts.close - before.close;
            return out;
        }],
        ['U3 search: kept while fading out, reset afterwards (the closed field keeps no rows; the next opening shows all), reset at once on a reopen during the fade', {filtered: 1, duringFade: 'gra', after: '', held: 0, reopened: 8, onReopen: ''}, async () => {
            trig('s1').click();
            await sleep(300);
            typeSearch('s1', 'gra');
            await sleep(50);
            const filtered = ctrl('s1').filteredOptions.length;
            key(trig('s1'), 'Escape');
            await sleep(50);
            const duringFade = ctrl('s1').searchQuery;
            await sleep(400);
            const after = ctrl('s1').searchQuery;
            const held = ctrl('s1').filteredOptions.length;
            trig('s1').click();
            await sleep(300);
            const reopened = ctrl('s1').filteredOptions.length;
            typeSearch('s1', 'ban');
            await sleep(30);
            key(trig('s1'), 'Escape');
            await sleep(60);
            trig('s1').click();
            await sleep(60);
            const onReopen = ctrl('s1').searchQuery;
            key(trig('s1'), 'Escape');
            await sleep(400);
            return {filtered, duringFade, after, held, reopened, onReopen};
        }],
        ['U4 search matches are highlighted; the option text is unchanged', {texts: ['Apple', 'Pineapple', 'Applesauce'], hits: [['App'], ['app'], ['App']], plainHits: 0}, async () => {
            trig('s1').click();
            await sleep(300);
            typeSearch('s1', 'app');
            await sleep(60);
            const lis = Array.from(panel('s1').querySelectorAll('li.aui-select__option'));
            const texts = lis.map(li => li.textContent.trim());
            const hits = lis.map(li => Array.from(li.querySelectorAll('.aui-select__hit')).map(h => h.textContent));
            typeSearch('s1', '');
            await sleep(60);
            const plainHits = panel('s1').querySelectorAll('.aui-select__hit').length;
            key(trig('s1'), 'Escape');
            await sleep(400);
            return {texts, hits, plainHits};
        }],
        ['U4b on selected (checked) rows the match box is stronger and its text darker, in both components',
            {select: {plain: ['rgba(13, 110, 253, 0.12)', 'rgb(10, 88, 202)'], selected: ['rgba(13, 110, 253, 0.24)', 'rgb(7, 55, 126)']},
                tree: {plain: ['rgba(13, 110, 253, 0.12)', 'rgb(10, 88, 202)'], selected: ['rgba(13, 110, 253, 0.24)', 'rgb(7, 55, 126)']}},
            async () => {
                // a colour as rgb() / rgba() with whole channels, whichever notation the browser gives it (the shades
                // drawn by color-mix() come as color(srgb r g b / a))
                const asRgb = c => {
                    const m = /^color\(srgb ([0-9.]+) ([0-9.]+) ([0-9.]+)(?: \/ ([0-9.]+))?\)$/.exec(c);
                    if (!m) return c;
                    const ch = v => Math.round(parseFloat(v) * 255);
                    return m[4] !== undefined ? 'rgba(' + ch(m[1]) + ', ' + ch(m[2]) + ', ' + ch(m[3]) + ', ' + parseFloat(m[4]) + ')'
                        : 'rgb(' + ch(m[1]) + ', ' + ch(m[2]) + ', ' + ch(m[3]) + ')';
                };
                const hitStyle = li => {
                    const style = getComputedStyle(li.querySelector('.aui-select__hit'));
                    return [asRgb(style.backgroundColor), asRgb(style.color)];
                };
                const sample = id => {
                    const lis = Array.from(panel(id).querySelectorAll('li.aui-select__option')).filter(li => li.querySelector('.aui-select__hit'));
                    return {
                        plain: hitStyle(lis.find(li => !li.classList.contains('aui-select__option--selected'))),
                        selected: hitStyle(lis.find(li => li.classList.contains('aui-select__option--selected')))
                    };
                };
                apply(() => { window.unifyScope.m.s5 = 1; window.unifyScope.m.t1 = ['r0']; });   // Apple; Group 0
                trig('s5').click();
                await sleep(300);
                typeSearch('s5', 'app');
                await sleep(60);
                const select = sample('s5');
                key(trig('s5'), 'Escape');
                await sleep(400);
                trig('t1').click();
                await sleep(300);
                typeSearch('t1', 'group');
                await sleep(100);
                const tree = sample('t1');
                key(trig('t1'), 'Escape');
                await sleep(400);
                apply(() => { window.unifyScope.m.s5 = null; window.unifyScope.m.t1 = []; });
                return {select, tree};
            }],
        ['U5 drop-down-panel-background-opacity="OPAQUE_LIKE" is applied', {opaque: 'rgba(255, 255, 255, 0.8)', blur: 'blur(8px)', plain: ''}, async () => {
            return {opaque: panel('s2').style.backgroundColor, blur: panel('s2').style.backdropFilter, plain: panel('s1').style.backgroundColor};
        }],
        ['U6 at most 100 tags are rendered; the "+N" tooltip lists 50 labels, then a count', {tags150: 100, count150: '+50', parts150: 50, tags200: 100, count200: '+100', parts200: 51, end200: true}, async () => {
            apply(() => { window.unifyScope.m.s3 = window.unifyScope.many.slice(0, 150).map(o => o.id); });
            await frames(2);
            const t150 = tagState('s3');
            const title150 = visibleTags('s3').querySelector('.aui-select__tag--count').title;
            apply(() => { window.unifyScope.m.s3 = window.unifyScope.many.slice(0, 200).map(o => o.id); });
            await frames(2);
            const t200 = tagState('s3');
            const title200 = visibleTags('s3').querySelector('.aui-select__tag--count').title;
            return {tags150: t150.k, count150: t150.count, parts150: title150.split(', ').length,
                tags200: t200.k, count200: t200.count, parts200: title200.split(', ').length, end200: title200.endsWith('… +50 more')};
        }],
        ['U7 max-tag-count="responsive": one line, "+N" for the rest, follows the width; a first tag that does not fit is cut, readable, or only the count shows', {some: true, countMatches: true, fits: true, oneLine: true, wider: true, cut: {found: true, readable: true, fits: true}, narrow: {k: 0, count: '+20', fits: true}}, async () => {
            apply(() => { window.unifyScope.m.s4 = window.unifyScope.many.slice(0, 20).map(o => o.id); });
            await frames(3);
            await sleep(100);
            const a = tagState('s4');
            document.getElementById('h-s4').style.width = '700px';
            await sleep(300);
            const b = tagState('s4');
            // room for the first tag only when cut (at least two letters of it show), then for no readable part of it.
            // The width where it is cut depends on the system's fonts, so the field is narrowed step by step: some
            // width shows the first tag cut, and every cut shows at least two letters of it (24px).
            const cuts = [];
            for (let width = 216; width >= 112; width -= 8) {
                document.getElementById('h-s4').style.width = width + 'px';
                await sleep(300);
                const s = tagState('s4');
                const text = visibleTags('s4').querySelector('.aui-select__tag:not(.aui-select__tag--count) .aui-select__tag-text');
                if (s.k === 1 && text && text.scrollWidth > text.clientWidth) cuts.push({readable: text.getBoundingClientRect().width >= 23.5, fits: s.fits});
            }
            const cut = {found: cuts.length > 0, readable: cuts.every(c => c.readable), fits: cuts.every(c => c.fits)};
            document.getElementById('h-s4').style.width = '100px';
            await sleep(300);
            const d = tagState('s4');
            document.getElementById('h-s4').style.width = '';
            await sleep(300);
            return {some: a.k >= 1 && a.k < 20, countMatches: a.count === '+' + (20 - a.k) && b.count === (b.k < 20 ? '+' + (20 - b.k) : ''),
                fits: a.fits && b.fits, oneLine: a.oneLine && b.oneLine, wider: b.k > a.k, cut, narrow: {k: d.k, count: d.count, fits: d.fits}};
        }],
        ['U8 scrolled page (html height 100%), little room below: the panel opens above, fully in view', {above: true, inView: true}, async () => {
            // Common admin layout: <html> is one viewport tall while the page scrolls.
            document.documentElement.style.height = '100%';
            await frames(2);
            const t = trig('s5');
            const r = t.getBoundingClientRect();
            window.scrollTo(0, window.scrollY + r.bottom - (window.innerHeight - 30));
            await frames(2);
            t.click();
            await sleep(400);
            const p = panel('s5');
            const pr = p.getBoundingClientRect();
            const out = {above: p.classList.contains('aui-select__panel--top'), inView: pr.height > 0 && pr.top >= -0.5 && pr.bottom <= window.innerHeight + 0.5};
            key(t, 'Escape');
            await sleep(400);
            window.scrollTo(0, 0);
            document.documentElement.style.height = '';
            await frames(2);
            return out;
        }],
        ['U8b scrolled page (html height 100%), room below: the panel opens below, fully in view', {below: true, inView: true}, async () => {
            document.documentElement.style.height = '100%';
            await frames(2);
            const t = trig('s5');
            const r = t.getBoundingClientRect();
            window.scrollTo(0, window.scrollY + r.top - 80);   // trigger 80px below the top of the viewport
            await frames(2);
            t.click();
            await sleep(400);
            const p = panel('s5');
            const pr = p.getBoundingClientRect();
            const out = {below: p.classList.contains('aui-select__panel--bottom'), inView: pr.height > 0 && pr.top >= -0.5 && pr.bottom <= window.innerHeight + 0.5};
            key(t, 'Escape');
            await sleep(400);
            window.scrollTo(0, 0);
            document.documentElement.style.height = '';
            await frames(2);
            return out;
        }],
        ['U9 destroyed while open: on-close once, nothing left behind, no errors', {closeCalls: 1, left: 0, errors: 0}, async () => {
            trig('s6').click();
            await sleep(300);
            apply(() => { window.unifyScope.show.s6 = false; });
            await sleep(300);
            return {closeCalls: window.unifyScope.counts.close6, left: document.querySelectorAll('#h-s6 .aui-select__panel').length, errors: window.__ngErrors.length};
        }],
        ['T1 tree: at most 100 tags are rendered', {model: 150, tags: 150, dom: 100, count: '+50'}, async () => {
            apply(() => { window.unifyScope.m.t1 = storeIds.slice(0, 150); });
            await frames(2);
            const s = tagState('t1');
            return {model: window.unifyScope.m.t1.length, tags: ctrl('t1').tags.length, dom: s.k, count: s.count};
        }],
        ['T2 tree: max-tag-count="responsive"', {some: true, countMatches: true, fits: true, oneLine: true}, async () => {
            apply(() => { window.unifyScope.m.t2 = storeIds.slice(0, 20); });
            await frames(3);
            await sleep(100);
            const s = tagState('t2');
            return {some: s.k >= 1 && s.k < 20, countMatches: s.count === '+' + (20 - s.k), fits: s.fits, oneLine: s.oneLine};
        }],
        ['T3 tree, lazy: the search box does not appear when a branch loads', {before: false, rows: 7, after: false}, async () => {
            trig('t3').click();
            await sleep(500);
            const before = !!host('t3').querySelector('.aui-select__search-input');
            host('t3').querySelector('li.aui-tree-select__node .aui-tree-select__caret').click();
            await sleep(500);
            const rows = ctrl('t3').rows.length;
            const after = !!host('t3').querySelector('.aui-select__search-input');
            key(trig('t3'), 'Escape');
            await sleep(400);
            return {before, rows, after};
        }],
        ['U9 responsive in a layout-table cell, shown with 30 saved values: the field keeps the width its cell gives it, also when a tag is added (no growth, no re-fit cascade)',
            {tableKept: true, steady: true, fits: true, some: true}, async () => {
            const table = () => document.getElementById('h-s7').closest('table');
            const width = () => Math.round(trig('s7').getBoundingClientRect().width);
            apply(() => { window.unifyScope.m.s7 = window.unifyScope.many.slice(0, 30).map(o => o.id); window.unifyScope.show.s7 = true; });
            await frames(3);
            await sleep(150);
            const tableWidth = Math.round(table().getBoundingClientRect().width);
            const before = width();
            apply(() => { window.unifyScope.m.s7 = window.unifyScope.many.slice(0, 31).map(o => o.id); });
            const widths = [];
            for (let i = 0; i < 10; i++) { await frames(1); widths.push(width()); }
            const s = tagState('s7');
            return {tableKept: tableWidth <= 641, steady: widths.every(w => w === before), fits: s.fits, some: s.k >= 1 && s.k < 31};
        }],
        ['U10 responsive: locking the field (disabled: tags without their x) fits the tags again without a new selection',
            {lockedCopy: true, upToDate: true, fits: true, countMatches: true, unlockedUpToDate: true}, async () => {
            apply(() => { window.unifyScope.m.s4 = window.unifyScope.many.slice(0, 20).map(o => o.id); window.unifyScope.show.s4Disabled = false; });
            await frames(3);
            await sleep(100);
            apply(() => { window.unifyScope.show.s4Disabled = true; });
            await frames(3);
            await sleep(100);
            const locked = tagState('s4');
            const copy = host('s4').querySelector('.aui-select__tags-measure > .aui-select__tags');
            const lockedCopy = !!copy && Array.from(copy.children).filter(t => !t.classList.contains('aui-select__tag--count'))
                .every(t => t.classList.contains('aui-select__tag--locked') && !t.querySelector('.aui-select__tag-remove'));
            const upToDate = locked.k === expectedFit('s4');
            apply(() => { window.unifyScope.show.s4Disabled = false; });
            await frames(3);
            await sleep(100);
            return {lockedCopy, upToDate, fits: locked.fits, countMatches: locked.count === '+' + (20 - locked.k),
                unlockedUpToDate: tagState('s4').k === expectedFit('s4')};
        }],
        ['U11 responsive: the hidden copy has no Angular bindings, so the watchers do not grow with the selected values',
            {plainCopy: true, flat: true}, async () => {
            const root = window.unifyScope.$root;
            apply(() => { window.unifyScope.m.s4 = window.unifyScope.many.slice(0, 20).map(o => o.id); });
            await frames(3);
            await sleep(100);
            const w20 = root.$$watchersCount;
            const k20 = tagState('s4').k;
            apply(() => { window.unifyScope.m.s4 = window.unifyScope.many.slice(0, 90).map(o => o.id); });
            await frames(3);
            await sleep(100);
            const w90 = root.$$watchersCount;
            const k90 = tagState('s4').k;
            const copy = host('s4').querySelector('.aui-select__tags-measure');
            return {plainCopy: !!copy && !copy.classList.contains('ng-scope') && !copy.querySelector('.ng-scope, .ng-binding')
                    && copy.querySelectorAll('.aui-select__tag').length === 91,
                flat: (w90 - w20) <= Math.abs(k90 - k20) * 8 + 4};
        }]
    ];

    tests.push(['U8 the small parts of the field are drawn with it on whole pixels: no compositor layer kept for good on the chevron, the clear button or the remove button of a tag (a layer only while one moves); the divider of the label is not moved by a transform',
        {chevron: 'auto', clear: 'auto', tagRemove: 'auto', divider: 'none'},
        async () => {
            const st = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).willChange : 'missing'; };
            const probe = document.createElement('div');
            probe.className = 'aui-select';
            probe.innerHTML = '<div class="aui-control-label">Label</div><span class="aui-control-clear"></span>';
            document.body.appendChild(probe);
            const divider = getComputedStyle(probe.firstChild, '::after').transform;
            const clear = getComputedStyle(probe.querySelector('.aui-control-clear')).willChange;
            probe.remove();
            return {chevron: st('.aui-select__chevron'), clear, tagRemove: st('.aui-select__tag-remove'), divider};
        }]);

    tests.push(['U9 an open list: its search box, focused, has the accent border (a focus mark of 3:1 and more; its light shade was 2:1); its unchecked boxes the family checkbox\'s border (#8792a2, 3:1; it was 1.5:1)',
        {select: {focused: true, search: 'rgb(13, 110, 253)', box: 'rgb(135, 146, 162)'}, tree: {focused: true, search: 'rgb(13, 110, 253)', box: 'rgb(135, 146, 162)'}},
        async () => {
            const look = async id => {
                const t = trig(id);
                t.focus();
                key(t, 'Enter');
                await sleep(400);
                const search = host(id).querySelector('.aui-select__search-input');
                const out = {focused: document.activeElement === search, search: getComputedStyle(search).borderTopColor};
                if (id[0] === 't') {
                    const box = [...panel(id).querySelectorAll('.aui-tree-select__checkbox')].find(c => getComputedStyle(c).backgroundColor === 'rgb(255, 255, 255)');
                    out.box = box ? getComputedStyle(box).borderTopColor : 'none unchecked';
                } else {
                    const row = [...panel(id).querySelectorAll('li.aui-select__option')].find(li => getComputedStyle(li, '::before').backgroundColor === 'rgb(255, 255, 255)');
                    out.box = row ? getComputedStyle(row, '::before').borderTopColor : 'none unchecked';
                }
                key(search, 'Escape');
                await sleep(400);
                return out;
            };
            return {select: await look('s3'), tree: await look('t1')};
        }]);

    tests.push(['U10 the search box of an open list: "Search..." unless the field sets search-placeholder; search-placeholder="" shows none (both components)',
        {select: {given: 'Search...', none: ''}, tree: {given: 'Search...', none: ''}},
        async () => {
            const hint = async id => {
                const t = trig(id);
                t.focus();
                key(t, 'Enter');
                await sleep(350);
                const search = host(id).querySelector('.aui-select__search-input');
                const text = search ? search.getAttribute('placeholder') : 'no search box';
                key(search || t, 'Escape');
                await sleep(400);
                return text;
            };
            return {select: {given: await hint('s3'), none: await hint('s8')}, tree: {given: await hint('t1'), none: await hint('t4')}};
        }]);

    tests.push(['U11 several values: a checked row keeps the tint and the text shade, in the weight of the other rows (not bold: the checkbox shows the state); both components',
        {select: {sameWeight: true, blue: true, tint: true}, tree: {sameWeight: true, blue: true, tint: true}},
        async () => {
            const look = async id => {
                const t = trig(id);
                t.focus();
                key(t, 'Enter');
                await sleep(400);
                const rows = () => Array.from(panel(id).querySelectorAll('li.aui-select__option'));
                if (!rows().some(li => li.classList.contains('aui-select__option--selected'))) {
                    const first = rows().find(li => li.getAttribute('aria-checked') === 'false' || li.getAttribute('aria-selected') === 'false');
                    if (first) first.click();
                    await sleep(100);
                }
                const on = rows().find(li => li.classList.contains('aui-select__option--selected'));
                const cs = el => getComputedStyle(el);
                // the colour as rgb() (a color-mix() result is given as color(srgb r g b))
                const rgb = c => { const m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(c); return m ? 'rgb(' + [m[1], m[2], m[3]].map(v => Math.round(v * 255)).join(', ') + ')' : c; };
                // the weight of the other rows: the list's own (a row sets none of its own)
                const out = {sameWeight: !!on && cs(on).fontWeight === cs(on.parentElement).fontWeight,
                    blue: !!on && rgb(cs(on).color) === 'rgb(10, 88, 202)', tint: !!on && cs(on).backgroundImage !== 'none'};
                key(host(id).querySelector('.aui-select__search-input') || t, 'Escape');
                await sleep(400);
                return out;
            };
            return {select: await look('s3'), tree: await look('t1')};
        }]);

    AuiTest.run('aui-* family: shared UI', tests);
})();
