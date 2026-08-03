/**
 * tileYSort.ts — pure functions for Godot Y-sort on TileMapLayer cells.
 *
 * `groupBySortY` groups placed cells into per-sort-Y buckets, sorted low-Y
 * (far back) to high-Y (front). Used by the y-sort collector when it
 * encounters a y-sorted TileMapLayer child.
 */

import type { TileGrid } from './types';
import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import { mapToLocalPx } from './tilePlacement';

export interface YSortGroup {
  /** The sort Y value shared by all cells in this group. */
  sortY: number;
  /** Cells that draw at this sort Y (preserving parse order). */
  cells: readonly PlacedCell[];
  /** Original parse-order index for stable tie-breaking. */
  treeOrder: number;
}

/**
 * Group cells by their sort Y (layer world Y + local pixel Y + y_sort_origin).
 * Returns groups sorted by sortY ascending (low-Y drawn first = far back).
 * Cells with equal sortY are grouped together, preserving parse order.
 */
export function groupBySortY(
  cells: readonly PlacedCell[],
  grid: TileGrid,
  layerYSortOrigin: number,
  layerWorldY: number
): YSortGroup[] {
  // Map each cell to its sort Y, keeping parse order.
  const keyed: Array<{ sortY: number; cells: PlacedCell[]; treeOrder: number }> = [];
  const bucket = new Map<number, PlacedCell[]>();

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const localPx = mapToLocalPx(grid, cell.coords);
    const sortY = layerWorldY + localPx.y + layerYSortOrigin;
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
    const groupCells = bucket.get(sortY)!;
    keyed.push({ sortY, cells: groupCells, treeOrder: i });
  }

  return keyed;
}
