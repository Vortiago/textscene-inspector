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
  `CompressedCubemap`, so the sky draws a pale grey-blue where Godot's is a deep blue.
- **Not drawn** The ReflectionProbe nodes have no effect on reflections or ambient light.
- **Approximated** Every surface out of the sun reads near black in Godot, where the
  previewer lights it with the flat ambient colour.
- **Not drawn** The touch-screen CanvasLayer UI (a joystick and the JUMP and SHOOT buttons)
  shows in Godot but not over the 3D view here.
