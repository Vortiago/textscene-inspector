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

The framing matches; the level layout, terrain, props, and enemy all render in
the same places, and the shadows fall in the same places too — the difference is
the tone curve, not the shadows or geometry.

This stage carries its own WorldEnvironment set to `tonemap_mode = AGX`, and
Godot's AgX has a harder toe than three's: a surface lit only by the flat ambient
term inside a cast shadow crushes to near-black in Godot but stays dim-but-lit in
ours, while ours' lit grass reads a touch brighter. Measured, the shadowed
mid-ground is mean-brightness 71 in Godot versus 152 in ours — same shadow shape,
shallower fill. Our shadow geometry itself is correct (the FILMIC-lit
`unit-shadows-only` reference matches Godot to within 2/255); only the AgX curve
differs. This is the documented AGX tone-map limitation, not a shadow bug.

The other differences are post-processing: Godot runs a glow pass, so the coins
bloom into bright halos and the lit grass reads more vivid, where the previewer
has no glow yet and the coins render as flat discs. The enemy — a GLB mesh — now
casts and receives shadows on our side too (it was outside the shadow pass
before), so it self-shadows as in Godot; its remaining flatness is the same AgX
toe over the terrain's cast shadow.
