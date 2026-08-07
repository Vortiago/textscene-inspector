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

`unit-label-autowrap-in-container.tscn` is the container case: a wrapping Label
has no width of its own (`Label::get_minimum_size` returns `Size2(1, height)`),
so the container decides it, and only then is the number of lines — and
therefore the height the container has to reserve — a known quantity. The
previewer resolves that the way Godot does across frames, by asking again once
a width exists (`SolveContext.tentativeRect`, one bounded second solve pass);
the Label's own width floor is 1 on both passes, so the width it is handed back
is the final one. Measured on Godot 4.6.3 by instantiating the scene in a
1152x648 `SubViewport` and reading `Control.get_rect()` after the reference
harness's own settle: `Card` (64, 64, 400, 130), `Column` (12, 12, 376, 106),
`Heading` (0, 0, 376, 23), `Body` (0, 31, 376, 75) — three wrapped lines at
`3 * 26 - 3`. The previewer's solve returns the same four rects. The same
reading on `complex-2d-gui.tscn` gives its `Subtitle` (0, 41, 640, 49) inside a
114-tall `HeaderCard`, and its `SquadNote` (0, 102, 282, 49).

That second pass is bounded at one correction, and Godot's own loop is not:
`Label::_shape` calls `update_minimum_size()`, which invalidates the cached
minimum up the ancestor chain and emits `minimum_size_changed`, which
`Container::_child_minsize_changed` answers with `queue_sort()` — so the engine
re-sorts as many frames as it takes to settle. One correction is exact whenever
the width a container hands the Label does not itself react to the Label's
height, which covers every container in this repo's scenes. It is one re-ask
short where the width DOES react: an autowrapping Label inside a
`ScrollContainer` whose vertical scrollbar appears only because the corrected
height overflowed it is then measured against a width that still includes the
bar's own width, and reads one line too short. Nothing measured here hits that —
`complex-2d-gui.tscn`'s two wrapping Labels are both outside its `ScrollContainer`.

Godot breaks lines at an `int` width (`Label::_shape`'s
`int width = get_size().width - normal_style->get_minimum_size().width`; Label's
default style is a `StyleBoxEmpty`, so the second term is zero), so a container
handing out a fractional width still wraps against the whole pixel below it.
Both the height the solver floors against and the layout the painter draws
truncate the same way. `_shape` justifies with that same truncated width, while
`_get_line_rect` aligns against the raw `get_size()` — the two are genuinely
different numbers, and the previewer keeps them apart. Measured on Godot 4.6.3
with a `HORIZONTAL_ALIGNMENT_FILL` Label, walking `get_character_bounds` across
its first line: a 300.7px box stretches that line to a right edge of exactly
300.0, and a 301.4px box to 301.0.

Per-line horizontal origins are whole pixels in the engine and here.
`Label::_get_line_rect` writes H_CENTER as `int(size.width - line_size.width) / 2`
and H_RIGHT as `int(size.width - margin - line_size.width)`, truncating toward
zero rather than flooring. Measured on Godot 4.6.3 with a Label whose single
line is exactly 70px wide, reading `Label.get_character_bounds(0).position.x`:
H_CENTER lands on 65 for every box width from 200 through 201.5 and on 66 from
202 through 203.5; H_RIGHT lands on 130 at both 200 and 200.5, and 131 at both
201 and 201.5. With `clip_text` dropping the width floor so the box can be
narrower than the line, H_RIGHT reads -50 at box 20 and -49 at box 20.5 — a
floor would give -50 for both. The previewer reproduces every one of those.
H_CENTER's two roundings are not separable from a single truncation of the
halved difference at any width, odd difference or even.

`unit-label-2d-valign.tscn` covers the three non-default `vertical_alignment`
branches, which every other Control fixture leaves at TOP. Godot rounds the
alignment offset to a whole pixel before it reaches a baseline (`int vbegin = 0,
vsep = 0` in `Label::get_layout_data`), and so does the previewer: measured on
Godot 4.6.3 with `pnpm ref:godot scenes/fixtures/unit-label-2d-valign.tscn
--mode 2d --out …`, a 23px line centred in a 100px box and the same line centred
in a 99px box both start their ink on row 68 against the zero-offset pane's 30,
i.e. an offset of exactly 38 for both; the BOTTOM pane's is 77; and the FILL
pane's four lines sit a flat 60 px apart (a separation of 34 on top of the 26px
line pitch) rather than drifting by the two-thirds pixel that 104/3 would leave.

Label's own `font_color` default is opaque white, the fixed point of the sRGB
transfer curve, so this fixture's glyphs peak at rgb(255, 255, 255) in both
images.

## Linting

<!-- lint:begin Label -->
Strict parsing format-checks the inherited set (35 inherited from Control); `Label` declares none of its own. Every validator failure is an **error**.

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
