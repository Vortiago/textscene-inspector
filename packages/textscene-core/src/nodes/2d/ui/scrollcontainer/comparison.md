---
type: ScrollContainer
category: 2D
fixture: unit-scroll-container.tscn
image: unit-scroll-container
renders_as: an overflow-scrolling DOM container
---

# ScrollContainer

A container that clips its single child and scrolls when the child overflows. The
previewer renders it as a DOM overlay `<div>` whose Godot scroll modes map to CSS
`overflow`; here the content VBox is forced to 800 px tall inside a ~608 px viewport, so
its content is taller than the box.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` / `anchor_right` / `anchor_bottom` | `15` / `1.0` / `1.0` | the container fills the window |
| `offset_left/top/right/bottom` | `16, 16, -16, -16` | insets the container 16 px from every window edge |
| `custom_minimum_size` (Content VBox) | `Vector2(0, 800)` | content is taller than the viewport, so the vertical axis overflows and scrolls |
| `theme_override_constants/separation` (Content VBox) | `8` | 8 px gap between the two labels at the top |

Both `horizontal_scroll_mode` and `vertical_scroll_mode` are left unset (AUTO); the two
labels render identically placed in both images.

## Divergences

Godot draws its vertical scrollbar down the right edge — a slim full-height track with a
rounded grabber. Ours shows no scrollbar. The previewer maps each scroll axis to a CSS
`overflow` value rather than painting Godot's themed scrollbar, and none is rendered in
this static capture.

## Linting

<!-- lint:begin ScrollContainer -->
Strict parsing format-checks the inherited set (28 inherited from Control); `ScrollContainer` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`ScrollContainer` doesn't validate its scroll-mode enums either: `horizontal_scroll_mode`
and `vertical_scroll_mode` go through the optional-int reader, which accepts any
parseable integer, including an out-of-range value like `99`. That value passes
straight to the component's `switch`, which falls through to its `default` case and
renders the axis as `auto` overflow, the same as an absent value.
