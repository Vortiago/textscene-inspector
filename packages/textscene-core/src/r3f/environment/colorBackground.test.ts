import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clearColorCube } from './colorBackground';

/** The one texel of each of `cube`'s faces. */
function faceTexels(cube: THREE.CubeTexture): number[][] {
  return (cube.image as THREE.DataTexture[]).map((face) => Array.from(face.image.data as Float32Array));
}

describe('clearColorCube', () => {
  it('fills all six faces with the sRGB colour converted to linear twice, opaque', () => {
    const cube = clearColorCube({ r: 0.5, g: 1, b: 2 });

    for (const texel of faceTexels(cube)) {
      expect(texel[0]).toBeCloseTo(0.0376495, 6);
      expect(texel[1]).toBeCloseTo(1, 6);
      expect(texel[2]).toBeCloseTo(42.03049, 4);
      expect(texel[3]).toBe(1);
    }
  });

  it('converts a channel below the sRGB knee on the linear segment both times (edge case)', () => {
    const [texel] = faceTexels(clearColorCube({ r: 0.02, g: 0, b: 0 }));

    expect(texel?.[0]).toBeCloseTo(0.000119813, 9);
    expect(texel?.[1]).toBe(0);
  });

  it('samples as linear float texels with no mipmaps, so a bright channel is not clamped', () => {
    const cube = clearColorCube({ r: 4, g: 0, b: 0 });

    expect(cube).toMatchObject({
      type: THREE.FloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      generateMipmaps: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
  });

  it('builds an independent cube per call, which each caller disposes (edge case)', () => {
    const color = { r: 0.1, g: 0.2, b: 0.3 };

    expect(clearColorCube(color)).not.toBe(clearColorCube(color));
  });
});
