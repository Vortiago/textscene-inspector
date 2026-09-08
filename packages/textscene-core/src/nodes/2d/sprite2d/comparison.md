---
type: Sprite2D
category: 2D
status: unreviewed
fixture: unit-sprite2d.tscn
image: unit-sprite2d
renders_as: an unlit textured quad
---

# Sprite2D

Sprite2D draws a texture as a flat quad on the canvas. The previewer renders it as an
unlit plane at the texture's pixel size, tinted by `modulate`.

## Linting

<!-- lint:begin Sprite2D -->
Strict parsing format-checks these `Sprite2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `centered` | true or false |  |
| `flip_h` | true or false |  |
| `flip_v` | true or false |  |
| `frame` | integer >= 0 | error below |
| `frame_coords` | Vector2i(x, y), both >= 0, or the Vector2 spelling Godot converts | error below |
| `hframes` | integer 1-16384 | error below, warning above |
| `offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `region_enabled` | true or false |  |
| `region_filter_clip_enabled` | true or false |  |
| `region_rect` | Rect2(x, y, w, h), or the Rect2i spelling Godot converts |  |
| `texture` | null, SubResource("id") or ExtResource("id") |  |
| `vframes` | integer 1-16384 | error below, warning above |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-sprite2d-resources` | `sprite2d-requires-texture` | info |
|  | `sprite2d-frame-range` | error |
|  | `sprite2d-frame-coords-range` | error |
|  | `sprite2d-frame-remapped` | warning |
|  | `sprite2d-region-configuration` | info |
<!-- lint:end -->

`hframes`, `vframes`, `frame` and `frame_coords` are replayed in file order as Godot's
setters apply them. A refused `frame` stays `0`, and a later `hframes` re-maps one that
landed. `centered` falls back to `true`, `flip_h`, `flip_v` and `region_enabled` to
`false` and `offset` to `(0, 0)`. A `region_rect` that fails its grammar is left unset,
and `texture` is stored with no reference check.
