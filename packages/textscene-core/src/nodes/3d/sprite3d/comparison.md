---
type: Sprite3D
category: 3D
status: unreviewed
fixture: unit-sprite3d.tscn
image: unit-sprite3d
renders_as: an unlit textured THREE.Mesh quad
---

# Sprite3D

Draws a 2D texture on a quad in 3D space. The previewer renders it as an unlit textured plane sized by `pixel_size` times the texture, with `modulate` driving colour and opacity and `billboard` applied as a per-frame look-at.

## Linting

<!-- lint:begin Sprite3D -->
Strict parsing format-checks these `Sprite3D` properties, plus 20 inherited from SpriteBase3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `frame` | integer >= 0 | error below |
| `frame_coords` | Vector2i(x, y), both >= 0, or the Vector2 spelling Godot converts | error below |
| `hframes` | integer 1-16384 | error below, warning above |
| `region_enabled` | true or false |  |
| `region_rect` | Rect2(x, y, w, h), or the Rect2i spelling Godot converts |  |
| `texture` | null, SubResource("id") or ExtResource("id") |  |
| `vframes` | integer 1-16384 | error below, warning above |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-sprite3d-resources` | `sprite3d-requires-texture` | info |
|  | `sprite3d-frame-range` | error |
|  | `sprite3d-frame-coords-range` | error |
|  | `sprite3d-frame-remapped` | warning |
|  | `sprite3d-region-configuration` | info |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

Most keys warn then fall back to their Godot defaults. `billboard`, `alpha_cut` and `axis` fall back to `0`, `0` and `1`, and `pixel_size` to `0.01`. `hframes` and `vframes` fall back to `1`, `frame` to `0` and `offset` to `(0, 0)`. `frame_coords` and `region_rect` warn on a malformed literal and stay unset. `modulate` falls back to opaque white silently, since `parseColor` never logs, and `texture` is assigned verbatim whenever present.
