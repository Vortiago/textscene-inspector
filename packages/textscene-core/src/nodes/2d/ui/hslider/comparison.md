---
type: HSlider
category: 2D
status: unreviewed
fixture: unit-hslider.tscn
image: unit-hslider
renders_as: a horizontal track with a round grabber
---

# HSlider

A horizontal slider over a `Range`. The previewer draws the same four parts
Godot does — the `slider` track, the `grabber_area` fill, any tick marks, and
the grabber — placing each with the expressions from
`Slider::_notification(NOTIFICATION_DRAW)`. The grabber's left edge sits at
`ratio * (width - grabber)`,
so the default `value = min_value` puts it hard against the left end.

Every px below is the `gui/theme/default_theme_scale = 1` case. Godot bakes that
scale into the theme it builds at startup — rounding each stylebox margin and
radius by it, and rasterising each icon at it — so a project setting 2.0 gets a
16px track and a 32px grabber, and the previewer reads the same scaled metrics.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| (defaults) on `AtMinimum` | value 0, min 0, max 100 | grabber at the far left, only the half-grabber fill stub behind it |
| `value` | `25.0` on `AtQuarter` | grabber a quarter of the way along the travel |
| `value` | `100.0` on `AtMaximum` | grabber at the far right, track fully filled |
| `min_value` / `max_value` / `value` | `-50` / `50` / `0` on `ShiftedRange` | ratio is 0.5, so a mid-range value lands mid-track, not at the left |
| `tick_count` + `ticks_on_borders` | `5` + `true` on `Ticked` | five tick bars, the first and last included |
| `editable` | `false` on `Disabled` | the grabber drops from 0.75 to 0.37 opacity |
| `theme_override_constants/separation` | `24` | the gap between the six sliders |

## Divergences

None measurable in this fixture. `pnpm ref:godot
scenes/fixtures/unit-hslider.tscn --mode 2d` and `pnpm ref:ours unit-hslider.tscn
--2d` differ at a mean channel error of 0.07/255 over the frame — the grabber is
Godot's own `slider_grabber` texture on both sides, not a substitute shape. Its core reads
rgb(223, 223, 223) against rgb(222, 222, 222) (`--probe 305,80`) and the rim
pixel Godot's SVG antialiases reads rgb(218, 218, 218) against rgb(214, 214, 214)
(`--probe 301,80`); the six rows land on identical scanlines, y 33..46, 73..86,
113..126, 153..166, 193..211, 233..246.

The highlight grabber (`grabber_highlight`, drawn when a slider is hovered or
focused) is never used: a static preview has no pointer and no focus, so Godot
would draw the plain grabber too.

## Linting

<!-- lint:begin HSlider -->
Strict parsing format-checks the inherited set (35 inherited from Control); `HSlider` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `control-property-order` (type-family match) | `control-property-order` | warning |
| `hslider-property-order` | `hslider-property-order` | warning |
<!-- lint:end -->

`HSlider` has no strict counterpart for the `Range` or `Slider` properties.
`value`, `min_value`, `max_value` and `step` all go through the optional-float
reader, so an unparseable number becomes `undefined` and the slider falls back
to Godot's own defaults (0, 0, 100) rather than reporting the bad value — a
typo'd `value` therefore renders as a grabber at the minimum, not as an error.
A `value` outside `[min_value, max_value]` is clamped silently, and an inverted
range where `min_value` equals `max_value` renders as fully filled, both
matching the engine. `tick_count` reads through the optional-int reader, so a
malformed count draws no ticks instead of warning.

## Native (WebGL canvas) painter

`nativeSolver.ts` registers `Slider::get_minimum_size()`
(`controlSolverRegistry.registerMinimumSize`); `Component.tsx` draws the
four parts Godot draws — the `slider` track, the `grabber_area` fill, any tick
marks, and the grabber, in Godot's own draw order. The geometry
(`shared/sliderSolver.ts`, shared with VSlider at `vertical = false`) is
concrete pixel rects, and the grabber/tick are the ACTUAL vendored
`slider_grabber(_disabled).svg` / `hslider_tick.svg` textures
(`native/themeIcons.ts`).

### Divergences from Godot

None known: the tick's cross-axis length is 8px (`SLIDER_TICK_CROSS_AXIS`,
`shared/sliderSolver.ts`) — Godot's `hslider_tick.svg` declares an 8px-tall
canvas (`width="4" height="8"`); the path inside draws past that (`y="16"`),
but Godot's SVG rasteriser clips to the declared canvas, so the texture
Slider actually draws is 8px tall, matching real Godot 4.6.3 pixels
(`pnpm ref:godot` against a probe scene with `tick_count` set). `sliderStyleBox`
builds the identical `style_normal_color` / `style_progress_color` fills, and
every rect this painter draws is transcribed straight from
`Slider::_notification(NOTIFICATION_DRAW)`.

### Known limitations (native only)

- **`ticks_position` is not modelled.** `shared/slider.ts` parses only
  `tick_count`/`ticks_on_borders`/`editable`, so every tick draws at Godot's
  own default, `TICK_POSITION_BOTTOM_RIGHT` (below the track). No corpus
  fixture overrides `ticks_position`.
