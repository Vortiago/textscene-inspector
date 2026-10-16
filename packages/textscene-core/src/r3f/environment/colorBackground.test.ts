import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clearColorTexture, foggedClearColorTexture } from './colorBackground';
import { textureTexel } from '../testing/backgroundTexel';

describe('clearColorTexture', () => {
  it('holds the sRGB colour linearised once, opaque', () => {
    const [r, g, b, a] = textureTexel(clearColorTexture({ r: 0.5, g: 1, b: 0 }));

    expect(r).toBeCloseTo(0.214, 4);
    expect([g, b, a]).toEqual([1, 0, 1]);
  });

  it('keeps a channel above 1, which the background energy scales it to (edge case)', () => {
    const [r] = textureTexel(clearColorTexture({ r: 2, g: 0, b: 0 }));

    expect(r).toBeGreaterThan(1);
  });

  it('is a flat texture, which three draws as a quad that fills an orthographic view too', () => {
    const texture = clearColorTexture({ r: 0.1, g: 0.2, b: 0.3 });

    expect(texture).not.toBeInstanceOf(THREE.CubeTexture);
    expect(texture).toMatchObject({
      type: THREE.FloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      generateMipmaps: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
  });
});

describe('foggedClearColorTexture', () => {
  it('holds the sRGB colour linearised twice, opaque', () => {
    const [r, g, b, a] = textureTexel(foggedClearColorTexture({ r: 0.5, g: 1, b: 0 }));

    expect(r).toBeCloseTo(0.0376, 4);
    expect([g, b, a]).toEqual([1, 0, 1]);
  });

  it('linearises a channel below the knee twice through its linear segment (edge case)', () => {
    const [r] = textureTexel(foggedClearColorTexture({ r: 0.02, g: 0, b: 0 }));

    expect(r).toBeCloseTo(0.02 / 12.92 / 12.92, 8);
  });

  it('is a flat texture, so the fogged colour fills an orthographic view too', () => {
    const texture = foggedClearColorTexture({ r: 4, g: 0, b: 0 });

    expect(texture).not.toBeInstanceOf(THREE.CubeTexture);
    expect(texture).toMatchObject({
      type: THREE.FloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      generateMipmaps: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
  });

  it('builds an independent texture per call, which each caller disposes (edge case)', () => {
    const color = { r: 0.1, g: 0.2, b: 0.3 };

    expect(foggedClearColorTexture(color)).not.toBe(foggedClearColorTexture(color));
  });
});
