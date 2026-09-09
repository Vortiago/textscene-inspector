---
type: CheckBox
category: 2D
status: unreviewed
fixture: unit-checkbox.tscn
image: unit-checkbox
renders_as: an inline HTML row with a drawn check indicator
---

# CheckBox

CheckBox is a toggle button with a check indicator to the left of its label. The
previewer draws it in the Control overlay as an inline row: a small indicator followed
by the text.

## Linting

<!-- lint:begin CheckBox -->
Strict parsing format-checks the inherited set (13 inherited from Button, 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `CheckBox` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

`text`, `button_pressed`, `disabled` and `button_group` have no strict counterpart
beyond the inherited Control set. `button_pressed` and `disabled` become `false` for any
value that does not read as `true`, with no warning. `button_group` is stored as the raw
string.

## Known limitations

- **Approximated** The indicator is a drawn outline with a tick or dot, not Godot's
  solid theme icon textures, so it reads thinner and lighter.
