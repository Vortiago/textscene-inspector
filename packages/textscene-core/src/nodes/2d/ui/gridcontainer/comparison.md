---
type: GridContainer
category: 2D
status: done
fixture: unit-grid-container.tscn
image: unit-grid-container
renders_as: children packed into a fixed column count
---

# GridContainer

GridContainer lays its children into a fixed number of columns and wraps to a new row.
Column widths and row heights come from the children's minimum sizes. A right-to-left
`layout_direction` starts each row at the opposite edge and fills it the other way, with
the same column widths and row heights.

## Linting

<!-- lint:begin GridContainer -->
Strict parsing format-checks these `GridContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `columns` | integer 1-1024 | error below, warning above |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`columns` goes through `parseOptionalInt`, so an absent or unparseable value becomes
`undefined` with no warning. The Component clamps that, and any value below `1`, up to
one column. A missing `h_separation` or `v_separation` takes the Component's default of
`4` px.
