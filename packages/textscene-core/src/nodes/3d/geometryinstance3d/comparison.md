---
type: GeometryInstance3D
category: 3D
status: linter-only
fixture: unit-geometry-instance-3d.tscn
# image: unit-geometry-instance-3d
visual: false
renders_as: a transform-only group
---

# GeometryInstance3D

The base every visible 3D leaf (MeshInstance3D, GPUParticles3D, Label3D, Sprite3D, the
CSG shapes, …) inherits from for its shadow-casting, LOD, global-illumination, and
visibility-range settings; instantiated bare it draws nothing, so the previewer renders
it as a transform-only group (ADR-0008): its children still show, and that absence is
the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `material_override` | `SubResource(...)` | replaces every surface material; invisible here since the node draws nothing itself |
| `material_overlay` | `SubResource(...)` | draws on top of the existing materials; invisible here since the node draws nothing itself |
| `transparency` | `0.25` | multiplies material opacity; invisible here since the node draws nothing itself |
| `cast_shadow` | `2` (Double-Sided) | shadow-casting mode; invisible here since the node draws nothing itself |
| `extra_cull_margin` | `0.5` | grows the culling AABB; invisible here since the node draws nothing itself |
| `custom_aabb` | `AABB(-1, -1, -1, 2, 2, 2)` | overrides the bounding box used for culling; invisible here since the node draws nothing itself |
| `lod_bias` | `2.0` | biases level-of-detail selection; invisible here since the node draws nothing itself |
| `ignore_occlusion_culling` | `true` | disables occlusion culling; invisible here since the node draws nothing itself |
| `gi_mode` | `2` (Dynamic) | global-illumination contribution mode; invisible here since the node draws nothing itself |
| `gi_lightmap_texel_scale` | `2.0` | lightmap texel density; invisible here since the node draws nothing itself |
| `visibility_range_begin` | `10.0` | HLOD fade-in start distance; invisible here since the node draws nothing itself |
| `visibility_range_begin_margin` | `1.0` | fade-in transition distance; invisible here since the node draws nothing itself |
| `visibility_range_end` | `50.0` | HLOD fade-out distance; invisible here since the node draws nothing itself |
| `visibility_range_end_margin` | `2.0` | fade-out transition distance; invisible here since the node draws nothing itself |
| `visibility_range_fade_mode` | `1` (Self) | how the node fades at its visibility-range limits; invisible here since the node draws nothing itself |
| `sorting_offset` | `0.5` | shifts the node's depth-sort position; invisible here since the node draws nothing itself |
| `sorting_use_aabb_center` | `false` | sorts from the origin instead of the AABB center; invisible here since the node draws nothing itself |

## Divergences

None visible in this fixture: the node draws nothing, so every property above is a
format/range fact the linter checks, not something the previewer can show differently
from Godot.

## Linting

<!-- lint:begin GeometryInstance3D -->
Strict parsing format-checks these `GeometryInstance3D` properties, plus 1 inherited from VisualInstance3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `cast_shadow` |
| `custom_aabb` |
| `extra_cull_margin` |
| `gi_lightmap_texel_scale` |
| `gi_mode` |
| `ignore_occlusion_culling` |
| `lod_bias` |
| `material_overlay` |
| `material_override` |
| `sorting_offset` |
| `sorting_use_aabb_center` |
| `transparency` |
| `visibility_range_begin` |
| `visibility_range_begin_margin` |
| `visibility_range_end` |
| `visibility_range_end_margin` |
| `visibility_range_fade_mode` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-geometryinstance3d-visibility-range` | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

Strict parsing format- and range-checks the 15 properties GeometryInstance3D's own
`ADD_PROPERTY` calls serialise, plus `sorting_offset` and `sorting_use_aabb_center` —
declared on VisualInstance3D but re-enabled for this whole hierarchy by
`GeometryInstance3D::_validate_property` (ADR-0008 territory: a base class deciding
what its descendants may set, not what they draw). `gi_lightmap_scale`, the deprecated
lightmap-scale enum, carries `PROPERTY_USAGE_NONE` in its own `ADD_PROPERTY` and never
reaches a `.tscn`, so it has no validator. Three warning-severity semantic rules also
run — mirroring `GeometryInstance3D::get_configuration_warnings` — flagging a
visibility range End distance at or below Begin, and a fade mode (Self/Dependencies)
configured with a zero margin on the end it fades.
