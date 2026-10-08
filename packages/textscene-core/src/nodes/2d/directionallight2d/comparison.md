---
type: DirectionalLight2D
category: 2D
fixture: unit-directionallight2d.tscn
image: unit-directionallight2d
group: Lighting
renders_as: one term over the whole light buffer that every lit CanvasItem multiplies in
---

# DirectionalLight2D

DirectionalLight2D lights the whole canvas with `color` and `energy`, and draws nothing
itself. It reaches every lit item on its canvas layers whatever the item's `light_mask` or
`z_index`. The previewer adds it to the light buffer a PointLight2D uses. The three panels
take one warm light, and the clear colour below them takes none.

## Hard shadows: a parallel shadow map
<!-- compare: image=unit-directionallight2d-shadow status=done fixture=unit-directionallight2d-shadow.tscn -->

A square occluder under a light turned 0.5 rad casts a band down and to the left. Godot
measures depth along the light across the project viewport's diagonal
(`renderer_canvas_render_rd.cpp:1140-1146`). The previewer
builds the same 1D map, so the band covers the occluder's inside too. It culls an occluder
on its local bounds, as Godot does (`renderer_viewport.cpp:635`).

The map spans the project viewport at the canvas origin. In Godot's editor no Camera2D
becomes current (`camera_2d.cpp:354`), and the previewer draws the canvas as the editor
does. Every occluder casts on every lit item: the directional pass reads no
`shadow_item_cull_mask` on the item (`canvas.glsl:747`).

## Soft shadows: shadow_filter and shadow_filter_smooth
<!-- compare: image=unit-directionallight2d-shadow-pcf5 status=done fixture=unit-directionallight2d-shadow-pcf5.tscn -->

`shadow_filter = PCF5` averages five taps across the parallel map. The taps keep one width
along the whole band, unlike a point light's penumbra, which widens with distance.

## Linting

<!-- lint:begin DirectionalLight2D -->
Strict parsing format-checks these `DirectionalLight2D` properties, plus 15 inherited from Light2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `height` | float 0-1 | warning |
| `max_distance` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-directionallight2d-ranges` | `directionallight2d-inverted-layer-range` | info |
<!-- lint:end -->

`enabled` falls back to `true`, `energy` to `1.0`, `height` to `0`, `max_distance` to
`10000` and `blend_mode` to `0` (ADD), each with a warning. `color` falls back to opaque
white silently.

## Known limitations

- **Shader missing** A `CanvasTexture.normal_texture` is not read, so `height` has no effect
  and every surface takes the light head-on.
