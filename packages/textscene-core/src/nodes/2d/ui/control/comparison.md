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

Every widget in the stack now comes out of the same theme data on both sides.
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

**CLOSED — row pitch is 35 px, Godot's own, and every row now lands on Godot's
exact pixel.** It used to over-run at 38. A vertical transect down the indicator
column reads identically on both sides:

| Transect | Godot | Ours, before | Ours, now |
| --- | --- | --- | --- |
| indicator ink runs, col 12 | 8..21 / 43..56 / 78..91 / 113..126 | tops at 10 / 48 / 86 / 124 | 8..21 / 43..56 / 78..91 / 113..126 |
| the dropdown bar | y 140..170 (31 px) | y 152..185 (34 px) | y 140..170 (31 px) |

It was one arithmetic error, not a metric difference. `Button::get_minimum_size`
floors a row at `font->get_height(font_size)` plus the stylebox's content
margins, which for the default theme's Open Sans at 16 px is 23 + 8 = 31. The
shared text measurer (`native/text/measurer.ts` → `shapeText`) was left at
`lineSpacingPx` 3 — Label's OWN `line_spacing` theme constant — so every
non-Label widget asked for 26 + 8 = 34. `line_spacing` separates lines a Button
never stacks; the measurer now takes it from the caller and a single line never
carries a trailing gap.

**CLOSED — a non-white font colour draws at Godot's value.**
`control_font_color` is `Color(0.875, 0.875, 0.875)`, which Godot rasterises at
rgb(223, 223, 223). The OptionButton's label peaked at rgb(188, 188, 188) here,
and 188 is `255 × srgbToLinear(0.875)` to the pixel; it now peaks at
rgb(223, 223, 223), the same value, over a comparable count of pixels (263 in
Godot, 249 here across the same band).

The cause is worth keeping on record, because it is the reason this sheet was
the only one that could see it. `TextRun` linearises its tint before handing it
to `msdfMaterial`, whose fragment source assigned `gl_FragColor` with no
output-colour-space encode — every built-in three material ends with
`colorspace_fragment` (`linearToOutputTexel`); a hand-written shader gets one
only if it asks. So a linear value went straight into an sRGB target. White is
the fixed point of that curve, so every white-text check — including Label's
own sheet, whose theme colour really is white — matched perfectly while every
other colour was one transfer function too dark.

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
| `theme_override_colors/*` |
| `theme_override_constants/*` |
| `theme_override_font_sizes/*` |
| `theme_override_fonts/*` |
| `theme_override_styles/*` |
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
