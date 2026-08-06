---
type: Control
category: 2D
fixture: unit-control-state.tscn
image: unit-control-state
renders_as: a full-rect layout region
---

# Control

The base Godot UI node. The previewer solves it into a rect and draws no pixels
of its own; that rect is what its children anchor against. Everything visible in
both images is the child stack — a `VBoxContainer` holding two CheckBoxes, two
radio CheckBoxes, and an OptionButton — laid out inside the root's full-viewport
rect.

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

Every widget in the stack draws from the same theme data on both sides.
Measured on Godot 4.6.3, `pnpm ref:godot scenes/fixtures/unit-control-state.tscn
--mode 2d --probe <x,y>` against `pnpm ref:ours unit-control-state.tscn --2d
--probe <x,y>`:

| Probe | What it is | Godot | Ours |
| --- | --- | --- | --- |
| (1138, 153) | the dropdown chevron's ink where Godot draws it | rgb(158, 158, 158) | rgb(45, 45, 45) |
| (1138, 167) | the same chevron 14 px lower, where ours draws it | rgb(46, 46, 46) | rgb(157, 157, 157) |
| (600, 145) | inside Godot's dropdown bar | rgb(46, 46, 46) | rgb(76, 76, 76) |
| (600, 180) | below Godot's bar, still inside ours | rgb(76, 76, 76) | rgb(45, 45, 45) |
| (16, 150) | a stroke of the "VISIBLE DROPDOWN" label | rgb(223, 223, 223) | rgb(76, 76, 76) |

**The chevron is drawn**, from the same icon: the ink covers 10x6 px on both
sides and peaks within 1/255 of Godot. It sits 14 px lower only because each of
the four rows above it is 3 px taller here.

**The checkbox and radio indicators are the real icon textures**, not outlines:
the checked plate reads rgb(210, 210, 210) and its tick rgb(26, 26, 26) on both
sides. See the CheckBox sheet.

## Linting

<!-- lint:begin Control -->
Strict parsing format-checks these `Control` properties. Every validator failure is an **error**.

| Property |
| --- |
| `anchor_bottom` |
| `anchor_left` |
| `anchor_right` |
| `anchor_top` |
| `anchors_preset` |
| `custom_minimum_size` |
| `grow_horizontal` |
| `grow_vertical` |
| `layout_mode` |
| `light_mask` |
| `modulate` |
| `offset_bottom` |
| `offset_left` |
| `offset_right` |
| `offset_top` |
| `pivot_offset` |
| `pivot_offset_ratio` |
| `rotation` |
| `scale` |
| `self_modulate` |
| `show_behind_parent` |
| `size_flags_horizontal` |
| `size_flags_stretch_ratio` |
| `size_flags_vertical` |
| `texture_filter` |
| `texture_repeat` |
| `theme` |
| `theme_override_colors/*` |
| `theme_override_constants/*` |
| `theme_override_font_sizes/*` |
| `theme_override_fonts/*` |
| `theme_override_styles/*` |
| `theme_type_variation` |
| `visible` |
| `z_index` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Most layout/theme properties strict validates here run through the `parseOptional*`
family: an absent or malformed `anchor_left`, `offset_top`, `rotation`, `scale`,
`pivot_offset(_ratio)`, `custom_minimum_size`, or `size_flags_*` silently becomes
`undefined` with no warning logged, and the renderer falls back to its own default
in place of the value strict would reject. `modulate`/`self_modulate` follow the
same undefined-silently contract but through a different reader,
`parseColorOrUndefined`, not `parseOptional*`.
`theme_override_styles/*` skips parsing entirely, so whatever string is present is
stored as-is, even one `resourceReference` would flag as broken. `visible` isn't
`boolOr` either: any value other than the literal string `"false"` (typos included)
parses as `true`, again with no warning.

## Known limitations

- **rotation / scale inside a Container** — a Control inside any Container renders unrotated and unscaled whatever the scene says, matching Godot (`fit_child_in_rect` ends by resetting rotation and scale).
