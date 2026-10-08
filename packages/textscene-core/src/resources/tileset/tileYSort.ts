/**
 * Godot's Y-sort for TileMapLayer cells. `groupBySortY` buckets placed cells by sort Y, from low
 * (back) to high (front), for the y-sort collector's y-sorted TileMapLayer children.
 */

import type { TileSetModel } from './types';
import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import { compareCells } from './cellOrder';
import { drawableCell } from './drawableCell';
import { mapToLocalPx } from './tilePlacement';

export interface YSortGroup {
  /** The sort Y value shared by all cells in this group. */
  sortY: number;
  /** Cells that draw at this sort Y, in the order Godot draws a quadrant's cells (`compareCells`). */
  cells: readonly PlacedCell[];
  /** The row's place in sort-Y order, for stable tie-breaking. */
  treeOrder: number;
}

/**
 * Group cells by their sort Y: layer world Y + local pixel Y + the layer's and the tile's own
 * `y_sort_origin` (`tile_map_layer.cpp:547`).
 * Returns groups sorted by sortY ascending (low-Y drawn first = far back).
 * Cells with equal sortY are grouped together. Each row is one rendering quadrant
 * (`tile_map_layer.cpp:546-548`), so its cells sort as a quadrant's do.
 */
export function groupBySortY(
  cells: readonly PlacedCell[],
  model: TileSetModel,
  layerYSortOrigin: number,
  layerWorldY: number
): YSortGroup[] {
  // Map each cell to its sort Y.
  const keyed: Array<{ sortY: number; cells: PlacedCell[]; treeOrder: number }> = [];
  const bucket = new Map<number, PlacedCell[]>();

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const localPx = mapToLocalPx(model, cell.coords);
    const tileYSortOrigin = drawableCell(model, cell)?.tileData.ySortOrigin ?? 0;
    const sortY = layerWorldY + localPx.y + layerYSortOrigin + tileYSortOrigin;
    // Use exact float equality (Godot uses exact comparison).
    const existing = bucket.get(sortY);
    if (existing) {
      existing.push(cell);
    } else {
      bucket.set(sortY, [cell]);
    }
  }

  // Build groups sorted by sortY ascending (low-Y = far back).
  const sortKeys = [...bucket.keys()].sort((a, b) => a - b);
  for (let i = 0; i < sortKeys.length; i++) {
    const sortY = sortKeys[i]!;
    const groupCells = bucket.get(sortY)!.sort(compareCells);
    keyed.push({ sortY, cells: groupCells, treeOrder: i });
  }

  return keyed;
}
