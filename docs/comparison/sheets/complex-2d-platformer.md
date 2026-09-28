---
type: Godot 2D Platformer
category: Complex Scenes
status: limitation
fixture: demos/2d/platformer/level/level.tscn
image: complex-2d-platformer
renders_as: Godot's 2D platformer demo level
---

# Godot 2D Platformer

Godot's 2D platformer demo level: grass-topped platforms over a parallax sky, with trees,
coins, rocks, mushrooms and crab enemies.

## What it exercises

- TileMapLayer platforms and a full-height rock column
- Sprite2D decoration and enemy sprites
- A multi-layer parallax background
- A Camera2D framing the level

## Known limitations

- **Approximated** A platform underside and its vines show along the top edge, where Godot
  shows sky. The cause is not known.
- **Approximated** The lower-right platform stops short of the right edge, and its tree
  crown is cut. The cause is not known.
