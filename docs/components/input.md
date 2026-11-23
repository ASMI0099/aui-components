# aui-input and aui-textarea

Text, number, password and search fields, in three styles; `aui-textarea` is the multi-line field.

```html
<aui-input ng-model="vm.user.name" input-style-type="form" show-label label-text="Name" clearable required show-errors></aui-input>

<aui-input ng-model="vm.item.price" input-type="number" precision="2" min="0" suffix-text="per unit"
           input-style-type="form" show-label label-text="Price"></aui-input>

<aui-input ng-model="vm.account.password" input-type="password" show-password input-style-type="form"
           show-label label-text="Password"></aui-input>

<aui-input ng-model="vm.filter" search search-debounce="300" on-search="vm.find($value)" placeholder="Search"></aui-input>

<aui-textarea ng-model="vm.note" rows="3" auto-height max-rows="8" value-max-length="500" show-count></aui-textarea>
```

## Styles and types

| Attribute | |
|---|---|
| `input-style-type` | `form`: a box with its border (the fields' look); `basic` (default, also for an empty or unknown value): a line under the text; `cell`: the form box for an editable table cell (28px, no border until hovered or focused). |
| `input-type` | `text` (default), `number`, `password`, `email`, `tel`, `url`, `search`; any other value is `text`. Read when the field starts: set it once, not to change later. |
| `placeholder` | Shown while the field is empty. |
| `width` | A width in px; it may change. |
| `input-text-bold` | The text bold and dark. |

In a field too narrow for all its parts, the prefix and suffix texts and the label in the box give way first (cut with
an ellipsis); the text, the clear button and the count keep their room. Narrower still, the count is cut, then the clear
button and the password eye narrow, all inside the field's frame (nothing runs into the next field, and a click outside
the field never reaches its buttons). The fields are laid out left to right; right-to-left
pages are not supported yet.

## Limits and checks

| Attribute | |
|---|---|
| `value-max-length` | The longest text; longer shows as invalid (`maxlength`). A number field takes no more characters than that (the minus and the point count). `0` or unset: no limit. |
| `enforce-limits` | The limits stop the typing instead of only showing an error: `value-max-length` of a text, `max` / `min` of a number. |
| `show-count` | The length of the text as the check counts it (without the spaces around it), out of `value-max-length` when set ("3/7"); with `enforce-limits`, every character the box holds. Never for a password. |
| `min`, `max` | A number's limits. |
| `precision` | A number: at most this many decimals (`0`: whole numbers). |
| `pattern` | A pattern the text must match. |

Number fields hold a number in the model (or nothing for an empty box); a text from the page that reads as a number
("12", " 12.5 ") is shown as that number. An edit that takes a number further out of its limits is undone; one that
brings it closer is kept, so a value from the page beyond a limit can be corrected digit by digit. Undone, the caret
goes to the end of the text: a browser's number box gives a page no caret position to keep.

`required` and `precision` hold for a form the browser checks too (a native submit without `novalidate`): an empty
required field, or one with more decimals than allowed, stops it as a native field does.

When the page changes a rule (`max`, `pattern`, `value-max-length`, `precision`), the value is checked again at once:
the model follows the check as Angular's own fields do, the field stays pristine, and no `on-change` is reported.

## Box contents

| Attribute | |
|---|---|
| `clearable` | A clear button while the field has text. |
| `prefix-icon`, `suffix-icon` | Icon classes shown before or after the text. Single-line fields only. |
| `prefix-text`, `suffix-text` | A short text before or after the text: a unit ("kg", "%"), a sign ("#"). Single-line fields only. |
| `show-password` | A password field: an eye button shows the password while the field is in use; leaving the field hides it. |
| `search` | A search field: the search icon, `role="searchbox"`, `on-search`. |
| `search-debounce` | A search field also searches this many ms after typing pauses (otherwise on Enter and when the text is emptied). |
| `searching` | A search field: a search is running (a spinner in place of the icon, `aria-busy`). |

## Browser behaviour

| Attribute | |
|---|---|
| `autocomplete` | `off` unless given: no browser list of earlier entries. `on` or a token (`email`, `username`, ...) brings it back; a password field uses `current-password`. |
| `inputmode` | The keyboard of a phone (`numeric`, `decimal`, `tel`, `email`). |
| `autofocus` | The field takes the focus once it is shown (a field hidden at first, as under `ng-show`: when it shows). |
| `spellcheck` | The browser's spell check (always off for a password). |

## aui-textarea

`aui-textarea` takes the attributes of `aui-input` in the form style, and:

| Attribute | |
|---|---|
| `rows` | The lines shown (3 by default). |
| `auto-height` | Grows with its text, from `rows` up to `max-rows` lines (8 by default), then scrolls; it fits again when its width changes. |

## Events and API

| Attribute | |
|---|---|
| `on-change` | `fn($value, $oldValue, $triggerSource, $byUser)`; `$triggerSource` is `input` (typing), `clear` (the clear button) or `api`. |
| `on-finish` | Enter was pressed, or the field was left (moving to its own clear button or eye is not leaving it). |
| `on-search` | A search field: `fn($value)`, the text in the box without the spaces around it (all of it with `ng-trim="false"`). |
| `on-focus`, `on-blur` | `fn($event, $value)`. |
| `on-clear` | After the value was cleared: `fn($event)`. |
| `api` | An object that receives methods: `focus()`, `blur()`, `clear()`, `select()`. |

`ng-model-options` acts on the field as on Angular's own inputs: `updateOn` (`blur` included, with its debounce),
`debounce` and `getterSetter`; with `updateOn` or a debounce the field is dirty once a changed text commits, as Angular's
own (an invalid text too, whose value stays empty). Until a typed text commits, the field's value and validity stay
those of the value before it: a rule that changes meanwhile re-checks that value, and the model follows as Angular's
`$validate` has it (empty once invalid); the typed text then commits with the rules as they are at its commit (a form
submit commits it too). `form.$rollbackViewValue()` brings the value before it back. `allowInvalid` is not supported:
an invalid text leaves the model empty. `ng-trim="false"` keeps the spaces around the text in the model.

A form's native reset (a reset button, `form.reset()`) does not change Angular models: the field keeps showing its
model's value. A typed text still waiting for its commit stays, as in Angular's own input
(`form.$rollbackViewValue()` puts the value back). Reset a field through its model. A field without a `name` adds nothing to the form's data. Angular's
`required` reads the trimmed text, the browser's the text as it is: a text of spaces is empty to Angular only.

## Field options

`name`, `required`, `disabled`, `readonly`, `show-label`, `label-text`, `label-position`, `size`, `hint-text`,
`error-text`, `error-messages`, `show-errors`: see [fields](../fields.md).

The field's own `aria-label`, `aria-labelledby` and `aria-describedby` are given to its box, where screen readers read
them. Inside a disabled `<fieldset>` the field is disabled as a native one: it looks disabled, nothing clears it, shows
its password or starts a search from it. In the basic style the label is the caption in the line: `label-text` with
`show-label`, otherwise the placeholder. The caption shows above the line while the box has the focus (at rest the
placeholder names the field); with `label-text` and no placeholder it stays there at rest too.
