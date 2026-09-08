---
type: StandardMaterial3D
category: Resources
status: unreviewed
renders_as: a THREE.MeshStandardMaterial / MeshPhysicalMaterial
---

# StandardMaterial3D

Godot's default 3D surface. Its scalar PBR base (albedo, metallic, roughness,
emission) maps onto `MeshStandardMaterial`; the extra feature flags (clearcoat,
rim, anisotropy, refraction) upgrade the surface to `MeshPhysicalMaterial`. Each
section below drives one feature from its own fixture and shows the two engines
side by side.

A material reaches the renderer three ways — inline as a `[sub_resource]` of the
scene, as a standalone `.tres`, or as a `[sub_resource]` of a `.tres` that
carries it — and all three run ONE decode (`decode.ts`, ADR-0031). The two
adapters over it are `<StandardMaterialSlot>` (reactive, for R3F prop-diffing)
and `build.ts` (imperative, for the resource pipeline's cache);
`arrivalParity.test.tsx` holds them to the same material state property-set by
property-set. Nothing below depends on which route a material took, except where
"Known limitations" says otherwise.

## Transparency and alpha

`transparency` selects the mode; the albedo alpha alone does NOT make a surface
transparent. Godot's generated fragment code emits `ALPHA *= albedo.a *
albedo_tex.a` only when `transparency != TRANSPARENCY_DISABLED` (or
shadow-to-opacity / pixel-alpha distance fade / proximity fade is on), so an
opaque material's alpha channel never reaches the blend at all.

| Godot `transparency` | `transparent` | `depthWrite` | `alphaTest` |
| --- | --- | --- | --- |
| 0 DISABLED *(default)* | no | yes | 0 |
| 1 ALPHA | yes | no | 0 |
| 2 ALPHA_SCISSOR | no | yes | `alpha_scissor_threshold` (0.5) |
| 3 ALPHA_HASH | yes | yes | 0 |
| 4 ALPHA_DEPTH_PRE_PASS | yes | yes | 0 |

ALPHA is the only mode that gives up depth writes: DEPTH_PRE_PASS keeps them by
running a depth prepass, and the two cutout modes discard rather than blend, so
they stay on the depth-writing opaque pass.

## Which render pass a surface joins

`transparency` is only one of the inputs. Godot decides the pass in
`ShaderData::uses_alpha_pass()`, over flags its generated shader raises, and this
slice ports that predicate rather than reading the property directly. A surface
joins the ALPHA pass when any of these holds:

- **the shader writes ALPHA and is not a cutout** — a transparency mode,
  `shadow_to_opacity`, PIXEL_ALPHA `distance_fade_mode`, or `proximity_fade_enabled`;
- **`blend_mode` is not MIX** — `blend_mode_uses_blend_alpha` is true for ADD, SUB,
  MUL and PREMULT_ALPHA, so an additive material blends in the alpha pass with no
  `transparency` authored at all;
- **the shader samples the screen** — refraction reads `screen_texture`, and
  refraction or proximity fade reads `depth_texture`;
- **depth is off** — `depth_draw_mode = Never` or `no_depth_test`.

A CUTOUT (`ALPHA_SCISSOR`, `ALPHA_HASH`) cancels the first condition: it discards
fragments instead of blending them, so it stays opaque — unless
`alpha_antialiasing_mode` re-admits it, which is what Godot's alpha-to-coverage
needs.

Depth writing then follows the pipeline rule: the depth-draw mode decides it, and
the alpha pass overrides `Opaque Only` to no-write ("alpha does not draw depth").
`depth_draw_mode` and `no_depth_test` are honoured; refraction overrides the
authored mode to `Always`.

## Refraction forces opacity

A refractive material is NOT faded by its albedo alpha. Godot's refraction branch
replaces the usual `ALPHA *= albedo.a * albedo_tex.a` with a flat `ALPHA = 1.0`
("Force transparency on the material (required for refraction)") and modulates
`ALBEDO` by `1.0 - ref_amount` instead, so `glass.tres` — `transparency = 1` with
an alpha of 0.63 — renders fully opaque and depth-writing, distorting the
background rather than blending with it.

## Blend modes

`blend_mode` becomes a `render_mode blend_*` line on Godot's generated shader,
which the RD backend turns into fixed blend factors
(`MaterialStorage::ShaderData::blend_mode_to_blend_attachment`). Those factors
are ported verbatim into one table (`blendState.ts`); where a three.js preset
programs exactly the same state, the preset is used.

| Godot | colour factors | alpha factors | three |
| --- | --- | --- | --- |
| 0 MIX *(default)* | `SRC_ALPHA` / `1-SRC_ALPHA` | `ONE` / `1-SRC_ALPHA` | `NormalBlending` |
| 1 ADD | `SRC_ALPHA` / `ONE` | `SRC_ALPHA` / `ONE` | `AdditiveBlending` |
| 2 SUB | `SRC_ALPHA` / `ONE`, reverse-subtract | same | `CustomBlending` |
| 3 MUL | `DST_COLOR` / `ZERO` | `DST_ALPHA` / `ZERO` | `MultiplyBlending` |
| 4 PREMULT_ALPHA | `ONE` / `1-SRC_ALPHA` | `ONE` / `1-SRC_ALPHA` | `CustomBlending` |

Two modes cannot use a preset. three's `SubtractiveBlending` is `FUNC_ADD` with
`ZERO / 1-SRC_COLOR`, a different operation from Godot's reverse-subtract. And
PREMULT_ALPHA is not `NormalBlending` with `premultipliedAlpha`: that flag makes
three premultiply the shader output (`gl_FragColor.rgb *= a`), which
double-applies against a source Godot expects to be premultiplied already, so the
flag stays off and the factors are stated instead.

## Albedo and culling

`albedo_color` is converted sRGB→linear and is NOT clamped — it carries no range
hint and `Color::srgb_to_linear` extrapolates, so an HDR albedo (a tracer bullet
at `Color(2.33575, 3.29442, 3.29442, 1)`) keeps the headroom it needs to cross
the glow bright-pass. `metallic` and `roughness` ARE clamped, to the `"0,1,0.01"`
hints they declare.

`cull_mode` names the faces Godot DISCARDS while three's `side` names the ones it
KEEPS: BACK (the default) → `FrontSide`, FRONT → `BackSide`, DISABLED →
`DoubleSide`.

## Metallic / roughness
<!-- compare: image=unit-material-metallic status=done fixture=unit-material-metallic.tscn -->

A `metallic = 1.0`, `roughness = 0.1` sphere reflects the preview sky. Both engines
render the same blue-grey mirror with a matching specular highlight.

Known edge: Godot reads the map channel named by `metallic_texture_channel` /
`roughness_texture_channel` (default RED); three.js reads fixed channels (blue for
metalness, green for roughness), so a dedicated map packed in RED is misread. The
common grayscale / ORM packings are faithful.

## Emission
<!-- compare: image=unit-material-emissive status=done fixture=unit-material-emissive.tscn -->

An emissive sphere at `emission_energy = 2.0` glows cyan in both, and the editor
preview environment blooms it (the glow itself is covered on the Environment sheet).

Godot uploads `emission` through a `source_color` uniform, so the authored Colour is
converted sRGB→linear BEFORE `emission_energy_multiplier` multiplies it. That order
matters for an HDR emission: the conversion is not linear, so normalising by the peak
channel first and scaling after is a different mapping — `Color(2, 0.5, 0)` lands at
`(4.954, 0.214, 0)` in Godot but at `(2, 0.102, 0)` if converted the other way round,
wrong in magnitude and in hue. Godot's conversion extrapolates past 1.0 rather than
clipping, so channels above 1 survive, which is what lets them cross the glow
bright-pass. three carries emission as a `[0,1]` colour times an unbounded
`emissiveIntensity`, so the linear colour is split at its peak and the hue is kept.

`emission_operator` is honoured. The emission sampler carries `hint_default_black`, so
an ABSENT texture reads as zero rather than white, which settles most of the
combinations: MULTIPLY with no texture is no emission at all (a Godot content trap,
reproduced), MULTIPLY with one is three's own multiply, and ADD with no texture is the
colour at its energy. ADD with a texture over Godot's default BLACK emission colour
reduces to `tex * energy`, which is spelled as a white emissive — getting that wrong
renders nothing at all where Godot renders the whole texture.

`shading_mode = unshaded` drops emission entirely in both: Godot's unshaded branch
outputs `vec4(albedo, alpha)` and never reads its emission term.

Measured with `ref:godot` against Godot 4.6.3: an HDR emission colour (a channel at
2.0) lands at 0.023%, and the two texture-dependent operator cases side by side at
0.498% — that residual is the checkerboard's own edge count under SVG rasterisation,
with the square interiors matching. Those fixtures use flat quads rather than spheres
on purpose: a checkerboard is a UV discriminator, and Godot's `SphereMesh` winds its
UVs at a different phase than three's sphere does. That is measurable at 3.556% on
plain albedo with no emission involved at all, so putting the operator test on a
sphere would have measured the wrong thing.

## Clearcoat
<!-- compare: image=unit-material-clearcoat status=done fixture=unit-material-clearcoat.tscn -->

A red sphere with a glossy clear coat. `clearcoat` maps to
`MeshPhysicalMaterial.clearcoat`; both engines show the red body under a tight
glossy highlight.

## Rim
<!-- compare: image=unit-material-rim status=limitation fixture=unit-material-rim.tscn -->

Godot's `rim` is a Fresnel edge term on an otherwise dark sphere. three.js has no
rim, so it maps to `sheen` with a low `sheenRoughness` to keep the highlight at the
edge (a broad sheen washed the dark body out to bright grey — now fixed). The body
matches Godot, but the sheen is retroreflective — a crescent where view meets light
— rather than an even ring around the whole silhouette.

## Anisotropy
<!-- compare: image=unit-material-anisotropy status=limitation fixture=unit-material-anisotropy.tscn -->

`anisotropy` stretches the specular highlight directionally. Both show a brushed-
metal streak, but ours reads sharper and more radial where Godot's is a soft,
smoother lobe.

## Anisotropy flowmap
<!-- compare: image=unit-material-anisotropy-flowmap status=limitation fixture=unit-material-anisotropy-flowmap.tscn -->

`anisotropy_flowmap` carries the direction in R/G and the per-pixel strength in ALPHA;
three.js reads strength from BLUE, so the decoded image is read back through a canvas
and repacked A → B before it is wired to `anisotropyMap`. The near sphere has the map —
its ALPHA alternates in four bands of 0 and 255 — and the far sphere the same material
with the scalar only. Both engines modulate per pixel: the mapped sphere is banded on
both sides, the scalar sphere carries one unbroken streak.

Where the bright lobe lands differs. Godot blows out left of the sphere's centre and
falls away to the right — rgb(255, 255, 255) at (700, 380), rgb(193, 198, 209) at
(820, 380) — while ours does the reverse, rgb(236, 239, 246) then rgb(255, 255, 255) at
the same two pixels. Godot's flowmap offsets the tangent itself, where three rotates a
single anisotropy vector by the map's R/G, on top of the lobe-shape difference the
scalar fixture above already shows.

Band edges differ too: ours steps hard (row 470 drops 15 levels across x = 663…666),
Godot's has no step above 8 anywhere in that row. Texture filtering is not the cause —
the map is magnified at this framing, so both sides sample its top level; it is the same
sharper lobe as above reacting to a hard strength boundary that Godot's softer one
blurs. One more consequence of the canvas readback: it stores premultiplied alpha, so
R/G lose precision where alpha is near zero, and are lost outright where it is zero —
the direction, at a strength already scaled to nothing. That costs nothing at this
framing, but it does not stay free once the map is minified: the generated mip chain
averages those zeroed directions into levels whose strength is not zero, so a
half-transparent flowmap that holds one direction at every level in Godot turns 90° here
from the first level that mixes the two alpha regimes. Removing that needs a decode which
never premultiplies, not a 2D canvas.

## Refraction
<!-- compare: image=unit-material-refraction status=limitation fixture=unit-material-refraction.tscn -->

Godot's refraction is a screen-space distortion of the background, so the sphere
reads bright (it samples the light sky). three.js has no screen-space refraction;
`refraction_enabled` maps to volumetric `transmission` + `thickness`, which reads
dark here (it transmits the dark ground). Same effect in kind, very different in
appearance.

## Height mapping
<!-- compare: image=unit-material-heightmap status=limitation fixture=unit-material-heightmap.tscn -->

Godot's `heightmap_*` is texture-space parallax — the silhouette stays a smooth
sphere. three.js has no parallax; it maps to `displacementMap`, which moves real
vertices, so the sphere deforms into a lumpy blob (and the depth scale is in world
units, a different space than Godot's).

## Texture filter
<!-- compare: image=unit-material-texture-filter status=done fixture=unit-material-texture-filter.tscn -->

`texture_filter` picks the sampler every texture slot on the material reads through.
Godot allocates one sampler per mode in `MaterialStorage::samplers_rd_allocate`, where
`min_filter` is the WITHIN-level filter and `mip_filter` the BETWEEN-level one; three
fuses both into a single `minFilter`, which is the only non-obvious step:

| Godot | `magFilter` | `minFilter` | mipmaps | anisotropy |
| --- | --- | --- | --- | --- |
| 0 NEAREST | Nearest | Nearest | no | 1 |
| 1 LINEAR | Linear | Linear | no | 1 |
| 2 NEAREST_WITH_MIPMAPS | Nearest | NearestMipmapLinear | yes | 1 |
| 3 LINEAR_WITH_MIPMAPS *(default)* | Linear | LinearMipmapLinear | yes | 1 |
| 4 NEAREST_..._ANISOTROPIC | Nearest | NearestMipmapLinear | yes | 16 |
| 5 LINEAR_..._ANISOTROPIC | Linear | LinearMipmapLinear | yes | 16 |

Row 3 is also three's own default state, so a material that does not author the property
renders byte-identically to before it was honoured.

`texture_repeat` rides the same helper. Godot constructs `BaseMaterial3D` with
`FLAG_USE_TEXTURE_REPEAT = true` (`material.cpp`), which the shader turns into
`repeat_enable`; three's `Texture` defaults to clamp-to-edge, so a surface whose UVs
leave 0..1 — a terrain, a tiled road — smears one edge texel instead of tiling. Because
repeat is a shared DEFAULT rather than a per-material choice, it is set once on the
loaded texture; only a material that authors `texture_repeat = false` diverges and
clones. Cloning for the default would have broken texture identity for essentially every
material in the corpus.

The state is applied **at material build, never at texture load**. It is per-material in
Godot but lives on the `THREE.Texture` in three, and the loader caches one texture per
path — so writing it at load would let whichever material built last win for every
consumer of that image, silently and in load order. A material that diverges gets a clone
instead (one clone however many reasons it has, shared `source`, so no image bytes are
copied), and the clone is tagged so its material disposes it.

## Linting

<!-- lint:begin StandardMaterial3D -->
Strict parsing format-checks the inherited set (131 inherited from BaseMaterial3D, 2 inherited from Material, 2 inherited from Resource); `StandardMaterial3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

The lenient parser never rejects: each field falls back to Godot's default through the shared value decoders and logs the literal it could not read, so a malformed `roughness` renders the material with default roughness rather than dropping the surface. A texture reference it cannot resolve leaves the slot empty, and the mesh renders untextured.
## Known limitations

- **ALPHA_HASH** — Godot dithers a per-pixel discard, so the surface stays on the opaque
  pass and averages to its alpha over neighbouring pixels. three has no stochastic clip,
  so the mode is approximated with alpha blending: closer in appearance than the fully
  opaque surface a literal port would give, at the cost of the pass classification. The
  depth write still follows Godot's.
- **alpha_antialiasing_mode** — the flag is read, because it decides whether a cutout
  joins the alpha pass, but the alpha-to-coverage blending it selects is not reproduced
  (WebGL exposes the sample mask only through MSAA state three does not expose
  per-material). The cutout edge reads hard rather than coverage-blended.
- **proximity_fade / distance_fade** — both are read, because they decide the pass, but
  neither fade is rendered: a proximity-fading surface joins the alpha pass at full
  opacity instead of thinning as it approaches other geometry.
- **refraction distortion** — `transmission` + `thickness` stand in for Godot's
  screen-space offset, and Godot's `ALBEDO *= 1.0 - ref_amount` (which dims the surface
  by the per-pixel refraction strength) is not applied, so a refractive surface reads
  brighter than Godot's. The forced opacity and depth write ARE reproduced.
