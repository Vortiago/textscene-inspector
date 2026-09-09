---
type: VSlider
category: 2D
status: unreviewed
fixture: unit-vslider.tscn
image: unit-vslider
renders_as: a vertical track with a round grabber
---

# VSlider

A vertical slider over a `Range`, drawn from the same four parts as HSlider. Godot measures travel from the bottom, so `value = min_value` puts the grabber at the bottom and the fill grows upward. The previewer draws the track, fill, grabber and ticks the same way.

## Linting

<!-- lint:begin VSlider -->
Strict parsing format-checks the inherited set (5 inherited from Slider, 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `VSlider` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
| `vslider-property-order` | `vslider-property-order` | warning |
<!-- lint:end -->

The lenient parser has no strict counterpart for the `Range` and `Slider` keys. An unparseable `value`, `min_value` or `max_value` becomes `undefined` and Godot's defaults of 0, 0 and 100 apply, so a typo'd `value` draws the grabber at the bottom. Out-of-range values are clamped silently, as the engine does.

## Known limitations

- **Approximated** The grabber is a 14px CSS disc standing in for the 16x16 `slider_grabber` texture, so its edge antialiasing differs.
