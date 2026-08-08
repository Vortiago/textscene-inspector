---
type: Complex 2D GUI
category: Complex Scenes
status: limitation
fixture: complex-2d-gui.tscn
image: complex-2d-gui
renders_as: a composed settings/HUD panel — 23 Control types in one tree
---

# Complex 2D GUI

A mission settings panel: a titled header card over a scrolling column of
systems controls, a briefing, an action row, and a second column holding a
sector map and a status readout, with an alert strip laid over the whole frame.
Both images are the SAME panel rendered through real Godot and through this
previewer, framed by the 1152x648 project viewport.

Every other Control scene in the corpus isolates ONE type against a flat
backdrop. This one composes 23 of them, and therefore moves many variables at
once on purpose — a shifted pixel here could be the split solve, the box flow, a
stylebox content margin, a font metric or the canvas snap, and this frame cannot
say which. It is not a localiser and never will be. It exists to catch what a
single-variable scene has, by construction, nothing to catch: the interactions
BETWEEN Controls. A regression seen here is localised in the `unit-*` fixture
that owns the type, and that is still where the fix is pinned.

## What it exercises

- A container chain that solves one rect after another — MarginContainer →
  HSplitContainer → VBoxContainer → ScrollContainer → PanelContainer →
  MarginContainer → GridContainer — so a minimum size that propagates the wrong
  way up has something above it to be wrong against
- Widgets with no rect of their own: the sliders, the OptionButton, the LineEdit
  and the CheckBox are sized entirely by the grid cell they land in
- `modulate` multiplying down a nesting chain: the action row carries alpha and
  the button inside it carries a tint, so the button shows the product
- StyleBoxFlat content margins nesting inside container separation constants —
  the pair that double-counts
- A ScrollContainer that genuinely overflows: the clip edge and the vertical
  scrollbar are both in frame, and only the keybinds card runs past the fold
- An HSplitContainer solved by `size_flags_stretch_ratio` rather than by
  `split_offset`, and a VSplitContainer splitting the other axis beside it
- A CanvasLayer drawing OVER the whole Control tree instead of beside it
- A SubViewportContainer sampling a Control subtree — ColorRects, a Panel and a
  Label inside a render target, not world content
- Wrapped text through both text engines: a Label at `autowrap_mode = 2` and a
  RichTextLabel with `[b]`, `[i]`, `[u]` and `[color]` spans, each wrapping
  against a width the layout decides rather than an authored constant
- Theme overrides where the composition needs them — the card styleboxes and
  their content margins, the separation and margin constants that set the
  rhythm, and the font size and colour overrides that make the panel read as a
  hierarchy. No Theme resource is applied, so every unstyled widget resolves
  through the bundled default theme.

Control itself draws no ink here: the root and the action row's spacer are pure
layout, and their presence is visible only as the space they hold open.

The scene is deterministic — no animation, no particles, no timers, no random
seed. The picture at settle 0 is the only picture it has.

## Divergences

The whole frame differs by 11,453 px (1.534 %) in 520 clusters, none of them
bigger than 456 px. Composition is not what moves: every card plate, split
gutter, clip edge, scrollbar rect, stylebox colour and `modulate` product lands
on the same pixel on both sides, including the composited SubViewport surface
and the two bars whose tint is chained. Layout carries none of it either: a
scratch project instantiating the scene in a 1152x648 `SubViewport` and printing
`Control.get_rect()` per node gives 55 rects, and the previewer's own solve
reproduces every one of them exactly — the systems grid's widget column, the
action row's split, and the status column's box flow included. The text accounts
for all of it.

The rest is glyph rasterisation, the standing MSDF-atlas residual: a
text run lands within one column of Godot's in either direction while its rows
and its wrap points match exactly. `Apply` inks `x 28..70` in Godot against
`x 28..71` here; the header subtitle `x 101..669` against `x 101..668`, wrapping
on the same word at the same two rows; the status column's squad note
`x 834..1100` against `x 833..1099`, likewise. The concentration is the briefing
RichTextLabel at `y 380..420`, which is the densest text in the frame.

Its `[u]` rule is the one text feature that is not just antialiasing: at `x 500`
Godot draws one crisp row at `y 418` and we draw a two-row feather at
`y 416..417`, so the underline sits two pixels high and half a level soft.

