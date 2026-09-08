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
| `sorting_use_aabb_center` | `false` | sorts from the origin instead of the AABB centre; invisible here since the node draws nothing itself |

## Divergences

None visible in this fixture: the node draws nothing, so every property above is a
format/range fact the linter checks, not something the previewer can show differently
from Godot.

## Linting

<!-- lint:begin GeometryInstance3D -->
Strict parsing format-checks these `GeometryInstance3D` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `cast_shadow` | enum 0-3 (OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY) | warning |
| `custom_aabb` | AABB(x, y, z, w, h, d) |  |
| `extra_cull_margin` | float 0-16384 | error below, warning above |
| `gi_lightmap_texel_scale` | float >= 0.01 | warning below |
| `gi_mode` | enum 0-2 (DISABLED/STATIC/DYNAMIC) | warning |
| `ignore_occlusion_culling` | true or false |  |
| `instance_shader_parameters/*` | any Variant — the type comes from the attached shader's uniform declarations, not the .tscn |  |
| `lod_bias` | float 0.001-128 | error below 0, warning below 0.001, warning above 128 |
| `material_overlay` | null, SubResource("id") or ExtResource("id") |  |
| `material_override` | null, SubResource("id") or ExtResource("id") |  |
| `sorting_offset` | float |  |
| `sorting_use_aabb_center` | true or false |  |
| `transparency` | float 0-1 | error |
| `visibility_range_begin` | float >= 0 | warning below |
| `visibility_range_begin_margin` | float >= 0 | warning below |
| `visibility_range_end` | float >= 0 | warning below |
| `visibility_range_end_margin` | float >= 0 | warning below |
| `visibility_range_fade_mode` | enum 0-2 (DISABLED/SELF/DEPENDENCIES) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
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
