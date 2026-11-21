# Contributing

Thank you for helping. This guide covers the setup, the layout of the project and what a change needs before it is
merged.

## Setup

```bash
npm install
npm run dev          # http://127.0.0.1:5180/: the examples, and every test suite as a page
```

The dev server builds the library from `src/` on every request, so a page always runs the current code. The
examples get their data from a mock API built into the dev server; no backend is needed.

## Layout

```
src/
  core/                 services and directives the components share (module, texts, keys and focus, panel placement,
                        server data, icons, safe HTML)
  styles/               shared styles: design tokens, the field box, the clear button, the message line
  components/<name>/    one folder per component: its script and stylesheet
  sources.json          the order in which the files are joined into dist/
scripts/                build.js, dev-server.js, test.js, perf.js and their helpers in scripts/lib/
test/
  <name>/               the browser suites of a component
  shared/               checks across components (keyboard, parity of the fields, page CSS, events)
  kit/                  the in-page test runner (AuiTest)
  unit/                 node --test suites of the non-UI code
  perf/                 benchmark and memory pages (npm run perf)
examples/               one page per component
docs/                   the documentation
dist/                   the built files, committed: rebuild them with every change of src/
```

## Code rules

* **AngularJS 1.5.3 and ES2017.** No syntax newer than ES2017 (no `?.`, `??`, object spread in literals): many
  AngularJS pages still pass their scripts through older build tools. The build fails on newer syntax.
* **Explicit injection.** Every injectable function is annotated (`['$scope', function ($scope) {...}]`), so that
  minified builds work.
* **Text, not HTML.** Data and texts are always shown as text. HTML from a page goes through `AuiSafeHtml` only.
* **Every word through `auiTexts`.** A new text gets a key in `src/core/texts.js`, never a literal in a template.
* **Looks through tokens.** Colours, sizes and motion use the custom properties of `src/styles/tokens.css`; a new
  colour is a shade of the accent, invalid or text tokens.
* **Robust against page CSS.** A component's parts get the rules they rely on; `test/shared/css-guard` compares every
  part with and without a hostile page stylesheet.
* **Light on the page.** Changes inside a component should not digest the whole page when a local digest does;
  animations use `transform` and `opacity`.
* Style: 4 spaces, LF line endings, single quotes (see `.editorconfig`).

## Tests

```bash
npm test                         # unit tests, then every browser suite
npm run test:browser -- select   # only the suites whose path contains "select"
npm run test:browser -- --verbose select   # also list the passing checks
npm run build && npm run test:dist         # the suites against the minified files
```

A browser suite is three files with one name in `test/<name>/`: `<suite>.html` (the components under test),
`<suite>.fixture.js` (the test module `auiTest`, data, mock servers) and `<suite>.spec.js` (the checks). The spec
hands its checks to `AuiTest.run`; each check returns what it observed and passes when that equals its `expect`
(compared as JSON). A page opened in a browser runs its suite and shows the report.

Opened by hand, keep the window in front and leave it alone while the checks run: they move the focus and measure
panels after short waits.

## Adding a component

1. `src/components/<name>/<name>.js` and `.css`, registered on the module: `angular.module('aui').component(...)`.
2. The files in `src/sources.json`, in the place where they belong in the cascade.
3. A suite in `test/<name>/`, and checks in `test/shared/` where the component joins shared behaviour (keys, page
   CSS, parity with the other fields).
4. An example page in `examples/<name>/` and its entry in `examples/assets/examples.js`.
5. A page in `docs/components/` and a line in the README's component table.
6. `npm test`, `npm run build`, `npm run test:dist`.

## Pull requests

* One topic per pull request, with a short description of what changes for a page that uses the component.
* Tests for every change of behaviour; the full suite passing, from source and from `dist/`.
* `dist/` rebuilt (`npm run build`): the CI checks that it matches the sources.
* An entry under "Unreleased" in [CHANGELOG.md](CHANGELOG.md).

## Reporting problems

Open an issue with the component, the AngularJS version, the browser, and a minimal page or the steps that show the
problem. For security problems see [SECURITY.md](SECURITY.md).
