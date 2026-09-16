---
type: SplitContainer
category: 2D
status: unreviewed
fixture: unit-split-container.tscn
# image: unit-split-container
renders_as: two children split at a computed offset, along the `vertical`-chosen axis
---

# SplitContainer

SplitContainer is the base that arranges two children with a draggable split between
them, with the dragger's band between them. HSplitContainer and VSplitContainer fix the
axis; this type reads `vertical` itself to pick it.

## Linting

<!-- lint:begin SplitContainer -->
Strict parsing format-checks these `SplitContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `collapsed` | true or false |  |
| `drag_area_highlight_in_editor` | true or false |  |
| `drag_area_margin_begin` | integer |  |
| `drag_area_margin_end` | integer |  |
| `drag_area_offset` | integer |  |
| `dragger_visibility` | enum 0-2 (DRAGGER_VISIBLE/DRAGGER_HIDDEN/DRAGGER_HIDDEN_COLLAPSED) | warning |
| `dragging_enabled` | true or false |  |
| `split_offset` | integer |  |
| `split_offsets` | int array (PackedInt32Array(…), Array[int]([…]) or […]) |  |
| `touch_dragger_enabled` | true or false |  |
| `vertical` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

Strict format-checks all eleven of SplitContainer's own members. `dragger_visibility` is
the one enum, and it warns outside `0..2`, since the setter assigns unconditionally. No
setter clamps, so strict and lenient agree on every value Godot itself writes. The
lenient parser reads `split_offset`, `collapsed`, `dragger_visibility` and `vertical`
beyond their scalar type only; an unparseable `split_offset` or `dragger_visibility`
leaves the property `undefined` and Godot's default applies, an unparseable `collapsed`
or `vertical` reads as `false` (a bool slot stores what it can, never unset), and an
out-of-range `dragger_visibility` behaves as VISIBLE.

