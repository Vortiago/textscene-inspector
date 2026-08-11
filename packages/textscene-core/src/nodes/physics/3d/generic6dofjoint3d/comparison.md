---
type: Generic6DOFJoint3D
category: 3D
status: linter-only
fixture: unit-generic-6d-of-joint-3d.tscn
# image: unit-generic-6d-of-joint-3d
visual: false
renders_as: nothing (a transform-only group)
---

# Generic6DOFJoint3D

This node draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

The fixture sets one representative property per group, spread across the `x`/`y`/`z`
axis suffix so every axis letter is exercised at least once. Strict validation is
registered as a wildcard per `<group>_<axis>/*` (18 patterns: 6 groups × 3 axes, all
sharing one leaf table per group — Godot's own `ADD_PROPERTYI` calls give x/y/z
byte-identical `PropertyInfo` per leaf) rather than as ~80 individual keys.

| Group (wildcard) | Value set | Effect |
| --- | --- | --- |
| `linear_limit_x/*` | `enabled=true`, `upper_distance=2.0`, `lower_distance=-2.0`, `softness=0.7`, `restitution=0.5`, `damping=1.0` | none: linear-motion clamp on X; not drawn |
| `linear_motor_y/*` | `enabled=true`, `target_velocity=3.0`, `force_limit=10.0` | none: linear motor on Y; not drawn |
| `linear_spring_z/*` | `enabled=true`, `stiffness=4.0`, `damping=0.02`, `equilibrium_point=0.1` | none: linear spring on Z; not drawn |
| `angular_limit_x/*` | `enabled=true`, `upper_angle=0.5`, `lower_angle=-0.5`, `softness=0.5`, `restitution=0.2`, `damping=1.0`, `force_limit=0.0`, `erp=0.5` | none: rotation clamp on X; not drawn |
| `angular_motor_y/*` | `enabled=true`, `target_velocity=1.0`, `force_limit=300.0` | none: angular motor on Y; not drawn |
| `angular_spring_z/*` | `enabled=true`, `stiffness=0.0`, `damping=0.0`, `equilibrium_point=0.3` | none: angular spring on Z; not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Generic6DOFJoint3D -->
Strict parsing format-checks these `Generic6DOFJoint3D` properties, plus 4 inherited from Joint3D, 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `angular_limit_x/*` | angular limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `angular_limit_y/*` | angular limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `angular_limit_z/*` | angular limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `angular_motor_x/*` | angular motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `angular_motor_y/*` | angular motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `angular_motor_z/*` | angular motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `angular_spring_x/*` | angular spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `angular_spring_y/*` | angular spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `angular_spring_z/*` | angular spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `linear_limit_x/*` | linear limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `linear_limit_y/*` | linear limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `linear_limit_z/*` | linear limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `linear_motor_x/*` | linear motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `linear_motor_y/*` | linear motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `linear_motor_z/*` | linear motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `linear_spring_x/*` | linear spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `linear_spring_y/*` | linear spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |
| `linear_spring_z/*` | linear spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D` (index.ts), which reads only `transform` and
`visible`, so none of the `linear_limit_x/*` / `linear_motor_y/*` / `linear_spring_z/*` /
`angular_limit_x/*` / `angular_motor_y/*` / `angular_spring_z/*` keys is ever read: a
malformed value like `linear_limit_x/damping = "fast"` is silently dropped rather than
substituted or warned on, consistent with the node rendering as a transform-only group.
