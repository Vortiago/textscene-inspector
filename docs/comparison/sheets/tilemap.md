---
type: TileMap
category: 2D
fixture: unit-tile-map.tscn
image: unit-tile-map
renders_as: batched textured tile quads
---

# TileMap

TileMap draws each enabled layer's cells as batched textured quads sampled from
its TileSet atlas. This fixture places six cells across two layers that reassemble
regions of the 96×96 marker atlas into a blocky white "F" on blue in the top-left
corner, with the one empty cell showing the background through.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `tile_set` | `SubResource TileSet_b` | supplies the 32px marker atlas the cells draw from |
| `format` | `2` | selects the tile_data encoding so the layers decode; no visual of its own |
| `layer_0/name` | `"Ground"` | editor layer label; no visual |
| `layer_0/tile_data` | 4 cells | draws the top bar and left stem of the white "F" |
| `layer_1/name` | `"Props"` | editor layer label; no visual |
| `layer_1/z_index` | `1` | raises the Props layer; no visible stacking here — its cell overlaps no ground cell |
| `layer_1/tile_data` | 1 cell | fills the F's centre tile at cell (1,1) |

## Divergences

The tiles are placed and shaped identically — same footprint (both fill x0–95,
y0–63), same reconstructed "F", same empty-cell cutout, same background. The
difference is colour: ours renders the marker's white as a light grey rather than
pure white, and the blue reads marginally lighter and greener. The muted tone is
uniform across the solid tile interiors, not just their edges.
