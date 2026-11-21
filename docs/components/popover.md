# aui-popover

A card next to its trigger: a title, the page's content, and Cancel and Confirm (or the page's own footer).

```html
<aui-popover title-text="Stock of {{ row.name }}" width="280" close-on-click-outside="false"
             on-open="vm.startEdit(row)" on-confirm="vm.save(row)">
    <popover-content>
        <aui-input input-style-type="form" show-label="true" label-text="Stock" ng-model="vm.draft.stock"></aui-input>
    </popover-content>
</aui-popover>
```

## Layout

The title, the content and the footer sit 16px from the card's sides; the content has 12px above and below (8px under
a title), and its parts stand one under the other, 12px apart (a margin the page sets on them wins). No wrapper with
padding is needed.

| Attribute | |
|---|---|
| `title-text` | The title (a `popover-title` slot, for a title with markup, wins). |
| `show-title` | Bindable. `false`: no title. |
| `content-padding` | `compact`: 8px and 12px. `none`: the content brings its own (cards written before the layout). |
| `width` | The card's width (a number: px; any CSS length), up to the screen's width. Without it: its content's, from 160px up to a reading width of 480px (`--aui-popover-max-width` on the popover or a container: another). |

## The trigger

Without a `popover-trigger`, the popover draws its own: an icon, a text, or both, laid out together as one target
(hover, focus ring, a soft highlight while open).

```html
<aui-popover trigger-text="Change the price" on-confirm="vm.save()">...</aui-popover>
<aui-popover trigger-icon="delete" trigger-text="Delete" trigger-tone="danger" confirm-intent="danger">...</aui-popover>
<aui-popover trigger-icon="info" trigger-on="hover">...</aui-popover>
```

| Attribute | |
|---|---|
| `trigger-icon` | `edit` (default; a pencil on a line), `pencil` (the pencil alone), `square-pen` (a pen on a square), `delete`, `copy`, `info`, `help`, `more`, `filter`, `settings`, `add`, `search`, `refresh`, `download`, `upload` (the icons, aui-button's too); `none` with a text: the text alone. One line style, drawn in the trigger's colour. An unknown name: `edit`. |
| `trigger-text` | A text beside the icon, in the components' own text style (13px with `--aui-font-scale`). |
| `show-trigger-text` | Bindable. `false`: the icon alone; the text is then its tooltip and its name for assistive technology. |
| `trigger-icon-position` | `end`: the text first, the icon after it. Default: the icon first. |
| `trigger-tone` | `link` (blue; the default with a text), `muted` (grey; the default for an icon alone), `text` (the page's text colour), `danger` (red). On hover and while open: blue on a soft tint (`danger`: red). |
| `trigger-on` | `hover`: the mouse resting on the trigger (0.2s) opens it too, and leaving the trigger and the card closes it (0.25s; not while the focus is in the card). A press on the trigger keeps it open; touch screens use the press. |

An icon alone is named by its text, or by its name in `auiTexts.icons` (see [texts](../texts.md)), shown as its tooltip.

## Slots

| Slot | |
|---|---|
| `popover-trigger` | The page's own trigger, in the page's own look. Without one: the popover's own (above). |
| `popover-title` | A title with markup (`title-text` for a plain one); it also names the card for assistive technology. |
| `popover-content` | Required. In the card's layout (above), in the page's own text. |
| `popover-footer` | The page's own footer, in place of Cancel and Confirm. An empty one: no footer. |

## Attributes

| Attribute | |
|---|---|
| `is-open` | Two-way. The page can open and close it, and it follows what the user does. An expression the page computes (`vm.editing === row.id`) opens and closes it as it changes; the user's close leaves the page's value as it is. |
| `api` | An object the popover fills with `open()` and `close()`. |
| `on-open` | Before it opens. Returning `false` cancels the opening. |
| `on-confirm` | Confirm of the card's own footer. Returning `false` keeps it open. Returning a promise (a save): Confirm waits with a spinner and the card closes when it resolves to anything but `false`; rejected or `false`, it stays as the user left it. Closed meanwhile, that answer changes nothing. |
| `on-close` | Once for each close, whatever closed it. None once the popover is destroyed. |
| `confirm-text`, `cancel-text` | The two buttons' words (default: `auiTexts.modal.confirm`, `.cancel`). |
| `confirm-intent` | `danger`: a red Confirm (a delete confirmation); any aui-button intent. |
| `confirm-on-enter` | Default on: Enter in a one-line text box of the card does what Confirm does (with the card's own footer; not in a field's own box: aui-select, aui-date-picker, a search box, a form inside the card). `false`: off. Either way, Enter there never submits a form of the page around the popover. |
| `auto-focus` | Default on: opened from the trigger, the card's first text box takes the focus. `false`: off (the keyboard then focuses the card). Never when the page opens it. |
| `disabled` | The trigger does not open it (it shows so, with `aria-disabled`); `is-open` and `api.open()` still do. |
| `close-on-click-outside` | `false`: a press outside and the focus moving out leave it open (Escape, Cancel, Confirm and the trigger still close it). |
| `placement` | `bottom-start` (default). `top`, `bottom`, `left` or `right`, with `-start`, `-end`, or centred (`bottom`, or `bottom-center`). |
| `strategy` | `absolute`: only for a browser without the Popover API (otherwise the card is in the top layer). |

## Behaviour

- Opens on the press of the mouse button (as aui-select), 4px from what is seen of the trigger (its icon or its text;
  their 24px target reaches past them). Above or under it: on the side where all of the card fits inside the trigger's
  own scrolling area (a dialog's body, a box of rows), else inside the window, its own side first; on neither, the side
  with more room. It stays 8px inside them; a card taller than its room scrolls. It follows the trigger while the page
  scrolls (flipping at the area's edge), and hides while the trigger is scrolled out of its container.
- The card is in the browser's top layer (Popover API): no `overflow`, `transform` or `z-index` of the page clips or
  covers it, in a dialog too.
- Closes on the trigger, Cancel, Confirm, Escape, a press outside, the focus moving to another control, `is-open`,
  `api.close()`. Opening another popover closes the open one. A click again while it fades out opens it again.
- Keyboard: Tab reaches the trigger (or the page's own control in it); Enter and Space open it and move the focus into
  the card (a button of the page's own in the trigger too); Escape closes it and gives the focus back to the trigger.
  Escape that a control inside used (an open aui-select) closes only that control; around the popover, an aui-modal
  stays open.
- The content is built at each opening and removed after the close: a form in it starts fresh.
- A click in the trigger or the card goes no further up the page: a table row that opens on a click does not.
- Cost: nothing listens while it is closed. Opening and closing draw the card with a digest of its own (`is-open` is
  written to the page's value at once, so the card's content shows it from the first frame); a page digest follows
  after the first frame only when the page binds `is-open` or one of the `on-*` callbacks.
- Class names `popover-container`, `popover-trigger`, `popover-panel` are kept for pages that select them; the
  container has the class `open` while open.
- Needs Floating UI (`window.FloatingUIDOM`), as the fields do.
