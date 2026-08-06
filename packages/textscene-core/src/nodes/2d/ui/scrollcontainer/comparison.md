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

The first label's line of text — "Scroll down — this content overflows the
container." — ends 2 px past Godot's, at x 16..415 against Godot's x 16..413.
The same 2 px gap appears on the second label, plain ASCII and shorter: x
17..271 here against Godot's x 17..269. It looks like a per-glyph advance
precision difference between this engine's `hmtx`-derived advances and
Godot's HarfBuzz/FreeType-hinted ones, which would accumulate with line
length — untested.

## Linting

<!-- lint:begin ScrollContainer -->
Strict parsing format-checks the inherited set (35 inherited from Control); `ScrollContainer` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`ScrollContainer` doesn't validate its scroll-mode enums either: `horizontal_scroll_mode`
and `vertical_scroll_mode` go through the optional-int reader, which accepts any
parseable integer, including an out-of-range value like `99`. That value passes
straight to the component's `switch`, which falls through to its `default` case and
renders the axis as `auto` overflow, the same as an absent value.
