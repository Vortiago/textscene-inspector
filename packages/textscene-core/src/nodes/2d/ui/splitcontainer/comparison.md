---
type: SplitContainer
category: 2D
status: unimplemented
fixture: unit-split-container.tscn
# image: unit-split-container
renders_as: invisible transform-only fallback
---

# SplitContainer

SplitContainer is a Control that arranges children horizontally or vertically and
grabbers between them (`HSplitContainer`/`VSplitContainer` fix the axis; the base
type leaves it authorable via `vertical`). It is a Control (ADR-0003 routes
Controls through the 2D DOM overlay, not the WebGL scene), so the previewer
parses and validates every member below but does not draw it: it renders as an
invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `split_offsets` | `PackedInt32Array(80, 40)` | per-dragger pixel offset from the computed rest position |
| `split_offset` | `80` | deprecated compat property — the first element of `split_offsets` |
| `collapsed` | `false` | pins the split at rest, ignoring `split_offsets`, when `true` |
| `dragging_enabled` | `false` | disables user dragging of the split bar |
| `dragger_visibility` | `1` (`DRAGGER_HIDDEN`) | hides the dragger icon without collapsing the separation |
| `vertical` | `true` | arranges children in a column instead of a row |
| `touch_dragger_enabled` | `true` | swaps in a touch-friendly drag handle |
| `drag_area_margin_begin` | `4` | shrinks the drag area at the start of the container |
| `drag_area_margin_end` | `6` | shrinks the drag area at the end of the container |
| `drag_area_offset` | `-8` | shifts the drag area off the split axis |
| `drag_area_highlight_in_editor` | `true` | editor-only debug highlight; no previewer effect |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

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
| `split_offsets` | PackedInt32Array(n, n, …) |  |
| `touch_dragger_enabled` | true or false |  |
| `vertical` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

Strict parsing format-checks all 11 of SplitContainer's own members —
`doc/classes/SplitContainer.xml` lists none with an `overrides=` attribute, and
none of `scene/gui/split_container.cpp`'s `ADD_PROPERTY` entries carries
`PROPERTY_USAGE_NONE` (the deprecated singular `split_offset` is
`PROPERTY_USAGE_NO_EDITOR` only, so it still reaches a `.tscn`). `dragger_visibility`
is the one enum, bounded 0–2 by the three labels of the `PROPERTY_HINT_ENUM` at
`split_container.cpp:1298` — a warning, since `set_dragger_visibility`
(`split_container.cpp:1103-1109`) assigns unconditionally; every other member
is a plain bool or int with no `PROPERTY_HINT_RANGE`, and none of their setters
clamps — `set_split_offset`/`set_split_offsets` store the pixel offset exactly as
authored, with no `first > second`-style collapse for a rule to warn about — so
there is no `linter.ts` here, unlike `Range`'s `max_value < min_value` case.
Strict and lenient parsing therefore agree on every property Godot itself would
ever write for this type.
