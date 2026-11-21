# Texts and languages

Every word the components show comes from one table, the `auiTexts` service: the placeholders and search boxes of
aui-select and aui-tree-select, aui-input's buttons, the buttons and titles of aui-modal, `AuiModal`, `AuiMessageBox`
and `AuiMessage`, aui-popover's Cancel and Confirm, the names of the icons, the message line under a field, and every
text of aui-date-picker. The table is English. A page changes it once, in a config block of its module.

## Changing single texts

```js
angular.module('app', ['aui'])
    .config(['auiTextsProvider', function (texts) {
        texts.set({
            list: {empty: 'Nothing found', search: 'Filter...'},
            field: {required: 'Please fill in this field'}
        });
    }]);
```

## A language of your own

`define(name, texts)` keeps a language under a name you choose; `use(name)` puts it into the table. A language holds
only the texts that differ from English: whatever it leaves out stays English. Pages that offer several languages
define them all and use the one the user picked.

```js
angular.module('app', ['aui'])
    .config(['auiTextsProvider', function (texts) {
        texts.define('custom', {
            list: {placeholder: 'Choose...', empty: 'No match', clearAll: 'Remove all'},
            modal: {ok: 'Done', cancel: 'Back'},
            date: {placeholder: 'Choose a date', today: 'Now'}
        });
        texts.use('custom');
        texts.set({list: {search: 'Type to filter'}});   // set after use: single texts on top of the language
    }]);
```

## Rules

- **A wrong value is ignored.** An unknown key, or a value that is not of the text's kind (a text, a list as long as
  the English one, a group), changes nothing: a mistake in the config never blanks a text. `use` with a name that was
  never defined changes nothing either.
- **Texts are text.** They are always shown as text, never as HTML.
- **A component's own attribute comes first**: `placeholder`, `search-placeholder`, `empty-text`, `confirm-text` and
  the like win over the table.
- **Placeholders.** aui-input, aui-select and aui-tree-select show one only when the page gives it (`placeholder`).
  The date and time pickers show their built-in hint (the `date` texts named `...Placeholder`) unless the page gives
  its own or sets `show-placeholder="false"`. The search box of an open list shows `list.search` ("Search...") unless
  the field sets `search-placeholder`; `search-placeholder=""` shows none.
- **Placeholders in texts** are written in braces and filled in by the component: `{label}`, `{n}`, `{list}`,
  `{length}`, `{min}`, `{max}`, `{precision}`, `{month}`, `{year}`, `{unit}`, `{count}`.

## Groups

| Group | Used by |
|---|---|
| `list` | aui-select, aui-tree-select (`selectAll` also by aui-checkbox-group) |
| `input` | aui-input: the clear button, the password eye |
| `modal` | aui-modal, `AuiModal`, `AuiMessageBox`, `AuiMessage`; aui-popover's Cancel and Confirm |
| `icons` | the names of the icons (`edit`, `delete`, `copy`, `check`, `close`, `circle-check`, `circle-close`, `info`, `help`, `more`, `filter`, `settings`, `add`, `search`, `refresh`, `download`, `upload`, `expand`, `collapse`, ...): an icon shown alone is named by them |
| `button` | aui-button's `copy-text`: `copied`, `copyFailed` |
| `field` | the message line under a field (`required`, `maxlength`, `minlength`, `pattern`, `min`, `max`, `precision`, `integer`, `minItems`, `maxItems`, `number`, `email`, `url`, ...) |
| `date` | aui-date-picker and aui-time-picker: weekday and month names, placeholders, buttons, shortcut names, lengths of ranges (see [the date picker](components/date-picker.md)) |

The keys and their English texts are in [src/core/texts.js](../src/core/texts.js).

`auiFieldMessagesProvider.set({...})` sets the `field` group of the same table.
