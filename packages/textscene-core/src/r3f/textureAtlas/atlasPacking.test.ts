import { describe, expect, it } from 'vitest';
import { packCells, type PackedCell } from './atlasPacking';

function cell(width: number, height: number): PackedCell {
  return { width, height, x: 0, y: 0 };
}

describe('packCells', () => {
  it('starts the columns at the power of two that holds the widest cell', () => {
    expect(packCells([cell(5, 2)], 1)).toEqual({ columns: 8, rows: 2 });
  });

  it('starts the columns at the minimum for narrow cells', () => {
    expect(packCells([cell(3, 3)], 8)).toEqual({ columns: 8, rows: 3 });
    expect(packCells([cell(3, 3)], 1)).toEqual({ columns: 4, rows: 3 });
  });

  it('places the tallest cell first, and each cell in the lowest span that holds it', () => {
    const wide = cell(5, 2);
    const tall = cell(3, 3);

    packCells([wide, tall], 8);

    expect([tall.x, tall.y]).toEqual([0, 0]);
    expect([wide.x, wide.y]).toEqual([3, 0]);
  });

  it('keeps equal cells in the order given', () => {
    const [first, second] = [cell(3, 3), cell(3, 3)];

    packCells([first, second], 8);

    expect([first.x, second.x]).toEqual([0, 3]);
  });

  it('doubles the columns until the rows are at most twice the columns', () => {
    expect(packCells([cell(3, 21)], 8)).toEqual({ columns: 16, rows: 21 });
  });
});
