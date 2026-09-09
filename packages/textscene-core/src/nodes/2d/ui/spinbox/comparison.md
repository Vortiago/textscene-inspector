---
type: SpinBox
category: 2D
status: unimplemented
fixture: unit-spin-box.tscn
# image: unit-spin-box
renders_as: invisible transform-only fallback
---

# SpinBox

SpinBox is a numeric text input over a Range, with prefix, suffix and arrow-button
stepping. The previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

## Linting

<!-- lint:begin SpinBox -->
Strict parsing format-checks these `SpinBox` properties, plus 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) | error |
| `custom_arrow_round` | true or false |  |
| `custom_arrow_step` | float >= 0 | warning below |
| `editable` | true or false |  |
| `prefix` | quoted string, or the &"…" StringName jacket |  |
| `select_all_on_focus` | true or false |  |
| `suffix` | quoted string, or the &"…" StringName jacket |  |
| `update_on_text_changed` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl`, which reads only Control's layout and theme
keys. SpinBox's own keys are never read, so a malformed `prefix` or `custom_arrow_step`
is absent from the parsed node rather than substituted.

## Known limitations

- **Not drawn** Godot draws the field and its arrows. The previewer draws nothing for
  this node.
