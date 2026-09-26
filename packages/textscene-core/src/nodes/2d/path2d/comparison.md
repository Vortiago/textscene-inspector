---
type: Path2D
category: 2D
status: unreviewed
fixture: unit-path2d.tscn
image: unit-path2d
visual: false
renders_as: nothing at runtime, a selection-gated curve gizmo
---

# Path2D

Path2D carries a `Curve2D` for children to follow. It has no runtime visual, and the
previewer draws the curve only as a selection-gated white polyline (ADR-0018), so a
plain capture is empty on both sides.

## Linting

<!-- lint:begin Path2D -->
Strict parsing format-checks these `Path2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `curve` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-path2d` | `path2d-missing-curve` | info |
|  | `curve2d-loadable` | error |
<!-- lint:end -->

The parser stores a malformed `curve` reference as-is, and it surfaces when the component
fails to resolve it. `curve2d-loadable` reports a Curve2D whose `_data` Godot refuses, which
loads with zero points.
