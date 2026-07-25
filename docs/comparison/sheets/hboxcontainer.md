---
type: HBoxContainer
category: 2D
fixture: unit-hbox-container.tscn
image: unit-hbox-container
renders_as: a CSS flex-row `<div>`
---

# HBoxContainer

HBoxContainer stacks its children in a horizontal row. The previewer renders it
as a CSS flex-row `<div>`: `separation` becomes the flex `gap`, `alignment`
becomes `justify-content`, and each child's `size_flags` drive its grow and
cross-axis alignment. Here two Labels ("Left", "Right") each carry
`size_flags_horizontal = 3` (FILL|EXPAND), so each takes half the row.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` | `15` | the container fills the parent rect (the whole viewport) |
| `alignment` | `1` (CENTER) | main-axis packing — no visible effect here, since both children EXPAND and already fill the row |
| `theme_override_constants/separation` | `12` | 12px gap between the two labels, at the row's midpoint where their cells meet |
| `size_flags_horizontal` | `3` (FILL\|EXPAND) | on each Label — the two cells split the row's width evenly |

## Divergences

None visible in this fixture.
