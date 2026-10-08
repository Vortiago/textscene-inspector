/** The `rendering_quadrant_size` a `.tscn` value leaves on a TileMapLayer or a TileMap. */

import { intOr } from '../../../../parser/valueParsers';

/** `int rendering_quadrant_size = 16` (`tile_map_layer.h:397`). */
export const DEFAULT_RENDERING_QUADRANT_SIZE = 16;

/**
 * `set_rendering_quadrant_size` refuses a size below 1 (`tile_map_layer.cpp:3373`,
 * `tile_map.cpp:224`), so the size it held before stays.
 */
export function renderingQuadrantSizeOr(
  value: string | undefined,
  current: number = DEFAULT_RENDERING_QUADRANT_SIZE
): number {
  const size = intOr(value, current);
  return size >= 1 ? size : current;
}
