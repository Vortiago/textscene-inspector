---
type: ReferenceRect
category: 2D
status: unreviewed
fixture: unit-reference-rect.tscn
# image: unit-reference-rect
renders_as: a coloured border outline
---

# ReferenceRect

ReferenceRect draws a plain coloured border around its rect as a design-time aid.
`editor_only = false` draws it unconditionally, matching a real running game; the
default (`true`) draws only while the node is selected, since Godot's own editor shows
it always.

## Linting

<!-- lint:begin ReferenceRect -->
Strict parsing format-checks these `ReferenceRect` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `border_color` | Color(r, g, b, a) |  |
| `border_width` | float >= 0 | error below |
| `editor_only` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`border_color` and `editor_only` carry no bound, so any format-valid literal passes both
parsers. `border_width` is clamped to `0` by both: the strict parser flags a negative
literal as an error, and the render-facing parser stores Godot's own floor
(`MAX(0, width)`), matching the setter.

## Known limitations

- **Editor only** Godot's own editor draws every ReferenceRect in the open scene at
  once. Here `editor_only = true` (the default) is selection-gated instead, to avoid
  the same clutter ADR-0018 already avoids for Marker2D/Path2D.
