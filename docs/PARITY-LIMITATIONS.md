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

## Transforms (Node2D / Node3D)

### Node2D.skew  *(audit #34)*
Godot's `skew` shears the local `Transform2D` (the Y basis is rotated by
`rotation + skew`, the X basis by `rotation` only), producing a parallelogram.
That is a **non-PRS** matrix; our 2D nodes map to an R3F `<group>`'s
position/rotation/scale, which can't express a shear. `skew` is parsed but not
applied.

- **Impact today:** zero — no shipped `.tscn` sets `skew`.
- **Why not fixed:** applying it needs a raw `Matrix4` on the group
  (`matrixAutoUpdate = false` + a ref), and the correct shear sign under our
  `F = diag(1,-1,1)` conjugation can't be confirmed without a visual Godot
  reference. Shipping an unverified shear for a zero-impact case adds risk.
- Site: `r3f/node2dTransform.ts` (`node2dGroupProps`).

### Node2D.z_as_relative = false  *(audit #35)*
`z_as_relative` defaults to **true** — effective Z = parent Z + `z_index` — and
that case **is** faithful: our 2D groups nest, so three.js accumulates each
ancestor's Z additively. With `z_as_relative = false` Godot makes `z_index`
**absolute** (independent of ancestors); we have no absolute-Z channel, so the Z
still accumulates.

- **Impact today:** zero — no shipped `.tscn` sets `z_as_relative = false`.
- **Why not fixed:** absolute Z needs a `CanvasItemZContext` threading the
  accumulated parent Z through the whole 2D subtree so a node can subtract it —
  invasive for a rare, visually-subtle draw-order flag.
- Site: `nodes/base/node2d/Component.tsx` (group Z).

### Node3D.top_level  *(audit #37)*
With `top_level = true` a Node3D ignores all ancestor transforms (its local and
global transforms are identical). Our renderer nests every node in its parent's
`<group>`, so the parent transform is always inherited.

- **Impact today:** zero — no shipped `.tscn` sets `top_level`.
- **Why not fixed:** R3F/three.js inherit `matrixWorld` from the parent; ignoring
  it requires an imperative `updateMatrixWorld` override (or walking the ancestor
  chain to fold in the inverse-parent transform) that the declarative `<group>`
  model can't express cleanly — disproportionate for a zero-impact flag.
- Site: `nodes/base/node3d/Component.tsx` (child group nesting).

## Lights

### SpotLight3D.spot_angle_attenuation → penumbra  *(audit #15)*
Godot's cone-edge softness is `pow(spot_rim, spot_angle_attenuation)` — a curve
with no exact three.js analogue (three.js `SpotLight.penumbra` is a single 0..1
softness). We approximate with `penumbra = 1 / (spot_angle_attenuation + 1)`,
which is monotonic (higher exponent → harder edge) and lands the Godot default
(`spot_angle_attenuation = 1.0`) at `penumbra = 0.5` — a moderately soft edge.

- **Impact:** shipped spotlights render with a soft cone edge by default (vs the
  old hardcoded near-hard `0.1`). Visually verified acceptable on the ld58
  hallway; the absolute default (0.5) is pinned by a test.
- **Why not exact:** the exponent→softness relationship is non-linear and has no
  closed-form three.js equivalent; the mapping is a deliberate approximation.
- Site: `nodes/3d/lights/spotlight3d/Component.tsx` (penumbra derivation).

## Control / Theme (StyleBox)

### TextureRect absent stretch_mode → `contain` (not Godot's STRETCH_SCALE)  *(deliberate)*
Godot's `TextureRect.stretch_mode` default is `STRETCH_SCALE` (0 → CSS `fill`).
We instead default an **absent** `stretch_mode` to `object-fit: contain` so a
texture fits its box rather than stretching to fill it. This deliberately
deviates from Godot's documented default to fix the DialogSystem portrait
overflowing its container (a tall portrait with no explicit stretch_mode). An
explicit `stretch_mode = 0` still maps to `fill`.

- **Impact:** a TextureRect that relied on the implicit STRETCH_SCALE default to
  stretch-distort its texture will instead letterbox-fit it. No shipped scene
  depends on the distort behaviour.
- Site: `nodes/2d/ui/texturerect/Component.tsx` (`stretchObjectFit` default).

### StyleBoxFlat.border_blend  *(audit #43)*
With `border_blend = true` Godot fades the border gradually from `border_color`
into `bg_color` instead of drawing a hard edge. We map `border_width` +
`border_color` to a solid CSS `border`, which always has a sharp edge.

- **Impact today:** zero — `border_blend` defaults to `false` and no shipped
  `.tscn` enables it.
- **Why not fixed:** a faithful blend needs a gradient border (`border-image`
  with a radial/linear gradient, or `background-clip` layering) that is complex,
  interacts badly with `border-radius`, and only approximates the Godot result.
- Site: `r3f/controls/styleBoxToCss.ts` (border block).
