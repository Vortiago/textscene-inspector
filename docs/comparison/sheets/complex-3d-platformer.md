---
type: Godot 3D Platformer
category: Complex Scenes
fixture: demos/3d/platformer/game.tscn
image: complex-3d-platformer
renders_as: Godot's 3D platformer level at the editor orbit
---

# Godot 3D Platformer

Godot's 3D Platformer demo (`game.tscn`): a whole playable level of grass-topped,
textured terrain blocks with floating platforms, a mesh enemy character, and
coins under a blue sky. Both images are the same scene rendered through real
Godot and through this previewer, framed at the same editor orbit — a whole 3D
level, not a single node.

## What it exercises

- **GridMap terrain** — the stepped dirt blocks with wavy dark/light strata,
  built from one GridMap and drawn with the same terraced silhouette on both sides.
- **StandardMaterial3D albedo textures** — the striated dirt sides and speckled
  grass tops, sampled from the same textures.
- **MeshInstance3D characters and props** — the domed, claw-armed enemy with its
  bright eye visor, and the trunk-and-canopy tree pillars, as textured meshes.
- **Coin instances** floating over the platforms.
- The editor **preview sun + sky**, casting shadows across the terraces.

## Divergences

The framing matches; the differences are in shading and post-processing. Godot
runs a glow pass, so the coins bloom into bright halos and the lit grass reads
more vivid; the previewer has no glow, so the coins render as flat discs and the
scene is a touch flatter. Godot also holds the enemy in the terrain's shadow
(darker), where ours lights it more evenly — a shadow/exposure difference, not a
geometry one. The level layout, terrain, props, and enemy all render in the same
places.
