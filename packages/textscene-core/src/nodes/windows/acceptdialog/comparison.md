---
type: AcceptDialog
category: Other
status: unimplemented
fixture: unit-accept-dialog.tscn
# image: unit-accept-dialog
renders_as: nothing yet — not implemented
---

# AcceptDialog

A base dialog with an OK button and a message, and the base class ConfirmationDialog and FileDialog build on. It genuinely draws at runtime once popped up, but the previewer only parses and validates it today; it does not draw it yet, so it renders as an invisible transform-only fallback (ADR-0008) and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `dialog_text` | `"Are you sure you want to continue?"` | not drawn yet — the message text in the dialog body |
| `ok_button_text` | `"Got it"` | not drawn yet — the OK button's label |
| `dialog_autowrap` | `true` | not drawn yet — whether the message text autowraps |
| `dialog_close_on_escape` | `false` | not drawn yet — whether Escape closes the dialog |
| `dialog_hide_on_ok` | `false` | not drawn yet — whether pressing OK hides the dialog |

## Divergences

No capture exists yet — AcceptDialog is `status: unimplemented`, so there is nothing to
compare against Godot.

## Linting

<!-- lint:begin AcceptDialog -->
Strict parsing format-checks these `AcceptDialog` properties, plus 45 inherited from Window, 9 inherited from Viewport. Every validator failure is an **error**.

| Property |
| --- |
| `dialog_autowrap` |
| `dialog_close_on_escape` |
| `dialog_hide_on_ok` |
| `dialog_text` |
| `ok_button_text` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

The lenient parser (`parser.ts`) reuses the plain `Node` parser: it reads only the
`[node]` heading's `name`/`parent`/`instance`/`index` attributes plus an optional
`transform` property, and never looks at any AcceptDialog-specific key at all. A bad
`dialog_text` value, or any other malformed property the strict linter above rejects,
is never read, substituted, or reported by the lenient path — the node still renders
as the same empty transform-only group either way.
