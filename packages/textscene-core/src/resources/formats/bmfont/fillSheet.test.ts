import { describe, expect, it } from 'vitest';
import { stackFills } from './fillSheet';

describe('stackFills', () => {
  const sheet = stackFills([
    { width: 4, height: 2, data: new Uint8Array(4 * 2 * 4).fill(1) },
    undefined,
    { width: 2, height: 3, data: new Uint8Array(2 * 3 * 4).fill(2) },
  ]);
  const texel = (x: number, row: number): number[] => [
    ...sheet.data.slice((row * sheet.width + x) * 4, (row * sheet.width + x) * 4 + 4),
  ];

  it('keeps a finite width when a page id skips an index', () => {
    const sparse = stackFills([undefined, { width: 3, height: 1, data: new Uint8Array(12) }]);

    expect(sparse.width).toBe(3);
  });

  it('stacks the fills top to bottom in one sheet as wide as the widest', () => {
    expect([sheet.width, sheet.height]).toEqual([4, 5]);
    expect(sheet.rowOffsets).toEqual([0, undefined, 2]);
    expect(texel(3, 1)).toEqual([1, 1, 1, 1]);
    expect(texel(1, 2)).toEqual([2, 2, 2, 2]);
  });

  it('leaves the width a narrower fill does not cover clear', () => {
    expect(texel(2, 3)).toEqual([0, 0, 0, 0]);
  });

  it('is one blank texel for no fills, which no glyph points into', () => {
    const blank = stackFills([]);

    expect([blank.width, blank.height, blank.rowOffsets.length]).toEqual([1, 1, 0]);
  });
});
