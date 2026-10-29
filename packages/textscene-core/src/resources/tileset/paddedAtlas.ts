/**
 * Godot's padded atlas layout. Godot copies each tile, frame 0, to its atlas coordinates on a grid
 * of cells one texel wider on each side than the texture region, and draws it from there
 * (`tile_set.cpp:5333-5345`, `:5638`).
 */

import type { Vector2 } from '../../godot/math/vector';
import type { AtlasSourceModel } from './types';

/** The cell padding on each side of a tile. */
const PADDING = 1;

/** `get_runtime_tile_texture_region` with padding: the tile's own `region` size, one texel into its cell. */
export function paddedTileRegion(
  source: Pick<AtlasSourceModel, 'textureRegionSize'>,
  atlasCoords: Vector2,
  region: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const { textureRegionSize: cell } = source;
  return {
    x: atlasCoords.x * (cell.x + 2 * PADDING) + PADDING,
    y: atlasCoords.y * (cell.y + 2 * PADDING) + PADDING,
    width: region.width,
    height: region.height,
  };
}
