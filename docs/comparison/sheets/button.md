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
`normal` StyleBox (or a synthesized default when none is set), the label centered.
The fixture stacks three centered buttons: an unthemed `Click Me`, a green `Styled`
one with an explicit StyleBox, and a `disabled` one.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Click Me"` / `"Styled"` / `"Disabled"` | the label on each of the three buttons |
| `theme_override_styles/normal` | green `StyleBoxFlat` | replaces the default chrome on **Styled** — `bg_color = Color(0.2,0.5,0.35,1)` green fill, `corner_radius = 6` rounded corners, `content_margin 14/6` padding |
| `disabled` | `true` | dims the **Disabled** button and mutes its label |
| `alignment` | `1` (CENTER) | centres the **Styled** label — Godot's Button default, so no visible change |

## Divergences

The two **unthemed** buttons diverge in their background chrome. Godot draws its
built-in default-theme StyleBox as a neutral charcoal that sits *darker* than the
backdrop (`Click Me` rgb(46,46,46), `Disabled` rgb(61,61,61) against a rgb(76,76,76)
ground). This previewer synthesizes its own default chrome instead — a lighter,
blue-tinted slate (`Click Me` rgb(70,78,93), `Disabled` rgb(71,76,85)); at that
luminance the `Click Me` chip nearly matches the backdrop and separates only by its
blue tint, so it reads as a faint rectangle rather than a solid dark button. Disabled
buttons are dimmed via opacity here rather than Godot's distinct disabled style. The
**Styled** button, which supplies an explicit `StyleBoxFlat`, is pixel-exact — green
rgb(51,128,89) in both. No PARITY-LIMITATIONS entry covers the default-theme chrome.
