import { describe, expect, it } from 'vitest';
import { loadedOriginOffset } from './reflectionProbe';

const ZERO = { x: 0, y: 0, z: 0 };

describe('loadedOriginOffset', () => {
  it('keeps an offset inside the box', () => {
    expect(loadedOriginOffset([['origin_offset', { x: 1, y: -2, z: 3 }]])).toEqual({ x: 1, y: -2, z: 3 });
  });

  it('clamps each axis to half the size less 0.01', () => {
    const loaded = loadedOriginOffset([
      ['size', { x: 4, y: 4, z: 4 }],
      ['origin_offset', { x: 5, y: -5, z: 1 }],
    ]);
    expect(loaded.x).toBeCloseTo(1.99, 6);
    expect(loaded.y).toBeCloseTo(-1.99, 6);
    expect(loaded.z).toBe(1);
  });

  it('clamps an offset against the default size when the file lists it before the size (edge case)', () => {
    const loaded = loadedOriginOffset([
      ['origin_offset', { x: 15, y: 0, z: 0 }],
      ['size', { x: 40, y: 40, z: 40 }],
    ]);
    expect(loaded.x).toBeCloseTo(9.99, 5);
  });

  it('is the origin when no line sets an offset', () => {
    expect(loadedOriginOffset([['size', { x: 4, y: 4, z: 4 }]])).toEqual(ZERO);
  });
});
