---
type: Skeleton3D
category: 3D
fixture: unit-skeleton3d.tscn
image: unit-skeleton3d
renders_as: a transform-only group
---

# Skeleton3D

A Skeleton3D holds the bone hierarchy that deforms attached meshes. On its own it
has no runtime visual — the bones are an editor gizmo. The previewer reuses the
Node3D component (ADR-0008), so the node contributes only its transform; with no
bone-driven `MeshInstance3D` beneath it, it draws nothing.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `Transform3D(1,0,0, 0,1,0, 0,0,1, 0,2,0)` | positions the (empty) skeleton 2 units up — no visible mark |

## Divergences

None visible in this fixture.
