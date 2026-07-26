---
type: StandardMaterial3D
category: Resources
renders_as: a THREE.MeshStandardMaterial / MeshPhysicalMaterial
---

# StandardMaterial3D

Godot's default 3D surface. Its scalar PBR base (albedo, metallic, roughness,
emission) maps onto `MeshStandardMaterial`; the extra feature flags (clearcoat,
rim, anisotropy, refraction) upgrade the surface to `MeshPhysicalMaterial`. Each
section below drives one feature from its own fixture and shows the two engines
side by side.

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

Godot uploads `emission` through a `source_color` uniform, so the authored Color is
converted sRGB→linear BEFORE `emission_energy_multiplier` multiplies it. That order
matters for an HDR emission: the conversion is not linear, so normalising by the peak
channel first and scaling after is a different mapping — `Color(2, 0.5, 0)` lands at
`(5.10, 0.214, 0)` in Godot but at `(2, 0.102, 0)` if converted the other way round,
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

## Known limitations

- **diffuse_mode** — Godot defaults to Burley; three's material is always Lambert. They agree near normal incidence; a rough sphere reads ~5/255 dark at grazing silhouette.
- **metallic_specular** — three hard-wires dielectric F0 at 0.04 (Godot's 0.5 default). Authoring it away from 0.5 has no effect.
- **uv1 V-anchoring** — Godot measures V from the image top, three from the bottom, so a non-integer `uv1_scale.y` or non-zero `uv1_offset.y` shifts V differently. Under `uv1_world_triplanar`, `uv1_offset` is in world units and is not converted.
- **billboard_mode** — orientation is faithful, but `billboard_keep_scale = false` (scale normalized away while billboarding) is not honored, and a billboarded mesh's child nodes inherit its rotation (Godot's per-surface effect does not turn children).
- **Triplanar on curved meshes** — tiling density is exact for planar meshes; curved / GLB geometry falls back to the mesh's own UVs.
- **emission_operator = Add with BOTH a lit colour and a texture** — Godot computes `(emission + tex) * energy`, a sum three's multiply-only emissive chain cannot express. The colour is applied as a multiply instead, so such a material reads darker and more tinted. The far more common cases — either term alone, and Add over the default black colour — are exact.
- **emission_on_uv2** — Godot samples the emission texture from the second UV set. Nothing here produces one: the primitive meshes are stock three geometries carrying only `uv`, and the ArrayMesh decoder drops trailing UV2 data. Binding the flag would leave the attribute unbound, so the whole surface would sample one texel and read as flat colour — strictly worse than reading the texture through UV1, which is what happens. Validated, not rendered.
- **emission_intensity** — the nits-valued property only reaches Godot's shader when the project enables physical light units, which is not modelled, so `emission_energy_multiplier` alone drives emission strength.
