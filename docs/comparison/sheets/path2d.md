---
type: Path2D
category: 2D
fixture: unit-path2d.tscn
image: unit-path2d
renders_as: nothing at runtime; a selection-gated curve gizmo
---

# Path2D

A Node2D that carries a `Curve2D` for children to follow. It has no runtime visual
of its own: the previewer draws the curve as a selection-gated white polyline gizmo
(ADR-0018), shown only while the node is selected, mirroring Godot's 2D editor path
line. In a plain capture nothing is selected, so both images are an empty grey field.
The `PathFollow2D` child is a transform-only relay with no geometry, so it draws
nothing either.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(420, 280)` | where the path origin sits; nothing is drawn there |
| `curve` | `SubResource("Curve2D_arc")` | the followed path; drawn only as a selection-gated gizmo, so invisible here |
| `Follower.progress_ratio` | `0.5` | places the follower halfway along the curve; transform-only, no visual |

## Divergences

None visible in this fixture.
