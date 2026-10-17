/** Godot 4.6.3's TileMap and TileMapLayer facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `TileMap::VisibilityMode` (`scene/2d/tile_map.h:56-60`) and `TileMapLayer::DebugVisibilityMode`
 * (`tile_map_layer.h:341-345`): two C++ enums with the same members and the same hint string, so
 * one table serves `collision_visibility_mode` and `navigation_visibility_mode` of both nodes.
 */
const VisibilityMode = {
  DEFAULT: 0,
  FORCE_SHOW: 1,
  FORCE_HIDE: 2,
} as const;

/** Each visibility mode by its integer, spelled as its constant. */
export const TILE_MAP_VISIBILITY_MODE_NAMES = enumNamesByValue(VisibilityMode);
