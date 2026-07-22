---
type: Area3D
category: 3D
fixture: edge-area3d-inactive.tscn
image: edge-area3d-inactive
renders_as: an invisible transform-only group
---

# Area3D

Area3D is a physics region for detecting overlaps; it has no runtime visual of its
own. The previewer mounts it as a transform-only Node3D group, so it draws nothing.
Its child `CollisionShape3D` is a toggle-gated overlay (ADR-0005/0006) and stays
hidden in a plain capture. Both images show only the preview environment's
procedural sky — a grey-blue gradient fading to a brown ground below the horizon.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `monitoring` | `false` | physics-only flag, no visual |
| `monitorable` | `false` | physics-only flag, no visual |

## Divergences

None visible in this fixture.
