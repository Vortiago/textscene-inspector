---
type: Line2D
category: 2D
status: unreviewed
fixture: unit-line2d.tscn
image: unit-line2d
renders_as: a stroked mesh polyline
---

# Line2D

Line2D strokes a chain of points at a fixed width. The previewer draws one flat quad per
segment, with a joint wedge filling each interior corner.

## Linting

<!-- lint:begin Line2D -->
Strict parsing format-checks these `Line2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `antialiased` | true or false |  |
| `begin_cap_mode` | enum 0-2 (NONE/BOX/ROUND) | warning |
| `closed` | true or false |  |
| `default_color` | Color(r, g, b, a) |  |
| `end_cap_mode` | enum 0-2 (NONE/BOX/ROUND) | warning |
| `gradient` | null, SubResource("id") or ExtResource("id") |  |
| `joint_mode` | enum 0-2 (SHARP/BEVEL/ROUND) | warning |
| `points` | PackedVector2Array(x, y, …) |  |
| `round_precision` | integer 1-32 | error below, warning above |
| `sharp_limit` | float >= 0 | error below 0 |
| `texture` | null, SubResource("id") or ExtResource("id") |  |
| `texture_mode` | enum 0-2 (NONE/TILE/STRETCH) | warning |
| `width` | float >= 0 | error below 0 |
| `width_curve` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

`width` falls back to `10` and `sharp_limit` to `2` on a non-numeric value, `closed` to
`false` and `round_precision` to `8`, each with a warning. `joint_mode` is read as a
plain int, so an out-of-range value passes silently. A malformed `default_color` falls
back to white with no warning, and malformed `points` warn and leave the line empty.
