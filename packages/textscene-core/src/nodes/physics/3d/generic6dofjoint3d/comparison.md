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

A joint with limits, motors and springs on all six axes. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin Generic6DOFJoint3D -->
Strict parsing format-checks these `Generic6DOFJoint3D` properties, plus 4 inherited from Joint3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_limit_x/*` | angular limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `angular_limit_x/damping` | float 0.01-16 | warning |
| `angular_limit_x/lower_angle` | radians, -180° to 180° | warning |
| `angular_limit_x/restitution` | float 0.01-16 | warning |
| `angular_limit_x/softness` | float 0.01-16 | warning |
| `angular_limit_x/upper_angle` | radians, -180° to 180° | warning |
| `angular_limit_y/*` | angular limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `angular_limit_y/damping` | float 0.01-16 | warning |
| `angular_limit_y/lower_angle` | radians, -180° to 180° | warning |
| `angular_limit_y/restitution` | float 0.01-16 | warning |
| `angular_limit_y/softness` | float 0.01-16 | warning |
| `angular_limit_y/upper_angle` | radians, -180° to 180° | warning |
| `angular_limit_z/*` | angular limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `angular_limit_z/damping` | float 0.01-16 | warning |
| `angular_limit_z/lower_angle` | radians, -180° to 180° | warning |
| `angular_limit_z/restitution` | float 0.01-16 | warning |
| `angular_limit_z/softness` | float 0.01-16 | warning |
| `angular_limit_z/upper_angle` | radians, -180° to 180° | warning |
| `angular_motor_x/*` | angular motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `angular_motor_y/*` | angular motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `angular_motor_z/*` | angular motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `angular_spring_x/*` | angular spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `angular_spring_x/equilibrium_point` | radians, -180° to 180° | warning |
| `angular_spring_y/*` | angular spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `angular_spring_y/equilibrium_point` | radians, -180° to 180° | warning |
| `angular_spring_z/*` | angular spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `angular_spring_z/equilibrium_point` | radians, -180° to 180° | warning |
| `linear_limit_x/*` | linear limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `linear_limit_x/damping` | float 0.01-16 | warning |
| `linear_limit_x/restitution` | float 0.01-16 | warning |
| `linear_limit_x/softness` | float 0.01-16 | warning |
| `linear_limit_y/*` | linear limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `linear_limit_y/damping` | float 0.01-16 | warning |
| `linear_limit_y/restitution` | float 0.01-16 | warning |
| `linear_limit_y/softness` | float 0.01-16 | warning |
| `linear_limit_z/*` | linear limit parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `linear_limit_z/damping` | float 0.01-16 | warning |
| `linear_limit_z/restitution` | float 0.01-16 | warning |
| `linear_limit_z/softness` | float 0.01-16 | warning |
| `linear_motor_x/*` | linear motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `linear_motor_y/*` | linear motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `linear_motor_z/*` | linear motor parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `linear_spring_x/*` | linear spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `linear_spring_y/*` | linear spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |
| `linear_spring_z/*` | linear spring parameter (see generic_6dof_joint_3d.cpp _bind_methods) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A malformed `linear_limit_x/damping` or any other axis key is dropped rather than substituted or warned on, since nothing renders from it.
