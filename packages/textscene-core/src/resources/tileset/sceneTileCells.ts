/** The cells of a tile layer that name a scene tile: the ones the layer instantiates a scene for. */

import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import { alternativeNoTransform, type SceneTileModel, type TileSetModel } from './types';

/** A cell with the scene tile it names. */
export interface SceneTileCell {
  cell: PlacedCell;
  tile: SceneTileModel;
}

/**
 * The cells that name a scene tile, in the order given. `_scenes_update_cell` needs the source to
 * have the tile at the cell's atlas coords, which a scene collection holds only at (0, 0)
 * (`tile_set.cpp:5760-5762`), and the alternative with its transform bits cleared (`:5775-5778`).
 */
export function sceneTileCells(
  model: Pick<TileSetModel, 'sceneSources'>,
  cells: readonly PlacedCell[]
): SceneTileCell[] {
  const found: SceneTileCell[] = [];
  for (const cell of cells) {
    const { x, y } = cell.atlasCoords;
    if (x !== 0 || y !== 0) continue;
    const tile = model.sceneSources
      .get(cell.sourceId)
      ?.scenes.get(alternativeNoTransform(cell.alternativeId));
    if (tile) found.push({ cell, tile });
  }
  return found;
}
