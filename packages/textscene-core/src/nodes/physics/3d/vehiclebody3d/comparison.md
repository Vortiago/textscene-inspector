---
type: VehicleBody3D
category: 3D
status: linter-only
fixture: unit-vehicle-body-3d.tscn
# image: unit-vehicle-body-3d
visual: false
renders_as: nothing (a transform-only group)
---

# VehicleBody3D

VehicleBody3D is a raycast-wheel physics body that simulates a car; it draws nothing of its own, so the previewer mounts it as a transform-only Node3D group (ADR-0008) and lets only its children (a `MeshInstance3D` body and its `VehicleWheel3D` wheels, neither present in this fixture) draw.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | translate `(0, 1, 0)` | positions the transform-only group; no visual effect, the node draws nothing |
| `engine_force` | `40.0` | physics-only, drives the wheels; no visual in a static preview |
| `brake` | `12.5` | physics-only braking force; no visual in a static preview |
| `steering` | `0.5236` | physics-only steering angle in radians (~30°); no visual in a static preview |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin VehicleBody3D -->
Strict parsing format-checks these `VehicleBody3D` properties, plus 19 inherited from RigidBody3D, 6 inherited from CollisionObject3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `brake` | float |
| `engine_force` | float |
| `steering` | radians, -180° to 180° |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-rigidbody3d` (type-family match) | `valid-rigidbody3d-resources` | error |
|  | `rigidbody3d-needs-collision-shape` | warning |
|  | `rigidbody3d-mass-too-low` | warning |
|  | `rigidbody3d-mass-too-high` | warning |
|  | `rigidbody3d-excessive-linear-damp` | warning |
|  | `rigidbody3d-excessive-angular-damp` | warning |
|  | `rigidbody3d-max-contacts-without-monitor` | warning |
|  | `rigidbody3d-zero-collision-layer` | warning |
|  | `rigidbody3d-zero-collision-mask` | warning |
<!-- lint:end -->

VehicleBody3D has no `parser.ts`: it reuses `parseNode3D` directly, so a malformed
`engine_force`, `brake`, or `steering` value the strict parser rejects is simply
never read by the lenient parser — there is no substitution to make, and the node
still renders as an empty transform-only group.
