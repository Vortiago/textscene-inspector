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

## ImageTexture
<!-- compare: image=unit-material-albedo-image-format status=done fixture=unit-material-albedo-image-format.tscn -->

A texture whose pixels the scene or a `.tres` saves inline, as an `Image` sub-resource. The previewer decodes every uncompressed format Godot saves: the 8-bit, 16-bit, half and float formats, RGBA4444, RGB565 and RGBE9995. A float channel above 1 survives, as Godot's does. A colour slot reads RGB8 and RGBA8 as sRGB and every other format raw, as Godot does. So the Lum8 strip draws brighter than the RGB8 strip of the same bytes. The same rule holds for a NoiseTexture2D, which is Lum8 without a colour ramp, and a GradientTexture2D, which is a float format with `use_hdr`.

## Block-compressed Image
<!-- compare: image=unit-sprite2d-block-compressed status=done fixture=unit-sprite2d-block-compressed.tscn -->

An `Image` can also save the S3TC and RGTC blocks of a compressed texture. The previewer decodes DXT1, DXT3, DXT5, DXT5_RA_AS_RG, RGTC Red8 and RGTC RedGreen8 to RGBA8 as Godot's bcdec fallback does, then applies Godot's swizzle. So DXT1 draws opaque, RGTC draws blue 0, and DXT5_RA_AS_RG carries its alpha in green. Each sprite is one colour ramp in one format. The top-left block of the DXT1 sprite is in the three-colour mode, so its last texel draws black. A GPU that decodes the blocks itself can round an interpolated colour one step apart from bcdec.

## Image file
<!-- compare: image=unit-material-albedo-image-import status=limitation fixture=unit-material-albedo-image-import.tscn -->

A scene names a PNG, JPEG, WebP or SVG file by path. Godot imports it as its `.import` sidecar says. A colour slot reads it through the format Godot imports it in, which comes from the file's own header and the sidecar's `compress/mode`. A greyscale PNG or JPEG imports as Lum8 or LumAlpha8 unless the sidecar asks for VRAM or Basis Universal compression, so it reads raw. The top strip is a greyscale PNG with no sidecar, the second is the same PNG VRAM compressed, and the third is an RGB PNG. The bottom strip is that RGB PNG imported as a VRAM compressed normal map. So it is RGTC, which keeps red and green raw and samples blue as 0. The sidecar also decides the mip chain, the alpha-border pass, the alpha premultiply, the normal map's green and an SVG's scale. `standardmaterial3d/textureBinding.md` has the rules and their cites.

## glTF image
<!-- compare: image=unit-gltf-alpha-border status=done fixture=unit-gltf-alpha-border.tscn -->

Godot imports a glTF image through the same texture importer, as the file it extracts the image to. That file's sidecar decides its texels and its format. The quad's image is a green square inside transparent magenta texels. The default alpha-border pass turns them green, so the blended edge fades green, not magenta.

## NoiseTexture2D

A field baked from a FastNoiseLite, most often as a normal map. A `seamless` bake wraps its opposite edges and tiles. A plain one clamps, so UVs past the tile smear its edge texels. Under a StandardMaterial3D both tile, because `texture_repeat` defaults on (`material.cpp:4005`) and the sampler hint adds `repeat_enable` (`material.cpp:760-765`).

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
- **Approximated** The GPU builds an image file's mip chain, where Godot averages the bytes on the CPU (`core/io/image.cpp:2146-2175`).
- **Resource gap** An ImageTexture saved in a BPTC, ETC, EAC, ASTC or integer format draws no texture.
- **Not drawn** A NoiseTexture2D wider or taller than 16384 pixels draws no texture, where Godot draws one on a GPU that uploads larger textures.
