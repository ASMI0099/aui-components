# Security policy

## Supported versions

Security fixes are made on the latest release only.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub instead:
open the repository's **Security** tab and choose **Report a vulnerability**.

Include what you can of the following:

* the component and version concerned;
* the steps or a minimal page that shows the problem;
* what an attacker could do with it.

You will get an answer within a few days. Once a fix is ready, it is released and the report is published as a
security advisory, with credit to you if you want it.

## Scope

The components render data as text: labels, options, search terms, messages and the words of `auiTexts` are never
inserted as HTML. The one place where a page can hand over HTML as data is the `useHtml` option of `AuiMessage` and
`AuiMessageBox`; that HTML goes through `AuiSafeHtml`, which rebuilds it from an allowlist of tags, attributes and
link schemes and drops everything else (scripts, styles, event handlers, `javascript:` links, embedded content).
`AuiModal` shows its `content` as text too; rich content comes from the page's own code (a DOM node, or a `render`
function), as does the markup placed inside `<aui-modal>` and `<aui-popover>`, which AngularJS compiles like any
other template of that page.

A way around that cleaning, or any other path from data to markup, is a vulnerability and should be reported as
above.
