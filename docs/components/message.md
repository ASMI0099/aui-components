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
`show(options)` takes the type as an option. Each returns a handle with `close()` and `update(options)`.

| Option | |
|---|---|
| `type` | `success`, `info` (default), `warning`, `error`, `loading`. |
| `title` | A title above the message. |
| `message` | The message, shown as text. |
| `useHtml` | The message is HTML, cleaned to a safe subset first (see [security](../../SECURITY.md)). |
| `duration` | Milliseconds before it goes (3500; errors 5000); `0` keeps it until closed. A `loading` notice stays until updated or closed. |
| `dismissible` | A close button (shown by default; not for `loading`). |
| `position` | `top-right` (default) or `top-center`. |
| `onClose` | Called when it has gone. |

The countdown pauses while the pointer is over a notice. `AuiMessage.clearAll()` removes every notice. Notices stay
above open dialogs.

## AuiMessageBox

```js
AuiMessageBox.confirm('Discard the changes?', {confirmText: 'Discard', dangerConfirm: true})
    .then(function (confirmed) {
        if (confirmed) vm.discard();
    });

AuiMessageBox.alert('The export has started. You will find it under Downloads.');
```

Every method returns a promise that resolves with `true` (confirmed) or `false` (cancelled or closed). Boxes opened
while one is shown wait their turn.

| Method | |
|---|---|
| `alert(message, options)`, `info`, `success`, `warning`, `error` | A message with an OK button. |
| `confirm(message, options)`, `question` | A question with OK and Cancel. |
| `show(options)` | Everything as options. |

| Option | |
|---|---|
| `type` | `info`, `success`, `warning`, `error`, `question`: the icon, and the title when none is given. |
| `title`, `message` | The title and the message (shown as text). |
| `useHtml` | The message is HTML, cleaned to a safe subset first. |
| `confirmText`, `cancelText` | The buttons' texts. |
| `showCancel`, `showConfirm` | Which buttons are shown. |
| `dangerConfirm` | The confirm button in the danger colour. |
| `closeOnEsc` | `false`: Escape does not close the box. |
| `confirmCallback`, `cancelCallback`, `closeCallback` | Called on confirm, on cancel, and when the box has closed. |
