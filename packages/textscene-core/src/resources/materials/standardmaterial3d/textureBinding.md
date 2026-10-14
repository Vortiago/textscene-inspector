# Texture slot colour spaces

`textureBinding.ts` gives each StandardMaterial3D texture slot the colour space
its Godot sampler reads in. The slot and the texture's format decide it
together, so it overrides the producer's tag. A `source_color` slot reads sRGB
only when the texture has an sRGB view. Every other slot reads raw.

## Why a `source_color` sampler reads sRGB

A `source_color` sampler reads the sRGB GPU view through this chain:

1. `uniform.use_color` (`servers/rendering/shader_language.cpp:9830`).
2. `texture.use_color` (`servers/rendering/shader_compiler.cpp:613`).
3. The sRGB view is bound
   (`servers/rendering/renderer_rd/storage_rd/material_storage.cpp:1067,1073`).
4. `p_use_linear_color` is true for every 3D material
   (`servers/rendering/renderer_rd/forward_clustered/scene_shader_forward_clustered.cpp:595`).

## Which textures have an sRGB view

A sampler reads the sRGB view only when the texture has one:
`rd_texture = (srgb && tex->rd_texture_srgb.is_valid()) ? tex->rd_texture_srgb : tex->rd_texture`
(`servers/rendering/renderer_rd/storage_rd/material_storage.cpp:1073`). The
rendering device makes that view only for a format with an sRGB variant
(`texture_storage.cpp:895-902`): RGB8, RGBA8 and the block formats with one.
`formatHasSrgbView` in `godot/texture.ts` lists them.

Each producer records the format Godot holds its image in
(`recordGodotFormat`), and `sourceColorSpace` reads it:

| Producer | Format |
| --- | --- |
| ImageTexture | the saved `Image` format |
| NoiseTexture2D | L8, or RGBA8 with a `color_ramp` or `as_normal_map` |
| GradientTexture2D | RGBA8, or RGBAFloat with `use_hdr` |
| AtlasTexture | its atlas's format |
| an image file | none recorded, read as sRGB |

An image file records no format, so a colour slot reads it sRGB. That matches Godot for an RGB or
RGBA file and for a VRAM-compressed import. Godot loads a greyscale PNG or JPEG as L8 or LA8
(`drivers/png/png_driver_common.cpp:84-87`), and a lossless import keeps that format, so Godot
reads it raw. The previewer reads no texture `.import` sidecar yet, so it reads that file sRGB.

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

`SLOT_READS_SOURCE_COLOR` is exhaustive over `TextureSlot`, so a new slot fails
to compile until someone reads Godot's shader for it.
