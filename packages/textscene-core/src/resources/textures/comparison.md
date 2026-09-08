---
type: Texture2D
category: Resources
status: unreviewed
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

## AtlasTexture

One cell of a sheet: `atlas` names the image, `region` the cell. Every Texture2D slot
resolves it — sprites and `useTexture2D` consumers window the sheet's UVs, the DOM
controls (TextureRect, Button icon) crop the decoded bitmap, since an `<img>` has no
UVs. A sprite's own `region_rect` is authored in cell space: it translates by the cell
origin and is clipped to the cell, and a region that misses the cell entirely draws
nothing — `AtlasTexture::get_rect_region`. (A plain Texture2D is never clipped this
way; its oversized region runs the UVs past 1.0 instead.)

Two properties are not applied:

- `margin` — Godot pads the drawn size with transparent border and shifts the source
  by `margin.position`. Cell pixels stay correct; a trimmed-atlas layout sits off by
  the margin.
- `filter_clip` — Godot clamps sampling inside the cell so a filtered edge cannot
  bleed in from the neighbouring cell. three has no per-draw equivalent, so the UV
  path can bleed one texel at cell edges under linear filtering; the cropped DOM path
  cannot.

## NoiseTexture2D + FastNoiseLite

A noise field generated into a texture. The generator is the `fastnoise-lite` package,
the official JS port of the same upstream library Godot vendors: sampled against real
Godot 4.6.3, the two agree to about 1e-7 across simplex, cellular and weighted-fBm
Perlin settings. That holds only because every parameter is configured explicitly —
the raw library's own defaults are not Godot's (3 fractal octaves against Godot's 5,
EuclideanSq cellular distance against Godot's Euclidean), and leaving one unset moves
a sample from 0.61 to 0.25. The image layer
around it is ported from Godot: normalisation to the field's own min/max, `invert`,
the `color_ramp` mapped through each pixel's luminance, `as_normal_map` through
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

## Linting

<!-- lint:begin Texture2D -->
Strict parsing format-checks the inherited set (2 inherited from Resource); `Texture2D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

The lenient parser never rejects a texture property: an unreadable value falls back to Godot's default through the shared value decoders, and a reference it cannot resolve leaves the slot empty, so the consumer renders untextured rather than failing the scene.
