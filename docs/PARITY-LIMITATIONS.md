# Godot → three.js parity limitations

Known cases where the renderer **cannot reproduce Godot exactly** because of
three.js platform constraints. Everything else in materials + primitive meshes
was verified faithful against the Godot 4.4 spec in the parity audit
(2026-06-03); the 11 divergences that remain unfixed are recorded below. The
parser and corpus have since grown to track later format versions (`format=4`,
`uid://` resource references, an `AreaLight3D` node) — the parser itself is
format-version-agnostic, but that later-format coverage has not been re-run
through a full parity audit, so treat this catalogue as verified against the
4.4 spec specifically, not as a claim that 4.6/4.7-only features have been
audited.

This catalogue exists so divergences are **recorded, not discovered by eye** —
if a render ever looks wrong in one of these areas, this is the first place to
check.

An entry here needs a reason a three.js renderer *cannot* match Godot, or a
concrete blocker to fixing it. "No scene in the vendored corpus hits this" is
NOT such a reason: that corpus is a sample of Godot's own demos, not the set of
scenes this previewer has to open, so its silence says nothing about whether a
user will hit the bug tomorrow. Where a corpus count appears below it is there
to size the blast radius of a fix, never to justify skipping one.

## StandardMaterial3D

### Metallic / roughness texture channel  *(parity audit)*
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

### Emission operator = ADD  *(parity audit)*
With `emission_operator = ADD` (Godot default) **and** both a colored `emission`
and an `emission_texture`, Godot computes `(emission + tex) * energy`. three.js's
`emissiveMap` is multiply-only (`emissive * intensity * tex`), so the additive
form can't be reproduced.

- **Faithful when:** `emission_operator = MULTIPLY`, or there is no emission_texture.
- **Why not fixed:** three.js has no additive emissive-map mode without a custom shader.
- Site: `r3f/materials/standardMaterialScalars.ts` (emission block).

### Height mapping = vertex displacement  *(WI-65)*

Godot's `heightmap_*` is texture-space parallax occlusion (offsets texture lookups, no geometry
change); three.js `displacementMap` moves real mesh vertices along their normals.
- **Faithful when:** the mesh is finely subdivided and the depth is modest.
- **Diverges when:** the mesh is coarse (no vertices to move → no effect), or the depth reads
  differently — `displacementScale` is in world units, whereas Godot's `heightmap_scale` is a
  parallax-depth space, so the same value does not map 1:1.
- **Why not fixed:** faithful parallax needs a custom shader (Option 2 in the issue); the
  displacement approach is the recommended v1.
- Site: `r3f/materials/StandardMaterialSlot.tsx` (displacementMap / displacementScale).

### uv1_offset under world-triplanar  *(audit #22)*
`uv1_offset` is applied as a three.js UV-space offset. Under
`uv1_world_triplanar`, Godot's offset is in **world units**, so a non-zero offset
would shift the texture by a different amount than Godot.

- **Impact today:** zero — no shipped `.tscn` sets `uv1_offset`.
- **Why not fixed:** the world-unit → UV-space conversion under triplanar is
  unverifiable without a visual Godot reference, and shipping an unverified
  formula for a zero-impact case adds risk for no benefit.
- Site: `nodes/3d/meshinstance3d/Component.tsx` (uvTransform).

### uv1_scale / uv1_offset V anchoring
Godot samples `UV = uv * uv1_scale + uv1_offset` with V measured from the image
**top**; three.js samples `uv * repeat + offset` with V from the bottom (textures
load `flipY=true`). Both UV-transform sites copy Godot's values straight across
(`repeat = scale`, `offset = offset`), which is only equivalent when the V terms
happen to cancel. Reproducing Godot exactly needs

    repeat.y = scale.y      offset.y = 1 - scale.y - uv1_offset.y

- **Diverges when:** `uv1_scale.y` is non-integer (an integer scale makes the
  `1 - scale.y` term vanish mod 1), or `uv1_offset.y` is non-zero — where the
  sign is currently inverted.
