---
type: Isometric Dungeon
category: Complex Scenes
fixture: dungeon.tscn
image: complex-isometric-dungeon
renders_as: Godot's isometric dungeon demo — one whole scene
---

# Isometric Dungeon

Godot's isometric dungeon demo: a large hand-built map of blue stone walls, pillars and
diamond floor tiles, dressed with treasure jars, coin piles, red doors and enemy sprites.
Both images show the same whole scene from real Godot and from this previewer, framed by
the 1152x648 project viewport.

## What it exercises

- A big isometric TileMapLayer: blue stone walls, standing pillars, multi-height platforms
  and a diamond-checkered floor, with a grey pit/void running through the middle
- Sprite2D props: blue-and-gold ceramic jars, gold coin stacks and rings, red gold-trimmed
  doors, all of them PackedScene instances inside a `y_sort_enabled` subtree
- Enemy sprites: pale bird-skull heads and red crab/spider creatures dotted across the floor
- Draw order and occlusion: pillars and jars sit in front of the floor and each other, and
  walls layer front-to-back down the isometric depth
- 61 Polygon2D nodes doing three different jobs: 38 soft gradient shadows (20 instanced,
  18 authored inline), 7 floor decals, and 16 hand-painted additive torch pools through
  `CanvasItemMaterial.blend_mode = 1`
- A canvas-wide `CanvasModulate` over 23 `PointLight2D`s and 7 `LightOccluder2D`s

## Divergences

The whole frame is within a mean channel error of **5.02/255**, with 5.5 % of pixels over
16/255. Stone, floor and the lit regions all agree closely:

| Sample | ours | Godot |
| --- | --- | --- |
| `300,120` unlit wall | `[29, 68, 129]` | `[35, 71, 130]` |
| `420,300` lit floor | `[11, 76, 151]` | `[25, 82, 152]` |
| `880,470` floor in shadow | `[3, 31, 84]` | `[7, 35, 84]` |

Two differences remain, and neither is draw order.

**The candles burn in the previewer's frame only.** A wall candle draws its flame, warm
glow and rising sparks here. The reference shows the same wick and the same warm
`PointLight2D` pool with nothing above it. The Candle section below explains the cause and
isolates it at 0.91/255.

**The rest is two opposite errors.** The 5.5 % of pixels over 16/255, split by sign:

| | share | mean delta (Godot − ours) | Godot's luminance there |
| --- | --- | --- | --- |
| ours too bright | 51 % | R −24.0, G −27.0, B −25.2 | 66/255 |
| ours too dark | 49 % | R +12.1, G +10.0, B +20.9 | 106/255 |

In the bright half, the previewer renders light where Godot renders dark. It is one
region rather than a spread: 68 % of it falls in x 740–960, y 150–360 (a pillar, the wall
top beside it and the floor tiles above the rug), where Godot lays a darkening the previewer
does not draw. On the pillar at `775,300`, Godot reads `[38, 79, 142]` and the previewer
`[82, 123, 189]`. The deltas are near-uniform across the channels, which points at coverage
or alpha rather than colour space, but the cause is not identified.

The other half has the opposite sign, falls on brighter pixels, and is blue-dominant. Its
cause is not identified either.

Neither half is in the light pass. The light pass agrees with the engine to within a unit
or two per channel on every isolated fixture: `light_mask` against `range_item_cull_mask`,
`LightOccluder2D` shadow casting with `cull_mode` and `shadow_item_cull_mask`, an
albedo-free `shadow_color`, and `CanvasItemMaterial.light_mode`. The scene's `Unshaded`
shadow and torch-pool polygons therefore keep their authored colour rather than taking the
blue canvas tint.

## The pieces on their own

The whole-frame number averages every effect together. The three sections below each
instance one of the dungeon's own `PackedScene`s over a neutral backdrop, so a divergence
has one owner. The demo authors them around the origin, off the top-left corner of a 1:1
viewport capture, so the wrappers in `scenes/isometric/previews/` re-centre them and change
nothing else.

