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
| `cull_mask` | `1048575` | which `VisualInstance3D.layers` may receive — here, all of them |

## Render layers

Godot draws a decal on an instance only where `decal.cull_mask &
instance.layer_mask` is non-zero — the pairing cull in
`renderer_scene_cull.cpp` and, per fragment, the `continue //not masked` guard
in `scene_forward_clustered.glsl`. Defaults are `cull_mask = 1048575`
(`Decal::cull_mask = (1 << 20) - 1`) and `layers = 1`, so an unmasked decal
reaches everything.

That mask is what lets a moving object carry its own blob-shadow decal: the blob
is meant for the ground, and clearing the object's own layer keeps it off the
object. Ignoring it stamps the blob onto the caster, which reads as the caster
being far too dark on exactly the faces the blob covers — the whole of #375.

We apply the same test when the receiver set is collected (`decalProjection.ts`),
which is exact rather than approximate: no per-fragment work is needed, because
a culled receiver simply never gets a projection mesh baked for it. The fixture
above leaves every layer enabled, so it cannot witness the mask; the dedicated
one is `unit-decal-cull-mask.tscn`, which puts a `layers = 2` receiver and a
default-layer control under the same masked decal.

`layers` is read from `MeshInstance3D`. Every other mesh source — CSG, GridMap,
Sprite3D, Label3D, MultiMeshInstance3D — reads as Godot's default layer 1 and so
receives from any decal that has not cleared layer 1. That is correct unless the
scene sets `layers` on one of them. Two cases in this corpus do and are not
covered: `GPUParticles3D` in `demos/3d/particles/test.tscn`, whose scene's decals
are unmasked so nothing changes; and a mesh inside an instanced GLB, whose
`layers` rides a type-less override node that the scene-tree builder drops before
the GLB renderer ever sees it (the platformer player's `Robot`). Neither is
visible today.

## Divergences

The projection lands in the same place on both sides — flat on the floor where
the box intersects it. Two differences remain, both in the blend rather than the
geometry:

- **Ours reads bolder than Godot's.** Godot fades the projection into the lit
  floor more than we do at a partial `albedo_mix`, so its checkerboards are
  paler; ours are higher-contrast. Exact `albedo_mix` blending needs a custom
  projector shader.
- **No edge fades.** `upper/lower/normal_fade` and `distance_fade_*` need
  per-fragment work the baked `DecalGeometry` mesh cannot do. Godot's fade is an
  exponent on distance along the projection axis (`upper_fade` above the origin,
  `lower_fade` below) plus a `normal_fade` smoothstep against the projector's
  own normal. They are near-invisible on the flat surfaces decals usually
  target: where the corpus's blob shadows legitimately land, the fade term
  computes to ~0.9–1.0.
- **The normal/ORM/emission maps and `emission_energy` are parsed but unwired.**
  The projection is already a `MeshStandardMaterial`, which supports every one of
  them; `DecalGeometry` supplies vertices only and does not constrain this.
  `createStandardMaterial` does the same slot wiring for every other mesh.

## Linting

<!-- lint:begin Decal -->
Strict parsing format-checks these `Decal` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `albedo_mix` |
| `cull_mask` |
| `emission_energy` |
| `lower_fade` |
| `modulate` |
| `normal_fade` |
| `size` |
| `texture_albedo` |
| `texture_emission` |
| `texture_normal` |
| `texture_orm` |
| `upper_fade` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-decal-resources` | `decal-requires-texture` | warning |
|  | `valid-decal-resources` | error |
<!-- lint:end -->

`size` falls back to Godot's default `Vector3(2, 2, 2)` with a `[Decal] Failed to parse size` warning when present but malformed. The five fade/blend floats (`albedo_mix`, `emission_energy`, `normal_fade`, `upper_fade`, `lower_fade`) and `cull_mask` fall back the same way, via `floatOr`/`intOr`, to `1`, `1`, `0`, `0.3`, `0.3`, and `1048575`. `modulate` falls back to opaque white on any malformed `Color`, but silently, since `parseColor` never warns. The four `texture_*` references are copied through unvalidated whenever present and simply omitted when absent; the lenient parser never rejects a malformed resource path the way `valid-decal-resources` does.
