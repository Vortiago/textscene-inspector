---
type: LightmapGI
category: 3D
status: limitation
fixture: unit-lightmap-gi-baked.tscn
image: unit-lightmap-gi-baked
renders_as: the baked lightmap on each mesh its data names
---

# LightmapGI

Applies a lightmap baked in Godot. Each mesh that `light_data` names reads its light from the bake's atlas through its second UV, not from its ambient light. A Static light no longer lights that mesh in real time. With a shadowmask mode, the bake's shadowmask replaces (Replace), darkens (Overlay) or alone gives (Only) the shadow of each sun that is not Static. The previewer reads the bake. It does not bake.

## Linting

<!-- lint:begin LightmapGI -->
Strict parsing format-checks these `LightmapGI` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bias` | float >= 0.00001 | error below |
| `bounce_indirect_energy` | float 0-2 | error below, warning above |
| `bounces` | integer 0-16 | error below 0, error above 16 |
| `camera_attributes` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `denoiser_range` | integer 1-20 | warning |
| `denoiser_strength` | float >= 0.001 | warning below |
| `directional` | true or false |  |
| `environment_custom_color` | Color(r, g, b, a), or the colour string or int it converts |  |
| `environment_custom_energy` | float 0-64 | warning |
| `environment_custom_sky` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `environment_mode` | enum 0-3 (DISABLED/SCENE/CUSTOM_SKY/CUSTOM_COLOR) | warning |
| `generate_probes_subdiv` | enum 0-4 (DISABLED/SUBDIV_4/SUBDIV_8/SUBDIV_16/SUBDIV_32) | warning |
| `interior` | true or false |  |
| `light_data` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `max_texture_size` | integer 2048-16384 | error |
| `quality` | enum 0-3 (LOW/MEDIUM/HIGH/ULTRA) | warning |
| `shadowmask_mode` | enum 0-2 (NONE/REPLACE/OVERLAY) | warning |
| `supersampling` | true or false |  |
| `supersampling_factor` | float 1-8 | error below, warning above |
| `texel_scale` | float 0.01-100 | error below 0.00999, warning below 0.01, warning above 100 |
| `use_denoiser` | true or false |  |
| `use_texture_for_bounces` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reads `light_data` as written, and `shadowmask_mode` as an integer from 0 to 3, where any other value reads as None. Mode 3 (Only) is stored by a script, as the inspector offers 0 to 2. It leaves the other bake settings in the raw property bag, since only a bake reads them. A `light_data` that resolves to no LightmapGIData, such as `light_data = 3`, applies no lightmap and logs nothing.

Under a WorldEnvironment with CameraAttributes, the atlas reads at the exposure factor over the exposure the bake ran at, which the bake's `probe_data` stores as `baked_exposure`. Without CameraAttributes it reads at 1, whatever the bake ran at. The `lightmap-gi-exposure` golden pins this.

## Known limitations

- **Not drawn** An object the bake does not name keeps its ambient light, where Godot lights it from the bake's light probes.
- **Approximated** The previewer reads the source `.exr` and `_shadow.png` where Godot reads their VRAM-compressed imports, so a soft shadow edge can differ by a few levels.
- **Approximated** A glTF mesh that Godot unwraps and the project's `.unwrap_cache` lacks draws with real-time light, as the previewer does not run xatlas.
