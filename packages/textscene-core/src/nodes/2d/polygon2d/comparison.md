---
type: Polygon2D
category: 2D
status: unreviewed
fixture: unit-polygon2d.tscn
image: unit-polygon2d
renders_as: a filled, optionally textured mesh
---

# Polygon2D

Polygon2D fills an outline on the canvas. The previewer triangulates it into an unlit
mesh with one vertex per point and tints it with `color`. `texture` is sampled through
the per-vertex `uv` with Godot's own UV formula.

## Linting

<!-- lint:begin Polygon2D -->
Strict parsing format-checks these `Polygon2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `antialiased` | true or false |  |
| `bones` | Array literal [bone_path, PackedFloat32Array(weights), …] |  |
| `color` | Color(r, g, b, a) |  |
| `internal_vertex_count` | integer 0-1000 | warning |
| `invert_border` | float 0.1-16384 | warning |
| `invert_enabled` | true or false |  |
| `offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `polygon` | PackedVector2Array(x, y, …) |  |
| `polygons` | Array of PackedInt32Array(i0, i1, …) or bare [i0, i1, …] index lists |  |
| `skeleton` | NodePath("path/to/node") |  |
| `texture` | null, SubResource("id") or ExtResource("id") |  |
| `texture_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `texture_rotation` | float |  |
| `texture_scale` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `uv` | PackedVector2Array(x, y, …) |  |
| `vertex_colors` | PackedColorArray(r, g, b, a, …) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

A non-numeric `internal_vertex_count` falls back to `0` and `invert_border` to `100`,
each with a warning. So do `invert_enabled` to `false`, `offset` and `texture_offset` to
`(0, 0)` and `texture_scale` to `(1, 1)`. A malformed `color` falls back to white
silently. Malformed `polygon`, `polygons`, `uv` or `vertex_colors` warn and degrade to
empty, which is Godot's own size-mismatch branch.

## Known limitations

- **Approximated** `vertex_colors` interpolate in linear space where Godot interpolates
  the authored sRGB values, so the middle of a gradient reads slightly differently. The
  corners are exact.
- **Approximated** `antialiased` is ignored, so edges are marginally harder.
