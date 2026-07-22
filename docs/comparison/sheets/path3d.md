---
type: Path3D
category: 3D
fixture: unit-pathfollow-3d.tscn
image: unit-pathfollow-3d
renders_as: a selection-gated curve gizmo
---

# Path3D

`Path3D` holds a `Curve3D` and hands it to its descendants so a `PathFollow3D`
child can ride it. Its only visual is the white curve polyline, a
selection-gated editor gizmo (ADR-0018); in a plain capture it draws nothing,
exactly as Godot draws no path line while running. Every cube on screen belongs
to the child meshes, not to the path.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `curve` | `Curve3D`, points `(0,0,0) → (3,0,0) → (3,0,3)` | defines the L-shaped path; the polyline is a selection-gated gizmo, so nothing is drawn for it here; supplies the curve the `PathFollow3D` child samples |

## Divergences

The follower cube — the 0.6 box under the `PathFollow3D` child — lands in a
different place in each image. In Godot it stays at the curve's start (the
origin), enclosing the small `OriginRef` box, so a single 0.6 cube reads at
frame centre. In this previewer the follower advances to `progress_ratio = 0.5`
(the curve midpoint at `(3,0,0)`), so it moves off to the right edge and the 0.3
`OriginRef` box is left visible at centre. Cause: Godot applies `progress_ratio`
only once the node is parented to a `Path3D` with a baked curve — set during
scene instantiation it is a no-op and progress stays 0 — whereas the previewer
resolves the curve statically and honours the ratio. The `Path3D` curve line
itself is absent from both frames: a match, not a divergence.
