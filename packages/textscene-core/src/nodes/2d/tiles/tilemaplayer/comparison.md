---
type: TileMapLayer
category: 2D
renders_as: batched textured tile quads
---

# TileMapLayer

TileMapLayer paints a grid of tiles from a TileSet atlas. The previewer decodes `tile_map_data` at
parse time. It draws each rendering quadrant as one or more canvas items, a new one at each change
of tile material or `z_index`. The quadrant's cells draw
in Godot's order, x then y (`tile_map_layer.cpp:306-311`), with each run of cells from one atlas
source batched into one quad mesh. Under `use_texture_padding` (the default), a tile samples
only its own texels and repeats its edge texels outward, as Godot's padded atlas copy does.
A filtered tile then shows no seam from its neighbour. Godot builds that copy once, from the texture's image at load (`tile_set.cpp:5622-5654`). So a padded `ViewportTexture` source draws its target as it stands before its first render: black when opaque and clear when transparent. One that Godot never sets up draws the placeholder. Tiles sample with the layer's inherited `texture_filter` and `texture_repeat`.
A cell whose atlas source has no texture draws nothing (`tile_map_layer.cpp:724`). A texture that is set but fails to load draws a placeholder.

## Tile grid

<!-- compare: image=unit-tile-map-layer status=limitation fixture=unit-tile-map-layer.tscn -->

A rendering quadrant is a `rendering_quadrant_size` square of cells, or one tile row of a
y-sorted layer. Each quadrant takes its own lights, so a large layer is not held to 15
positional lights in total.

## Padded atlas from a ViewportTexture
<!-- compare: image=unit-tile-atlas-viewport-padding status=done fixture=unit-tile-atlas-viewport-padding.tscn -->

Two padded layers draw tiles from an AtlasTexture over one ViewportTexture. Only the right TileSet is local to scene. The left samples the placeholder at its padded regions, and the right draws the opaque target as it stands before its first render: black.

## Linting

<!-- lint:begin TileMapLayer -->
Strict parsing format-checks these `TileMapLayer` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `collision_enabled` | true or false |  |
| `collision_visibility_mode` | enum 0-2 (DEFAULT/FORCE_SHOW/FORCE_HIDE) | warning |
| `enabled` | true or false |  |
| `navigation_enabled` | true or false |  |
| `navigation_visibility_mode` | enum 0-2 (DEFAULT/FORCE_SHOW/FORCE_HIDE) | warning |
| `occlusion_enabled` | true or false |  |
| `physics_quadrant_size` | integer >= 1 | error below |
| `rendering_quadrant_size` | integer >= 1 | error below |
| `tile_map_data` | PackedByteArray(…) int array of bytes, or a base64-quoted PackedByteArray("…") (decoded by the tilemaplayer-invalid-tile-data rule) |  |
| `tile_set` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `use_kinematic_bodies` | true or false |  |
| `x_draw_order_reversed` | true or false |  |
| `y_sort_origin` | integer |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-tilemaplayer` | `tilemaplayer-requires-tileset` | info |
|  | `tilemaplayer-invalid-tile-data` | error |
<!-- lint:end -->

`enabled` falls back to `true` when absent or unparseable. `tile_set` passes through as
the raw reference string, so a dangling reference draws no tiles. Malformed
`tile_map_data` warns and drops every cell, leaving an empty layer.

## Known limitations

- **Approximated** Y-sort is computed once for the static scene, so a Y change driven by
  an AnimationPlayer is not re-sorted.
- **Resource gap** Scene-collection sources are skipped with a warning, and animated tiles
  show their first frame.
