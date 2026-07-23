---
type: Material Feature Showcase
category: Complex Scenes
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

The two frames agree on framing and on the plain PBR spheres: both render through the
same authored Camera3D, so the layout, zoom and every Label3D caption line up, and the
red, cyan, chrome-grey (with matching specular) and copper/brown spheres read the same
in both.

What is left is glow and tone mapping. Godot's editor environment blooms the bright
emissive materials and filmic-tonemaps the frame — the turquoise and green spheres
throw coloured halos, the pale glass sphere glows lavender-magenta, and the title
picks up a warm cream haze. The previewer applies the emission energy multiplier and
the glass sphere's 0.3 opacity correctly, but runs no glow post-process or filmic
tonemap, so those cores render flat and hard-edged: the bloom that lightens and cools
Godot's emissive cores is gone, so the emission-row sphere that tonemaps toward
turquoise there stays a flatter saturated green in ours with no halo, the glass sphere
reads a more opaque periwinkle (its smooth surface reflecting the blue sky rather than
blooming to lavender), and the title is a plainer yellow. This is the known glow/bloom
+ tonemap gap, not a materials difference.
