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

/** A block of whole cells to place. */
export interface CellSize {
  width: number;
  height: number;
}

/** The cell a block starts at. */
export interface CellPosition {
  x: number;
  y: number;
}

/** The atlas in texels, and where each block starts, in the order the blocks were given. */
export interface PackedAtlas {
  width: number;
  height: number;
  positions: CellPosition[];
}

/**
 * Places each block at the lowest column span that holds it, and returns the height used. Godot's
 * sort runs as an insertion sort below 17 items, which keeps equal sizes in the order given, as
 * this stable sort does at any count.
 */
function packInto(blocks: readonly Block[], columns: number, positions: CellPosition[]): number {
  const columnHeights = new Array<number>(columns).fill(0);
  let usedHeight = 0;
  for (const { index, size } of blocks) {
    let bestColumn = 0;
    let bestHeight = Infinity;
    for (let column = 0; column <= columns - size.width; column++) {
      let height = 0;
      for (let at = column; at < column + size.width; at++) height = Math.max(height, columnHeights[at]!);
      if (height < bestHeight) {
        bestHeight = height;
        bestColumn = column;
      }
    }
    columnHeights.fill(bestHeight + size.height, bestColumn, bestColumn + size.width);
    positions[index] = { x: bestColumn, y: bestHeight };
    usedHeight = Math.max(usedHeight, bestHeight + size.height);
  }
  return usedHeight;
}

interface Block {
  index: number;
  size: CellSize;
}

/**
 * Packs `cells` into an atlas of `border`-texel cells, with no cell fewer than `minColumns` columns
 * wide. The columns start at the power of two that holds the widest cell, and double until the rows
 * are at most twice the columns. With no cell the atlas is one cell.
 */
export function packCells(cells: readonly CellSize[], minColumns: number, border: number): PackedAtlas {
  if (cells.length === 0) return { width: border, height: border, positions: [] };
  const blocks = cells
    .map((size, index): Block => ({ index, size }))
    .sort((a, b) => b.size.height - a.size.height || b.size.width - a.size.width);
  let columns = nextPowerOfTwo(Math.max(minColumns, ...cells.map((cell) => cell.width)));
  const positions: CellPosition[] = [];
  for (;;) {
    const rows = packInto(blocks, columns, positions);
    if (rows <= columns * 2) {
      return { width: columns * border, height: nextPowerOfTwo(rows * border), positions };
    }
    columns *= 2;
  }
}
