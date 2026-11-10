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
A filtered tile then shows no seam from its neighbour. Godot builds that copy once, from the texture's image at load (`tile_set.cpp:5622-5654`). So a padded `ViewportTexture` source draws its target as it stands before its first render: black when opaque and clear when transparent. One that Godot never sets up draws the placeholder. Tiles sample with the layer's inherited `texture_filter` and `texture_repeat`, or with those of the atlas source's CanvasTexture where it sets them.
A cell whose atlas source has no texture draws nothing (`tile_map_layer.cpp:724`). A texture that is set but fails to load draws a placeholder.

## Tile grid

<!-- compare: image=unit-tile-map-layer status=limitation fixture=unit-tile-map-layer.tscn -->

A rendering quadrant is a `rendering_quadrant_size` square of cells, or one tile row of a
y-sorted layer. Each quadrant takes its own lights, so a large layer is not held to 15
positional lights in total.

## Y-sorted layer with a transform

<!-- compare: image=unit-tile-map-layer-y-sort-transform status=done fixture=unit-tile-map-layer-y-sort-transform.tscn -->

This y-sorted layer turns 30 degrees and scales by 1.5 in its parent. It draws each tile row through its whole transform. A row sorts by the y of its origin in the parent's space (`renderer_canvas_cull.cpp:131`). The two white bars hide under the rows that sort below them. Rows that a rotation lays on one y keep their order within `is_equal_approx`. The previewer matches Godot 4.6.3 at rotations 0, 30 and -90 degrees, scales 0.5, 2, (-1, -1) and (1, -1), and skew 0.3.

## Child nodes of a y-sorted layer

<!-- compare: image=unit-tile-map-layer-y-sort-children status=done fixture=unit-tile-map-layer-y-sort-children.tscn -->

A y-sorted layer sorts its tile rows with its child nodes by y (`renderer_canvas_cull.cpp:110-170`). A child draws over the rows above its y and under the rows below it. The left layer roots a sort and the right layer sits in a y-sorted Node2D. The cyan and yellow children each cover row 0 and sit under row 1. A child that ties a row in y draws over it, and a y-sorted child merges its own children into the sort. A y-sorted TileMap with a y-sorted layer sorts the same way. A child that an AnimationPlayer moves across a row re-sorts on the frame the mixer moves it. The previewer matches Godot 4.6.3 in each case, and at 0.5 s of the `unit-tile-map-layer-y-sort-animated-child` clip.

## Padded atlas from a ViewportTexture

<!-- compare: image=unit-tile-atlas-viewport-padding status=done fixture=unit-tile-atlas-viewport-padding.tscn -->

Two padded layers draw tiles from an AtlasTexture over one ViewportTexture. Only the right TileSet is local to scene. The left samples the placeholder at its padded regions, and the right draws the opaque target as it stands before its first render: black.

## Atlas over a ViewportTexture file

<!-- compare: image=unit-tile-atlas-viewport-texture-file status=done fixture=unit-tile-atlas-viewport-texture-file.tscn -->

Two layers name a ViewportTexture as their atlas texture, one inline and one from a `.tres`. A ViewportTexture reports no area while the scene loads, so `create_tile` finds room for no tile and neither layer draws (`tile_set.cpp:4985`). The previewer loads the texture's file before it creates any tile.

## Normal map

<!-- compare: image=unit-tilemaplayer-normal-map status=done fixture=unit-tilemaplayer-normal-map.tscn -->

An atlas source whose texture is a CanvasTexture lights its tiles through the `normal_texture` and
`specular_texture` under PointLight2D and DirectionalLight2D. Each run of cells from one source
binds the maps of that source, and a source with no normal map keeps the plain accumulation. A cell's
flips negate the matching normal component and its transpose swaps the two first, with the tile's own
flips composed as the drawn cell composes them (`canvas.glsl:655-661`). A padded source samples its
maps where it samples its diffuse. The layer's rotation and scale turn the normal after that
(`canvas.glsl:708-710`). A TileMap lights its layers the same way.

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

- **Resource gap** Scene-collection sources are skipped with a warning, and animated tiles
  show their first frame.
