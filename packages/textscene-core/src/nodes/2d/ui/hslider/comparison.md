---
type: HSlider
category: 2D
status: done
fixture: unit-hslider.tscn
image: unit-hslider
renders_as: a horizontal track with a round grabber
---

# HSlider

HSlider is a horizontal slider over a Range. The previewer draws the four parts Godot
does: the track, the fill, the tick marks and the grabber.

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

- **Not drawn** Slider's RTL arms that need pointer or gamepad state: the drag
  origin and motion (slider.cpp:77,116), the `ui_left`/`ui_right` step (:144,160)
  and its joypad repeat (:216,224). The `grabber_area` fill and the grabber icon
  (:331-339,363) both follow the layout direction.
