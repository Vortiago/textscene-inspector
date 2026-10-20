import { describe, expect, it } from 'vitest';
import { buildSphereMeshSurface } from './build';
import type { SphereMeshProperties } from './types';

/** The coarsest sphere: four segments round, one ring, so every vertex is a hand-worked literal. */
const COARSE: SphereMeshProperties = {
  radius: 0.5,
  height: 1,
  radialSegments: 4,
  rings: 1,
  isHemisphere: false,
};
/** Row 1 of 3, column 1 of 5: on the equator, a quarter turn from the seam. */
const EQUATOR = 6;

function triple(array: Float32Array | undefined, vertex: number, size = 3): number[] {
  return Array.from(array!.slice(vertex * size, vertex * size + size));
}

function expectClose(actual: number[], expected: number[]): void {
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));
}

describe('buildSphereMeshSurface', () => {
  it('builds (rings + 2) rows of (radial_segments + 1) vertices', () => {
    const surface = buildSphereMeshSurface(COARSE, null);

    expect(surface.positions.length / 3).toBe(15);
    expect(surface.indices.length).toBe(2 * 4 * 6);
  });

  it('starts at the top pole, with U from +Z', () => {
    const surface = buildSphereMeshSurface(COARSE, null);

    expectClose(triple(surface.positions, 0), [0, 0.5, 0]);
    expectClose(triple(surface.normals, 0), [0, 1, 0]);
    expectClose(triple(surface.tangents, 0, 4), [1, 0, 0, 1]);
    expectClose(triple(surface.uvs, 0, 2), [0, 0]);
  });

  it('puts a quarter turn at +X, with its tangent along the meridian circle', () => {
    const surface = buildSphereMeshSurface(COARSE, null);

    expectClose(triple(surface.positions, EQUATOR), [0.5, 0, 0]);
    expectClose(triple(surface.normals, EQUATOR), [1, 0, 0]);
    expectClose(triple(surface.tangents, EQUATOR, 4), [0, 0, -1, 1]);
    expectClose(triple(surface.uvs, EQUATOR, 2), [0.25, 0.5]);
  });

  it('closes the seam column at +Z with U = 1', () => {
    const surface = buildSphereMeshSurface(COARSE, null);

    expectClose(triple(surface.positions, 9), [0, 0, 0.5]);
    expectClose(triple(surface.uvs, 9, 2), [1, 0.5]);
  });

  it("fronts each quad clockwise, Godot's winding", () => {
    const surface = buildSphereMeshSurface(COARSE, null);

    expect(Array.from(surface.indices).slice(0, 6)).toEqual([0, 1, 5, 1, 6, 5]);
  });

  it('squashes Y by height over the diameter, and tilts the normals to match', () => {
    const surface = buildSphereMeshSurface({ ...COARSE, height: 0.5, rings: 3 }, null);
    // Row 1 sits at 45 degrees: w = y = 1/√2 before the squash halves y.
    const vertex = 5;

    expectClose(triple(surface.positions, 0), [0, 0.25, 0]);
    expectClose(triple(surface.positions, vertex), [0, 0.176777, 0.353553]);
    expectClose(triple(surface.normals, vertex), [0, 0.894427, 0.447214]);
  });

  it('lays a hemisphere on a flat base at y = 0, its dome as tall as height', () => {
    const surface = buildSphereMeshSurface({ ...COARSE, height: 0.5, isHemisphere: true }, null);

    expectClose(triple(surface.positions, 0), [0, 0.5, 0]);
    expectClose(triple(surface.positions, 10), [0, 0, 0]);
    expectClose(triple(surface.normals, 10), [0, -1, 0]);
  });

  it('writes no UV2 without a padding', () => {
    expect(buildSphereMeshSurface(COARSE, null).uv2s).toBeUndefined();
  });

  it('pads UV2 so the islands keep apart', () => {
    // A padding of π against a circumference of π halves U round the centre and thirds V.
    const surface = buildSphereMeshSurface(COARSE, Math.PI);

    expectClose(triple(surface.uv2s, EQUATOR, 2), [0.125, 1 / 6]);
  });

  it('builds one ring, the minimum, as a pole, the equator and a pole (edge case)', () => {
    const surface = buildSphereMeshSurface(COARSE, null);

    expectClose(triple(surface.positions, 10), [0, -0.5, 0]);
  });
});
