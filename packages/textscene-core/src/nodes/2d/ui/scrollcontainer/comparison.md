---
type: ScrollContainer
category: 2D
status: done
fixture: unit-scroll-container.tscn
image: unit-scroll-container
renders_as: a clipped content rect with themed scrollbars
---

# ScrollContainer

ScrollContainer clips its single child to its own rect and draws the theme's scrollbar
on whichever axis overflows. `scroll_hint_mode` adds the theme's edge fade over the
side the content continues past, and `draw_focus_border` insets the content and both
scrollbars by the focus style's margins. A right-to-left `layout_direction` moves
the vertical scrollbar to the left edge and shifts the content past the strip it
reserves.

## Linting

<!-- lint:begin ScrollContainer -->
Strict parsing format-checks these `ScrollContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `draw_focus_border` | true or false |  |
| `follow_focus` | true or false |  |
| `horizontal_scroll_mode` | enum 0-4 (DISABLED/AUTO/SHOW_ALWAYS/SHOW_NEVER/RESERVE) | warning |
| `scroll_deadzone` | integer |  |
| `scroll_hint_mode` | enum 0-3 (DISABLED/ALL/TOP_AND_LEFT/BOTTOM_AND_RIGHT) | warning |
| `scroll_horizontal` | integer >= 0 | error below |
| `scroll_horizontal_custom_step` | float -1-4096 | warning |
| `scroll_vertical` | integer >= 0 | error below |
| `scroll_vertical_custom_step` | float -1-4096 | warning |
| `tile_scroll_hint` | true or false |  |
| `vertical_scroll_mode` | enum 0-4 (DISABLED/AUTO/SHOW_ALWAYS/SHOW_NEVER/RESERVE) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-scrollcontainer-single-child` | `scrollcontainer-not-single-child` | warning |
<!-- lint:end -->

`horizontal_scroll_mode` and `vertical_scroll_mode` go through the optional-int reader,
which accepts any integer. An out-of-range value such as `99` falls through the
component's `switch` to `auto` overflow, the same as an absent value.

## Known limitations

- **Editor only** The focus border that `draw_focus_border` names is drawn only while
  the container or a child holds keyboard focus, which a still frame never has. Its
  margins apply regardless.
