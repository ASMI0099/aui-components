# Options from a server

`aui-select` and `aui-tree-select` can load their options themselves: all at once, page by page with server
search, depending on other fields, and they find the labels of saved values that are not loaded. One function
usually does all of it. The shared engine is the `auiRemoteData` service ([src/core/remote-data.js](../src/core/remote-data.js)).

## Attributes

| Attribute | Type | `aui-select` | `aui-tree-select` | Meaning |
|---|---|---|---|---|
| `load-options` | function `fn($request)` | yes | yes | Loads the options. Tree: the whole tree (nested or flat) |
| `page-size` | number | yes | – | Paged loading: the next page loads near the end of the list; search goes to the server |
| `load-params` | object | yes | yes | What the data depends on, e.g. `{storeId: vm.form.storeId}`. Compared by value; a change means another data set |
| `load-enabled` | boolean | yes | yes | `false`: nothing is loaded yet (e.g. no store chosen yet). A dedicated `lookup-options` still looks up the shown value's label (a saved record shows its name). Default `true` |
| `load-disabled-text` | text | yes | yes | While `load-enabled` is false, the panel shows this instead of the list ("No results found"), with an info icon and no search box, e.g. `load-disabled-text="Choose a store first"`. Several reasons: `{{ !vm.form.storeId ? 'Choose a store first' : 'Choose a type first' }}`. Not set: the empty text |
| `preload` | boolean | yes | yes | Load as soon as `load-enabled` is true, not on the first open |
| `cache-ttl` | ms | yes | yes | A loaded list is reused this long; after that it shows at once and refreshes in the background. Default 60000 |
| `load-timeout` | ms | yes | yes | A request without an answer by then fails ("Retry"): lists, lookups, tree children and tree search. Default: no timeout |
| `search-delay` | ms | yes | yes | Server search starts this long after the last keystroke. Default 300 |
| `search-min-length` | number | yes | – | Server search: no request until this many characters (a hint is shown) |
| `value-options` | array | yes | yes | Options the page already has for the current value(s), e.g. `[{id: vm.form.departmentId, name: vm.form.departmentName}]` |
| `lookup-enabled` | boolean | yes | yes | Look up selected values that are not loaded. Through `load-options` unless `lookup-options` is set |
| `lookup-options` | function `fn($request)` | yes | yes | A dedicated lookup (e.g. a by-ids endpoint). Turns lookups on unless `lookup-enabled="false"` |
| `lookup-group` | name | yes | yes | Components with the same group (and params) send their lookups as one request: rows of an editable table (the request waits 10 ms for all of them) |
| `reset-on-params` | `clear` | yes | yes | Clear the value when `load-params` change while the value stays, also when they change as `load-enabled` turns false (the field they come from emptied: `load-enabled="!!vm.form.storeId"`). Kept: a value that changes together with the params (a record loaded), a value whose loading only turns off or on (the same params), and a value whose params change while loading is off (a record filled in steps) |
| `disabled-field` | field name | yes | yes (default `disabled`) | Items with this field `true` cannot be picked |
| `selectable-field` | field name | – | yes (no default) | Nodes with this field `false` are groups: shown and opened on a click, never picked (no checkbox). In linked checking, checks pass through a group, but its own value is never written; a group with nothing to check below it is left out, as a disabled node is |
| `load-children` | function `fn($request)` | – | yes | Lazy children (`$node`, `$level`, `$value`, `$params` also work) |
| `remote-search` | function `fn($query, $signal, $cancel, $params)` | – | yes | Tree server search: matches as a pruned tree, `[]` or `{items, total}` |
| `reveal-selected` | boolean | – | yes | Single, lazy tree: on open, load the branches down to a looked-up value |
| `api` | object | yes | yes | Receives `open`, `close`, `reload` (forget the lists, look up again), ... |

Boolean attributes may be written bare (`lookup-enabled`), the HTML way (`lookup-enabled="lookup-enabled"`) or with an
expression (`lookup-enabled="vm.mode === 'edit'"`).

## The request

Every call of `load-options` / `lookup-options` gets one object, `$request`:

