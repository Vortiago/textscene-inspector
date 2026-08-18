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
and opacity and `billboard` applied as a per-frame look-at. Godot builds the whole
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

`fixed_size` is parsed but not honoured. Godot's `FLAG_FIXED_SIZE` rescales the
quad in the vertex shader in proportion to depth (`material.cpp:1357`) so the
sprite keeps a constant on-screen size; the previewer draws it at its world size.

The alpha uniforms `alpha_scissor_threshold`, `alpha_hash_scale`,
`alpha_antialiasing_mode` and `alpha_antialiasing_edge` are parsed but not
honoured. `alpha_cut = DISCARD` cuts at a fixed 0.5 rather than the authored
`alpha_scissor_threshold`; alpha hashing and alpha-to-coverage are not
implemented at all.

`alpha_cut = HASH` parses but renders as ordinary alpha blending. Godot maps it
to `TRANSPARENCY_ALPHA_HASH` (`sprite_3d.cpp:289-294`), a per-fragment dithered
discard scaled by `alpha_hash_scale`.

Wrap mode is always REPEAT. Godot derives `texture_repeat` from the UV window and
passes it to the material (`sprite_3d.cpp:163`), so a window that stays inside
`[0, 1]` — every sprite that does not overrun its region — clamps in Godot and
repeats here. The difference is a half-texel at the quad's border under linear
filtering.

`modulate` does not accumulate down a chain of nested sprites. A SpriteBase3D
parented to another multiplies its own modulate by the parent's accumulated
colour (`sprite_3d.cpp:41-50`, `:75-77`); the previewer applies each sprite's
modulate on its own.

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
