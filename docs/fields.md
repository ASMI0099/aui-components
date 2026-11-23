# Fields: label, size, message line

aui-input, aui-select, aui-tree-select and aui-date-picker share one field box and these options.

## Label

| Attribute | |
|---|---|
| `show-label` | Shows `label-text` with the field. |
| `label-text` | The label. Without `show-label` it still names the field for screen readers. |
| `label-position` | Unset: the label sits in the box, at its start. `top`: above the box, the box as wide as its place. |

A label longer than its room is cut with an ellipsis; the whole text shows as its tooltip.

The page's own `aria-label`, `aria-labelledby` and `aria-describedby` on aui-input, aui-select or aui-tree-select go
to the element that has the focus (the box, the select's trigger), where screen readers read them: `aria-label` before
`label-text`, and `aria-describedby` next to the message line.

## Size

`size="small"` (28px high) or `size="large"` (40px); unset, the fields are 34px (`--aui-control-height`). Inside a
component the text sizes follow the size; see [theming](theming.md) for the tokens.

## The message line

A line under the field for a hint, or, while the field shows as invalid, the reason.

| Attribute | |
|---|---|
| `hint-text` | A hint, shown in the muted colour while the field is valid. |
| `error-text` | One text for any failed check. |
| `error-messages` | A text per check: `{required: 'Pick a category', maxlength: 'At most {length} characters'}`. |
| `show-errors` | Shows the shared texts of `auiTexts.field` for every failed check (off by default). |

A field shows as invalid once it is invalid and has been touched (left at least once), the `ng-touched` convention.
The line is announced to screen readers (`aria-live`) and linked to the box (`aria-describedby`).

```html
<aui-input ng-model="vm.user.code" name="code" required ng-pattern="/^[A-Z]{3}-\d{3}$/"
           show-label label-text="Code" hint-text="For example ABC-123"
           error-messages="{pattern: 'Three capitals, a dash and three digits'}" show-errors></aui-input>
```

## In a form

The fields work with `ngModel` and the page's form like native inputs:

* `name` registers the field in the form (`form.code.$error`, `$dirty`, `$touched`);
* `required` / `ng-required`, `ng-disabled`, `ng-readonly` (or the components' own `disabled`, `readonly`);
* `ng-change` runs on a change by the user; `on-change` gives more detail (the old value, what made the change:
  typing, clearing, a pick, the page's code).

A native form submit (without Angular) sends a list field with several values as one entry, its values joined by
commas (`pick=A,B`), as the fields always have: values that contain a comma cannot be told apart there. Angular's model
keeps every value as it is; send that where the values may hold commas.

The fields are laid out left to right; right-to-left pages (`dir="rtl"`) are not supported yet. The browser's own
zoom is supported; a CSS `zoom` on the page or on a container around a field is not (the panels open in the browser's
top layer, outside that zoom).

A `readonly` field shows its value and takes the focus, but nothing opens or changes. A `disabled` field takes no
focus, adds nothing to a native submit's data and is not checked by the browser, as a native one. Inside a disabled
`<fieldset>` the list fields are disabled too. The browser's own check of a form (a native submit) brings the focus
to the first invalid field and shows it invalid; a native reset leaves the fields showing their models' values.
With `ng-model-options` (`updateOn: 'blur'`, a debounce) a pick commits as Angular's own inputs do, and `on-change`
reports it once it is committed.

## Keyboard

Every field is reachable with Tab. The list fields open with Enter, Space or the Down arrow; in the open list the
arrow keys move, Home and End jump to the first and last row, Enter picks, and Escape, Tab or Alt+Up close it. In a
tree, Right expands a branch and Left collapses it. A load or a server search that failed shows "Retry": Enter in the
field retries it too (while no row is highlighted). Screen readers hear the list's messages as they come: nothing
found, a failure, a search too short, loading off.
