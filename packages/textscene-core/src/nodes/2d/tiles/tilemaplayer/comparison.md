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

Tile positions, the grid, the marker's white and the blue field are exact: the
stem interior at `128,200` reads `rgb(255, 255, 255)` and the field at `700,380`
`rgb(45, 108, 223)` on both sides. The 2D canvas's atlas texture is sampled
`NoColorSpace` (a clone of the shared cached texture, retagged) so its hardware
bilinear filter blends the raw sRGB bytes — matching Godot's own non-`hdr_2d`
canvas, which never asks for the atlas's sRGB-typed GPU view — and the shader
decodes the already-filtered sample afterward, rather than decoding each texel
before the filter runs.

`pnpm ref:godot scenes/fixtures/unit-tile-map-layer.tscn --mode 2d` against
`pnpm ref:ours unit-tile-map-layer.tscn --2d`: mean channel error 0.0063/255
over the frame, no channel over 16/255 anywhere in it, max channel difference
2/255 on 1.8 % of pixels — every one on the four-pixel bilinear ramp a 32 px
tile drawn at 128 px produces at a glyph edge. At `114,200` Godot reads
`rgb(91, 140, 231)` against ours `rgb(91, 140, 230)`: the true blend of the
two contributing texels' blue channels at this ramp step is exactly `230.5`
(`227×0.875 + 255×0.125`), a tie the two engines' hardware bilinear filters
round in opposite directions. The residual is that class of tie, not a
colour-space mismatch — R and G already match exactly at this same pixel.

## Linting

<!-- lint:begin TileMapLayer -->
Strict parsing format-checks these `TileMapLayer` properties, plus 18 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `enabled` |
| `tile_set` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-tilemaplayer` | `tilemaplayer-requires-tileset` | warning |
|  | `valid-tilemaplayer-resources` | error |
|  | `tilemaplayer-empty` | warning |
|  | `tilemaplayer-invalid-tile-data` | error |
<!-- lint:end -->

`enabled` falls back to `true` when absent or unparseable (`boolOr`), warning
only when a value was present. `tile_set` is passed through as the raw
resource-reference string when present and simply omitted when absent, so an
unresolvable reference isn't caught here; the layer then renders with no tiles.
Malformed `tile_map_data` (truncated bytes or an unrecognized format version)
warns and drops all cells rather than rejecting the node, again leaving an
empty layer.
