---
type: GraphElement
category: 2D
status: unimplemented
fixture: unit-graph-element.tscn
# image: unit-graph-element
renders_as: invisible transform-only fallback
---

# GraphElement

GraphElement is the abstract base for a Control placed inside a GraphEdit, behind
GraphNode and GraphFrame. The previewer parses and validates it but does not draw it, so
it renders as a transform-only fallback and its children still show.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-graph-element-selection` (type-family match) | `graph-element-selected-not-selectable` | error |
<!-- lint:end -->

All six of GraphElement's own members format-check as a plain `Vector2` or bool. The
lenient parser reuses `parseControl` and reads none of them. `linter.ts` warns on
`selected = true` beside `selectable = false`, since `set_selectable(false)` always
deselects the element.
