import { describe, expect, it } from 'vitest';
import { buildCapsuleMeshSurface } from './build';
import type { CapsuleMeshProperties } from './types';

/** Four segments round and no extra rings, so each section is two rows of five vertices. */
const COARSE: CapsuleMeshProperties = { radius: 0.5, height: 2, radialSegments: 4, rings: 0 };
/** Section starts: the top hemisphere, the cylinder and the bottom hemisphere. */
const CYLINDER = 10;
const BOTTOM = 20;

function triple(array: Float32Array | undefined, vertex: number, size = 3): number[] {
  return Array.from(array!.slice(vertex * size, vertex * size + size));
}

function expectClose(actual: number[], expected: number[]): void {
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));
}

describe('buildCapsuleMeshSurface', () => {
  it('builds three sections of (rings + 2) rows of (radial_segments + 1) vertices', () => {
    const surface = buildCapsuleMeshSurface(COARSE, null);

    expect(surface.positions.length / 3).toBe(30);
    expect(surface.indices.length).toBe(3 * 4 * 6);
  });

  it('puts the top pole at half the height, its tangent along -X', () => {
    const surface = buildCapsuleMeshSurface(COARSE, null);

    expectClose(triple(surface.positions, 0), [0, 1, 0]);
    expectClose(triple(surface.normals, 0), [0, 1, 0]);
    expectClose(triple(surface.tangents, 0, 4), [-1, 0, 0, 1]);
    expectClose(triple(surface.uvs, 0, 2), [0, 0]);
  });

  it('turns U from +Z towards -X', () => {
    const surface = buildCapsuleMeshSurface(COARSE, null);

    expectClose(triple(surface.positions, 6), [-0.5, 0.5, 0]);
    expectClose(triple(surface.normals, 6), [-1, 0, 0]);
    expectClose(triple(surface.tangents, 6, 4), [0, 0, 1, 1]);
  });

  it('splits V into thirds: the top cap, the cylinder and the bottom cap', () => {
    const surface = buildCapsuleMeshSurface(COARSE, null);

    expect(triple(surface.uvs, 5, 2)[1]).toBeCloseTo(1 / 3, 6);
    expect(triple(surface.uvs, CYLINDER + 5, 2)[1]).toBeCloseTo(2 / 3, 6);
    expect(triple(surface.uvs, BOTTOM + 5, 2)[1]).toBeCloseTo(1, 6);
  });

  it('runs the cylinder from the top cap down to the bottom cap', () => {
    const surface = buildCapsuleMeshSurface(COARSE, null);

    expectClose(triple(surface.positions, CYLINDER + 6), [-0.5, -0.5, 0]);
    expectClose(triple(surface.normals, CYLINDER + 6), [-1, 0, 0]);
  });

  it('puts the bottom pole at minus half the height', () => {
    const surface = buildCapsuleMeshSurface(COARSE, null);

    expectClose(triple(surface.positions, BOTTOM + 5), [0, -1, 0]);
  });

  it("fronts each quad clockwise, Godot's winding, section by section", () => {
    const indices = Array.from(buildCapsuleMeshSurface(COARSE, null).indices);

    expect(indices.slice(0, 6)).toEqual([0, 1, 5, 1, 6, 5]);
    expect(indices.slice(24, 30)).toEqual([10, 11, 15, 11, 16, 15]);
  });

  it('collapses the cylinder to nothing when the height is the diameter (edge case)', () => {
    const surface = buildCapsuleMeshSurface({ ...COARSE, height: 1 }, null);

    expect(triple(surface.positions, CYLINDER)[1]).toBeCloseTo(0, 6);
    expect(triple(surface.positions, CYLINDER + 5)[1]).toBeCloseTo(0, 6);
    expect(triple(surface.positions, 0)[1]).toBeCloseTo(0.5, 6);
  });

  it('writes no UV2 without a padding', () => {
    expect(buildCapsuleMeshSurface(COARSE, null).uv2s).toBeUndefined();
  });

  it('lays UV2 out by length, so the caps take their arc and the cylinder its height', () => {
    // Without padding: each cap's quarter arc is π/4 of a total π/2 + 1.
    const surface = buildCapsuleMeshSurface(COARSE, 0);

    expectClose(triple(surface.uv2s, 5, 2), [0, 0.305508]);
    expectClose(triple(surface.uv2s, CYLINDER + 6, 2), [0.25, 0.694492]);
  });

  it('pads UV2 on the right and the bottom', () => {
    // A padding of π against a circumference of π halves U, and adds π to the total length.
    const surface = buildCapsuleMeshSurface(COARSE, Math.PI);

    expectClose(triple(surface.uv2s, CYLINDER + 9, 2), [0.5, 0.312548]);
  });
});
