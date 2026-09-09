---
type: RayCast3D
category: 3D
status: linter-only
fixture: unit-ray-cast-3d.tscn
# image: unit-ray-cast-3d
visual: false
renders_as: nothing (a transform-only group)
---

# RayCast3D

Casts a ray each physics frame toward `target_position` and reports the first hit. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin RayCast3D -->
Strict parsing format-checks these `RayCast3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `collide_with_areas` | true or false |  |
| `collide_with_bodies` | true or false |  |
| `collision_mask` | 32-bit layer mask (layers 1-32) |  |
| `debug_shape_custom_color` | Color(r, g, b, a) |  |
| `debug_shape_thickness` | integer 1-5 | warning |
| `enabled` | true or false |  |
| `exclude_parent` | true or false |  |
| `hit_back_faces` | true or false |  |
| `hit_from_inside` | true or false |  |
| `target_position` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-raycast3d` | `raycast3d-no-collide-target` | info |
|  | `raycast3d-zero-mask` | info |
<!-- lint:end -->

The lenient parser reuses `parseNode3D` unmodified, which pulls only `transform` and `visible` off the property bag. A bad `collision_mask = "all"` or a two-component `target_position` is never read, so strict linting is the only path that sees it.
