---
type: GraphFrame
category: 2D
status: unreviewed
fixture: unit-graph-frame.tscn
# image: unit-graph-frame
renders_as: a titled frame around its own content rect
---

# GraphFrame

GraphFrame is a GraphElement that groups and auto-resizes around other elements inside a
GraphEdit. The previewer draws its panel/titlebar StyleBoxes (tint-substituted when
`tint_color_enabled`), the title text, and the resize handle when `resizable` and NOT
`autoshrink_enabled`. It draws the frame at its own authored `size`/`position_offset` —
the same rect a freshly loaded scene actually shows, since `attach_graph_element_to_frame`
is a runtime call with no `.tscn` surface at all, so no attached-node auto-resize ever
runs before a script calls it.

## Linting

<!-- lint:begin GraphFrame -->
Strict parsing format-checks these `GraphFrame` properties, plus 6 inherited from GraphElement, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autoshrink_enabled` | true or false |  |
| `autoshrink_margin` | integer 0-128 | warning |
| `drag_margin` | integer 0-128 | warning |
| `tint_color` | Color(r, g, b, a) |  |
| `tint_color_enabled` | true or false |  |
| `title` | quoted string, or the &"…" StringName jacket |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-graph-element-selection` (type-family match) | `graph-element-selected-not-selectable` | error |
<!-- lint:end -->

The lenient parser reads `title`, `autoshrink_enabled`, `autoshrink_margin`,
`drag_margin`, `tint_color_enabled` and `tint_color` the same way the strict one
does — an out-of-range `autoshrink_margin`/`drag_margin` still applies as parsed
(both are warnings, not errors, in the linter), and a malformed `tint_color`
resolves to `undefined`, falling back to `Color(0.3, 0.3, 0.3, 0.75)` at draw
time.
