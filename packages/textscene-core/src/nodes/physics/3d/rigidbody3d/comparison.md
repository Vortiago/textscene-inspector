---
type: RigidBody3D
category: 3D
status: linter-only
fixture: unit-rigidbody3d.tscn
image: unit-rigidbody3d
renders_as: an invisible transform-only group
---

# RigidBody3D

A gravity-driven physics body. The previewer mounts it as a transform-only Node3D group (ADR-0008) and runs no simulation. The reddish crate on screen is its child MeshInstance3D, and the collision shape is a toggle-gated overlay.

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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-rigidbody3d` (type-family match) | `rigidbody3d-max-contacts-without-monitor` | info |
|  | `rigidbody3d-scale-overridden-at-runtime` | warning |
| `valid-collisionobject3d` (type-family match) | `collisionobject3d-needs-collision-shape` | warning |
<!-- lint:end -->

RigidBody3D reuses `parseNode3D` directly, so `mass`, `inertia`, the centre-of-mass and damp settings and `freeze_mode` are never read by the lenient parser. The node renders as a transform-only group, so nothing needs substituting.
