---
type: Material Feature Showcase
category: Complex Scenes
status: limitation
fixture: integration-material-features.tscn
image: complex-materials
camera: Root/Camera3D
renders_as: the StandardMaterial3D feature range on one stand
---

# Material Feature Showcase

A feature showcase of the StandardMaterial3D model: rows of spheres, each row
named by a Label3D caption, in front of a large red backdrop sphere. Both images
show the same whole scene from real Godot and from this previewer.

## What it exercises

- Label3D captions: the "Material Feature Showcase" title plus the four row labels
  (Basic Materials (albedo, metallic, roughness), Emission & Normal Maps, Advanced
  PBR, Transparency & Glass). Both frames draw every one.
- StandardMaterial3D albedo: the flat red, cyan and copper/brown spheres.
- Metallic + roughness: the chrome-grey sphere with its tight specular highlight,
  and the polished browns of the Advanced PBR row.
- Emission: the bright turquoise/green spheres that light up against the dark ground.
- Transparency / glass: the frosted white sphere and the pale translucent sphere in
  the bottom row.
- A large emissive red backdrop sphere filling the upper right.
- The scene's own Camera3D framing the whole stand of spheres against the
  grey-sky-over-brown-ground preview environment. Both images render through that
  authored camera (Godot adopts it, and the previewer activates it with the
  `?camera=` deep link), so the framing matches by construction rather than from
  two independent fit-to-bounds passes.

## Divergences

The two frames agree closely. Both render through the same authored Camera3D, so
the layout, zoom and every Label3D caption line up. The plain PBR spheres (red,
chrome-grey with its matching specular, copper/brown) read the same. The bright
emissive materials bloom on both sides: Godot's editor environment runs a glow
pass, and the previewer reproduces it with an HDR bloom driven by the
environment's `glow_*` values. The emission-row sphere throws its cyan-green halo,
the pale glass sphere glows lavender, and the emission cores tonemap toward a
bright cyan-white wash. The previewer converts emission from sRGB to linear
exactly once, so the emissive sphere reads Godot's cyan-white.

The remaining difference is minor. The previewer's single-pass additive bloom
spreads a little brighter and wider than Godot's default SOFTLIGHT glow, so the
halos are a little stronger, and the previewer does not apply `glow_blend_mode`.
The spheres, their colours and the bloom pattern all match.
