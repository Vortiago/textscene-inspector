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
import { parseGodotInt } from '../../../godot/int.js';
import { toInt16 } from '../../../godot/int.js';

export interface GridMapCell {
  x: number;
  y: number;
  z: number;
  /** MeshLibrary item id. */
  item: number;
  /** Orientation index 0-23 → ORTHO_BASES. */
  rot: number;
}

export function decodeGridMapCells(packedInt32: string): GridMapCell[] {
  // `parseGodotInt` rather than `Number`: `Number('inf')` is NaN, and `inf` is
  // a literal Godot writes into an INT array and narrows on load, so a silent
  // NaN dropped the cell instead of placing it where Godot places it. `>>> 0`
  // below turns a NaN into 0, the origin cell, which is the same place Godot's
  // own narrowing puts it on x86.
  const ints = packedInt32
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const num = parseGodotInt(s);
      if (num === null) {
        warn(`[GridMap] cell data element "${s}" is not a value Godot can read`);
        return NaN;
      }
      if (!Number.isFinite(num)) {
        warn(`[GridMap] cell data element "${s}" is non-finite; placing that cell at the origin`);
      }
      return num;
    });

  const cells: GridMapCell[] = [];
  for (let i = 0; i + 2 < ints.length; i += 3) {
    const keyLo = ints[i]! >>> 0;
    const keyHi = ints[i + 1]! >>> 0;
    const cell = ints[i + 2]! >>> 0;
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
