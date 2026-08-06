---
type: LightmapGI
category: 3D
status: unimplemented
fixture: unit-lightmap-gi.tscn
# image: unit-lightmap-gi
renders_as: invisible transform-only fallback
---

# LightmapGI

LightmapGI bakes static global illumination — indirect light, optional
directional/spherical-harmonic reflections, and auto-placed dynamic-object light
probes — into a lightmap atlas. The previewer parses and validates every one of its
properties but does not run a bake or apply baked lightmap data yet, so it renders
as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `quality` | `2` | Bake quality preset (`High`) — ray count per texel during baking. |
| `supersampling` | `true` | Bakes at a higher texel density than `texel_scale` alone, then downsamples. |
| `supersampling_factor` | `4.0` | Multiplier applied to `texel_scale` while `supersampling` is enabled. |
| `bounces` | `5` | Number of indirect-light bounces traced during baking. |
| `bounce_indirect_energy` | `1.5` | Brightness multiplier applied to each bounce beyond the first. |
| `directional` | `true` | Bakes spherical-harmonic directional data for rough baked reflections. |
| `shadowmask_mode` | `1` | Shadowmask policy (`Replace`) baked for `DirectionalLight3D` shadows. |
| `use_texture_for_bounces` | `false` | Skips the texture-based shortcut for indirect-bounce generation. |
| `interior` | `true` | Ignores environment lighting while baking (an interior scene). |
| `use_denoiser` | `true` | Runs a GPU denoiser over the baked lightmap. |
| `denoiser_strength` | `0.05` | Denoising strength (only used while `use_denoiser` is `true`). |
| `denoiser_range` | `15` | Pixel radius the denoiser samples from. |
| `bias` | `0.001` | Shadow bias applied to the baked lightmap to avoid acne. |
| `texel_scale` | `2.0` | Multiplier on every mesh's lightmap texel density. |
| `max_texture_size` | `8192` | Maximum atlas texture size for the baked lightmap. |
| `environment_mode` | `3` | Environment-lighting source for the bake (`Custom Color`). |
| `environment_custom_sky` | `SubResource("Sky_1")` | Sky used as environment light when `environment_mode` is `Custom Sky`. |
| `environment_custom_color` | `Color(0.8, 0.6, 0.4, 1)` | Constant environment-light color used when `environment_mode` is `Custom Color`. |
| `environment_custom_energy` | `2.5` | Multiplier on the custom environment light. |
| `camera_attributes` | `SubResource("CameraAttributesPractical_1")` | Exposure settings the bake uses to normalize brightness. |
| `generate_probes_subdiv` | `3` | Subdivision level for automatically generated `LightmapProbe`s. |
| `light_data` | `SubResource("LightmapGIData_1")` | The baked lightmap/probe data this node stores and would apply at runtime. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin LightmapGI -->
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and
`visible` off any node; none of the 22 properties above are ever inspected. A
malformed value for any of them — `bounces = "banana"`, `max_texture_size = -5` —
sits untouched in the raw property bag: no crash, no substitution, and no
rendering effect either way, since nothing here draws yet.
