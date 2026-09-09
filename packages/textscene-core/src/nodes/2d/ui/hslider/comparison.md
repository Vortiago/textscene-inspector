---
type: HSlider
category: 2D
status: unreviewed
fixture: unit-hslider.tscn
image: unit-hslider
renders_as: a horizontal track with a round grabber
---

# HSlider

HSlider is a horizontal slider over a Range. The previewer draws the same four parts
Godot does: the track, the fill, the tick marks and the grabber. Each is placed with the
expressions from Godot's own draw routine.

## Linting

<!-- lint:begin HSlider -->
Strict parsing format-checks the inherited set (5 inherited from Slider, 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `HSlider` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
| `hslider-property-order` | `hslider-property-order` | warning |
<!-- lint:end -->

`value`, `min_value`, `max_value` and `step` have no strict counterpart and go through
the optional-float reader. An unparseable number becomes `undefined` and the slider
takes Godot's defaults of 0, 0 and 100. A `value` outside the range is clamped silently,
and a malformed `tick_count` draws no ticks.

## Known limitations

- **Approximated** The grabber is a CSS circle rather than Godot's rasterised SVG
  texture, so its one-pixel rim differs. The tick icons become plain 2 px bars.
