---
type: VehicleBody3D
category: 3D
status: unreviewed
fixture: unit-physics-vehicle.tscn
image: unit-physics-vehicle
renders_as: an invisible transform-only group
---

# VehicleBody3D

VehicleBody3D is a RigidBody3D subclass whose motion is produced by its
VehicleWheel3D children. The previewer mounts it as a transform-only Node3D group
— it draws nothing itself and runs no simulation (ADR-0005/0008), only
positioning its children at the authored transform. Everything visible in the
fixture belongs to those children: the blue chassis is a `MeshInstance3D`, the
four dark cylinders are the wheels' meshes, and the `CollisionShape3D` is a
toggle-gated overlay (ADR-0006) that stays hidden.

This node has **no visual of its own in either engine** — Godot ships no
VehicleBody3D gizmo, and a static preview has no motion to depict. That absence
is the useful fact: the vehicle looks identical to a plain Node3D holding the
same children, and the type only becomes legible in the scene tree.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | translate `(0, 0.4, 0)` | lifts the chassis clear of the ground; every wheel rides along |
| `mass` | `40.0` | physics-only, no visual in a static preview (this is also Godot's VehicleBody3D default, overriding RigidBody3D's) |
| `center_of_mass_mode` | `1` (CUSTOM) | physics-only; a vehicle body almost always overrides its centre of mass |
| `physics_material_override` | `PhysicsMaterial` with `friction = 0.5` | physics-only; validated as a resource reference, never applied |

## Divergences

None visible in this fixture — 70 of 721 980 pixels differ (0.010%), all of them
antialiasing along the chassis and wheel silhouettes.

## Linting

<!-- lint:begin VehicleBody3D -->
Strict parsing format-checks these `VehicleBody3D` properties, plus 23 inherited from RigidBody3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `brake` |
| `engine_force` |
| `steering` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-vehiclebody3d` | `valid-vehiclebody3d-resources` | error |
|  | `vehiclebody3d-needs-wheels` | warning |
|  | `vehiclebody3d-needs-collision-shape` | warning |
|  | `vehiclebody3d-scaled-transform` | warning |
|  | `vehiclebody3d-zero-collision-layer` | warning |
|  | `vehiclebody3d-zero-collision-mask` | warning |
<!-- lint:end -->

VehicleBody3D has no `parser.ts`: it reuses `parseNode3D` directly, so none of
the strict-validated properties (`mass`, `engine_force`, `brake`, `steering`,
the inherited center-of-mass and damp settings,
`collision_layer`/`collision_mask`) are read by the lenient parser. The node
renders as a transform-only group, so nothing needs substituting.

Its validator set is inherited rather than duplicated: `VehicleBody3D` maps to
`RigidBody3D` in the linter's base-type table, so every RigidBody3D property is
format-checked on a vehicle body too, and only `engine_force`, `brake` and
`steering` are declared by the slice itself.
