/** Godot 4.6.3's `TileSet` and `TileSetAtlasSource` facts a scene's tile data carries. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `TileSet::TileShape` (`scene/resources/2d/tile_set.h:244-249`). */
export const TileShape = {
  TILE_SHAPE_SQUARE: 0,
  TILE_SHAPE_ISOMETRIC: 1,
  TILE_SHAPE_HALF_OFFSET_SQUARE: 2,
  TILE_SHAPE_HEXAGON: 3,
} as const;

export const TILE_SHAPE_NAMES = enumNamesByValue(TileShape);

/** `TileSet::TileLayout` (`tile_set.h:251-258`): how a staggered shape lays its rows out. */
export const TileLayout = {
  TILE_LAYOUT_STACKED: 0,
  TILE_LAYOUT_STACKED_OFFSET: 1,
  TILE_LAYOUT_STAIRS_RIGHT: 2,
  TILE_LAYOUT_STAIRS_DOWN: 3,
  TILE_LAYOUT_DIAMOND_RIGHT: 4,
  TILE_LAYOUT_DIAMOND_DOWN: 5,
} as const;

export const TILE_LAYOUT_NAMES = enumNamesByValue(TileLayout);

/** `TileSet::TileOffsetAxis` (`tile_set.h:260-263`): the axis a staggered shape offsets along. */
export const TileOffsetAxis = {
  TILE_OFFSET_AXIS_HORIZONTAL: 0,
  TILE_OFFSET_AXIS_VERTICAL: 1,
} as const;

export const TILE_OFFSET_AXIS_NAMES = enumNamesByValue(TileOffsetAxis);

/**
 * `TileSetAtlasSource::TransformBits` (`scene/resources/2d/tile_set.h:628-632`): a cell painted
 * with a flip or a rotation carries these bits in its alternative tile id.
 */
export const TILE_TRANSFORM_FLIP_H = 1 << 12;
export const TILE_TRANSFORM_FLIP_V = 1 << 13;
export const TILE_TRANSFORM_TRANSPOSE = 1 << 14;

/** `TileSet::TerrainMode` (`tile_set.h:238-242`, 4.7.2 `:240-244`). */
const TerrainMode = {
  TERRAIN_MODE_MATCH_CORNERS_AND_SIDES: 0,
  TERRAIN_MODE_MATCH_CORNERS: 1,
  TERRAIN_MODE_MATCH_SIDES: 2,
} as const;

export const TERRAIN_MODE_NAMES = enumNamesByValue(TerrainMode);
