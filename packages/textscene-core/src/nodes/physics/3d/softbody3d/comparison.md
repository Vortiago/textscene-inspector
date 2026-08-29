---
type: SoftBody3D
category: 3D
status: unimplemented
fixture: unit-soft-body-3d.tscn
# image: unit-soft-body-3d
renders_as: nothing yet; Godot draws a deformable mesh, the previewer does not
---

# SoftBody3D

A deformable 3D physics mesh: Godot draws it as a soft, simulated version of its
own `mesh`, but the previewer only parses and validates it so far and does not draw
it yet. The Node3D base mounts under `renderIntent: 'pending'`, so it holds its
transform and honours `visible`, its children still show, and the badge reports
the gap.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `mesh` | `SubResource("BoxMesh_1")` | the mesh this body would deform (not yet drawn) |
| `collision_layer` | `3` | physics layers this body is in |
| `collision_mask` | `5` | physics layers this body scans |
| `parent_collision_ignore` | `NodePath("../Ground")` | the CollisionObject3D this body should avoid clipping |
| `simulation_precision` | `8` | solver iteration count |
| `total_mass` | `2.5` | the body's mass |
| `linear_stiffness` | `0.6` | how stiff vs. bendable the body is |
| `shrinking_factor` | `0.1` | shrinks the mesh's edge constraints by 10% |
| `pressure_coefficient` | `1.5` | simulated internal pressure build-up |
| `damping_coefficient` | `0.05` | how quickly applied forces slow down |
| `drag_coefficient` | `0.1` | air resistance |
| `ray_pickable` | `false` | opts out of RayCast3D hits |
| `disable_mode` | `1` | KEEP_ACTIVE: stays simulated when process_mode is disabled |

## Divergences

None visible in this fixture.

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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-meshinstance3d-resources` (type-family match) | `valid-meshinstance3d-resources` | error |
| `valid-softbody3d-mesh` (type-family match) | `valid-softbody3d-mesh` | warning |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`
off any node heading: it never looks at `mesh`, `total_mass`, `collision_layer`, or
any other property this file's `linterParser.ts`/`linter.ts` validate. A malformed
value for any of them (an out-of-range `simulation_precision`, a non-boolean
`ray_pickable`, a missing `mesh`) parses without complaint and has no effect at all,
since nothing is rendered from it yet either way.
