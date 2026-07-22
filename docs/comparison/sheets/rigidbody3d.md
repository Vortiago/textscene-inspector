---
type: RigidBody3D
category: 3D
fixture: unit-rigidbody3d.tscn
image: unit-rigidbody3d
renders_as: an invisible transform-only group
---

# RigidBody3D

RigidBody3D is a gravity-driven physics body. The previewer mounts it as a
transform-only Node3D group — it draws nothing itself and runs no simulation
(ADR-0005/0008), only positioning its children at the authored transform. The
reddish crate on screen is its child `MeshInstance3D` (a 1×1×1 `BoxMesh` under a
salmon `StandardMaterial3D`); the `CollisionShape3D` is a toggle-gated overlay
(ADR-0006) and stays hidden. Both frames carry the grey-sky-over-brown-ground
preview environment.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | translate `(0, 1, 0)` | lifts the body one unit up; its child mesh rides along and floats above centre |
| `mass` | `2.0` | physics-only, no visual in a static preview |
| `gravity_scale` | `1.0` | physics-only; nothing falls because neither side simulates |

## Divergences

None visible in this fixture.
