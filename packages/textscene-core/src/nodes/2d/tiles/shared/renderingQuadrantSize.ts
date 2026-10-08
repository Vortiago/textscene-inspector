/** The `rendering_quadrant_size` a `.tscn` value leaves on a TileMapLayer or a TileMap. */

import { intOr } from '../../../../parser/valueParsers';

/** `int rendering_quadrant_size = 16` (`tile_map_layer.h:397`). */
const DEFAULT_RENDERING_QUADRANT_SIZE = 16;

/**
 * `set_rendering_quadrant_size` refuses a size below 1 (`tile_map_layer.cpp:3373`,
 * `tile_map.cpp:224`), so the default stays.
 */
export function renderingQuadrantSizeOr(value: string | undefined): number {
  const size = intOr(value, DEFAULT_RENDERING_QUADRANT_SIZE);
  return size >= 1 ? size : DEFAULT_RENDERING_QUADRANT_SIZE;
}
