---
type: TileMap
category: 2D
fixture: unit-tile-map.tscn
image: unit-tile-map
renders_as: batched textured tile quads
---

# TileMap

TileMap draws each enabled layer's cells as batched textured quads sampled from
its TileSet atlas. This fixture lays five cells across two layers into a 3×2 grid,
reassembling the top-left tiles of the 32px marker atlas into a blocky white "F"
on blue; the vacant bottom-right cell leaves a notch of background showing
through. `scale` and `position` enlarge and centre the map so the composition is
legible.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(384, 196)` | centres the map in the frame |
| `scale` | `Vector2(4, 4)` | enlarges the tiles 4× so they read clearly |
| `tile_set` | `SubResource TileSet_b` | supplies the 32px marker atlas the cells sample |
| `format` | `2` | selects the tile_data encoding so the layers decode; no visual of its own |
| `layer_0/name` | `"Ground"` | editor layer label; no visual |
| `layer_0/tile_data` | 4 cells | fills the top row (0,0)(1,0)(2,0) and the left cell (0,1) |
| `layer_1/name` | `"Props"` | editor layer label; no visual |
| `layer_1/z_index` | `1` | raises Props above Ground; no visible stacking here — its cell overlaps no Ground cell |
| `layer_1/tile_data` | 1 cell | fills cell (1,1), the F's centre tile |

## Divergences

The tile composition matches: same 3×2 footprint, same reconstructed "F", same
vacant bottom-right cell, and the blue reads the same in both. The one difference
is that the white marker strokes render as a light grey in ours rather than the
pure white Godot shows; the tint is uniform across the stroke interiors, not just
their edges. The unlit tile material does not opt out of tone mapping, so it picks
up the scene's editor-preview tonemapper ([ADR-0025], injected by the reference
harness), which compresses the bright white, whereas Godot's 2D CanvasItem draw is
not tonemapped. Same cause as `tilemaplayer` and `line2d`.

[ADR-0025]: ../../adr/0025-preview-lighting-mirrors-the-godot-editor.md

## Known limitations

- **Cross-source draw order** — tiles batch one mesh per atlas source (a performance requirement), so per-cell interleaving of different sources within a quadrant is not reproduced; sources draw in appearance order, each nudged in z.
- **Y-sort** — `y_sort_enabled` is applied for static scenes (descendants sorted by world-Y within z buckets); a per-frame re-sort when an AnimationPlayer moves Y is deferred.
- **Unsupported shapes / formats** — half-offset-square and hexagon tile shapes place on a square grid + warn; legacy `TileMap` format 0/1, scene-collection sources, and per-tile overrides are skipped + warn; animated tiles render their base frame.
