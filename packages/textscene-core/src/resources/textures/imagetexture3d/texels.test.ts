/** The slices an ImageTexture3D saves, stacked as `_set_images` stacks them. */
import { describe, expect, it } from 'vitest';
import { stackSlices } from './texels';

function slice(width: number, height: number, red: number) {
  return { data: new Uint8Array(width * height * 4).fill(red), width, height };
}

describe('stackSlices', () => {
  it('stacks every slice of one size in order', () => {
    const volume = stackSlices([slice(1, 1, 10), slice(1, 1, 20)]);
    expect(volume).toMatchObject({ width: 1, height: 1, depth: 2 });
    expect([...volume!.texels]).toEqual([10, 10, 10, 10, 20, 20, 20, 20]);
  });

  it('stops at the first image of another size, where the mipmaps start', () => {
    const volume = stackSlices([slice(2, 2, 10), slice(2, 2, 20), slice(1, 1, 30)]);
    expect(volume).toMatchObject({ width: 2, height: 2, depth: 2 });
  });

  it('keeps the raw floats of a float format, which can pass 1', () => {
    const floats = { data: new Float32Array([2, 0, 0, 1]), width: 1, height: 1 };
    expect(stackSlices([floats, floats])!.texels).toEqual(new Float32Array([2, 0, 0, 1, 2, 0, 0, 1]));
  });

  it('stacks nothing from no image (edge case)', () => {
    expect(stackSlices([])).toBeNull();
  });
});
