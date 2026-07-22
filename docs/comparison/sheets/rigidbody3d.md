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
| `transform` | translate `(0, 1, 0)` | lifts the body one unit up; its child mesh rides along |
| `mass` | `2.0` | physics-only, no visual in a static preview |
| `gravity_scale` | `1.0` | physics-only here; drives the fall seen in Godot's reference (see below) |

## Divergences

- **The crate sits well below centre in Godot; ours holds it higher.** Same box,
  same salmon shading, same horizontal placement — Godot's crate is far lower in the
  frame and reads a touch smaller (a steeper downward view onto the dropped box).
  Cause: Godot's reference instantiates the scene and ticks a few frames before it
  shoots, and in those frames the RigidBody3D falls under gravity, dropping out of the
  authored `y = 1` spot. Our previewer is a static viewer with no physics loop
  (ADR-0005/0008), so it draws the body at rest where the scene places it. No
  PARITY-LIMITATIONS entry covers runtime simulation — the divergence is the reference
  moving, not a rendering gap.