- **Why not fixed yet:** the correction applies to primitive meshes as well as
  ArrayMesh surfaces, so it moves every textured mesh baseline at once — and the
  current baselines were eyeballed into place, not checked against Godot. The
  formula above is derived, not measured; the sign of the `uv1_offset.y` term in
  particular wants a side-by-side Godot render before it is frozen into ~20
  goldens. That is a "needs a reference render" blocker, NOT a "no scene hits it"
  one: the vendored corpus is a sample of Godot scenes, not the set of scenes
  this previewer has to handle, so its silence is not evidence the bug is
  harmless. (For scale: today no shipped `.tscn` sets `uv1_offset`, and the only
  `uv1_scale` on a Godot-authored mesh is `demos/3d/soft_body_physics/box.tscn`
  at an integer 2, where the `1 - scale.y` term vanishes mod 1.)
- Sites: `nodes/3d/meshinstance3d/applyUVTransform.ts` (parsed-scalar path) and
  `resources/materials/standardmaterial3d/renderer.ts` (ArrayMesh surface
  materials — this one also drops `uv1_offset` entirely).

### Refraction = volumetric transmission  *(WI-69)*
Godot's `refraction_*` is a **screen-space** distortion of the background, scaled
by `refraction_scale`. three.js has no screen-space refraction and instead models
it **volumetrically** via `MeshPhysicalMaterial.transmission` + `thickness`. We
map `refraction_enabled` → `transmission = 1` and `refraction_scale` → `thickness`
(clamped ≥ 0, Godot default 0.05). The index of refraction stays at three.js's
glass default (ior 1.5); Godot exposes no ior.

- **Faithful in kind:** both produce the "see behind the surface" glass/water effect.
- **Diverges in exact distortion:** screen-space UV offset vs volumetric ray bending
  will differ visually, especially at oblique angles or with extreme scale values.
- **Deferred:** `refraction_texture` and `refraction_texture_channel` (per-pixel
  refraction strength) are not yet implemented — three.js `transmissionMap` has a
  different semantic (transparency mask, not distortion strength).
- **Secondary surfaces (`material-N`, N>0):** transmission is dropped for a mesh's
  non-primary surfaces — `SecondarySurfaceMaterial`
  (`nodes/3d/meshinstance3d/Component.tsx`) renders a scalar-only
  `<meshStandardMaterial>` and forwards no `transmission`/`thickness`, so refraction
  on a secondary slot renders opaque. This is the shared rules-of-hooks deferral
  (textures and physical-only features on slots N>0 would need `useResource` inside a
  render loop) — the same drop already applies to clearcoat/rim/anisotropy, not a
  refraction-specific gap. Surface 0 upgrades correctly.
- **Why not fixed:** a proper fix needs a refraction shader (out of scope for the
  scalar-parse layer).
- Site: `r3f/materials/standardMaterialScalars.ts` (refraction block),
  `r3f/materials/StandardMaterialSlot.tsx` (transmission/thickness).

### ArrayMesh compressed attributes
A surface with `ARRAY_FLAG_COMPRESS_ATTRIBUTES` (bit 29) stores UV1/UV2 as
normalised `uint16` to be rescaled by the surface's `uv_scale`. The decoder reads
the uncompressed layout only, so such a surface now yields **no** UVs rather than
float32 garbage read out of the quantised bytes (values like `6.7e37`).

- **Impact today:** three surfaces in the corpus set the flag —
  `demos/3d/material_testers/models/godot_ball.tres` and
  `demos/3d/truck_town/vehicles/meshes/*.tres`. They render untextured instead of
  with a scrambled texture.
- **Why not fixed:** dequantising needs the `uv_scale` Vector4 applied per
  surface, and the same flag also changes the vertex/normal layout — a decoder
  feature, not a patch.
- Site: `resources/meshes/arrayMeshDecode.ts` (`decodeArrayMesh`).

