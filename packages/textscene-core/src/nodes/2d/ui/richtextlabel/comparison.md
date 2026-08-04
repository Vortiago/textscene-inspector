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
| (245, 6) | the `[color]` span's fill, where Godot draws it | rgb(224, 160, 48) | rgb(76, 76, 76) |
| (254, 7) | the same fill ~9 px right, where ours draws it | rgb(76, 76, 76) | rgb(224, 160, 48) |

**CLOSED: `[u]` now draws an underline.** Previously nothing at all was drawn
on that row (BEFORE: Godot a 1 px stroke running x 92..175 on row 21, 84 px of
rgb(153, 153, 153); ours drew nothing, probe (120, 21) read rgb(76, 76, 76),
the background). `nativeSolver.ts`'s `underlineRectPx` now draws the stroke
from the vendored font's own `post`-table underline metrics
(`openSansMetrics.ts`'s `getUnderlinePositionPx`/`getUnderlineThicknessPx`),
at `RICH_TEXT_LABEL_UNDERLINE_ALPHA` (Godot's `underline_alpha` theme
constant) times the run's own colour (AFTER, this fixture: a 1 px stroke at
row 21, x 101..183 — matches Godot's row and colour exactly, x shifted ~9 px
by the same residual advance drift the next paragraph describes; probe
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

**A residual ~9-10 px advance drift remains, evenly distributed across the
whole line, unrelated to the two fixes above.** The line's ink ends at x 359
in Godot and x 369 here — present before AND after both fixes, and not
specific to any span boundary: it grows steadily across the line (the
`[color]` span above lands 9 px right of Godot's own position by the time the
line reaches it). Likely a small systemic difference between this engine's
per-glyph advances (`openSansAtlas.ts`'s baked `xadvance`, a plain
`hmtx`-derived scale) and Godot's real HarfBuzz-shaped, FreeType-hinted
advances at this font size — out of this sheet's three fixed defects, not
investigated further here.

`[b]` is drawn, but not as Godot's face: the span spans x 1..39 in Godot and
x 1..41 here. The distance-field bias that stands in for
`set_variation_embolden` is a qualitative substitution, not a port — there is no
MSDF equivalent of FreeType's stroke units. `[i]`'s skew is exact.

## Linting

<!-- lint:begin RichTextLabel -->
Strict parsing format-checks the inherited set (33 inherited from Control); `RichTextLabel` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`RichTextLabel` has no strict counterpart for `bbcode_enabled` or `fit_content`
either. Both flags use a direct string comparison against `'true'`, so an absent
property or any other value (`"1"`, garbage text) silently resolves to `false`, with
no warning logged.
