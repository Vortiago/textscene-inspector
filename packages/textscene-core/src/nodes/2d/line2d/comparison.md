---
type: Line2D
category: 2D
fixture: unit-line2d.tscn
image: unit-line2d
renders_as: a stroked mesh polyline
---

# Line2D

Line2D strokes a chain of points. The previewer builds the stroke as Godot's `LineBuilder`
does. That gives the joints, the cap modes, the `gradient`, the `width_curve` and the UVs of the
`texture`. The texture samples with the `texture_filter` and `texture_repeat` of the item, or with those
of its CanvasTexture where it sets them. `antialiased` has no effect in Godot 4.6.3, since
`Line2D::_draw` never reads it.

## Normal map
<!-- compare: image=unit-line2d-normal-map status=done fixture=unit-line2d-normal-map.tscn -->

A CanvasTexture's `normal_texture` and `specular_texture` shade the line under PointLight2D and
DirectionalLight2D. Only the node's rotation and scale turn the normal (`canvas.glsl:708-710`). The
line's direction and its UVs do not. A vertical line lights as a horizontal one. A line rotated a
quarter turn is lit from below, as in Godot.

## Linting

<!-- lint:begin Line2D -->
Strict parsing format-checks these `Line2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `antialiased` | true or false |  |
| `begin_cap_mode` | enum 0-2 (NONE/BOX/ROUND) | warning |
| `closed` | true or false |  |
| `default_color` | Color(r, g, b, a), or the colour string or int it converts |  |
| `end_cap_mode` | enum 0-2 (NONE/BOX/ROUND) | warning |
| `gradient` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `joint_mode` | enum 0-2 (SHARP/BEVEL/ROUND) | warning |
| `points` | PackedVector2Array(x, y, …) |  |
| `round_precision` | integer 1-32 | error below, warning above |
| `sharp_limit` | float >= 0 | error below 0 |
| `texture` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `texture_mode` | enum 0-2 (NONE/TILE/STRETCH) | warning |
| `width` | float >= 0 | error below 0 |
| `width_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

`width` falls back to `10` and `sharp_limit` to `2` on a non-numeric value, `closed` to
`false` and `round_precision` to `8`, each with a warning. A `round_precision` below 1 reads as 1,
as Godot's setter does. `joint_mode` is read as a
plain int, so an out-of-range value passes silently. A malformed `default_color` falls
back to white with no warning, and malformed `points` warn and leave the line empty.
