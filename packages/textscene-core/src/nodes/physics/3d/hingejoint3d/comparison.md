---
type: HingeJoint3D
category: 3D
status: limitation
fixture: unit-hinge-joint-3d.tscn
# image: unit-hinge-joint-3d
visual: false
renders_as: a transform group with the hinge axis and a circle for each body for every node
---

# HingeJoint3D

A joint that restricts a body's rotation to one axis relative to another body. In a running game the physics server limits the rotation, which Godot's editor never runs. The previewer renders a transform group with the joint gizmo.

## Linting

<!-- lint:begin HingeJoint3D -->
Strict parsing format-checks these `HingeJoint3D` properties, plus 4 inherited from Joint3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_limit/bias` | float 0.01-0.99 | warning |
| `angular_limit/enable` | true or false |  |
| `angular_limit/lower` | radians, -180° to 180° | warning |
| `angular_limit/relaxation` | float 0.01-16 | warning |
| `angular_limit/softness` | float 0.01-16 | warning |
| `angular_limit/upper` | radians, -180° to 180° | warning |
| `motor/enable` | true or false |  |
| `motor/max_impulse` | float 0.01-1024 | warning |
| `motor/target_velocity` | float |  |
| `params/bias` | float 0-0.99 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser reads `node_a`, `node_b`, `angular_limit/enable`, `angular_limit/lower` and `angular_limit/upper` on top of the Node3D transform. An unauthored or unreadable key stays `undefined`, not Godot's default. The gizmo substitutes the limit off and the limits `-PI / 2` and `PI / 2` where it draws. `params/*`, `angular_limit/bias`, `angular_limit/softness`, `angular_limit/relaxation` and `motor/*` are never read, because they steer the simulation that only a running game runs.

## Gizmo

Every node draws the hinge axis, one segment along Z from 0.5 to -0.5, in the joint colour, faint while unselected (ADR-0056). Each body that resolves adds a circle of 32 arcs around Z, at radius 0.25 for body A and 0.27 for body B, in the colour of that body. Godot's source is `joint_3d_gizmo_plugin.cpp:473-501` for the hinge and `:176-236` for the circle. With the limit off the circle is full. With it on the circle spans the lower to the upper limit, a single segment where they are equal, and a full circle where the lower is above the upper. The circle looks from the joint toward its body around the joint's own Z axis (`:145-174`).

## Known limitations

- **Editor only** The axis and circles draw for every hinge joint when the Gizmos toggle is on, which a capture keeps off.
- **Needs runtime** Only a running game limits the rotation of the two bodies, with `params/bias`, `angular_limit/bias`, `angular_limit/softness`, `angular_limit/relaxation` and the motor.
