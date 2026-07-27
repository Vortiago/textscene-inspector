---
type: PointLight2D
category: 2D
fixture: unit-pointlight2d.tscn
image: unit-pointlight2d
status: limitation
group: Lighting
renders_as: the light's texture applied against the surface beneath it
---

# PointLight2D

A 2D point light. The previewer draws the light's `texture` as a single quad, tinted
by `color × energy` and composited with the `blend_mode` (additive by default) — it does
not light other CanvasItems per-pixel. The fixture puts a warm radial cookie over a dark
`Polygon2D` surface so the glow reads against something, mirroring Godot's own
`lights_and_shadows` light texture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `texture` | `ExtResource light2d` | the 1024×1024 radial cookie drawn as the light's shape |
| `color` | `Color(1, 0.8, 0.4, 1)` | warms the glow — the additive tint |
| `energy` | `2.0` | scales the emitted colour (unclamped, so the core over-brightens) |
| `texture_scale` | `0.5` | halves the cookie to a ~512 px pool centred on the surface |

## Blend modes

<!-- compare: image=unit-pointlight2d-blend status=done fixture=unit-pointlight2d-blend.tscn -->

Three identical warm lights over one mid-grey surface, one per `blend_mode`.
ADD and SUB apply the light against the surface — `albedo × (1 ± light)` — so
the left pool brightens the grey and the middle one darkens it by the same
cookie, in the same places as Godot.

Measured mean channel error 14.3/255, and the shape of the miss is the same in
all three: our pools reach their plateau too early and hold a harder edge where
Godot keeps falling off. The cookie is sampled and blended per pixel, but the
blend clamps the light to [0, 1] BEFORE multiplying it into the surface, where
Godot clamps only afterwards — so the top of the cookie's gradient flattens.
MIX is additionally the one mode with no destination-blend identity, and reads
warmer and more opaque than Godot's.

## An inline gradient cookie, a canvas tint, and an unshaded item

<!-- compare: image=unit-pointlight2d-gradient status=done fixture=unit-pointlight2d-gradient.tscn -->

Real scenes rarely ship a light cookie as an image: they describe it inline as a
`GradientTexture2D`, which is fully contained in the scene and rasterises
without a file. Both torches here share one such cookie — rasterised once and
shared, not once per light.

The frame also carries a `CanvasModulate`, which tints the CANVAS rather than a
subtree, and a right-hand panel whose `CanvasItemMaterial` sets `light_mode = 1`.
That panel keeps its authored colour while the floor around it goes blue,
because Godot's base pass guards the tint with the item's light mode. The panel
IS still reached by the torch beside it, which Godot would exclude — that half
of `light_mode` needs the per-item light pass.

## Divergences

Both sides place a warm radial pool at the same spot and size over the same dark
surface, so position, falloff radius and blend agree, and the whole frame is
within a mean 7.5/255.

A 2D light is applied AGAINST the surface rather than painted over it: Godot's
ADD blend leaves `albedo × (1 + light)`, which `DstColorFactor` reproduces
exactly without a second pass. So the core no longer clips to a near-white
`[255, 255, 239]` the way a plain additive quad did — but it now lands *under*
Godot rather than over it, reading `[128, 128, 110]` against Godot's
`[185, 161, 126]`, and losing the warm tint at the very centre.

What is left is the rest of Godot's canvas-light pass, which a single blended
quad cannot express:

- `light_mask`, `range_item_cull_mask`, `range_layer_min/max` and
  `range_z_min/max` are parsed but not applied, so every light reaches every
  canvas item under it instead of only the ones it is masked to.
- `CanvasItemMaterial.light_mode` is only half consumed. An `Unshaded` item
  correctly skips the CanvasModulate tint, as Godot's base pass does, but a
  light quad still reaches it — excluding an item from a light needs the
  per-item pass, not a blend. A `LightOnly` item likewise still draws its base.
- `shadow_enabled` casts nothing. `LightOccluder2D` and `OccluderPolygon2D`
  parse and render their outline, but no light is occluded by them.
- `Light2D.BlendMode.MIX` has no destination-blend identity, so it stays an
  ordinary alpha blend rather than interpolating toward the light colour.

## Linting

<!-- lint:begin PointLight2D -->
Strict parsing format-checks these `PointLight2D` properties, plus 17 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `blend_mode` |
| `color` |
| `enabled` |
| `energy` |
| `offset` |
| `texture` |
| `texture_scale` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`enabled` falls back to `true`, `energy` and `texture_scale` to `1.0`, `offset` to
`(0, 0)`, and `blend_mode` to `0` (ADD) for both an absent value and an out-of-range
one. `color` also falls back to opaque white `(1, 1, 1, 1)`, but silently:
`colorOr` skips the warn-then-fallback of the other `*Or` helpers, so a malformed
color leaves no trace in the log. `texture` is stored as whatever string is
present, with no resource-reference format check.

## Known limitations

The previewer approximates a 2D light as its cookie quad; several parts of Godot's 2D
lighting model are therefore not reproduced:

- **No per-surface lighting** — the light does not modulate other CanvasItems, read their
  normal maps, or respect `light_mask` / `range` layers; it is drawn as its own quad.
- **No shadows** — `shadow_enabled` and any `LightOccluder2D` in range are ignored (see the
  LightOccluder2D sheet); the light passes through occluders.
- **`blend_mode` SUB/MIX** map onto three.js `SubtractiveBlending` / `NormalBlending`, which
  approximate but do not match Godot's 2D blend math.
- **Energy is unclamped**, so a bright light washes its core toward white rather than holding
  the emitted colour.
