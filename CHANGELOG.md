# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `aui-button`: `aria-describedby`, `aria-haspopup`, `aria-pressed` and `tabindex` on the element are moved onto the
  native button, where they act (also when written with `{{ }}`).
- `aui-button`: `aria-labelledby` on the element is moved onto the native button too.
- `aui-select`, `aui-tree-select`: the page's `aria-label`, `aria-labelledby` and `aria-describedby` on the field name
  and describe its trigger, the element that has the focus (as `aui-input` gives them to its box).
- `aui-select`, `aui-tree-select`: Enter in the field retries a failed load or server search (the keyboard's way to its
  "Retry"); the list's messages (nothing found, a failure, a search too short) are live statuses for screen readers.
- `aui-select`: a bound `searchable` shows or hides the search box at once; a `label-field` / `value-field` written
  with `{{ }}` and changed reads the options anew.
- `aui-tree-select`: `reveal-selected` also finds a value on a later page of its branch (up to 20 pages).

### Changed

- `aui-button`: the keyboard focus is a 2px ring in the accent around a 2px gap on every variant and intent (it was a
  light ring in the intent's colour); in forced-colours mode an outline in the system's highlight colour.
- `aui-button`: the warning text on white and on its tints is a darker amber (`#a34a08`), 4.5:1 on the hover tint too.
- `aui-button`: `done-duration` is held between 300 and 10000 ms.
- `aui-modal`: `width` and `height` each work on their own (the other dimension comes from `size`) and take CSS lengths
  (`480px`, `30rem`, `calc(...)`), as documented; a number from 5 to 100 is still that share of the window.
- `aui-modal`: on a small window the preset sizes keep at least 20rem × 12rem (never more than the window), and the
  footer's actions wrap to a second line instead of running out of the dialog.
- `aui-modal` without `<dialog>` (older browsers): the page behind an open dialog is hidden from screen readers.
- Field borders are darker (`#8590a0`, 3.2:1 on white) so an empty field shows where it is; the hover border follows.
  The line between a label in the box and the value keeps the light colour through `--aui-control-divider-color`.
- `aui-input` basic style: a thin resting line under the text.
- `aui-input`: in a field too narrow for all its parts, the prefix and suffix texts and the label give way (ellipsis);
  narrower still the count, then the clear button and the password eye narrow, all inside the field's frame.
- `aui-input` basic style: with `show-label`, `label-text` and no placeholder, the caption stays above the line at rest.
- `aui-select`, `aui-tree-select`: a disabled field has no `tabindex` (it took the focus from a press or from code).
- `aui-tree-select`: a row at a deep level in a narrow panel stops indenting where it keeps 120px for its label.
- Theming guide: the suggested placeholder colour `#64748b` (4.76:1 on white).

### Fixed

- `aui-input` with `ng-model-options` (`updateOn`, a debounce): a rule that changes while a typed text waits re-checks
  the committed value (its model follows, as Angular's `$validate` has it) and the text commits as the rules are then;
  a form submit commits it too. A text the rules refuse, typed into an empty field, keeps `required` until it commits
  and then marks the field dirty.
- `aui-input`: the form's native reset leaves the field showing its model (the box, its count and its clear button);
  a field without a `name` adds nothing to the form's data.
- `aui-input`: a search still waiting runs no more once a `<fieldset>` around the field is disabled; inside a disabled
  fieldset the field looks disabled (no red hover halo).
- `aui-input`: an auto-height textarea fits its text again when its `size` or the theme's font scale changes.
- `aui-input`: `value-max-length="0"` (no limit) keeps a number field's arrow keys; `autofocus` waits for a field
  hidden by `visibility`; a late `ng-attr-aria-describedby` reaches the box.
- `aui-button`: a copy that a newer one replaced no longer writes the older text, nor shows "Copied" after a failure;
  a label of hidden or empty elements counts as no label; a `loading-text` button no longer runs out of its container.
- `aui-select`, `aui-tree-select`: lookups of one `lookup-group` with other `load-params` are separate requests; a
  lookup still running when the params change is asked again, and an answer that comes late (an earlier asking, the
  params before) is dropped; `reload()` looks the shown values up again.
- `aui-select`, `aui-tree-select`: a press on a dimmed row of the previous search (the new one still on its way)
  picks nothing and the panel stays open.
- `aui-select`, `aui-tree-select`: in a form, the browser's own check focuses the field (not its hidden input) and
  shows it invalid; a disabled field is left out of the form's data and its check, a readonly one does not stop it;
  inside a disabled `<fieldset>` the field is disabled; a native reset keeps the data sent equal to the field.
- `aui-select`, `aui-tree-select`: with `ng-model-options` `updateOn: 'blur'` a pick commits when the field is left;
  with a debounce `on-change` reports the new value once it commits.
- `aui-select`, `aui-tree-select`: `auto-select-on-single-required` turned off before its moment picks nothing; a field
  that becomes required later picks its only option.
- `aui-select`, `aui-tree-select`: switched to `max-tag-count="responsive"` after mount, the tags fit their line again.
- `aui-select`, `aui-tree-select`: with `prefers-reduced-motion: reduce` the panels fade without scaling.
- `aui-select`, `aui-tree-select`: `aria-activedescendant` names no row that is not in the page (a long list scrolled
  by hand, or loading).
- `aui-select`, `aui-tree-select`: in a short window (a high browser zoom) the selected row opens in view.
- `aui-select`, `aui-tree-select`: in forced colours (high contrast) the chevron, search and notice icons, tag remove
  marks, carets and checked boxes are drawn in system colours (they vanished); the keyboard row has an outline.
- `aui-select`: plain values as options work as documented; `value-options` at mount fill `selected-items` with the
  whole record; an option locked after it was picked keeps its lock against Clear; options set to `null` while open
  leave no rows; `api.open()` while loading or after destroy does nothing.
- `aui-tree-select`: `api.clear()` keeps locked values and does nothing while disabled, readonly or loading; a value
  locked by `disabled-values` stays locked when its node leaves the data; `api.expand()` / `collapse()` of a branch
  already so sends no `on-expand`; `comp-id` written with `{{ }}` follows; `ng-disabled` / `ng-readonly` set while
  open close the panel; load-enabled false stops a server search; options replaced by new objects of the same ids
  update `selected-items`; a value cleared and set again keeps its label when its data goes; a reveal still loading
  no longer moves the keyboard after the value changed.
- `aui-tree-select`: a field whose data is replaced again and again lets go of the old rows' ids; with thousands of
  values selected the tag paths are worked out only for tags that can be drawn.
- Performance scripts: the leak benchmark's select has its `api` and the run fails on Angular errors; the tree
  benchmark searches for labels that exist, a wait that runs out fails the run, and strict modes uncheck a checked leaf.
- Examples: the saved-path example no longer widens a phone page.

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
  copy's outcome shows; the button keeps its width for "Copied" and for "Copy failed", and a button with an icon keeps
  its icon's gap to the text (the room held for the feedback no longer sits between them).
- `aui-button`: `shape="square"` no longer squeezes a `link` button.
- `aui-select`, `aui-tree-select`: the chevron no longer hops a pixel as it finishes turning on open and close, at
  screen scales such as 125%.
- `aui-modal`: with a `<footer>` of its own and `show-confirm-button`, a page without jQuery no longer throws (the
  default buttons are no longer built and then replaced).
- `aui-modal`: opened again from its own `on-close`, the dialog stays open (the earlier close's event no longer closes it).
- `aui-modal`: a promise of the browser's own returned by `on-confirm` that resolves to `false` or fails leaves the
  Confirm button ready at once.
- `aui-modal`: `confirm-loading-text` shows while the save runs.
- `aui-modal`: a short dialog no longer scrolls by a few pixels on a page without a `border-box` rule.
- `aui-modal`: a dialog left alone after the one under it closed dims the page as a single dialog does.
- `AuiModal.open`: a closed dialog lets go of its content and callbacks, also while the page keeps the returned promise.
- `aui-modal` without `<dialog>` (older browsers): Shift+Tab goes round from the first control to the last; a tall
  auto-size dialog scrolls, so its footer can be reached; closing leaves no data in AngularJS's cache (pages without
  jQuery); the backdrop colour set around the modal applies; the scroll lock gives back the page's `!important` values.

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
