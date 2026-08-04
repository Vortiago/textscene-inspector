---
type: Button
category: 2D
fixture: unit-button.tscn
image: unit-button
renders_as: a StyleBox quad with a centred text run
---

# Button

Button is Godot's clickable text control. This is a static viewer, so it draws each
Button's NORMAL state only — the `normal` StyleBox (or the default-theme StyleBox
when none is set) as a quad on the canvas, with the label drawn over it. The fixture
stacks three centered buttons: an unthemed `Click Me`, a green `Styled` one with an
explicit StyleBox, and a `Disabled` one.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Click Me"` / `"Styled"` / `"Disabled"` | the label on each of the three buttons |
| `theme_override_styles/normal` | green `StyleBoxFlat` | replaces the default chrome on **Styled** — `bg_color = Color(0.2,0.5,0.35,1)` green fill, `corner_radius = 6` rounded corners, `content_margin 14/6` padding |
| `disabled` | `true` | switches **Disabled** to the lighter disabled StyleBox and mutes its label |
| `alignment` | `1` (CENTER) | centres the **Styled** label — Godot's Button default, so no visible change |

## Divergences

Measured on Godot 4.6.3, `pnpm ref:godot scenes/fixtures/unit-button.tscn --mode 2d
--probe <x,y>` against `pnpm ref:ours unit-button.tscn --2d --probe <x,y>`:

| Probe | What it is | Godot | Ours |
| --- | --- | --- | --- |
| (583, 370) | a solid stroke of the **Disabled** label | rgb(142, 142, 142) | rgb(125, 125, 125) |
| (544, 362) | the same stroke where Godot's glyph sits | rgb(142, 142, 142) | rgb(88, 88, 88) |
| (519, 308) | **Styled**'s top-left corner arc, one row into our rect | rgb(51, 128, 89) | rgb(64, 102, 83) |

Chrome colours are exact. The unthemed **Click Me** fill is the default theme's
charcoal on both sides (rgb(46, 46, 46) against rgb(45, 45, 45) — one step of
rounding on a StyleBox whose colour is itself an alpha blend over the backdrop),
**Styled** is pixel-exact rgb(51, 128, 89) green, and **Disabled** takes the lighter
rgb(61, 61, 61) disabled StyleBox on both. Both labels sit in the same place to
within a pixel: **Click Me**'s ink spans x 544..606, y 274..285 in Godot and
x 544..607, y 273..286 here.

**Two things still differ, and they are the same two on every widget sheet.**

The **disabled label's tint** is rgb(125, 125, 125) against Godot's
rgb(142, 142, 142). The colour fed to the draw is right — `font_disabled_color` is
`control_font_color × Color(1, 1, 1, 0.5)`, and Godot's 142 is exactly
`223 × 0.5 + 61 × 0.5` over the disabled fill. Ours is exactly `188 × 0.5 + 61 × 0.5`,
because the glyph run writes its linearised colour into an sRGB target: 188 is
`255 × srgbToLinear(0.875)`. The Control sheet has the mechanism.

**Every button is taller than Godot's.** All three carry authored offsets 32 px
apart, and Godot keeps that: **Click Me** spans y 264..295 and **Disabled**
y 352..383. Here both are 34 px, grown by the minimum size. **Styled** is the clean
reading, because its own StyleBox sets `content_margin_top/bottom = 6`: Godot's rect
is 35 px (12 + a 23 px font height), ours 38 (12 + 26). The 3 px is Label's
`line_spacing` default leaking into the shared text measurer — see the Control sheet,
which measures the same 3 px per row on a whole stack.

## Native (WebGL canvas) painter

`nativeSolver.ts` registers `Button::get_minimum_size_for_text_and_icon`
(`controlSolverRegistry.registerMinimumSize`); `Component.tsx` draws the
chrome (a `StyleBoxQuad`, skipped when `flat`), the label (`<TextRun>`, centred/
aligned per `alignment`), and an optional icon (`<ControlQuad>`, honouring
`icon_alignment`/`vertical_icon_alignment`/`expand_icon`) — Button is the first
native *composite* painter, so the shared chrome-tint/content-layout math lives in
`r3f/controls/native/buttonBase.ts` for CheckBox/OptionButton (both `Button`
subclasses in Godot itself) to reuse rather than re-derive. Draw state is `disabled`
vs. everything else — no hover/pressed/focus: this is a static viewer, not an
interactive control.

### font_disabled_color: the real theme constant, not an approximation

`control_font_disabled_color = control_font_color * Color(1, 1, 1, 0.5)`
(`scene/theme/default_theme.cpp:106`, with `control_font_color = Color(0.875, 0.875,
0.875)` at `:101`), and Button's own `theme->set_color("font_disabled_color",
"Button", control_font_disabled_color)` (`:161`) — `nativeSolver.ts`'s
`BUTTON_DEFAULT_DISABLED_FONT_COLOR` reads exactly this: `{ r: 0.875, g: 0.875, b:
0.875, a: 0.5 }`, resolved through the same `theme_override_colors/font_disabled_color`
override key a scene can still author.

Measured against real Godot 4.6.3 — `pnpm ref:godot scenes/fixtures/unit-button.tscn
--mode 2d --probe 583,370` (a solid glyph-stroke pixel inside **Disabled**'s label) →
`rgb(142, 142, 142)`. That number is exactly `control_font_color` (0.875 → 223)
alpha-blended at 0.5 over the disabled StyleBox's own fill (rgb(61, 61, 61)):
`223 × 0.5 + 61 × 0.5 = 142`. The native painter feeds `<TextRun>` the identical
`{0.875, 0.875, 0.875, 0.5}` colour, tinted by `self_modulate`/ambient `modulate`
like every other draw call this painter makes — so the ALPHA half of that number is
right, and the same probe on our side reads `rgb(125, 125, 125)`, which is the same
0.5 blend over the same fill with 188 in place of 223. What is left is the
sRGB-encode gap the Divergences section above measures, not the theme lookup.

### StyleBox corner anti-aliasing: present, but not Godot's

`styleBoxFlatGeometry.ts` (this painter's chrome, shared with every other native
StyleBox consumer — `panel/comparison.md` measures the same arc on a 40 px radius)
implements Godot's non-anti-aliased branch, while Godot's own `StyleBoxFlat` defaults
`anti_aliased = true` with `aa_size = 1` (`scene/resources/style_box_flat.h:49,54`).
The drawn arc is still soft, because the canvas is multisampled — measured on
**Styled**'s top-left corner (`corner_radius = 6`) one row inside our own rect,
`pnpm ref:godot scenes/fixtures/unit-button.tscn --mode 2d --probe 519,308` returns
`rgb(51, 128, 89)` (full fill) where `pnpm ref:ours unit-button.tscn --2d --probe
519,308` returns `rgb(64, 102, 83)`, a partial blend against the rgb(76, 76, 76)
backdrop. So the difference at a corner pixel is the WIDTH of the feather, not its
absence: Godot's ramp runs one pixel further out than the sampled polygon's does.

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
