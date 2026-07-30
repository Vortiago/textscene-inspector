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
"VISIBLE DROPDOWN" bar; the previewer draws none. The chevron is a default-theme
icon, compiled into the engine rather than shipped as a resource file. A
scene-authored `theme_override_icons/<name>` is a separate case: `parseThemeOverrides`
drops it through its `default` branch, but it would resolve the way
`theme_override_styles` already does. The bar tone itself now matches — both draw a
dark neutral StyleBox.

The checkbox and radio indicators are drawn approximations: the previewer draws
thin outlines with a light tick or a filled dot, where Godot draws solid theme
icon textures (a light filled square with a dark tick, a dark filled square, a
ringed radio, a dark filled circle). Both distinguish the checked/unchecked and
on/off states correctly. See the CheckBox sheet for the detail.

Row pitch differs: Godot's rows are ~35px tall, the previewer's ~26px, so the
whole stack reads shorter here. The cause is the default theme's larger control
minimum sizes versus the previewer's more compact metrics.

## Linting

<!-- lint:begin Control -->
Strict parsing format-checks these `Control` properties. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `anchor_bottom` | float |
| `anchor_left` | float |
| `anchor_right` | float |
| `anchor_top` | float |
| `anchors_preset` | integer -1-15 |
| `custom_minimum_size` | Vector2(x, y) |
| `grow_horizontal` | integer 0-2 |
| `grow_vertical` | integer 0-2 |
| `layout_mode` | integer 0-3 |
| `modulate` | Color(r, g, b, a) |
| `offset_bottom` | float |
| `offset_left` | float |
| `offset_right` | float |
| `offset_top` | float |
| `pivot_offset` | Vector2(x, y) |
| `pivot_offset_ratio` | Vector2(x, y) |
| `rotation` | float |
| `scale` | Vector2(x, y) |
| `self_modulate` | Color(r, g, b, a) |
| `size_flags_horizontal` | integer >= 0 |
| `size_flags_stretch_ratio` | float >= 0 |
| `size_flags_vertical` | integer >= 0 |
| `theme_override_colors/*` | Color(r, g, b, a) |
| `theme_override_constants/*` | integer -16384-16384 |
| `theme_override_font_sizes/*` | integer >= 1 |
| `theme_override_fonts/*` | SubResource("id") or ExtResource("id") |
| `theme_override_icons/*` | SubResource("id") or ExtResource("id") |
| `theme_override_styles/*` | SubResource("id") or ExtResource("id") |
| `visible` | true or false |

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
