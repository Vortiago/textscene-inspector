---
type: Sprite3D
category: 3D
status: limitation
fixture: unit-sprite3d.tscn
image: unit-sprite3d
renders_as: a textured THREE.Mesh quad
---

# Sprite3D

Draws a 2D texture on a quad in 3D space. The previewer renders it as an unlit textured plane sized by `pixel_size` times the texture. `modulate` drives colour and opacity, and `billboard` applies as a per-frame look-at.

The quad lies on the plane its `axis` faces, the XY plane by default. A centred quad centres on the node. An uncentred one puts its bottom-left corner there, and a positive `offset.y` moves it up, as Godot draws the 2D rect with its Y unflipped. The quad's AABB, grown as a billboard can turn it, places it for the visibility range.

The quad casts a shadow when Godot files its surface in the shadow pass (`render_forward_clustered.cpp:4079-4089`). That pass takes a cut or opaque surface, or an `OPAQUE_PREPASS` one, with its depth test on. An `OPAQUE_PREPASS` surface blends uncut, writes its depth in a depth prepass cut at 0.99, and cuts its shadow at 0.1 (`render_forward_clustered.cpp:1791,2770`). A blended sprite, the default, casts nothing. A hashed sprite hashes its shadow too. The quad receives shadows as every GeometryInstance3D does. The `sprite3d-shadow` golden pins this.

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
| `texture` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
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

Most keys warn then fall back to their Godot defaults. `billboard`, `alpha_cut` and `axis` fall back to `0`, `0` and `2`, and `pixel_size` to `0.01`. `hframes` and `vframes` fall back to `1`, `frame` to `0` and `offset` to `(0, 0)`. `frame_coords` and `region_rect` warn on a malformed literal and stay unset. `modulate` falls back to opaque white silently, since `parseColor` never logs, and `texture` is assigned verbatim whenever present. A malformed `transparency` keeps Godot's default (`0`) silently, which draws the sprite opaque.

## Known limitations

- **Shader missing** `alpha_antialiasing_mode` and `alpha_antialiasing_edge` have no
  counterpart, so a cut sprite's edges are not feathered.
