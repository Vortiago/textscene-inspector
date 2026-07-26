---
type: Texture2D
category: Resources
renders_as: a THREE.DataTexture / CanvasTexture
---

# Texture2D (sub-resource textures)

A material's texture slot can point at a SubResource Texture2D, not only an imported
image. Two common ones:

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
