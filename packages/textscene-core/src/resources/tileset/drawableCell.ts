/** The cells of a tile layer that Godot draws, each with the tile data it draws with. */

import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import {
  alternativeNoTransform,
  type AlternativeTileModel,
  type AtlasTileModel,
  type TileSetModel,
} from './types';

/** A placed cell whose source, tile and alternative all exist, with the two it names. */
export interface DrawableCell extends PlacedCell {
  tile: AtlasTileModel;
  /** The alternative's `TileData`, looked up with the transform bits cleared. */
  tileData: AlternativeTileModel;
}

/**
 * The cell as Godot draws it, or null for a cell Godot skips: `_rendering_quadrants_update_cell`
 * places a cell in no quadrant unless its source, tile and alternative exist (`tile_map_layer.cpp:527-531`).
 */
export function drawableCell(model: Pick<TileSetModel, 'sources'>, cell: PlacedCell): DrawableCell | null {
  const tile = model.sources.get(cell.sourceId)?.tiles.get(`${cell.atlasCoords.x}:${cell.atlasCoords.y}`);
  const tileData = tile?.alternatives.get(alternativeNoTransform(cell.alternativeId));
  return tile && tileData ? { ...cell, tile, tileData } : null;
}
