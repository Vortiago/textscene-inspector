---
type: CheckBox
category: 2D
status: done
fixture: unit-checkbox.tscn
image: unit-checkbox
renders_as: a theme icon followed by a text run
---

# CheckBox

CheckBox is a toggle button with a check indicator to the left of its label. The
previewer draws the theme's indicator icon and the label beside it.

## Linting

<!-- lint:begin CheckBox -->
Strict parsing format-checks the inherited set (13 inherited from Button, 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `CheckBox` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

`text`, `button_pressed`, `disabled` and `button_group` have no strict counterpart
beyond the inherited Control set. `button_pressed` and `disabled` become `false` for any
value that does not read as `true`, with no warning. `button_group` is stored as the raw
string.

## Known limitations

- **Approximated** The label's paragraph direction is not applied, so under
  `layout_direction = 3` or `text_direction = 2` a right-to-left script, or a label
  ending in punctuation, keeps left-to-right glyph order. Which side the label, the
  icon and the chrome sit on does follow the layout direction.
