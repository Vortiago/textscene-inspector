/** Builds a drawable cell for a test, on a 1×1 tile with `TileData` defaults unless overridden. */

import type { DrawableCell } from '../drawableCell';
import { defaultTileData, type AlternativeTileModel, type Vec2i } from '../types';

export function drawableCellOf(
  cell: { coords?: Vec2i; atlasCoords?: Vec2i; alternativeId?: number; sizeInAtlas?: Vec2i } = {},
  tileData: Partial<AlternativeTileModel> = {}
): DrawableCell {
  return {
    coords: cell.coords ?? { x: 0, y: 0 },
    sourceId: 0,
    atlasCoords: cell.atlasCoords ?? { x: 0, y: 0 },
    alternativeId: cell.alternativeId ?? 0,
    tile: { sizeInAtlas: cell.sizeInAtlas ?? { x: 1, y: 1 }, alternatives: new Map() },
    tileData: { ...defaultTileData(), ...tileData },
  };
}
