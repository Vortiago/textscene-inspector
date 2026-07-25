---
type: StaticBody3D
category: 3D
fixture: unit-physics-bodies.tscn
image: unit-physics-bodies
renders_as: a transform-only group
---

# StaticBody3D

StaticBody3D is a non-moving physics body with no runtime visual of its own. The
previewer mounts it as a transform-only Node3D group (ADR-0005), so it draws
nothing directly — but it is the parent of the blue slab both images show: its
child `GroundMesh` (a MeshInstance3D with a flat 2×0.4×2 BoxMesh and a blue
`albedo_color`). Its other child, `GroundCollision`, is a toggle-gated collision
overlay (ADR-0005/0006) and stays hidden in a plain capture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| (none) | — | the `Ground` StaticBody3D sets no properties; the visible box is its child MeshInstance3D |

## Divergences

None visible in this fixture.
