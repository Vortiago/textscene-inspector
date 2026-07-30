---
type: LightOccluder2D
category: 2D
fixture: unit-lightoccluder2d.tscn
image: unit-lightoccluder2d
status: limitation
group: Lighting
renders_as: a selection-gated outline of its occluder polygon; it occludes 2D light
---

# LightOccluder2D

In Godot a LightOccluder2D is invisible on its own — it blocks a shadow-enabled `Light2D`,
carving a shadow out of the lit surface. The previewer does the same: the occluder itself
draws only a selection-gated outline gizmo, while the shadow it casts is withheld from the
light's contribution (a stencilled volume at `shadow_filter = NONE`, a sampled polar map
under PCF5/PCF13). The fixture lights a dark `Polygon2D` surface with a
shadow-enabled `PointLight2D` and drops an 80×80 square occluder in the light's path, so the
shadow is the whole point of the comparison.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `occluder` | `SubResource OccluderPolygon2D` | the 80×80 square that blocks light in Godot |
| `Lamp.shadow_enabled` | `true` | turns on the light's shadow pass (Godot only) |

## Divergences

This is the sheet's headline gap, not a subtle shift. Godot casts a clear dark wedge from the
occluder away from the lamp; ours casts none — the square passes the light straight through.
The occluder polygon is invisible in both captures (Godot never draws it; ours gates its
outline behind selection, and nothing is selected in a render). What is left is the light
pool, which diverges the same way the PointLight2D sheet measures: at a lit point clear of
the occluder ours reads `[246, 246, 255]` against Godot's `[151, 151, 178]`, the additive
quad over-brightening the surface.

## A single occluder edge
<!-- compare: image=unit-lightoccluder2d-shadow status=done fixture=unit-lightoccluder2d-shadow.tscn -->

## A closed occluder polygon
<!-- compare: image=unit-lightoccluder2d-shadow-closed status=done fixture=unit-lightoccluder2d-shadow-closed.tscn -->

## cull_mode
<!-- compare: image=unit-lightoccluder2d-cull-mode status=done fixture=unit-lightoccluder2d-cull-mode.tscn -->

## The same polygon, wound the other way
<!-- compare: image=unit-lightoccluder2d-cull-mode-reversed status=done fixture=unit-lightoccluder2d-cull-mode-reversed.tscn -->

## What does not cast
<!-- compare: image=unit-lightoccluder2d-shadow-mask status=done fixture=unit-lightoccluder2d-shadow-mask.tscn -->

## Two shadowed lights over one occluder
<!-- compare: image=unit-lightoccluder2d-two-lights status=done fixture=unit-lightoccluder2d-two-lights.tscn -->

## shadow_color
<!-- compare: image=unit-lightoccluder2d-shadow-color status=done fixture=unit-lightoccluder2d-shadow-color.tscn -->

`shadow_color` belongs to the LIGHT, not the occluder, and it replaces the light term
instead of withholding it — `light_shadow_compute` is `mix(light_color, shadow_color,
shadow)` after `shadow_color.a *= light_color.a`, so a fully shadowed pixel emits
`vec4(shadow_color.rgb, shadow_color.a * cookie.a)`. The light's own colour, its energy
and the cookie's rgb all drop out.

It is also the only light term Godot does not multiply by the item's albedo: the mix runs
after `light_color.rgb *= base_color.rgb` and overwrites rgb outright. Measured over two
surfaces of 0.25 and 0.75 albedo inside one shadow at equal distance, Godot adds the same
15/255 to each, where an albedo-scaled term would have added three times more to the
second. So it accumulates into a buffer of its own and lands after the albedo multiply.

The fixture puts a warm `energy = 1.5` lamp behind a blue `shadow_color`, which is what
makes the three channels a proof rather than a coincidence: behind the occluder Godot reads
`rgb(79, 101, 171)` over an unlit `rgb(63, 63, 63)`, and dividing each channel by its
`shadow_color` component gives 0.418 / 0.426 / 0.424 — one cookie alpha, with no trace of
the lamp's colour or its energy.

## The boundary under a shadow_filter
<!-- compare: image=unit-pointlight2d-shadow-pcf13 status=done fixture=unit-pointlight2d-shadow-pcf13.tscn -->

An occluder's boundary is only an EDGE while the light leaves `shadow_filter` at its
`NONE` default. Under PCF5/PCF13 Godot averages five or thirteen `step()` taps offset in
ANGLE around the light, so the same occluder casts a stepped penumbra that widens with
distance — 19.4 px of half-width at axis distance 276 and 40.5 px at 576, for a PCF5 light
at `shadow_filter_smooth = 8`. The property belongs to the LIGHT, so the measured transects
and the mechanism live in the PointLight2D sheet; what matters here is that the occluder
geometry is identical either way, and the fixtures on this sheet are all filter-NONE, which
is why every wedge above reads as a one-pixel step.

## Linting

<!-- lint:begin LightOccluder2D -->
Strict parsing format-checks these `LightOccluder2D` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `occluder` | SubResource("id") or ExtResource("id") |
| `occluder_light_mask` | 32-bit layer mask (layers 1-32) |
| `sdf_collision` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Strict rejects a non-numeric `light_mask` or `occluder_light_mask`; the lenient parser
warns and falls back to `1` for either. An unparseable `sdf_collision` warns and falls
back to `true`. `occluder` is copied through unvalidated: the lenient parser never checks
it is a resource reference at all, so a malformed value simply flows into rendering as-is.

## Known limitations

- **`sdf_collision` has no effect.** Godot's SDF path serves GPUParticles2D collision and
  `light_mode = SDF` shading, neither of which the previewer implements. The property is
  validated and otherwise inert.
- **The outline is selection-gated**, so it appears only when the node is selected in the
  editor and never in a still render — matching Godot, which draws nothing for the occluder
  at runtime.
- **The umbra boundary is exact; the penumbra is quantised.** Under a `shadow_filter` the
  previewer samples the same 2048-bin polar map Godot rasterises, so a tap lands in a bin
  rather than on a continuous angle. The step POSITIONS match the engine; a boundary at a
  glancing angle can differ by one bin.
