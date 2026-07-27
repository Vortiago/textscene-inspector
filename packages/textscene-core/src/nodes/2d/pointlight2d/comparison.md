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
