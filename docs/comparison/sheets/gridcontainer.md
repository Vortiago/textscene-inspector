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
column-template and the separation constants become the CSS gaps.

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

The second row sits tight under the first in Godot (only the 12px v_separation
between them) but is pushed down to the vertical middle of the viewport in ours.
Godot's container sizes its rows to content and packs them at the top-left; our
grid div fills the full-rect viewport, and its implicit rows are `auto`, so
CSS `align-content` stretches them to split the height in two, dropping row 1 to
the centre. The horizontal layout, column count, and gaps match. No
PARITY-LIMITATIONS entry covers this.
