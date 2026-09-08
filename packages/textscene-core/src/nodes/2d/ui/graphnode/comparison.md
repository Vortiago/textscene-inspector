---
type: GraphNode
category: 2D
status: unimplemented
fixture: unit-graph-node.tscn
# image: unit-graph-node
renders_as: invisible transform-only fallback
---

# GraphNode

GraphNode is a titled container inside a GraphEdit whose children become slots with
input and output ports. The previewer parses and validates it but does not draw it, so
it renders as a transform-only fallback and its children still show.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-graph-element-selection` (type-family match) | `graph-element-selected-not-selectable` | error |
<!-- lint:end -->

GraphNode registers `parseControl` directly, which never reads `title`,
`ignore_invalid_connection_type`, `slots_focus_mode` or any `slot/<index>/<leaf>` key. A
malformed value rides along untyped in the raw property bag.

## Known limitations

- **Not drawn** Godot draws the title bar, the slots and their ports. The previewer
  draws nothing for this node.
