---
type: Marker2D
category: 2D
status: unreviewed
fixture: unit-marker2d.tscn
image: unit-marker2d
visual: false
renders_as: a selection-gated cross gizmo
---

# Marker2D

Marker2D is a transform anchor that draws a small cross at its origin in the editor. The
previewer selection-gates that cross (ADR-0018), so a plain capture shows nothing, as
Godot's game render does.

## Linting

<!-- lint:begin Marker2D -->
Strict parsing format-checks these `Marker2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `gizmo_extents` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

Strict rejects a non-numeric `gizmo_extents`. The lenient parser warns and falls back to
`10`, Godot's default arm length.
