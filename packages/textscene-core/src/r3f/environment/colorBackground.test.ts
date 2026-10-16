import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clearColorCube, foggedClearColorCube } from './colorBackground';
import { cubeFaceTexels } from '../testing/cubeTexels';

describe('clearColorCube', () => {
  it('fills all six faces with the sRGB colour linearised once, opaque', () => {
    for (const [r, g, b, a] of cubeFaceTexels(clearColorCube({ r: 0.5, g: 1, b: 0 }))) {
      expect(r).toBeCloseTo(0.214, 4);
      expect([g, b, a]).toEqual([1, 0, 1]);
    }
  });

  it('keeps a channel above 1, which the background energy scales it to (edge case)', () => {
    const r = cubeFaceTexels(clearColorCube({ r: 2, g: 0, b: 0 }))[0]?.[0];

    expect(r).toBeGreaterThan(1);
  });
});

describe('foggedClearColorCube', () => {
  it('fills all six faces with the sRGB colour linearised twice, opaque', () => {
    const cube = foggedClearColorCube({ r: 0.5, g: 1, b: 0 });

    for (const [r, g, b, a] of cubeFaceTexels(cube)) {
      expect(r).toBeCloseTo(0.0376, 4);
      expect([g, b, a]).toEqual([1, 0, 1]);
    }
  });

  it('linearises a channel below the knee twice through its linear segment (edge case)', () => {
    const r = cubeFaceTexels(foggedClearColorCube({ r: 0.02, g: 0, b: 0 }))[0]?.[0];

    expect(r).toBeCloseTo(0.02 / 12.92 / 12.92, 8);
  });

  it('samples as linear float texels with no mipmaps, so a bright channel is not clamped', () => {
    const cube = foggedClearColorCube({ r: 4, g: 0, b: 0 });

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

    expect(foggedClearColorCube(color)).not.toBe(foggedClearColorCube(color));
  });
});