### GridMap cell_scale
Godot's `_octant_update` composes `T(cell·size + offset) × R × scale(cell_scale)
× mesh_transform`. We apply the translation, orientation and `mesh_transform`,
but `cell_scale` (default 1.0) is not parsed — a GridMap that sets it renders
every tile at the wrong size.

- **Impact today:** zero — `cell_scale` appears in no fixture in the corpus.
- Site: `nodes/3d/gridmap/Component.tsx` (`cellMatrix`).

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

> **Resolved:** `Node2D.skew` (audit #34) was previously listed here as
> parsed-but-not-applied. Skew is now rendered: a non-zero skew bakes the full
> sheared `Transform2D` into a `THREE.Matrix4` applied with
> `matrixAutoUpdate = false` (`r3f/node2dTransform.ts`).

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

## TileMap / TileMapLayer

### Cross-source draw order within a layer  *(issue #74, by design)*
Tiles batch into **one mesh per atlas source** (the PRD's performance
requirement). Godot draws cells in scan order, interleaving cells of different
atlas sources within a rendering quadrant; per-source batching cannot reproduce
that per-cell interleaving. Sources draw in `sources/N` appearance order, each
nudged `+TILE_SOURCE_STEP` in z (deterministic, but not Godot's exact order
where overlapping cells come from different sources).

- **Impact today:** none visible — isometric stacking in the vendored dungeon
  is dominated by `texture_origin` overlap within a single source.
- Site: `r3f/node2dTransform.ts` (`TILE_SOURCE_STEP`), tile slice Components.

### Y-sort  *(issue #74, implemented — static only)*
`y_sort_enabled` / `y_sort_origin` are parsed and applied at render time
for static scenes. A `y_sort_enabled` parent collects its descendant CanvasItems,
sorts them by accumulated world-Y within effective-z buckets, and renders them
front-to-back using rank-based z sub-steps. Non-y-sorted containers sort as one
unit. `y_sort_origin` shifts sort keys for TileMapLayer tiles only.

A y-sorted TileMapLayer is decomposed per-distinct-Y-group: each unique
combined-Y (layer world Y + map-to-local pixel Y + y_sort_origin) becomes a
separate draw target participating in the parent's flat sort, so interleaved
siblings (decorations, sprites) land at correct depth relative to specific tile rows.

- **Deferred:** per-frame re-sort when AnimationPlayer changes Y positions.
  Animated scenes must be re-parsed to re-sort.
- **Deferred:** `z_as_relative = false` (tracked separately in audit #35).

### Unsupported tile shapes, layouts, and data formats  *(issue #74)*
- `tile_shape` half-offset-square (2) / hexagon (3): cells place on a square
  grid + warn (`resources/tileset/tilePlacement.ts`).
- Legacy `TileMap` with `format` 0/1 (Godot 3 tile-id encodings needing the
  original TileSet's compatibility mapping): tile data ignored + warn, node
  degrades to a transform-only group (`nodes/2d/tiles/shared/tileData.ts`).
- Scene-collection tile sources (`TileSetScenesCollectionSource`) and per-tile
  modulate/material overrides: skipped with a warn (`resolveTileSet.ts`).
- Animated tiles: the base frame's region renders statically.

## Binary Godot resources

### `.scn` / `.res` (binary serialization) are not previewable  *(by design)*
The previewer parses Godot's TEXT formats only (`.tscn`/`.tres`). Binary
scenes (`.scn`), binary resources (`.res`, e.g. `ArrayMesh` mesh data), and
compressed textures (`.ctex`) cannot load. Concrete case: the
godot-demo-projects 3D platformer's level is a `GridMap` in `grid_map.scn`
plus `ArrayMesh` floors in `meshes/*.res` — its geometry cannot render.

- **Degradation:** the scene processor rejects binary/non-TSCN content
  (instead of the lenient parser silently producing an empty scene), so the
  standard missing-resource UX kicks in — magenta placeholder + panel row.
  The linter marks every such reference (`binary-resource-reference`,
  warning).
- `GridMap` (the 3D tile grid node) is now a registered renderer — it
  instances each populated cell's `MeshLibrary` item mesh, so a
  text-serialized `GridMap` renders correctly. This scene's blocker is
  purely the binary `.scn`/`.res` format, not GridMap support.

### Text `.gltf` with external buffers — web host only
`.glb` (self-contained binary) loads everywhere. A TEXT `.gltf` referencing
external `.bin` buffers / image files resolves them through THREE's
LoadingManager against the glTF's own `res://` directory; the WEB host maps
those URLs onto its fixtures mirror (`setURLModifier` in `r3f-main`). The
VS Code webview has no such mapping — there the load fails into the
missing-resource placeholder UX.

## Lights

### SpotLight3D.spot_angle_attenuation → penumbra  *(audit #15)*
Godot's cone-edge softness is `pow(spot_rim, spot_angle_attenuation)` — a curve
with no exact three.js analogue (three.js `SpotLight.penumbra` is a single 0..1
softness). We approximate with `penumbra = 1 / (spot_angle_attenuation + 1)`,
which is monotonic (higher exponent → harder edge) and lands the Godot default
(`spot_angle_attenuation = 1.0`) at `penumbra = 0.5` — a moderately soft edge.

- **Impact:** shipped spotlights render with a soft cone edge by default (vs the
  old hardcoded near-hard `0.1`). Visually verified acceptable on the vendored
  hallway corpus; the absolute default (0.5) is pinned by a test.
- **Why not exact:** the exponent→softness relationship is non-linear and has no
  closed-form three.js equivalent; the mapping is a deliberate approximation.
- Site: `nodes/3d/lights/spotlight3d/Component.tsx` (penumbra derivation).

### The previewer always adds editor preview lights
`TscnSceneContents` mounts an unconditional `ambientLight intensity={0.4}` plus a
`directionalLight` so a scene with no lights of its own is not a black void. Godot's
editor makes the equivalent preview environment yield to a scene that carries its
own `WorldEnvironment`; ours does not.

- **Impact:** any lighting a scene contributes competes with a fixed baseline that
  Godot would not be applying. The clearest case is `WorldEnvironment`'s ambient:
  at the vendored corpus's own values (`background_color = Color(0.6, 0.6, 0.6, 1)`
  at `background_energy_multiplier = 1`, from
  `scenes/demos/3d/graphics_settings/control.tscn`) its contribution does not
  survive 8-bit quantisation beside the preview lights — a golden only moves once
  the multiplier is pushed to roughly 50. That is why the BG-ambient behaviour is
  guarded at the component seam (`worldenvironment/Component.bg-ambient.test.tsx`)
  rather than by a baseline image that could not fail.
- **Why not fixed here:** *when* the preview lights should yield is a product
  decision for this previewer, not a Godot class-reference fact — a scene may carry
  a `WorldEnvironment`, its own lights, both, or an environment that emits nothing.
  Picking a rule blind would trade one divergence for another, and it would move
  most 3D baselines at once.
- Site: `r3f/TscnCanvas.tsx` (`TscnSceneContents`).

## Control

### `TextureRect.expand_mode` FIT_* modes: which axis is authoritative
All four FIT_* modes are implemented as `aspect-ratio` — FIT_WIDTH/FIT_HEIGHT
tie the two axes 1:1 (Godot ignores the texture's own aspect for those) and the
PROPORTIONAL pair ties them at the texture's aspect. What does NOT carry over is
*direction*: Godot derives a minimum from the control's **current** size
(`Size2(get_size().y, 0)` for FIT_WIDTH, `Size2(0, get_size().x)` for
FIT_HEIGHT), naming one axis as the driver, whereas CSS resolves whichever axis
the surrounding layout leaves unconstrained.

- **Impact:** the box takes the right shape either way; the two differ only when
  the layout constrains BOTH axes, where Godot's named axis wins and CSS's
  constraint does. Godot marks the member experimental for related reasons.
- Site: `nodes/2d/ui/texturerect/Component.tsx` (`textureRectMinSize`).

### `Control.rotation` / `scale` are dropped inside a Container — deliberately
Not a limitation but a rule worth stating, because it looks like one: Godot's
`Container::fit_child_in_rect` ends with `set_rotation(0)` and
`set_scale(Vector2(1, 1))`, and class_control.html says so outright. A Control
inside any container therefore renders unrotated and unscaled whatever the scene
file says, and we match that.

- Site: `r3f/controls/controlLayout.ts` (`applyTransform`).

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
