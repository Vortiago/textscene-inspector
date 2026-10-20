---
type: StandardMaterial3D
category: Resources
renders_as: a THREE.MeshStandardMaterial / MeshPhysicalMaterial
---

# StandardMaterial3D

Godot's default 3D surface. The scalar PBR base maps onto `MeshStandardMaterial`, and clearcoat, rim, anisotropy or refraction upgrade it to `MeshPhysicalMaterial`. Each section drives one feature from its own fixture.

## Metallic / roughness

<!-- compare: image=unit-material-metallic status=done fixture=unit-material-metallic.tscn -->

A `metallic = 1.0`, `roughness = 0.1` sphere reflects the preview sky. Both engines render the same blue-grey mirror. The preview glow blooms the sun's highlight into the same halo in both.

## Metallic and roughness map channels

<!-- compare: image=unit-material-texture-channel status=done fixture=unit-material-texture-channel.tscn -->

Godot reads a roughness map and a metallic map from the channel that `roughness_texture_channel` and `metallic_texture_channel` name, red by default. One map holds red 20 and green and blue 235. The left sphere takes it as roughness from red, so it is glossy. The right sphere takes it as metallic from red, so it is a dielectric, as in Godot.

## Emission

<!-- compare: image=unit-material-emissive status=done fixture=unit-material-emissive.tscn -->

An emissive sphere at `emission_energy = 2.0` glows cyan in both, and the preview environment blooms it. `emission_operator` is honoured, including MULTIPLY with no texture, which emits nothing. `emission_on_uv2` samples the mesh's UV2, and the `glb-lightmap-uv2` golden draws it through a GLB's unwrapped UV2.

- **Approximated** `emission_intensity` is ignored. `emission_energy_multiplier` alone drives the strength.
- **Approximated** A PrimitiveMesh with `add_uv2` gets no UV2 here, so `emission_on_uv2` on one samples the map's top-left texel, where Godot reads the generated UV2.

## Emission texture
<!-- compare: image=unit-material-emission-add status=done fixture=unit-material-emission-add.tscn -->

ADD emission with both a dark red colour and a texture. Godot emits `(emission + texture) * energy` (`material.cpp:1788`). The previewer adds the texel to the colour too, so the blue texel reads magenta and the green one amber.

## ViewportTexture in another slot
<!-- compare: image=unit-sub-viewport-texture-emission status=done fixture=unit-sub-viewport-texture-emission.tscn -->

A SubViewport's target in the emission slot, over a black albedo. A material binds every slot by RID, so the target glows as it draws through the albedo in `unit-sub-viewport-texture`. A target in a pass cycle draws the missing-texture material from any slot.

## Normal map

<!-- compare: image=unit-material-normal-map-blue status=done fixture=unit-material-normal-map-blue.tscn -->

`normal_texture` reads red and green only. Both engines rebuild blue from them (`scene_forward_clustered.glsl:1437-1438`). So a map with blue 0 shades its flat texel as the bare plane, and its tilted texel brighter. An RGTC import stores no blue, so this read is the only one that shades it. A glTF material reads its normal map the same way, as Godot imports it as a StandardMaterial3D. The map tilts the normal in a frame whose tangent and binormal have unit length, as Godot's do, so a quad with a different UV density per axis tilts each texel by its authored angle.

## Clearcoat

<!-- compare: image=unit-material-clearcoat status=done fixture=unit-material-clearcoat.tscn -->

A red sphere with a glossy clear coat. `clearcoat` maps to `MeshPhysicalMaterial.clearcoat`, and both engines show the same tight highlight over the red body. As in Godot, the coat dims only the sky's ambient light and reflection beneath it, not an omni, spot or directional light.

## Rim

<!-- compare: image=unit-material-rim status=limitation fixture=unit-material-rim.tscn -->

Godot's `rim` is a Fresnel edge term on a dark sphere. It maps to `sheen` with a low `sheenRoughness`, and the body matches Godot.

- **Approximated** The sheen is a crescent where view meets light, not an even ring round the silhouette.

## Anisotropy

<!-- compare: image=unit-material-anisotropy status=limitation fixture=unit-material-anisotropy.tscn -->

`anisotropy` stretches the specular highlight along one direction. Both engines show a brushed-metal streak.

- **Approximated** three derives the tangent frame per pixel from the UVs, not from the mesh's tangents, so the streak reads faceted and turned from Godot's ring.

## Anisotropy flowmap

<!-- compare: image=unit-material-anisotropy-flowmap status=limitation fixture=unit-material-anisotropy-flowmap.tscn -->

