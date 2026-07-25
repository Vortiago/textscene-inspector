---
type: CollisionShape3D
category: 3D
fixture: unit-rigidbody3d.tscn
image: unit-rigidbody3d
renders_as: a toggle-gated collision wireframe
---

# CollisionShape3D

CollisionShape3D attaches a collision shape to a physics body and has no visible
form at runtime. Its wireframe draws only when "Visible Collision Shapes" is enabled
(ADR-0005 / ADR-0006), which is off in this capture, so the previewer draws nothing
for it here. The salmon cube on screen is the sibling `CrateMesh` (a MeshInstance3D)
under the same RigidBody3D.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `shape` | `BoxShape3D` (size 1×1×1) | the collision volume; drawn only as a gated wireframe box, so absent from this capture |

## Divergences

None visible in this fixture. The CollisionShape3D wireframe is toggle-gated and so
appears in neither capture, and the sibling crate sits at its authored pose, colour,
and shading identically on both sides.
