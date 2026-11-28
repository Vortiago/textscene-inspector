import type { CellSize } from './atlasPacking.js';

function areaCapacity(cells: readonly CellSize[], side: number): number {
  let area = 0;
  for (const [index, cell] of cells.entries()) {
    area += cell.width * cell.height;
    if (cell.width > side || cell.height > side || area > side * side) return index;
  }
  return cells.length;
}

function scanlineCapacity(
  cells: readonly CellSize[],
  side: number,
  count: number,
  span: keyof CellSize
): number {
  const depth = span === 'width' ? 'height' : 'width';
  const laneCounts = new Set<number>();
  for (let i = 0; i < count; i++) laneCounts.add(Math.floor(side / cells[i]![span]));

  for (const lanes of laneCounts) {
    if (lanes >= count) continue;
    let totalDepth = 0;
    for (let i = 0; i < count; i++) {
      const cell = cells[i]!;
      // At most this many blocks wider than side / (lanes + 1) can cross one scanline.
      if (cell[span] * (lanes + 1) > side) totalDepth += cell[depth];
      if (totalDepth > lanes * side) {
        count = i;
        break;
      }
    }
  }
  return count;
}

/** @canonical The longest atlas prefix that the padded dimensions and occupied area can admit */
export function cellCapacity(cells: readonly CellSize[], side: number): number {
  const byArea = areaCapacity(cells, side);
  const byRows = scanlineCapacity(cells, side, byArea, 'width');
  return scanlineCapacity(cells, side, byRows, 'height');
}
