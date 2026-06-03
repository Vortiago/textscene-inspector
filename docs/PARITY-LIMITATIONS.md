# Godot → three.js parity limitations

Known cases where the renderer **cannot reproduce Godot exactly** because of
three.js platform constraints. Everything else in materials + primitive meshes
was verified faithful against the Godot 4.4 spec in the parity audit (2026-06-03,
23 confirmed divergences — 19 fixed, the 4 below recorded here).

Each item below is harmless for the scenes shipped today. This catalogue exists
so divergences are **recorded, not discovered by eye** — if a render ever looks
wrong in one of these areas, this is the first place to check.

## StandardMaterial3D

### Metallic / roughness texture channel  *(audit #9, #10)*
Godot reads the channel named by `metallic_texture_channel` /
`roughness_texture_channel` (default `RED`). three.js's
`MeshStandardMaterial.metalnessMap` / `roughnessMap` read **fixed** channels —
BLUE for metalness, GREEN for roughness.

- **Faithful when:** the source map is grayscale (R = G = B), or already uses the
  matching channel (the common ORM packing: roughness in G, metalness in B).
- **Diverges when:** a dedicated map packs the data in RED with differing other
  channels — metalness/roughness will be misread.
- **Why not fixed:** a faithful fix requires runtime channel-swizzling (canvas
  read-back, doesn't run in the test env) or a custom shader — disproportionate
  for an uncommon case.
- Site: `nodes/3d/meshinstance3d/Component.tsx` (roughnessMap / metalnessMap).

### Emission operator = ADD  *(audit #11)*
With `emission_operator = ADD` (Godot default) **and** both a colored `emission`
and an `emission_texture`, Godot computes `(emission + tex) * energy`. three.js's
`emissiveMap` is multiply-only (`emissive * intensity * tex`), so the additive
form can't be reproduced.

- **Faithful when:** `emission_operator = MULTIPLY`, or there is no emission_texture.
- **Why not fixed:** three.js has no additive emissive-map mode without a custom shader.
- Site: `r3f/materials/standardMaterialScalars.ts` (emission block).

### uv1_offset under world-triplanar  *(audit #22)*
`uv1_offset` is applied as a three.js UV-space offset. Under
`uv1_world_triplanar`, Godot's offset is in **world units**, so a non-zero offset
would shift the texture by a different amount than Godot.

- **Impact today:** zero — no shipped `.tscn` sets `uv1_offset`.
- **Why not fixed:** the world-unit → UV-space conversion under triplanar is
  unverifiable without a visual Godot reference, and shipping an unverified
  formula for a zero-impact case adds risk for no benefit.
- Site: `nodes/3d/meshinstance3d/Component.tsx` (uvTransform).

### WorldEnvironment volumetric fog  *(audit #11)*
Godot has two fog systems. **Screen-space fog** (`fog_enabled`/`fog_density`/`fog_light_color`/`fog_mode`) maps to `THREE.FogExp2` and is supported. **Volumetric fog** (`volumetric_fog_*`, a froxel-based 3D scattering effect) has no three.js equivalent and is intentionally **not** applied to `scene.fog` — its density scale differs by orders of magnitude, so approximating it with FogExp2 produced wildly over-dense fog. Screen-space `FOG_MODE_DEPTH` (1) is approximated with the same density-based exponential fog (no separate linear depth params).

## Meshes

### CylinderMesh single-cap removal  *(parity batch)*
three.js `CylinderGeometry.openEnded` removes **both** caps or neither. A Godot
cylinder with exactly one of `cap_top` / `cap_bottom` disabled renders with both
caps (the closest representable result); both-off correctly opens the ends.

### Triplanar on non-planar meshes  *(WI-HALL-5)*
`uv1_triplanar` tiling **density** is reproduced exactly for planar meshes
(`repeat = size × uv1_scale`). Curved / GLB geometry falls back to the mesh's own
UVs (approximate) — a true 3-axis triplanar shader is out of scope.