- **anisotropy_flowmap through an external `.tres`** — the alpha→blue repack needs a
  canvas readback that lives in the node layer, so a material loaded as a `.tres` gets
  its anisotropy SCALARS and no flowmap (rather than a map whose strength channel is
  meaningless). Inline materials get the full repack, as the flowmap section above shows.
- **Triplanar through an external `.tres`** — the tiling density is reproduced by folding
  the mesh's size into the texture repeat, which needs the mesh. Only the node component
  has it, so a `.tres` material's `uv1_triplanar` is decoded and then unused; the surface
  tiles by its own UVs.
- **Procedural textures inside a `.tres`** — a slot pointing at a `SubResource`
  (`NoiseTexture2D`, `GradientTexture2D` declared in the same file, as
  `procedural_materials/ice.tres` does) resolves to no file path. The procedural
  rasteriser is reached from the scene path only, so those slots stay empty.
- **texture_mipmap_bias** — Godot applies the project's `lod_bias` to every sampler, so a
  project that sharpens (Truck Town sets `-0.5`) reads softer here at minification. WebGL2
  exposes no per-texture LOD bias; the only route is a per-fragment `texture(s, uv, bias)`
  in a patched shader.
- **anisotropic_filtering_level** — pinned at 16x rather than read from `project.godot`.
  Every project in this corpus that states a level states 4 (= 16x), and three clamps to
  the GPU maximum at upload, so this is a ceiling rather than an error.
