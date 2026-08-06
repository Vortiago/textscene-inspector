---
type: VSlider
category: 2D
status: unreviewed
fixture: unit-vslider.tscn
# image: unit-vslider
renders_as: a vertical track with a round grabber
---

# VSlider

A vertical slider over a `Range`, drawn from the same four parts as HSlider.
The axis is what differs: Godot places the grabber at
`size.height - ratio * areasize - grabber_height`, which measured from the
bottom edge is `ratio * areasize` — so `value = min_value` sits at the BOTTOM
and `max_value` at the top, and the `grabber_area` fills upward from the bottom.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| (defaults) on `AtBottom` | value 0, min 0, max 100 | grabber at the bottom, fill reduced to its half-grabber stub |
| `value` | `50.0` on `AtMiddle` | grabber mid-track, fill covering the lower half |
| `value` | `100.0` on `AtTop` | grabber at the top, track fully filled |
| `tick_count` + `ticks_on_borders` | `5` + `true` on `TickedAtMiddle` | five tick bars across the track |
| `alignment` | `1` on the HBoxContainer | centres the four sliders as a group |
| `theme_override_constants/separation` | `48` | the gap between them |

## Divergences

None measurable in this fixture. `pnpm ref:godot
scenes/fixtures/unit-vslider.tscn --mode 2d` and `pnpm ref:ours unit-vslider.tscn
--2d` differ on ZERO pixels under the visual harness's tolerance, at a mean
channel error of 0.03/255 over the frame — the grabber is the same
`slider_grabber` texture HSlider's sheet measures, not a substitute shape.

Tick marks are NOT mirrored with the value axis. Godot's vertical tick loop
computes `ofs = i * areasize / (ticks - 1) + grabber_offset` and draws downward
from the widget's top edge, while the grabber is measured upward from the
bottom; the previewer reproduces that asymmetry rather than tidying it. Godot
also anchors the 16px tick texture at the track's leading edge
(`(size.width - widget_width) / 2`) rather than centring it, so a tick overhangs
one side of the 8px track — again reproduced, not corrected.

Those px are the `gui/theme/default_theme_scale = 1` case; the previewer reads
the same scaled metrics Godot bakes into its theme, so a 2.0 project gets a 16px
track and a 32px grabber on both sides. See the HSlider sheet.

## Linting

<!-- lint:begin VSlider -->
Strict parsing format-checks the inherited set (35 inherited from Control); `VSlider` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`VSlider` has no strict counterpart for the `Range` or `Slider` properties, and
behaves exactly as HSlider does when they are malformed: an unparseable `value`,
`min_value`, `max_value` or `step` becomes `undefined` and falls back to Godot's
defaults (0, 0, 100), so a typo'd `value` renders as a grabber resting at the
bottom rather than as an error. Out-of-range values are clamped silently and a
degenerate range renders as fully filled, both matching the engine.

## Native (WebGL canvas) painter

`nativeSolver.ts` registers `Slider::get_minimum_size()`
(`controlSolverRegistry.registerMinimumSize`); `Component.tsx` is
HSlider's identical painter at `vertical = true` (`shared/sliderSolver.ts`,
shared by both slices), drawing the actual vendored `slider_grabber(_disabled).svg`
/ `vslider_tick.svg` textures rather than a synthesized `div`. The axis swap —
grabber BOTTOM at `value = min_value`, TOP at `max_value`; ticks marching from
the widget's leading edge, not mirrored with the value axis — is the shared
solver's own `vertical` branch, proved once against real Godot in
`shared/sliderSolver.test.ts`.

### One metric worth naming

**The tick's cross-axis length is 8px, not 16px** — see the HSlider sheet's
identical note (`vslider_tick.svg` is `hslider_tick.svg`'s transpose, `width="8"
height="4"`, measured the same way against real Godot 4.6.3). Otherwise none.

### Known limitations (native only)

`ticks_position` is not modelled: every tick draws at Godot's default,
`TICK_POSITION_BOTTOM_RIGHT` — right of the track for a vertical slider. See
the HSlider sheet.
