# Texture slot colour spaces

`textureBinding.ts` gives each StandardMaterial3D texture slot the colour space
its Godot sampler reads in. The colour space is a property of the slot, never of
the image, so it overrides the loader's `SRGBColorSpace` tag.

## Why a `source_color` sampler reads sRGB

A `source_color` sampler reads the sRGB GPU view through this chain:

1. `uniform.use_color` (`servers/rendering/shader_language.cpp:9830`).
2. `texture.use_color` (`servers/rendering/shader_compiler.cpp:613`).
3. The sRGB view is bound
   (`servers/rendering/renderer_rd/storage_rd/material_storage.cpp:1067,1073`).
4. `p_use_linear_color` is true for every 3D material
   (`servers/rendering/renderer_rd/forward_clustered/scene_shader_forward_clustered.cpp:595`).

## The samplers of BaseMaterial3D

Three samplers carry `source_color` and read sRGB:

| Line in `scene/resources/material.cpp` | Sampler | Hints |
| --- | --- | --- |
| :969 | `texture_albedo` | `source_color` |
| :1066 | `texture_emission` | `source_color`, `hint_default_black` |
| :1137 | `texture_detail_albedo` | `source_color` |

Every other sampler carries `hint_default_white`, `hint_default_black`,
`hint_roughness_*`, `hint_normal`, `hint_anisotropy` or no hint, and reads raw:

| Line | Sampler | Hint |
| --- | --- | --- |
| :1024 | `texture_metallic` | `hint_default_white` |
| :1030 | `texture_roughness` | `hint_roughness_r` |
| :1053 | `texture_orm` | |
| :1075 | `texture_refraction` | |
| :1092 | `texture_normal` | `hint_roughness_normal` |
| :1099 | `texture_bent_normal` | |
| :1107 | `texture_rim` | |
| :1115 | `texture_clearcoat` | |
| :1122 | `texture_flowmap` | `hint_anisotropy` |
| :1128 | `texture_ambient_occlusion` | `hint_default_white` |
| :1138 | `texture_detail_normal` | |
| :1139 | `texture_detail_mask` | |
| :1147 | `texture_subsurface_scattering` | |
| :1156 | `texture_subsurface_transmittance` | |
| :1165 | `texture_backlight` | |
| :1172 | `texture_heightmap` | `hint_default_black` |

`SLOT_COLOR_SPACE` is exhaustive over `TextureSlot`, so a new slot fails to
compile until someone reads Godot's shader for it.
