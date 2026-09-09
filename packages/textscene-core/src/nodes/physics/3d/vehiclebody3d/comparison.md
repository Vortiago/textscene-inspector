---
type: VehicleBody3D
category: 3D
status: linter-only
fixture: unit-physics-vehicle.tscn
image: unit-physics-vehicle
renders_as: an invisible transform-only group
---

# VehicleBody3D

A RigidBody3D whose motion comes from its VehicleWheel3D children. It has no visual of its own in either engine, so the previewer mounts it as a transform-only group (ADR-0008). The chassis and wheels on screen are its children's meshes.

## Linting

<!-- lint:begin VehicleBody3D -->
Strict parsing format-checks these `VehicleBody3D` properties, plus 23 inherited from RigidBody3D, 6 inherited from PhysicsBody3D, 6 inherited from CollisionObject3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `brake` | float |  |
| `engine_force` | float |  |
| `steering` | radians, -180° to 180° | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-rigidbody3d` (type-family match) | `rigidbody3d-max-contacts-without-monitor` | info |
|  | `rigidbody3d-scale-overridden-at-runtime` | warning |
| `valid-collisionobject3d` (type-family match) | `collisionobject3d-needs-collision-shape` | warning |
| `valid-vehiclebody3d` | `vehiclebody3d-needs-wheels` | info |
<!-- lint:end -->

VehicleBody3D reuses `parseNode3D` directly, so `mass`, `engine_force`, `brake` and `steering` are never read by the lenient parser. Its validator set is inherited: every RigidBody3D property is format-checked on a vehicle body too.
