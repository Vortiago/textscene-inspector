---
type: Sprite3D
category: 3D
fixture: unit-sprite3d.tscn
image: unit-sprite3d
renders_as: a textured THREE.Mesh quad
---

# Sprite3D

Sprite3D draws a 2D texture on a quad in 3D space. The previewer renders it as a
textured plane sized by `pixel_size` × the texture, with `modulate` driving colour
and opacity and `billboard` applied as a per-frame look-at. `modulate` accumulates
from an immediately-parenting Sprite3D as `_get_color_accum` does
(`sprite_3d.cpp:36-52`), r/g/b and a; one intervening node of any other type — a
Node3D, or a Label3D, which is SpriteBase3D's sibling rather than its base
(`label_3d.h:38`, `sprite_3d.h:36`) — restarts the accumulation at white. Godot builds the whole
material from node properties through `BaseMaterial3D::get_material_for_2d`
(`material.cpp:3021`), so `shaded` picks the material class — unlit
`meshBasicMaterial` by default, `meshStandardMaterial` when set — `no_depth_test`
drives `depthTest`, and `texture_filter` sets the sampler state on the composed
texture. The fixture shows three "F" markers over the preview sky: a plain blue
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

`alpha_hash_scale` has no counterpart to bind to. Godot's hash threshold divides
by the uniform (`scene_forward_aa_inc.glsl:17`, default 1.0 at `sprite_3d.h:90`);
three runs the same Wyman-McGuire hash against a hardcoded
`const float ALPHA_HASH_SCALE = 0.05` (`alphahash_pars_fragment.glsl.js`), with no
uniform and no material property to move it. The dither grain therefore differs
in size from Godot's, though the pattern is stochastic in both and both hash on
object-space position. Authoring a value changes nothing here.

`alpha_antialiasing_mode` and `alpha_antialiasing_edge` are parsed but not
honoured; alpha-to-coverage and edge feathering are not implemented.

`alpha_cut = OPAQUE_PREPASS` cuts at a fixed 0.5. Godot cuts it in the depth pass
only, against the SCENE's `opaque_prepass_threshold` — 0.99 for the main render
(`render_forward_clustered.cpp:1791`) — which is not a node property at all, so
there is nothing on the node to read it from.

## Linting

<!-- lint:begin Sprite3D -->
Strict parsing format-checks these `Sprite3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `alpha_antialiasing_edge` |
| `alpha_antialiasing_mode` |
| `alpha_cut` |
| `alpha_hash_scale` |
| `alpha_scissor_threshold` |
| `axis` |
| `billboard` |
| `centered` |
| `double_sided` |
| `fixed_size` |
| `flip_h` |
| `flip_v` |
| `frame` |
| `frame_coords` |
| `hframes` |
| `modulate` |
| `no_depth_test` |
| `offset` |
| `pixel_size` |
| `region_enabled` |
| `region_rect` |
| `render_priority` |
| `shaded` |
| `texture` |
| `texture_filter` |
| `transparency` |
| `transparent` |
| `vframes` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-sprite3d-resources` | `sprite3d-requires-texture` | warning |
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
The material properties behave the same way: an invalid `texture_filter` or
`alpha_antialiasing_mode` warns and resets to `3`/LINEAR_WITH_MIPMAPS and `0`/OFF, the
`shaded`, `no_depth_test` and `fixed_size` flags to `false`, and
`alpha_scissor_threshold` / `alpha_hash_scale` / `alpha_antialiasing_edge` to `0.5`,
`1.0` and `0.0`. `modulate` is the exception: an invalid `Color(...)` falls back to
opaque white with no warning at all, since `parseColor` never logs. `texture` is assigned verbatim whenever
present, with no format or resource-existence check.
