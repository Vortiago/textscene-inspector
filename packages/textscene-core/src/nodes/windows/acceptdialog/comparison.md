---
type: AcceptDialog
category: Other
status: unimplemented
fixture: unit-accept-dialog.tscn
# image: unit-accept-dialog
renders_as: nothing yet, not implemented
---

# AcceptDialog

A base dialog with an OK button and a message, which ConfirmationDialog and FileDialog build on. The previewer parses and validates it but does not draw it, so it mounts as an invisible transform-only group (ADR-0008).

## Linting

<!-- lint:begin AcceptDialog -->
Strict parsing format-checks these `AcceptDialog` properties, plus 45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `dialog_autowrap` | true or false |  |
| `dialog_close_on_escape` | true or false |  |
| `dialog_hide_on_ok` | true or false |  |
| `dialog_text` | quoted string, or the &"…" StringName jacket |  |
| `ok_button_text` | quoted string, or the &"…" StringName jacket |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
<!-- lint:end -->

The lenient parser registers the plain `Node` reader, which reads only the heading attributes and an optional `transform`. A bad `dialog_text` is never read, substituted or reported on the lenient path.

## Known limitations

- **Not drawn** Godot displays the dialog once popped up. The previewer draws nothing for it.
