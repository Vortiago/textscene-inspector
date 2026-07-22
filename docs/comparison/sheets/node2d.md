---
type: Node2D
category: 2D
fixture: unit-area2d.tscn
image: unit-area2d
visual: false
renders_as: a transform-only THREE.Group
---

# Node2D

Node2D is the base of 2D transform objects — sprites, bodies, areas: a transform
(position/rotation/scale/skew and draw-order Z), no pixels of its own. The previewer
maps it to a `<group>` and draws its children inside. Here the fixture's root is a
bare Node2D, so the group is empty and the frame is blank.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `Area2D.position` | `Vector2(10, 20)` | offsets the area's subtree; the Area2D itself draws nothing at runtime |
| `CollisionShape2D.shape` | `CircleShape2D` (r=0.5) | a collision gizmo — editor/toggle-gated, absent from a plain capture |
| `ColorRect.color` | `Color(1, 0.4, 0.4, 1)` | would tint the rect, but no size is set so it lays out at 0×0 and nothing draws |

The root Node2D sets no properties of its own; every node in this scene is transform,
physics, or a zero-size Control, so both renders are the empty viewport.

## Divergences

None visible in this fixture.
