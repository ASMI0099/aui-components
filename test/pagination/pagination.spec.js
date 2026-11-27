// Pagination suite (page: pagination.html, fixture: pagination.fixture.js): the parts and the pager (first and last
// always, ellipses), a page, previous / next and their ends, an ellipsis 5 pages on, a page size (the first item kept in
// view), the page to go to, loading (the binding and the page model's -1), the page model (written before its handler;
// a copy given), a model changed in place, hidden when empty, one page, simple, layout, a narrow place, a page's rules,
// names for screen readers, watchers.
(function () {
    const {sleep, until} = AuiTest;
    const scope = () => angular.element(document.body).scope();
    const apply = fn => { const s = scope(); s.$apply(() => fn(s)); };
    const host = id => document.getElementById(id);
    const nav = id => host(id).querySelector('nav');
    const items = id => Array.from(host(id).querySelectorAll('.aui-pagination__pager > *')).map(el =>
        (el.classList.contains('aui-pagination__prev') ? '<' : el.classList.contains('aui-pagination__next') ? '>' :
            el.classList.contains('aui-pagination__more') ? '...' :
                el.classList.contains('aui-pagination__simple') ? el.querySelector('.aui-pagination__shown').textContent.trim() : el.textContent.trim()) +
        (el.classList && el.classList.contains('aui-pagination__page--current') ? '*' : ''));
    // the total's text shown (its widest form is hidden under it)
    const totalText = id => host(id).querySelector('.aui-pagination__total .aui-pagination__shown').textContent.trim();
    const status = id => host(id).querySelector('.aui-pagination__status').textContent.trim();
    const busy = id => nav(id).classList.contains('aui-pagination--loading');
    const btn = (id, go) => host(id).querySelector('[data-go="' + go + '"]');
    const shown = (id, part) => { const el = host(id).querySelector('.aui-pagination__' + part); return !!el && el.getClientRects().length > 0; };
    // the page to go to: the native box inside its aui-input
    const input = id => host(id).querySelector('.aui-pagination__jumper aui-input input');
    const typeIn = (box, text) => { box.focus(); box.value = text; box.dispatchEvent(new Event('input', {bubbles: true})); };
    const frames = AuiTest.frames;
    const count = s => { let n = (s.$$watchers || []).length; for (let c = s.$$childHead; c; c = c.$$nextSibling) n += count(c); return n; };

    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('P1 the parts: the total (thousands separated), the page size, the pager (first and last always, the current one among its neighbours, an ellipsis only where 2 or more pages are left out), the page to go to; a nav named Pagination, the current page aria-current',
        {total: 'Total 1,000', size: '10 / page', pager: ['<', '1', '2', '3', '4', '5*', '6', '7', '...', '100', '>'], label: 'Pagination', current: 'page', jumper: true},
        async () => ({total: totalText('p-main'),
            size: host('p-main').querySelector('.aui-select__display-text, .aui-select__selected-display').textContent.trim(),
            pager: items('p-main'), label: nav('p-main').getAttribute('aria-label'),
            current: btn('p-main', '5').getAttribute('aria-current'), jumper: shown('p-main', 'jumper')}));

    T('P2 a page, previous and next: on-change with $page, $pageSize, $source; the pager follows',
        {log: [[7, 10, 'page'], [6, 10, 'previous'], [7, 10, 'next']], current: '7'},
        async () => {
            scope().log.length = 0;
            btn('p-main', '7').click();
            await frames(1);
            btn('p-main', 'previous').click();
            await frames(1);
            btn('p-main', 'next').click();
            await frames(1);
            return {log: scope().log.slice(), current: host('p-main').querySelector('[aria-current="page"]').textContent.trim()};
        });

    T('P3 an ellipsis moves 5 pages (named so); previous is off on the first page, next on the last',
        {more: [12, 10, 'more'], label: 'Next 5 pages', firstPrev: true, lastNext: true},
        async () => {
            scope().log.length = 0;
            const more = btn('p-main', 'more-on');
            const label = more.getAttribute('aria-label');
            more.click();
            await frames(1);
            const out = {more: scope().log[0], label};
            apply(s => { s.v.page = 1; });
            out.firstPrev = btn('p-main', 'previous').disabled;
            apply(s => { s.v.page = 100; });
            out.lastNext = btn('p-main', 'next').disabled;
            apply(s => { s.v.page = 5; });
            return out;
        });

    T('P4 a page size: the first item of the page stays in view (page 5 of 10 a page, items 41-50: page 3 of 20)',
        {log: [3, 20, 'size']},
        async () => {
            scope().log.length = 0;
            const ctrl = angular.element(host('p-main')).controller('auiPagination');
            apply(() => { ctrl.sizeValue = 20; ctrl.sizeChosen(); });
            const out = {log: scope().log[0]};
            apply(s => { s.v.page = 5; s.v.size = 10; });
            return out;
        });

    T('P5 the page to go to (the family\'s aui-input): Enter takes it; past the last, the last; not a number, nothing (cleared); leaving the box takes it',
        {enter: [12, 10, 'jump'], past: [100, 10, 'jump'], text: 0, cleared: '', leave: [20, 10, 'jump']},
        async () => {
            const box = input('p-main');
            const enter = async () => { box.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true})); await sleep(30); };
            scope().log.length = 0;
            typeIn(box, '12'); await enter();
            const out = {enter: scope().log[0]};
            typeIn(box, '999'); await enter();
            out.past = scope().log[1];
            const n = scope().log.length;
            typeIn(box, 'abc'); await enter();
            out.text = scope().log.length - n;
            out.cleared = box.value;
            typeIn(box, '20'); box.blur();
            await sleep(30);
            out.leave = scope().log[scope().log.length - 1];
            apply(s => { s.v.page = 5; });
            return out;
        });

    // every part's box (the total, the sizes, each pager button, the page to go to), relative to the bar
    const boxes = id => { const n = nav(id).getBoundingClientRect();
        return Array.from(nav(id).querySelectorAll('.aui-pagination__total, .aui-pagination__sizes, .aui-pagination__pager > *, .aui-pagination__jumper'))
            .map(el => { const r = el.getBoundingClientRect(); return [r.left - n.left, r.top - n.top, r.width, r.height].map(v => Math.round(v * 10) / 10).join(','); }).join(' '); };

    T('P6 loading: nothing moves (every part in its place, the total as it was); the spinner in the current page; told to screen readers; no click taken, the focus kept',
        {still: true, total: 'Total 1,000', status: 'Loading', spinner: true, ariaDisabled: 'true', clicks: 0, focus: true, modelStill: true, modelTotal: 'Total 236'},
        async () => {
            const before = boxes('p-main');
            apply(s => { s.v.busy = true; });
            const page7 = btn('p-main', '7');
            page7.focus();
            scope().log.length = 0;
            page7.click();
            const out = {still: boxes('p-main') === before, total: totalText('p-main'),
                status: host('p-main').querySelector('.aui-pagination__status').textContent.trim(),
                spinner: !!host('p-main').querySelector('.aui-pagination__page--current .aui-pagination__spinner'),
                ariaDisabled: page7.getAttribute('aria-disabled'), clicks: scope().log.length, focus: document.activeElement === page7};
            apply(s => { s.v.busy = false; });
            // the page model's older form: its total -1 while the page loads
            const modelBefore = boxes('p-search');
            const was = scope().search.page.totalItemCount;
            apply(s => { s.search.page.totalItemCount = -1; });
            out.modelStill = boxes('p-search') === modelBefore;
            out.modelTotal = totalText('p-search');
            apply(s => { s.search.page.totalItemCount = was; });
            return out;
        });

    T('P7 the page model: the page written into it before its handler (a handler that reads the model), page-size-items as given (over 1000 left out)',
        {seen: ['model 4 10'], model: 4, sizes: ['1 / page', '2 / page', '3 / page', '5 / page', '10 / page', '20 / page']},
        async () => {
            const s = scope();
            btn('p-search', '4').click();
            await frames(1);
            const ctrl = angular.element(host('p-search')).controller('auiPagination');
            return {seen: s.search.seen.slice(), model: s.search.page.currentPage, sizes: ctrl.sizeOptions.map(o => o.label)};
        });

    T('P8 the page model: a handler that reads the copy it is given (not the model itself); the page size changed: both fields in the copy',
        {seen: ['copy 2 5 false', 'copy 1 10 false'], model: [1, 10]},
        async () => {
            const s = scope();
            btn('p-picker', '2').click();
            await frames(1);
            const ctrl = angular.element(host('p-picker')).controller('auiPagination');
            apply(() => { ctrl.sizeValue = 10; ctrl.sizeChosen(); });
            return {seen: s.picker.seen.slice(), model: [s.picker.page.currentPage, s.picker.page.pageItemSize]};
        });

    T('P9 the page model changed in place by the page (a search back on page 1): the pager follows; its total -1 is loading; 0 shows nothing; no page count: worked out',
        {followed: '1', loading: 'Loading', empty: true, pages: '10'},
        async () => {
            apply(s => { s.search.page.currentPage = 1; });
            const followed = host('p-search').querySelector('[aria-current="page"]').textContent.trim();
            const last = Array.from(host('p-nopages').querySelectorAll('.aui-pagination__page')).pop();
            return {followed, loading: host('p-loading').querySelector('.aui-pagination__status').textContent.trim(),
                empty: nav('p-empty').hidden, pages: last ? last.textContent.trim() : null};
        });

    T('P10 one page: no pager and no page to go to; hide-on-single-page: nothing',
        {few: {pager: false, jumper: false, total: true}, single: true},
        async () => ({few: {pager: shown('p-few', 'pager'), jumper: shown('p-few', 'jumper'), total: shown('p-few', 'total')}, single: nav('p-single').hidden}));

    T('P11 simple: previous, "3 / 20", next; layout: only the parts named, in their order',
        {simple: ['<', '3 / 20', '>'], simpleParts: [false, false, false], layout: {total: true, sizes: false, jumper: false, totalAfterPager: true}},
        async () => {
            const pager = host('p-layout').querySelector('.aui-pagination__pager').getBoundingClientRect();
            const total = host('p-layout').querySelector('.aui-pagination__total').getBoundingClientRect();
            return {simple: items('p-simple'), simpleParts: [shown('p-simple', 'total'), shown('p-simple', 'sizes'), shown('p-simple', 'jumper')],
                layout: {total: shown('p-layout', 'total'), sizes: shown('p-layout', 'sizes'), jumper: shown('p-layout', 'jumper'), totalAfterPager: total.left > pager.left}};
        });

    T('P12 a narrow place: the parts give way (the page to go to, the total, the sizes), the pager keeps 5 buttons and fits; wider again, all back',
        {fits: true, parts: [false, false, false], pager: ['<', '1', '...', '49', '50*', '51', '...', '100', '>'], back: [true, true, true]},
        async () => {
            await frames(3);
            const n = nav('p-narrow');
            const out = {fits: n.scrollWidth <= n.clientWidth + 1, parts: [shown('p-narrow', 'jumper'), shown('p-narrow', 'total'), shown('p-narrow', 'sizes')],
                pager: items('p-narrow')};
            host('narrow-box').style.width = '1000px';
            await sleep(100);
            await frames(3);
            out.back = [shown('p-narrow', 'jumper'), shown('p-narrow', 'total'), shown('p-narrow', 'sizes')];
            host('narrow-box').style.width = '';
            return out;
        });

    T('P13 under a page\'s rules for buttons, spans and labels: the same row as without them (height, the page buttons\' size)',
        {same: true},
        async () => {
            const geo = id => { const n = nav(id).getBoundingClientRect(); const b = btn(id, '5').getBoundingClientRect();
                return [Math.round(n.height), Math.round(b.width), Math.round(b.height)].join(','); };
            return {same: geo('p-hostile') === geo('p-clean')};
        });

    T('P14 names: page buttons "Page N", previous / next named; the page size select and the page to go to labelled',
        {page: 'Page 7', prev: 'Previous page', next: 'Next page', jump: 'Go to page'},
        async () => ({page: btn('p-main', '7').getAttribute('aria-label'), prev: btn('p-main', 'previous').getAttribute('aria-label'),
            next: btn('p-main', 'next').getAttribute('aria-label'), jump: input('p-main').getAttribute('aria-label')}));

    T('P15 no deep watch, the pager without watchers: the same watchers for 1 page and for 100, the page model or not (its page-size select\'s own)',
        {same: true},
        async () => {
            const n = id => count(angular.element(host(id)).isolateScope());
            return {same: n('p-main') === n('p-few') && n('p-few') === n('p-search')};
        });

    T('P16 the fields\' sizes: sm 28px (13px text), md 34px (14px, the default), lg 40px (15px) - its page buttons, select and field as tall as an aui-input of that size',
        {sm: [28, 28, 28, 28, '13px'], md: [34, 34, 34, 34, '14px'], lg: [40, 40, 40, 40, '15px']},
        async () => {
            const h = el => Math.round(el.getBoundingClientRect().height);
            const row = (id, field) => [h(btn(id, '5')), h(host(id).querySelector('.aui-select__trigger')),
                h(host(id).querySelector('.aui-pagination__jumper .aui-input__form-trigger')), h(host(field).querySelector('.aui-input__form-trigger')),
                getComputedStyle(btn(id, '5')).fontSize];
            return {sm: row('p-sm', 'f-sm'), md: row('p-main', 'f-md'), lg: row('p-lg', 'f-lg')};
        });

    T('P17 nothing moves from page to page: the pager as wide on every page (as many items; one button width from the last page\'s digits), the parts after it in place; "3 / 20" in the room of "20 / 20"',
        {main: 1, wide: 1, simple: 1, counts: [11], widths: 1},
        async () => {
            const geo = id => { const p = host(id).querySelector('.aui-pagination__pager').getBoundingClientRect();
                const j = host(id).querySelector('.aui-pagination__jumper').getBoundingClientRect();
                return Math.round(p.width * 10) + '/' + Math.round(j.left * 10); };
            const main = new Set();
            const wide = new Set();
            const simple = new Set();
            const counts = new Set();
            const widths = new Set();
            for (const p of [1, 4, 5, 6, 50, 95, 96, 100]) { apply(s => { s.v.page = p; }); main.add(geo('p-main')); counts.add(items('p-main').length); }
            apply(s => { s.v.page = 5; });
            for (const p of [1, 97, 100, 1000, 1996, 2000]) {
                apply(s => { s.w.page = p; });
                wide.add(geo('p-wide'));
                host('p-wide').querySelectorAll('.aui-pagination__page, .aui-pagination__more').forEach(b => widths.add(Math.round(b.getBoundingClientRect().width * 10)));
            }
            for (const p of [1, 9, 10, 20]) { apply(s => { s.sw.page = p; }); simple.add(Math.round(btn('p-simple2', 'next').getBoundingClientRect().left * 10)); }
            return {main: main.size, wide: wide.size, simple: simple.size, counts: Array.from(counts), widths: widths.size};
        });

    T('P18 a box just under the whole bar: page changes never make a part give way or come back',
        {same: 1, yielded: true},
        async () => {
            const box = host('limit-box');
            const n = nav('p-limit');
            box.style.width = '2000px';
            await sleep(30);
            await frames(2);
            let right = 0;
            Array.from(n.children).forEach(c => { const r = c.getBoundingClientRect(); if (r.width) right = Math.max(right, r.right); });
            box.style.width = Math.floor(right - n.getBoundingClientRect().left - 5) + 'px';
            await sleep(30);
            await frames(2);
            const classes = new Set();
            for (const p of [4, 5, 6, 1, 44, 40, 41]) { apply(s => { s.lim.page = p; }); await frames(2); classes.add(n.className); }
            const out = {same: classes.size, yielded: /--no-jumper/.test(n.className)};
            box.style.width = '';
            return out;
        });

    T('P19 the focus: Next onto the last page - on the page shown (Next is off now); in the simple form on Previous',
        {main: '100', simple: 'previous'},
        async () => {
            apply(s => { s.v.page = 99; });
            btn('p-main', 'next').focus();
            btn('p-main', 'next').click();
            await frames(1);
            const main = document.activeElement.getAttribute('data-go');
            apply(s => { s.v.page = 5; });
            apply(s => { s.sw.page = 19; });
            btn('p-simple2', 'next').focus();
            btn('p-simple2', 'next').click();
            await frames(1);
            const simple = document.activeElement.getAttribute('data-go');
            apply(s => { s.sw.page = 1; });
            return {main, simple};
        });

    T('P20 the total went down (the last item of the last page deleted): the last page chosen and the page told ($source total), once; not while loading, after it; the page model too',
        {first: [[43, 'total']], shown: '43', again: 1, loading: 1, after: [[43, 'total'], [42, 'total']], model: [4], modelPage: 4},
        async () => {
            const s = scope();
            apply(x => { x.cl.total = 430; });
            const out = {first: s.cl.log.slice(), shown: host('p-clamp').querySelector('[aria-current="page"]').textContent.trim()};
            apply(x => { x.cl.total = 425; });
            out.again = s.cl.log.length;
            apply(x => { x.cl.busy = true; x.cl.total = 420; });
            out.loading = s.cl.log.length;
            apply(x => { x.cl.busy = false; });
            out.after = s.cl.log.slice();
            apply(x => { x.clm.page.totalItemCount = 40; x.clm.page.totalPageCount = 4; });
            out.model = s.clm.seen.slice();
            out.modelPage = s.clm.page.currentPage;
            return out;
        });

    T('P21 total-text: "range" (item counts thousands separated; in the room of its widest text, the parts after it in place); a text of the page\'s ({pages}, {size}, {total})',
        {first: '1–10 of 60,000', last: '59,991–60,000 of 60,000', still: true, own: '217 pages, 20 a page, 4,321 items'},
        async () => {
            const left = () => Math.round(host('p-range').querySelector('.aui-pagination__sizes').getBoundingClientRect().left * 10);
            apply(s => { s.r.page = 1; });
            const out = {first: totalText('p-range')};
            const at1 = left();
            apply(s => { s.r.page = 6000; });
            out.last = totalText('p-range');
            out.still = left() === at1;
            apply(s => { s.r.page = 1; });
            out.own = totalText('p-own-text');
            return out;
        });

    T('P22 a promise returned by on-change ($q\'s, the browser\'s own): the loading look at once, no second request, until it settles (resolved or rejected); then "Page 3 of 20" told',
        {busy: true, status: 'Loading', log: [3], after: false, told: 'Page 3 of 20', rejected: false, native: [true, false]},
        async () => {
            const s = scope();
            btn('p-promise', '3').click();
            const out = {busy: busy('p-promise'), status: status('p-promise')};
            btn('p-promise', '4').click();
            out.log = s.pr.log.slice();
            apply(x => { x.pr.d.resolve(); });
            out.after = busy('p-promise');
            out.told = status('p-promise');
            btn('p-promise', '5').click();
            apply(x => { x.pr.d.reject('failed'); });
            out.rejected = busy('p-promise');
            btn('p-native', '2').click();
            const nativeBusy = busy('p-native');
            s.nt.done();
            await sleep(30);
            out.native = [nativeBusy, busy('p-native')];
            return out;
        });

    T('P23 search="sm.search": called on each change with (currentPage, pageItemSize) as a method of its search model, the page model written first; an expression with $page; a search that returns its request: the loading look',
        {calls: [[2, 10, true, 2, 2, 10], [1, 20, true, 2, 1, 20]], expr: [[3, 'all']], slow: [true, false]},
        async () => {
            const s = scope();
            btn('p-sfn', '2').click();
            const ctrl = angular.element(host('p-sfn')).controller('auiPagination');
            apply(() => { ctrl.sizeValue = 20; ctrl.sizeChosen(); });
            btn('p-sexpr', '3').click();
            btn('p-sslow', '2').click();
            const slow = [busy('p-sslow')];
            apply(x => { x.ss.d.resolve(); });
            slow.push(busy('p-sslow'));
            return {calls: s.sm.calls.slice(), expr: s.sx.calls.slice(), slow};
        });

    T('P24 the bindings form: the page chosen stays shown when current-page is not set from on-change (a redraw does not take it back)',
        {shown: '3', afterRedraw: '3'},
        async () => {
            const cur = () => host('p-sexpr').querySelector('[aria-current="page"]').textContent.trim();
            const shown = cur();
            // a redraw (as for a binding's change): the page chosen kept
            const ctrl = angular.element(host('p-sexpr')).controller('auiPagination');
            apply(() => { ctrl.$onChanges({}); });
            return {shown, afterRedraw: cur()};
        });

    T('P25 scroll-to: after the user\'s change, once loaded, the list\'s top brought into view in its scroll box (the window not moved); not while loading; not when its top is in view',
        {whileLoading: true, scrolled: 40, windowStill: true, visibleStill: 0},
        async () => {
            const box = host('scroll-box');
            const wy = window.scrollY;
            box.scrollTop = box.scrollHeight;
            const bottom = box.scrollTop;
            btn('p-scroll', 'next').click();
            await frames(2);
            const out = {whileLoading: box.scrollTop === bottom};
            apply(s => { s.sc.busy = false; });
            await frames(2);
            out.scrolled = Math.round(box.scrollTop);
            out.windowStill = window.scrollY === wy;
            box.scrollTop = 0;
            btn('p-scroll', 'next').click();
            apply(s => { s.sc.busy = false; });
            await frames(2);
            out.visibleStill = box.scrollTop;
            return out;
        });

    T('P26 a size changed by a script (a side panel, a splitter): fitted in that frame - no frame painted past its box; at a footer\'s end (its width follows its content): fits, no observer loop error',
        {over: 0, footFits: true, roErrors: 0},
        async () => {
            const box = host('rs-box');
            const n = nav('p-rs');
            let over = 0;
            // an observer made after the component's: it sees what is painted in each frame
            const ro = new ResizeObserver(() => { if (n.scrollWidth > n.clientWidth + 1) over += 1; });
            ro.observe(box);
            for (let w = 1000; w >= 300; w -= 30) { box.style.width = w + 'px'; await sleep(20); }
            ro.disconnect();
            box.style.width = '1000px';
            const foot = host('foot');
            const fn = nav('p-foot');
            for (let w = 1000; w >= 300; w -= 30) { foot.style.width = w + 'px'; await sleep(20); }
            await frames(3);
            const out = {over, footFits: fn.scrollWidth <= fn.clientWidth + 1 && fn.getBoundingClientRect().right <= foot.getBoundingClientRect().right + 1,
                roErrors: window.__roErrors.length};
            foot.style.width = '1000px';
            await frames(2);
            return out;
        });

    T('P27 a font that arrives later (its parts wider, the bar not): fitted again; all back when it is gone',
        {before: true, fits: true, back: true},
        async () => {
            const n = nav('p-font');
            n.style.letterSpacing = '20px';
            await frames(2);
            const out = {before: n.scrollWidth > n.clientWidth + 1};
            document.fonts.dispatchEvent(new Event('loadingdone'));
            await frames(2);
            out.fits = n.scrollWidth <= n.clientWidth + 1;
            n.style.letterSpacing = '';
            document.fonts.dispatchEvent(new Event('loadingdone'));
            await frames(2);
            out.back = !/--no-/.test(n.className);
            return out;
        });

    T('P28 hidden (a tab not shown): left as it was; shown again - at the same width the parts as before, at a new width already fitted to it - in the first frame painted',
        {hiddenSame: true, sameWidth: true, newWidth: true},
        async () => {
            const box = host('narrow-box');
            const n = nav('p-narrow');
            await frames(2);
            const fitted = n.className;
            // the class in the first frame painted once shown (an observer made after the component's sees it)
            const firstFrame = async () => {
                let painted = null;
                const ro = new ResizeObserver(() => { if (painted === null) painted = n.className; });
                box.style.display = '';
                ro.observe(n);
                await frames(2);
                ro.disconnect();
                return painted;
            };
            box.style.display = 'none';
            await frames(2);
            const out = {hiddenSame: n.className === fitted};
            out.sameWidth = await firstFrame() === fitted;
            box.style.display = 'none';
            box.style.width = '1000px';
            await frames(2);
            out.newWidth = !/--no-|--simple/.test(await firstFrame());
            box.style.width = '';
            await frames(2);
            return out;
        });

    T('P99 no Angular errors, no observer loop errors', {errors: [], ro: []}, async () => ({errors: window.__ngErrors.slice(), ro: window.__roErrors.slice()}));

    AuiTest.run('aui-* family: aui-pagination', tests);
})();
