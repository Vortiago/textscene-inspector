---
type: Godot 3D Platformer
category: Complex Scenes
status: limitation
fixture: demos/3d/platformer/game.tscn
image: complex-3d-platformer
renders_as: Godot's 3D platformer level at the editor orbit
---

# Godot 3D Platformer

Godot's 3D platformer demo (`game.tscn`): textured terrain blocks, floating platforms, an
enemy and coins under a blue sky. Both sides use the same editor orbit.

## What it exercises

- GridMap terrain
- StandardMaterial3D albedo textures
- Textured mesh characters and props, including a GLB enemy that self-shadows
- Coin instances with additive glow sprites
- The stage's own WorldEnvironment: AgX tonemapping and a flat colour ambient

Framing, terrain, props and shadow shapes match.

## Known limitations

- **Shader missing** The previewer does not run the custom `sky` shader over a
  `CompressedCubemap`, so smooth metal reflects black and the coins read grey, not gold.
- **Resource gap** The ReflectionProbe nodes have no effect, so recesses are lighter and the
  coin halos look faint.
