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
| (120, 21) | the `[u]` span's underline stroke | rgb(153, 153, 153) | rgb(76, 76, 76) |
| (245, 6) | the `[color]` span's fill, where Godot draws it | rgb(224, 160, 48) | rgb(76, 76, 76) |
| (254, 7) | the same fill 9 px right, where ours draws it | rgb(76, 76, 76) | rgb(190, 90, 8) |

**`[u]` draws no underline.** Godot's is a 1 px stroke running x 92..175 on
row 21, 84 px of rgb(153, 153, 153); nothing at all is drawn on that row here.
The span's glyphs themselves are correct.

**Every colour is one sRGB transfer function too dark**, tag colours included.
`theme_override_colors/default_color` is `Color(0.9, 0.9, 0.9)` — Godot's
brightest glyph pixel reads rgb(230, 230, 230), ours rgb(201, 201, 201), and
`255 × srgbToLinear(230/255) = 201`. The `[color=#e0a030]` span shows the same
curve on three channels at once: rgb(224, 160, 48) against rgb(190, 90, 8),
which is that colour channel-wise through the same function. The Control sheet
has the mechanism.

**Whitespace at a span boundary is misplaced.** Godot's line reads
"Bold, italic, underline, and colored BBCode"; ours reads "Bold,italic ,
underline, and colored BBCode" — the space after the first comma is dropped and
one appears after the italic run instead. The line's ink ends at x 359 in Godot
and x 369 here, so the drift is cumulative rather than a single glyph's advance.

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
