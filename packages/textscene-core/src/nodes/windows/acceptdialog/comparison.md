---
type: AcceptDialog
category: Other
status: done
fixture: unit-accept-dialog-embedded.tscn
image: unit-accept-dialog-embedded
renders_as: an embedded window with a panel, a message and buttons
---

# AcceptDialog

A base dialog with an OK button and a message, which ConfirmationDialog and FileDialog build on. The previewer draws a visible dialog as an embedded window: the panel, the `dialog_text` message and the focused OK button, sized to its content. A child Control fills the content area with the message.

## Message and buttons
<!-- compare: image=unit-accept-dialog-embedded status=done fixture=unit-accept-dialog-embedded.tscn -->

The panel, the message and the focused OK button, sized to the content.

## Theme
<!-- compare: image=unit-accept-dialog-theme status=done fixture=unit-accept-dialog-theme.tscn -->

A Theme on the dialog or an ancestor restyles the Button and the Label inside it. It does so as for a Button and a Label in the scene.

## Linting

<!-- lint:begin AcceptDialog -->
Strict parsing format-checks these `AcceptDialog` properties, plus 45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `dialog_autowrap` | true or false |  |
| `dialog_close_on_escape` | true or false |  |
| `dialog_hide_on_ok` | true or false |  |
| `dialog_text` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `ok_button_text` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
<!-- lint:end -->

The lenient parser reads every Window key and dialog text key it draws with. A malformed value takes the class default, as an unset key does, and no diagnostic comes from the lenient path.
