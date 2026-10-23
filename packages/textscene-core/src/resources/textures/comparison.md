---
type: Texture2D
category: Resources
renders_as: a THREE.DataTexture / CanvasTexture
---

# Texture2D (sub-resource textures)

A material's texture slot can point at a Texture2D that the scene or a `.tres` describes. The previewer rasterises or windows a GradientTexture2D, CanvasTexture, AtlasTexture, NoiseTexture2D or saved ImageTexture on the client. Each reaches every consumer as a `THREE.Texture`.

## GradientTexture2D
<!-- compare: image=unit-coin-glow status=limitation fixture=unit-coin-glow.tscn -->

A procedural gradient baked to a texture, here a radial white-to-transparent glow. The falloff and placement match Godot. With `use_hdr`, a channel above 1 survives, as in Godot's float image.

- **Approximated** The additive glow reads a touch whiter where Godot's is a warmer gold.

## CanvasTexture
<!-- compare: image=unit-sprite2d-canvastexture status=done fixture=unit-sprite2d-canvastexture.tscn -->

A Texture2D that wraps an image with optional normal and specular maps. The sprite renders identically to the sibling that references the image directly, in both engines. A CanvasTexture is a 2D object. In a material slot its RID names no texture, so Godot and the previewer bind a white texture in any slot.

## AtlasTexture
<!-- compare: image=unit-material-albedo-atlas-texture status=done fixture=unit-material-albedo-atlas-texture.tscn -->

A Texture2D that windows a region of another texture. A 2D consumer draws the region. A material slot binds the whole sheet, as Godot does. A material reads a texture by its RID, and an AtlasTexture's RID is its sheet's (`atlas_texture.cpp:55-58`). The left quad names the top-left texel and draws all four. The right quad binds a CanvasTexture and draws white.

## AtlasTexture mip chain
<!-- compare: image=unit-atlastexture-normal-mipmap status=done fixture=unit-atlastexture-normal-mipmap.tscn -->

A minified AtlasTexture samples the chain its sheet's import built. The sheet holds stripes leaning 0 and 90 degrees, imported as a normal map, so each level is renormalised. The left sprite draws the sheet and the right one a crop of all of it, at a quarter of its size. Both draw the 45-degree colour, as in Godot.

## ImageTexture
<!-- compare: image=unit-material-albedo-image-format status=done fixture=unit-material-albedo-image-format.tscn -->

A texture whose pixels the scene or a `.tres` saves inline, as an `Image` sub-resource. The previewer decodes every uncompressed format Godot saves: the 8-bit, 16-bit, half and float formats, RGBA4444, RGB565 and RGBE9995. A float channel above 1 survives, as Godot's does. A colour slot reads RGB8 and RGBA8 as sRGB and every other uncompressed format raw, as Godot does. So the Lum8 strip draws brighter than the RGB8 strip of the same bytes. The same rule holds for a NoiseTexture2D, which is Lum8 without a colour ramp, and a GradientTexture2D, which is a float format with `use_hdr`.

## Block-compressed Image
<!-- compare: image=unit-sprite2d-block-compressed status=done fixture=unit-sprite2d-block-compressed.tscn -->

An `Image` can also save the S3TC and RGTC blocks of a compressed texture. The previewer decodes DXT1, DXT3, DXT5, DXT5_RA_AS_RG, RGTC Red8 and RGTC RedGreen8 to RGBA8 as Godot's bcdec fallback does, then applies Godot's swizzle. So DXT1 draws opaque, RGTC draws blue 0, and DXT5_RA_AS_RG carries its alpha in green. A colour slot reads the four S3TC formats as sRGB and the two RGTC formats raw, as Godot does. Each sprite is one colour ramp in one format. The top-left block of the DXT1 sprite is in the three-colour mode, so its last texel draws black. A GPU that decodes the blocks itself can round an interpolated colour one step apart from bcdec.

## Image file
<!-- compare: image=unit-material-albedo-image-import status=limitation fixture=unit-material-albedo-image-import.tscn -->

A scene names a PNG, JPEG, WebP or SVG file by path. Godot imports it as its `.import` sidecar says. A colour slot reads it through the format Godot imports it in, which comes from the file's own header and the sidecar's `compress/mode`. A greyscale PNG or JPEG imports as Lum8 or LumAlpha8 unless the sidecar asks for VRAM or Basis Universal compression, so it reads raw. The top strip is a greyscale PNG with no sidecar, the second is the same PNG VRAM compressed, and the third is an RGB PNG. The bottom strip is that RGB PNG imported as a VRAM compressed normal map. So it is RGTC, which keeps red and green raw and samples blue as 0. The sidecar also decides the mip chain, the alpha-border pass, the alpha premultiply, the normal map's green and an SVG's scale. `standardmaterial3d/textureBinding.md` has the rules and their cites.

