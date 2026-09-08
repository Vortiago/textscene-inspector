---
type: PhysicalBone3D
category: 3D
status: linter-only
fixture: unit-physical-bone-3d.tscn
# image: unit-physical-bone-3d
visual: false
renders_as: nothing (a transform-only group)
---

# PhysicalBone3D

A physics body that makes one bone of a `Skeleton3D` react to physics. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin PhysicalBone3D -->
Strict parsing format-checks these `PhysicalBone3D` properties, plus 6 inherited from PhysicsBody3D, 6 inherited from CollisionObject3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_damp` | float >= 0 | error below |
| `angular_damp_mode` | enum 0-1 (COMBINE/REPLACE) | warning |
| `angular_velocity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `body_offset` | Transform3D(12 floats) |  |
| `bone_name` | quoted string or &"name" |  |
| `bounce` | float 0-1 | error |
| `can_sleep` | true or false |  |
| `custom_integrator` | true or false |  |
| `friction` | float 0-1 | error |
| `gravity_scale` | float |  |
| `joint_constraints/*` | joint-type-dependent constraint (float or bool — see PinJointData/ConeJointData/HingeJointData/SliderJointData/SixDOFJointData) |  |
| `joint_offset` | Transform3D(12 floats) |  |
| `joint_rotation` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `joint_type` | enum 0-5 (NONE/PIN/CONE/HINGE/SLIDER/6DOF) | warning |
| `linear_damp` | float >= 0 | error below |
| `linear_damp_mode` | enum 0-1 (COMBINE/REPLACE) | warning |
| `linear_velocity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `mass` | float >= 0.01 | error at or below 0, warning below 0.01 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-collisionobject3d` (type-family match) | `collisionobject3d-needs-collision-shape` | warning |
| `valid-physicalbone3d-collision-shape` | `physicalbone3d-joint-constraint-without-joint` | error |
|  | `physicalbone3d-joint-constraint-wrong-joint-type` | error |
<!-- lint:end -->

PhysicalBone3D registers `parseNode3D` directly, which reads only `transform` and `visible`. A malformed `joint_type` or an unquoted `bone_name` is dropped rather than substituted or warned on, and survives only on `rawProperties`.
