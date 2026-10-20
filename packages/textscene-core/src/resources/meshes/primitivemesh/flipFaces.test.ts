import { describe, expect, it } from 'vitest';
import type { GodotSurface } from '../godotSurface';
import { flipFaces } from './flipFaces';

/** One clockwise triangle facing +Z. */
function triangle(overrides: Partial<GodotSurface> = {}): GodotSurface {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
    indices: new Uint16Array([0, 1, 2]),
    ...overrides,
  };
}

describe('flipFaces', () => {
  it('negates every normal and swaps the first two corners of each triangle', () => {
    const input = triangle();
    const flipped = flipFaces(input);

    expect(Array.from(flipped.normals!)).toEqual(Array.from(input.normals!, (n) => -n));
    expect(Array.from(flipped.indices)).toEqual([1, 0, 2]);
  });

  it('keeps the positions and the UVs, and leaves the input untouched', () => {
    const input = triangle();
    const flipped = flipFaces(input);

    expect(flipped.positions).toBe(input.positions);
    expect(flipped.uvs).toBe(input.uvs);
    expect(Array.from(input.indices)).toEqual([0, 1, 2]);
  });

  it('leaves a surface without normals as it is, as Godot does (edge case)', () => {
    const input = triangle({ normals: undefined });

    expect(flipFaces(input)).toBe(input);
  });
});
