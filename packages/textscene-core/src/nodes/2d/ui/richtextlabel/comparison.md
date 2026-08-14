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

`[b]`, `[i]`, `[u]`, and `[color=#e0a030]` all render as styling in both
images.

## Divergences

Measured on Godot 4.6.3, `pnpm ref:godot scenes/fixtures/unit-rich-text-label.tscn
--mode 2d --probe <x,y>` against `pnpm ref:ours unit-rich-text-label.tscn --2d
--probe <x,y>`:

`HORIZONTAL_ALIGNMENT_FILL` — whether authored on `horizontal_alignment` or
opened as `[fill]` — positions each line's ORIGIN where Godot does (the LTR
arm of `TextParagraph::draw`'s alignment switch shifts nothing, so FILL and
LEFT share an origin), but does not stretch the line to the box: Godot
justifies inside the line by growing its elastic spaces
(`text_paragraph.cpp:284`, `TextServer`'s `JUSTIFICATION_WORD_BOUND`), and
this renderer's shaping engine has no justification pass, so a filled
paragraph reads as left-aligned with a ragged right edge. Every other
alignment is exact, engine-checked to the pixel — see `nativeSolver.test.ts`'s
own header for the ink-column measurements.

`[u]`'s rule is one crisp row at y 21 on both sides, the same `rgb(153, 153,
153)` and the same 84 columns wide, but it starts at x 91 here against Godot's
x 92 — the pen has drifted one column left over the ~90 px of text ahead of it.
That drift is the shaper's accumulated per-glyph advance, not the rule's own
geometry: the rule is anchored to its run's first glyph pen x, so it inherits
whatever x that glyph already has.

`[b]`'s span spans x 1..39 in Godot and x 1..38 here. `BOLD_DISTANCE_BIAS`
(0.35) renders the `l` stem — a single vertical stroke, so its
half-max-crossing width is the stroke thickness directly — 3.01 px wide
against Godot's own `embolden=1.2` at 3.04 px, without collapsing `o`'s
counter to a blob; Godot's own render at this size (18 px) already nearly
closes `o`'s counter too, so a tight counter is Godot's own behaviour here,
not an artifact to avoid. There is still no MSDF equivalent of FreeType's
stroke units, so this remains a tuned approximation, not a calibrated port —
`[i]`'s skew is exact by contrast, since it transcribes a Transform2D
coefficient directly.

`[b]`/`[i]` both fall back to Godot's built-in 16 px (`resolveRunFontSizePx`'s
own doc — this scene overrides only `normal_font_size`, not the style-specific
keys), landing on an 18 px-dominant line whose shared baseline is set by the
line's own MAX ascent (`richTextLineMetrics`). Reading the `l` stem's own
column vertically (half-max crossings, linear-interpolated between samples)
puts Godot's cap-top/baseline-bottom at y≈6.38/19.5 against this engine's
y≈6.75/19.82 — a real, sub-pixel (~0.35 px lower) residual on the 16 px run.
Two candidate fixes to `buildGlyphQuadArrays`'s `bakeAnchorPx` were tried and
both are ruled out by measurement, not merely undesirable: the CURRENT
proportional scale of the atlas's own `base` at the run's own size, and a
per-size whole-pixel ascent ceiling (`getFontAscentPx`) in its place. The
18 px run on the SAME line (whose own size equals the line's dominant size —
e.g. the `l` in `underline` and the `d` in `and`) reads **exactly** y=5.5/19.5
in Godot AND in this engine, to the pixel — so any correction that moves
`bakeAnchorPx` at a size equal to the line's own would regress an
already-exact case, and the ceiling-based alternative does exactly that,
by 0.71 px. The residual is also not a uniform per-run shift: reading three
16 px glyphs on the SAME run (`l`, `d`, `B`) shows the ascender-height pair
(`l`/`d`) both ~0.35 px low while the cap-height `B` is ~1.1 px low — three
different residuals on one run at one size rules out a single per-run
constant, closed-form or tuned. This is the signature of FreeType's
per-size, per-outline-feature vertical grid-fitting under Godot's default
`HINTING_LIGHT` (`scene/theme/default_theme.h:36`'s `p_font_hinting`
default) snapping baseline/x-height/cap-height/ascender "blue zones"
independently at each requested pixel size — confirmed further by every
18 px baseline in this same capture landing on an exact `.5` half-pixel row
(the signature of a hinted edge sampled between two pixel centres) while the
16 px cap-top does not. A continuous proportional rescale of ONE 42 px MSDF
bake cannot reproduce a font's own per-size hint adjustments — those are
per-glyph, per-blue-zone, and non-linear in size — so no formula in
`buildGlyphQuadArrays` closes this without porting FreeType's own hinter.
The residual stays open as an architecture-level limit, not a bug in the
reconciliation `buildGlyphQuadArrays` already does; the mechanism it would
touch is shared by every text-painting Control, not owned by this node type.

## Linting

<!-- lint:begin RichTextLabel -->
Strict parsing format-checks the inherited set (35 inherited from Control); `RichTextLabel` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `control-property-order` (type-family match) | `control-property-order` | warning |
<!-- lint:end -->

`RichTextLabel` has no strict counterpart for `bbcode_enabled` or `fit_content`
either. Both flags use a direct string comparison against `'true'`, so an absent
property or any other value (`"1"`, garbage text) silently resolves to `false`, with
no warning logged.
