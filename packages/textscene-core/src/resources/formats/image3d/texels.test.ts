/** An image cut into the slices of a 3D texture, as Godot's layered importer cuts it. */
import { describe, expect, it } from 'vitest';
import { sliceImage } from './texels';

/** An image `width` by `height` whose every pixel's red is its index, so each texel names its source. */
function indexedImage(width: number, height: number) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([i, 0, 0, 255], i * 4);
  return { data, width, height };
}

/** The red of each texel, in the volume's order. */
function reds(texels: Uint8Array): number[] {
  return [...texels].filter((_, i) => i % 4 === 0);
}

describe('sliceImage', () => {
  it('stacks the slices left to right, then top to bottom', () => {
    // A 4x2 image of four 2x1 slices: slice 1 sits right of slice 0, slice 2 below it.
    const volume = sliceImage(indexedImage(4, 2), { horizontal: 2, vertical: 2 });
    expect(volume).toMatchObject({ width: 2, height: 1, depth: 4 });
    expect(reds(volume!.texels)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps every row of a slice, top first', () => {
    const volume = sliceImage(indexedImage(2, 4), { horizontal: 2, vertical: 1 });
    expect(volume).toMatchObject({ width: 1, height: 4, depth: 2 });
    expect(reds(volume!.texels)).toEqual([0, 2, 4, 6, 1, 3, 5, 7]);
  });

  it('drops a remainder column and row, as the truncated slice size does (edge case)', () => {
    // 5x3 over 2x1: each slice is 2x3, and column 4 is no slice's.
    const volume = sliceImage(indexedImage(5, 3), { horizontal: 2, vertical: 1 });
    expect(volume).toMatchObject({ width: 2, height: 3, depth: 2 });
    expect(reds(volume!.texels)).toEqual([0, 1, 5, 6, 10, 11, 2, 3, 7, 8, 12, 13]);
  });

  it('cuts nothing from an image narrower than its slice count (edge case)', () => {
    expect(sliceImage(indexedImage(3, 3), { horizontal: 4, vertical: 1 })).toBeNull();
  });
});
