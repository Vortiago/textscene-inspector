import { describe, expect, it } from 'vitest';
import { cellCapacity } from './cellCapacity';

describe('the capacity of the atlas grid', () => {
  it.each([
    { width: 129, height: 1, count: 256 },
    { width: 1, height: 129, count: 256 },
    { width: 86, height: 2, count: 256 },
    { width: 2, height: 86, count: 256 },
  ])('bounds a prefix of $width by $height cell blocks', ({ width, height, count }) => {
    expect(cellCapacity(Array(500).fill({ width, height }), 256)).toBe(count);
  });

  it('counts overlapping width classes in join order', () => {
    const cells = [
      { width: 7, height: 3 },
      { width: 1, height: 1 },
      { width: 5, height: 6 },
    ];
    expect(cellCapacity(cells, 8)).toBe(2);
  });

  it('admits cells exactly half the width side by side', () => {
    expect(cellCapacity(Array(4).fill({ width: 4, height: 4 }), 8)).toBe(4);
  });

  it('excludes an oversized cell and every later cell', () => {
    expect(
      cellCapacity(
        [
          { width: 1, height: 1 },
          { width: 2, height: 9 },
          { width: 2, height: 2 },
        ],
        8
      )
    ).toBe(1);
  });
});
