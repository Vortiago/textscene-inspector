---
type: RigidBody3D
category: 3D
status: linter-only
fixture: unit-rigidbody3d.tscn
image: unit-rigidbody3d
renders_as: an invisible transform-only group
---

# RigidBody3D

RigidBody3D is a gravity-driven physics body. The previewer mounts it as a
transform-only Node3D group — it draws nothing itself and runs no simulation
(ADR-0005/0008), only positioning its children at the authored transform. The
reddish crate on screen is its child `MeshInstance3D` (a 1×1×1 `BoxMesh` under a
salmon `StandardMaterial3D`); the `CollisionShape3D` is a toggle-gated overlay
(ADR-0006) and stays hidden. Both frames carry the grey-sky-over-brown-ground
preview environment.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | translate `(0, 1, 0)` | lifts the body one unit up; its child mesh rides along and floats above centre |
| `mass` | `2.0` | physics-only, no visual in a static preview |
| `gravity_scale` | `1.0` | physics-only; nothing falls because neither side simulates |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin RigidBody3D -->
Strict parsing format-checks these `RigidBody3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `angular_damp` |
| `angular_damp_mode` |
| `can_sleep` |
| `center_of_mass` |
| `center_of_mass_mode` |
| `collision_layer` |
| `collision_mask` |
| `collision_priority` |
| `contact_monitor` |
| `continuous_cd` |
| `custom_integrator` |
| `disable_mode` |
| `freeze` |
| `freeze_mode` |
| `gravity_scale` |
| `inertia` |
| `linear_damp` |
| `linear_damp_mode` |
| `lock_rotation` |
| `mass` |
| `max_contacts_reported` |
| `physics_material_override` |
| `sleeping` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-rigidbody3d` | `valid-rigidbody3d-resources` | error |
|  | `rigidbody3d-needs-collision-shape` | warning |
|  | `rigidbody3d-mass-too-low` | warning |
|  | `rigidbody3d-mass-too-high` | warning |
|  | `rigidbody3d-excessive-linear-damp` | warning |
|  | `rigidbody3d-excessive-angular-damp` | warning |
|  | `rigidbody3d-max-contacts-without-monitor` | warning |
|  | `rigidbody3d-zero-collision-layer` | warning |
|  | `rigidbody3d-zero-collision-mask` | warning |
<!-- lint:end -->

RigidBody3D has no `parser.ts`: it reuses `parseNode3D` directly, so none of
the strict-validated properties (`mass`, `inertia`, the center-of-mass and
damp settings, `collision_layer`/`collision_mask`, `freeze_mode`,
`disable_mode`) are read by the lenient parser. The node renders as a
transform-only group, so nothing needs substituting.
