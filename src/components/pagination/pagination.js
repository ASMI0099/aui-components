/**
 * aui-pagination: the pages of a list - the total, the page size, the pager and a page to go to.
 */
angular.module('aui')
    /**
     * aui-pagination. Ways to drive it (they can be used together):
     * - current-page, page-size, total (one-way) and on-change="vm.load($page, $pageSize, $source)" ($source: page,
     *   previous, next, more (an ellipsis: 5 pages on), jump, size, total (the page put back on the last one: the total
     *   went down)); loading="vm.busy" while a page loads.
     * - page-model="vm.page": an object {currentPage, pageItemSize, totalItemCount, totalPageCount} the component writes
     *   the page chosen into (currentPage, pageItemSize), then calls on-page-data-change (a function, given a copy of
     *   it); totalItemCount -1: loading (the older form of loading). A model with no items shows nothing.
     * - search="vm.sm.search": the page's search function, called on each change with (currentPage, pageItemSize) as a
     *   method of its object, after the page model is written; or an expression with $page and $pageSize.
     * - A promise returned by on-change, on-page-data-change or search (its request): the loading look until it settles.
     * - page-size-items: the page sizes offered ([10, 20, 50, 100] by default; over 1000 left out). layout: its parts
     *   and their order, "total, sizes, pager, jumper" by default; total-text: the total's text - "range" ("41-50 of
     *   437"), or a text with {total}, {pages}, {size}, {page}, {from}, {to} ("Total 437" by default); pager-count: page
     *   buttons with the first and the last (7 by default, odd, 5 to 21); simple: previous, "3 / 20", next;
     *   hide-on-single-page; size: the fields' sizes - sm / small (28px), md (34px, the default), lg / large (40px);
     *   disabled; aria-label (its name, "Pagination" by default); scroll-to: a selector of the list - its top brought
     *   into view after the user's change, once the page is shown (only when it is above its scroll box's top).
     * - Nothing moves from page to page: the pager has as many items on every page, its page buttons one width (from the
     *   digits of the last page); the total and "3 / 20" keep the room of their widest text. Changing the page size
     *   keeps the first item of the page in view. The page to go to: Enter or leaving it; past the ends the nearest end;
     *   anything else is cleared. While loading the buttons take no click (the focus stays). In a narrow place its parts
     *   give way in order (the page to go to, the total, the page sizes) before the pager would not fit - fitted in the
     *   frame of the change.
     * The pager is drawn without watchers: only when the page, the pages or the look change.
     */
    .component('auiPagination', {
        bindings: {
            pageModel: '=?',
            pageSizeItems: '<?',
            onPageDataChange: '<?',
            currentPage: '<?',
            pageSize: '<?',
            total: '<?',
            loading: '<?',
            disabled: '<?',
            simple: '<?',
            hideOnSinglePage: '<?',
            pagerCount: '<?',
            layout: '@?',
            totalText: '@?',
            size: '@?',
            ariaLabel: '@?',
            scrollTo: '@?',
            onChange: '&?'
        },
        template: `
            <nav class="aui-pagination">
                <span class="aui-pagination__status" aria-live="polite"></span>
                <span class="aui-pagination__total"><span class="aui-pagination__sizer" aria-hidden="true"></span><span
                    class="aui-pagination__shown"></span></span>
                <span class="aui-pagination__sizes"><aui-select ng-model="$ctrl.sizeValue" options="$ctrl.sizeOptions" value-field="value"
                    label-field="label" searchable="false" size="{{ $ctrl.selectSize }}" disabled="$ctrl.isLocked()"
                    aria-label="{{ $ctrl.t.perPageLabel }}" ng-change="$ctrl.sizeChosen()"></aui-select></span>
                <span class="aui-pagination__pager"></span>
                <span class="aui-pagination__jumper"><span class="aui-pagination__jumper-text" aria-hidden="true"></span><aui-input
                    ng-model="$ctrl.jumpText" input-style-type="form" size="{{ $ctrl.selectSize }}" width="{{ $ctrl.jumpWidth }}"
                    inputmode="numeric" aria-label="{{ $ctrl.t.goToLabel }}" disabled="$ctrl.jumpDisabled" readonly="$ctrl.jumpReadonly"
                    on-finish="$ctrl.jumpFinish()"></aui-input></span>
            </nav>`,
        controller: ['$element', '$scope', '$attrs', '$parse', '$exceptionHandler', 'auiControlKit', 'auiTexts',
            function ($element, $scope, $attrs, $parse, $exceptionHandler, kit, texts) {
                const $ctrl = this;
                const DEFAULT_SIZES = [10, 20, 50, 100];
                const PARTS = ['total', 'sizes', 'pager', 'jumper'];
                // the parts that give way in a narrow place, in this order
                const YIELD = ['jumper', 'total', 'sizes'];
                let nav = null;
                let totalEl = null;
                let totalSizer = null;
                let totalShown = null;
                let sizesEl = null;
                let pagerEl = null;
                let jumperEl = null;
                let jumperText = null;
                let statusEl = null;
                let fitWatch = null;
                let fitFrame = 0;
                let scrollFrame = 0;
                let drawn = '';         // what the pager shows now (drawn again only when it changes)
                let lastTotal = null;   // the total and the pages known last: kept in view while a page loads (nothing moves)
                let lastPages = 0;
                let digitsShown = 0;    // the digits of the last page: the page buttons' width
                let narrow = 0;         // a narrow place: 0 as set; 1 the pager with 5 buttons; 2 simple (fit)
                let yielded = [];       // the parts given way in a narrow place (fit)
                let contentSized = false;   // the bar's width follows its content (a shrink-to-fit place): fitted a frame later
                let pending = 0;        // promises the page's handlers returned, not settled yet: the loading look
                let announce = '';      // told to screen readers after the user's change ("Page 5 of 44")
                let scrollDue = false;  // scroll-to: the list's top brought into view once the page chosen is shown
                let clampKey = '';      // the page put back on the last one (the total went down): once for each case
                let pick = null;        // the page chosen, while current-page / page-size have not followed it
                let searchCall = null;  // search: the attribute's text and its parsed call
                let destroyed = false;
                // the state shown: the page (asked: as the page has it, maybe past the last), the size, the total (null:
                // not known), the pages
                const st = {page: 1, asked: 1, size: DEFAULT_SIZES[0], total: null, pages: 0};

                $ctrl.t = texts.pagination;
                $ctrl.sizeOptions = [];
                $ctrl.sizeValue = st.size;
                $ctrl.selectSize = '';
                // the page to go to: the family's field (aui-input), its text, its state
                $ctrl.jumpText = '';
                $ctrl.jumpWidth = 64;
                $ctrl.jumpDisabled = false;
                $ctrl.jumpReadonly = false;

                const fill = (text, values) => String(text).replace(/\{(\w+)\}/g, (all, name) =>
                    (values[name] === undefined || values[name] === null ? '' : String(values[name])));
                const toInt = value => {
                    const n = typeof value === 'number' ? value : parseInt(value, 10);
                    return isFinite(n) ? Math.floor(n) : NaN;
                };
                // an item count with the texts' thousands separator ("60,000"); page numbers stay plain
                const num = n => {
                    const sep = $ctrl.t.thousands;
                    return sep ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep) : String(n);
                };
                const flag = (name, fallback) => kit.readFlag($attrs, name, $ctrl[name], fallback);
                const usesModel = () => !!$ctrl.pageModel && typeof $ctrl.pageModel === 'object';

                // ------------------------------------------------------------------ the state, from the page

                /** The page's numbers into the state: the page model's, else current-page / page-size / total. */
                function readState() {
                    let page;
                    let size;
                    let total;
                    let pages = NaN;
                    if (usesModel()) {
                        const m = $ctrl.pageModel;
                        page = toInt(m.currentPage);
                        size = toInt(m.pageItemSize);
                        total = toInt(m.totalItemCount);
                        pages = toInt(m.totalPageCount);
                        pick = null;
                    } else {
                        page = toInt($ctrl.currentPage);
                        size = toInt($ctrl.pageSize);
                        total = toInt($ctrl.total);
                        // the page chosen here stays until current-page or page-size change (set from on-change, or not)
                        if (pick && pick.fromPage === $ctrl.currentPage && pick.fromSize === $ctrl.pageSize) {
                            page = pick.page;
                            size = pick.size;
                        } else {
                            pick = null;
                        }
                    }
                    st.size = size > 0 ? size : (st.size > 0 ? st.size : sizes()[0]);
                    st.total = total >= 0 ? total : null;
                    if (!(pages > 0)) pages = st.total !== null ? Math.ceil(st.total / st.size) : 0;
                    st.pages = pages;
                    st.asked = page > 0 ? page : 1;
                    st.page = st.pages > 0 && st.asked > st.pages ? st.pages : st.asked;
                }

                function sizes() {
                    const given = Array.isArray($ctrl.pageSizeItems) ? $ctrl.pageSizeItems.map(toInt).filter(n => n > 0 && n <= 1000) : [];
                    return given.length ? given : DEFAULT_SIZES;
                }

                // loading: a promise of the page's handler not settled, the loading binding, or (the page model's older
                // form) totalItemCount -1
                function isLoading() {
                    if (pending > 0 || flag('loading', false)) return true;
                    return usesModel() && toInt($ctrl.pageModel.totalItemCount) === -1;
                }

                $ctrl.isLocked = () => isLoading() || flag('disabled', false);

                // ------------------------------------------------------------------ lifecycle

                $ctrl.$postLink = function () {
                    nav = $element[0].firstElementChild;
                    totalEl = nav.querySelector('.aui-pagination__total');
                    totalSizer = totalEl.firstElementChild;
                    totalShown = totalEl.lastElementChild;
                    statusEl = nav.querySelector('.aui-pagination__status');
                    sizesEl = nav.querySelector('.aui-pagination__sizes');
                    pagerEl = nav.querySelector('.aui-pagination__pager');
                    jumperEl = nav.querySelector('.aui-pagination__jumper');
                    jumperText = nav.querySelector('.aui-pagination__jumper-text');
                    pagerEl.addEventListener('click', onPagerClick);
                    kit.followNgFlags($attrs, draw);
                    // the page model, changed in place by the page (a search back on page 1): its four numbers read at
                    // each digest (no copy of it, no deep watch)
                    $scope.$watch(modelKey, function (now, before) { if (now !== before) draw(); });
                    if (typeof window.ResizeObserver === 'function') {
                        fitWatch = new window.ResizeObserver(onResize);
                        fitWatch.observe(nav);
                    }
                    // a font that arrives later changes the parts' widths, not the bar's: fitted again
                    if (document.fonts && typeof document.fonts.addEventListener === 'function') {
                        document.fonts.addEventListener('loadingdone', fitSoon);
                    }
                    draw();
                };

                $ctrl.$onChanges = function () {
                    if (nav) draw();
                };

                $ctrl.$onDestroy = function () {
                    destroyed = true;
                    if (fitWatch) fitWatch.disconnect();
                    if (fitFrame) window.cancelAnimationFrame(fitFrame);
                    if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
                    if (document.fonts && typeof document.fonts.removeEventListener === 'function') {
                        document.fonts.removeEventListener('loadingdone', fitSoon);
                    }
                };

                function modelKey() {
                    if (!usesModel()) return '';
                    const m = $ctrl.pageModel;
                    return [m.currentPage, m.pageItemSize, m.totalItemCount, m.totalPageCount].join('|');
                }

                // ------------------------------------------------------------------ drawing

                const isSimple = () => flag('simple', false) || narrow >= 2;

                function layoutParts() {
                    if (isSimple()) return ['pager'];
                    const asked = String($ctrl.layout || '').split(/[\s,]+/).map(word => word.trim().toLowerCase()).filter(Boolean);
                    const parts = asked.filter((word, i) => PARTS.indexOf(word) >= 0 && asked.indexOf(word) === i);
                    return parts.length ? parts : PARTS.slice();
                }

                function pagerCount() {
                    if (narrow >= 1) return 5;
                    let n = toInt($ctrl.pagerCount);
                    if (!(n >= 5)) n = 7;
                    if (n > 21) n = 21;
                    return n % 2 ? n : n - 1;
                }

                /**
                 * The pager's items: the first and the last page always, the pages around the current one, an ellipsis (a
                 * button 5 pages on) where pages are left out - as many items on every page (pager-count + 2): where one
                 * ellipsis is not needed, one more page in its place. Nothing after the pager moves from page to page.
                 */
                function pagerItems() {
                    const pages = st.pages;
                    const page = st.page;
                    const count = pagerCount();
                    const items = [];
                    const run = (from, to) => { for (let i = from; i <= to; i += 1) items.push({page: i}); };
                    if (pages <= count + 2) {
                        run(1, pages);
                        return items;
                    }
                    // pages beside the current one in the middle
                    const side = (count - 3) / 2;
                    if (page - side <= 3) {
                        run(1, count);
                        items.push({more: 1});
                        items.push({page: pages});
                    } else if (page + side >= pages - 2) {
                        items.push({page: 1});
                        items.push({more: -1});
                        run(pages - count + 1, pages);
                    } else {
                        items.push({page: 1});
                        items.push({more: -1});
                        run(page - side, page + side);
                        items.push({more: 1});
                        items.push({page: pages});
                    }
                    return items;
                }

                const moreStep = () => pagerCount() - 2;

                function button(cls, text, label, attrs) {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'aui-pagination__button ' + cls;
                    if (text) b.textContent = text;
                    if (label) b.setAttribute('aria-label', label);
                    Object.keys(attrs || {}).forEach(name => { if (attrs[name] !== null) b.setAttribute(name, attrs[name]); });
                    return b;
                }

                // a text in the room of its widest form: the widest one hidden under it (nothing moves when it changes)
                function textPart(cls, text) {
                    const span = document.createElement('span');
                    span.className = cls;
                    span.textContent = text;
                    if (cls === 'aui-pagination__sizer') span.setAttribute('aria-hidden', 'true');
                    return span;
                }

                // a spinner over a part whose size stays (its text hidden under it): where the page loads
                function spinner() {
                    const spin = document.createElement('span');
                    spin.className = 'aui-pagination__spinner';
                    spin.setAttribute('aria-hidden', 'true');
                    return spin;
                }

                function drawPager(locked, simple, loading) {
                    const t = $ctrl.t;
                    const key = [st.page, st.pages, locked, simple, loading, pagerCount(), t.previous, t.next, t.page, t.simple].join('|');
                    if (key === drawn) return;
                    // the focus on a pager button kept on the same place once the pager is drawn again; where that one is
                    // off (Next onto the last page), on the page shown, else on the other arrow
                    const focused = pagerEl.contains(document.activeElement) ? document.activeElement.getAttribute('data-go') : null;
                    drawn = key;
                    const parts = [];
                    const lock = locked ? {'aria-disabled': 'true'} : {};
                    parts.push(button('aui-pagination__prev', '', t.previous, angular.extend({'data-go': 'previous', title: t.previous},
                        st.page <= 1 ? {disabled: ''} : lock)));
                    if (simple) {
                        const span = document.createElement('span');
                        span.className = 'aui-pagination__simple' + (loading ? ' aui-pagination__simple--busy' : '');
                        // the room of its widest text ("20 / 20"): Next stays in its place from page to page
                        span.appendChild(textPart('aui-pagination__sizer', fill(t.simple, {page: st.pages || st.page, pages: st.pages})));
                        span.appendChild(textPart('aui-pagination__shown', fill(t.simple, {page: st.page, pages: st.pages})));
                        if (loading) span.appendChild(spinner());
                        parts.push(span);
                    } else {
                        pagerItems().forEach(function (item) {
                            if (item.more) {
                                const label = fill(item.more < 0 ? t.previousMore : t.nextMore, {count: moreStep()});
                                parts.push(button('aui-pagination__more', '…', label,
                                    angular.extend({'data-go': item.more < 0 ? 'more-back' : 'more-on', title: label}, lock)));
                                return;
                            }
                            const current = item.page === st.page;
                            const page = button('aui-pagination__page' + (current ? ' aui-pagination__page--current' : '') +
                                (current && loading ? ' aui-pagination__page--busy' : ''), String(item.page),
                                fill(t.page, {page: item.page}), angular.extend({'data-go': String(item.page),
                                    'aria-current': current ? 'page' : null}, lock));
                            // loading: the spinner in the page chosen, its width kept (the total and the rest unchanged)
                            if (current && loading) page.appendChild(spinner());
                            parts.push(page);
                        });
                    }
                    parts.push(button('aui-pagination__next', '', t.next, angular.extend({'data-go': 'next', title: t.next},
                        st.page >= st.pages ? {disabled: ''} : lock)));
                    pagerEl.textContent = '';
                    parts.forEach(part => pagerEl.appendChild(part));
                    if (focused !== null) {
                        const again = [pagerEl.querySelector('[data-go="' + focused + '"]'), pagerEl.querySelector('.aui-pagination__page--current'),
                            pagerEl.querySelector('[data-go="previous"]'), pagerEl.querySelector('[data-go="next"]')].filter(b => b && !b.disabled)[0];
                        if (again) again.focus();
                    }
                }

                /** The total's text: total-text "range", a text of the page's, or "Total 437"; and its widest form. */
                function totalTexts(total) {
                    const t = $ctrl.t;
                    const asked = String($ctrl.totalText || '').trim();
                    const template = asked === 'range' ? t.range : (asked || t.total);
                    const to = Math.min(st.page * st.size, total);
                    const from = to > 0 ? Math.min((st.page - 1) * st.size + 1, to) : 0;
                    const pages = st.pages || 1;
                    return {
                        text: fill(template, {total: num(total), pages: num(pages), size: num(st.size), page: num(st.page), from: num(from), to: num(to)}),
                        // the numbers that change from page to page at their widest (digits are of one width)
                        widest: fill(template, {total: num(total), pages: num(pages), size: num(st.size), page: num(pages), from: num(total), to: num(total)})
                    };
                }

                /** Everything from the state: the parts shown, the total, the size select, the pager, the jumper.
                 * fitting: drawn by fit (not fitted again). */
                function draw(fitting) {
                    if (!nav || destroyed) return;
                    readState();
                    const t = $ctrl.t;
                    const loading = isLoading();
                    // while a page loads the total and the pages stay as known (the page model's -1 has none): nothing moves
                    if (st.total !== null) lastTotal = st.total;
                    if (st.pages > 0) lastPages = st.pages;
                    else if (loading && lastPages > 0) st.pages = lastPages;
                    const shownTotal = st.total !== null ? st.total : (loading ? lastTotal : null);
                    const locked = $ctrl.isLocked();
                    const simple = isSimple();
                    const parts = layoutParts();
                    const emptyModel = usesModel() && !loading && !(st.total > 0);
                    const single = st.pages <= 1;
                    const hidden = emptyModel || (flag('hideOnSinglePage', false) && single && !loading);
                    // the parts in the layout's order; the pager and the jumper only for more than one page
                    const shows = {total: !simple && parts.indexOf('total') >= 0, sizes: !simple && parts.indexOf('sizes') >= 0,
                        pager: parts.indexOf('pager') >= 0 && !single, jumper: !simple && parts.indexOf('jumper') >= 0 && !single};
                    [['total', totalEl], ['sizes', sizesEl], ['pager', pagerEl], ['jumper', jumperEl]].forEach(function (pair) {
                        pair[1].style.order = String(parts.indexOf(pair[0]) >= 0 ? parts.indexOf(pair[0]) : 9);
                        pair[1].hidden = !shows[pair[0]];
                    });
                    // the fields' sizes: sm / small 28px, md 34px (the default), lg / large 40px (its select and its
                    // field the same size)
                    const sizeWord = String($ctrl.size || '').trim().toLowerCase();
                    const sizeName = sizeWord === 'sm' || sizeWord === 'small' ? 'sm' : (sizeWord === 'lg' || sizeWord === 'large' ? 'lg' : 'md');
                    nav.className = 'aui-pagination aui-pagination--' + sizeName +
                        (loading ? ' aui-pagination--loading' : '') + (flag('disabled', false) ? ' aui-pagination--disabled' : '') +
                        (simple ? ' aui-pagination--simple' : '') + yielded.map(part => ' aui-pagination--no-' + part).join('');
                    nav.hidden = hidden;
                    nav.setAttribute('aria-label', $ctrl.ariaLabel || t.nav);
                    nav.setAttribute('aria-busy', loading ? 'true' : 'false');
                    // the page buttons' one width: from the digits of the last page
                    const digits = String(Math.max(st.pages, st.page, 1)).length;
                    if (digits !== digitsShown) {
                        digitsShown = digits;
                        nav.style.setProperty('--aui-pagination-digits', String(digits));
                    }
                    $ctrl.selectSize = sizeName === 'sm' ? 'small' : (sizeName === 'lg' ? 'large' : '');
                    // the total (the last known one while a page loads), in the room of its widest text
                    const total = shownTotal !== null ? totalTexts(shownTotal) : {text: '', widest: ''};
                    if (totalShown.textContent !== total.text) totalShown.textContent = total.text;
                    if (totalSizer.textContent !== total.widest) totalSizer.textContent = total.widest;
                    // told to screen readers: loading, then the page chosen ("Page 5 of 44")
                    const status = loading ? t.loading : announce;
                    if (statusEl.textContent !== status) statusEl.textContent = status;
                    // the page sizes: the select's options (the size shown among them)
                    const list = sizes().slice();
                    if (list.indexOf(st.size) < 0) list.push(st.size);
                    list.sort((a, b) => a - b);
                    const optionsKey = list.join(',') + '|' + t.perPage;
                    if ($ctrl.sizeKey !== optionsKey) {
                        $ctrl.sizeKey = optionsKey;
                        $ctrl.sizeOptions = list.map(n => ({value: n, label: fill(t.perPage, {size: n})}));
                    }
                    $ctrl.sizeValue = st.size;
                    drawPager(locked, simple, loading);
                    jumperText.textContent = t.goTo;
                    $ctrl.jumpWidth = sizeName === 'sm' ? 56 : (sizeName === 'lg' ? 72 : 64);
                    $ctrl.jumpDisabled = flag('disabled', false);
                    $ctrl.jumpReadonly = loading;
                    if (fitting !== true) {
                        fitSoon();
                        clampLater(loading);
                        if (scrollDue && !loading) scrollSoon();
                    }
                }

                // the page asked for is past the last page (the total went down: the last item of the last page
                // deleted): the last page chosen and the page told (once for each case), not only shown
                function clampLater(loading) {
                    if (loading || !(st.pages > 0) || st.asked <= st.pages) {
                        clampKey = '';
                        return;
                    }
                    const key = st.asked + '>' + st.pages;
                    if (clampKey === key) return;
                    clampKey = key;
                    $scope.$evalAsync(function () {
                        if (!destroyed && st.pages > 0 && st.asked > st.pages) change(st.pages, st.size, 'total', true);
                    });
                }

                // ------------------------------------------------------------------ a narrow place

                // the observer: fitted at once, before the frame is painted (no frame past its place). Where the bar's
                // width follows its content (a shrink-to-fit place, a footer's end) a frame later: the fitting's own
                // change of its width is not to be observed in the same frame (the browser's loop error)
                function onResize() {
                    if (destroyed || !nav) return;
                    if (contentSized) {
                        fitSoon();
                        return;
                    }
                    const width = nav.getBoundingClientRect().width;
                    fit();
                    if (Math.abs(nav.getBoundingClientRect().width - width) > 0.5) {
                        contentSized = true;
                        // its width held for this frame; the change seen in the next one
                        nav.style.width = width + 'px';
                        window.requestAnimationFrame(function () { if (nav) nav.style.width = ''; });
                    }
                }

                // after a drawing or a font: in the next frame (before it is painted)
                function fitSoon() {
                    if (fitFrame || destroyed) return;
                    fitFrame = window.requestAnimationFrame(function () {
                        fitFrame = 0;
                        fit();
                    });
                }

                // the parts give way in order (the page to go to, the total, the page sizes); then the pager keeps 5
                // buttons; then it is simple (previous, "3 / 20", next) - never past its place. Not shown (a hidden
                // tab): left as it was.
                function fit() {
                    if (!nav || nav.hidden || !nav.clientWidth || destroyed) return;
                    const over = () => nav.scrollWidth > nav.clientWidth + 1;
                    if (narrow || yielded.length) {
                        narrow = 0;
                        yielded = [];
                        draw(true);
                    }
                    for (let i = 0; i < YIELD.length && over(); i += 1) {
                        yielded.push(YIELD[i]);
                        nav.classList.add('aui-pagination--no-' + YIELD[i]);
                    }
                    while (over() && narrow < 2) {
                        narrow += 1;
                        draw(true);
                    }
                }

                // ------------------------------------------------------------------ scroll-to

                // after the user's change, once the page chosen is shown (not loading): the list's top into view, when it
                // is above the top of its scroll box (the window, or a box of the page that scrolls)
                function scrollSoon() {
                    if (scrollFrame || destroyed) return;
                    scrollFrame = window.requestAnimationFrame(function () {
                        scrollFrame = 0;
                        if (!scrollDue || destroyed || isLoading()) return;
                        scrollDue = false;
                        bringIntoView();
                    });
                }

                function bringIntoView() {
                    let target = null;
                    try {
                        target = document.querySelector($ctrl.scrollTo);
                    } catch (e) {
                        return;
                    }
                    if (!target) return;
                    let box = target.parentElement;
                    while (box && box !== document.body && box !== document.documentElement) {
                        const overflow = window.getComputedStyle(box).overflowY;
                        if ((overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') && box.scrollHeight > box.clientHeight) break;
                        box = box.parentElement;
                    }
                    const top = target.getBoundingClientRect().top;
                    const margin = parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
                    if (box && box !== document.body && box !== document.documentElement) {
                        const boxTop = box.getBoundingClientRect().top + box.clientTop;
                        if (top < boxTop) box.scrollTop -= boxTop - top + margin;
                    } else if (top < 0) {
                        target.scrollIntoView(true);
                    }
                }

                // ------------------------------------------------------------------ the user's changes

                function onPagerClick(event) {
                    const target = event.target && event.target.closest ? event.target.closest('[data-go]') : null;
                    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
                    const go = target.getAttribute('data-go');
                    let page;
                    let source;
                    if (go === 'previous') { page = st.page - 1; source = 'previous'; }
                    else if (go === 'next') { page = st.page + 1; source = 'next'; }
                    else if (go === 'more-back') { page = st.page - moreStep(); source = 'more'; }
                    else if (go === 'more-on') { page = st.page + moreStep(); source = 'more'; }
                    else { page = toInt(go); source = 'page'; }
                    change(page, st.size, source);
                }

                $ctrl.sizeChosen = function () {
                    const size = toInt($ctrl.sizeValue);
                    if (!(size > 0) || size === st.size || $ctrl.isLocked()) {
                        $ctrl.sizeValue = st.size;
                        return;
                    }
                    // the first item of the page stays in view: its page under the new size
                    const first = (st.page - 1) * st.size;
                    const pages = st.total !== null ? Math.max(1, Math.ceil(st.total / size)) : 0;
                    let page = Math.floor(first / size) + 1;
                    if (pages > 0 && page > pages) page = pages;
                    change(page, size, 'size');
                };

                // the page to go to (aui-input's on-finish: Enter, or the field left): past the ends the nearest end;
                // anything else cleared
                $ctrl.jumpFinish = function () {
                    const text = String($ctrl.jumpText === undefined || $ctrl.jumpText === null ? '' : $ctrl.jumpText).trim();
                    if (!text) return;
                    jump(text);
                };

                function jump(text) {
                    $ctrl.jumpText = '';
                    if ($ctrl.isLocked() || !/^\d+$/.test(text)) return;
                    let page = parseInt(text, 10);
                    if (page < 1) page = 1;
                    if (st.pages > 0 && page > st.pages) page = st.pages;
                    run(() => change(page, st.size, 'jump'));
                }

                // search="vm.sm.search" (a function: called as a method of its object with currentPage, pageItemSize),
                // or an expression with $page and $pageSize; parsed once for its text
                function searchFn() {
                    const text = String($attrs.search || '').trim();
                    if (!text) return null;
                    if (!searchCall || searchCall.text !== text) {
                        const path = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(text);
                        searchCall = {text: text, call: $parse(path ? text + '($page, $pageSize)' : text)};
                    }
                    return searchCall.call;
                }

                // a promise a handler returned (its request): the loading look until it settles, either way
                function follow(result) {
                    if (!result || typeof result.then !== 'function') return;
                    pending += 1;
                    let settled = false;
                    const done = function () {
                        if (settled) return;
                        settled = true;
                        if (destroyed) return;
                        run(function () {
                            pending -= 1;
                            draw();
                        });
                    };
                    try {
                        result.then(done, done);
                    } catch (e) {
                        done();
                    }
                }

                /**
                 * The page (and size) chosen: shown at once; the page model written, then the page told (its handler,
                 * its search, on-change). force: told even when the page shown is the same (the total went down).
                 */
                function change(page, size, source, force) {
                    if ($ctrl.isLocked()) return;
                    if (page < 1) page = 1;
                    const pages = st.total !== null ? Math.max(1, Math.ceil(st.total / size)) : (size === st.size ? st.pages : 0);
                    if (pages > 0 && page > pages) page = pages;
                    if (!force && page === st.page && size === st.size) return;
                    run(function () {
                        st.page = page;
                        st.asked = page;
                        st.size = size;
                        if (st.total !== null) st.pages = Math.ceil(st.total / size);
                        if (usesModel()) {
                            const m = $ctrl.pageModel;
                            m.currentPage = page;
                            m.pageItemSize = size;
                            // (the page's own count of pages follows the size)
                            if (st.total !== null && toInt(m.totalPageCount) > 0) m.totalPageCount = st.pages;
                        } else {
                            pick = {page: page, size: size, fromPage: $ctrl.currentPage, fromSize: $ctrl.pageSize};
                        }
                        $ctrl.sizeValue = size;
                        if (source !== 'total') {
                            // the user's change: told to screen readers once shown; the list's top brought into view
                            announce = st.pages > 0 ? fill($ctrl.t.pageOf, {page: page, pages: st.pages}) : fill($ctrl.t.page, {page: page});
                            scrollDue = !!$ctrl.scrollTo;
                        }
                        const results = [];
                        const call = function (fn) {
                            try {
                                results.push(fn());
                            } catch (e) {
                                $exceptionHandler(e);
                            }
                        };
                        if (usesModel() && typeof $ctrl.onPageDataChange === 'function') {
                            const copy = angular.copy(angular.extend({}, $ctrl.pageModel));
                            call(() => $ctrl.onPageDataChange(copy));
                        }
                        const search = searchFn();
                        if (search) call(() => search($scope.$parent, {$page: page, $pageSize: size}));
                        if ($ctrl.onChange) call(() => $ctrl.onChange({$page: page, $pageSize: size, $source: source}));
                        results.forEach(follow);
                        draw();
                    });
                }

                // page code in a digest: the page's one; else one of its own
                function run(fn) {
                    if ($scope.$root.$$phase) fn();
                    else $scope.$apply(fn);
                }
            }
        ]
    });
