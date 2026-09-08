---
type: LightmapGI
category: 3D
status: unimplemented
fixture: unit-lightmap-gi.tscn
# image: unit-lightmap-gi
renders_as: invisible transform-only fallback
---

# LightmapGI

Bakes static global illumination into a lightmap atlas and applies it from `light_data` at runtime. The previewer neither bakes nor applies lightmap data yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin LightmapGI -->
Strict parsing format-checks these `LightmapGI` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bias` | float >= 0.00001 | error below |
| `bounce_indirect_energy` | float 0-2 | error below, warning above |
| `bounces` | integer 0-16 | error below 0, error above 16 |
| `camera_attributes` | null, SubResource("id") or ExtResource("id") |  |
| `denoiser_range` | integer 1-20 | warning |
| `denoiser_strength` | float >= 0.001 | warning below |
| `directional` | true or false |  |
| `environment_custom_color` | Color(r, g, b, a) |  |
| `environment_custom_energy` | float 0-64 | warning |
| `environment_custom_sky` | null, SubResource("id") or ExtResource("id") |  |
| `environment_mode` | enum 0-3 (DISABLED/SCENE/CUSTOM_SKY/CUSTOM_COLOR) | warning |
| `generate_probes_subdiv` | enum 0-4 (DISABLED/SUBDIV_4/SUBDIV_8/SUBDIV_16/SUBDIV_32) | warning |
| `interior` | true or false |  |
| `light_data` | null, SubResource("id") or ExtResource("id") |  |
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

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. A `bounces = "banana"` or `max_texture_size = -5` sits untouched in the raw property bag, with no warning and no substitution.

## Known limitations

- **Not drawn** Godot lights surfaces from the baked lightmap. Here only the live lights apply.
