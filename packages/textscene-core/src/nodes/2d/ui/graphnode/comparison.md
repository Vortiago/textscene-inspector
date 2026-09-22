---
type: GraphNode
category: 2D
status: unreviewed
fixture: unit-graph-node.tscn
# image: unit-graph-node
renders_as: a titled panel with slot rows and left/right port icons
---

# GraphNode

GraphNode is a titled container inside a GraphEdit whose children become slots with
input and output ports. The previewer draws its panel/titlebar StyleBoxes, the title
text, one left/right port icon per enabled slot side, each slot's own StyleBox when
`draw_stylebox` is set, and the resize handle when `resizable` is set.

## Linting

<!-- lint:begin GraphNode -->
Strict parsing format-checks these `GraphNode` properties, plus 6 inherited from GraphElement, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `ignore_invalid_connection_type` | true or false |  |
| `slot/*` | slot |  |
| `slots_focus_mode` | enum 1-3 (Click/All/Accessibility) | error |
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

The lenient parser reads `title`, `ignore_invalid_connection_type` and
`slots_focus_mode` the same way the strict one does. `slot/<index>/<leaf>` is
replayed in FILE ORDER, one leaf write at a time, exactly like
`GraphNode::_set` — an unparseable leaf value is dropped rather than applied, and
a slot authoring only `draw_stylebox = false` (every other leaf still at its
class default) is erased outright, matching `GraphNode::set_slot`'s own erase
condition.
