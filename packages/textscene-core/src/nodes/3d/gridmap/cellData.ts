/**
 * GridMap cell-stream decoding (pure, THREE-free).
 *
 * Godot serializes a GridMap's populated cells as `data = { "cells":
 * PackedInt32Array(...) }`, a flat list of int32 triplets `[keyLo, keyHi,
 * cell]`. The 64-bit IndexKey overlays a `struct { int16 x, y, z; }`
 * (little-endian): x = keyLo low-16, y = keyLo high-16, z = keyHi low-16. The
 * cell int packs the MeshLibrary item id (bits 0-15) and an orientation index
 * 0-23 (bits 16-20).
 */

import { warn } from '../../../logger.js';
import { ruleInt, toInt16, toUint32 } from '../../../godot/int.js';

export interface GridMapCell {
  x: number;
  y: number;
  z: number;
  /** MeshLibrary item id. */
  item: number;
  /** Orientation index 0-23 → ORTHO_BASES. */
  rot: number;
}

/** Elements per cell: the two IndexKey halves and the packed cell int. */
const INTS_PER_CELL = 3;

export function decodeGridMapCells(packedInt32: string): GridMapCell[] {
  // `ruleInt` rather than `Number`: `Number('inf')` is NaN, while `inf` is a
  // literal Godot writes into an INT array, and the two must stay
  // distinguishable.
  const ints = packedInt32
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => ruleInt(s));

  const cells: GridMapCell[] = [];
  for (let i = 0; i + 2 < ints.length; i += INTS_PER_CELL) {
    const record = ints.slice(i, i + INTS_PER_CELL);
    // The whole RECORD is skipped, not the element. `toUint32(NaN)` is 0, so
    // substituting for one unstorable element drew a phantom cell at the
    // origin; the stream is fixed-stride, so dropping the cell it belongs to
    // costs that cell and no other.
    if (record.some((n) => n === null)) {
      warn(`[GridMap] cell data element "${record.join(', ')}" is not a cell Godot can place`);
      continue;
    }
    const keyLo = toUint32(record[0]!);
    const keyHi = toUint32(record[1]!);
    const cell = toUint32(record[2]!);
    cells.push({
      x: toInt16(keyLo & 0xffff),
      y: toInt16((keyLo >>> 16) & 0xffff),
      z: toInt16(keyHi & 0xffff),
      item: cell & 0xffff,
      rot: (cell >>> 16) & 0x1f,
    });
  }
  return cells;
}

/**
 * Godot's 24 orthogonal cell orientations (`grid_map.cpp` `_ortho_bases`), each
 * a row-major 3×3 rotation. A cell's `rot` indexes this table; the component
 * turns the chosen basis into a THREE.Matrix4.
 */
export const ORTHO_BASES: readonly (readonly number[])[] = [
  [1, 0, 0, 0, 1, 0, 0, 0, 1],
  [0, -1, 0, 1, 0, 0, 0, 0, 1],
  [-1, 0, 0, 0, -1, 0, 0, 0, 1],
  [0, 1, 0, -1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, -1, 0, 1, 0],
  [0, 0, 1, 1, 0, 0, 0, 1, 0],
  [-1, 0, 0, 0, 0, 1, 0, 1, 0],
  [0, 0, -1, -1, 0, 0, 0, 1, 0],
  [1, 0, 0, 0, -1, 0, 0, 0, -1],
  [0, 1, 0, 1, 0, 0, 0, 0, -1],
  [-1, 0, 0, 0, 1, 0, 0, 0, -1],
  [0, -1, 0, -1, 0, 0, 0, 0, -1],
  [1, 0, 0, 0, 0, 1, 0, -1, 0],
  [0, 0, -1, 1, 0, 0, 0, -1, 0],
  [-1, 0, 0, 0, 0, -1, 0, -1, 0],
  [0, 0, 1, -1, 0, 0, 0, -1, 0],
  [0, 0, 1, 0, 1, 0, -1, 0, 0],
  [0, -1, 0, 0, 0, 1, -1, 0, 0],
  [0, 0, -1, 0, -1, 0, -1, 0, 0],
  [0, 1, 0, 0, 0, -1, -1, 0, 0],
  [0, 0, 1, 0, -1, 0, 1, 0, 0],
  [0, 1, 0, 0, 0, 1, 1, 0, 0],
  [0, 0, -1, 0, 1, 0, 1, 0, 0],
  [0, -1, 0, 0, 0, -1, 1, 0, 0],
];
