---
type: Control
category: 2D
fixture: unit-control-state.tscn
image: unit-control-state
renders_as: a full-rect layout region
---

# Control

The base Godot UI node. The previewer maps it to a positioned `<div>` that
establishes the containing block for its children and draws no pixels of its
own. Everything visible in both images is the child stack — a `VBoxContainer`
holding two CheckBoxes, two radio CheckBoxes, and an OptionButton — laid out
inside the root's full-viewport rect.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` / `anchor_right` / `anchor_bottom` | `15` / `1.0` / `1.0` | the root fills the viewport, so the row stack starts at the top-left corner |
| `button_pressed` | `true` (CheckedBox, RadioOn) | the checked box shows a tick, the radio-on row a filled dot |
| `button_group` | `ButtonGroup_radio` (RadioOn, RadioOff) | the last two boxes render as radio indicators rather than square checks |
| `text` | per row | the row labels ("CHECKED BOX", "RADIO ON", "VISIBLE DROPDOWN", …) |
| `selected` / `popup/item_0/text` | `0` / `"VISIBLE DROPDOWN"` | the OptionButton shows its selected item as a bar |
| `visible` | `false` (HiddenDropdown, HiddenButton, HiddenGrid) | those children are drawn in neither image — the hidden state is faithful |

## Divergences

The OptionButton chevron. Godot draws a right-edge dropdown chevron on the
"VISIBLE DROPDOWN" bar; the previewer draws none. The chevron is a theme icon
the previewer has no access to. The bar tone itself now matches — both draw a
dark neutral StyleBox.

The checkbox and radio indicators are drawn approximations: the previewer draws
thin outlines with a light tick or a filled dot, where Godot draws solid theme
icon textures (a light filled square with a dark tick, a dark filled square, a
ringed radio, a dark filled circle). Both distinguish the checked/unchecked and
on/off states correctly. See [CheckBox](checkbox.md) for the detail.

Row pitch differs: Godot's rows are ~35px tall, the previewer's ~26px, so the
whole stack reads shorter here. The cause is the default theme's larger control
minimum sizes versus the previewer's more compact metrics.
