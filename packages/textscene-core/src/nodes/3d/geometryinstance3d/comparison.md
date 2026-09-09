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

The base every visible 3D leaf inherits its shadow, LOD, global-illumination and visibility-range settings from. Instantiated bare it draws nothing, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

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

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A malformed `visibility_range_end` or `cast_shadow` parses with no warning and no fallback, and only strict reports it.
