---
type: ReferenceRect
category: 2D
status: unimplemented
fixture: unit-reference-rect.tscn
# image: unit-reference-rect
renders_as: invisible transform-only fallback
---

# ReferenceRect

ReferenceRect draws a plain coloured border around its rect as a design-time aid. The
previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

## Linting

<!-- lint:begin ReferenceRect -->
Strict parsing format-checks these `ReferenceRect` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `border_color` | Color(r, g, b, a) |  |
| `border_width` | float >= 0 | error below |
| `editor_only` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`border_color` and `editor_only` carry no bound, so any format-valid literal passes both
parsers. `border_width` is the one divergence: Godot clamps a negative width to `0`,
while the lenient parser stores the literal unclamped.

## Known limitations

- **Not drawn** Godot draws the border at runtime when `editor_only` is off. The
  previewer draws nothing for this node.
