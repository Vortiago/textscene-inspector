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

Framing, the tiles, the trees and the parallax layers match.

## Known limitations

- **Approximated** The coins and the crab enemies draw smoothed, where Godot draws them
  pixel-sharp, for a cause not yet known.
- **Approximated** Each crab shows another pose than Godot's, for a cause not yet known.
