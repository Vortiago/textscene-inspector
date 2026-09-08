---
type: StandardMaterial3D
category: Resources
status: unreviewed
renders_as: a THREE.MeshStandardMaterial / MeshPhysicalMaterial
---

# StandardMaterial3D

Godot's default 3D surface. The scalar PBR base maps onto `MeshStandardMaterial`, and clearcoat, rim, anisotropy or refraction upgrade it to `MeshPhysicalMaterial`. Each section drives one feature from its own fixture.

## Metallic / roughness
<!-- compare: image=unit-material-metallic status=done fixture=unit-material-metallic.tscn -->

A `metallic = 1.0`, `roughness = 0.1` sphere reflects the preview sky. Both engines render the same blue-grey mirror with a matching highlight.

- **Approximated** Godot reads the map channel named by `metallic_texture_channel` and `roughness_texture_channel`. three reads fixed channels, so a map packed in RED is misread.

## Emission
<!-- compare: image=unit-material-emissive status=done fixture=unit-material-emissive.tscn -->

An emissive sphere at `emission_energy = 2.0` glows cyan in both, and the preview environment blooms it. `emission_operator` is honoured, including MULTIPLY with no texture, which emits nothing.

- **Approximated** ADD with both a lit colour and a texture is applied as a multiply, so the surface reads darker and more tinted.
- **Approximated** `emission_on_uv2` samples through UV1, since no mesh here carries a second UV set.
- **Approximated** `emission_intensity` is ignored. `emission_energy_multiplier` alone drives the strength.

## Clearcoat
<!-- compare: image=unit-material-clearcoat status=done fixture=unit-material-clearcoat.tscn -->

A red sphere with a glossy clear coat. `clearcoat` maps to `MeshPhysicalMaterial.clearcoat`, and both engines show the same tight highlight over the red body.

## Rim
<!-- compare: image=unit-material-rim status=limitation fixture=unit-material-rim.tscn -->

Godot's `rim` is a Fresnel edge term on a dark sphere. It maps to `sheen` with a low `sheenRoughness`, and the body matches Godot.

- **Approximated** The sheen is a crescent where view meets light, not an even ring round the silhouette.

## Anisotropy
<!-- compare: image=unit-material-anisotropy status=limitation fixture=unit-material-anisotropy.tscn -->

`anisotropy` stretches the specular highlight along one direction. Both engines show a brushed-metal streak.

- **Approximated** Ours reads sharper and more radial where Godot's lobe is soft.

## Anisotropy flowmap
<!-- compare: image=unit-material-anisotropy-flowmap status=limitation fixture=unit-material-anisotropy-flowmap.tscn -->

`anisotropy_flowmap` carries direction in R/G and strength in alpha. The image is repacked alpha to blue before it reaches `anisotropyMap`, and both engines band the mapped sphere.

- **Approximated** The bright lobe lands on the other side of centre, and band edges step hard where Godot's blur.
- **Approximated** A minified flowmap with zero-alpha texels turns its direction 90 degrees from the first mip level that mixes them.
- **Approximated** A material loaded from a `.tres` gets its anisotropy scalars and no flowmap.

## Refraction
<!-- compare: image=unit-material-refraction status=limitation fixture=unit-material-refraction.tscn -->

Godot's refraction distorts the background, so the sphere reads bright. `refraction_enabled` maps to `transmission` plus `thickness`, which reads dark here. The forced opacity and depth write match Godot.

- **Approximated** The screen-space distortion is not reproduced, and the surface is not dimmed by `1 - ref_amount`, so it reads brighter than Godot's.

## Height mapping
<!-- compare: image=unit-material-heightmap status=limitation fixture=unit-material-heightmap.tscn -->

Godot's `heightmap_*` is texture-space parallax, so the silhouette stays a smooth sphere. It maps to `displacementMap`, which moves real vertices.

- **Approximated** The sphere deforms into a lumpy blob, and the depth scale is in world units.

## Texture filter
<!-- compare: image=unit-material-texture-filter status=done fixture=unit-material-texture-filter.tscn -->

`texture_filter` picks the sampler every texture slot reads through, and `texture_repeat` rides the same helper. The default row is also three's own default, so an unauthored material is unchanged.

- **Approximated** Nearest sampling with anisotropy takes the property but not the anisotropy, since three skips it under `NearestFilter`.
- **Approximated** `texture_mipmap_bias` is not applied. WebGL2 has no per-texture LOD bias.
- **Approximated** `anisotropic_filtering_level` is pinned at 16x rather than read from the project.

## Linting

<!-- lint:begin StandardMaterial3D -->
Strict parsing format-checks the inherited set (131 inherited from BaseMaterial3D, 2 inherited from Material, 2 inherited from Resource); `StandardMaterial3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

The lenient parser never rejects. Each field falls back to Godot's default through the shared value decoders, so a malformed `roughness` renders with default roughness. A texture reference it cannot resolve leaves the slot empty, and the mesh renders untextured.

## Known limitations

- **Approximated** `ALPHA_HASH` is alpha-blended rather than dithered, so it joins the transparent pass. The depth write still follows Godot's.
- **Shader missing** `alpha_antialiasing_mode` is read for the pass decision, but the cutout edge reads hard rather than coverage-blended.
- **Shader missing** `proximity_fade_*` and `distance_fade_*` decide the pass but are not rendered, so the surface stays at full opacity.
- **Shader missing** `diffuse_mode` is always Lambert where Godot defaults to Burley, so a rough sphere reads about 5/255 darker at the grazing silhouette.
- **Shader missing** `metallic_specular` has no effect. three fixes dielectric F0 at 0.04.
- **Approximated** Godot measures V from the image top and three from the bottom, so a non-integer `uv1_scale.y` or a non-zero `uv1_offset.y` shifts V differently.
- **Approximated** Under `uv1_world_triplanar`, `uv1_offset` is in world units and is not converted.
- **Approximated** Triplanar tiling density is exact on planar meshes only. Curved and GLB geometry fall back to their own UVs, and a `.tres` material tiles by UV.
- **Approximated** `billboard_keep_scale = false` is not honoured, and a billboarded mesh's children turn with it.
- **Approximated** A patterned texture on a SphereMesh lands rotated, because Godot winds sphere UVs at a different phase than three.
