---
type: Texture2D
category: Resources
renders_as: a THREE.DataTexture / CanvasTexture
---

# Texture2D (sub-resource textures)

A material's texture slot can point at a SubResource Texture2D, not only an imported
image. Three common ones:

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
