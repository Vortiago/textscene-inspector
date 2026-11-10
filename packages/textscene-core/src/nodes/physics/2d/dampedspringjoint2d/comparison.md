---
type: DampedSpringJoint2D
category: 2D
status: limitation
fixture: unit-damped-spring-joint-2d.tscn
# image: unit-damped-spring-joint-2d
visual: false
renders_as: a transform group with an editor marker for every node
---

# DampedSpringJoint2D

Connects two 2D physics bodies with a spring-like force. Godot draws the spring axis in the editor, and the previewer draws the same marker.

## Linting

<!-- lint:begin DampedSpringJoint2D -->
Strict parsing format-checks these `DampedSpringJoint2D` properties, plus 4 inherited from Joint2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `damping` | float 0.01-16 | warning |
| `length` | float 1-65535 | warning |
| `rest_length` | float 0-65535 | warning |
| `stiffness` | float 0.1-64 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser reads `length` on top of the Node2D transform. A non-numeric `length` warns and falls back to Godot's default, `50`. `rest_length`, `stiffness` and `damping` steer the simulation, so a malformed one never reaches `node.properties`. Only the raw text survives on `node.rawProperties`.

## Marker

Every node draws a 20 px bar at 0 and at `length` and the line between them, in `Color(0.7, 0.6, 0, 0.5)` and 3 px wide (`damped_spring_joint_2d.cpp:46-48`). A zero or negative `length` draws where it says, with no clamp. The marker draws while the Gizmos toggle is on, which a capture keeps off. The scene `unit-joint-2d-markers.tscn` holds the three joints' markers at several values.

## Known limitations

- **Editor only** The marker draws for every joint while the Gizmos toggle is on, which a capture keeps off.
- **Needs runtime** Only a running game pulls the two bodies toward `rest_length`, with `stiffness` and `damping`.
