---
type: LightOccluder2D
category: 2D
fixture: unit-lightoccluder2d.tscn
image: unit-lightoccluder2d
group: Lighting
renders_as: a selection-gated outline of its occluder polygon, it occludes 2D light
---

# LightOccluder2D

LightOccluder2D blocks a shadow-enabled Light2D and is invisible on its own. The
previewer draws only a selection-gated outline for it and withholds the light where its
shadow falls.

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

`shadow_color` belongs to the light. It replaces the light term where the shadow falls,
and it is the one term Godot never multiplies by the item's albedo. Both images show the
same blue behind the occluder.

## The boundary under a shadow_filter
<!-- compare: image=unit-pointlight2d-shadow-pcf13 status=done fixture=unit-pointlight2d-shadow-pcf13.tscn -->

Under PCF5 or PCF13 Godot averages taps offset in angle around the light, so the same
occluder casts a stepped penumbra that widens with distance. The filter belongs to the
light, so the PointLight2D sheet shows it.

## Linting

<!-- lint:begin LightOccluder2D -->
Strict parsing format-checks these `LightOccluder2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `occluder` | null, SubResource("id") or ExtResource("id") |  |
| `occluder_light_mask` | 32-bit layer mask (layers 1-32) |  |
| `sdf_collision` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-lightoccluder2d-occluder` | `lightoccluder2d-requires-occluder` | warning |
<!-- lint:end -->

Strict rejects a non-numeric `light_mask` or `occluder_light_mask`. The lenient parser
warns and falls back to `1` for either, and an unparseable `sdf_collision` falls back to
`true`. `occluder` is copied through with no reference check.

## Known limitations

- **Shader missing** `sdf_collision` has no effect, since no signed-distance field is
  built for particle collision or SDF-lit materials.
- **Editor only** The occluder outline is selection-gated, so a still render shows none,
  as Godot's runtime does.
- **Approximated** Under a `shadow_filter` a tap lands in one of 2048 polar bins, so a
  boundary at a glancing angle can sit one bin from Godot's.
