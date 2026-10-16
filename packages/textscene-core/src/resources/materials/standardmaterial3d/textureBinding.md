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
`formatHasSrgbView` in `godot/rendering/srgbView.ts` lists them.

Each producer records the format Godot holds its image in
(`recordGodotFormat`), and `sourceColorSpace` reads it:

| Producer | Format |
| --- | --- |
| ImageTexture | the saved `Image` format |
| NoiseTexture2D | L8, or RGBA8 with a `color_ramp` or `as_normal_map` |
| GradientTexture2D | RGBA8, or RGBAFloat with `use_hdr` |
| AtlasTexture | its atlas's format |
| an image file | its import format, from the source format and the import sidecar |
| a glTF image | the import format of the file Godot imports it as |

## How Godot imports an image file

Godot loads an image file in its source format (`godot/import/imageSourceFormat.ts`):

- PNG: colour type 0 is L8, and type 4, or type 0 with a `tRNS` chunk, is LA8, at any bit depth.
  A colour or paletted PNG is RGB8 or RGBA8 (`drivers/png/png_driver_common.cpp:66-93`).
- JPEG: one component is L8, and three are RGB8
  (`modules/jpg/image_loader_libjpeg_turbo.cpp:58-65`).
- WebP: RGB8, or RGBA8 when the file has alpha (`modules/webp/webp_common.cpp:135-175`).
- SVG: RGBA8, rasterised at `svg/scale` times its own size, rounded
  (`modules/svg/image_loader_svg.cpp:91-103`, `:130`).

The texture importer then reads the image's `.import` sidecar (`importTextureOptions`). A missing
sidecar reads as the Detect preset's defaults (`editor/import/resource_importer_texture.cpp:234-262`).
The previewer does not predict the editor's later re-imports of a texture it first sees in 3D
(`detect_3d/compress_to`) or as a normal map (`compress/normal_map` Detect).

The importer rewrites the texels in this order (`:861-874`):

1. `process/fix_alpha_border`, on by default, gives each nearly transparent texel the colour of the
   nearest opaque one. It runs only on RGBA8 (`core/io/image.cpp:4247`).
2. `process/premult_alpha` multiplies the colour by alpha. It runs only on RGBA8 (`:4220-4240`).
3. `process/normal_map_invert_y` inverts green (`resource_importer_texture.cpp:657-671`).

`mipmaps/generate`, off by default, decides whether the texture has a mip chain. A texture without
one samples its base level under every `texture_filter`. Godot forces it on for every glTF image it
extracts (`modules/gltf/gltf_document.cpp:2251-2255`). An external glTF image keeps its own
sidecar's (`:2356-2363`).

The importer builds the chain on the CPU, after the texel passes (`resource_importer_texture.cpp:401-412`).
Each level averages each 2 × 2 block of the level above in the image's own bytes
(`core/io/image.cpp:1947-1979`), so an sRGB image averages its encoded values, not its linear light.
An odd size drops its last column or row. With `compress/normal_map` Enable, each level of an RGB8
or RGBA8 image is renormalised to unit normals (`:2003-2014`, `:4577-4588`). The compression then
stores each level, so an RGTC normal map drops blue after the renormalise. The previewer builds the
same chain and uploads it as the texture's levels (`processing/mipChain.ts`).

A Decal reads its copy in the decal atlas, which builds its own mip chain
(`texture_storage.cpp:3162-3226`), so a decal mipmaps whatever the import says. The atlas halves
each level in its RGBA8 bytes too. So a decal shares an imported chain, and over an import with no
chain the previewer builds one with the same byte average.

`compress/mode` then gives the import format (`godot/import/textureImport.ts`):

| `compress/mode` | Import format |
| --- | --- |
| 0 Lossless, 1 Lossy, 3 VRAM Uncompressed | the source format |
| 2 VRAM Compressed | DXT5 RGBA8 when a texel has alpha below 0.999, else DXT1 RGB8. BPTC_RGBA with `compress/high_quality` |
| 4 Basis Universal | BPTC_RGBA |

A normal map (`compress/normal_map` Enable) uses only RG (`core/io/image.cpp:3732-3734`). So mode 4,
and mode 2 without `compress/high_quality`, give RGTC RedGreen8 instead. A shader samples it as
red, green, blue 0 and alpha 1, raw in every slot. The VRAM block is in
`resource_importer_texture.cpp:934-947`, the channel detection in `core/io/image.cpp:3728-3802`, the S3TC formats in
`modules/etcpak/image_compress_etcpak.cpp:60-78`, and the Basis Universal formats in
`modules/basis_universal/image_compress_basisu.cpp:321-324` and `:356-393`. So a greyscale PNG or
JPEG reads raw in a colour slot at modes 0, 1 and 3, and sRGB at modes 2 and 4.

A glTF image with a `uri` imports as that file, under its own sidecar. Godot extracts an embedded
image to `<base name>_<image name>.<png|jpg>` beside the glTF
(`modules/gltf/gltf_document.cpp:2209-2210`, `:2321-2333`). That file's sidecar decides its texels
and its import format as it does for any image file (`godot/import/gltfImageFiles.ts`,
`resources/formats/glb/imageImport.ts`).

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
