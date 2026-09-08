---
type: GridContainer
category: 2D
status: unreviewed
fixture: unit-grid-container.tscn
image: unit-grid-container
renders_as: a CSS grid container
---

# GridContainer

GridContainer lays its children into a fixed number of columns, wrapping to a new row.
The previewer maps it to a `display: grid` div, with `columns` as the column template
and the separation constants as the gaps.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`columns` goes through `parseOptionalInt`, so an absent or unparseable value becomes
`undefined` with no warning. The Component clamps that, and any value below `1`, up to
one column. A missing `h_separation` or `v_separation` takes the Component's default of
`4` px.
