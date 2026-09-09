---
type: StaticBody3D
category: 3D
status: linter-only
fixture: unit-physics-bodies.tscn
image: unit-physics-bodies
renders_as: a transform-only group
---

# StaticBody3D

A non-moving physics body with no runtime visual of its own. The previewer mounts it as a transform-only Node3D group (ADR-0005), and the blue slab both images show is its child `GroundMesh`.

## Linting

<!-- lint:begin StaticBody3D -->
Strict parsing format-checks these `StaticBody3D` properties, plus 6 inherited from PhysicsBody3D, 6 inherited from CollisionObject3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `constant_angular_velocity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `constant_linear_velocity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `physics_material_override` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-collisionobject3d` (type-family match) | `collisionobject3d-needs-collision-shape` | warning |
<!-- lint:end -->

StaticBody3D reuses `parseNode3D` directly, so `physics_material_override`, the constant velocities and the collision keys are never read by the lenient parser. There is no substitution to describe.
