---
type: GridContainer
category: 2D
fixture: unit-grid-container.tscn
image: unit-grid-container
renders_as: a CSS grid container
---

# GridContainer

GridContainer lays its children out left-to-right into a fixed number of
columns, wrapping to a new row each time the column count is reached. The
previewer maps it to a `display: grid` div, so `columns` becomes the
column-template, the separation constants become the CSS gaps, and the rows
pack to the top.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `columns` | `2` | the four labels wrap into a 2-column grid — two per row |
| `theme_override_constants/h_separation` | `8` | horizontal gap between the two columns |
| `theme_override_constants/v_separation` | `12` | vertical gap between the two rows |
| `anchors_preset` | `15` | the container fills the parent Control (full rect) |
| `anchor_right` / `anchor_bottom` | `1.0` | it spans the full viewport width and height |
| child `Label.text` | `"Row N Col N"` | the four cells, filled row-major |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin GridContainer -->
Strict parsing format-checks these `GridContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `columns` | integer 1-1024 | error below, warning above |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`columns` goes through `parseOptionalInt`: absent or unparseable, it becomes
`undefined` with no warning, and the Component clamps that (and any zero or
negative value) up to `1`, so the grid falls back to a single column rather
than failing. `h_separation` / `v_separation` are collected generically as
`theme_override_constants` (`parseOptionalFloat`, same silent-`undefined`
contract); when either is missing the Component's own default of `4`px stands
in for the gap.
