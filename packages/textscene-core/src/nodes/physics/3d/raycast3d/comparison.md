---
type: RayCast3D
category: 3D
status: unreviewed
fixture: unit-ray-cast-3d.tscn
# image: unit-ray-cast-3d
visual: false
renders_as: a ray line and pyramid gizmo for every node
---

# RayCast3D

Casts a ray each physics frame toward `target_position` and reports the first hit. The previewer runs no cast, so nothing of it draws.

## Linting

<!-- lint:begin RayCast3D -->
Strict parsing format-checks these `RayCast3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `collide_with_areas` | true or false |  |
| `collide_with_bodies` | true or false |  |
| `collision_mask` | 32-bit layer mask (layers 1-32) |  |
| `debug_shape_custom_color` | Color(r, g, b, a), or the colour string or int it converts |  |
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

The lenient parser reads `enabled`, `target_position`, `debug_shape_thickness` and `debug_shape_custom_color` on top of the Node3D transform. An unreadable `target_position` stays `undefined` with a warn in the log, not Godot's default, and the gizmo substitutes `Vector3(0, -1, 0)` where it draws. `collide_with_areas`, `collide_with_bodies`, `collision_mask`, `exclude_parent`, `hit_from_inside` and `hit_back_faces` are never read, because they steer the cast that only a running game runs.

## Gizmo

Every node draws the ray: one line from the origin to `target_position` (`ray_cast_3d.cpp:405-406`). A target of `Vector3()` returns before any vertex, so it draws nothing (`ray_cast_3d.cpp:401-403`). A `debug_shape_thickness` above 1 fills a truncated pyramid around the line, a base ring `thickness / 100` m across and a third of that at the tip. The colour is the node's `debug_shape_custom_color`, or the project collision colour when that is `Color(0, 0, 0)` (`ray_cast_3d.cpp:483-486`). Godot's gizmo source is `ray_cast_3d_gizmo_plugin.cpp:60-66`.

The plugin passes the node's own debug material and no variant replaces it, so the gizmo keeps that colour in every state (ADR-0056 names the split). A disabled node draws both parts in the grey that `get_material("shape_material_disabled")` fetches alone, grey at 0.18.

## Known limitations

- **Editor only** The gizmo draws for every ray when the Gizmos toggle is on, which a capture keeps off.