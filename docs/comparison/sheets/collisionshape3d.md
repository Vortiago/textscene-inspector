---
type: CollisionShape3D
category: 3D
fixture: unit-rigidbody3d.tscn
image: unit-rigidbody3d
renders_as: a toggle-gated collision wireframe
---

# CollisionShape3D

CollisionShape3D attaches a collision shape to a physics body and has no runtime
Collision Shapes" is enabled (ADR-0005 / ADR-0006), off by default. So this plain
capture draws nothing for it — the salmon cube on screen is the sibling
`CrateMesh` (a MeshInstance3D) under the same RigidBody3D.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `shape` | `BoxShape3D` (size 1×1×1) | the collision volume; drawn only as a gated wireframe box, so absent from this capture |

## Divergences

CollisionShape3D draws nothing in either image, so it has no output of its own to
differ. The one visible difference is the sibling cube (the MeshInstance3D): our
frame places it higher and larger than Godot's, while its colour, shading, and the
sky, horizon and ground all match to within a few values. The gap is where the
cube sits in the frame, not how it is rendered.
