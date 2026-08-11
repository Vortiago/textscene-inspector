---
type: ReferenceRect
category: 2D
status: unimplemented
fixture: unit-reference-rect.tscn
# image: unit-reference-rect
renders_as: invisible transform-only fallback
---

# ReferenceRect

Godot draws ReferenceRect as a plain colored border around its rect, purely as a design-time visual aid; the previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layout_mode` | `1` | anchored layout mode, inherited from Control |
| `offset_left` | `8.0` | left edge of the anchored rect, inherited from Control |
| `offset_top` | `8.0` | top edge of the anchored rect, inherited from Control |
| `offset_right` | `108.0` | right edge of the anchored rect, inherited from Control |
| `offset_bottom` | `40.0` | bottom edge of the anchored rect, inherited from Control |
| `border_color` | `Color(0, 1, 0, 1)` | the border's color |
| `border_width` | `2.0` | the border's thickness, grown both inwards and outwards |
| `editor_only` | `false` | forces the border to draw at runtime, not only in the editor |

## Divergences

Not captured yet, nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin ReferenceRect -->
Strict parsing format-checks these `ReferenceRect` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `border_color` | Color(r, g, b, a) |
| `border_width` | float >= 0 |
| `editor_only` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

The lenient parser makes no substitution here: border_color and editor_only carry
no bound at all in reference_rect.cpp, so any format-valid literal passes through
unchanged. border_width is the one case where the two parsers can diverge: Godot's
own setter clamps a negative width to 0.0 before it is ever drawn, but the lenient
parser stores whatever numeric literal it read, un-clamped.
