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

A feature showcase that walks through the StandardMaterial3D model with rows of
spheres, each row named by a Label3D caption. Both images are the same whole scene
— a large red backdrop sphere with four labelled groups of smaller spheres in front
— rendered through real Godot and through this previewer.

## What it exercises

- Label3D captions: the "Material Feature Showcase" title plus the four row labels
  (Basic Materials (albedo, metallic, roughness), Emission & Normal Maps, Advanced
  PBR, Transparency & Glass) — both frames draw every one.
- StandardMaterial3D albedo: the flat red, cyan and copper/brown spheres.
- Metallic + roughness: the chrome-grey sphere with its tight specular highlight,
  and the polished browns of the Advanced PBR row.
- Emission: the bright turquoise/green spheres that light up against the dark ground.
- Transparency / glass: the frosted white sphere and the pale translucent sphere in
  the bottom row.
- A large emissive red backdrop sphere filling the upper right.
- The scene's own Camera3D framing the whole stand of spheres against the
  grey-sky-over-brown-ground preview environment — both images render THROUGH that
  authored camera (Godot adopts it; the previewer activates it via the `?camera=`
  deep-link), so the framing matches by construction rather than from two
  independent fit-to-bounds passes.

## Divergences

The two frames now agree closely. Both render through the same authored Camera3D, so
the layout, zoom and every Label3D caption line up; the plain PBR spheres — red,
chrome-grey with its matching specular, copper/brown — read the same; and the bright
emissive materials bloom on both sides. Godot's editor environment runs a glow pass,
and the previewer reproduces it (an HDR bloom driven by the environment's `glow_*`
values): the emission-row sphere throws its cyan-green halo, the pale glass sphere
glows lavender, and the emission cores tonemap toward a bright cyan-white wash rather
than staying flat and saturated. The emission colour matches too — emission is now
sRGB→linear converted exactly once, so the emissive sphere reads Godot's cyan-white
instead of an over-saturated blue.

What remains is minor: our single-pass additive bloom spreads a little brighter and
wider than Godot's default SOFTLIGHT glow, so the halos are a touch stronger, and the
`glow_blend_mode` is not yet applied. The spheres, their colours, and the bloom
pattern all match.
