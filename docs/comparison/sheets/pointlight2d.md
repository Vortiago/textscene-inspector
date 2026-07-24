---
type: PointLight2D
category: 2D
fixture: unit-pointlight2d.tscn
image: unit-pointlight2d
status: limitation
group: Lighting
renders_as: the light's texture as an additive quad tinted by color × energy
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

Both sides place a warm radial pool at the same spot and size over the same dark surface,
so position, falloff radius and blend agree. The core brightness does not. Ours drives the
additive quad by `color × energy` and clamps at the framebuffer ceiling, so the centre goes
to a near-white `[255, 255, 239]`; Godot's 2D light integrates the same cookie into a warmer
mid-tone `[184, 160, 126]` and keeps the tint through the core. The gap is the additive
model: a textured quad is a single additive pass, where Godot's light is applied against the
surface, so the warm colour survives at the centre instead of washing out.

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
