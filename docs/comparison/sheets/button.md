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
