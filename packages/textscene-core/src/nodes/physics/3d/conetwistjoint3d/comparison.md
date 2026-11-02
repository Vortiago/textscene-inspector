---
type: ConeTwistJoint3D
category: 3D
status: limitation
fixture: unit-cone-twist-joint-3d.tscn
# image: unit-cone-twist-joint-3d
visual: false
renders_as: a transform group with a cone for each body for every node
---

# ConeTwistJoint3D

A ball-and-socket joint between two 3D physics bodies. In a running game the physics server limits their swing and twist, which Godot's editor never runs. The previewer renders a transform group with the joint gizmo.

## Linting

<!-- lint:begin ConeTwistJoint3D -->
Strict parsing format-checks these `ConeTwistJoint3D` properties, plus 4 inherited from Joint3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bias` | float 0.01-16 | warning |
| `relaxation` | float 0.01-16 | warning |
| `softness` | float 0.01-16 | warning |
| `swing_span` | radians, -180° to 180° | warning |
| `twist_span` | radians, -40000° to 40000° | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser reads `node_a`, `node_b`, `swing_span` and `twist_span` on top of the Node3D transform. An unauthored or unreadable key stays `undefined`, not Godot's default. The gizmo substitutes `swing_span = PI / 4` and `twist_span = PI` where it draws. `bias`, `softness` and `relaxation` are never read, because they steer the simulation that only a running game runs.

## Gizmo

Every node draws one cone for each body that resolves, faint while unselected (ADR-0056). Each cone has the colour of its body. Godot's source is `joint_3d_gizmo_plugin.cpp:238-279` for the cone and `:562-580` for the call. Body A draws in `Color(0.6, 0.8, 1)` and body B in `Color(0.6, 0.9, 1)`. The joint colour draws nothing here. A cone is the swing circle with a spoke every 90 degrees, and the X axis. The twist spiral adds one segment for each 5 degrees of `twist_span`, up to 720 degrees.

A cone looks from the joint at its body, crossed with the world up (`:45-67`). A rotated ancestor therefore turns the cone. A body straight above or below the joint, or at its origin, collapses the cone onto the joint.

## Known limitations

- **Editor only** The cones draw for every cone-twist joint when the Gizmos toggle is on, which a capture keeps off.
- **Needs runtime** Only a running game limits the swing and twist of the two bodies, with `bias`, `softness` and `relaxation`.
