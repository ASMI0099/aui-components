# aui-button

A button with a native `<button>` inside; the element itself is its place on the page, so a margin, a width or
a class on `<aui-button>` works. Drawn without watchers.

```html
<aui-button ng-click="vm.search()">Search</aui-button>
<aui-button variant="outline" intent="neutral" size="sm" icon="download">Export</aui-button>
<aui-button intent="danger" variant="soft" icon="delete" disabled="!vm.picked.length" title="Pick a row first">Delete</aui-button>
<aui-button type="submit" on-click="vm.save()">Save</aui-button>      <!-- waits for vm.save()'s promise -->
<aui-button icon="settings" variant="ghost"></aui-button>             <!-- an icon alone: square, named "Settings" -->
```

| Attribute | |
|---|---|
| `variant` | `solid` (default), `soft`, `outline`, `elevated`, `dashed`, `ghost`, `link`. |
| `intent` | `brand` (default: the accent, `--aui-control-accent-color`, #0d6efd), `neutral`, `success` (#198754), `warning` (amber #f59e0b, dark text), `danger` (the fields' error red, `--aui-control-invalid-color`). |
| `size` | `xs` (26px), `sm` (30px), `md` (34px, the fields' height; default), `lg` (40px), `xl` (48px). Text sizes follow `--aui-font-scale`. A `link` has no box: its height is its text's. |
| `shape` | `pill`, `square` (as wide as high). Boxed variants only: a `link` keeps its own size. |
| `block` | As wide as its place. A label longer than its place is cut with an ellipsis. |
| `type` | `button` (default: it never submits a form by itself), `submit`, `reset`. |
| `icon` | An icon by name: `add`, `edit`, `pencil`, `square-pen`, `delete`, `copy`, `check`, `close`, `circle-check`, `circle-close`, `search`, `refresh`, `download`, `upload`, `filter`, `settings`, `more`, `info`, `help` (the same line icons as aui-popover's trigger). Or the classes of an icon font: `icon="fa fa-plus"`. |
| `icon-position` | `right` (or `end`): after the text. Default: before it. |
| `aria-label`, `title` | The button's name and tooltip (set on the native button). An icon alone without them is named, and has its tooltip, by the icon's name (`auiTexts.icons`); with only a `title`, the title names it. A label written with `{{ }}` that is empty leaves an icon alone, named so. |
| `aria-describedby`, `aria-haspopup`, `aria-pressed`, `tabindex` | Moved onto the native button (written with `{{ }}` too), where they act: a description, a menu button, a toggle button, a toolbar's tab order. |
| `disabled` | The native disabled button (a bare `disabled` counts too, and `ng-disabled` on the element). It keeps the pointer: its "not allowed" cursor and its tooltip show, and a click on it reaches nothing behind it (a clickable row). |
| `loading` | Its spinner over the icon (or over the text, hidden meanwhile): the width stays. It keeps the focus and its name, and takes no click (`aria-disabled`, `aria-busy`): not ng-click, not a form's submit, not a row behind it. |
| `loading-text` | A text for the time it loads, e.g. `loading-text="Saving..."`: meanwhile the spinner (at the icon, or before the text) and this text in place of the label, with `loading` or with `on-click`'s promise (no page flag or `{{ }}` switch needed). The width never shrinks meanwhile; a longer text widens it. An icon alone keeps its square (no text). Without it: as `loading`. |
| `expanded` | A button that opens and closes something, e.g. a row's list of variants: `expanded="row.variantsOpen"`. The chevron points right while closed and turns down when open (as aui-tree-select's rows); `aria-expanded`. A click flips the value itself; `on-click` gets `$expanded` (the state asked for), and a promise it returns (the variants from the server) shows the spinner in the chevron's place and opens only once it resolves (on a failure it stays closed: the page says why). The page may set the value too (expand all). An expression that cannot be written to only shows the state. An icon alone is named Expand / Collapse; with text, the chevron comes before it. Usually `variant="ghost" intent="neutral" size="sm"`. |
| `controls` | With `expanded`: the id of what it opens (`aria-controls`). |
| `expand-icon` | With `expanded`, its look: `chevron` (the default: before the text, right turning down, as aui-tree-select), `show-more` (after the text, down turning up: more shown right below), `show-more-double` (as `show-more`, with two chevrons: more of a whole section), `caret` (a filled triangle, right turning down), `plus` (a box with a plus that becomes a minus; no turn). |
| `on-click` | Called with `$event`. A promise it returns (`$q`'s or the browser's own) keeps the button loading until it settles: no second click, no double submit. `ng-click` on the element works too (and gets no click while disabled or loading). |
| `copy-text` | A click copies this text to the clipboard, then for a moment shows "Copied" in place of its text, and with an icon a ring with a check that draws itself in, in place of the icon ("Copy failed" and a ring with a cross when the browser refused), read out to screen readers. After several quick clicks the latest copy's outcome shows. The button keeps its width for either text. See [copy buttons](#copy-buttons). |
| `copy-feedback` | `none`: `copy-text` copies, and the button's look and name stay as they are (the page confirms in its own way). |
| `on-copy` | After every copy: `$success` (`true` or `false`) and `$text`. |
| `done-text` | After `on-click`'s promise resolves, this text for a moment (`done-text="Saved"`), and on a button with an icon the drawn check in place of the icon. A new click ends it at once (a failed retry never shows the earlier success). Without it nothing changes after a click. |
| `done-duration` | How long the feedback shows, in ms: 2000 by default, held between 300 and 10000. |

The space between buttons is the page's layout (the button has no margin of its own). Leave at least 4px between
small icon buttons (`xs`, `link`) placed side by side, so that their 24px targets do not overlap. The native button's
form attributes (`form`, `name`, `value`, `formaction`, `formnovalidate`, ...) are not passed on: use `on-click`, or a
native `<button>` where a form needs them.

## Copy buttons

```html
<!-- an icon alone: the drawn check and "Copied" for 2 seconds after a click -->
<aui-button icon="copy" variant="ghost" intent="neutral" copy-text="{{ vm.order.code }}"></aui-button>

<!-- with a text: "Copy" becomes "Copied"; the button keeps its width -->
<aui-button icon="copy" variant="outline" copy-text="{{ vm.link }}">Copy link</aui-button>

<!-- a fixed copy icon: it copies, the page confirms in its own way -->
<aui-button icon="copy" variant="ghost" copy-text="{{ vm.apiKey }}" copy-feedback="none"
            on-copy="vm.copied($success)"></aui-button>

<!-- a fixed copy icon, the page's own code copies -->
<aui-button icon="copy" variant="ghost" ng-click="vm.copyRow(row)"></aui-button>
```

* The text goes to the clipboard through the Clipboard API. Where that is missing or refused (a page served over
  `http://`, an older browser) the button copies the older way, through a hidden text box next to it (also inside
  an open modal dialog); the focus and the page's own selection are put back. When both fail, it shows "Copy failed"
  and `on-copy` gets `$success` `false`.
* The button only writes to the clipboard, and only on a click; it never reads it.
* The done mark draws itself in: the ring (0.3s), then the check (0.2s). The cross of a failure appears at once. With the
  system setting for reduced motion, both appear whole at once.
* On a button without a fill the check is green and the cross red; on a solid button they keep its text colour.
* A text button holds the room of "Copied" (or the `done-text`) from the start, so nothing around it moves.
* The texts are `auiTexts.button.copied` and `auiTexts.button.copyFailed` (see [texts](../texts.md)).

## Look

Every text passes 4.5:1 against its fill or tint, hovered and pressed too (WCAG AA for 14px text). Brand is the accent, by default
#0d6efd (the primary blue of Bootstrap 5): a solid one is the accent itself (white text 4.50:1), the same blue as the
checkboxes, focus marks and links; hover is one step deeper (#0b5ed7); the soft, outline and ghost texts are its text
shade (#0a58ca), the soft backgrounds its tints. A page or a container that sets `--aui-control-accent-color` gets
matching buttons and fields. Success is the green of Bootstrap 5 (#198754), warning an amber with dark text on its fill
(on white and on its tints its text is a dark amber, #a34a08), danger the fields' error red: a delete button and a field's error match.
A neutral outline's light border turns a step darker on hover (#b8c1cf, a soft grey).
The text is in the page's own font. Hover and press change colour at once (a colour that fades repaints the page each
frame) and nothing moves: no press scale, no hover lift (either redrew the text and the icon at a fractional size, and
the icon hopped about a pixel against its text). The keyboard's focus shows a 2px ring in the accent around a 2px gap,
on every variant and intent (in high contrast mode an outline in the system's highlight colour). A page's span rules (padding,
size, weight, colour) do not reach its text.
