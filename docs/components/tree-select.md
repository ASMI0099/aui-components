# aui-tree-select

One value, or several, from a tree: nested or flat data, loaded at once, level by level, or searched on the server.
Only the rows in view are drawn, so large trees open and search quickly.

```html
<!-- nested data -->
<aui-tree-select ng-model="vm.categoryId" options="vm.categories" leaf-only show-path clearable></aui-tree-select>

<!-- flat data with a parent field, several values -->
<aui-tree-select ng-model="vm.categoryIds" options="vm.flatCategories" parent-field="parentId" label-field="name"
                 multiple value-strategy="parent" max-tag-count="responsive"></aui-tree-select>

<!-- level by level from a server, with server search -->
<aui-tree-select ng-model="vm.categoryId" load-children="vm.children($node)" remote-search="vm.search($query, $signal)"
                 lookup-options="vm.paths($request)" label-field="name" reveal-selected></aui-tree-select>
```

## Data

| Attribute | |
|---|---|
| `options` | The tree: nested (`children-field`) or flat (`parent-field`). |
| `label-field`, `value-field`, `children-field` | `label`, `id` and `children` by default. |
| `parent-field` | Flat data: the field holding the parent's value. |
| `disabled-field` | `disabled` by default. |
| `selectable-field` | A field whose `false` marks a group: shown, never picked. |
| `leaf-field` | Data loaded level by level: `true` marks a node without children (`isLeaf` by default). |
| `disabled-values` | Values whose nodes cannot be picked. |
| `default-expand-level` | Levels open when the data first arrives: a number, or `all`. |

## Picking

| Attribute | |
|---|---|
| `multiple` | Several values; checkboxes, with parents and children linked. |
| `check-strictly` | With `multiple`: parents and children are checked independently. |
| `value-strategy` | With linked checking, what the model holds: `all` (default), `parent` (a fully checked branch as its parent only) or `child` (the leaves only). |
| `leaf-only` | One value: only leaves can be picked. |
| `show-path` | The picked node shown as its whole path ("A / B / C"); `path-separator` changes " / " (read when a path is made: set it once; a path already looked up keeps its separator). |
| `show-line` | Guide lines between the levels. |
| `max-tag-count`, `clearable`, `placeholder`, `searchable`, `search-placeholder`, `empty-text`, `panel-min-width`, `selected-labels` | As in [aui-select](select.md). |

## Loading

| Attribute | |
|---|---|
| `load-children` | `fn($node, $level, $value)` returns the children of a node (an array, `{items, hasMore}` for a "Load more" row, or a promise). |
| `remote-search` | `fn($query, $signal, $cancel)` returns the matches as a pruned tree, or `{items, total}`. |
| `filter-method` | A search of your own in the browser: `fn($node, $query, $label)` returns true for a match. |
| `search-delay` | Server search: the pause after typing (300 ms). |
| `load-options`, `load-params`, `load-enabled`, `load-disabled-text`, `reset-on-params`, `cache-ttl`, `load-timeout`, `preload`, `value-options`, `lookup-enabled`, `lookup-options`, `lookup-group` | As in [aui-select](select.md): the whole tree loaded for the current `load-params`. |
| `reveal-selected` | One value, data loaded level by level: on open, the branches down to the picked node are loaded and opened (children in pages too: the next pages of a branch load until the node is found, up to 20). A value set meanwhile ends the reveal. |

A lookup may answer nodes, nested trees, or root-to-node chains (`[[root, ..., node], ...]`); chains also give the
path and the ancestors. See [options from a server](../remote-data.md).

## Events and API

| Attribute | |
|---|---|
| `on-change` | `fn($value, $oldValue, $nodes, $node, $triggerSource, $byUser)`, or a function reference called with one object. |
| `on-open`, `on-close` | The panel opened or closed. |
| `on-expand` | `fn($node, $expanded)`: a branch opened or closed. |
| `api` | An object that receives methods: `open()`, `close()`, `expandAll()`, `reload()` and more. |

## Field options

`name`, `required`, `disabled`, `readonly`, `show-label`, `label-text`, `label-position`, `size`, `hint-text`,
`error-text`, `error-messages`, `show-errors`: see [fields](../fields.md).
