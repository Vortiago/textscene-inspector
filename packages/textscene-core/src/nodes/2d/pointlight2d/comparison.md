---
type: PointLight2D
category: 2D
fixture: unit-pointlight2d.tscn
image: unit-pointlight2d
status: limitation
group: Lighting
renders_as: the light's cookie multiplied into every CanvasItem beneath it
---

# PointLight2D

PointLight2D lights the canvas with a `texture` cookie tinted by `color` and `energy`,
and draws nothing itself. The previewer accumulates each light into an offscreen buffer
that every lit CanvasItem multiplies its albedo against, which is Godot's own
arithmetic.

## Blend modes
<!-- compare: image=unit-pointlight2d-blend status=done fixture=unit-pointlight2d-blend.tscn -->

Three identical lights over one grey surface, one per `blend_mode`. ADD brightens, SUB
darkens by the same cookie and MIX interpolates toward the light, each landing on Godot.

## An inline gradient cookie, a canvas tint, and an unshaded item
<!-- compare: image=unit-pointlight2d-gradient status=done fixture=unit-pointlight2d-gradient.tscn -->

Two torches share one inline `GradientTexture2D` cookie under a CanvasModulate. The
`light_mode = 1` panel keeps its authored colour and stops the torch at its edge, as an
unshaded item does in Godot.

## Light Only items
<!-- compare: image=unit-pointlight2d-lightonly status=done fixture=unit-pointlight2d-lightonly.tscn -->

`light_mode = 2` draws an item only where a light reaches it. The two lit panels keep
their authored colour under the cookie, the unlit one draws nothing, and none of them
takes the canvas tint.

## Cull masks: which items a light reaches
<!-- compare: image=unit-pointlight2d-cull-mask status=done fixture=unit-pointlight2d-cull-mask.tscn -->

A light reaches an item only where `range_item_cull_mask` and the item's `light_mask`
share a bit. Four panels under a warm and a cool light take the warm one, the cool one,
both, or neither.

## The z window: which z planes a light reaches
<!-- compare: image=unit-pointlight2d-range-z status=done fixture=unit-pointlight2d-range-z.tscn -->

A light reaches an item only while its accumulated `z_index` lies inside `range_z_min`
to `range_z_max`, both ends inclusive. The panel at `z_index = 5` stays at the bare
canvas tint.

## The layer window: which canvases a light reaches
<!-- compare: image=unit-pointlight2d-range-layer status=done fixture=unit-pointlight2d-range-layer.tscn -->

`range_layer_min` and `range_layer_max` default to `0`, the world canvas, while a
CanvasLayer defaults to `1`. So an untouched light lights the world panel and never the
HUD panel.

## Soft shadows: shadow_filter and shadow_filter_smooth
<!-- compare: image=unit-pointlight2d-shadow-pcf5 status=done fixture=unit-pointlight2d-shadow-pcf5.tscn -->

`shadow_filter = PCF5` or `PCF13` averages taps offset in angle across Godot's polar
shadow map, so the boundary is a stepped ramp that widens with distance. The previewer
builds the same map and taps it in the light's fragment shader (ADR-0030).

## Linting

<!-- lint:begin PointLight2D -->
Strict parsing format-checks these `PointLight2D` properties, plus 15 inherited from Light2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `height` | float >= 0 | warning below |
| `offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `texture` | null, SubResource("id") or ExtResource("id") |  |
| `texture_scale` | float 0.01-50, never exactly 0 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-pointlight2d-ranges` | `pointlight2d-requires-texture` | warning |
|  | `pointlight2d-inverted-z-range` | info |
|  | `pointlight2d-inverted-layer-range` | info |
<!-- lint:end -->

`enabled` falls back to `true`, `energy` and `texture_scale` to `1.0`, `offset` to `(0,
0)` and `blend_mode` to `0` (ADD), each with a warning. `color` falls back to opaque
white silently. `texture` is stored with no reference check.

## Known limitations

- **Approximated** `shadow_item_cull_mask` selects which occluders cast, but not which
  items receive the shadow, so an item Godot would leave unshadowed is shadowed here.
- **Shader missing** A `CanvasTexture.normal_texture` is not read, so every surface
  takes the light head-on with no specular response.
- **Approximated** A MIX light in one cull-mask class over a light in another class
  reaching the same item is summed rather than applied in Godot's order.
- **Approximated** Past four distinct cull tuples on one canvas the extra lights are
  dropped with a warning.
- **Approximated** A CanvasLayer takes the layer window but still follows the 2D camera,
  where Godot draws it through its own canvas transform.
- **Approximated** A Control draws in the DOM overlay (ADR-0024), so no 2D light reaches
  one.