## Candle
<!-- compare: image=complex-isometric-dungeon-candle status=limitation fixture=previews/candle_preview.tscn -->

A `Sprite2D` wick, four `CPUParticles2D` (`glow`, `Fire`, `Sparkle`, `flow front`) and two
`PointLight2D`s. The wick and both light pools match to within a unit or two per channel.
All four emitters draw here (flame body, warm glow and rising sparks), and none of them
draws in the reference. That is the whole divergence: mean channel error **0.91/255**,
0.19 % of pixels over 16, all in the flame and the glow around it, and all brighter in the
previewer.

Neither side shows a running emitter. Both are captured at the scene's load instant. Godot
runs one update there, at the emitter's first draw: the authored `preprocess` plus a single
process delta, which the reference pins at a millisecond rather than letting the host's
frame timing set it. This candle sets `preprocess = 0`, so nothing has accumulated. The
previewer has no clock. It evaluates each emitter once to a settled pose over one lifetime,
with a fixed substitute seed because the scene sets no `use_fixed_seed`. The flame
therefore stands in plausible places rather than the engine's, and is identical run to run.

An emitter that names a later moment (`preprocess`, with a `fixed_fps` to pin the step) is
met exactly, because the file serialises that advance and both sides run the same
fixed-step loop over it. Godot applies `preprocess` at that same first draw, so an emitter
that sets it reaches a well-defined at-rest pose on both sides. The `CPUParticles2D` sheet
carries the fixtures that pin it, where the two sides agree to within 0.6/255.

The `Fire` and `Sparkle` emitters both carry a `CanvasItemMaterial` with
`particles_animation = true` over an 11- and an 8-frame strip. Without that flipbook each
particle draws the whole strip, which renders as a row of eleven flames beside the wick.
The previewer implements the flipbook for `CPUParticles2D`. It is inert for
`GPUParticles2D`, which is unimplemented.

## Internal shadow
<!-- compare: image=complex-isometric-dungeon-internal-shadow status=done fixture=previews/internal_shadow_preview.tscn -->

One `Polygon2D` carrying `shadow_gradient.png` through a four-vertex `uv` in texel space that
runs negative on two corners (`-2, -1`). Mean channel error **0.99/255** with **no pixel over
16** and a worst channel of 3, so the UV normalisation, the wrap mode and the translucent fill
all land.

The 0.99 mean is a uniform near-zero offset across the backdrop rather than error in the
shadow: the two sides differ by 1 unit of rounding over most of the frame.

## Goblin
<!-- compare: image=complex-isometric-dungeon-goblin status=limitation fixture=previews/goblin_preview.tscn -->

A `CharacterBody2D` with a `Sprite2D` drop shadow, an `AnimatedSprite2D` over a 40-animation
`SpriteFrames`, a `Camera2D` and a hidden `LightOccluder2D`. Both sides draw the authored
pose (`animation = "front_idle"`, `frame = 8`), and the sprite and its atlas region match
across the whole 128x128 body. Mean channel error **1.02/255**, 0.05 % of pixels over 16.

**The drop shadow is missing.** The `Shadow` node is a `Sprite2D` whose texture is a
`GradientTexture2D` with `fill = 1` (radial from the centre), squashed by
`scale = Vector2(0.78125, 0.362305)` into an ellipse and tinted through
`modulate = Color(0.129412, 0.0745098, 0.192157, 0.647059)`. Godot lays that ellipse under
the feet, `[48, 39, 61]` at its centre against the `[76, 76, 81]` backdrop. The previewer
leaves the backdrop untouched at `[77, 77, 82]`. The cause is the slot, not the gradient:
`Sprite2D` resolves a `SubResource` texture only when it is a `CanvasTexture`, so a gradient
written inline in the scene resolves to nothing. The node then falls back to a placeholder
that is sub-pixel at 2D scale. An inline `GradientTexture2D` in a `PointLight2D`'s cookie
slot does rasterise: it lights this dungeon's 23 lamps and the candle's warm pool. That
ellipse is the whole of the over-16 count. Outside it, only single pixels along the
sprite's silhouette differ.
