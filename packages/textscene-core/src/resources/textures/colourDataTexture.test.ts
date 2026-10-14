/** The colour texture a procedural or saved texture uploads as. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { colourDataTexture } from './colourDataTexture';

function halves(texture: THREE.DataTexture): number[] {
  return Array.from(texture.image.data as Uint16Array, THREE.DataUtils.fromHalfFloat);
}

describe('colourDataTexture', () => {
  it('tags bytes sRGB for the GPU to decode, filtered linearly and clamped', () => {
    const texture = colourDataTexture(new Uint8Array([10, 20, 30, 40]), 1, 1);
    expect(texture).toMatchObject({
      type: THREE.UnsignedByteType,
      colorSpace: THREE.SRGBColorSpace,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
    });
    expect(texture.image.data).toEqual(new Uint8Array([10, 20, 30, 40]));
  });

  it('uploads floats raw as linear half floats, so a channel past 1 survives', () => {
    const texture = colourDataTexture(new Float32Array([2, 0.5, 0, 0.25]), 1, 1);
    expect(texture).toMatchObject({ type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace });
    expect(halves(texture)).toEqual([2, 0.5, 0, 0.25]);
  });

  it('keeps a negative float channel (edge case)', () => {
    expect(halves(colourDataTexture(new Float32Array([-0.5, 0, 0, 1]), 1, 1))[0]).toBe(-0.5);
  });
});
