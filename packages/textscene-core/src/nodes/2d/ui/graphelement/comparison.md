---
type: GraphElement
category: 2D
status: unreviewed
fixture: unit-graph-element.tscn
# image: unit-graph-element
renders_as: an invisible container that fits its children into its own rect
---

# GraphElement

GraphElement is the abstract base for a Control placed inside a GraphEdit, behind
GraphNode and GraphFrame. It draws no chrome of its own, since `graph_element.cpp` has no
`NOTIFICATION_DRAW` case. But it is a Container: it fits every visible child into its
full rect.

## Linting

<!-- lint:begin GraphElement -->
Strict parsing format-checks these `GraphElement` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `draggable` | true or false |  |
| `position_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `resizable` | true or false |  |
| `scaling_menus` | true or false |  |
| `selectable` | true or false |  |
| `selected` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-graph-element-selection` (type-family match) | `graph-element-selected-not-selectable` | error |
<!-- lint:end -->

All of GraphElement's own members format-check as a plain `Vector2` or bool. The
lenient parser reads all of them. `position_offset`, `resizable`, `draggable`, `selectable`
and `scaling_menus` pass through as parsed. `selected` is forced to `false` whenever
`selectable = false`, because `GraphElement::set_selectable` calls `set_selected(false)`
unconditionally. This matches the render behaviour, not only the linter's
`graph-element-selected-not-selectable` warning above.
