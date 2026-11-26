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
| `required`, `ng-required` | Checked (its `true-value`) is its value. The box's own `required` too: the browser's check of a native form stops at it while unchecked. |
| `show-errors`, `hint-text`, `error-text`, `error-messages` | The fields' message line under it; the error once it has been left (touched). |
| `name` | Its name in the page's form: the form holds the field itself (`form.agree.$error.required`). In a native form (`FormData`, a submit without Angular) the box sends its `true-value` while checked (as text; an object as JSON). |
| `on-change` | After the user's change: `$value` (the value chosen: `true-value` or `false-value`), `$oldValue`, `$checked`, `$triggerSource` (`toggle`), `$byUser`. With `ng-model-options` that defer the model (a `debounce`, `updateOn: 'blur'`) it comes once the model has the value. `ng-change` works too. |
| `tab-index`, `tabindex` | The box's tabindex (a `tabindex` on the element is moved onto the box: one Tab stop). |
| `aria-labelledby`, `aria-describedby` | Moved onto the box: a name and a description from the page's own text (the description joins the message line's). A `<label for>` pointing at the element does not reach the box (the element is not a form control): use `label`, `aria-label` or `aria-labelledby`. |

## aui-checkbox-group

Its model is an array: the values of the checked options, in the options' order. Values the options do not hold are
kept, after them (a saved value whose option is not loaded). Replace the array to change it from the page; one changed
in place (`push`, `splice`) is followed too, its checks (`required`, `min`, `max`) with it. Options of one value are one
choice: they are checked and cleared together, and the value is in the model once. An option object edited in place
(its label, its `disabled-field`, its value) is followed at the next digest.

| Attribute | |
|---|---|
| `options` | Objects or plain values. |
| `label-field` | `label` by default. |
| `value-field` | Without one: the object's `value`, or the object itself. |
| `disabled-field` | An option that cannot be changed (it keeps its state, select-all too). |
| `layout` | `row` (the default, wrapping), `column`, `grid` (`columns`, 3 by default). |
| `size`, `container-border` | As aui-checkbox's, for every box. |
| `show-select-all` | A box above them for all the enabled options (`select-all-text`; `auiTexts.list.selectAll`), mixed while only some are checked. |
| `min`, `max` | How many may be checked, counted over every value the model holds (a saved value whose option is not loaded too). `max` reached: the other options disabled; select-all is disabled when checking would go past `max`, and always clears. Fewer than `min` or more than `max`: the `minItems` / `maxItems` error. |
| `required`, `ng-required` | At least one. |
| `disabled`, `ng-disabled`, `aria-label`, `aria-labelledby`, `aria-describedby`, the message line | As aui-checkbox's (on the group: `role="group"`, `aria-invalid` while its error shows). A disabled group keeps showing what is checked, on select-all too. |
| `name` | Its name in the page's form; in a native form each checked option sends its value under it. `required`, `min` and `max` hold for the browser's check of a native form too (the error is the first enabled box's own). |
| `on-change` | After the user's change: `$value` (the values chosen), `$oldValue`, `$option` (the option toggled; none for select-all), `$checked`, `$triggerSource` (`toggle`, `select-all`), `$byUser`; once a deferred model has them, as aui-checkbox's. |

## Look

The accent while checked or mixed; an unchecked border that stands out from white (3:1); hover changes the
border, the keyboard's focus adds the ring; red once a required one is left empty. The check and the mixed bar fill
the box (no centring by offsets: whole in a dialog and at any screen scaling). The label is in the components' text style, its
first line beside the box and more lines under it, on the baseline of the page's text around it. The box's middle is
where the middle of the label's digits and capitals is, measured in the label's own font (0.36em above the
baseline when the browser cannot measure it): a row's number stands in the middle of its box in any font, measured
again when the page changes the font later. The element itself
is the component's box, so a page's line height does not move its parts.

## Native forms and focus

A native reset of the form (`form.reset()`, a reset button) leaves the boxes as the model is (the model is the
truth). Inside a disabled `<fieldset>` the boxes look disabled too. A box without a label has a 24px target around it;
where two such boxes stand closer than that, a click on one's box goes to that box. The keyboard's focus on a checked
or mixed box is a ring in the accent around a gap (the button's); in high contrast mode an outline in the system's
highlight colour, a disabled checked box in its grey.

## Cost

One watcher for a box (its message line), one more for a required one; a group adds one that reads its options' own
fields (no copies). Its state is drawn without watchers; checked values are looked up, not searched. A click draws
the box at once and sets the model in the same moment; the page's other bindings follow in one digest of the page
after the next frame. Only on a page whose digest is slow (over 50ms) is it held back for boxes clicked one after
another (within a second of the last), until the clicking pauses (400ms; 1s over 100ms), so that no click waits for
the page; never for a select-all box (one with `indeterminate`): the rows follow it at once.