- **texture_filter rows 4** — three skips anisotropy entirely when `magFilter` is
  `NearestFilter`, so a nearest-sampled texture takes the property but not the sampling.
  Godot does apply it. One corpus material sits there, and it is pixel art.
- **diffuse_mode** — Godot defaults to Burley; three's material is always Lambert. They agree near normal incidence; a rough sphere reads ~5/255 dark at grazing silhouette.
- **metallic_specular** — three hard-wires dielectric F0 at 0.04 (Godot's 0.5 default). Authoring it away from 0.5 has no effect.
- **uv1 V-anchoring** — Godot measures V from the image top, three from the bottom, so a non-integer `uv1_scale.y` or non-zero `uv1_offset.y` shifts V differently. Under `uv1_world_triplanar`, `uv1_offset` is in world units and is not converted.
- **SphereMesh UV phase** — Godot winds a sphere's UVs at a different phase than three's `SphereGeometry`, so a patterned texture lands rotated relative to Godot's. Measured at 3.556% on a plain albedo checkerboard. Not a material property — it belongs to the mesh — but it is what makes any patterned-texture comparison on a sphere unreadable.
- **billboard_mode** — orientation is faithful, but `billboard_keep_scale = false` (scale normalised away while billboarding) is not honoured, and a billboarded mesh's child nodes inherit its rotation (Godot's per-surface effect does not turn children).
- **Triplanar on curved meshes** — tiling density is exact for planar meshes; curved / GLB geometry falls back to the mesh's own UVs.
- **emission_operator = Add with BOTH a lit colour and a texture** — Godot computes `(emission + tex) * energy`, a sum three's multiply-only emissive chain cannot express. The colour is applied as a multiply instead, so such a material reads darker and more tinted. The far more common cases — either term alone, and Add over the default black colour — are exact.
- **emission_on_uv2** — Godot samples the emission texture from the second UV set. Nothing here produces one: the primitive meshes are stock three geometries carrying only `uv`, and the ArrayMesh decoder drops trailing UV2 data. Binding the flag would leave the attribute unbound, so the whole surface would sample one texel and read as flat colour — strictly worse than reading the texture through UV1, which is what happens. Validated, not rendered.
- **emission_intensity** — the nits-valued property only reaches Godot's shader when the project enables physical light units, which is not modelled, so `emission_energy_multiplier` alone drives emission strength.
