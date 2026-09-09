---
type: CanvasModulate
category: 2D
status: unreviewed
fixture: unit-canvas-modulate.tscn
image: unit-canvas-modulate
group: Canvas effects
renders_as: a colour multiply applied to the whole canvas
---

# CanvasModulate

CanvasModulate tints every CanvasItem on its canvas by one `color`. The previewer
multiplies that colour onto each item it draws on the same canvas, wherever the node
sits in the tree.

## Linting

<!-- lint:begin CanvasModulate -->
Strict parsing format-checks these `CanvasModulate` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `color` | Color(r, g, b, a) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

`color` falls back to opaque white `(1, 1, 1, 1)` when absent or malformed, with no
warning, since `parseColor` swallows its own parse failures.

## Known limitations

- **Approximated** A CanvasModulate inside an instanced sub-scene is not found, so its
  tint is not applied where Godot would apply it.
