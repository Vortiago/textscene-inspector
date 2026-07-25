---
type: Godot 2D Platformer
category: Complex Scenes
status: limitation
fixture: demos/2d/platformer/level/level.tscn
image: complex-2d-platformer
renders_as: Godot's 2D platformer demo level
---

# Godot 2D Platformer

Godot's 2D platformer demo level: pixel-art grass-topped platforms floating over a
parallax sky, dotted with autumn trees, coins, rocks, mushrooms, and red crab enemies,
with a tall dark-rock column filling the right edge. Both images are the SAME whole level
rendered through real Godot and through this previewer.

## What it exercises

- TileMapLayer platforms — grass-and-dirt tops over banded purple rock strata, with a
  full-height rock column on the right
- Sprite2D decoration: bushy autumn trees, boulders, mushrooms, hanging root/vine tendrils
- Red crab enemy sprites standing on the platforms and ground
- Coins (spinning pickup sprites) laid out across the level
- Parallax background: puffy white clouds and faint distant tree/cliff silhouettes at
  multiple scroll depths behind a light-blue sky
- A 2D camera framing the level through the project viewport

## Divergences

The two frames show overlapping but offset slices of the level. Ours is scrolled up
relative to Godot's, so the platform undersides clip at the top edge and a different set
of background trees sits in view; because the parallax layers track the camera, their
clouds and distant trees land in different positions (Godot's big white clouds vs. ours'
greyer tree silhouettes).

2D content is tone-mapped on our side, so the sky and foliage read paler and flatter —
Godot's un-tonemapped canvas is a deeper blue with more vivid orange leaves, and the
distant parallax layers that stay saturated there wash out to grey in ours.

Coins are scattered throughout Godot's frame but none appear in ours: the coin is an
instanced, animated pickup that the static preview does not surface. A repeating parallax
background layer also leaves a small visible tile seam of sky and cloud at the top-right
of our render, which Godot tiles seamlessly.
