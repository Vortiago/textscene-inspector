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
- 61 Polygon2D nodes doing three different jobs — 38 soft gradient shadows (20 instanced,
  18 authored inline), 7 floor decals, and 16 hand-painted additive torch pools via
  `CanvasItemMaterial.blend_mode = 1`
- A canvas-wide `CanvasModulate` over 23 `PointLight2D`s and 7 `LightOccluder2D`s

## Divergences

The whole frame is within a mean channel error of 14.7/255, and what remains is concentrated
in the lit regions. Unlit stone already matches closely — a wall reads `[39, 77, 140]` against
Godot's `[35, 71, 130]`.

**Lit surfaces are under-lit.** A 2D light is now applied *against* the surface rather than
painted over it, so a torch reads as torchlight instead of fog, but the contribution falls
short: a lit floor reads `[6, 58, 134]` where Godot has `[25, 82, 152]`, and a torch pool
`[140, 173, 229]` against `[193, 204, 239]`. Two known reasons, both tracked:

- Godot's canvas composites in **sRGB, clamped to [0,1]** — `Viewport.hdr_2d` defaults to
  `false`, so 2D never enters a linear working space. Ours accumulates the light in linear
  and encodes on output, which lands lower for the same authored values.
- The rest of the light pass is absent: `light_mask` and the range/cull masks, so every light
  reaches every item beneath it rather than the ones it is masked to;
  `CanvasItemMaterial.light_mode`, so the scene's `Unshaded` shadow and torch-pool polygons
  are still lit; and `LightOccluder2D` shadows, so light crosses walls it should not.

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
  `CanvasItemMaterial` blending, which turned 38 soft gradient shadows into opaque
  quadrilaterals and 16 additive torch pools into flat olive rectangles.
