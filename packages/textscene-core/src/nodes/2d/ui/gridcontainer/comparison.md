---
type: GridContainer
category: 2D
fixture: unit-grid-container.tscn
image: unit-grid-container
renders_as: children packed into a fixed column count
---

# GridContainer

GridContainer lays its children out left-to-right into a fixed number of
columns, wrapping to a new row each time the column count is reached. The
previewer solves the column widths and row heights the way Godot's own
`_notification` does, applies the separation constants between them, and packs
the rows to the top.

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

None visible in this fixture. The column geometry is exact: a scratch project
instantiating the fixture in a 1152x648 `SubViewport` and printing
`Control.get_rect()` puts every cell at `89 px` wide with the second column
opening at `x 97` (`col_minw[0]` 89 + `h_separation` 8), and the previewer's
own solve reports the same four rects. What remains between the two renders is
glyph-edge antialiasing — the standing MSDF-atlas residual the RichTextLabel
sheet has the mechanism for.

## Linting

<!-- lint:begin GridContainer -->
Strict parsing format-checks the inherited set (35 inherited from Control); `GridContainer` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`columns` goes through `parseOptionalInt`: absent or unparseable, it becomes
`undefined` with no warning, and the Component clamps that (and any zero or
negative value) up to `1`, so the grid falls back to a single column rather
than failing. `h_separation` / `v_separation` are collected generically as
`theme_override_constants` (`parseOptionalFloat`, same silent-`undefined`
contract); when either is missing the Component's own default of `4`px stands
in for the gap.
