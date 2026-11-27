# aui-pagination

The pages of a list: the total, the page size, the pager and a page to go to.

```html
<aui-pagination current-page="vm.page" page-size="vm.size" total="vm.total" on-change="vm.load($page, $pageSize)"></aui-pagination>
```

```js
// a promise returned (the request): the bar shows the loading look until it settles - no `loading` needed
vm.load = function (page, size) {
    vm.page = page;
    vm.size = size;
    return api.list({page: page, size: size}).then(function (result) {
        vm.rows = result.rows;
        vm.total = result.total;
    });
};
```

A list with a search model: the bar calls its search itself.

```html
<aui-pagination page-model="vm.sm.page" search="vm.sm.search"></aui-pagination>
```

```js
vm.sm = {
    page: {currentPage: 1, pageItemSize: 10, totalItemCount: 0, totalPageCount: 0},
    search: function (currentPage, pageItemSize) {
        const sm = this;
        return api.list({page: currentPage, size: pageItemSize}).then(function (result) {
            sm.rows = result.rows;
            sm.page.totalItemCount = result.total;
            sm.page.totalPageCount = result.pages;
        });
    }
};
```

## Attributes

| Attribute | |
|---|---|
| `current-page`, `page-size`, `total` | The page shown (from 1), the items per page, how many items there are. |
| `on-change` | After the user's change: `$page`, `$pageSize`, `$source` (`page`, `previous`, `next`, `more` (an ellipsis), `jump`, `size`, `total` - see "The total went down"). The component shows the new page at once and keeps it shown; set `current-page` / `page-size` from it, or not. |
| `search` | The page's search function, `search="vm.sm.search"`: called on each change with `(currentPage, pageItemSize)` - exactly these two - as a method of its object (`this` is `vm.sm`), after the page model is written. Or an expression with `$page`, `$pageSize`: `search="vm.find($page, 'all')"`. |
| `loading` | While a page loads: nothing moves - the total stays, a spinner shows in the current page (screen readers are told), the buttons take no click and keep the focus (no second request). A promise returned by `on-change`, `on-page-data-change` or `search` does the same until it settles (resolved or rejected). |
| `page-size-items` | The page sizes offered (`[10, 20, 50, 100]` by default; over 1000 left out). |
| `layout` | Its parts and their order: `total`, `sizes`, `pager`, `jumper` (all four, in this order, by default). |
| `total-text` | The total's text. `range`: "41–50 of 437". Or a text of the page's with `{total}`, `{pages}`, `{size}`, `{page}`, `{from}`, `{to}`: `total-text="Total {pages} pages, {size} a page, {total} items"`. "Total 437" by default. It keeps the room of its widest form: nothing after it moves from page to page. |
| `pager-count` | Page buttons with the first and the last (7 by default; odd, 5 to 21). |
| `simple` | Previous, "3 / 20", next only. |
| `hide-on-single-page` | Nothing shown while there is one page (or none). |
| `size` | The fields' sizes: `sm` or `small` (28px, 13px text), `md` (34px, 14px; the default), `lg` or `large` (40px, 15px). Its page size select and its page-to-go-to field take the same size. |
| `scroll-to` | A selector of the list, `scroll-to="#orders"`: after the user's change, once the page is shown (loaded), the list's top is brought into view - only when it is above the top of its scroll box (the window, or a box of the page that scrolls; that box alone is scrolled). A `scroll-margin-top` on the list is kept (a fixed header). |
| `disabled` | Nothing can be changed. |
| `aria-label` | Its name for screen readers ("Pagination" by default). |

## Behaviour

* Nothing moves from page to page. The pager has as many items on every page (`pager-count` + 2): the first and the
  last page always, the pages around the current one, an ellipsis where 2 or more pages are left out - where one
  ellipsis is not needed, one more page takes its place. Its page buttons have one width, from the digits of the last
  page. The total and "3 / 20" keep the room of their widest text. So the parts after the pager never move, and in a
  narrow place a page change never makes a part give way or come back.
* The ellipsis is a button that moves 5 pages (with the default `pager-count`).
* A new page size keeps the first item of the page in view: page 5 at 10 a page (items 41-50) is page 3 at 20.
* The page to go to: Enter or leaving the box. Past the last page it goes to the last, below 1 to the first; anything
  that is not a number is cleared.
* The total went down (the last item of the last page deleted): the page shown is past the last page, so the last page
  is chosen and the page is told (`$source: 'total'`; the page model written and `on-page-data-change` / `search`
  called) - once for each case, not while a page loads.
* One page: no pager and no page to go to (the total and the sizes stay).
* A narrow place: the parts give way in order (the page to go to, the total, the sizes); then the pager keeps 5 buttons;
  then it is simple. Wider again, they come back. It follows its own box (a side panel, a dialog, a split view), fitted
  in the frame of the change - no frame is painted past its box. Where its width follows its content (the end of a
  flex footer) it is fitted one frame later. A font that arrives later is fitted again. It never wraps onto a second
  line. Hidden (a tab not shown), it is left as it was.
* The focus: kept on the button used; where that one is off now (Next onto the last page), on the page shown, else on
  the other arrow.

## The page model (the older form)

```html
<aui-pagination page-model="vm.page" page-size-items="[10, 20, 50]" on-page-data-change="vm.onPageChange"></aui-pagination>
```

`page-model` is an object `{currentPage, pageItemSize, totalItemCount, totalPageCount}`, shared by the list and the
bar. The component writes the page chosen into it (`currentPage`, `pageItemSize`), then calls `on-page-data-change` (a
function) with a copy of it, and `search`. A handler may read either. `totalPageCount` left out is worked out from the
total. `totalItemCount: -1` is the loading look (prefer `loading`, or a returned promise). A model with no items shows
nothing. A model the page changes (a search back on page 1, the total of a new answer) is followed. Pass the object
the search reads, not a copy of it. The forms can be used together.

## Look and access

The fields' height and type; page buttons quiet, the current one in the accent with white text; the family's focus
ring (the keyboard's only); the page size is an aui-select, the page to go to an aui-input. Item counts with the
texts' thousands separator ("Total 60,000"); page numbers plain. A `<nav>` named "Pagination"; page buttons named
"Page 3", the current one `aria-current="page"`; previous / next and the ellipses named; all native buttons (Tab,
Enter, Space). Screen readers are told "Loading" while a page loads, then "Page 5 of 44" after the user's change. In
high contrast mode the current page is in the system's highlight colour. A page's rules for buttons, spans and labels
do not reach its parts.

Texts: the `pagination` group of `auiTexts` (`range`, `pageOf`, `thousands` among them; see [texts](../texts.md)).

## Cost

No deep watch: the bindings by their changes, the page model by one watch that reads its four numbers. The pager is
drawn without watchers, only when the page, the pages or the look change. `search`, `total-text` and `scroll-to` add
no watcher. Measured: about 90 watchers a bar (about 50 of them its page-size aui-select's, 27 its aui-input's, 12 its
own), 2.5 ms to make one, 0.04 ms of each digest, a page click 1.5 ms; fitting in a resize 2 to 3 layouts, under 1 ms.
