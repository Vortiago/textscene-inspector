/** Builds a drawable cell for a test, on a 1×1 tile with `TileData` defaults unless overridden. */

import type { DrawableCell } from '../drawableCell';
import { defaultTileData, type AlternativeTileModel, type AtlasSourceModel } from '../types';
import type { Vector2 } from '../../../godot/math/vector';
import { tileTextureAt } from './tileTexture';

interface CellOverrides {
  coords?: Vector2;
  sourceId?: number;
  source?: AtlasSourceModel;
  atlasCoords?: Vector2;
  alternativeId?: number;
  sizeInAtlas?: Vector2;
}

/** A fresh source per cell, so no test shares a mutable `tiles` map with another. */
function defaultSource(): AtlasSourceModel {
  return {
    texture: tileTextureAt('res://tiles.png'),
    margins: { x: 0, y: 0 },
    separation: { x: 0, y: 0 },
    textureRegionSize: { x: 16, y: 16 },
    usesTexturePadding: false,
    tiles: new Map(),
  };
}

export function drawableCellOf(
  cell: CellOverrides = {},
  tileData: Partial<AlternativeTileModel> = {}
): DrawableCell {
  return {
    coords: cell.coords ?? { x: 0, y: 0 },
    sourceId: cell.sourceId ?? 0,
    source: cell.source ?? defaultSource(),
    atlasCoords: cell.atlasCoords ?? { x: 0, y: 0 },
    alternativeId: cell.alternativeId ?? 0,
    tile: { sizeInAtlas: cell.sizeInAtlas ?? { x: 1, y: 1 }, alternatives: new Map() },
    tileData: { ...defaultTileData(), ...tileData },
  };
}
