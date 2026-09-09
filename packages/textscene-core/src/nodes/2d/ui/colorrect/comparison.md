---
type: ColorRect
category: 2D
status: unreviewed
fixture: unit-color-rect.tscn
image: unit-color-rect
renders_as: a flat-filled quad
---

# ColorRect

ColorRect fills its rect with one flat `color`. The previewer draws a positioned `<div>`
with that colour as its background, alpha included.

## Linting

<!-- lint:begin ColorRect -->
Strict parsing format-checks these `ColorRect` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `color` | Color(r, g, b, a) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`color` gets a format-only check, since `set_color` assigns any value unclamped and a
component outside 0 to 1 is legal HDR. The render parser keeps the raw string verbatim,
so even a malformed literal reaches the renderer, and only an absent or empty value
falls back to `Color(1, 1, 1, 1)`.
