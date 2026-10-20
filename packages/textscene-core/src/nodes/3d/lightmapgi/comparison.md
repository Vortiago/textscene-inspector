---
type: LightmapGI
category: 3D
status: limitation
fixture: unit-lightmap-gi-baked.tscn
image: unit-lightmap-gi-baked
renders_as: the baked lightmap on each mesh its data names
---

# LightmapGI

Applies a lightmap baked in Godot. Each mesh its `light_data` names reads its light from the bake's atlas through its second UV, in place of its ambient light. A Static light no longer lights that mesh in real time. The previewer reads the bake. It does not bake.

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

The lenient parser reads `light_data` as written and leaves the bake settings in the raw property bag, since only a bake reads them. A `light_data` that resolves to no LightmapGIData, such as `light_data = 3`, applies no lightmap and logs nothing.

## Known limitations

- **Not drawn** An object the bake does not name keeps its ambient light, where Godot lights it from the bake's light probes.
- **Not drawn** The baked shadowmask is not read, so `shadowmask_mode` changes nothing.
- **Approximated** The atlas is read at full float precision, where Godot reads its VRAM-compressed import, so a soft shadow edge can differ by a few levels.
- **Approximated** A mesh with a ShaderMaterial, or a GridMap or MultiMesh instance the bake names, reads no lightmap.
