---
type: NinePatchRect
category: 2D
status: unreviewed
fixture: unit-nine-patch-rect.tscn
image: unit-nine-patch-rect
renders_as: a 9-sliced textured quad in the control's rect
---

# NinePatchRect

NinePatchRect splits its `texture` into nine cells by the four `patch_margin_*`
values, drawing the four corners at native size while the edges and centre stretch or
tile per `axis_stretch_horizontal`/`axis_stretch_vertical`. `region_rect` windows the
source texture, and `draw_center` omits the centre cell entirely.

## Linting

<!-- lint:begin NinePatchRect -->
Strict parsing format-checks these `NinePatchRect` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `axis_stretch_horizontal` | enum 0-2 (AXIS_STRETCH_MODE_STRETCH/AXIS_STRETCH_MODE_TILE/AXIS_STRETCH_MODE_TILE_FIT) | warning |
| `axis_stretch_vertical` | enum 0-2 (AXIS_STRETCH_MODE_STRETCH/AXIS_STRETCH_MODE_TILE/AXIS_STRETCH_MODE_TILE_FIT) | warning |
| `draw_center` | true or false |  |
| `patch_margin_bottom` | integer 0-16384 | warning |
| `patch_margin_left` | integer 0-16384 | warning |
| `patch_margin_right` | integer 0-16384 | warning |
| `patch_margin_top` | integer 0-16384 | warning |
| `region_rect` | Rect2(x, y, w, h), or the Rect2i spelling Godot converts |  |
| `texture` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`patch_margin_*` and `axis_stretch_*` go through the optional-int reader: an
unparseable value becomes `undefined` and falls back to 0 (margins) or `STRETCH` (axis
mode) at render time. A malformed `region_rect` becomes `undefined`, drawing the whole
texture instead of a crop.
