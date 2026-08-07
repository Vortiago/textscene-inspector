---
type: Complex 2D GUI
category: Complex Scenes
status: unreviewed
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

Two are measured and open. Both are invisible to every `unit-*` fixture in the
bag, which is what this scene exists for.

**The composited SubViewport surface is displaced by exactly half its own size.**
The map's corridor bar spans `x 821..1072, y 155..174` in Godot and
`x 971..1151, y 245..264` here — a translation of `+150, +90` against a
SubViewport authored `300x180`, which is `+w/2, +h/2` to the pixel. The right
edge is then clipped by the project viewport, so the objective marker
`rgb(224, 163, 61)` is present in Godot at `x 1035..1054, y 149..168` and absent
here altogether. The MapCard panel behind it is drawn in the right place and
empty: only the sampled surface moves. The arithmetic points at a quad centred
at its own half-extent without the matching corner correction, so the surface
lands with its top-left where its centre belongs — but that is the shape of the
number, not a confirmed cause.

**A PanelContainer sized to a wrapped Label reserves one line where Godot
reserves two.** The header card's subtitle wraps to two lines in both images,
identically broken, but the card is 26 px shorter here — one line pitch — and
its second line `corridor closes.` is drawn outside the panel it belongs to,
with the card's bottom border crossing the glyphs. Everything below shifts up by
the same amount: the `Master volume` row sits at `y 176` in Godot and `y 150`
here. So the autowrapped Label's minimum HEIGHT reaches its container as a
single line while its paint uses the wrapped count. Width-dependent height needs
the container to solve width first and re-ask, which is the two-pass shape this
solve does not currently have.

The whole frame differs by 78,826 px (10.56 %), and both divergences above are
inside that number. The CanvasLayer alert strip is `x 0..1151, y 612..647` on
both sides, and the shield bar agrees within 1 px, so the layer banding and the
box flow beside these two faults are not implicated.

The probes below name what each remaining measurement targets; those pixels are
taken in a later pass, with
`pnpm ref:godot scenes/fixtures/complex-2d-gui.tscn --mode 2d --probe <x,y>`
against `pnpm ref:ours complex-2d-gui.tscn --2d --probe <x,y>`.

### Container geometry

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| | the HSplitContainer boundary between the two columns | | |
| | the VSplitContainer boundary between map card and status card | | |
| | the header card's left plate edge, i.e. the outer MarginContainer inset | | |
| | the systems grid's column boundary — label column against widget column | | |
| | the grid row pitch, where `v_separation` meets the card's content margin | | |
| | the CenterContainer's placement of the fixed-size map surface | | |
| | the action row's right edge, set by the expanding spacer Control | | |

### Clipping and draw order

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| | the ScrollContainer's bottom clip edge, on the keybinds card | | |
| | the vertical scrollbar track inside the scroll region | | |
| | the alert strip over the Control tree beneath it | | |
| | the alert strip's alpha against the card it covers | | |

### Modulate chaining

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| | the action row's plain button under the row's alpha alone | | |
| | the tinted button under row alpha times its own tint | | |
| | the ammunition bar, a Panel tinted against its untinted sibling | | |

### Text inside a layout

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| | the subtitle Label's wrap point, set by the header row's residual width | | |
| | the briefing's coloured BBCode span | | |
| | the briefing's underlined span | | |
| | the squad note's wrap point inside the narrower status column | | |

### Widgets sized by a container

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| | the master volume grabber, at `value` along a grid-cell width | | |
| | the music slider's tick marks | | |
| | the gain VSlider grabber, measured up from the bottom of a box cell | | |
| | the LineEdit's text baseline inside its stylebox | | |
| | the CheckBox's tick beside its label | | |
| | the OptionButton's selected item and its arrow | | |

### The sub-viewport surface

| Probe | What it targets | Godot | Ours |
| --- | --- | --- | --- |
| | the map backdrop inside the render target | | |
| | the objective marker, off-centre in both axes so a flip is visible | | |
| | the readout Panel's stylebox inside the target | | |
| | the card plate outside the surface, where the target does not reach | | |
