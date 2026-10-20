/**
 * BoxMesh build, from `BoxMesh::create_mesh_array` (`primitive_meshes.cpp:724-966`): front and
 * back, right and left, then top and bottom, two faces a vertex apart in each loop, packed into a
 * 3x2 UV atlas.
 */

import { describe, expect, it } from 'vitest';
import { buildBoxMeshSurface } from './build';
import { expectClockwiseFronts, expectClose, pointsOf, vertexOf } from '../primitivemesh/surface.testkit';
import type { BoxMeshProperties } from './types';

function box(overrides: Partial<BoxMeshProperties> = {}): BoxMeshProperties {
  return {
    size: { x: 1, y: 1, z: 1 },
    subdivideWidth: 0,
    subdivideHeight: 0,
    subdivideDepth: 0,
    ...overrides,
  };
}

/** The first vertex of each face of an unsubdivided box: each loop writes 2x2 vertex pairs. */
const FIRST_VERTEX = { front: 0, back: 1, right: 8, left: 9, top: 16, bottom: 17 };

describe('buildBoxMeshSurface', () => {
  it("builds Godot's vertex and triangle counts for an unsubdivided box", () => {
    const surface = buildBoxMeshSurface(box(), null);

    expect(surface.positions.length / 3).toBe(24);
    expect(surface.indices.length).toBe(6 * 2 * 3);
  });

  it.each([
    // (sh+2)(sw+2)·2 + (sh+2)(sd+2)·2 + (sd+2)(sw+2)·2
    [{ subdivideWidth: 1 }, 12 + 8 + 12],
    [{ subdivideHeight: 1 }, 12 + 12 + 8],
    [{ subdivideDepth: 1 }, 8 + 12 + 12],
  ])('scales its vertex count with %o', (subdivision, count) => {
    expect(buildBoxMeshSurface(box(subdivision), null).positions.length / 3).toBe(count);
  });

  it('fills its size box exactly, centred on the origin', () => {
    const points = pointsOf(buildBoxMeshSurface(box({ size: { x: 2, y: 4, z: 6 } }), null));
    const axis = (a: number) => points.map((p) => p[a]!);

    expect([0, 1, 2].map((a) => Math.min(...axis(a)))).toEqual([-1, -2, -3]);
    expect([0, 1, 2].map((a) => Math.max(...axis(a)))).toEqual([1, 2, 3]);
  });

  it('starts the front face at its top left, facing +Z with its tangent along +X', () => {
    const surface = buildBoxMeshSurface(box(), null);

    expectClose(vertexOf(surface.positions, FIRST_VERTEX.front), [-0.5, 0.5, 0.5]);
    expectClose(vertexOf(surface.normals, FIRST_VERTEX.front), [0, 0, 1]);
    expectClose(vertexOf(surface.tangents, FIRST_VERTEX.front, 4), [1, 0, 0, 1]);
  });

  it.each([
    ['front', [0, 0]],
    ['back', [2 / 3, 0]],
    ['right', [1 / 3, 0]],
    ['left', [0, 0.5]],
    ['top', [1 / 3, 0.5]],
    ['bottom', [2 / 3, 0.5]],
  ] as const)('puts the %s face in its cell of the 3x2 atlas', (face, uv) => {
    expectClose(vertexOf(buildBoxMeshSurface(box(), null).uvs, FIRST_VERTEX[face], 2), [...uv]);
  });

  it.each([
    ['back', [0, 0, -1], [-1, 0, 0, 1]],
    ['right', [1, 0, 0], [0, 0, -1, 1]],
    ['left', [-1, 0, 0], [0, 0, 1, 1]],
    ['top', [0, 1, 0], [-1, 0, 0, 1]],
    ['bottom', [0, -1, 0], [1, 0, 0, 1]],
  ] as const)('gives the %s face one normal and one tangent', (face, normal, tangent) => {
    const surface = buildBoxMeshSurface(box(), null);

    expectClose(vertexOf(surface.normals, FIRST_VERTEX[face]), [...normal]);
    expectClose(vertexOf(surface.tangents, FIRST_VERTEX[face], 4), [...tangent]);
  });

  it("fronts every triangle clockwise against its stored normal, Godot's winding", () => {
    expectClockwiseFronts(
      buildBoxMeshSurface(box({ subdivideWidth: 1, subdivideHeight: 2, subdivideDepth: 3 }), null)
    );
  });

  it('writes no UV2 without a padding', () => {
    expect(buildBoxMeshSurface(box(), null).uv2s).toBeUndefined();
  });

  it('pads UV2 so the face islands keep apart', () => {
    // A padding of 1 on a unit box: total_h = 4 and total_v = 6 (`:732-737`), so the right face
    // starts at U 0.25 + 0.25 and the back face at V 1/6 + 1/6.
    const surface = buildBoxMeshSurface(box(), 1);

    expectClose(vertexOf(surface.uv2s, FIRST_VERTEX.right, 2), [0.5, 0]);
    expectClose(vertexOf(surface.uv2s, FIRST_VERTEX.back, 2), [0, 1 / 3]);
    expectClose(vertexOf(surface.uv2s, FIRST_VERTEX.top, 2), [0, 2 / 3]);
  });

  it("scales the front face's UV2 V by subdivide_width, as Godot does (edge case)", () => {
    // Godot divides the front and back V2 by subdivide_w + 1 where the row count is
    // subdivide_h + 1 (`:775`). The last row then sits at V2 1/2 of height_v = 1/3, not at 1/3.
    const surface = buildBoxMeshSurface(box({ subdivideWidth: 1 }), 0);
    const lastRowFirstVertex = 2 * 3;

    expectClose(vertexOf(surface.uv2s, lastRowFirstVertex, 2), [0, 1 / 6]);
  });
});
