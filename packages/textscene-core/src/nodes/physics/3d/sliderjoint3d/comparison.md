---
type: SliderJoint3D
category: 3D
status: limitation
fixture: unit-slider-joint-3d.tscn
# image: unit-slider-joint-3d
visual: false
renders_as: a transform group with the slider travel and a circle for each body for every node
---

# SliderJoint3D

A joint that restricts a body's movement to one axis relative to another body. In a running game the physics server limits the travel and rotation, which Godot's editor never runs. The previewer renders a transform group with the joint gizmo.

## Linting

<!-- lint:begin SliderJoint3D -->
Strict parsing format-checks these `SliderJoint3D` properties, plus 4 inherited from Joint3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_limit/damping` | float 0-16 | warning |
| `angular_limit/lower_angle` | radians, -180° to 180° | warning |
| `angular_limit/restitution` | float 0.01-16 | warning |
| `angular_limit/softness` | float 0.01-16 | warning |
| `angular_limit/upper_angle` | radians, -180° to 180° | warning |
| `angular_motion/damping` | float 0-16 | warning |
| `angular_motion/restitution` | float 0.01-16 | warning |
| `angular_motion/softness` | float 0.01-16 | warning |
| `angular_ortho/damping` | float 0-16 | warning |
| `angular_ortho/restitution` | float 0.01-16 | warning |
| `angular_ortho/softness` | float 0.01-16 | warning |
| `linear_limit/damping` | float 0-16 | warning |
| `linear_limit/lower_distance` | float -1024-1024 | warning |
| `linear_limit/restitution` | float 0.01-16 | warning |
| `linear_limit/softness` | float 0.01-16 | warning |
| `linear_limit/upper_distance` | float -1024-1024 | warning |
| `linear_motion/damping` | float 0-16 | warning |
| `linear_motion/restitution` | float 0.01-16 | warning |
| `linear_motion/softness` | float 0.01-16 | warning |
| `linear_ortho/damping` | float 0-16 | warning |
| `linear_ortho/restitution` | float 0.01-16 | warning |
| `linear_ortho/softness` | float 0.01-16 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser reads `node_a`, `node_b`, `linear_limit/upper_distance`, `linear_limit/lower_distance`, `angular_limit/upper_angle` and `angular_limit/lower_angle` on top of the Node3D transform. An unauthored or unreadable key stays `undefined`, not Godot's default. The gizmo substitutes the linear limits 1 and -1 and the angular limits 0 and 0 where it draws. The softness, restitution and damping keys are never read, because they steer the simulation that only a running game runs.

## Gizmo

Every node draws the slider travel in the joint colour. It is faint while unselected (ADR-0056). The travel is one segment along Z from 0.5 to -0.5. With both linear limits negated, a segment along X joins them, and a 0.5 square in the YZ plane stands at each end. Where the negated lower limit is below the upper, one segment along X from 0.5 to -0.5 replaces them. Each body that resolves adds a circle of 32 arcs around X in the colour of that body. The radius is 0.25 for body A and 0.27 for body B. Body B draws the inverse form. Godot's source is `joint_3d_gizmo_plugin.cpp:503-560` for the slider and `:176-236` for the circle. Equal angular limits draw one segment, and a lower limit above the upper draws a full circle. The circle looks from the joint toward its body around the joint's own X axis (`:83-112`).

## Known limitations

- **Editor only** The travel and circles draw for every slider joint when the Gizmos toggle is on, which a capture keeps off.
- **Needs runtime** Only a running game limits the travel and rotation of the two bodies, with the softness, restitution and damping keys.
