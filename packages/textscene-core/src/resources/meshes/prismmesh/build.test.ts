/**
 * PrismMesh build, from `PrismMesh::_create_mesh_array` (`primitive_meshes.cpp:1610-1873`):
 * caps (`:1663`) with the apex X set by `left_to_right` (`:1670`), slanted sides
 * (`:1746`) and base (`:1822`). Vertex counts are Godot's `num_points` (`:1636`):
 * `(sh+2)(sw+2)·2 + (sh+2)(sd+2)·2 + (sd+2)(sw+2)`.
 */

import { describe, expect, it } from 'vitest';
import { buildPrismMeshSurface } from './build';
import { expectClose, expectClockwiseFronts, pointsOf, vertexOf } from '../primitivemesh/surface.testkit';
import type { PrismMeshProperties } from './types';

function prism(overrides: Partial<PrismMeshProperties> = {}): PrismMeshProperties {
  return {
    leftToRight: 0.5,
    size: { x: 1, y: 1, z: 1 },
    subdivideWidth: 0,
    subdivideHeight: 0,
    subdivideDepth: 0,
    ...overrides,
  };
}

/** The first vertex of each face of an unsubdivided prism: the caps and sides write 2x2 vertex pairs. */
const FIRST_VERTEX = { front: 0, back: 1, right: 8, left: 9, bottom: 16 };

describe('buildPrismMeshSurface', () => {
  it("builds Godot's vertex and triangle counts for an unsubdivided prism", () => {
    const surface = buildPrismMeshSurface(prism(), null);

    // (0+2)(0+2)·2 + (0+2)(0+2)·2 + (0+2)(0+2) = 20 vertices, and 8 triangles =
    // 2 caps + 2 slanted quads + 1 base quad.
    expect(surface.positions.length / 3).toBe(20);
    expect(surface.indices.length).toBe(24);
  });

  it('scales its vertex count with each subdivision axis, per Godot num_points', () => {
    expect(buildPrismMeshSurface(prism({ subdivideWidth: 1 }), null).positions.length / 3).toBe(26);
    // sh=1: (1+2)(0+2)·2 + (1+2)(0+2)·2 + (0+2)(0+2) = 12 + 12 + 4.
    expect(buildPrismMeshSurface(prism({ subdivideHeight: 1 }), null).positions.length / 3).toBe(28);
    expect(buildPrismMeshSurface(prism({ subdivideDepth: 1 }), null).positions.length / 3).toBe(26);
  });

  it('fills its size box exactly, centred on the origin', () => {
    const points = pointsOf(buildPrismMeshSurface(prism({ size: { x: 2, y: 4, z: 6 } }), null));
    const axis = (a: number) => points.map((p) => p[a]!);

    expect([0, 1, 2].map((a) => Math.min(...axis(a)))).toEqual([-1, -2, -3]);
    expect([0, 1, 2].map((a) => Math.max(...axis(a)))).toEqual([1, 2, 3]);
  });

  it('puts the apex at the top and the full-width base at the bottom', () => {
    const p = pointsOf(buildPrismMeshSurface(prism(), null));
    const top = p.filter((v) => Math.abs(v[1]! - 0.5) < 1e-6);
    const bottom = p.filter((v) => Math.abs(v[1]! + 0.5) < 1e-6);

    // The whole top row collapses onto the apex line. The base spans size.x.
    for (const v of top) expect(v[0]).toBeCloseTo(0, 6);
    expect(Math.min(...bottom.map((v) => v[0]!))).toBeCloseTo(-0.5, 6);
    expect(Math.max(...bottom.map((v) => v[0]!))).toBeCloseTo(0.5, 6);
  });

  it('places the apex by left_to_right rather than ignoring it', () => {
    // start_x = start_pos.x + (1 - scale) * size.x * left_to_right (:1670). The
    // apex row is scale 0, so the apex sits at -size.x/2 + size.x * ltr.
    const apexX = (leftToRight: number, sizeX = 1) => {
      const p = pointsOf(buildPrismMeshSurface(prism({ leftToRight, size: { x: sizeX, y: 1, z: 1 } }), null));
      return p.filter((v) => Math.abs(v[1]! - 0.5) < 1e-6).map((v) => v[0]!);
    };

    for (const x of apexX(0)) expect(x).toBeCloseTo(-0.5, 6);
    for (const x of apexX(1)) expect(x).toBeCloseTo(0.5, 6);
    for (const x of apexX(0.25, 2)) expect(x).toBeCloseTo(-0.5, 6);
  });

  it('is extruded along Z, so every unsubdivided vertex sits on a cap plane', () => {
    for (const v of pointsOf(buildPrismMeshSurface(prism(), null))) {
      expect(Math.abs(Math.abs(v[2]!) - 0.5)).toBeLessThan(1e-6);
    }
  });

  it("fronts every triangle clockwise against its stored normal, Godot's winding", () => {
    expectClockwiseFronts(buildPrismMeshSurface(prism(), null));
  });

  it('carries a UV per vertex, V measured from the image top', () => {
    const surface = buildPrismMeshSurface(prism(), null);

    expect(surface.uvs!.length / 2).toBe(surface.positions.length / 3);
    // The apex row's first point, offset by left_to_right / 3 (`:1671`).
    expectClose(vertexOf(surface.uvs, 0, 2), [1 / 6, 0]);
  });

  it.each([
    ['front', [1, 0, 0, 1]],
    ['back', [-1, 0, 0, 1]],
    ['right', [0, 0, -1, 1]],
    ['left', [0, 0, 1, 1]],
    ['bottom', [1, 0, 0, 1]],
  ] as const)('gives the %s face one tangent', (face, tangent) => {
    expectClose(vertexOf(buildPrismMeshSurface(prism(), null).tangents, FIRST_VERTEX[face], 4), [...tangent]);
  });

  it('writes no UV2 without a padding', () => {
    expect(buildPrismMeshSurface(prism(), null).uv2s).toBeUndefined();
  });

  it('pads UV2 so the face islands keep apart', () => {
    // A padding of 1 on a unit prism: the horizontal total is 4 and the vertical total 6
    // (`:1618-1628`), so the right face starts at U 0.25 + 0.25 and the back face at V 1/6 + 1/6.
    const surface = buildPrismMeshSurface(prism(), 1);

    expectClose(vertexOf(surface.uv2s, FIRST_VERTEX.right, 2), [0.5, 0]);
    expectClose(vertexOf(surface.uv2s, FIRST_VERTEX.back, 2), [0, 1 / 3]);
    expectClose(vertexOf(surface.uv2s, FIRST_VERTEX.bottom, 2), [0, 2 / 3]);
  });
});
