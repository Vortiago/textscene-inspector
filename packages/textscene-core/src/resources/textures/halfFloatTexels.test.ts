/** Float texels as the half floats a texture uploads. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { toHalfFloatTexels } from './halfFloatTexels';

describe('toHalfFloatTexels', () => {
  it('keeps a value a half float holds exactly, past 1 too', () => {
    expect(
      Array.from(toHalfFloatTexels(new Float32Array([0, 0.5, 2.5, -1])), THREE.DataUtils.fromHalfFloat)
    ).toEqual([0, 0.5, 2.5, -1]);
  });

  it('gives an empty array for no texels (edge case)', () => {
    expect(toHalfFloatTexels(new Float32Array(0))).toHaveLength(0);
  });
});
