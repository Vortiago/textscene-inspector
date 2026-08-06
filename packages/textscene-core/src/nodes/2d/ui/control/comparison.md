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

None visible in this fixture. Every widget in the stack draws from the same theme
data on both sides, the row stack keeps the same 35 px pitch, and every label's
glyph rows land on Godot's own rows. Measured on Godot 4.6.3, `pnpm ref:godot
scenes/fixtures/unit-control-state.tscn --mode 2d --probe <x,y>` against `pnpm
ref:ours unit-control-state.tscn --2d --probe <x,y>`:

| Probe | What it is | Godot | Ours |
| --- | --- | --- | --- |
| (36, 15) | "CHECKED BOX"'s solid glyph stroke | rgb(255, 255, 255) | rgb(255, 255, 255) |
| (9, 151) | the `V` of "VISIBLE DROPDOWN", one row into its stem | rgb(223, 223, 223) | rgb(223, 223, 223) |

"CHECKED BOX"'s own ink spans y 10..21 at x = 36 on both sides, and the `V`
stem's ink spans y 150..155 at x = 9 on both, peaking at rgb(223, 223, 223).
The checked plate's icon rows are 8..21 on both.

**The chevron is drawn**, from the same icon and in the same place: its ink spans
x 1137..1146 and y 152..157 on both sides and peaks at rgb(158, 158, 158) against
rgb(157, 157, 157). The dropdown bar behind it spans rows 140..170 at x = 600 on
both sides.

**The checkbox and radio indicators are the real icon textures**, not outlines:
the checked plate reads rgb(210, 210, 210) and its tick rgb(26, 26, 26) at the
same pixels on both sides. See the CheckBox sheet.

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
