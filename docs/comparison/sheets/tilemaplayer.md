---
type: TileMapLayer
category: 2D
fixture: unit-tile-map-layer.tscn
image: unit-tile-map-layer
renders_as: batched textured tile quads
---

# TileMapLayer

TileMapLayer paints a grid of tiles from a TileSet's atlas texture. The previewer
decodes the packed cell data at parse time and draws one batched textured quad-mesh
per atlas source. This fixture places a 2×2 block of 32 px cells at the origin, which
reconstructs the marker sprite as a blue square with a white "F" in the top-left.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `tile_map_data` | `PackedByteArray(…)` | four placed cells — the 2×2 tile block at the origin |
| `tile_set` | `SubResource("TileSet_b")` | 32 px `tile_size` and the atlas source that supplies the texture |

## Divergences

The marker's white pixels render light grey (~226/255) instead of pure white; the
blue tile background (~214 vs 223 on the blue channel) is close but slightly dimmed,
and every cell position matches Godot exactly. The unlit tile material
(`meshBasicMaterial`) does not opt out of tone mapping, so it picks up the scene's
tonemapper — which compresses the bright white — where Godot's 2D CanvasItem draw does
not. No [PARITY-LIMITATIONS.md](../../PARITY-LIMITATIONS.md) entry covers this.
