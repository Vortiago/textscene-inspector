import { describe, expect, it } from 'vitest';
import { packCells } from './atlasPacking';

/** One texel a cell, so the atlas size reads as columns and rows. */
const UNIT_BORDER = 1;

describe('packCells', () => {
  it('starts the columns at the power of two that holds the widest cell', () => {
    // 5 cells wide round up to 8 columns, and 2 rows round up to 2 texels.
    expect(packCells([{ width: 5, height: 2 }], 1, UNIT_BORDER)).toEqual({
      width: 8,
      height: 2,
      positions: [{ x: 0, y: 0 }],
    });
  });

  it('starts the columns at the minimum for narrow cells', () => {
    const cells = [{ width: 3, height: 3 }];

    // 3 rows round up to 4 texels. 3 columns round up to 4, or the minimum 8.
    expect(packCells(cells, 8, UNIT_BORDER)).toMatchObject({ width: 8, height: 4 });
    expect(packCells(cells, 1, UNIT_BORDER)).toMatchObject({ width: 4, height: 4 });
  });

  it('places the tallest cell first, and each cell in the lowest span that holds it', () => {
    const wide = { width: 5, height: 2 };
    const tall = { width: 3, height: 3 };

    const { positions } = packCells([wide, tall], 8, UNIT_BORDER);

    // The tall cell fills columns 0-2 to height 3, so the wide cell takes columns 3-7 at height 0.
    expect(positions).toEqual([
      { x: 3, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it('keeps equal cells in the order given', () => {
    const cell = { width: 3, height: 3 };

    const { positions } = packCells([cell, cell], 8, UNIT_BORDER);

    expect(positions.map(({ x }) => x)).toEqual([0, 3]);
  });

  it('doubles the columns until the rows are at most twice the columns', () => {
    // 21 rows are over 2 × 8 columns and within 2 × 16, and round up to 32 texels.
    expect(packCells([{ width: 3, height: 21 }], 8, UNIT_BORDER)).toMatchObject({ width: 16, height: 32 });
  });

  it('scales the atlas by the border texels of a cell', () => {
    // 8 columns × 32 texels, and 2 rows × 32 texels.
    expect(packCells([{ width: 5, height: 2 }], 1, 32)).toMatchObject({ width: 256, height: 64 });
  });

  it('is one cell with no cell to place (edge case)', () => {
    expect(packCells([], 8, 32)).toEqual({ width: 32, height: 32, positions: [] });
  });
});
