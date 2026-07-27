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

A 2D point light. It draws nothing on the canvas itself, as Godot's lights do not:
its `texture` cookie, tinted by `color × energy`, accumulates into an offscreen
buffer that every lit CanvasItem multiplies its albedo against. The fixture puts a
warm radial cookie over a dark `Polygon2D` surface so the glow reads against
something, mirroring Godot's own `lights_and_shadows` light texture.

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
Every mode is applied against the surface rather than painted over it —
`albedo × (canvas_modulation ± light)` — so the left pool brightens the grey and
the middle one darkens it by the same cookie, in the same places as Godot.

Each mode is one fixed-function blend against the accumulator, so all three land
on Godot: `SrcAlpha/One` added for ADD, the same term reverse-subtracted for SUB,
and `SrcAlpha/OneMinusSrcAlpha` for MIX, which is `mix(dst, src, srcAlpha)`
exactly. Mean channel error 0.49/255 over the frame.

MIX is the one mode whose result depends on the ORDER lights are applied, since
it interpolates the accumulator rather than adding to it. The quads therefore
sort with three's transparent list, which is farthest-first and so replays them
in canvas draw order.

## An inline gradient cookie, a canvas tint, and an unshaded item

<!-- compare: image=unit-pointlight2d-gradient status=done fixture=unit-pointlight2d-gradient.tscn -->

Real scenes rarely ship a light cookie as an image: they describe it inline as a
`GradientTexture2D`, which is fully contained in the scene and rasterises
without a file. Both torches here share one such cookie — rasterised once and
shared, not once per light.

The frame also carries a `CanvasModulate`, which tints the CANVAS rather than a
subtree, and a right-hand panel whose `CanvasItemMaterial` sets `light_mode = 1`.
That panel keeps its authored colour while the floor around it goes blue, and the
torch beside it stops dead at its edge — Godot's base pass guards both the tint
and the light loop with the item's light mode, and an `Unshaded` item is excluded
from each. Mean channel error 0.09/255.

## Light Only items

<!-- compare: image=unit-pointlight2d-lightonly status=done fixture=unit-pointlight2d-lightonly.tscn -->

`CanvasItemMaterial.light_mode = 2` draws an item ONLY where a light reaches it.
Three identical warm panels sit on a dark backdrop under a blue `CanvasModulate`:
the left one is masked by an ADD torch, the middle by a MIX torch, and the right
one has no light on it at all and so renders as nothing.

The mask is an alpha, not a recolouring — a Light Only panel keeps its authored
colour where the cookie is opaque and fades out where it is not, which is why
the panels read orange rather than warm-white. The other Godot rule visible here
is that a Light Only item skips the canvas tint: the panels are not blue, while
the floor strip above them is.

Not shown, but measured against the engine: the coverage is the plain SUM of every
cookie alpha over the item, so overlapping lights saturate the mask instead of
screening into it (three cookies at alpha 0.3 mask to 0.9, not 0.657).

## Divergences

The light is no longer a quad on the canvas. Lights accumulate into an offscreen
half-float buffer and every lit CanvasItem multiplies its own albedo by what that
buffer holds beneath it, which is the collapse `canvas.glsl` itself performs —
so falloff, tint, energy and all three blend modes come out of the same arithmetic
Godot runs, in the same sRGB space, clamped at the same point.

Measured mean channel error against the engine, over the whole frame:

| Sheet | Mean | Pixels off by > 16/255 |
| --- | --- | --- |
| `unit-pointlight2d` | 0.32/255 | 0.0% |
| `unit-pointlight2d-blend` | 0.49/255 | 0.0% |
| `unit-pointlight2d-gradient` | 0.09/255 | 0.0% |
| `unit-pointlight2d-lightonly` | 0.43/255 | 0.0% |

What is left unimplemented:

- `light_mask`, `range_item_cull_mask`, `range_layer_min/max` and
  `range_z_min/max` are parsed but not applied, so every light reaches every
  canvas item under it instead of only the ones it is masked to. Each distinct
  cull-mask class needs its own accumulation.
- `shadow_enabled` casts nothing. `LightOccluder2D` and `OccluderPolygon2D`
  parse and render their outline, but no light is occluded by them.
- Normal-mapped and specular response (`Light2D` against a
  `CanvasTexture.normal_texture`) is not computed; every surface takes the light
  head-on.
- A `Control` draws in the DOM overlay rather than on the WebGL canvas
  (ADR-0024), so no 2D light reaches one. Godot's own `light2d_as_mask` demo
  masks a `TextureRect` this way.

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
