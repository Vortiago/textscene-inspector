---
type: ConfirmationDialog
category: Other
status: unimplemented
fixture: unit-confirmation-dialog.tscn
# image: unit-confirmation-dialog
renders_as: invisible transform-only fallback
---

# ConfirmationDialog

A two-button dialog with independent OK and Cancel outcomes, built on AcceptDialog. The previewer parses and validates it but does not draw it, so it mounts as an invisible transform-only group (ADR-0008).

## Linting

<!-- lint:begin ConfirmationDialog -->
Strict parsing format-checks these `ConfirmationDialog` properties, plus 5 inherited from AcceptDialog, 45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `cancel_button_text` | quoted string, or the &"…" StringName jacket |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
<!-- lint:end -->

The lenient parser registers the plain `Node` reader, which reads only the heading attributes and an optional `transform`. A bad `cancel_button_text` is never read, substituted or reported on the lenient path.

## Known limitations

- **Not drawn** Godot displays the dialog once popped up. The previewer draws nothing for it.
