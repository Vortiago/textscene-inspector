---
type: VehicleWheel3D
category: 3D
status: linter-only
fixture: unit-vehicle-wheel-3d.tscn
# image: unit-vehicle-wheel-3d
visual: false
renders_as: nothing (a transform-only group)
---

# VehicleWheel3D

VehicleWheel3D simulates one wheel of a VehicleBody3D's raycast suspension and also acts as the wheel's ground collider; it draws nothing of its own, so the previewer mounts it as a transform-only Node3D group (ADR-0008) and lets only its children (a `MeshInstance3D` wheel mesh, not present in this fixture) draw.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | translate `(0.75, -0.3, 1.2)` | positions the transform-only group; no visual effect, the node draws nothing |
| `use_as_traction` | `true` | physics-only, transfers engine force to the ground; no visual in a static preview |
| `use_as_steering` | `true` | physics-only, turns with `VehicleBody3D.steering`; no visual in a static preview |
| `engine_force` | `25.0` | physics-only per-wheel drive force; no visual in a static preview |
| `brake` | `12.5` | physics-only per-wheel braking force; no visual in a static preview |
| `steering` | `0.3927` | physics-only per-wheel steering angle in radians (~22.5°); no visual in a static preview |
| `wheel_roll_influence` | `0.1` | physics-only, resists body roll; no visual in a static preview |
| `wheel_radius` | `0.5` | physics-only raycast/collider radius in meters; no visual in a static preview |
| `wheel_rest_length` | `0.15` | physics-only suspension rest distance in meters; no visual in a static preview |
| `wheel_friction_slip` | `10.5` | physics-only grip factor; no visual in a static preview |
| `suspension_travel` | `0.2` | physics-only suspension travel distance in meters; no visual in a static preview |
| `suspension_stiffness` | `5.88` | physics-only spring stiffness; no visual in a static preview |
| `suspension_max_force` | `6000.0` | physics-only maximum spring force; no visual in a static preview |
| `damping_compression` | `0.83` | physics-only compression damping; no visual in a static preview |
| `damping_relaxation` | `0.88` | physics-only rebound damping; no visual in a static preview |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin VehicleWheel3D -->
Strict parsing format-checks these `VehicleWheel3D` properties, plus 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `brake` | float |
| `damping_compression` | float |
| `damping_relaxation` | float |
| `engine_force` | float |
| `steering` | radians, -180° to 180° |
| `suspension_max_force` | float |
| `suspension_stiffness` | float |
| `suspension_travel` | float |
| `use_as_steering` | true or false |
| `use_as_traction` | true or false |
| `wheel_friction_slip` | float |
| `wheel_radius` | float |
| `wheel_rest_length` | float |
| `wheel_roll_influence` | float |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-vehiclewheel3d-parent` (type-family match) | `vehiclewheel3d-no-parent` | warning |
|  | `vehiclewheel3d-invalid-parent` | warning |
<!-- lint:end -->

VehicleWheel3D has no `parser.ts` of its own: it reuses `parseNode3D` directly, so a
malformed `steering`, `engine_force`, or any other property value the strict parser
rejects is simply never read by the lenient parser — there is no substitution to
make, and the node still renders as an empty transform-only group.
