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
| (576, 306) | the row above **Styled**'s top edge, on the straight part away from both corner arcs | rgb(76, 76, 76) | rgb(64, 102, 83) — see "Styled's rect sits half a pixel high" below |
| (576, 341) | **Styled**'s bottom fill row, same column | rgb(51, 128, 89) | rgb(64, 102, 83) — the same half-pixel offset at the other edge |

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
**Styled**'s own StyleBox sets `content_margin_top/bottom = 6`, so its minimum
height is 35 px (12 + a 23 px font height) against an authored 32, and that 35 px
rect is the same height on both sides. All three span x 516..635 on both.

**Styled's rect sits half a pixel high**: `anchors_preset = 8` (CENTER) grows
BOTH ways, so the 3 px the minimum size adds is split evenly
(`scene/gui/control.cpp:1789-1797`) and the rect solves to y 306.5..341.5. We
paint exactly that: at x 560, 576 and 600 alike our boundary rows 306 and 341
read rgb(64, 102, 83) — a clean half-and-half of the rgb(76, 76, 76) backdrop and
the rgb(51, 128, 89) fill — with rows 307 and 340 just inside them solid fill.
Godot at those same columns has no feather at all: rows 306 and 342 are backdrop,
rows 307 and 341 solid fill, a rect of y 307..342. It lands there because
`Control::_update_canvas_item_transform` rounds a Control's canvas transform to
whole pixels — `(xform[2] + Vector2(0.5, 0.5)).floor()`,
`scene/gui/control.cpp:727-737`, gated on `gui/common/snap_controls_to_pixels`,
which defaults to `true` (`core/config/project_settings.cpp:1808`) — so 306.5
becomes 307. **Click Me** and **Disabled** solve to whole pixels already and have
nothing to snap, which is why this is the only button that moves. Same height,
same columns; the whole divergence is that half-pixel vertical translation.

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

On the top-left arc (`corner_radius = 6`), `--probe 519,308`, `--probe 519,309`
and `--probe 520,308` all read `rgb(51, 128, 89)` on both sides.

Where the arc does part it parts in the direction the half-pixel offset above
predicts. `--probe 519,307` reads Godot `rgb(65, 99, 81)` against ours
`rgb(53, 125, 89)` — ours carries more ink, its rect having started half a pixel
earlier. `--probe 519,341` reads Godot `rgb(65, 99, 81)` against ours
`rgb(76, 76, 76)` — ours carries none, its rect having already ended. Extra
coverage at the top end and missing coverage at the bottom is the signature of
that translation, so these numbers do not isolate the ring from the placement.

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
