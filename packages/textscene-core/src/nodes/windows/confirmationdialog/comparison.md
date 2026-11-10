---
type: ConfirmationDialog
category: Other
status: done
fixture: unit-confirmation-dialog-embedded.tscn
image: unit-confirmation-dialog-embedded
renders_as: an embedded window with a panel, a message and buttons
---

# ConfirmationDialog

A two-button dialog with OK and Cancel outcomes, built on AcceptDialog. The previewer draws a visible dialog as an embedded window sized to its content. It shows the title "Please Confirm...", the `dialog_text` message, a Cancel button and a focused OK button.

## Linting

<!-- lint:begin ConfirmationDialog -->
Strict parsing format-checks these `ConfirmationDialog` properties, plus 5 inherited from AcceptDialog, 45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `cancel_button_text` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
<!-- lint:end -->

The lenient parser reads every Window key and dialog text key it draws with. A malformed value takes the class default, as an unset key does, and no diagnostic comes from the lenient path.
