---
type: Generic6DOFJoint3D
category: 3D
status: limitation
fixture: unit-generic-6d-of-joint-3d.tscn
# image: unit-generic-6d-of-joint-3d
visual: false
renders_as: a transform group with the travel of each axis and a circle per axis for each body for every node
---

# Generic6DOFJoint3D

A joint with limits, motors and springs on all six axes. In a running game the physics server enforces them, which Godot's editor never runs. The previewer renders a transform group with the joint gizmo.

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

The lenient parser reads `node_a`, `node_b` and, for each axis, `linear_limit_<axis>/enabled`, `upper_distance` and `lower_distance` and `angular_limit_<axis>/enabled`, `upper_angle` and `lower_angle`, on top of the Node3D transform. An unauthored or unreadable key stays `undefined`, not Godot's default. The gizmo substitutes both limits on and every limit 0 where it draws. The softness, restitution, damping, motor and spring keys are never read, because they steer the simulation that only a running game runs.

## Gizmo

Every node draws the travel of its three axes in the joint colour. It is faint while unselected (ADR-0056). With the linear limit on, an axis draws a segment between the negated limits with a 0.5 square at each end. Otherwise it draws a segment of half-length 0.5. Each body that resolves adds one circle per axis in the colour of that body. The radius is 0.25 for body A and 0.27 for body B. Each circle follows the angular limit of its axis and looks from the joint toward the body around that axis. With the angular limit off the circle is full. Godot's source is `joint_3d_gizmo_plugin.cpp:582-724` for the joint and `:176-236` for the circle. Godot hands body B's circles over only when body A resolves, so a joint with only `node_b` draws the travel and no circle. With only `node_a`, body B draws toward the world origin.

## Known limitations

- **Editor only** The travel and circles draw for every 6DOF joint when the Gizmos toggle is on, which a capture keeps off.
- **Needs runtime** Only a running game enforces the limits, the motors and the springs on the two bodies.
