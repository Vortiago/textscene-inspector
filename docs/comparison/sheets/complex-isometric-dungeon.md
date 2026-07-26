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
  doors — all of them PackedScene instances inside a `y_sort_enabled` subtree
- Enemy sprites: pale bird-skull heads and red crab/spider creatures dotted across the floor
- Draw order and occlusion: pillars and jars sit correctly in front of the floor and each
  other, walls layer front-to-back down the isometric depth
- 41 Polygon2D nodes doing three different jobs — soft gradient shadows, floor decals, and
  hand-painted additive torch pools via `CanvasItemMaterial.blend_mode = 1`
- A canvas-wide `CanvasModulate` over 23 `PointLight2D`s and 7 `LightOccluder2D`s

## Divergences

**The whole map is uniformly too dark, and the torch pools are missing.** This is the one
remaining structural gap and it has a single cause: `PointLight2D` is drawn as an additive
glow quad rather than applied against each lit CanvasItem's albedo, so none of the scene's
23 lights contribute. The `CanvasModulate` correctly darkens everything to Godot's base
tone — unlit stone matches within 5–8/255 (a wall reads `[30, 68, 129]` against Godot's
`[35, 71, 130]`) — but where Godot then lights the floor back up to `[25, 82, 152]`, ours
stays at `[4, 46, 111]`. Every light also uses a `GradientTexture2D` sub-resource, which
the 2D texture path cannot resolve, so they would draw nothing even under the current model.

Whole-frame mean channel error is 21.7/255, and essentially all of it is in the lit regions.

Not surfaced at all: the candle flames, their glow and their sparkles. Those are
`CPUParticles2D`, which is unimplemented — animated emission with no meaningful static frame.

## Fixed since the previous capture

Recorded because the previous revision of this sheet mis-attributed all three:

- **The missing props were not "un-surfaced instanced/animated content."** Every vase, coin
  pile, bone pile, the fifteen internal shadows and the player were dropped by a draw-order
  regression: the y-sort pass re-dispatched children through a second renderer that never
  handled `instance=`, and an instance node carries no `type=` for a registry lookup to hit.
  48 nodes in this scene. They render now.
- **The colour shift was not tone mapping of authored 2D content in general.** It was
  react-three-fiber's default ACES tone mapping on the 2D stage's own `<Canvas>`, compounded
  by a `CanvasModulate` that did nothing at all because the previewer scoped it to the node's
  subtree and this scene's CanvasModulate is a childless leaf.
- **The hard-edged navy, teal and khaki slabs were not a Z-order fault.** They were
  `Polygon2D` drawing its flat `color` with no `texture`/`uv` mapping and no
  `CanvasItemMaterial` blending, which turned 28 soft gradient shadows into opaque
  quadrilaterals and 16 additive torch pools into flat olive rectangles.
