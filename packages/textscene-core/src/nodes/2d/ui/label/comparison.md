---
type: Label
category: 2D
fixture: unit-label-2d.tscn
image: unit-label-2d
renders_as: a shaped text run on the canvas
---

# Label

The 2D UI text node. The previewer shapes the string against the theme's own
bundled font and draws the glyphs on the canvas, honouring its alignment, case,
and wrap settings. The fixture stacks three labels to exercise those in turn.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | three strings | the text each of the three labels shows |
| `offset_left/top/right/bottom` | e.g. `20/20/260/60` | stacks the labels and fixes each box at 240px wide |
| `horizontal_alignment` | `1` (Center) | "Centered label" sits centered within its box |
| `vertical_alignment` | `1` (Center) | that same label's text is centered vertically in its box |
| `uppercase` | `true` | "shouts when rendered" renders as SHOUTS WHEN RENDERED |
| `autowrap_mode` | `3` (WORD_SMART) | the long string wraps onto three lines |

## Divergences

The auto-wrap paragraph breaks at the same words. Both lay it out as "This label
wraps across / multiple lines once it runs out / of horizontal space.", at the
same line pitch: measured on Godot 4.6.3 with
`pnpm ref:godot scenes/fixtures/unit-label-2d.tscn --mode 2d --out …` against
`pnpm ref:ours unit-label-2d.tscn --2d --out …`, the three lines' ink starts at
y 146 / 172 / 198 in Godot and 145 / 171 / 197 here — 26 px between lines on both
sides, with every line's ink ending on the same row. The one-pixel head start is
antialiasing spill at the top of the ascenders, not a placement difference: our
line's ink box is 17 rows against Godot's 16 and shares its bottom edge.

`unit-label-2d-wrap.tscn` is the wider reading — the same sentence set four times
over two box widths and two font sizes. Every break point matches, on all four
panes, and the pitch tracks the size: 31 px at `font_size = 20` (line tops
55 / 86 / 117 / 148 in Godot, 54 / 85 / 116 / 147 here) and 42 px at 28, where the
five line tops are 344 / 386 / 428 / 470 / 512 on BOTH sides with no offset at all.

What is left is colour, not layout. Label's own `font_color` default is opaque
white, which is the fixed point of the sRGB transfer curve, so this fixture's
glyphs peak at rgb(255, 255, 255) in both images. Any other font colour comes out
one transfer function too dark here — the Control sheet measures it.

Two characters the fixture does not contain are worth naming, because a Label is
where they will be met: the MSDF atlas is baked over printable ASCII only, so a
glyph outside that range (an em dash, a bullet) has no entry and draws nothing at
all. The ScrollContainer sheet measures one.

## Linting

<!-- lint:begin Label -->
Strict parsing format-checks the inherited set (33 inherited from Control); `Label` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Label's own properties, `text`, `horizontal_alignment`, `vertical_alignment`,
`autowrap_mode`, `uppercase`, carry no strict validator either; only the inherited
Control set is checked. `horizontal_alignment`, `vertical_alignment`, and
`autowrap_mode` use `parseOptionalInt`, so an absent or unparseable value becomes
`undefined` silently, no warning. `uppercase` isn't `boolOr`: only the literal
string `"true"` turns it on, anything else (including a garbled value) leaves it
falsy without a warning.
