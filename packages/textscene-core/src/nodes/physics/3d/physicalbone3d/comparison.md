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

A physics body that makes one bone of a `Skeleton3D` react to physics (a ragdoll bone); it draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story. Godot's joint-repositioning gizmo is editor-only and never appears in a runtime capture either.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `bone_name` | `"thigh.l"` | none: which Skeleton3D bone this body follows; not drawn |
| `joint_type` | `2` (Cone) / `5` (6DOF) | none: selects which `joint_constraints/...` family Godot serialises |
| `joint_offset` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0.2)` | none: the joint's transform relative to the bone; not drawn |
| `joint_rotation` | `Vector3(0, 0, 0)` | none: the joint's rotation in radians; not drawn |
| `body_offset` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -0.1)` | none: the body's transform relative to the bone; not drawn |
| `mass` | `1.0` | none: physics-server mass; not drawn |
| `friction` | `0.6` | none: physics-server friction; not drawn |
| `bounce` | `0.2` | none: physics-server restitution; not drawn |
| `gravity_scale` | `1.0` | none: physics-server gravity multiplier; not drawn |
| `custom_integrator` | `false` | none: whether `_integrate_forces` replaces standard force integration; not drawn |
| `linear_damp_mode` | `0` (Combine) | none: how `linear_damp` combines with area/project defaults; not drawn |
| `linear_damp` | `0.0` | none: physics-server linear damping; not drawn |
| `angular_damp_mode` | `1` (Replace) | none: how `angular_damp` combines with area/project defaults; not drawn |
| `angular_damp` | `0.5` | none: physics-server angular damping; not drawn |
| `linear_velocity` | `Vector3(0, 0, 0)` | none: physics-server linear body state; not drawn |
| `angular_velocity` | `Vector3(0, 0, 0)` | none: physics-server angular body state; not drawn |
| `can_sleep` | `true` | none: whether the body may deactivate when still; not drawn |
| `joint_constraints/swing_span`, `/twist_span`, `/bias`, `/softness`, `/relaxation` | `19.999992`, `19.999992`, `0.3`, `0.8`, `1.0` | none: `ConeJointData` parameters sent to the physics server; not drawn |
| `joint_constraints/x/linear_limit_enabled`, `/x/angular_limit_enabled`, `/x/angular_limit_upper`, `/y/linear_spring_enabled`, `/z/angular_spring_enabled` | `true`, `false`, `45.0`, `false`, `true` | none: `SixDOFJointData` per-axis parameters; not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin PhysicalBone3D -->
Strict parsing format-checks these `PhysicalBone3D` properties, plus 6 inherited from CollisionObject3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_damp` | float >= 0 | error below |
| `angular_damp_mode` | enum 0-1 (COMBINE/REPLACE) | warning |
| `angular_velocity` | Vector3(x, y, z) |  |
| `body_offset` | Transform3D(12 floats) |  |
| `bone_name` | quoted string or &"name" |  |
| `bounce` | float 0-1 | error |
| `can_sleep` | true or false |  |
| `custom_integrator` | true or false |  |
| `friction` | float 0-1 | error |
| `gravity_scale` | float |  |
| `joint_constraints/*` | joint-type-dependent constraint (float or bool — see PinJointData/ConeJointData/HingeJointData/SliderJointData/SixDOFJointData) |  |
| `joint_offset` | Transform3D(12 floats) |  |
| `joint_rotation` | Vector3(x, y, z) |  |
| `joint_type` | enum 0-5 (NONE/PIN/CONE/HINGE/SLIDER/6DOF) | warning |
| `linear_damp` | float >= 0 | error below |
| `linear_damp_mode` | enum 0-1 (COMBINE/REPLACE) | warning |
| `linear_velocity` | Vector3(x, y, z) |  |
| `mass` | float >= 5e-324 | error below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-physicalbone3d-collision-shape` | `physicalbone3d-needs-collision-shape` | warning |
<!-- lint:end -->

PhysicalBone3D has no `parser.ts` of its own: it registers `parseNode3D` directly
(index.ts), which reads only `transform` and `visible`, so none of `joint_type`,
`bone_name`, `mass`, or any `joint_constraints/...` key is ever read, valid or not.
A malformed value like `joint_type = "Cone"` or an unquoted `bone_name = thigh.l`
is silently dropped rather than substituted or warned on, consistent with the node
rendering as a transform-only group (ADR-0008). Confirmed empirically in
physicalbone3d.test.ts: the parsed node's `properties` never carries these keys,
only its `rawProperties`.