`anisotropy_flowmap` carries direction in R/G and strength in alpha. The image is repacked alpha to blue before it reaches `anisotropyMap`, and both engines band the mapped sphere.

- **Approximated** The bright lobe lands on the other side of centre, and band edges step hard where Godot's blur. The tangent frame comes from the UVs, not the mesh, and the glow blooms the misplaced lobe.
- **Approximated** A hard seam runs down the large sphere, where Godot's surface is smooth.

## Ambient occlusion

<!-- compare: image=unit-material-ao status=done fixture=unit-material-ao.tscn -->

The left plate reads a checkerboard AO map at `ao_light_affect = 1.0`, and the right plate has AO off. Both engines draw black occluded cells under the sun, since the map darkens direct light as well as ambient light. `ao_texture_channel` picks the map channel, and `ao_on_uv2` samples the mesh's UV2.

- **Approximated** A PrimitiveMesh with `add_uv2` gets no UV2 here, so `ao_on_uv2` on one samples the map's top-left texel, where Godot reads the generated UV2.

## Diffuse mode

<!-- compare: image=unit-material-diffuse-mode status=done fixture=unit-material-diffuse-mode.tscn -->

`diffuse_mode` picks the light's diffuse term: Burley, Lambert, Lambert wrap and toon, left to right, lit from the right. Both engines brighten Burley's rim, wrap the light past Lambert's terminator and band the toon sphere. Godot's default material draws Lambert.

## Specular mode

<!-- compare: image=unit-material-specular-mode status=done fixture=unit-material-specular-mode.tscn -->

`specular_mode` picks the light's specular term: SchlickGGX, toon and disabled, left to right. Both engines draw a soft highlight, a hard-edged toon disc and no highlight. Toon writes to the diffuse, so the albedo tints it.

- **Approximated** The preview glow spreads the toon disc's halo less than Godot's.

## Refraction

<!-- compare: image=unit-material-refraction status=limitation fixture=unit-material-refraction.tscn -->

Godot's refraction distorts the background, so the sphere reads bright. `refraction_enabled` maps to `transmission` plus `thickness`, which reads dark here. The forced opacity and depth write match Godot.

- **Approximated** The screen-space distortion is not reproduced, and the surface is not dimmed by `1 - ref_amount`, so it reads brighter than Godot's.

## Height mapping

<!-- compare: image=unit-material-heightmap status=done fixture=unit-material-heightmap.tscn -->

Both engines shift every texture coordinate by the depth the heightmap reads, along the view direction in the surface's tangent frame. So the silhouette stays a smooth sphere. Deep parallax steps through Godot's layers, and the flips and the inverted texture follow Godot. Triplanar mapping turns height mapping off, and an unshaded material shifts its albedo too, as in Godot.

## Texture filter

<!-- compare: image=unit-material-texture-filter status=done fixture=unit-material-texture-filter.tscn -->

`texture_filter` picks the sampler every texture slot reads through, and `texture_repeat` rides the same helper. Godot's repeat default is on while three's is clamp, so the applier states Repeat at bind time. An unauthored material tiles a clamped arrival on a source-shared clone. A ViewportTexture albedo samples through the same filter, repeat and UV transform in the material's program, because its render target is shared and never cloned.

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

- **Approximated** Under msaa_3d Disabled, alpha to coverage cuts the edge at alpha 0.5, where Godot's driver picks its own one-sample mask.
- **Approximated** Under msaa_3d, `ALPHA_TO_COVERAGE_AND_TO_ONE` stores the ramped alpha where Godot stores 1, so a transparent background shows the edge fainter.
- **Approximated** `ALPHA_HASH` keeps about Godot's share of pixels but not the same pixels, as the ported hash's `fract(1e4 * sin())` rounds differently on each GPU (`scene_forward_aa_inc.glsl:3-39`).
- **Shader missing** `proximity_fade_*` and `distance_fade_*` decide the pass but are not rendered, so the surface stays at full opacity.
- **Approximated** Godot measures V from the image top and three from the bottom, so a non-integer `uv1_scale.y` or a non-zero `uv1_offset.y` shifts V differently.
- **Approximated** Under `uv1_world_triplanar`, `uv1_offset` is in world units and is not converted.
- **Approximated** Triplanar tiling density is exact on a PlaneMesh only, since curved, CSG, GridMap, ArrayMesh and GLB geometry tile by their own UVs.
- **Approximated** A ViewportTexture outside the albedo slot ignores `uv1_scale`, `uv1_offset`, `texture_repeat` and a nearest `texture_filter`, as it samples its target clamped.
- **Approximated** A patterned texture on a SphereMesh lands rotated, because Godot winds sphere UVs at a different phase than three.