Probes below, from
`pnpm ref:godot scenes/fixtures/complex-2d-gui.tscn --mode 2d --probe <x,y>`
against `pnpm ref:ours complex-2d-gui.tscn --2d --probe <x,y>`.

### Container geometry

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| (766, 400) | the HSplitContainer boundary between the two columns | rgb(26, 31, 41) | rgb(26, 31, 41) |
| (950, 318) | the VSplitContainer boundary between map card and status card | rgb(13, 15, 20) | rgb(13, 15, 20) |
| (24, 80) | the header card's left plate edge, i.e. the outer MarginContainer inset | rgb(33, 43, 56) | rgb(33, 43, 56) |
| (176, 176) | the systems grid's column boundary — label column against widget column | rgb(86, 88, 93) | rgb(118, 119, 121) — the column opens a pixel early |
| (600, 175) / (600, 208) | the grid row pitch, where `v_separation` meets the card's content margin | rgb(26, 28, 32) both rows | rgb(26, 28, 32) both rows |
| (900, 81) | the CenterContainer's placement of the fixed-size map surface | rgb(18, 41, 38) | rgb(18, 41, 38) |
| (750, 517) | the action row's right edge, set by the expanding spacer Control | rgb(115, 115, 116) | rgb(115, 115, 116) |

### Clipping and draw order

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| (400, 611) | the ScrollContainer's bottom clip edge, on the keybinds card | rgb(26, 31, 41) | rgb(26, 31, 41) |
| (750, 590) | the vertical scrollbar track inside the scroll region | rgb(21, 22, 24) | rgb(21, 21, 23) |
| (200, 630) | the alert strip over the Control tree beneath it | rgb(112, 35, 32) | rgb(112, 35, 32) |
| (900, 630) | the alert strip's alpha against the card it covers | rgb(112, 35, 32) | rgb(112, 35, 32) |

### Modulate chaining

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| (30, 519) | the action row's plain button under the row's alpha alone | rgb(182, 182, 182) | rgb(182, 183, 183) |
| (645, 519) | the tinted button under row alpha times its own tint | rgb(63, 49, 40) | rgb(111, 85, 64) — a glyph edge one column over |
| (1000, 427) / (1000, 375) | the ammunition bar, a Panel tinted against its untinted sibling | rgb(70, 95, 33) / rgb(74, 158, 130) | rgb(70, 95, 33) / rgb(74, 158, 130) |

### Text inside a layout

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| ink box | the subtitle Label's wrap point, set by the header row's residual width | x 101..669, y 83..120 | x 101..668, y 83..120 |
| (270, 389) | the briefing's coloured BBCode span | rgb(224, 160, 48) | rgb(224, 160, 48) |
| x 500, the rule's row | the briefing's underlined span | y 418, rgb(118, 124, 132) | y 416..417, rgb(95, 101, 110) / rgb(49, 55, 64) |
| ink box | the squad note's wrap point inside the narrower status column | x 834..1100, y 448..489 | x 833..1099, y 448..489 |

### Widgets sized by a container

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| (565, 175) | the master volume grabber, at `value` along a grid-cell width | rgb(220, 220, 220) | rgb(220, 220, 221) |
| (318, 214) | the music slider's tick marks | rgb(83, 87, 95) | rgb(26, 31, 41) — the tick is at x 316..317 here |
| (797, 452) | the gain VSlider grabber, measured up from the bottom of a box cell | rgb(197, 197, 198) | rgb(197, 197, 198) |
| (200, 288) | the LineEdit's text baseline inside its stylebox | rgb(113, 114, 116) | rgb(223, 223, 223) |
| (184, 328) | the CheckBox's tick beside its label | rgb(26, 26, 26) | rgb(36, 36, 36) |
| (716, 245) | the OptionButton's selected item and its arrow | rgb(155, 155, 156) | rgb(154, 155, 155) |

### The sub-viewport surface

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| (850, 120) | the map backdrop inside the render target | rgb(18, 41, 38) | rgb(18, 41, 38) |
| (1045, 158) | the objective marker, off-centre in both axes so a flip is visible | rgb(224, 163, 61) | rgb(224, 163, 61) |
| (815, 234) | the readout Panel's stylebox inside the target | rgb(16, 26, 30) | rgb(16, 26, 30) |
| (780, 170) | the card plate outside the surface, where the target does not reach | rgb(26, 31, 41) | rgb(26, 31, 41) |
