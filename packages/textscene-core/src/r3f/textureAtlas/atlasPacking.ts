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

import { fitAtlas } from './fitAtlas.js';
import { cellCapacity } from './cellCapacity.js';
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
  wanted?: CellSize;
}

/**
 * Places each block at the lowest column span that holds it, and returns the height used. Godot's
 * sort runs as an insertion sort below 17 items, which keeps equal sizes in the order given, as
 * this stable sort does at any count.
 */
function packInto(blocks: readonly Block[], columns: number, positions: CellPosition[]): number {
  const skyline = [{ end: columns, height: 0 }];
  let usedHeight = 0;
  for (const { index, size } of blocks) {
    let bestColumn = 0;
    let bestHeight = Infinity;
    let first = 0;
    let last = 0;
    // Inside a level span, moving left one column cannot raise the block. Only span starts can win.
    for (let start = 0; start < skyline.length; start++) {
      const column = start === 0 ? 0 : skyline[start - 1]!.end;
      const right = column + size.width;
      if (right > columns) break;
      let end = start;
      let height = skyline[start]!.height;
      while (height < bestHeight && skyline[end]!.end < right) {
        end++;
        height = Math.max(height, skyline[end]!.height);
      }
      if (height < bestHeight) {
        bestColumn = column;
        bestHeight = height;
        first = start;
        last = end;
        if (height === 0) break;
      }
    }
    const top = bestHeight + size.height;
    // Keep the part of the last span beyond the block. Join neighbours at the new height.
    let right = bestColumn + size.width;
    if (skyline[last]!.end > right) last--;
    if (skyline[last + 1]?.height === top) {
      last++;
      right = skyline[last]!.end;
    }
    if (skyline[first - 1]?.height === top) first--;
    skyline.splice(first, last - first + 1, { end: right, height: top });
    positions[index] = { x: bestColumn, y: bestHeight };
    usedHeight = Math.max(usedHeight, top);
    if (usedHeight > columns * 2) return usedHeight;
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
export function packCells(
  cells: readonly CellSize[],
  minColumns: number,
  border: number,
  limit = Infinity
): PackedAtlas {
  const blocks = cells
    .map((size, index): Block => ({ index, size }))
    .sort((a, b) => b.size.height - a.size.height || b.size.width - a.size.width);
  function pack(count: number): PackedAtlas {
    if (count === 0) return { width: border, height: border, positions: [] };
    const prefix = count === cells.length ? blocks : blocks.filter(({ index }) => index < count);
    const widest = prefix.reduce((width, { size }) => Math.max(width, size.width), minColumns);
    let columns = nextPowerOfTwo(widest);
    const positions: CellPosition[] = [];
    for (;;) {
      const rows = packInto(prefix, columns, positions);
      if (rows <= columns * 2) {
        return { width: columns * border, height: nextPowerOfTwo(rows * border), positions };
      }
      columns *= 2;
    }
  }
  return fitAtlas(cells.length, pack, limit, () =>
    minColumns * border > limit ? 0 : cellCapacity(cells, Math.floor(limit / border))
  );
}
