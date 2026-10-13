import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clearColorCube } from './colorBackground';

/** The one texel of each of `cube`'s faces. */
function faceTexels(cube: THREE.CubeTexture): number[][] {
  return (cube.image as THREE.DataTexture[]).map((face) => Array.from(face.image.data as Float32Array));
}

describe('clearColorCube', () => {
  it('fills all six faces with the linear colour, opaque', () => {
    const cube = clearColorCube(new THREE.Color(0.25, 0.5, 2));

    expect(faceTexels(cube)).toEqual(Array.from({ length: 6 }, () => [0.25, 0.5, 2, 1]));
  });

  it('samples as linear float texels with no mipmaps, so a bright channel is not clamped', () => {
    const cube = clearColorCube(new THREE.Color(4, 0, 0));

    expect(cube).toMatchObject({
      type: THREE.FloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      generateMipmaps: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
  });

  it('builds an independent cube per call, which each caller disposes (edge case)', () => {
    const color = new THREE.Color(0.1, 0.2, 0.3);

    expect(clearColorCube(color)).not.toBe(clearColorCube(color));
  });
});
