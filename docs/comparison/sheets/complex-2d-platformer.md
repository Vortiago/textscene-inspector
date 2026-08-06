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

Both frames cover the same slice of the level, in the same colours: the sky reads
rgb(114, 221, 255) on both sides, the parallax layers carry no global offset and the same
colours, and the coins are present in both. Two content differences remain, measured
on Godot 4.6.3 with `pnpm ref:godot scenes/demos/2d/platformer/level/level.tscn --mode 2d
--probe <x,y>` against `pnpm ref:ours demos/2d/platformer/level/level.tscn --2d --probe
<x,y>`:

| Probe | What it is | Godot | Ours |
| --- | --- | --- | --- |
| (4, 0) | the top edge — sky in Godot, platform rock here | rgb(62, 168, 255) | rgb(64, 59, 72) |
| (780, 400) | the lower-right platform — rock in Godot, sky here | rgb(64, 59, 72) | rgb(114, 221, 255) |

So ours draws a platform underside and its hanging vines clipped by the top edge across
rows 0..8, where Godot's frame is open sky; and Godot's lower-right
platform runs to the right frame edge with a full tree crown while ours stops at x = 759.
The cause of neither is identified.
