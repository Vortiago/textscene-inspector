---
type: HScrollBar
category: 2D
status: unreviewed
fixture: unit-h-scroll-bar.tscn
image: unit-h-scroll-bar
renders_as: a horizontal track with a rectangular grabber
---

# HScrollBar

HScrollBar is a horizontal track with a draggable grabber and step buttons. The
previewer draws the track and the grabber, sized and positioned from this bar's own
`value`, `min_value`, `max_value` and `page`. Godot's own default theme sets every
increment and decrement icon to an empty texture, so neither Godot nor the previewer
draws step buttons.

## Linting

<!-- lint:begin HScrollBar -->
Strict parsing format-checks the inherited set (1 inherited from ScrollBar, 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `HScrollBar` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

The lenient parser is `parseHScrollBar`, which reuses the shared `Range` reader for
`value`, `min_value`, `max_value` and `page`, plus its own `custom_step`. A malformed
number becomes `undefined` and the bar falls back to Godot's own Range defaults: min
0, max 100, value 0, page 0. `custom_step` never reaches a draw formula, so a malformed
one stays harmless here too.
