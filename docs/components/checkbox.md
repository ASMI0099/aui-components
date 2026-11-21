# aui-checkbox and aui-checkbox-group

A box on `ng-model`, or a group of boxes on one array. A native checkbox underneath: Space, the label's click and
screen readers are the browser's own; the component draws the box.

```html
<aui-checkbox name="agree" ng-model="vm.f.agree" ng-required="true" show-errors="true" label="I agree to the terms"></aui-checkbox>
<aui-checkbox ng-model="row.picked" size="sm" aria-label="{{ row.name }}" on-change="vm.syncAll()"></aui-checkbox>
<aui-checkbox-group name="perms" ng-model="vm.perms" options="vm.permOptions" label-field="name" value-field="id"
                    show-select-all="true" max="3"></aui-checkbox-group>
```

## aui-checkbox

| Attribute | |
|---|---|
| `ng-model` | Required. Its value: `true-value` while checked, `false-value` while not (`true` and `false` by default; any value, compared by value). |
| `label` | The text beside the box. Without one, its target is 24px (a table's rows). |
| `aria-label` | Its name for screen readers; over the label too (a row's number as the label, "Select row 3" as the name). |
| `label-position` | `left`: the label before the box. |
| `size` | `compact` (12px), `sm` (14px), `normal` (16px, the default; `md` too), `lg` (22px), `inherit` (1em, the text around it). |
| `container-border` | In a field's box (the fields' height, border and focus ring), blue while checked. As wide as its place in a form; as wide as itself in a row of the page (a flex container). |
| `indeterminate` | The mixed look while it is not checked (a select-all with some rows checked). The user's click leaves it, as a native checkbox's does, until the page sets `indeterminate` again. |
| `disabled`, `ng-disabled` | Not to be changed by the user. |
| `required`, `ng-required` | Checked (its `true-value`) is its value. |
| `show-errors`, `hint-text`, `error-text`, `error-messages` | The fields' message line under it; the error once it has been left (touched). |
| `name` | Its name in the page's form: the form holds the field itself (`form.agree.$error.required`). |
| `on-change` | After the user's change: `$value`, `$oldValue`, `$checked`, `$triggerSource` (`toggle`), `$byUser`. `ng-change` works too. |
| `tab-index` | The box's tabindex. |

## aui-checkbox-group

Its model is an array: the values of the checked options, in the options' order. Values the options do not hold are
kept, after them (a saved value whose option is not loaded). Replace the array to change it from the page; one changed
in place is followed too.

| Attribute | |
|---|---|
| `options` | Objects or plain values. |
| `label-field` | `label` by default. |
| `value-field` | Without one: the object's `value`, or the object itself. |
| `disabled-field` | An option that cannot be changed (it keeps its state, select-all too). |
| `layout` | `row` (the default, wrapping), `column`, `grid` (`columns`, 3 by default). |
| `size`, `container-border` | As aui-checkbox's, for every box. |
| `show-select-all` | A box above them for all the enabled options (`select-all-text`; `auiTexts.list.selectAll`), mixed while only some are checked. |
| `min`, `max` | How many may be checked. `max` reached: the other options disabled (select-all too, when it would check more). Fewer than `min` or more than `max`: the `minItems` / `maxItems` error. |
| `required`, `ng-required` | At least one. |
| `disabled`, `ng-disabled`, `aria-label`, `name`, the message line | As aui-checkbox's. |
| `on-change` | After the user's change: `$value`, `$oldValue`, `$option` (the option toggled; none for select-all), `$checked`, `$triggerSource` (`toggle`, `select-all`), `$byUser`. |

## Look

The accent while checked or mixed; an unchecked border that stands out from white (3:1); hover changes the
border, the keyboard's focus adds the ring; red once a required one is left empty. The check and the mixed bar fill
the box (no centring by offsets: whole in a dialog and at any screen scaling). The label is in the components' text style, its
first line beside the box and more lines under it, on the baseline of the page's text around it. The box's middle is
where the middle of the label's digits and capitals is, measured in the label's own font (0.36em above the
baseline when the browser cannot measure it): a row's number stands in the middle of its box in any font. The element itself
is the component's box, so a page's line height does not move its parts.

## Cost

One watcher for a box (its message line), one more for a required one; its state is drawn without watchers. A click
draws the box at once; the page's digest follows after the next frame.
