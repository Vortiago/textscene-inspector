/**
 * Godot's padded atlas layout. Godot copies each tile, frame 0, to its atlas coordinates on a grid
 * of cells one texel wider on each side than the texture region, and draws it from there
 * (`tile_set.cpp:5333-5345`, `:5638`).
 */

import type { Vector2 } from '../../godot/math/vector';
import type { AtlasSourceModel } from './types';

type AtlasLayout = Pick<AtlasSourceModel, 'margins' | 'separation' | 'textureRegionSize'>;

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

/** The padded atlas's size for a texture of `textureSize`: the atlas grid of padded cells. */
export function paddedAtlasSize(
  source: AtlasLayout,
  textureSize: { width: number; height: number }
): Vector2 {
  const grid = atlasGridSize(source, textureSize);
  return {
    x: grid.x * (source.textureRegionSize.x + 2 * PADDING),
    y: grid.y * (source.textureRegionSize.y + 2 * PADDING),
  };
}

/** `get_atlas_grid_size` (`tile_set.cpp:4729-4745`): the whole regions after the margins. Empty when one does not fit. */
function atlasGridSize(source: AtlasLayout, textureSize: { width: number; height: number }): Vector2 {
  const { margins, separation, textureRegionSize: region } = source;
  const validX = textureSize.width - margins.x;
  const validY = textureSize.height - margins.y;
  if (validX < region.x || validY < region.y) return { x: 0, y: 0 };
  return {
    x: 1 + Math.floor((validX - region.x) / (region.x + separation.x)),
    y: 1 + Math.floor((validY - region.y) / (region.y + separation.y)),
  };
}
