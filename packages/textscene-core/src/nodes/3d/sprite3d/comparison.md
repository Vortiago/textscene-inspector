---
type: Sprite3D
category: 3D
fixture: unit-sprite3d.tscn
image: unit-sprite3d
renders_as: an unlit textured THREE.Mesh quad
---

# Sprite3D

Sprite3D draws a 2D texture on a quad in 3D space. The previewer renders it as an
unlit textured plane (`meshBasicMaterial`), sized by `pixel_size` × the texture,
with `modulate` driving colour and opacity and `billboard` applied as a per-frame
look-at. The fixture shows three "F" markers over the preview sky: a plain blue
one, an orange-tinted billboard that faces the camera, and a semi-transparent
blue-tinted one.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `texture` | `ExtResource` (96×96 "F" marker) | the image drawn on each quad |
| `pixel_size` | `0.01` | quad size — 96 px × 0.01 ≈ 0.96 units square |
| `billboard` | `1` (middle) | quad turns to face the camera — seen flat and frontal, not foreshortened like its neighbours |
| `modulate` | `Color(1, 0.7, 0.4, 1)` (middle) | orange tint multiplies the texture — dark square with an orange F |
| `modulate` | `Color(0.4, 0.7, 1, 0.6)` (right) | blue tint at 0.6 alpha — a semi-transparent blue quad |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Sprite3D -->
Strict parsing format-checks these `Sprite3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `alpha_cut` |
| `axis` |
| `billboard` |
| `frame` |
| `frame_coords` |
| `hframes` |
| `modulate` |
| `offset` |
| `pixel_size` |
| `region_rect` |
| `render_priority` |
| `texture` |
| `transparency` |
| `vframes` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-sprite3d-resources` | `sprite3d-requires-texture` | error |
|  | `valid-sprite3d-resources` | error |
|  | `sprite3d-frame-range` | warning |
|  | `sprite3d-region-configuration` | warning |
|  | `sprite3d-axis-usage` | warning |
<!-- lint:end -->

Most properties follow the warn-then-fallback contract: an invalid `billboard`,
`alpha_cut`, or `axis` warns and resets to its Godot default (`0`/DISABLED, `0`/DISABLED,
`1`/Y_AXIS); `pixel_size` falls back to `0.01`, `hframes`/`vframes` to `1`, `frame` to `0`,
and `offset` to `(0, 0)`, each with the same warn. `frame_coords` and `region_rect` warn on
a malformed `Vector2i`/`Rect2` literal but then stay unset rather than substitute a value.
`modulate` is the exception: an invalid `Color(...)` falls back to opaque white with no
warning at all, since `parseColor` never logs. `texture` is assigned verbatim whenever
present, with no format or resource-existence check.
