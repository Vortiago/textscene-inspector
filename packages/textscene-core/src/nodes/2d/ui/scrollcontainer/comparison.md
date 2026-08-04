---
type: ScrollContainer
category: 2D
fixture: unit-scroll-container.tscn
image: unit-scroll-container
renders_as: a clipped content rect with themed scrollbars
---

# ScrollContainer

A container that clips its single child and scrolls when the child overflows. The
previewer clips the content to the container's own rect and draws the theme's
scrollbar track and grabber on whichever axis overflows; here the content VBox is
forced to 800 px tall inside a ~608 px viewport, so the vertical axis overflows.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` / `anchor_right` / `anchor_bottom` | `15` / `1.0` / `1.0` | the container fills the window |
| `offset_left/top/right/bottom` | `16, 16, -16, -16` | insets the container 16 px from every window edge |
| `custom_minimum_size` (Content VBox) | `Vector2(0, 800)` | content is taller than the viewport, so the vertical axis overflows and scrolls |
| `theme_override_constants/separation` (Content VBox) | `8` | 8 px gap between the two labels at the top |

Both `horizontal_scroll_mode` and `vertical_scroll_mode` are left unset (AUTO); the two
labels sit on the same rows in both images.

## Divergences

The vertical scrollbar is drawn, in Godot's place and in Godot's colours.
Measured on Godot 4.6.3, `pnpm ref:godot scenes/fixtures/unit-scroll-container.tscn
--mode 2d --probe <x,y>` against `pnpm ref:ours unit-scroll-container.tscn --2d
--probe <x,y>`:

| Probe | What it is | Godot | Ours |
| --- | --- | --- | --- |
| (1131, 300) | the grabber | rgb(130, 130, 130) | rgb(129, 129, 129) |
| (1131, 550) | the `scroll` track below it | rgb(46, 46, 46) | rgb(45, 45, 45) |

The bar occupies x 1128..1135 — 8 px, the same 8 — on both sides, and the
grabber's solid run spans y 17..490 in Godot against y 17..491 here, a single
row of difference on its rounded cap.

**CLOSED — the bars are drawn over the content, as Godot draws them.** They used to
be drawn under it. Godot's `scroll` StyleBox is semi-transparent, so where a bar
crosses content the two blend; here the content simply won, because the painter
gave both bars this node's own paint slot and every descendant necessarily has a
later one. Godot adds `h_scroll`/`v_scroll` as `INTERNAL_MODE_BACK` children, which
paint after the whole subtree. Measured on `unit-scroll-container-clip.tscn` — a
600x500 container around a 900x900 child, with three blocks straddling the
boundary:

| Probe | What it is | Godot | Ours, before | Ours, now |
| --- | --- | --- | --- | --- |
| (715, 95) | the vertical track over the red band | rgb(164, 130, 127) | rgb(217, 77, 64) | rgb(163, 130, 127) |
| (390, 555) | the horizontal track over the cyan block | rgb(133, 161, 161) | rgb(89, 204, 204) | rgb(133, 160, 160) |

The "before" column is the bare content colour — the bar contributed nothing at
all. The remaining single count on one channel is the same rounding the plain
fixture's own probes show above, not a compositing difference. The clip rect was
never the problem: probe (700, 95) reads the band's own colour on both sides, and
the straddling blocks are cut on the same edge.

**CLOSED — a character outside printable ASCII now draws, and carries its advance.**
The first label's text is "Scroll down — this content overflows the container.";
the em dash (U+2014) had no entry in the baked MSDF atlas, so it left a gap where
Godot draws a stroke, and everything after it shifted left by the width Godot gave
it — the line's ink spanned x 16..413 in Godot against x 16..399 here, exactly the
dash's own advance short. The atlas now bakes ASCII, the Latin-1 Supplement and
the punctuation Godot's own defaults reach for, and any codepoint still outside it
contributes the font's `xAvgCharWidth` rather than collapsing the line. The same
line now spans x 16..415 against Godot's x 16..413.

One thing still differs.

**A whole line's ink ends 2 px past Godot's**, and the residual is not the em dash:
it survives on lines of plain ASCII too, and the rendered string matches Godot
character for character. It looks like a per-glyph advance precision difference
between this engine's `hmtx`-derived advances and Godot's HarfBuzz/FreeType-hinted
ones, which would accumulate with line length — untested. The second label, which
is shorter and plain ASCII, spans x 17..269 in Godot against x 17..271 here.

## Linting

<!-- lint:begin ScrollContainer -->
Strict parsing format-checks the inherited set (33 inherited from Control); `ScrollContainer` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`ScrollContainer` doesn't validate its scroll-mode enums either: `horizontal_scroll_mode`
and `vertical_scroll_mode` go through the optional-int reader, which accepts any
parseable integer, including an out-of-range value like `99`. That value passes
straight to the component's `switch`, which falls through to its `default` case and
renders the axis as `auto` overflow, the same as an absent value.
