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
| (544, 362) | the same stroke where Godot's glyph sits — mostly closed, see below | rgb(142, 142, 142) | rgb(138, 138, 138) |
| (519, 308) | **Styled**'s top-left corner arc, one row into our rect | rgb(51, 128, 89) | rgb(64, 100, 82) — see "StyleBox corner anti-aliasing" below: closed on the straight edge and one row further down this same arc, entangled with the "sits one row low" offset at this exact probe |

Chrome colours are exact. The unthemed **Click Me** fill is the default theme's
charcoal on both sides (rgb(46, 46, 46) against rgb(45, 45, 45) — one step of
rounding on a StyleBox whose colour is itself an alpha blend over the backdrop),
**Styled** is pixel-exact rgb(51, 128, 89) green, and **Disabled** takes the lighter
rgb(61, 61, 61) disabled StyleBox on both. Both labels sit in the same place to
within a pixel: **Click Me**'s ink spans x 544..606, y 274..285 in Godot and
x 544..607, y 273..286 here.

**CLOSED — the disabled label's tint is Godot's.** It reads rgb(142, 142, 142) at
(583, 370) on both sides now, against rgb(125, 125, 125) before. The colour fed to
the draw was always right — `font_disabled_color` is
`control_font_color × Color(1, 1, 1, 0.5)`, and Godot's 142 is exactly
`223 × 0.5 + 61 × 0.5` over the disabled fill. Ours came out `188 × 0.5 + 61 × 0.5`
because the glyph run wrote its linearised colour into an sRGB target, and 188 is
`255 × srgbToLinear(0.875)`. The Control sheet has the mechanism.

**CLOSED — button heights are Godot's.** All three carry authored offsets 32 px
apart, and both engines now keep that: **Click Me** spans y 264..295 and
**Disabled** y 352..383, identically. **Styled** is the clean reading, because its
own StyleBox sets `content_margin_top/bottom = 6`: Godot's rect is 35 px
(12 + a 23 px font height), and ours is now 35 too, where it was 38 (12 + 26). The
3 px was Label's `line_spacing` default leaking into the shared text measurer —
see the Control sheet, which measures the same term per row on a whole stack.

**CLOSED — and the same leak had a second half, on the PAINT side.** Closing it
in the minimum-size solver fixed the button's HEIGHT while the label inside it
still sat a row high, because the painter shaped its own copy of the run and
passed no `lineSpacingPx` at all — taking the shared default of 3, the very
constant the solver had stopped using. The two halves were independent, and the
height being right is exactly what made the remainder easy to miss. Now that the
painter reads back the layout the solver already produced, there is one shaped
run and one spacing rule. Measured on the states fixture, the topmost label's
glyph rows: Godot 120..131, ours 120..132, where the previous render sat at
119..130 — a whole row high. `Button` declares no `line_spacing` theme key at
all; it is Label's, and a button never stacks the lines it would separate.

**Styled sits one row low**: y 308..342 here against Godot's y 307..341. The height
is right and the other two buttons are on Godot's exact rows, so this is a
placement term specific to a button carrying its own StyleBox content margins, not
the minimum size.

**MOSTLY CLOSED — a glyph's edge pixels still part by a residual sub-pixel,
where they used to part by a growing multi-pixel drift.** Probe (544, 362)
used to read rgb(127, 127, 127) against Godot's rgb(142, 142, 142); it now
reads rgb(138, 138, 138) — much closer, while (583, 370), a solid interior
stroke, still matches exactly on both sides. The RichTextLabel sheet has the
mechanism and the fix (`openSansMetrics.ts`'s continuous per-glyph
`advanceWidths`, replacing the old atlas-bake-resolution-42-rounded
`xadvance` as the shaping source): here the **Disabled** label's last glyph
stem sits at x 606 in Godot and x 607 here — a steady 1 px residual now, not
a growing one.

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
like every other draw call this painter makes — so the ALPHA half of that number
was always right. The same probe on our side used to read `rgb(125, 125, 125)`,
the same 0.5 blend over the same fill with 188 in place of 223; it now reads
`rgb(142, 142, 142)`, Godot's own value. What closed it was the sRGB-encode gap
the Divergences section above measures, never the theme lookup.

### StyleBox corner anti-aliasing: CLOSED away from the corner arc; the arc itself is entangled with a placement offset

`styleBoxFlatGeometry.ts` (this painter's chrome, shared with every other native
StyleBox consumer — `panel/comparison.md` measures the same arc on a 40 px radius)
used to implement only Godot's non-anti-aliased branch, silently dropping
`anti_aliased`/`aa_size` (defaults `true`/`1`, `scene/resources/style_box_flat.h:49,54`)
at the parser too. Both are now ported: `StyleBoxFlatData` carries the two fields
(`native/styleBoxFlat.ts`, `native/parseStyleBox.ts`) and `styleBoxFlatGeometry.ts`
builds the same AA feather rings `StyleBoxFlat::draw` does
(`scene/resources/style_box_flat.cpp:511-630`).

**Styled**'s own StyleBox draws no border, so this is the fill-only AA branch — the
whole rect's boundary gets a `aa_size / 2` = 0.5 px feather. On the STRAIGHT top
edge, away from the corner arc, this closes the gap completely:
`--probe 576,308` now reads `rgb(51, 128, 89)` on BOTH sides — pixel-exact, where
before the fix ours read the bare rgb(76, 76, 76) backdrop at that row (the polygon
boundary sat exactly on the style rect edge with no feather past it).

The original corner probe (`--probe 519,308`, top-left arc, `corner_radius = 6`)
barely moved — Godot rgb(51, 128, 89), ours rgb(64, 102, 83) before this fix,
rgb(64, 100, 82) after — but that probe sits exactly on the row where this sheet's
own "Styled sits one row low" divergence (above) puts OUR rect's top edge one row
BELOW Godot's: Godot's rect already reads full fill a row earlier than ours does at
this x. Sampling one row further down the SAME arc, at `--probe 519,309`, is
pixel-exact on both sides (`rgb(51, 128, 89)`), and `--probe 520,308` (one column
right, same row) closes most of the way there too — `rgb(55, 118, 87)` against
Godot's `rgb(51, 128, 89)`, down from the pre-fix `rgb(64, 102, 83)`-scale gap. So
the AA ring itself is doing its job on this arc; what is left at the ORIGINAL probe
is the pre-existing row offset compounding with it, not a remaining AA gap.
`styleBoxFlatGeometry.test.ts`'s "anti-aliasing" describe block additionally pins
the new ring's exact vertex count and alpha-0 outer colours independent of any
rendered pixel.

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
