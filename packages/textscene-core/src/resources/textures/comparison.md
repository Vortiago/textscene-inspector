---
type: Texture2D
category: Resources
renders_as: a THREE.DataTexture / CanvasTexture
---

# Texture2D (sub-resource textures)

A material's texture slot can point at a SubResource Texture2D rather than an imported image. GradientTexture2D, CanvasTexture, AtlasTexture and NoiseTexture2D are all rasterised or windowed on the client and reach every consumer as a `THREE.Texture`.

## GradientTexture2D
<!-- compare: image=unit-coin-glow status=limitation fixture=unit-coin-glow.tscn -->

A procedural gradient baked to a texture, here a radial white-to-transparent glow. The falloff and placement match Godot.

- **Approximated** The additive glow reads a touch whiter where Godot's is a warmer gold.

## CanvasTexture
<!-- compare: image=unit-sprite2d-canvastexture status=done fixture=unit-sprite2d-canvastexture.tscn -->

A Texture2D that wraps an image with optional normal and specular maps. The sprite renders identically to the sibling that references the image directly, in both engines.

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
- **Approximated** A NoiseTexture2D's domain warp is decoded but not applied, so the palette and scale match while the swirl does not.
- **Not drawn** A NoiseTexture2D wider or taller than 16384 pixels draws no texture, where Godot draws one on a GPU that uploads larger textures.
