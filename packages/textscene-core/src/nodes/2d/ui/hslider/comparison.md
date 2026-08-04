---
type: HSlider
category: 2D
status: unreviewed
fixture: unit-hslider.tscn
# image: unit-hslider
renders_as: a horizontal track with a round grabber
---

# HSlider

A horizontal slider over a `Range`. The previewer draws the same four parts
Godot does — the `slider` track, the `grabber_area` fill, any tick marks, and
the grabber — placing each with the expressions from
`Slider::_notification(NOTIFICATION_DRAW)` with the widget's pixel size left as
a CSS percentage. The grabber's left edge sits at `ratio * (width - grabber)`,
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

Godot's grabber is a **texture**, not a stylebox: `slider_grabber.svg` is a
16x16 image holding `<circle cx="8" cy="8" r="7" fill="#fefefe"
fill-opacity=".75"/>`. The previewer approximates it with a 14px `div` at
`border-radius: 50%` in `rgba(254, 254, 254, 0.75)`, offset 1px inside the 16px
box Godot's placement math addresses. The geometry and colour are therefore
exact; what is lost is the texture's own antialiasing — the browser's circle
edge is rasterised by the compositor rather than sampled from Godot's SVG, so
the one-pixel rim differs. The same substitution covers the disabled grabber
(opacity 0.37) and the tick icons, which become plain 2px bars.

The highlight grabber (`grabber_highlight`, drawn when a slider is hovered or
focused) is never used: a static preview has no pointer and no focus, so Godot
would draw the plain grabber too.

## Linting

<!-- lint:begin HSlider -->
Strict parsing format-checks the inherited set (33 inherited from Control); `HSlider` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
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
same four parts as the DOM overlay — the `slider` track, the `grabber_area`
fill, any tick marks, and the grabber, in Godot's own draw order — but the
geometry itself (`shared/sliderSolver.ts`, shared with VSlider at
`vertical = false`) is concrete pixel rects rather than CSS percentages, and the
grabber/tick are the ACTUAL vendored `slider_grabber(_disabled).svg` /
`hslider_tick.svg` textures (`native/themeIcons.ts`) rather than a synthesized
`div`.

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

- **No anti-aliased corner feather** on the track/fill roundrect corners —
  `styleBoxFlatGeometry.ts` implements Godot's non-anti-aliased `StyleBoxFlat`
  branch (see `panel/comparison.md`'s identical note); Godot's actual default
  is `anti_aliased = true`. Not fixed here — a pre-existing, cross-cutting
  parity item this slice inherits rather than introduces.
- **`ticks_position` is not modelled.** `shared/slider.ts` parses only
  `tick_count`/`ticks_on_borders`/`editable`, so every tick draws at Godot's
  own default, `TICK_POSITION_BOTTOM_RIGHT` (below the track). No corpus
  fixture overrides `ticks_position`.
