# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `aui-button`: `aria-describedby`, `aria-haspopup`, `aria-pressed` and `tabindex` on the element are moved onto the
  native button, where they act (also when written with `{{ }}`).

### Changed

- `aui-button`: the keyboard focus is a 2px ring in the accent around a 2px gap on every variant and intent (it was a
  light ring in the intent's colour); in forced-colours mode an outline in the system's highlight colour.
- `aui-button`: the warning text on white and on its tints is a darker amber (`#a34a08`), 4.5:1 on the hover tint too.
- `aui-button`: `done-duration` is held between 300 and 10000 ms.

- Field borders are darker (`#8590a0`, 3.2:1 on white) so an empty field shows where it is; the hover border follows.
  The line between a label in the box and the value keeps the light colour through `--aui-control-divider-color`.
- `aui-input` basic style: a thin resting line under the text.
- `aui-input`: in a field too narrow for all its parts, the prefix and suffix texts and the label give way (ellipsis).

### Fixed

- `aui-input`: inside a disabled `<fieldset>`, the clear button, the password eye and `api.clear()` no longer act.
- `aui-input`: `required` and `precision` also hold for a form the browser checks (native submit).
- `aui-input`: with `ng-model-options` `updateOn`, typing no longer marks the field and the form dirty before the commit,
  and a rollback leaves them pristine.
- `aui-input`: `ng-trim="false"` keeps the spaces; the count counts what the check counts.
- `aui-input`: `on-focus` comes before a blur or change that follows it, with the value at the focus.
- `aui-input`: clearing an empty field reports no change; an empty or unknown `input-style-type` gives the basic style.
- `aui-input`: no hover look on a disabled field; the basic clear button has a 24px target.
- The field box takes `--aui-control-background-color` (a dark theme no longer draws white on white), and the fields
  follow a theme's `--aui-control-height` and `--aui-control-radius`.
- A cut top label shows its whole text as a tooltip, as the label in the box does.
- `aui-button`: an icon button with only a `title` is named by that title; a `{{ }}` label that becomes empty leaves
  an icon alone, named by its icon.
- `aui-button`: a promise of the browser's own returned by `on-click` (an async function, `fetch`) settles inside a
  digest, so the page shows the result at once.
- `aui-button`: a new click ends the previous done or copy feedback, and after quick repeated copies the latest
  copy's outcome shows; the button keeps its width for "Copied" and for "Copy failed".
- `aui-button`: `shape="square"` no longer squeezes a `link` button.

## [0.1.0]

The first public release.

### Added

- `aui-select`: one or several values; static options or options from a server, page by page with server search;
  saved values looked up by id; tags with a "+N" summary; a list that draws only the rows in view.
- `aui-tree-select`: nested or flat trees; linked or independent checking with three value strategies; lazy levels
  with paging; server search as a pruned tree; saved values revealed down their path.
- `aui-input` and `aui-textarea`: text, number, password and search fields in the form, basic and cell styles;
  counts, limits, prefixes and suffixes, a password eye, an auto-growing text area.
- `aui-date-picker` and `aui-time-picker`: dates, date-times, times and their ranges; months, quarters, years, weeks
  and several dates; typed input, shortcuts, limits, time zones by offset.
- `aui-checkbox` and `aui-checkbox-group`.
- `aui-button`: seven variants, five intents, five sizes, icons, a loading state that follows a promise, copy buttons
  (`copy-text`) and a brief done state (`done-text`).
- `aui-popover`: notes, confirmations and small forms next to a trigger.
- `aui-modal` and `AuiModal`; `AuiMessage` and `AuiMessageBox`.
- Shared: design tokens, a text scale, the field label and message line, `auiTexts` with page-defined languages,
  forced-colours support.

[Unreleased]: ../../compare/v0.1.0...HEAD
[0.1.0]: ../../releases/tag/v0.1.0
