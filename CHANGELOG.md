# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `aui-date-picker` in a native form: a named field's value goes with the form's own data (hidden inputs: a date, a
  range's two ends, each date); `required` is the boxes' own too (the browser's check of the form stops at an empty
  required field); a native reset shows the model's value again.
- `aui-date-picker`: the shortcuts, duration chips, Today and Now are Tab stops; the month and year lists the title
  opens take the keyboard (one Tab stop, arrows, Enter).
- `aui-modal`: `on-open`, called once per opening as the dialog opens (before its first frame); `AuiModal.open`
  takes `onOpen` (a dialog that waits its turn: when it opens). Each `on-open` is followed by one `on-close`.
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

- The package description and the README name the AngularJS version the library is made and tested for: 1.5.3
  (they said 1.5+).
- `aui-button` guide: how to give the buttons a dark surface's colours.
- `aui-modal`: `aria-describedby` describes the dialog itself; the header and footer slots take the height they need
  (they were cut at 80px and 100px).
- AuiMessageBox: a box with neither button shows its OK (it could not be closed); without a title it is named by its
  type and described by its message; blank button captions keep the defaults.
- AuiMessage: the pointer (not a tap) and the keyboard's focus hold a notice; a notice without a title says its kind to
  screen readers; the Close cross is darker (4.8:1); on a phone the two places form one column.
- AuiMessage: a notice leaves as it comes in and is seen all the way: it fades evenly over 300ms while it slides away
  (it vanished in about 180ms), and the notices after it glide up into its place (they jumped there); not with
  reduced motion.
- The message services mount one set of hosts per AngularJS application on the page, removed when it ends.
- `aui-button`: the keyboard focus is a 2px ring in the accent around a 2px gap on every variant and intent (it was a
  light ring in the intent's colour); in forced-colours mode an outline in the system's highlight colour.
- `aui-button`: the warning text on white and on its tints is a darker amber (`#a34a08`), 4.5:1 on the hover tint too.
- `aui-button`: `done-duration` is held between 300 and 10000 ms.
- `aui-modal`: `width` and `height` each work on their own (the other dimension comes from `size`) and take CSS lengths
  (`480px`, `30rem`, `calc(...)`), as documented; a number from 5 to 100 is still that share of the window.
- `aui-modal`: on a small window the preset sizes keep at least 20rem × 12rem (never more than the window), and the
  footer's actions wrap to a second line instead of running out of the dialog.
- `aui-modal` without `<dialog>` (older browsers): the page behind an open dialog is hidden from screen readers.
- Field borders are a step firmer (`#c5cdd9`, hover `#adb7c5`), so an empty field shows where it is while a dense form
  stays light; the line between a label in the box and the value keeps its lighter colour through
  `--aui-control-divider-color`. A page that needs the 3:1 outline of WCAG 1.4.11 sets `#8590a0` (see theming).
- `aui-input` basic style: a thin resting line under the text.
- `aui-input`: in a field too narrow for all its parts, the prefix and suffix texts and the label give way (ellipsis);
  narrower still the count, then the clear button and the password eye narrow, all inside the field's frame.
- `aui-input` basic style: with `show-label`, `label-text` and no placeholder, the caption stays above the line at rest.
- `aui-select`, `aui-tree-select`: a disabled field has no `tabindex` (it took the focus from a press or from code).
- `aui-tree-select`: a row at a deep level in a narrow panel stops indenting where it keeps 120px for its label.
- Placeholders are a step lighter (`#abb6c4`); the date picker's days outside the month, edge cells and week numbers
  keep their colour through `--aui-calendar-muted-color` (`#9aa8b8`).
- Theming guide: the colours for pages that must meet WCAG AA for the field border and placeholders too
  (`#8590a0` / `#737f90`, `#64748b`).

### Fixed

- `aui-date-picker` dates and times: a date-time typed with its own offset (`Z`, `-05:00`) is that instant; an offset's
  minutes over 59 and fixed-offset values outside the years 1 to 9999 are refused; the later of a local hour that comes
  twice keeps its instant; a time skipped by a clock change is shown as the time it becomes at entry; the 24-hour
  shortcuts and hour-based range limits count hours that pass (a clock change day has 23 or 25); fixed and callback
  date-time shortcuts keep their time, a Date value works as one, and Date objects from a frame are read.
- `aui-date-picker` limits: a range over a disabled day is caught however far off (it was missed past ten years, and
  a day past a blocker over 400 days away could be picked); month, quarter and year ranges check the units inside;
  an end-only range checks its time with the end's rule; an hour or minute the time rule turns off cannot be typed;
  a time range's duration chip past midnight is off; Now never sets a time below `min`; shortcuts and time slots
  follow limits changed while open, and a pick is checked again when made; a rule that throws refuses and reports to
  `$exceptionHandler` (it allowed everything, unseen).
- `aui-date-picker` values and settings: a malformed range model (not a list, more than two ends) is a `date` error; a
  model equal to `empty-value` is empty; a page change of the value updates an open draft; `utc-offset`, `format`,
  placeholders, week start and steps changed later take effect; a disabled fieldset disables the field; a field
  disabled or made read-only while open closes without taking the draft; `ng-model-options` `updateOn: 'blur'`
  commits when the field is left; one `change` event per edit; `on-change` after a debounced commit; time slots are
  not cut at 288, and a malformed slot definition is left out; week text in ISO form is read with any week start.
- `aui-date-picker` accessibility: the keyboard's focus and the month arrows show in high contrast mode; ArrowRight
  in the time columns moves to an option that can be chosen; the month, quarter and year lists are listboxes of
  options with `aria-current` for this one; a required range's end box is required and described; a time range's
  columns are grouped by their captions; the dates grid is multi-selectable; the range preview under the pointer is
  not announced as selected; a selected day of the next or last month is readable (it was 2.07:1).
- `aui-date-picker` on small windows: under 640px a time range's two sets of columns stand one under the other and
  the panel stays inside the window (it ran up to 75px past a 320px window, OK out of reach); a panel taller than the
  room on its side scrolls (its header, the focused day or OK were off the screen).
- `aui-date-picker` work: an open range's footer no longer re-checks the whole range at each digest; each day asks the
  page's rule once per digest (it asked twice); a long list of dates is looked up (it was searched per day); an `api`
  object replaced or kept after the field is gone no longer drives it or keeps it alive.
- `aui-button`: an icon alone whose label shows nothing (an empty `{{ }}`, an empty styled span) has its icon in the
  middle (it sat 2.5 to 4.5px aside); a text hidden by the page's own CSS (a class, an inline style, a narrow-screen
  rule) leaves an icon alone, square and named by its icon (it was a wide, unnamed button), and the text shown again
  a text button.
