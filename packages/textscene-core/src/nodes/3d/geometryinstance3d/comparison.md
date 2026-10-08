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
| `material_overlay` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `material_override` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
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

The lenient parser reads `transform` and `visible` through `parseNode3D`, then `transparency`, `cast_shadow`, the `visibility_range_*` keys and `custom_aabb`, which every drawn leaf parser starts from. A malformed `transparency`, `cast_shadow` or `visibility_range_*` value keeps Godot's default with no warning. A malformed `custom_aabb` warns and keeps no box, and `AABB(0, 0, 0, 0, 0, 0)` keeps no box, as Godot clears it. Only strict reports a malformed value as an error.

Every drawn leaf (MeshInstance3D, a CSG root, Sprite3D, Label3D and each mesh of a GLB, which Godot imports as a MeshInstance3D) honours the visibility range against the camera distance to its AABB centre. A culled leaf draws nothing and casts no directional shadow. Its children still draw. It still casts into an omni or spot shadow, because Godot's shadow cull for those lights reads no range. The `visibility-range` golden pins this.

A scene-level cull runs before each render, so the first frame is culled and faded too. Each surface mounts an unfaded and an alpha-pass material. The cull puts the one for this render's fade on the mesh, so a SubViewport camera fades the scene by its own distance. Each render camera keeps its own state. Only an instance inside the camera frustum or a directional shadow split updates it. So a DISABLED range keeps Godot's hysteresis when the camera turns away. A leaf whose visibility parent is another GeometryInstance3D draws as its parent's range allows, and fades in across a DEPENDENCIES margin. The parent counts whether the previewer draws it or not. An undrawn one measures to the centre of its `custom_aabb`, an emitter's `visibility_aabb`, or else its origin. The `visibility-parent` golden pins the drawn parents. A parent with no geometry base is no parent, such as a MeshInstance3D with no mesh, or with a `custom_aabb` of no surface. Godot never indexes it (`renderer_scene_cull.cpp:1675-1681`), so the dependant links to none (`:1502-1503`).

An override node in the instancing scene gives a GLB mesh its `visibility_range_*`, `transparency`, `cast_shadow` and `visibility_parent`. A GLB node with no override takes the visibility parent of its nearest ancestor, up to the node that instances the GLB. Another node can name a GLB mesh as its visibility parent by its path under the instancing node.