| Field | Meaning |
|---|---|
| `reason` | `open`, `search`, `more`, `params`, `preload`, `values` (labels needed), `reload`, `retry`, `refresh` (background), `lookup` |
| `query` | The search text as typed (trimmed, case kept); `''` without a search |
| `page`, `pageSize`, `offset` | 1-based page, items per page (`null` when loading everything), `(page - 1) * pageSize` |
| `cursor` | The `nextCursor` of the previous page, for cursor-based APIs |
| `values` | Set only for a lookup: the values to find (`pageSize` = their number) |
| `params` | A copy of `load-params` |
| `signal`, `cancel` | `AbortSignal` for `fetch`, promise for the `$http` `timeout`: resolved when the request is no longer wanted |

Read every filter from `$request.params`, not from the page: the lists are cached per `load-params`.

## Answers

* An array of items: in paged mode, a page shorter than `page-size` is the last one.
* `{items, total}`, `{items, hasMore}` or `{items, nextCursor}`: used when present, never required.
* Anything else is a failure (with a console warning). Items without a usable value are skipped; an item that
  appears on two pages is shown once; a full page that adds nothing new ends the list (a server ignoring the page).
* Tree lookups may answer nodes, nested trees or root-to-node chains (`[[root, ..., node], ...]`); chains give the
  path and the ancestors (shown half checked).
* Tree children (`load-children`): an array is all of them; `{items, hasMore | nextCursor | total}` adds a
  "Load more" row that loads by itself as it scrolls into view.

## One function for everything

```js
vm.loadDepartments = function (req) {
    var body = {pageNum: req.page, pageSize: req.pageSize};
    if (req.values) {
        body.ids = req.values;                // a lookup: by ids only (closed ones, or another store's, still found)
    } else {
        body.storeId = req.params.storeId;
        body.keyword = req.query;
    }
    return $http.post('/departments/page', body, {timeout: req.cancel})
        .then(function (res) { return res.data.data.list; });
};
```

```html
<aui-select ng-model="vm.form.departmentId" label-field="name" value-field="id"
            load-options="vm.loadDepartments($request)" page-size="20"
            load-params="{storeId: vm.form.storeId}" load-enabled="!!vm.form.storeId"
            lookup-enabled reset-on-params="clear"></aui-select>
```

## Rules the components keep

* The model is never changed by the component itself (except `reset-on-params="clear"` and
  `auto-select-on-single-required`, both opt-in). A value that no source knows shows its raw value.
* Loading starts on the first open; at once when a saved value needs its label (load-all mode without a lookup)
  or with `preload`. Reopening within `cache-ttl` sends no request; the last 5 params keep their lists.
* The user's press comes first: an opening, or a tree branch opened or closed, is drawn at once with its loading
  look; what it asks of the page (the loader, a lookup, `on-open`, `on-expand`, `load-children`) runs right after
  that first frame, in one digest of the page (on a page whose digest is long, the press does not wait for it).
  A branch of a tree with its data at hand (`options`, a `load-options` list) digests only the tree.
* The choice on opening, also when the data arrives after it: the tree opens the branches down to the selected
  value and puts the keyboard on it, scrolled into view; with `multiple`, the branches that hold checked items
  (a fully checked branch of linked checking stays folded: its checkbox says it all), the keyboard on the first
  checked row. Branches opened by hand stay open on the next opening until the page sets another value (another
  record, a reset): then the tree starts from the new value's branches. `aui-select` brings its selected option
  into view the same way. A lazy tree (`load-children`) opens only branches it has loaded; `reveal-selected`
  loads the way down to a looked-up value.
* The first data arriving in an open panel, after its loading state was seen, grows the panel to it in one movement
  (a transform from the size drawn, anchored at the field, so busy page code cannot stall it); data at hand when the
  panel opens is simply part of the open animation. A field that most visits open (a category tree once the store is
  chosen) can use `preload`: its data is there before the open, and the panel opens at full size with its content.
* One request per list at a time. A new query or params change cancels the running request; a late answer of an
  old one is dropped. Closing the panel stops and drops the searches; the plain list keeps loading.
* Lookups: values that change in one digest go out together (chunks of `page-size`, or 100); a value is asked once
  per round. "Not found" is asked again only at the next open, when the value comes back, or when the params change.
  A lookup that has to wait (loading not enabled yet) shows the raw value; while it runs, a placeholder.
* A label already found stays when `load-params` change, until the new data has the value (or `reset-on-params`
  clears it): a saved record keeps showing its name while the field's dependency changes. A lookup still running when
  the params change is asked again with the new ones; its late answer for the old ones is dropped.
* Selected values not among the loaded rows are pinned on top of a remote list (no search typed).
