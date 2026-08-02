---
type: ConfirmationDialog
category: Other
status: unimplemented
fixture: unit-confirmation-dialog.tscn
# image: unit-confirmation-dialog
renders_as: invisible transform-only fallback
---

# ConfirmationDialog

A two-button confirmation dialog with independent OK/Cancel outcomes, building on AcceptDialog. It genuinely draws at runtime once popped up, but the previewer only parses and validates it today; it does not draw it yet, so it renders as an invisible transform-only fallback (ADR-0008) and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `cancel_button_text` | `"No thanks"` | not drawn yet — the Cancel button's label |

## Divergences

No capture exists yet — ConfirmationDialog is `status: unimplemented`, so there is nothing to
compare against Godot.

## Linting

<!-- lint:begin ConfirmationDialog -->
Strict parsing format-checks these `ConfirmationDialog` properties, plus 5 inherited from AcceptDialog, 45 inherited from Window, 9 inherited from Viewport, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `cancel_button_text` | quoted string |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | warning |
<!-- lint:end -->

The lenient parser (`parser.ts`) reuses the plain `Node` parser: it reads only the
`[node]` heading's `name`/`parent`/`instance`/`index` attributes plus an optional
`transform` property, and never looks at `cancel_button_text` or any other
ConfirmationDialog-specific key at all. A bad value there, or in any inherited
AcceptDialog/Window property the strict linter above rejects, is never read,
substituted, or reported by the lenient path — the node still renders as the
same empty transform-only group either way.
