---
type: Button
category: 2D
fixture: unit-button.tscn
image: unit-button
renders_as: a positioned HTML div
---

# Button

Button is Godot's clickable text control. This is a static viewer, so it draws each
Button's NORMAL state as a positioned HTML `<div>` — background and border from the
`normal` StyleBox (or the default-theme StyleBox when none is set), with the label
centered. The fixture stacks three centered buttons: an unthemed `Click Me`, a green
`Styled` one with an explicit StyleBox, and a `Disabled` one.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Click Me"` / `"Styled"` / `"Disabled"` | the label on each of the three buttons |
| `theme_override_styles/normal` | green `StyleBoxFlat` | replaces the default chrome on **Styled** — `bg_color = Color(0.2,0.5,0.35,1)` green fill, `corner_radius = 6` rounded corners, `content_margin 14/6` padding |
| `disabled` | `true` | switches **Disabled** to the lighter disabled StyleBox and mutes its label |
| `alignment` | `1` (CENTER) | centres the **Styled** label — Godot's Button default, so no visible change |

## Divergences

The unthemed **Click Me** chrome now matches Godot's default theme exactly: a charcoal
fill rgb(46,46,46) sitting darker than the rgb(76,76,76) backdrop, white label
rgb(223,223,223), in both images. The **Styled** button is pixel-exact green
rgb(51,128,89). The **Disabled** button renders with Godot's lighter disabled fill in
both (Godot rgb(61,61,61), ours rgb(57,57,57)); its greyed label is marginally less
muted here (ours rgb(164,164,164) vs Godot rgb(142,142,142)) because the disabled font
tint is approximated rather than read from the default theme's disabled color.

## Linting

<!-- lint:begin Button -->
Strict parsing format-checks these `Button` properties, plus 10 inherited from BaseButton, 28 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) |
| `autowrap_trim_flags` | bit mask of BREAK_TRIM_INDENT (32) | BREAK_TRIM_START_EDGE_SPACES (64) | BREAK_TRIM_END_EDGE_SPACES (128) |
| `clip_text` | true or false |
| `expand_icon` | true or false |
| `flat` | true or false |
| `icon` | SubResource("id") or ExtResource("id") |
| `icon_alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) |
| `language` | quoted string |
| `text` | quoted string |
| `text_direction` | enum -1-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) |
| `text_overrun_behavior` | enum 0-6 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS/OVERRUN_TRIM_ELLIPSIS_FORCE/OVERRUN_TRIM_WORD_ELLIPSIS_FORCE) |
| `vertical_icon_alignment` | enum 0-3 (VERTICAL_ALIGNMENT_TOP/VERTICAL_ALIGNMENT_CENTER/VERTICAL_ALIGNMENT_BOTTOM/VERTICAL_ALIGNMENT_FILL) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

Button's own fields, `text`, `disabled`, `flat`, `alignment`, `icon`,
`icon_alignment`, `vertical_icon_alignment`, `expand_icon`, have no strict
counterpart at all; only the inherited Control set is checked. `disabled`, `flat`,
and `expand_icon` parse with a bare `=== 'true'` check, so anything but the literal
string `"true"`, e.g. `"1"`, `"True"`, a typo, silently becomes `false`.
`alignment`, `icon_alignment`, and `vertical_icon_alignment` use `parseOptionalInt`:
a malformed value becomes `undefined` with no warning, leaving the button to fall
back to its own render default.
