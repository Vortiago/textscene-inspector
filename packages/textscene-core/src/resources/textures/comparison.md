---
type: Texture2D
category: Resources
renders_as: a THREE.DataTexture / CanvasTexture
---

# Texture2D (sub-resource textures)

A material's texture slot can point at a SubResource Texture2D, not only an imported
image. Four common ones:

## GradientTexture2D
<!-- compare: image=unit-coin-glow status=limitation fixture=unit-coin-glow.tscn -->

A procedural gradient baked to a texture — here a radial white→transparent gradient
driving an additive glow. The radial falloff and placement match Godot; ours' additive
glow reads a touch whiter where Godot's is a warmer gold.

## CanvasTexture
<!-- compare: image=unit-sprite2d-canvastexture status=done fixture=unit-sprite2d-canvastexture.tscn -->

A Texture2D that wraps an image (with optional normal / specular maps). The
CanvasTexture sprite renders identically to the sibling that references the image
directly, in both engines. (The 2D viewport's zoom and grid chrome differ — a capture
framing artifact, not the texture.)

The wrapper is peeled off one level and its `diffuse_texture` resolves as any other
Texture2D, so it may itself be an inline GradientTexture2D rather than an image file.

## AtlasTexture

A cell windowed out of a sprite sheet: an `atlas` texture plus a `region`, an optional
`margin` and `filter_clip`. Godot presents one to every consumer as a texture of its
OWN size — `get_width`/`get_height` return `region.size.floor() + margin.size`, falling
back to the sheet's dimension on an axis whose region size is zero — so the cell drives
a Control's minimum size as well as its pixels. The previewer cuts the cell out of the
loaded sheet into a texture of exactly that size, with the region composed at
`margin.position` inside it and the rest of the box transparent; every Texture2D slot
therefore reads a cell the same way it reads an image file.

`scenes/fixtures/unit-texturerect-atlastexture.tscn` is the golden: three cells of one
four-colour sheet, each shrunk to its own minimum size.

### Known limitations

- **`filter_clip`.** A pixel crop is unconditionally clipped, which is the
  `filter_clip = true` behaviour; Godot's default is `false`, where linear filtering may
  bleed the neighbouring atlas texel in at the region's edge. Visible only when a cell
  is drawn magnified or rotated with a linear filter, never at 1:1.
- **A fractional `region` position** is floored to whole texels. Godot keeps it
  fractional and samples between them, so a half-texel-offset region differs by that
  half texel. Nothing the editor writes is fractional.
- **A zero-size region axis** takes the sheet's dimension for the pixels, as Godot does,
  but reports no minimum size for that axis to a container — the layout solve runs
  without the sheet, and only the sheet knows the answer.
- **Semi-transparent texels** pass through a premultiplied canvas on the way into the
  crop, so they can differ from the sheet's own byte by 1/255. Opaque and fully
  transparent texels are exact.

## NoiseTexture2D + FastNoiseLite

A noise field generated into a texture. The generator is the `fastnoise-lite` package,
the official JS port of the same upstream library Godot vendors: sampled against real
Godot 4.6.3, the two agree to about 1e-7 across simplex, cellular and weighted-fBm
Perlin settings. That holds only because every parameter is configured explicitly —
the raw library's own defaults are not Godot's (3 fractal octaves against Godot's 5,
EuclideanSq cellular distance against Godot's Euclidean), and leaving one unset moves
a sample from 0.61 to 0.25. The image layer
around it is ported from Godot: normalization to the field's own min/max, `invert`,
the `color_ramp` mapped through each pixel's luminance, `as_normal_map` via
`Image::bump_map_to_normal_map` (which reads the RED channel, so a ramped texture's
normals come from its red), and the seamless blend skirt's quadrant swap.

Every NoiseTexture2D property the corpus uses is applied (`width`, `height`, `noise`,
`seamless`, `color_ramp`, `as_normal_map`, `bump_strength`), as is every FastNoiseLite
property except the domain-warp block.

**Domain warp is decoded but not applied.** Godot warps the sample position through a
second generator; the JS port's entry point is spelled `DomainWrap` and dispatches on
an unexported `Vector2` class, so it cannot be driven from outside the module and a
plain coordinate object is silently ignored (1.1.1). Three corpus materials enable it
(`lava`, `sand_albedo`, `wet_concrete_albedo`); they render the same generator with
unwarped coordinates, so the palette and scale match while the swirl does not. Files
that set warp parameters WITHOUT `domain_warp_enabled` (`marble`) are unaffected — the
engine ignores them too.

Rasterisation is synchronous and costs roughly a second for a shipped 1024x1024
seamless field, once per resource: Godot generates the same texture on a worker
thread.
