/**
 * The page fills of a BMFont stacked into one RGBA8 sheet, so a run is one mesh and one draw and
 * the font holds one copy of its pixels.
 */

import type { BitmapFill, FillSheet } from '../../fonts/font/types';

/** `fills` stacked in index order into a sheet as wide as the widest fill. */
export function stackFills(fills: readonly (BitmapFill | undefined)[]): FillSheet {
  // Array.from, not map: `fills` is sparse when a page id skips an index, and map keeps the holes,
  // which spread into Math.max as undefined and give NaN.
  const width = Math.max(1, ...Array.from(fills, (fill) => fill?.width ?? 0));
  const rowOffsets: (number | undefined)[] = [];
  let height = 0;
  for (const fill of fills) {
    rowOffsets.push(fill ? height : undefined);
    height += fill?.height ?? 0;
  }
  const data = new Uint8Array(width * Math.max(1, height) * 4);
  fills.forEach((fill, index) => {
    if (!fill) return;
    for (let row = 0; row < fill.height; row++) {
      const from = row * fill.width * 4;
      data.set(fill.data.subarray(from, from + fill.width * 4), (rowOffsets[index]! + row) * width * 4);
    }
  });
  return { width, height: Math.max(1, height), data, rowOffsets };
}
