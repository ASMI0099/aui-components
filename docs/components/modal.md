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
default buttons are not built). Where the dialog is too narrow for its actions they wrap to a second line. Inside the dialog, `aui-modal-close` on any element
closes it (`aui-modal-close="vm.cancel()"` evaluates the expression too).

| Attribute | |
|---|---|
| `is-open` | Opens and closes the dialog (two-way: closing it sets it to false). |
| `size` | `small` (40% of the window), `medium` (60%), `large` (80%), `fullScreen`. Without `size`, 85%. On a small window a preset keeps at least 20rem × 12rem (never more than the window). |
| `width`, `height` | A size of its own, each on its own (the other one comes from `size`): a CSS length (`480px`, `30rem`, `50%`, `calc(...)`), or a number from 5 to 100 for that share of the window (`width="55"`: 55vw). |
| `auto-size` | `"true"`: as large as its content. |
| `show-header`, `show-footer` | `"false"` hides the part. |
| `show-confirm-button` | `"true"` adds the Confirm button to the default footer. |
| `confirm-text`, `confirm-loading-text` | The Confirm button's text, and its text while `on-confirm`'s promise runs. |
| `on-confirm` | Called by Confirm. Return `false` to stay open, or a promise: the button shows its loading state, and the dialog closes when the promise resolves to anything but `false`. |
| `on-close` | Called when the dialog closes. |
| `close-on-esc` | `"true"`: Escape closes it. Off by default (a form is not lost to a stray key); `AuiModal.open` closes on Escape unless `closeOnEsc: false`. |
| `initial-focus` | A selector inside the dialog for the element that takes the focus on open. |
| `content-layout` | `fill`: the content without padding and outer scrolling (a full-size editor, a chart). |
| `border-radius` | The corners, in px. |
| `display-on-top` | `"true"` with `size="medium"`: the dialog sits higher on the page. |
| `background-opacity` | `OPAQUE_LIKE`: a translucent, blurred dialog; otherwise opaque. |
| `defer-render` | `"true"`: the body is built right after the dialog's first frame, so a large body opens without a pause. |
| `on-rendered` | Called once per opening, after the body was built. |
| `aria-label`, `aria-labelledby` | The dialog's accessible name ("Dialog" by default): with a title in the header, give `aria-labelledby` its id, so that the dialog is announced by its title. |

## AuiModal

`AuiModal.open(options)` opens a dialog from code and returns a promise that resolves once it has closed, with
`{reason, value}`: `reason` is `confirm`, `cancel` or `close`. Dialogs opened while one is shown wait their turn.

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
| `onCancel`, `onClose` | Called on cancel, and after the dialog closed (with `{reason, value}`). |
| `size`, `width`, `height`, `autoSize`, `contentLayout`, `contentClass`, `initialFocus`, `borderRadius`, `showHeader`, `showFooter`, `closeOnEsc`, `displayOnTop`, `backgroundOpacity`, `ariaLabel` | As the attributes of `aui-modal`. |

The returned promise also has `close(value)` and `dismiss(reason, value)`; `AuiModal.close(reason, value)` closes the
dialog shown.

## Older browsers

Where the browser has no `<dialog>` (Safari before 15.4, Firefox before 98), the dialog is a fixed box over a dimmed
overlay, moved under `<body>`. Tab and Shift+Tab stay inside it, the page scrolls no more, and the page behind it is
hidden from screen readers (`aria-hidden`, put back on close). Two limits of that path: the overlays sit at z-index
2000 and up (20 per dialog), so a page's own fixed element stacked higher stays above them; and design tokens set on a
container around `<aui-modal>` do not reach the moved box (`--aui-modal-backdrop-color` is taken along): set them
on `:root` there.

The services are mounted once in the page's body when the module starts. For code outside AngularJS they are also on
`window` (`window.AuiModal`, `window.AuiMessage`, `window.AuiMessageBox`).
