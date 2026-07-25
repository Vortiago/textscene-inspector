---
type: Marker2D
category: 2D
fixture: unit-marker2d.tscn
image: unit-marker2d
visual: false
renders_as: a selection-gated cross gizmo
---

# Marker2D

Marker2D is a Node2D transform anchor that positions its children and draws a
small blue "+" cross at its origin. That cross is an editor decoration, so the
previewer selection-gates it (ADR-0018) — it appears only while the node is
selected. Godot's game render never draws the marker gizmo either, so in this
plain, nothing-selected capture both sides show an empty frame.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(120, 80)`, `(-140, -60)`, `(0, 160)` | moves each anchor and its gated cross; nothing visible unselected |
| `gizmo_extents` | `40.0` (BigMarker), `24.0` (RotatedMarker) | the cross arm length; only sizes the gated gizmo |
| `rotation` | `0.6` (RotatedMarker) | tilts the anchor and its gated cross |

## Divergences

None visible in this fixture.
