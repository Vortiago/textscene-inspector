import { describe, expect, it } from 'vitest';
import { highMaskHalf, lowMaskHalf, SCENE_ROW_TEXELS, setMatrixRows, setTexel } from './sceneRowTexels';

describe('setTexel', () => {
  it('writes four floats at the texel and touches no other', () => {
    const row = new Float32Array(SCENE_ROW_TEXELS * 4);

    setTexel(row, 2, 1, 2, 3, 4);

    expect(Array.from(row.subarray(0, 12))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4]);
  });
});

describe('setMatrixRows', () => {
  it('writes the rows of a column-major matrix, one texel for each of the first three', () => {
    const row = new Float32Array(SCENE_ROW_TEXELS * 4);
    const columnMajor = [1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15, 4, 8, 12, 16];

    setMatrixRows(row, 1, columnMajor);

    expect(Array.from(row.subarray(4, 16))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('the mask halves', () => {
  it('split a 32-bit mask into 16 bits each, which a float holds exactly', () => {
    expect([lowMaskHalf(0xabcd_1234), highMaskHalf(0xabcd_1234)]).toEqual([0x1234, 0xabcd]);
  });

  it('keep the top bit of the mask, which a signed shift would lose', () => {
    expect(highMaskHalf(0x8000_0000)).toBe(0x8000);
  });
});