## Imported mip chain
<!-- compare: image=unit-material-mipmap-import status=done fixture=unit-material-mipmap-import.tscn -->

An image file whose sidecar sets `mipmaps/generate` samples the mip chain Godot's importer builds on the CPU. Each level averages the bytes of the level above, so an sRGB image averages its encoded values. Both strips tile an 8 × 8 image so densely that they sample its smallest levels. The top strip is a red and green checker, which averages to a dark yellow, as in Godot. The bottom strip is a normal map of stripes, imported as a normal map, so each level is renormalised and leans 45 degrees towards the light.

## Roughness limiter
<!-- compare: image=unit-material-roughness-limiter status=done fixture=unit-material-roughness-limiter.tscn -->

A roughness map whose sidecar sets `roughness/mode` and `roughness/src_normal` runs Godot's roughness limiter on its mip chain. Each level gets rougher by the spread of the normals it covers in the named normal map. Both spheres tile the same smooth roughness map and bumpy normal map. The left map's sidecar names the normal map, so its minified highlight spreads and dims, as in Godot. The right map's sidecar turns the limiter off.

## glTF image
<!-- compare: image=unit-gltf-alpha-border status=done fixture=unit-gltf-alpha-border.tscn -->

Godot imports a glTF image through the same texture importer, as the file it extracts the image to. That file's sidecar decides its texels and its format. The quad's image is a green square inside transparent magenta texels. The default alpha-border pass turns them green, so the blended edge fades green, not magenta.

## Soft-alpha border
<!-- compare: image=unit-sprite-2d-soft-alpha-border status=done fixture=unit-sprite-2d-soft-alpha-border.tscn -->

A green disc with a three-texel alpha ramp, inside transparent magenta texels, drawn 20 times larger. The default alpha-border pass gives each texel below alpha 20 the RGB of its nearest opaque neighbour, as `Image::fix_alpha_edges` does (`core/io/image.cpp`). The previewer runs it on a texture with partial alpha too. It reads the decoded bytes unpremultiplied, so the ramp keeps its colour. With the pass off, the edge of the disc takes a magenta tint in both engines.

## NoiseTexture2D
<!-- compare: image=unit-noisetexture2d-mipmaps status=done fixture=unit-noisetexture2d-mipmaps.tscn -->

A field baked from a FastNoiseLite, most often as a normal map. A `seamless` bake wraps its opposite edges and tiles. A plain one clamps, so UVs past the tile smear its edge texels. Under a StandardMaterial3D both tile, because `texture_repeat` defaults on (`material.cpp:4005`) and the sampler hint adds `repeat_enable` (`material.cpp:760-765`).

A minified NoiseTexture2D samples the mip chain Godot builds on the CPU when `generate_mipmaps` is on, the default. Each level averages the bytes of the level above, so the noise fades to a flat tone as the quad shrinks. A 256 × 256 normal map draws unshaded on a 1 × 1 and a 0.4 × 0.4 quad, and both engines sample the same levels. With `generate_mipmaps` off, a minified texture samples only its base level and aliases, in both engines.

## Linting

<!-- lint:begin Texture2D -->
Strict parsing format-checks the inherited set (2 inherited from Resource); `Texture2D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

The lenient parser never rejects a texture property. An unreadable value falls back to Godot's default through the shared value decoders. A reference it cannot resolve leaves the slot empty, so the consumer renders untextured.

## Known limitations

- **Approximated** An AtlasTexture's `margin` is not applied, so a trimmed-atlas layout sits off by the margin.
- **Approximated** An AtlasTexture's `filter_clip` is not applied, so a filtered cell edge can bleed one texel from its neighbour.
- **Approximated** A NoiseTexture2D slot draws empty on first load until its build finishes, where Godot waits and draws the texture on its first frame.
- **Approximated** A VRAM-compressed or lossy image file draws its source texels, without the compression error Godot's import adds.
- **Approximated** A file with no sidecar reads as a fresh import, not as the editor re-imports a texture it sees in 3D.
- **Approximated** An imported image keeps its bytes and mip chain in memory after the upload for later readers (decals, crops, flowmaps, context loss), where Godot frees them.
- **Approximated** An image file past the GPU's `MAX_TEXTURE_SIZE` cannot be read back, so its GPU-built chain averages an sRGB image in linear space.
- **Resource gap** An ImageTexture saved in a BPTC, ETC, EAC, ASTC or integer format draws no texture.
- **Not drawn** A NoiseTexture2D wider or taller than 16384 pixels draws no texture, where Godot draws one on a GPU that uploads larger textures.
