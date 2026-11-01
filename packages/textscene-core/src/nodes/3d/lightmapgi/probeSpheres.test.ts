/** The SH-lit spheres of the LightmapGI gizmo (`lightmap_gi_gizmo_plugin.cpp:126-223`). */
import { describe, expect, it } from 'vitest';
import type { CaptureProbes } from '../../../resources/lightmapgidata/captureProbes';
import { probeSphereMesh } from './probeSpheres';

const VERTICES_PER_SPHERE = 9 * 17;
const INDICES_PER_SPHERE = 224 * 3;

/** One probe at `at`, whose nine SH colours are the given `[r, g, b]` triples and zero elsewhere. */
function probe(at: number[], shColours: Record<number, number[]> = {}): CaptureProbes {
  const sh = new Float32Array(9 * 4);
  for (const [slot, rgb] of Object.entries(shColours)) sh.set(rgb, Number(slot) * 4);
  return { points: Float32Array.from(at), tetrahedra: [], sh };
}

/** The vertex of stack `stack` and sector `sector` of the first sphere. */
const vertexOf = (stack: number, sector: number) => stack * 17 + sector;

describe('probeSphereMesh', () => {
  it('builds 9 stacks of 17 vertices and 224 triangles for each probe', () => {
    const two = probeSphereMesh(
      { ...probe([0, 0, 0]), points: Float32Array.of(0, 0, 0, 5, 0, 0), sh: new Float32Array(2 * 9 * 4) },
      0.2
    );
    expect(two.positions.length).toBe(2 * VERTICES_PER_SPHERE * 3);
    expect(two.colors.length).toBe(2 * VERTICES_PER_SPHERE * 3);
    expect(two.indices.length).toBe(2 * INDICES_PER_SPHERE);
  });

  it('offsets the second sphere indices by the vertices of the first', () => {
    const two = probeSphereMesh(
      { ...probe([0, 0, 0]), points: Float32Array.of(0, 0, 0, 5, 0, 0), sh: new Float32Array(2 * 9 * 4) },
      0.2
    );
    expect(Math.max(...two.indices.slice(0, INDICES_PER_SPHERE))).toBeLessThan(VERTICES_PER_SPHERE);
    expect(Math.min(...two.indices.slice(INDICES_PER_SPHERE))).toBeGreaterThanOrEqual(VERTICES_PER_SPHERE);
  });

  it('places the top pole one radius above the point, and sector 0 of the equator one radius along +X', () => {
    const { positions } = probeSphereMesh(probe([1, 2, 3]), 0.2);
    expect(Array.from(positions.slice(0, 3))).toEqual([
      expect.closeTo(1, 6),
      expect.closeTo(2.2, 6),
      expect.closeTo(3, 6),
    ]);
    const equator = vertexOf(4, 0) * 3;
    expect(Array.from(positions.slice(equator, equator + 3))).toEqual([
      expect.closeTo(1.2, 6),
      expect.closeTo(2, 6),
      expect.closeTo(3, 6),
    ]);
  });

  it('lights every vertex with the first SH colour times sqrt(1 / 4pi) * pi (a constant sky)', () => {
    const { colors } = probeSphereMesh(probe([0, 0, 0], { 0: [1, 0.5, 0.25, 1] }), 0.2);
    expect(Array.from(colors.slice(0, 3))).toEqual([
      expect.closeTo(0.8862269, 6),
      expect.closeTo(0.4431135, 6),
      expect.closeTo(0.2215567, 6),
    ]);
  });

  it('weights the third SH colour by the +X normal: 1.0233267 at the equator, sector 0', () => {
    const { colors } = probeSphereMesh(probe([0, 0, 0], { 3: [1, 0, 0, 1] }), 0.2);
    expect(colors[vertexOf(4, 0) * 3]).toBeCloseTo(1.0233267, 6);
    expect(colors[vertexOf(4, 8) * 3]).toBeCloseTo(-1.0233267, 6);
  });

  it('weights the second SH colour by the +Y normal, which is the sphere pole', () => {
    const { colors } = probeSphereMesh(probe([0, 0, 0], { 1: [0, 1, 0, 1] }), 0.2);
    expect(colors[1]).toBeCloseTo(1.0233267, 6);
  });

  it('builds nothing for a radius of zero (edge case)', () => {
    expect(probeSphereMesh(probe([0, 0, 0]), 0).positions).toHaveLength(0);
  });
});
