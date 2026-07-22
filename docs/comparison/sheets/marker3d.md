---
type: Marker3D
category: 3D
fixture: unit-marker-3d.tscn
image: unit-marker-3d
renders_as: a selection-gated axis-cross gizmo
---

# Marker3D

A Node3D transform anchor that positions its children and draws a 3-axis editor
cross at its origin. That cross is selection-gated (ADR-0018), so a plain capture
shows nothing for it — and Godot's own editor gizmo does not render in the game,
so both images are just the empty preview sky and ground.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | position `(0, 1, 0)`, identity basis | anchors the marker one unit up; no visible geometry, and it has no children to place |

## Divergences

None visible in this fixture.
