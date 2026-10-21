---
type: SoftBody3D
category: 3D
status: unreviewed
fixture: unit-soft-body-3d.tscn
image: unit-soft-body-3d
renders_as: a THREE.Mesh
---

# SoftBody3D

A deformable physics mesh that derives from MeshInstance3D. The previewer draws its `mesh` at rest as a MeshInstance3D does, with the material overrides, and runs no simulation.

## Linting

<!-- lint:begin SoftBody3D -->
Strict parsing format-checks these `SoftBody3D` properties, plus 5 inherited from MeshInstance3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `attachments/*` | attachment |  |
| `collision_layer` | 32-bit layer mask (layers 1-32) |  |
| `collision_mask` | 32-bit layer mask (layers 1-32) |  |
| `damping_coefficient` | float >= 0 | warning below |
| `disable_mode` | enum 0-1 (REMOVE/KEEP_ACTIVE) | warning |
| `drag_coefficient` | float 0-1 | warning |
| `linear_stiffness` | float 0-1 | warning |
| `parent_collision_ignore` | NodePath("path/to/node") |  |
| `pinned_points` | int array ([…] or PackedInt32Array(…)) |  |
| `pressure_coefficient` | float |  |
| `ray_pickable` | true or false |  |
| `shrinking_factor` | float |  |
| `simulation_precision` | integer 1-100 | warning |
| `total_mass` | float >= 0 | error below 0 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-softbody3d-mesh` (type-family match) | `valid-softbody3d-mesh` | warning |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

The lenient parser reuses MeshInstance3D's parse. The scene cull measures the node by its mesh's box at rest, so its visibility range still decides its visibility dependants. An out-of-range `simulation_precision` or a non-boolean `ray_pickable` parses without complaint and has no effect, since nothing simulates it.

## Known limitations

- **Needs runtime** Godot draws and culls the mesh as the simulation moves it, and shades it with smooth normals, but the previewer keeps the rest mesh, its box and its authored normals.
