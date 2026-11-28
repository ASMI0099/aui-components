# aui-modal and AuiModal

A dialog over the page: written in the page's template (`<aui-modal>`), or opened from code (`AuiModal`). Both use
the browser's `<dialog>` where it is available (focus kept inside, the page behind inert) and a fallback elsewhere.
Several dialogs can be open; Escape closes the top one where that one allows it (`close-on-esc`).

## aui-modal

```html
<aui-button ng-click="vm.editing = true">Edit</aui-button>

<aui-modal is-open="vm.editing" size="medium" show-confirm-button="true" confirm-text="Save"
           close-on-esc="true" aria-labelledby="edit-title" on-confirm="vm.save()" on-close="vm.reset()">
    <header><h2 id="edit-title">Edit the item</h2></header>
    <content>
        <aui-input ng-model="vm.item.name" input-style-type="form" show-label label-text="Name"></aui-input>
    </content>
</aui-modal>
```

The parts are given as `<header>`, `<content>` and `<footer>`. Without a `<footer>` the dialog shows a Close
button, and a Confirm button with `show-confirm-button="true"`; with a `<footer>` only its own content shows (the
default buttons are not built). Where the dialog is too narrow for its actions they wrap to a second line. The header
and the footer take the height their content needs; the body between them scrolls. Inside the dialog, `aui-modal-close` on any element
closes it (`aui-modal-close="vm.cancel()"` evaluates the expression too).

The dialog has room around its parts in every layout but `content-layout="fill"`: `1em` inside its border (as the
browser's own dialog, kept where a page's reset sets `dialog { padding: 0 }`), the header bold with `12px` below it,
the footer's actions in a centred row with `10px` between them. `auto-size` keeps all of it, and puts `12px` between
the body and the footer (its body does not grow, so nothing else would keep them apart): a page writes no padding of
its own. The header's and the footer's look come from the stylesheet (`.aui-modal__header`, `.aui-modal__footer`), so a
page's rule changes them without `!important`.

