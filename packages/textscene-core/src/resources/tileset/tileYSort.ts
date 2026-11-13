/**
 * The rows of a y-sorted TileMapLayer: `ySortRows` buckets drawable cells by the y of their
 * rendering quadrant, which the y-sort pass and the layer's own draw both read.
 */

import type { TileGrid } from './types';
import { compareCells } from './cellOrder';
import type { DrawableCell } from './drawableCell';
import { mapToLocalPx } from './tilePlacement';

/** One rendering quadrant of a y-sorted layer: the cells whose canvas items share an origin. */
export interface YSortRow {
  /**
   * The y of the row's canvas items in the layer's local space, at x 0: the local pixel Y plus the
   * layer's and the tile's own `y_sort_origin` (`tile_map_layer.cpp:547`).
   */
  y: number;
  /** Cells that draw in this row, in the order Godot draws a quadrant's cells (`compareCells`). */
  cells: readonly DrawableCell[];
}

/**
 * The rows of a y-sorted layer's cells, lowest `y` first, the order Godot gives the quadrants'
 * draw indices (`tile_map_layer.cpp:410-433`). Cells with an equal `y` share a row.
 */
export function ySortRows(
  cells: readonly DrawableCell[],
  grid: TileGrid,
  layerYSortOrigin: number
): YSortRow[] {
  const bucket = new Map<number, DrawableCell[]>();
  for (const cell of cells) {
    const y = mapToLocalPx(grid, cell.coords).y + layerYSortOrigin + cell.tileData.ySortOrigin;
    // Exact float equality, as the quadrant map keys on the position.
    const row = bucket.get(y);
    if (row) row.push(cell);
    else bucket.set(y, [cell]);
  }
  return [...bucket.keys()]
    .sort((a, b) => a - b)
    .map((y) => ({ y, cells: bucket.get(y)!.sort(compareCells) }));
}
