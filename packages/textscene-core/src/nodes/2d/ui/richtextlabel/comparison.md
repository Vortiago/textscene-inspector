---
type: RichTextLabel
category: 2D
fixture: unit-rich-text-label.tscn
image: unit-rich-text-label
renders_as: a run of shaped text with per-span styling
---

# RichTextLabel

A Control that lays out a run of rich text; the previewer shapes it against the
theme font and, with `bbcode_enabled`, draws a BBCode subset as per-span
styling. Both images show one line reading "Bold, italic, underline, and colored
BBCode" pinned to the top-left, with each tagged word carrying its style.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"[b]Bold[/b], [i]italic[/i], [u]underline[/u], and [color=#e0a030]colored[/color] BBCode"` | the visible line of text |
| `bbcode_enabled` | `true` | tags render as styling, not literal characters |
| `fit_content` | `true` | box shrinks to the single line's height at the top edge |
| `theme_override_font_sizes/normal_font_size` | `18` | the size of the text |
| `theme_override_colors/default_color` | `Color(0.9, 0.9, 0.9, 1)` | the light-grey of the untagged words |

`[b]` renders bold and `[i]` italic in both images; `[u]` and `[color=#e0a030]`
are where the two part company.

## Divergences

Measured on Godot 4.6.3, `pnpm ref:godot scenes/fixtures/unit-rich-text-label.tscn
--mode 2d --probe <x,y>` against `pnpm ref:ours unit-rich-text-label.tscn --2d
--probe <x,y>`:

| Probe | What it is | Godot | Ours |
| --- | --- | --- | --- |
| (120, 21) | the `[u]` span's underline stroke — CLOSED, see below | rgb(153, 153, 153) | rgb(153, 153, 153) |
| (244, 11) | the `[color]` span's fill, an interior pixel — CLOSED, see below | rgb(224, 160, 48) | rgb(224, 160, 48) |

**CLOSED: `[u]` now draws an underline.** Previously nothing at all was drawn
on that row (BEFORE: Godot a 1 px stroke running x 92..175 on row 21, 84 px of
rgb(153, 153, 153); ours drew nothing, probe (120, 21) read rgb(76, 76, 76),
the background). `nativeSolver.ts`'s `underlineRectPx` now draws the stroke
from the vendored font's own `post`-table underline metrics
(`openSansMetrics.ts`'s `getUnderlinePositionPx`/`getUnderlineThicknessPx`),
at `RICH_TEXT_LABEL_UNDERLINE_ALPHA` (Godot's `underline_alpha` theme
constant) times the run's own colour (AFTER: a 1 px stroke at row 21, x
83..178 in Godot and x 82..177 here — within a pixel, where it used to sit
several pixels off because of the whole-line advance drift below; probe
(120, 21) now reads rgb(153, 153, 153) on both sides).

**CLOSED — every colour now lands on Godot's value, tag colours included.**
`theme_override_colors/default_color` is `Color(0.9, 0.9, 0.9)`: Godot's
brightest glyph pixel reads rgb(230, 230, 230) and so does ours, over a
comparable count (624 pixels at 230 in Godot, 588 here). It used to read
rgb(201, 201, 201), and `255 × srgbToLinear(230/255) = 201`. The
`[color=#e0a030]` span was the same curve on three channels at once —
rgb(224, 160, 48) against rgb(190, 90, 8) — and its red channel now reads 224 on
both sides. The Control sheet has the mechanism and why white text hid it.

**CLOSED: whitespace at a span boundary is no longer misplaced.** Godot's line
reads "Bold, italic, underline, and colored BBCode"; ours USED TO read
"Bold,italic , underline, and colored BBCode" (BEFORE) — not a dropped/moved
character in the shaped text itself (`layoutRichTextRuns` always attributed
the right glyphs to the right run) but the `[i]` run's own ink visibly
shifting left: `TextRun.tsx`'s synthesized-italic shear pivoted every vertex
around the LINE's top edge instead of the glyph's own baseline (FreeType's
`FT_Outline_Transform`, `text_server_adv.cpp:1318-1320`/`:3621-3623`, pivots
at the outline's own origin — the baseline), so an ascender-height vertex
shifted the wrong direction. Fixed in `buildGlyphQuadArrays` (AFTER: the line
now reads "Bold, italic, underline, and colored BBCode" on both sides).

**CLOSED — the whole-line advance drift that used to grow across the line is
gone.** The line's ink used to end at x 359 in Godot and x 369 here — a 10 px
overshoot that was NOT a per-glyph advance-quantization artifact (the
standing hypothesis this fix started from): a scratch line-length sweep
(plain, non-bbcode text at 9/19/29/44 characters, `pnpm ref:godot` against
this engine's own `shapeText`) showed near-zero drift for PLAIN text of any
length, which localised the real cause to the BBCode styling itself.
Measured directly (`pnpm ref:godot` on isolated `[b]Bold[/b]`, `[i]italic[/i]`
fragments, comma-position probes on the un-styled glyph immediately
following each styled run): Godot's own bold "Bold" advances the pen ~3 px
LESS than the same word set unstyled, and italic "italic" ~4 px less — the
opposite direction and far larger magnitude than any rounding artifact could
explain. The mechanism: `scene/theme/default_theme.cpp:1199-1202` sets
`bold_font_size`/`italics_font_size`/`bold_italics_font_size` to the SAME `-1`
sentinel `normal_font_size` itself defaults to, but `RichTextLabel::_find_font`
(`rich_text_label.cpp:3257`/`:3270`/`:3283`) reads each style's OWN key
unconditionally — never falling back to `normal_font_size` — and
`Theme::get_font_size` (`scene/resources/theme.cpp:658-661`) resolves an
unset (`<= 0`) key to `ThemeDB::get_fallback_font_size()` (hardcoded 16,
`scene/theme/theme_db.h:85`), independent of whatever `normal_font_size`
resolved to. This fixture overrides only `normal_font_size` (18), so Godot
renders every `[b]`/`[i]`/`[b][i]` span two pixels smaller than the
surrounding plain text — a real Godot behaviour this engine had no notion of
at all, since it shaped every glyph on a line at one flat size regardless of
style. `nativeSolver.ts`'s `resolveRunFontSizePx` ports the same key
resolution now, and `textLayout.ts`'s `shapeText` gained a `fontSizePxAt`
per-character override so a styled run's own glyphs advance at ITS resolved
size while the paragraph still shapes as one pass (line-breaking needs the
whole paragraph's width, not each run measured alone). Closing this took the
line from a 10 px overshoot to within a pixel (AFTER: line ink x 1..359 in
Godot, x 0..358 here).

A much smaller, genuinely per-glyph-quantization term was real too, just far
too small to be the drift on its own (~1.5 px over this 45-character line,
confirmed by comparing `fontkit`'s raw `hmtx` scale against this engine's OLD
per-glyph advance table): `openSansAtlas.ts`'s `xadvance` is msdf-bmfont-xml's
OWN atlas-bake-resolution-42 glyph table, integer-rounded at THAT resolution
before this repo's bake script ever reads it back — confirmed empirically
(msdf-bmfont-xml's own `roundDecimal` option, which would round intentionally,
defaults to `null`/off; the rounding is upstream, in the atlas-bake tool's own
pipeline). Godot's real per-glyph advance is never rounded at any UI font size
this engine ships (`text_server_adv.cpp:7078`'s `subpos` branch, true for
`SUBPIXEL_POSITIONING_AUTO` — Godot's own default — whenever `font_size <= 20`,
`servers/text/text_server.h:172`): it is HarfBuzz's unrounded `x_advance`,
itself FreeType's UNHINTED advance (`thirdparty/harfbuzz/src/hb-ft.cc:115`'s
default `FT_LOAD_NO_HINTING`), a plain proportional `hmtx` scale with no
rounding anywhere. `openSansMetrics.ts` now bakes a SEPARATE, continuous
per-glyph `advanceWidths` table (`bake-metrics.mjs`'s `bakeAdvanceWidths`,
straight from `fontkit`'s `Glyph#advanceWidth`) that `textLayout.ts`'s
`glyphAdvancePx` reads instead — the atlas's own bitmap/geometry data (glyph
placement inside the PNG) is untouched, only the ADVANCE source changed.

`[b]` is drawn closer to Godot's own weight now too: the span spans x 1..39
in Godot and x 1..38 here (was x 1..41, confounded by the drift above).
`BOLD_DISTANCE_BIAS` was an unmeasured placeholder (0.08); measured directly
against real Godot — a horizontal transect through the `l` stem (a single
vertical stroke, so its half-max-crossing width is the stroke thickness
directly) — Godot's own `embolden=1.2` renders that stem 3.04 px wide where
0.08 rendered only 2.15 px, visibly thinner. `BOLD_DISTANCE_BIAS` is now
0.35, which renders the same stem 3.01 px wide without collapsing `o`'s
counter to a blob — Godot's own render at this size (18 px) already nearly
closes `o`'s counter too, so a tight counter is Godot's own behaviour here,
not an artifact to avoid. The `[b]` span's own overall ink width barely moved
between 0.08 and 0.35 (both ~38 px): a uniform SDF threshold shift moves the
`d` bowl's outermost curve only a fraction of a pixel, so stem thickness, not
span width, is the signal this constant actually controls. There is still no
MSDF equivalent of FreeType's stroke units, so this remains a tuned
approximation, not a calibrated port — `[i]`'s skew is exact by contrast,
since it transcribes a Transform2D coefficient directly.

## Linting

<!-- lint:begin RichTextLabel -->
Strict parsing format-checks the inherited set (35 inherited from Control); `RichTextLabel` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`RichTextLabel` has no strict counterpart for `bbcode_enabled` or `fit_content`
either. Both flags use a direct string comparison against `'true'`, so an absent
property or any other value (`"1"`, garbage text) silently resolves to `false`, with
no warning logged.