| Attribute | |
|---|---|
| `is-open` | Opens and closes the dialog (two-way: closing it sets it to false). |
| `size` | `small` (40% of the window), `medium` (60%), `large` (80%), `fullScreen`. Without `size`, 85%. On a small window a preset keeps at least 20rem × 12rem (never more than the window). |
| `width`, `height` | A size of its own, each on its own (the other one comes from `size`): a CSS length (`480px`, `30rem`, `50%`, `calc(...)`), or a number from 5 to 100 for that share of the window (`width="55"`: 55vw). |
| `auto-size` | `"true"`: as large as its content (with the room around it), up to 92% × 88% of the window; a taller content scrolls with the whole dialog. |
| `show-header`, `show-footer` | `"false"` hides the part. |
| `show-confirm-button` | `"true"` adds the Confirm button to the default footer. |
| `confirm-text`, `confirm-loading-text` | The Confirm button's text, and its text while `on-confirm`'s promise runs. |
| `on-confirm` | Called by Confirm. Return `false` to stay open, or a promise (also one made in another window, such as an editor in a frame): the button shows its loading state, and the dialog closes when the promise resolves to anything but `false`. |
| `on-open` | Called once per opening, as the dialog opens (`is-open` is true; before its first frame, in the page's digest). The body is built in that digest, or with `defer-render` after the first frame: `on-rendered` says when it is there. Opened again while it still fades out, the dialog turns back: no new call (and no `on-close` for the close it took back), so each `on-open` is followed by one `on-close`. |
| `on-close` | Called when the dialog closes (not when the page removes the open dialog from the page). |
| `close-on-esc` | `"true"`: Escape closes it. Off by default (a form is not lost to a stray key); `AuiModal.open` closes on Escape unless `closeOnEsc: false`. |
| `initial-focus` | A selector inside the dialog for the element that takes the focus on open. |
| `content-layout` | `fill`: the content without padding and outer scrolling (a full-size editor, a chart). With `auto-size`: content that draws its own frame (the message box does), the dialog as large as it within the auto-size limits, scrolling as a whole where it is taller. |
| `border-radius` | The corners, in px. |
| `display-on-top` | `"true"` with `size="medium"`: the dialog sits higher on the page - less high where its height needs the room, so it never leaves the window. |
| `background-opacity` | `OPAQUE_LIKE`: a translucent, blurred dialog; otherwise opaque. |
| `defer-render` | `"true"`: the body is built right after the dialog's first frame, so a large body opens without a pause. |
| `on-rendered` | Called once per opening, after the body was built. Opened again while it still fades out, the dialog turns back with the body it has: no new call then. |
| `aria-label`, `aria-labelledby` | The dialog's accessible name ("Dialog" by default): with a title in the header, give `aria-labelledby` its id, so that the dialog is announced by its title. |
| `aria-describedby` | The id of the element that describes the dialog (read with its name), set on the dialog itself. |

Escape is the page's key: pressed inside a frame (`<iframe>`) in the dialog it belongs to the frame's document and
does not close the dialog; the frame's page can close it (`AuiModal.close()`, its own Close button).

## AuiModal

`AuiModal.open(options)` opens a dialog from code and returns a promise that resolves once it has closed, with
`{reason, value}`: `reason` is `confirm`, `cancel` or `close`, or the reason given to `dismiss(reason, value)`.
Dialogs opened while one is shown wait their turn. If the page removes the dialogs' host (its application ends), the
dialog shown settles (`close`) and the others wait for a host.

```js
AuiModal.open({
    title: 'Delete the draft?',
    content: 'The draft and its attachments are removed.',
    showConfirm: true,
    confirmText: 'Delete',
    onConfirm: function () { return vm.deleteDraft(); }    // a promise keeps the dialog open until it settles
}).then(function (result) {
    if (result.reason === 'confirm') AuiMessage.success('Deleted');
});
```

| Option | |
|---|---|
| `title` | The title. |
| `content` | Shown as text; or a DOM node, placed as it is. |
| `render` | `fn(container, controls)` builds the content itself (`controls.close(value)`, `controls.cancel()`, `controls.confirm()`); it may return a function that cleans up. |
| `showCancel`, `cancelText` | The cancel button (shown by default; "Close"). |
| `showConfirm`, `confirmText` | The confirm button (hidden by default; "OK"). |
| `onConfirm` | Called by the confirm button: `false` keeps the dialog open; a promise keeps it open until it settles. |
| `onOpen` | Called once, when the dialog opens: one opened while another is shown, when its turn comes. A dialog closed while it still waits never opens: it gets `onClose` alone. |
| `onCancel`, `onClose` | `onCancel`: called by the cancel button and `controls.cancel()` (its return value is the result's value); `dismiss('cancel')` closes without it. `onClose`: after the dialog closed (with `{reason, value}`). An error thrown by these (and `onOpen`), by `render` or by its cleanup goes to the application's `$exceptionHandler`. |
| `size`, `width`, `height`, `autoSize`, `contentLayout`, `contentClass`, `initialFocus`, `borderRadius`, `showHeader`, `showFooter`, `closeOnEsc`, `displayOnTop`, `backgroundOpacity`, `ariaLabel` | As the attributes of `aui-modal`. With a `title` shown, the dialog is named by its title; `ariaLabel` names a dialog without one (`showHeader: false`, no title). |

The returned promise also has `close(value)` and `dismiss(reason, value)`; `AuiModal.close(reason, value)` closes the
dialog shown.

## Older browsers

Where the browser has no `<dialog>` (Safari before 15.4, Firefox before 98), the dialog is a fixed box over a dimmed
overlay, moved under `<body>`, never larger than the window. Tab and Shift+Tab stay inside it (in the browser's order:
a disabled fieldset, hidden and inert controls skipped, a radio group by its checked button, positive `tabindex`
first), the page scrolls no more, and the page behind it is hidden from screen readers (`aria-hidden`) and inert where
the browser knows `inert`. Parts the page adds to the body meanwhile are hidden too, and a value of `aria-hidden` the
page sets meanwhile is the one it finds on close. Toasts shown over it go into it and can take the focus. Two limits of
that path: where the browser has no `inert`, a page's own fixed element stacked above z-index 2000 (20 per dialog)
stays clickable above it; and design tokens set on a container around `<aui-modal>` do not reach the moved box
(`--aui-modal-backdrop-color` is taken along): set them on `:root` there.

The services' hosts are mounted in the page's body when the module starts - one set per AngularJS application (a page
with several gets one each, removed when that application ends). For code outside AngularJS the services are also on
`window` (`window.AuiModal`, `window.AuiMessage`, `window.AuiMessageBox`): those of the application started last.
