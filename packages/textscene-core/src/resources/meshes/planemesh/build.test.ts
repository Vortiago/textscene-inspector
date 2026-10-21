/**
 * PlaneMesh build, from `PlaneMesh::_create_mesh_array` (`primitive_meshes.cpp:1412-1498`), which
 * its QuadMesh subclass shares.
 */

import { describe, expect, it } from 'vitest';
import { buildPlaneMeshSurface } from './build';
import { expectClockwiseFronts, expectClose, pointsOf, vertexOf } from '../primitivemesh/surface.testkit';
import { PlaneMeshOrientation } from '../../../godot/scene/planeMesh';
import type { PlaneMeshProperties } from './types';

/** A 2x4 plane: its first vertex shows which way each axis runs. */
function plane(overrides: Partial<PlaneMeshProperties> = {}): PlaneMeshProperties {
  return {
    size: { x: 2, y: 4 },
    subdivideWidth: 0,
    subdivideDepth: 0,
    orientation: PlaneMeshOrientation.FACE_Y,
    centerOffset: { x: 0, y: 0, z: 0 },
    ...overrides,
  };
}

describe('buildPlaneMeshSurface', () => {
  it('builds (subdivide_depth + 2) rows of (subdivide_width + 2) vertices', () => {
    const surface = buildPlaneMeshSurface(plane({ subdivideWidth: 2, subdivideDepth: 1 }));

    expect(surface.positions.length / 3).toBe(3 * 4);
    expect(surface.indices.length).toBe(2 * 3 * 2 * 3);
  });

  it.each([
    [PlaneMeshOrientation.FACE_X, [0, -2, -1], [1, 0, 0], [0, 0, -1, 1]],
    [PlaneMeshOrientation.FACE_Y, [1, 0, 2], [0, 1, 0], [1, 0, 0, 1]],
    [PlaneMeshOrientation.FACE_Z, [1, -2, 0], [0, 0, 1], [1, 0, 0, 1]],
  ])('starts orientation %i at its corner, with UV (1, 1)', (orientation, position, normal, tangent) => {
    const surface = buildPlaneMeshSurface(plane({ orientation }));

    expectClose(vertexOf(surface.positions, 0), position);
    expectClose(vertexOf(surface.normals, 0), normal);
    expectClose(vertexOf(surface.tangents, 0, 4), tangent);
    expectClose(vertexOf(surface.uvs, 0, 2), [1, 1]);
  });

  it.each([PlaneMeshOrientation.FACE_X, PlaneMeshOrientation.FACE_Y, PlaneMeshOrientation.FACE_Z])(
    "fronts every triangle of orientation %i clockwise, Godot's winding",
    (orientation) => {
      expectClockwiseFronts(
        buildPlaneMeshSurface(plane({ orientation, subdivideWidth: 1, subdivideDepth: 2 }))
      );
    }
  );

  it("accumulates each row in single precision, as Godot's float does", () => {
    // Ten steps of 0.1 from -0.5 end a float short of 0.5, as in Godot's BoxMesh.
    const surface = buildPlaneMeshSurface(plane({ size: { x: 1, y: 1 }, subdivideWidth: 9 }));

    expect(vertexOf(surface.positions, 10)[0]).toBe(Math.fround(-0.4999999702));
  });

  it('moves every vertex by center_offset', () => {
    const centered = pointsOf(buildPlaneMeshSurface(plane()));
    const offset = pointsOf(buildPlaneMeshSurface(plane({ centerOffset: { x: 0.5, y: -1, z: 3 } })));

    offset.forEach((point, v) =>
      expectClose(point, [centered[v]![0]! + 0.5, centered[v]![1]! - 1, centered[v]![2]! + 3])
    );
  });

  it('writes no UV2, which PrimitiveMesh makes from UV instead', () => {
    expect(buildPlaneMeshSurface(plane()).uv2s).toBeUndefined();
  });
});
