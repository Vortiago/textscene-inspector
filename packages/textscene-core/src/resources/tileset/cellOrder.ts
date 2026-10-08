/** The order Godot draws a rendering quadrant's cells in. */

import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';

/**
 * `CellData::operator<` (`tile_map_layer.h:134-136`): `Vector2i` order, x then y. `_rendering_update`
 * sorts every quadrant's cells this way, a y-sorted row included (`tile_map_layer.cpp:306-311`).
 */
export function compareCells(a: PlacedCell, b: PlacedCell): number {
  return a.coords.x - b.coords.x || a.coords.y - b.coords.y;
}
