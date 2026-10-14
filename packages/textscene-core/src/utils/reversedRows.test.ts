import { describe, expect, it } from 'vitest';
import { reversedRows } from './reversedRows';

describe('reversedRows', () => {
  it('puts the last row first', () => {
    const rgba = Uint8Array.of(1, 1, 1, 1, 2, 2, 2, 2);

    expect([...reversedRows(rgba, 1, 2)]).toEqual([2, 2, 2, 2, 1, 1, 1, 1]);
  });

  it('keeps the texels of a row in order', () => {
    const rgba = Uint8Array.of(1, 1, 1, 1, 2, 2, 2, 2);

    expect([...reversedRows(rgba, 2, 1)]).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it('copies a clamped array into a new plain one (edge case)', () => {
    const rgba = Uint8ClampedArray.of(9, 9, 9, 9);
    const reversed = reversedRows(rgba, 1, 1);

    expect(reversed).toBeInstanceOf(Uint8Array);
    expect(reversed).not.toBe(rgba);
  });

  it('gives an empty array for an empty image (error case)', () => {
    expect(reversedRows(new Uint8Array(0), 0, 0)).toHaveLength(0);
  });
});
