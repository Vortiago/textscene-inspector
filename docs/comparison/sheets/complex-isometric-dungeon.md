---
type: Isometric Dungeon
category: Complex Scenes
fixture: dungeon.tscn
image: complex-isometric-dungeon
renders_as: Godot's isometric dungeon demo — one whole scene
---

# Isometric Dungeon

Godot's isometric dungeon demo: a large map of stone walls, pillars and floor tiles, with
jars, coins, doors, enemies, candles and lights.

## What it exercises

- A large isometric TileMapLayer
- Sprite2D props as PackedScene instances inside a `y_sort_enabled` subtree
- Draw order and occlusion down the isometric depth
- 61 Polygon2D nodes: soft shadows, floor decals and additive torch pools
- A CanvasModulate over 23 PointLight2D nodes and 7 LightOccluder2D nodes

Draw order and the light pass match.

## Known limitations

- **Needs runtime** The candle flames and sparks draw here and not in Godot (see Candle).
- **Approximated** The area around the pillar right of centre is brighter than Godot's.
  The cause is not known.
- **Approximated** Some brighter areas are darker and bluer than Godot's. The cause is not
  known.

## The pieces on their own

Each section below shows one of the dungeon's own PackedScenes on a neutral backdrop, so a
difference has one owner. The wrappers in `scenes/isometric/previews/` only re-centre them.

## Candle
<!-- compare: image=complex-isometric-dungeon-candle status=limitation fixture=previews/candle_preview.tscn -->

A wick, four CPUParticles2D emitters and two PointLight2D nodes. The wick and the light
pools match.

- **Needs runtime** Godot's reference is captured before any particle is emitted. The
  previewer draws each emitter settled over one lifetime, so the flame and sparks show here
  only.

## Internal shadow
<!-- compare: image=complex-isometric-dungeon-internal-shadow status=done fixture=previews/internal_shadow_preview.tscn -->

One Polygon2D with a gradient texture and UVs outside 0 to 1. It matches Godot.

## Goblin
<!-- compare: image=complex-isometric-dungeon-goblin status=limitation fixture=previews/goblin_preview.tscn -->

A CharacterBody2D with an AnimatedSprite2D, a drop-shadow Sprite2D, a Camera2D and a hidden
LightOccluder2D. The sprite and its frame match.

- **Resource gap** The drop shadow is missing. A Sprite2D does not draw an inline
  `GradientTexture2D`.
