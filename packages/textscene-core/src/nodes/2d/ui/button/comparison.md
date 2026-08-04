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
muted here (ours rgb(164,164,164) vs Godot rgb(142,142,142)) because the DOM overlay's
disabled font tint is a flat `opacity: 0.6` approximation rather than the default
theme's real disabled colour. **Closed by the native (WebGL) painter below**, which
reads the exact theme constant instead — see its own section.

## Native (WebGL canvas) painter

`nativeSolver.ts` registers `Button::get_minimum_size_for_text_and_icon`
(`controlSolverRegistry.registerMinimumSize`); `Component.tsx` draws the
chrome (a `StyleBoxQuad`, skipped when `flat`), the label (`<TextRun>`, centred/
aligned per `alignment`), and an optional icon (`<ControlQuad>`, honouring
`icon_alignment`/`vertical_icon_alignment`/`expand_icon`) — Button is the first
native *composite* painter, so the shared chrome-tint/content-layout math lives in
`r3f/controls/native/buttonBase.ts` for CheckBox/OptionButton (both `Button`
subclasses in Godot itself) to reuse rather than re-derive. Draw state is `disabled`
vs. everything else — no hover/pressed/focus, matching `Component.tsx` (the DOM
twin): this is a static viewer, not an interactive control.

### font_disabled_color: the real theme constant, not an approximation

`control_font_disabled_color = control_font_color * Color(1, 1, 1, 0.5)`
(`scene/theme/default_theme.cpp:106`, with `control_font_color = Color(0.875, 0.875,
0.875)` at `:101`), and Button's own `theme->set_color("font_disabled_color",
"Button", control_font_disabled_color)` (`:161`) — `nativeSolver.ts`'s
`BUTTON_DEFAULT_DISABLED_FONT_COLOR` reads exactly this: `{ r: 0.875, g: 0.875, b:
0.875, a: 0.5 }`, resolved through the same `theme_override_colors/font_disabled_color`
override key a scene can still author.

Measured against real Godot 4.6.3 — `pnpm ref:godot scenes/fixtures/unit-button.tscn
--mode 2d --probe 544,368` (a solid glyph-stroke pixel inside **Disabled**'s label) →
`rgb(142, 142, 142)`. That number is exactly `control_font_color` (0.875 → 223)
alpha-blended at 0.5 over the disabled StyleBox's own fill (rgb(61,61,61)): `223*0.5 +
61*0.5 = 142`. The native painter feeds `<TextRun>` the identical `{0.875, 0.875,
0.875, 0.5}` colour (tinted by `self_modulate`/ambient `modulate` like every other
draw call this painter makes, then converted sRGB→linear once inside `<TextRun>`
itself) — closing the row above exactly, rather than approximating it.

### Known, deliberate gap: StyleBox corner anti-aliasing

`styleBoxFlatGeometry.ts` (this painter's chrome, shared with every other native
StyleBox consumer — `panel/comparison.md` documents the identical gap for `Panel`)
implements Godot's non-anti-aliased branch, while Godot's own `StyleBoxFlat` defaults
`anti_aliased = true` with `aa_size = 1` (`scene/resources/style_box_flat.h:49,54`) —
so a rounded corner lacks the engine's 1px feather. Measured on **Styled**'s
top-left corner (`corner_radius = 6`) with `pnpm ref:godot
scenes/fixtures/unit-button.tscn --mode 2d --probe 519,307`: real Godot returns
`rgb(65, 99, 81)`, a blend between the green fill and the rgb(76,76,76) backdrop
straddling the nominal arc; our renderer draws a hard, unblended edge there instead.
If a corner-pixel probe on this fixture disagrees between the two images, this is
the cause — not anything Button's own slice gets wrong.

## Linting

<!-- lint:begin Button -->
Strict parsing format-checks the inherited set (33 inherited from Control); `Button` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Button's own fields, `text`, `disabled`, `flat`, `alignment`, `icon`,
`icon_alignment`, `vertical_icon_alignment`, `expand_icon`, have no strict
counterpart at all; only the inherited Control set is checked. `disabled`, `flat`,
and `expand_icon` parse with a bare `=== 'true'` check, so anything but the literal
string `"true"`, e.g. `"1"`, `"True"`, a typo, silently becomes `false`.
`alignment`, `icon_alignment`, and `vertical_icon_alignment` use `parseOptionalInt`:
a malformed value becomes `undefined` with no warning, leaving the button to fall
back to its own render default.
