---
type: Path2D
category: 2D
fixture: unit-path2d.tscn
image: unit-path2d
visual: false
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

## Linting

<!-- lint:begin Path2D -->
Strict parsing format-checks these `Path2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `curve` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-path2d` | `path2d-missing-curve` | warning |
|  | `valid-path2d-resources` | error |
<!-- lint:end -->

Path2D carries a single property of its own, `curve`. The lenient parser only checks
that it is present (`if (properties.curve)`); it applies none of strict's
resource-reference format checking, so a malformed reference is stored as-is and
only surfaces as a problem when the component tries to resolve it.
