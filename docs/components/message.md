# AuiMessage and AuiMessageBox

Two services for telling the user something: `AuiMessage` shows short notices (toasts) that go away by themselves;
`AuiMessageBox` shows a dialog that waits for an answer.

## AuiMessage

```js
AuiMessage.success('Saved');
AuiMessage.error('The file could not be uploaded', {duration: 8000});

const notice = AuiMessage.loading('Uploading...');
upload().then(function () {
    notice.update({type: 'success', message: 'Uploaded', duration: 2500});
});
```

`success`, `info`, `warning`, `error` and `loading` take a message and options (or one options object);
`show(options)` takes the type as an option (an option given as `undefined` keeps its default). Each returns a handle
with `close()` and `update(options)`. `update` changes `type`, `title`, `message`, `useHtml`, `dismissible` and
`duration`; the place (`position`) and `onClose` stay as given at the start. A new `type` keeps the timing and the
close button the notice had: give `duration` and `dismissible` with it where they should change (`loading` to
`success`: `{type: 'success', message: 'Done', duration: 2500, dismissible: true}`).

| Option | |
|---|---|
| `type` | `success`, `info` (default), `warning`, `error`, `loading`. |
| `title` | A title above the message. |
| `message` | The message, shown as text. |
| `useHtml` | The message is HTML, cleaned to a safe subset first (see [security](../../SECURITY.md)): text formatting, lists (an ordered list's `start`), tables (`scope` on header cells), links (a relative address resolves from the document's base), `class`, `title`, `lang` and `dir`; no `id`, scripts, forms or media. Line breaks in its text show (as in a plain message): write inline markup on one line, or use `<br>`/`<p>` for breaks. |
| `duration` | Milliseconds before it goes (3500; errors 5000); `0` keeps it until closed (so does one of 24 days or more). A `loading` notice stays until updated or closed. |
| `dismissible` | A close button (shown by default; not for `loading`). |
| `position` | `top-right` (default) or `top-center`. |
| `onClose` | Called when it has gone. An error it throws goes to the application's `$exceptionHandler`. |

The countdown pauses while the pointer (a mouse, a pen) is over a notice and while the keyboard's focus is in it (a
link being read); a tap does not hold it. A notice without a title says its kind to screen readers ("Error: ...").
A long message scrolls inside its notice, and notices that do not fit the window's height scroll; on a phone the two
places form one column. A link in an updated message keeps the focus when the new message has the same link.
`AuiMessage.clearAll()` removes every notice.

Notices stay above the dialogs of `aui-modal`, `AuiModal` and `AuiMessageBox` (and can take the focus there). A
`<dialog>` the page opens itself (`showModal()`) is not followed: show the notice after it, or use `aui-modal`. In a
browser with `<dialog>` but without popovers, notices stay under an open dialog.

## AuiMessageBox

```js
AuiMessageBox.confirm('Discard the changes?', {confirmText: 'Discard', dangerConfirm: true})
    .then(function (confirmed) {
        if (confirmed) vm.discard();
    });

AuiMessageBox.alert('The export has started. You will find it under Downloads.');
```

Every method returns a promise that resolves with `true` (confirmed) or `false` (cancelled or closed). Boxes opened
while one is shown wait their turn, in the order they were asked for. The box is named by its title (by its type when
it has none: "Error", "Confirm") and described by its message. A long message scrolls, and can be reached with the
keyboard.

| Method | |
|---|---|
| `alert(message, options)`, `info`, `success`, `warning`, `error` | A message with an OK button. |
| `confirm(message, options)`, `question` | A question with OK and Cancel. |
| `show(options)` | Everything as options. |

| Option | |
|---|---|
| `type` | `info`, `success`, `warning`, `error`, `question`: the icon, and the title when none is given. |
| `title`, `message` | The title and the message (shown as text). An empty or blank title shows no heading. |
| `useHtml` | The message is HTML, cleaned to a safe subset first. |
| `confirmText`, `cancelText` | The buttons' texts (an empty or blank one keeps the default). |
| `showCancel`, `showConfirm` | Which buttons are shown. A box always keeps a way out: with neither, its OK shows. |
| `dangerConfirm` | The confirm button in the danger colour. |
| `closeOnEsc` | `false`: Escape does not close the box. |
| `confirmCallback`, `cancelCallback`, `closeCallback` | Called on confirm, on cancel, and when the box has closed. An error they throw goes to the application's `$exceptionHandler`. |

A box's width is for a window, not for a CSS `zoom` on the page (see [fields](../fields.md)).
