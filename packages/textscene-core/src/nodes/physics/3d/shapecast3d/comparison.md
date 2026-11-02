---
type: ShapeCast3D
category: 3D
status: unreviewed
fixture: unit-shape-cast-3d.tscn
# image: unit-shape-cast-3d
visual: false
renders_as: a sweep line and shape wireframe gizmo for every node
---

# ShapeCast3D

Sweeps a `Shape3D` from its origin to `target_position` to detect collisions (concave shapes report none). The previewer runs no sweep, so nothing of it draws.

## Linting

<!-- lint:begin ShapeCast3D -->
Strict parsing format-checks these `ShapeCast3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `collide_with_areas` | true or false |  |
| `collide_with_bodies` | true or false |  |
| `collision_mask` | 32-bit layer mask (layers 1-32) |  |
| `debug_shape_custom_color` | Color(r, g, b, a), or the colour string or int it converts |  |
| `enabled` | true or false |  |
| `exclude_parent` | true or false |  |
| `margin` | float 0-100 | warning |
| `max_results` | integer |  |
| `shape` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `target_position` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-shapecast3d` | `shapecast3d-no-collide-target` | info |
|  | `shapecast3d-zero-mask` | info |
|  | `shapecast3d-missing-shape` | warning |
|  | `shapecast3d-concave-shape` | warning |
<!-- lint:end -->

The lenient parser reads `enabled`, `shape`, `target_position` and `debug_shape_custom_color` on top of the Node3D transform. An unreadable `target_position` stays `undefined` with a warn in the log, not Godot's default, and the gizmo substitutes `Vector3(0, -1, 0)` where it draws. `collide_with_areas`, `collide_with_bodies`, `collision_mask`, `exclude_parent`, `margin` and `max_results` are never read, because they steer the sweep that only a running game runs.

## Gizmo

Every node draws the sweep: one line from the origin to `target_position` (`shape_cast_3d.cpp:512-514`), and, with a shape, its debug wireframe at the sweep's end (`shape_cast_3d.cpp:504-513`). The wireframe sits at the end because the editor pose's safe fraction of 1 offsets the shape by the whole target. The target comparison runs after the wireframe, so a target of `Vector3()` draws the wireframe alone. The colour is the node's `debug_shape_custom_color`, or the project collision colour when that is `Color(0, 0, 0)` (`shape_cast_3d.cpp:565-568`). Godot's gizmo source is `shape_cast_3d_gizmo_plugin.cpp:60-66`.

The plugin passes the node's own debug material and no variant replaces it, so the gizmo keeps that colour in every state (ADR-0056 names the split). A disabled node draws both parts in the grey that `get_material("shape_material_disabled")` fetches alone, grey at 0.18.

## Known limitations

- **Editor only** The gizmo draws for every sweep when the Gizmos toggle is on, which a capture keeps off.
- **Approximated** The wireframe ports six shape types, and a type without a port draws no wireframe where Godot draws that shape's own lines.
- **Approximated** A convex wireframe cuts coplanar hull faces along a diagonal QuickHull picks, which Godot's hull computer may pick differently.