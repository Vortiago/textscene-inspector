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

The layout, every Label3D caption, the plain PBR spheres and their colours match. The
emissive spheres bloom on both sides, with Godot's cyan-green halo and cyan-white cores.

## Known limitations

- **Approximated** The 13-tap glow kernel is not Godot's gaussian, so the halos round the emissive
  spheres and the chrome highlight read brighter and wider.
