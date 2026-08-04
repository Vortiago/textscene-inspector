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

Two things still differ.

**The bars are drawn UNDER the content, where Godot draws them over it.** This is
measurable on `unit-scroll-container-clip.tscn` — a 600x500 container around a
900x900 child, with three blocks straddling the boundary. Godot's
`scroll` StyleBox is semi-transparent, so where a bar crosses content the two
blend; here the content simply wins. `pnpm ref:godot
scenes/fixtures/unit-scroll-container-clip.tscn --mode 2d --probe 715,95` reads
rgb(164, 130, 127) — the track over the red band — where
`pnpm ref:ours unit-scroll-container-clip.tscn --2d --probe 715,95` reads
rgb(217, 77, 64), the bare band. Same at the horizontal bar: probe `390,555` is
rgb(133, 161, 161) in Godot and rgb(89, 204, 204) here, the uncovered cyan block.
Off the content the bars are identical, which is why the plain fixture above
matches. The clip rect itself is right — probe `700,95` is the band's own colour
on both sides, and the straddling blocks are cut on the same edge.

**A character outside printable ASCII draws nothing, and carries no advance.** The
first label's text is "Scroll down — this content overflows the container."; the em
dash (U+2014) has no entry in the baked MSDF atlas, so it leaves a gap here where
Godot draws a stroke, and everything after it shifts left by the width Godot gave
it. The line's ink spans x 16..413 in Godot and x 16..399 here; the second label,
which is plain ASCII, spans x 17..269 against x 17..271.

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
