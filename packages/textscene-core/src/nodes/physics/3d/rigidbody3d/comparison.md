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
Strict parsing format-checks these `RigidBody3D` properties, plus 6 inherited from PhysicsBody3D, 6 inherited from CollisionObject3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_damp` | float >= 0 | error below |
| `angular_damp_mode` | enum 0-1 (COMBINE/REPLACE) | warning |
| `angular_velocity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `can_sleep` | true or false |  |
| `center_of_mass` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `center_of_mass_mode` | enum 0-1 (AUTO/CUSTOM) | warning |
| `constant_force` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `constant_torque` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `contact_monitor` | true or false |  |
| `continuous_cd` | true or false |  |
| `custom_integrator` | true or false |  |
| `freeze` | true or false |  |
| `freeze_mode` | enum 0-1 (STATIC/KINEMATIC) | warning |
| `gravity_scale` | float |  |
| `inertia` | Vector3(x, y, z), each float >= 0 | error below |
| `linear_damp` | float >= 0 | error below |
| `linear_damp_mode` | enum 0-1 (COMBINE/REPLACE) | warning |
| `linear_velocity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `lock_rotation` | true or false |  |
| `mass` | float >= 0.001 | error at or below 0, warning below 0.001 |
| `max_contacts_reported` | integer >= 0, < 4096 | error below 0, error at or above 4096 |
| `physics_material_override` | null, SubResource("id") or ExtResource("id") |  |
| `sleeping` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-rigidbody3d` (type-family match) | `rigidbody3d-max-contacts-without-monitor` | warning |
|  | `rigidbody3d-scale-overridden-at-runtime` | warning |
| `valid-collisionobject3d` (type-family match) | `collisionobject3d-needs-collision-shape` | warning |
<!-- lint:end -->

RigidBody3D has no `parser.ts`: it reuses `parseNode3D` directly, so none of
the strict-validated properties (`mass`, `inertia`, the center-of-mass and
damp settings, `collision_layer`/`collision_mask`, `freeze_mode`,
`disable_mode`) are read by the lenient parser. The node renders as a
transform-only group, so nothing needs substituting.
