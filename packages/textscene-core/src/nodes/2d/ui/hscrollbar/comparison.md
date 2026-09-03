---
type: HScrollBar
category: 2D
status: unimplemented
fixture: unit-h-scroll-bar.tscn
# image: unit-h-scroll-bar
renders_as: invisible transform-only fallback
---

# HScrollBar

Godot draws HScrollBar as a horizontal track with increment/decrement buttons and a draggable grabber; the previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layout_mode` | `1` | anchored layout mode, inherited from Control |
| `offset_left` | `8.0` | left edge of the anchored rect, inherited from Control |
| `offset_top` | `8.0` | top edge of the anchored rect, inherited from Control |
| `offset_right` | `108.0` | right edge of the anchored rect, inherited from Control |
| `offset_bottom` | `40.0` | bottom edge of the anchored rect, inherited from Control |
| `page` | `20.0` | the grabber's fraction of the track, inherited from Range |
| `value` | `40.0` | the scroll position within `min_value`/`max_value`, inherited from Range |
| `custom_step` | `5.0` | the step used by the increment/decrement buttons and arrow keys, ScrollBar's own member |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin HScrollBar -->
Strict parsing format-checks the inherited set (1 inherited from ScrollBar, 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `HScrollBar` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

HScrollBar's lenient parser is `parseControl`, which has no field for `custom_step`,
`page`, `value` or any other Range/ScrollBar member. A malformed `custom_step =
"nope"` is dropped exactly like a well-formed one, because the reader never
looks at the key at all: only Control's own layout and theme properties
survive into the parsed node.
