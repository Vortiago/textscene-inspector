---
type: Decal
category: 3D
fixture: unit-decal.tscn
image: unit-decal
renders_as: a texture projected onto the surfaces its box intersects
---

# Decal

Godot's texture projector: it casts `texture_albedo` down the node's local −Y
axis onto whatever surfaces sit inside its `size` box, blended onto the lit
surface. The previewer now does the same — it bakes the projection onto each
mesh the box overlaps (three's `DecalGeometry`) and shades it with the scene's
lights, so the checkerboards lie flat on the floor rather than floating. The
projector-box outline is selection-gated (ADR-0018), so the default render shows
only the projection, as Godot's runtime does.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `texture_albedo` | `checkerboard.svg` | the image projected onto the floor |
| `size` | `Vector3(3, 3, 3)` | the projection footprint and its depth into the surface |
| `albedo_mix` | `1.0` / `0.7` | how strongly the projection replaces the lit surface |
| `modulate` | `Color(1, 0.4, 0.3, 0.8)` | salmon tint + lower opacity on the second decal |

## Divergences

The projection lands in the same place on both sides — flat on the floor where
the box intersects it. Two differences remain, both in the blend rather than the
geometry:

- **Ours reads bolder than Godot's.** Godot fades the projection into the lit
  floor more than we do at a partial `albedo_mix`, so its checkerboards are
  paler; ours are higher-contrast. Exact `albedo_mix` blending needs a custom
  projector shader.
- **No edge fades or extra channels.** `upper/lower/normal_fade`,
  `distance_fade_*`, `cull_mask`, and the normal/ORM/emission maps are not
  applied — `DecalGeometry` bakes a static mesh with none of them. They are
  near-invisible on the flat surfaces decals usually target.
