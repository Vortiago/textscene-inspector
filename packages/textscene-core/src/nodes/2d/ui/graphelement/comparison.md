---
type: GraphElement
category: 2D
status: unimplemented
fixture: unit-graph-element.tscn
# image: unit-graph-element
renders_as: invisible transform-only fallback
---

# GraphElement

GraphElement is Godot's abstract base for a Control that can be placed inside
a `GraphEdit` graph and dragged, resized, and selected there — the shared
plumbing behind `GraphNode` and `GraphFrame`. It is a Control (ADR-0003 routes
Controls through the 2D DOM overlay, not the WebGL scene), so the previewer
parses and validates every member below but does not draw it: it renders as
an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position_offset` | `Vector2(120, 40)` | the element's offset relative to the `GraphEdit` scroll position |
| `resizable` | `true` | the user can drag a resize handle on the element |
| `draggable` | `true` | the user can drag the element to reposition it |
| `selectable` | `true` | the user can select the element |
| `selected` | `false` | whether the element is currently selected |
| `scaling_menus` | `true` | descendant `PopupMenu`s scale with the `GraphEdit` zoom |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

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

All 6 of GraphElement's own members format-check as a plain `Vector2` or boolean
literal — `scene/gui/graph_element.cpp`'s `ADD_PROPERTY` list carries no
`PROPERTY_HINT_RANGE` or other bound on any of them. A `selected = true`
authored alongside `selectable = false` is legal Godot at parse time, but
`GraphElement::set_selectable(false)` always forces the element back to
deselected regardless of load order, so `linter.ts` reports that combination
as an advisory warning rather than the strict parser rejecting it as an error.
