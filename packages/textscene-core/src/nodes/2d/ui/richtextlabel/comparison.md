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
