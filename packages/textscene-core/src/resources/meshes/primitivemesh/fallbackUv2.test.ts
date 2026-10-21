import { describe, expect, it } from 'vitest';
import { withFallbackUv2 } from './fallbackUv2';
import type { GodotSurface } from '../godotSurface';

const SURFACE: GodotSurface = {
  positions: new Float32Array(3),
  uvs: new Float32Array([1, 1]),
  indices: new Uint16Array(),
};

describe('withFallbackUv2', () => {
  it('scales U and V by one minus the padding over the hint on that axis', () => {
    expect(Array.from(withFallbackUv2(SURFACE, 2, { x: 8, y: 4 }).uv2s!)).toEqual([0.75, 0.5]);
  });

  it('measures the padding against 1024 texels on an axis with no hint (edge case)', () => {
    expect(Array.from(withFallbackUv2(SURFACE, 256, { x: 0, y: 0 }).uv2s!)).toEqual([0.75, 0.75]);
  });

  it('keeps a surface with no UV as it is', () => {
    const surface = { ...SURFACE, uvs: undefined };

    expect(withFallbackUv2(surface, 2, { x: 8, y: 4 })).toBe(surface);
  });
});