- `aui-button`: a page rule such as `.toolbar span { display: inline-block }` no longer takes its icon and text out of
  their row.
- `aui-button`: a loading text shorter than the label keeps the button's width (in a content-sized button it shrank and
  moved its neighbours); a block button still never grows past its place.
- `aui-button` elevated: keyboard focus under the pointer keeps its focus ring, hovered and pressed.
- `aui-button`: the space between two words written in markup (`<b>Save</b> <em>draft</em>`) is kept, shown and read.
- `aui-button`: `copy-feedback="none"` holds no room for a `done-text` that never shows.
- `aui-button`: buttons that start loading together no longer lay the page out once each (96 buttons: one layout).
- `aui-button`: a disclosure does not write its unchanged `data-expand` again at each drawing.
- `aui-button`: in a row aligned by the text's baseline, a button with an icon or a spinner before its text sits on the
  line of the others (it was about 3px higher).
- `aui-select`, `aui-tree-select`: the value text sits on the same line as an input's in a form row (it could be up to
  2 device pixels apart at 125% display scaling).
- `aui-modal`: no one-row step at the end of the opening animation (seen at 125% scaling and at odd window heights).
- `aui-input` textarea: the resize grip sits at the box's corner, and in a scroll area its scrollbar no longer covers
  the text.
- Inline field labels: the divider between the label and the value is no longer cut away in some places (a field at a
  fractional position, after a dialog's scale-in); nothing moves.
- AuiModal, AuiMessageBox, AuiMessage: a second AngularJS application on the page shows its own dialogs, boxes and
  toasts (they waited for a host of the first one); a box asked for as an application starts shows at once.
- AuiModal, AuiMessageBox, AuiMessage: errors thrown by the page's callbacks (on-cancel, on-close, render, the box's
  callbacks) reach the application's `$exceptionHandler`.
- AuiModal, AuiMessageBox: a host removed with its application settles the dialog it showed.
- `aui-modal`: a save promise made in another window (an editor in a frame) keeps the dialog open while it runs.
- `aui-modal`: with `display-on-top`, a tall dialog stays inside the window; without `<dialog>`, a fixed size larger
  than the window is held to it.
- `aui-modal` without `<dialog>`: parts the page adds behind the dialog are hidden too, the page's own `aria-hidden`
  changes are kept on close, the page behind is inert where the browser knows `inert`; Tab goes round correctly past a
  disabled fieldset, hidden or inert controls, a radio group and positive `tabindex`; toasts over it take the focus.
- AuiModal: content built by `render()` and closed in its opening turn lets go of AngularJS's data on it.
- AuiMessageBox: a box asked for by the answer of one closed with Escape waits behind the box already waiting; a
  queued box costs the page no digest and is formatted when shown; on a narrow window the buttons wrap, a long title
  wraps, a short window still shows the message, and a long message can be reached with the keyboard.
- AuiMessage: a held notice given a duration later keeps waiting; an update given as a plain dictionary works; a
  duration past 24 days no longer ends at once; `clearAll()` draws once; a title-only update does not format the
  message again; a closed notice's content is let go; the notices are repeated without `track by` (a closed one is not
  kept); a leaving notice takes no clicks; a focused link keeps the focus across an update; `type: undefined` is
  `info`; a card's padding no longer widens it past a phone's screen; a long message scrolls; preformatted text
  scrolls sideways.
- Rich messages keep `scope`, `lang`, `dir` and an ordered list's `start`; a relative link resolves from the
  document's base.
- AuiMessage, AuiMessageBox: in forced colours (high contrast) the status icons show; on a page with a dark colour
  scheme the white cards and dialogs keep their links readable.
- `aui-input` with `ng-model-options` (`updateOn`, a debounce): a rule that changes while a typed text waits re-checks
  the committed value (its model follows, as Angular's `$validate` has it) and the text commits as the rules are then;
  a form submit commits it too. A text the rules refuse, typed into an empty field, keeps `required` until it commits
  and then marks the field dirty.
- `aui-input` with `ng-model-options`: a refused text saved, then corrected and saved again, saves the corrected value
  (it saved nothing while the form said valid); `form.$rollbackViewValue()` after a refused text was committed shows
  that text again with its error (the box went empty and the form valid).
- `aui-input` basic style: in a field narrower than its parts, the clear button takes no click outside the field;
  `api.blur()` also takes the focus off the field's clear button or eye.
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
