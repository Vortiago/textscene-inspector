---
type: CheckBox
category: 2D
fixture: unit-checkbox.tscn
image: unit-checkbox
renders_as: an inline HTML row with a drawn check indicator
---

# CheckBox

A toggle button that shows a check indicator to the left of its label. The
previewer draws it in the Control overlay as an inline row: a small square
indicator followed by the label text.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Enable Sound"` / `"Disabled Option"` | the label drawn after each indicator |
| `button_pressed` | `true` / `false` | the top row shows a tick; the bottom row's box is empty |
| `disabled` | `true` | dims the "Disabled Option" row's label and box |

## Divergences

The indicator's fill. Godot draws the theme's icon textures — a bright, solid
square with a tick for the checked row, a gray solid square for the unchecked,
disabled one — while the previewer draws a thin outlined square with a Unicode
tick when checked and an empty outline when not. The cause is that the theme's
icons are textures the previewer has no access to, so the indicator is a drawn
approximation. The checked/unchecked distinction and the dimmed disabled row
read correctly in both, and the labels sit at the same place.
