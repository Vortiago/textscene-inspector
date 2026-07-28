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

The whole frame is within a mean channel error of **5.02/255**, with 5.5 % of pixels over
16/255. Stone, floor and the lit regions all agree closely now:

| Sample | ours | Godot |
| --- | --- | --- |
| `300,120` unlit wall | `[29, 68, 129]` | `[35, 71, 130]` |
| `420,300` lit floor | `[11, 76, 151]` | `[25, 82, 152]` |
| `880,470` floor in shadow | `[3, 31, 84]` | `[7, 35, 84]` |

What remains is two things, and neither is draw order.

**The candles are lit, but not at Godot's instant.** `CPUParticles2D` now renders, so every
flame, glow and sparkle in the map is present. What cannot match is the exact moment: the
candle sets neither `use_fixed_seed` nor `preprocess`, so Godot randomises the seed at
construction and never saves it, and its own two consecutive renders of the sub-scene differ
by 187 pixels. The previewer substitutes a fixed seed and a fixed evaluation time, which makes
OUR frame stable run to run and puts the particles in plausible places rather than the
engine's. The Candle section below isolates it at 0.83/255.

**A residual under-light.** Lit surfaces still sit a few units low in red and green (the
floor sample above is 14 short in red). Godot's canvas composites in **sRGB, clamped to
[0,1]** — `Viewport.hdr_2d` defaults to `false`, so 2D never enters a linear working space,
while ours accumulates unclamped and encodes on output.

The rest of the light pass is now in: `light_mask` against `range_item_cull_mask`,
`LightOccluder2D` shadow casting with `cull_mode` and `shadow_item_cull_mask`, an
albedo-free `shadow_color`, and `CanvasItemMaterial.light_mode`, so the scene's `Unshaded`
shadow and torch-pool polygons keep their authored colour rather than taking the blue canvas
tint.

## The pieces on their own

The whole-frame number above averages every effect together, which hides which sub-scene
is responsible for what. These three are the dungeon's own `PackedScene`s, each instanced
on its own over a neutral backdrop, so a divergence has one owner. The demo authors them
around the origin, which puts them off the top-left corner of a 1:1 viewport capture, so
the wrappers in `scenes/isometric/previews/` re-centre them; nothing else is changed.

## Candle
<!-- compare: image=complex-isometric-dungeon-candle status=limitation fixture=previews/candle_preview.tscn -->

A `Sprite2D` wick, four `CPUParticles2D` (`glow`, `Fire`, `Sparkle`, `flow front`) and two
`PointLight2D`s. All four emitters render now, so the candle reads as a lit candle: flame body,
warm glow and rising sparks. Mean channel error **0.83/255**, 0.1 % of pixels over 16.

The `Fire` and `Sparkle` emitters both carry a `CanvasItemMaterial` with
`particles_animation = true` over an 11- and an 8-frame strip. Without that flipbook each
particle draws the WHOLE strip, which renders as a row of eleven flames beside the wick —
visibly worse than drawing nothing. It is implemented for `CPUParticles2D`; it remains inert
for `GPUParticles2D`, which is still unimplemented.

The Godot side of this pair is **not reproducible**, which is worth knowing before reading a
number off it. The reference harness settles for six real process frames and deliberately does
not freeze particles, and `CPUParticles2D` seeds itself from an unserialised global RNG unless
the scene opts into `use_fixed_seed`, which this one does not. Two consecutive reference
renders of this same scene differ by 187 pixels with a worst channel of 20, so the flame has no
probe number the way every other sample on this sheet does. The previewer pins a fixed seed and
a fixed evaluation time, so OUR frame is stable run to run.

That is a property of this scene, not of particles in general: `preprocess` IS serialised, and
Godot evaluates it at a fixed 1/30 s step before the first visible frame, so an emitter that
sets it has a well-defined at-rest pose. This candle leaves it at 0. The `CPUParticles2D` sheet
carries the fixtures that do pin it, where the two sides agree to within 0.6/255.

## Internal shadow
<!-- compare: image=complex-isometric-dungeon-internal-shadow status=done fixture=previews/internal_shadow_preview.tscn -->

One `Polygon2D` carrying `shadow_gradient.png` through a four-vertex `uv` in texel space that
runs negative on two corners (`-2, -1`). This is the case that used to draw as a hard navy
quadrilateral. Mean channel error **0.99/255** with **no pixel over 16** and a worst channel of
3, so the UV normalisation, the wrap mode and the translucent fill all land.

The 0.99 mean is a uniform near-zero offset across the backdrop rather than error concentrated
in the shadow — the two sides differ by 1 unit of rounding over most of the frame.

## Goblin
<!-- compare: image=complex-isometric-dungeon-goblin status=limitation fixture=previews/goblin_preview.tscn -->

A `CharacterBody2D` with a `Sprite2D` drop shadow, an `AnimatedSprite2D` over a 40-animation
`SpriteFrames`, a `Camera2D` and a hidden `LightOccluder2D`. The sprite, the gradient shadow
and the atlas region all match.

The pose does not, and the cause is not the renderer: **the previewer does not execute
GDScript**. The scene serialises `animation = "front_idle"`, `frame = 8`, and that is what we
draw. Godot instantiates the scene, `goblin.gd`'s `_physics_process` runs, and its
`last_direction = Vector2(1, 0)` resolves to `side_right_idle`, which it then `play()`s — so
the reference shows a right-facing pose from a *different* animation, at whatever frame the
clock reached. Mean channel error **1.32/255**, 0.5 % of pixels over 16, all of it inside the
128x128 sprite.

A previewer that ran the script would not be more correct here, only differently timed: the
frame is a function of elapsed time. The authored state is the reproducible thing to draw.

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
