---
type: GraphNode
category: 2D
status: unimplemented
fixture: unit-graph-node.tscn
# image: unit-graph-node
renders_as: invisible transform-only fallback
---

# GraphNode

GraphNode is Godot's `GraphEdit` node: a titled `Container` whose children each become a numbered "slot" that can carry a left (input) and/or right (output) connection port. It is a Control (ADR-0003 routes Controls through the 2D DOM overlay, not the WebGL scene), so the previewer parses and validates every member below but does not draw it: it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `title` | `"Add"` | the text shown in the node's title bar |
| `ignore_invalid_connection_type` | `true` | ports of different types may connect even without the parent `GraphEdit` explicitly allowing it |
| `slots_focus_mode` | `2` (All) | connection slots can be focused with `ui_up`/`ui_down`, not only clicked |
| `slot/0/left_enabled`, `/left_type`, `/left_color`, `/left_icon`, `/right_enabled`, `/draw_stylebox` | `true`, `0`, `Color(1, 1, 1, 1)`, `null`, `false`, `true` | slot 0 has an input port only, default type and tint, no custom icon |
| `slot/1/right_enabled`, `/right_type`, `/right_color`, `/left_enabled` | `true`, `1`, `Color(0.4, 0.7, 1, 1)`, `false` | slot 1 has an output port only, with a distinct connection type and tint |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin GraphNode -->
Strict parsing format-checks these `GraphNode` properties, plus 6 inherited from GraphElement, 27 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `ignore_invalid_connection_type` | true or false |
| `slot/*` | slot/<index>/<leaf> (see graph_node.cpp _get_property_list/_set/_get) |
| `slots_focus_mode` | enum 1-3 (Click/All/Accessibility) |
| `title` | quoted string |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-graph-element-selection` (type-family match) | `graph-element-selected-not-selectable` | warning |
<!-- lint:end -->

GraphNode registers `parseControl` directly (`index.ts`), the same base parser
GraphElement uses, which reads only Control/CanvasItem-level fields (layout,
modulate, theme overrides). It never reads `title`, `ignore_invalid_connection_type`,
`slots_focus_mode`, or any `slot/<index>/<leaf>` key, so a malformed value like
`title = Unquoted` or `slots_focus_mode = "nope"` is silently dropped rather than
substituted or warned on: it rides along untyped in the raw property bag, and the
node keeps rendering as the same invisible transform-only fallback either way.
