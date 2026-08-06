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
| (583, 370) | a solid stroke of the **Disabled** label | rgb(142, 142, 142) | rgb(142, 142, 142) |
| (544, 362) | the same stroke where Godot's glyph sits, a residual sub-pixel gap | rgb(142, 142, 142) | rgb(138, 138, 138) |
| (519, 308) | **Styled**'s top-left corner arc, one row into our rect | rgb(51, 128, 89) | rgb(64, 100, 82) — see "StyleBox corner anti-aliasing" below: entangled with the "Styled sits one row low" offset at this exact probe |

Chrome colours are exact. The unthemed **Click Me** fill is the default theme's
charcoal on both sides (rgb(46, 46, 46) against rgb(45, 45, 45) — one step of
rounding on a StyleBox whose colour is itself an alpha blend over the backdrop),
**Styled** is pixel-exact rgb(51, 128, 89) green, and **Disabled** takes the lighter
rgb(61, 61, 61) disabled StyleBox on both. Both labels sit in the same place to
within a pixel: **Click Me**'s ink spans x 544..606, y 274..285 in Godot and
x 544..607, y 273..286 here.

`font_disabled_color` is `control_font_color × Color(1, 1, 1, 0.5)`, and Godot's
142 at (583, 370) is exactly `223 × 0.5 + 61 × 0.5` over the disabled fill —
matched on both sides.

All three buttons carry authored offsets 32 px apart, and both engines keep
that: **Click Me** spans y 264..295 and **Disabled** y 352..383, identically.
**Styled**'s own StyleBox sets `content_margin_top/bottom = 6`: Godot's rect is
35 px (12 + a 23 px font height), and ours is 35 too.

**Styled sits one row low**: y 308..342 here against Godot's y 307..341. The height
is right and the other two buttons are on Godot's exact rows, so this is a
placement term specific to a button carrying its own StyleBox content margins, not
the minimum size.

A glyph's edge pixel still parts by a residual sub-pixel: probe (544, 362), a
stroke where Godot's glyph sits, reads rgb(138, 138, 138) against Godot's
rgb(142, 142, 142), while (583, 370), a solid interior stroke, matches exactly
on both sides. The **Disabled** label's last glyph stem sits at x 606 in Godot
and x 607 here — a steady 1 px residual. The RichTextLabel sheet has the
mechanism (`openSansMetrics.ts`'s continuous per-glyph `advanceWidths` as the
shaping source).

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

### font_disabled_color

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
like every other draw call this painter makes, and the same probe reads
`rgb(142, 142, 142)` on both sides.

### StyleBox corner anti-aliasing

`styleBoxFlatGeometry.ts` (this painter's chrome, shared with every other native
StyleBox consumer — `panel/comparison.md` measures the same arc on a 40 px radius)
builds the same AA feather rings `StyleBoxFlat::draw` does
(`scene/resources/style_box_flat.cpp:511-630`), driven by `StyleBoxFlatData`'s
`anti_aliased`/`aa_size` fields (defaults `true`/`1`,
`scene/resources/style_box_flat.h:49,54`).

**Styled**'s own StyleBox draws no border, so this is the fill-only AA branch — the
whole rect's boundary gets a `aa_size / 2` = 0.5 px feather. On the straight top
edge, away from the corner arc, `--probe 576,308` reads `rgb(51, 128, 89)` on both
sides — pixel-exact.

The corner probe (`--probe 519,308`, top-left arc, `corner_radius = 6`) reads
Godot `rgb(51, 128, 89)` against ours `rgb(64, 100, 82)` — this probe sits exactly
on the row where **Styled sits one row low** (above) puts our rect's top edge one
row below Godot's, so Godot's rect already reads full fill a row earlier than ours
at this x. Sampling one row further down the same arc, `--probe 519,309`, is
pixel-exact on both sides (`rgb(51, 128, 89)`); `--probe 520,308` (one column
right, same row) closes most of the way too — `rgb(55, 118, 87)` against Godot's
`rgb(51, 128, 89)`. So the AA ring itself is doing its job on this arc; what is
left at the original probe is the pre-existing row offset compounding with it,
not a remaining AA gap.

## Linting

<!-- lint:begin Button -->
Strict parsing format-checks the inherited set (35 inherited from Control); `Button` declares none of its own. Every validator failure is an **error**.

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
