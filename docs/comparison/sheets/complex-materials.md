---
type: Material Feature Showcase
category: Complex Scenes
fixture: integration-material-features.tscn
image: complex-materials
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
- Camera3D framing the whole stand of spheres against the grey-sky-over-brown-ground
  preview environment.

## Divergences

The two frames agree on layout, camera, and the plain PBR spheres: the red, cyan,
chrome-grey (with matching specular) and copper/brown spheres read the same in both,
and every Label3D caption is present.

The difference is glow. Godot's editor environment blooms the bright emissive
materials — the turquoise and green spheres throw coloured halos, the pale glass
sphere glows lavender-magenta, and the title picks up a warm cream haze. The
previewer runs no glow post-process, so those same spheres render as flat,
hard-edged discs: the bloom that lightens and cools Godot's emissive cores is gone,
so the emission-row sphere that reads turquoise there stays a flatter saturated green
in ours, with no halo, and the title is a plainer yellow.

The bottom-row glass sphere also diverges — pale translucent lavender in Godot versus
a more opaque periwinkle blue in ours — because the glass material's transmission
plus that missing bloom isn't reproduced.
