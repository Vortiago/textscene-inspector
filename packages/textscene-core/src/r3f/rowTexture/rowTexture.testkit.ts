/** Reads packed rows back, for the tests of a pack. */

import type { PackedRows } from './packedRows';

/**
 * The reader of texel `texel` of row `row` in rows of `texelsPerRow` RGBA texels.
 *
 * @canonical In tests, a texel of a packed row
 */
export function texelOfRow(texelsPerRow: number): (rows: PackedRows, row: number, texel: number) => number[] {
  return (rows, row, texel) => {
    const start = (row * texelsPerRow + texel) * 4;
    return Array.from(rows.data.subarray(start, start + 4));
  };
}
