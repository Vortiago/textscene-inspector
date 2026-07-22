---
type: Control
category: 2D
fixture: unit-control-state.tscn
image: unit-control-state
renders_as: a full-rect layout region
---

# Control

The base Godot UI node. The previewer maps it to a positioned `<div>` that
establishes the containing block for its children; it draws no pixels of its
own. Everything visible in both images is the child stack — a `VBoxContainer`
of CheckBoxes, radio CheckBoxes, and an OptionButton — laid out inside the
root's full-viewport rect.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` / `anchor_right` / `anchor_bottom` | `15` / `1.0` / `1.0` | the root fills the viewport, so the row stack starts at the top-left corner |
| `visible` | `false` (HiddenDropdown, HiddenButton, HiddenGrid) | those children are drawn in neither image — the hidden state is faithful |
| `button_pressed` | `true` (CheckedBox, RadioOn) | the checked box shows a tick, the radio-on row a filled dot |
| `button_group` | `ButtonGroup_radio` (RadioOn, RadioOff) | the last two boxes render as radio indicators rather than square checks |

## Divergences

The OptionButton ("VISIBLE DROPDOWN"). Godot draws a dark neutral bar with a
right-edge dropdown chevron; the previewer draws a lighter slate-blue bar with
no chevron. The chevron is a theme icon the previewer has no access to, and the
bar tone is a drawn default rather than the theme's StyleBox.

The checkbox and radio indicators are drawn approximations — thin outlines with
a Unicode tick or a filled dot — where Godot draws solid theme icon textures.
See [CheckBox](checkbox.md) for the detail.

Row pitch differs: Godot's rows are ~35px tall, the previewer's ~26px, so the
whole stack reads ~30% shorter here. The cause is the theme's default
line-height and control minimum sizes versus the previewer's more compact
metrics.
