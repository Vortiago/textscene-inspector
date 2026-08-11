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
per atlas source. This fixture tiles the marker sprite across the whole frame — a
blue field covered by a regular grid of white "F" markers.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `tile_map_data` | `PackedByteArray(…)` | the placed cells — a frame-filling grid of marker tiles |
| `tile_set` | `SubResource("TileSet_b")` | 32 px `tile_size` and the atlas source that supplies the marker texture |
| `scale` | `Vector2(4, 4)` | enlarges each 32 px tile to 128 px on screen, so the grid fills the viewport |

## Divergences

Godot draws the marker's white pixels at full white (~252); ours renders them light
grey (~223). The tile mesh uses an unlit `meshBasicMaterial` that keeps three's
default `toneMapped: true`, so the scene tonemapper compresses the bright white —
Godot's 2D CanvasItem draw is not tonemapped. Tile positions, the grid, and the
blue background (~214 vs ~223 on the blue channel) all match.

## Linting

<!-- lint:begin TileMapLayer -->
Strict parsing format-checks these `TileMapLayer` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `collision_enabled` | true or false |
| `collision_visibility_mode` | enum 0-2 (DEFAULT/FORCE_SHOW/FORCE_HIDE) |
| `enabled` | true or false |
| `navigation_enabled` | true or false |
| `navigation_visibility_mode` | enum 0-2 (DEFAULT/FORCE_SHOW/FORCE_HIDE) |
| `occlusion_enabled` | true or false |
| `physics_quadrant_size` | integer >= 1 |
| `rendering_quadrant_size` | integer >= 1 |
| `tile_map_data` | PackedByteArray(…) bytes, or a base64-quoted PackedByteArray("…") (decoded by the tilemaplayer-invalid-tile-data rule) |
| `tile_set` | null, SubResource("id") or ExtResource("id") |
| `use_kinematic_bodies` | true or false |
| `x_draw_order_reversed` | true or false |
| `y_sort_origin` | integer |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-tilemaplayer` | `tilemaplayer-requires-tileset` | warning |
|  | `valid-tilemaplayer-resources` | error |
|  | `tilemaplayer-invalid-tile-data` | error |
<!-- lint:end -->

`enabled` falls back to `true` when absent or unparseable (`boolOr`), warning
only when a value was present. `tile_set` is passed through as the raw
resource-reference string when present and simply omitted when absent, so an
unresolvable reference isn't caught here; the layer then renders with no tiles.
Malformed `tile_map_data` (truncated bytes or an unrecognized format version)
warns and drops all cells rather than rejecting the node, again leaving an
empty layer.
