import { describe, expect, it } from 'vitest';
import { isBottomUp, reversedRows } from './reversedRows';

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

  it('keeps the floats of a float image', () => {
    expect(reversedRows(Float32Array.of(2, 2, 2, 2, 0.5, 0.5, 0.5, 0.5), 1, 2)).toEqual(
      Float32Array.of(0.5, 0.5, 0.5, 0.5, 2, 2, 2, 2)
    );
  });

  it('gives an empty array for an empty image (error case)', () => {
    expect(reversedRows(new Uint8Array(0), 0, 0)).toHaveLength(0);
  });
});

describe('isBottomUp', () => {
  const pixels = { data: new Uint8Array(4), width: 1, height: 1 };

  it('is true for a typed array that uploads without flipY', () => {
    expect(isBottomUp({ flipY: false, image: pixels })).toBe(true);
  });

  it('is false for a typed array that uploads with flipY', () => {
    expect(isBottomUp({ flipY: true, image: pixels })).toBe(false);
  });

  it('is false for a decoded image, which has no typed array (edge case)', () => {
    expect(isBottomUp({ flipY: false, image: { width: 1, height: 1 } })).toBe(false);
  });
});
