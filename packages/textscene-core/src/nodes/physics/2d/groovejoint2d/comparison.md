---
type: GrooveJoint2D
category: 2D
status: limitation
fixture: unit-groove-joint-2d.tscn
# image: unit-groove-joint-2d
visual: false
renders_as: a transform group with an editor marker for every node
---

# GrooveJoint2D

Restricts body B to sliding along a fixed axis from the joint's origin. Godot draws the groove and its offset in the editor, and the previewer draws the same marker.

## Linting

<!-- lint:begin GrooveJoint2D -->
Strict parsing format-checks these `GrooveJoint2D` properties, plus 4 inherited from Joint2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `initial_offset` | float 1-65535 | warning |
| `length` | float 1-65535 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser reads `length` and `initial_offset` on top of the Node2D transform. A non-numeric value warns and falls back to Godot's default, `50` and `25`. A value outside the inspector hint, such as `length = 70000`, draws where it says.

## Marker

Every node draws a 20 px bar at 0 and at `length` and the line between them, in `Color(0.7, 0.6, 0, 0.5)` and 3 px wide. A 20 px bar at `initial_offset` follows, in `Color(0.8, 0.8, 0.9, 0.5)` and 5 px wide (`groove_joint_2d.cpp:46-49`). A zero or negative `length` and `initial_offset` draw where they say, with no clamp. The scene `unit-joint-2d-markers.tscn` holds the three joints' markers at several values.

## Known limitations

- **Editor only** The marker draws for every joint while the Gizmos toggle is on, which a capture keeps off.
- **Needs runtime** Only a running game holds the second body in the groove.
