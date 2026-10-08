/** The cells of a tile layer that Godot draws, each with the source, tile and tile data it draws with. */

import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import {
  alternativeNoTransform,
  type AlternativeTileModel,
  type AtlasSourceModel,
  type AtlasTileModel,
  type TileSetModel,
} from './types';

/** A placed cell whose source, tile and alternative all exist, with the three it names. */
export interface DrawableCell extends PlacedCell {
  source: AtlasSourceModel;
  tile: AtlasTileModel;
  /** The alternative's `TileData`, looked up with the transform bits cleared. */
  tileData: AlternativeTileModel;
}

/**
 * The cells Godot draws, in the order given. `_rendering_quadrants_update_cell` places a cell in no
 * quadrant unless its source, tile and alternative exist (`tile_map_layer.cpp:527-531`).
 */
export function drawableCells(
  model: Pick<TileSetModel, 'sources'>,
  cells: readonly PlacedCell[]
): DrawableCell[] {
  const drawable: DrawableCell[] = [];
  for (const cell of cells) {
    const source = model.sources.get(cell.sourceId);
    const tile = source?.tiles.get(`${cell.atlasCoords.x}:${cell.atlasCoords.y}`);
    const tileData = tile?.alternatives.get(alternativeNoTransform(cell.alternativeId));
    if (source && tile && tileData) drawable.push({ ...cell, source, tile, tileData });
  }
  return drawable;
}
