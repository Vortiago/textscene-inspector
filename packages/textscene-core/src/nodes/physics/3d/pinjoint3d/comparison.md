---
type: PinJoint3D
category: 3D
status: limitation
fixture: unit-pin-joint-3d.tscn
# image: unit-pin-joint-3d
visual: false
renders_as: a transform group with a pin cross for every node
---

# PinJoint3D

Pins two 3D physics bodies together at a point. In a running game the physics server holds them to it, which Godot's editor never runs. The previewer renders a transform group with the joint gizmo.

## Linting

<!-- lint:begin PinJoint3D -->
Strict parsing format-checks these `PinJoint3D` properties, plus 4 inherited from Joint3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `params/bias` | float 0.01-0.99 | warning |
| `params/damping` | float 0.01-8 | warning |
| `params/impulse_clamp` | float 0-64 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser reads `node_a` and `node_b` on top of the Node3D transform. An unauthored or unreadable path stays `undefined`. `params/*` is never read, because it steers the simulation that only a running game runs.

## Gizmo

Every node draws three segments of half-length 0.25 along X, Y and Z in the joint colour, faint while unselected (ADR-0056). Godot's source is `joint_3d_gizmo_plugin.cpp:462-471`. The gizmo draws when either body resolves, and draws nothing when neither does (`:335-337`). A body is the Node3D at `node_a` or `node_b`, resolved in the live scene tree, across instance boundaries.

## Known limitations

- **Editor only** The cross draws for every pin joint when the Gizmos toggle is on, which a capture keeps off.
- **Needs runtime** Only a running game holds the two bodies together at the pin, with `params/bias`, `params/damping` and `params/impulse_clamp`.
