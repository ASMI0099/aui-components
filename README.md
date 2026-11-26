# aui-components

Form and overlay components for AngularJS 1.5.3: select, tree select, input, date picker, checkbox, button, popover,
modal and messages. Built for large data, keyboard use and pages with CSS of their own.

* **Large data.** Lists and trees draw only the rows in view; options load from a server page by page, level by
  level or by search, with cancelled and stale requests handled for you.
* **Form-ready.** Every field works with `ngModel`, `name`, `required`, `ng-disabled` and the page's form, and has a
  shared label, size and message line.
* **Accessible.** Keyboard support throughout, ARIA roles and aria-live announcements, visible focus, forced-colours support,
  WCAG AA contrast with the default tokens.
* **Robust against page CSS.** The components keep their looks next to a page's own general rules for `span`,
  `label`, `input`, `*:focus` and the like; a test suite checks every part against a deliberately hostile stylesheet.
* **Themeable.** Colours, sizes, radii, motion and text scale come from CSS custom properties.
* **Light on the page.** Changes inside a component are drawn without digests of the whole page where possible;
  panels open and close on the compositor.

## Components

| Component | |
|---|---|
| [`aui-select`](docs/components/select.md) | One or several values from a list, static or from a server |
| [`aui-tree-select`](docs/components/tree-select.md) | One or several values from a tree: nested or flat, lazy, searched on the server |
| [`aui-input`, `aui-textarea`](docs/components/input.md) | Text, number, password and search fields; multi-line text |
| [`aui-date-picker`, `aui-time-picker`](docs/components/date-picker.md) | Dates, times, ranges, months, quarters, years, weeks |
| [`aui-checkbox`, `aui-checkbox-group`](docs/components/checkbox.md) | Checkboxes, with select-all and limits for groups |
| [`aui-button`](docs/components/button.md) | Buttons in seven variants and five intents, with icons and a loading state |
| [`aui-popover`](docs/components/popover.md) | A card next to a trigger: a note, a confirmation, a small form |
| [`aui-modal`, `AuiModal`](docs/components/modal.md) | Dialogs in templates and from code |
| [`AuiMessage`, `AuiMessageBox`](docs/components/message.md) | Notices that go away by themselves; alert and confirm boxes |

## Quick start

```html
<link rel="stylesheet" href="dist/aui-components.min.css">

<script src="angular.min.js"></script>
<script src="floating-ui.core.umd.min.js"></script>
<script src="floating-ui.dom.umd.min.js"></script>
<script src="dist/aui-components.min.js"></script>
```

```js
angular.module('app', ['aui']);
```

```html
<aui-select ng-model="vm.status" options="vm.statuses" label-field="name" value-field="id" clearable></aui-select>
<aui-date-picker ng-model="vm.period" type="daterange"></aui-date-picker>
<aui-button on-click="vm.save()">Save</aui-button>
```

Requirements: AngularJS 1.5.3 and Floating UI 1.6 (`@floating-ui/core`, `@floating-ui/dom`, UMD builds). See
[getting started](docs/getting-started.md) for the details.

## Documentation

* [Getting started](docs/getting-started.md)
* [Fields: label, size, message line](docs/fields.md)
* [Theming](docs/theming.md)
* [Texts and languages](docs/texts.md)
* [Options from a server](docs/remote-data.md)
* The component pages linked above

To see every component working, run the examples locally (below).

## Development

Node.js 22 or newer, and Chrome, Chromium or Edge for the browser tests.

```bash
npm install
npm run dev          # examples and test pages on http://127.0.0.1:5180/
npm test             # unit tests, then every browser suite in a headless browser
npm run build        # dist/: the joined files and the minified ones
npm run test:dist    # the browser suites against the minified files
```

`BROWSER_PATH` points the test runner at a browser of your choice. See [CONTRIBUTING.md](CONTRIBUTING.md) for the
layout of the project and the rules for changes.

## Project layout

```
src/            the sources: core services, one folder per component, shared styles; src/sources.json orders them
dist/           the built files (npm run build)
docs/           the documentation
examples/       live examples of every component, on a built-in mock API
test/           browser suites (one folder per component, test/shared for checks across components), unit tests,
                performance pages
scripts/        build, dev server, test and performance runners
```

## License

[MIT](LICENSE)
