---
type: TextureRect
category: 2D
status: done
fixture: unit-texture-rect.tscn
image: unit-texture-rect
renders_as: a textured quad in the control's rect
---

# TextureRect

TextureRect draws a `Texture2D` inside its rect, scaled and placed by `expand_mode` and
`stretch_mode`.

## Linting

<!-- lint:begin TextureRect -->
Strict parsing format-checks these `TextureRect` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `expand_mode` | enum 0-5 (EXPAND_KEEP_SIZE/EXPAND_IGNORE_SIZE/EXPAND_FIT_WIDTH/EXPAND_FIT_WIDTH_PROPORTIONAL/EXPAND_FIT_HEIGHT/EXPAND_FIT_HEIGHT_PROPORTIONAL) | warning |
| `flip_h` | true or false |  |
| `flip_v` | true or false |  |
| `stretch_mode` | enum 0-6 (STRETCH_SCALE/STRETCH_TILE/STRETCH_KEEP/STRETCH_KEEP_CENTERED/STRETCH_KEEP_ASPECT/STRETCH_KEEP_ASPECT_CENTERED/STRETCH_KEEP_ASPECT_COVERED) | warning |
| `texture` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`expand_mode` and `stretch_mode` warn outside their enum range, since both setters
assign straight through. At render time each goes through the optional-int reader, so an
unparseable value becomes `undefined` and takes the switch default. `flip_h` and
`flip_v` collapse to `false` for any value that does not read as `true`.

