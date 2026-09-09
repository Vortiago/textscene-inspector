---
type: TileMapLayer
category: 2D
status: unreviewed
fixture: unit-tile-map-layer.tscn
image: unit-tile-map-layer
renders_as: batched textured tile quads
---

# TileMapLayer

TileMapLayer paints a grid of tiles from a TileSet atlas. The previewer decodes
`tile_map_data` at parse time and draws one batched quad mesh per atlas source.

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
| `tile_set` | null, SubResource("id") or ExtResource("id") |  |
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

- **Approximated** Cells batch one mesh per atlas source, so cells from different
  sources are not interleaved per cell. Sources draw in appearance order, each nudged in
  z.
