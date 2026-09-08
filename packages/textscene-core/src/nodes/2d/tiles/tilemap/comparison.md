---
type: TileMap
category: 2D
status: unreviewed
fixture: unit-tile-map.tscn
image: unit-tile-map
renders_as: batched textured tile quads
---

# TileMap

TileMap draws each layer's cells as batched textured quads from its TileSet atlas. The
previewer decodes the legacy `layer_N/tile_data` groups and draws one mesh per atlas
source.

## Linting

<!-- lint:begin TileMap -->
Strict parsing format-checks these `TileMap` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `collision_animatable` | true or false |  |
| `collision_visibility_mode` | enum 0-2 (DEFAULT/FORCE_SHOW/FORCE_HIDE) | warning |
| `format` | INT-typed literal (a FLOAT or BOOL spelling is a dropped write, tile_map.cpp:689) |  |
| `layer_#/*` | layer |  |
| `navigation_visibility_mode` | enum 0-2 (DEFAULT/FORCE_SHOW/FORCE_HIDE) | warning |
| `rendering_quadrant_size` | integer 1-128 | error below, warning above |
| `tile_set` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-tilemap` | `tilemap-deprecated` | warning |
|  | `tilemap-y-sort-z-index-conflict` | warning |
|  | `tilemap-layer-y-sort-without-node` | warning |
|  | `tilemap-node-y-sort-without-layer` | warning |
|  | `tilemap-requires-tileset` | info |
|  | `tilemap-unsupported-format` | error |
|  | `tilemap-invalid-tile-data` | error |
<!-- lint:end -->

`format` falls back to `2`, the current encoding, when absent or unreadable. Only format
`2` decodes, so another value warns and drops that layer's `tile_data`. `tile_set`
passes through as the raw reference string, so a dangling reference draws no tiles.

## Known limitations

- **Approximated** Cells batch one mesh per atlas source, so cells from different
  sources in one layer are not interleaved per cell. Sources draw in appearance order,
  each nudged in z.
- **Approximated** Y-sort is computed once for the static scene. A Y change driven by an
  AnimationPlayer is not re-sorted.
- **Resource gap** Scene-collection sources are skipped with a warning, animated tiles
  show their first frame, and legacy formats 0 and 1 draw nothing.
