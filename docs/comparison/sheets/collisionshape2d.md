---
type: CollisionShape2D
category: 2D
fixture: unit-collisionshape2d.tscn
image: unit-collisionshape2d
visual: false
renders_as: a toggle-gated collision outline
---

# CollisionShape2D

CollisionShape2D attaches a 2D collision shape to a physics body. It has no
runtime visual — its outline is a debug gizmo gated behind "Visible Collision
Shapes" (off by default, ADR-0005/0006), so a plain capture draws nothing.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `shape` | `RectangleShape2D` (40×60), `CircleShape2D` (r=15), `CapsuleShape2D` (r=10, h=30) | outline geometry of the gated gizmo; not drawn in a plain capture |
| `disabled` | `false` | shape stays active; no visual effect in a game render |

## Divergences

None visible in this fixture.
