# aui-select

One value, or several, from a list: a static array, or options loaded from a server page by page. The panel draws only
the rows in view, so long lists open quickly.

```html
<!-- one value from a static list -->
<aui-select ng-model="vm.status" options="vm.statuses" label-field="name" value-field="id"
            placeholder="Status" clearable></aui-select>

<!-- several values, as tags -->
<aui-select ng-model="vm.tags" options="vm.allTags" multiple max-tag-count="responsive" clearable></aui-select>

<!-- from a server, page by page, with server search -->
<aui-select ng-model="vm.productId" label-field="name" value-field="id" page-size="30"
            load-options="vm.loadProducts($request)" lookup-enabled clearable></aui-select>
```

The model holds the values (`value-field`, `id` by default): one value, or an array with `multiple`.
`selected-items` hands back the whole option objects of the selection.

## Options

| Attribute | |
|---|---|
| `options` | The array of options (objects, or plain values). |
| `label-field`, `value-field` | The fields shown and stored: `label` and `id` by default. |
| `disabled-field` | A field that marks an option as not pickable (for example `disabled`). |
| `disabled-values` | An array of values that cannot be picked. |
| `multiple` | Several values; the model is an array. |
| `max-tag-count` | With `multiple`: at most this many tags, then one "+N" tag; `responsive` fits one line of tags. |
| `searchable` | The search box of the panel; shown by default when there are more than 5 options. |
| `search-placeholder`, `empty-text` | The search box's placeholder and the text when nothing matches. |
| `clearable` | A clear button in the field. |
| `placeholder` | Shown while nothing is picked. |
| `selected-labels` | `{value: label}` for picked values whose option is not loaded (yet). |
| `panel-min-width` | The smallest width of the panel in px; by default the field's width. |
| `auto-select-on-single-required` | A required field with exactly one option picks it. |

An option's label is read when its object comes: to rename an option, give a new object (or a new array). The field's
shown value and `selected-items` follow the new object; an edit inside the same object shows in the open list only.
A `label-field` or `value-field` written with `{{ }}` and changed reads the options anew.

## Options from a server

`load-options="fn($request)"` loads the options. Without `page-size` everything is loaded at once and searched in the
browser; with `page-size` the list loads page by page as it scrolls, and the search goes to the server once typing
pauses. Requests that are no longer needed are cancelled, and a list is reused when the panel opens again.

| Attribute | |
|---|---|
| `load-options` | `fn($request)` returns an array, `{items, total}`, `{items, hasMore}` or a promise of one. |
| `load-params` | What the options depend on, for example `{storeId: vm.form.storeId}`; compared by value. |
| `load-enabled` | `false`: nothing loads yet (another field still has to be filled in). |
| `load-disabled-text` | Shown in the panel while `load-enabled` is false. |
| `reset-on-params` | `clear`: the value is cleared when `load-params` change. |
| `page-size` | Items per page; turns on paged loading and server search. |
| `search-delay`, `search-min-length` | Server search: the pause after typing (300 ms) and the characters needed first. |
| `cache-ttl` | How long a loaded list is reused before it is refreshed in the background (60000 ms). |
| `load-timeout` | Milliseconds before a request counts as failed. |
| `preload` | Load as soon as loading is enabled, not on the first open. |
| `value-options` | Options the page already has for the current value (for example from the record). |
| `lookup-enabled` | Looks up the labels of picked values that are not loaded, through `load-options`. |
| `lookup-options` | `fn($request)`: a separate lookup by `$request.values`. |
| `lookup-group` | Fields with the same group send their lookups as one request. |

See [options from a server](../remote-data.md) for `$request` and the answers in detail.

## Events and API

| Attribute | |
|---|---|
| `on-change` | `fn($value, $oldValue, $items, $option, $triggerSource, $byUser)`, or a function reference called with one object. |
| `on-open`, `on-close` | The panel opened or closed. |
| `api` | An object that receives methods: `open()`, `close()`, `toggle()`, `focus()`, `reload()`, `clear()`, `getSelectedItems()` (copies of the selected options: changing them changes nothing in the field). |

## Field options

`name`, `required`, `disabled`, `readonly`, `show-label`, `label-text`, `label-position`, `size`, `hint-text`,
`error-text`, `error-messages`, `show-errors`: see [fields](../fields.md).
