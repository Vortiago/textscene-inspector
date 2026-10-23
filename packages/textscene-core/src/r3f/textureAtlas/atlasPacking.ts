/**
 * The skyline packer Godot's decal atlas and area light atlas share (`texture_storage.cpp:3070-3142`
 * for decals, `:3401-3451` for area lights): it sorts cells tall first, places each at the lowest
 * column span that holds it, and doubles the columns until the atlas is at most twice as tall as wide.
 */

/*
 * The packing is derived from Godot Engine
 * (`servers/rendering/renderer_rd/storage_rd/texture_storage.cpp`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * See THIRD-PARTY-NOTICES.md for the full notice.
 */

import { nextPowerOfTwo } from '../../godot/math/powerOfTwo.js';

/** A block of whole cells to place. The packer writes `x` and `y`. */
export interface PackedCell {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * Places each cell at the lowest column span that holds it, and returns the height used. Godot's
 * sort runs as an insertion sort below 17 items, which keeps equal sizes in the order given, as
 * this stable sort does at any count.
 */
function packInto(cells: PackedCell[], columns: number): number {
  const columnHeights = new Array<number>(columns).fill(0);
  let usedHeight = 0;
  for (const cell of cells) {
    let bestColumn = 0;
    let bestHeight = Infinity;
    for (let column = 0; column <= columns - cell.width; column++) {
      const height = Math.max(...columnHeights.slice(column, column + cell.width));
      if (height < bestHeight) {
        bestHeight = height;
        bestColumn = column;
      }
    }
    columnHeights.fill(bestHeight + cell.height, bestColumn, bestColumn + cell.width);
    cell.x = bestColumn;
    cell.y = bestHeight;
    usedHeight = Math.max(usedHeight, bestHeight + cell.height);
  }
  return usedHeight;
}

/**
 * Packs `cells` and returns the atlas's columns and rows. The columns start at the power of two
 * that holds the widest cell, and at least `minColumns`.
 */
export function packCells(cells: PackedCell[], minColumns: number): { columns: number; rows: number } {
  const sorted = [...cells].sort((a, b) => b.height - a.height || b.width - a.width);
  let columns = nextPowerOfTwo(Math.max(minColumns, ...cells.map((cell) => cell.width)));
  for (;;) {
    const rows = packInto(sorted, columns);
    if (rows <= columns * 2) return { columns, rows };
    columns *= 2;
  }
}
