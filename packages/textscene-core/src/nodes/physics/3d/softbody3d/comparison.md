---
type: SoftBody3D
category: 3D
status: unimplemented
fixture: unit-soft-body-3d.tscn
# image: unit-soft-body-3d
renders_as: nothing yet, Godot draws a deformable mesh, the previewer does not
---

# SoftBody3D

A deformable physics mesh that Godot draws as a simulated version of its own `mesh`. The previewer parses and validates it but does not draw it yet, so the Node3D base mounts under `renderIntent: 'pending'` and its children still show.

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
| `total_mass` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-softbody3d-mesh` (type-family match) | `valid-softbody3d-mesh` | warning |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. An out-of-range `simulation_precision`, a non-boolean `ray_pickable` or a missing `mesh` parses without complaint and has no effect, since nothing renders from it.

## Known limitations

- **Not drawn** Godot draws the soft mesh. The previewer draws nothing for it.
