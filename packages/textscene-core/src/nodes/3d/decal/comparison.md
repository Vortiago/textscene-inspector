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
  projector shader. It is the whole of the frame's divergence and it is large:
  `pnpm ref:diff scenes/fixtures/unit-decal.tscn` reports a mean channel error of
  9.107/255 over the 955x756 frame, and `unit-decal-gradienttexture.tscn` — the
  same projection driven by an inline `GradientTexture2D` — 8.361/255, the same
  magnitude through a different texture source; the CSG fixtures measured the same
  way sit near 2/255. Inside the footprint of the latter, Godot's centre reads
  rgb(237, 165, 160) against our rgb(243, 96, 61) and its edge rgb(153, 161, 223)
  against rgb(59, 84, 221). The floor OUTSIDE the footprint matches to a single
  level, rgb(227, 230, 234) against rgb(226, 229, 233), so the projection's
  composite carries the divergence.
- **No edge fades.** `upper/lower/normal_fade`, `distance_fade_*` and `cull_mask`
  need per-fragment work the baked `DecalGeometry` mesh cannot do. They are
  near-invisible on the flat surfaces decals usually target.
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
