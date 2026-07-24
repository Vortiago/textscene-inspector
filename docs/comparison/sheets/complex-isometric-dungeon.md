---
type: Isometric Dungeon
category: Complex Scenes
status: limitation
fixture: dungeon.tscn
image: complex-isometric-dungeon
renders_as: Godot's isometric dungeon demo — one whole scene
---

# Isometric Dungeon

Godot's isometric dungeon demo: a large hand-built map of blue stone walls, pillars and
diamond floor tiles, dressed with treasure jars, coin piles, red doors and enemy sprites.
Both images are the SAME whole scene rendered through real Godot and through this previewer,
framed by the 1152x648 project viewport.

## What it exercises

- A big isometric TileMapLayer: blue stone walls, standing pillars, multi-height platforms
  and a diamond-checkered floor, with a grey pit/void running through the middle
- Sprite2D props: blue-and-gold ceramic jars, gold coin stacks and rings, red gold-trimmed
  doors
- Enemy sprites: pale bird-skull heads and red crab/spider creatures dotted across the floor
- Draw order and occlusion: pillars and jars sit correctly in front of the floor and each
  other, walls layer front-to-back down the isometric depth

## Divergences

2D content is tone-mapped on our side, so the whole map reads a deeper, flatter, cooler
blue while Godot's un-tonemapped canvas is brighter and warmer; the blue-and-gold jars lose
the most contrast, the tallest one washing out to a pale glossy sphere in ours.

A class of the demo's dressing does not surface in our static render: the two large purple,
gold-rimmed magic circles, the red skull banner, the lit torches (with the warm pools of
light they throw on the surrounding stone), the small dark-blue creature sprites, and the
reddish blood-splatter floor decals — all present in Godot, all absent in ours. Their world
positions sit inside the shared frame (the jar and pillar beside the right-hand circle
render identically in both images), so this is genuinely un-surfaced instanced/animated
content, not a framing crop — the same category as the platformer demo's animated pickups.

The two frames otherwise share the same view with only a slight vertical offset; a wedge of
khaki background shows at our lower-left corner where Godot's frame is filled by tilemap and
banner.
