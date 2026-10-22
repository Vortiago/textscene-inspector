/**
 * TubeTrailMesh build, ported from `TubeTrailMesh::_create_mesh_array`
 * (`primitive_meshes.cpp:2503-2741`). The curve scales the radius of each row (`:2552-2555`) and of
 * each cap, and a cap whose scale is not above `CMP_EPSILON` is not built (`:2596`, `:2680`).
 */

import { describe, expect, it } from 'vitest';
import { CurveTangentMode, EMPTY_CURVE, type Curve, type CurvePoint } from '../../curves/curve/types';
import { expectClockwiseFronts, expectClose, vertexOf } from '../primitivemesh/surface.testkit';
import { buildTubeTrailMeshSurface } from './build';
import type { TubeTrailMeshProperties } from './types';

/** Two sections of length 1 with one ring each, four steps round: three rows of five vertices. */
const COARSE: TubeTrailMeshProperties = {
  radius: 0.5,
  radialSteps: 4,
  sections: 2,
  sectionLength: 1,
  sectionRings: 1,
  capTop: true,
  capBottom: true,
  curve: null,
};

const BODY_VERTICES = 15;
const CAP_VERTICES = 6;

function point(x: number, y: number): CurvePoint {
  return {
    position: { x, y },
    leftTangent: 0,
    rightTangent: 0,
    leftMode: CurveTangentMode.Free,
    rightMode: CurveTangentMode.Free,
  };
}

function curveOf(...points: CurvePoint[]): Curve {
  return { ...EMPTY_CURVE, points };
}

const SHRINKING = curveOf(point(0, 1), point(1, 0.2));

describe('buildTubeTrailMeshSurface', () => {
  it('builds (section_rings * sections + 1) rows of (radial_steps + 1) vertices and a centre and rim for each cap', () => {
    const surface = buildTubeTrailMeshSurface(COARSE);

    expect(surface.positions.length / 3).toBe(BODY_VERTICES + 2 * CAP_VERTICES);
    expect(surface.indices.length).toBe(2 * 4 * 6 + 2 * 4 * 3);
  });

  it('builds the default tube of 164 vertices', () => {
    const defaults = { ...COARSE, radialSteps: 8, sections: 5, sectionLength: 0.2, sectionRings: 3 };

    expect(buildTubeTrailMeshSurface(defaults).positions.length / 3).toBe(16 * 9 + 2 * 10);
  });

  it('builds no cap vertex when both caps are off', () => {
    const surface = buildTubeTrailMeshSurface({ ...COARSE, capTop: false, capBottom: false });

    expect(surface.positions.length / 3).toBe(BODY_VERTICES);
    expect(surface.indices.length).toBe(2 * 4 * 6);
  });

  it('builds one cap when the other is off', () => {
    expect(buildTubeTrailMeshSurface({ ...COARSE, capBottom: false }).positions.length / 3).toBe(
      BODY_VERTICES + CAP_VERTICES
    );
    expect(buildTubeTrailMeshSurface({ ...COARSE, capTop: false }).positions.length / 3).toBe(
      BODY_VERTICES + CAP_VERTICES
    );
  });

  it('starts the top row on the +Z seam, its normal outward and its tangent along +X', () => {
    const surface = buildTubeTrailMeshSurface(COARSE);

    expectClose(vertexOf(surface.positions, 0), [0, 1, 0.5]);
    expectClose(vertexOf(surface.normals, 0), [0, 0, 1]);
    expectClose(vertexOf(surface.tangents, 0, 4), [1, 0, 0, 1]);
    expectClose(vertexOf(surface.uvs, 0, 2), [0, 0]);
  });

  it('runs U round the tube from +Z towards +X, and V down it over the top half of the atlas', () => {
    const surface = buildTubeTrailMeshSurface(COARSE);

    expectClose(vertexOf(surface.positions, 1), [0.5, 1, 0]);
    expectClose(vertexOf(surface.normals, 1), [1, 0, 0]);
    expectClose(vertexOf(surface.tangents, 1, 4), [0, 0, -1, 1]);
    expectClose(vertexOf(surface.uvs, 1, 2), [0.25, 0]);
    expectClose(vertexOf(surface.positions, 5), [0, 0, 0.5]);
    expectClose(vertexOf(surface.uvs, 5, 2), [0, 0.25]);
    expectClose(vertexOf(surface.positions, 10), [0, -1, 0.5]);
    expectClose(vertexOf(surface.uvs, 10, 2), [0, 0.5]);
  });

  it('closes each row on exactly x = 0, z = 1', () => {
    const surface = buildTubeTrailMeshSurface(COARSE);

    expect(vertexOf(surface.positions, 4)).toEqual([0, 1, 0.5]);
    expect(vertexOf(surface.normals, 4)).toEqual([0, 0, 1]);
    expectClose(vertexOf(surface.uvs, 4, 2), [1, 0]);
  });

  it('puts the top cap centre at the top, facing up, in the quarter of the atlas below the body', () => {
    const surface = buildTubeTrailMeshSurface(COARSE);

    expectClose(vertexOf(surface.positions, 15), [0, 1, 0]);
    expectClose(vertexOf(surface.normals, 15), [0, 1, 0]);
    expectClose(vertexOf(surface.tangents, 15, 4), [1, 0, 0, 1]);
    expectClose(vertexOf(surface.uvs, 15, 2), [0.25, 0.75]);
    expectClose(vertexOf(surface.positions, 16), [0, 1, 0.5]);
    expectClose(vertexOf(surface.uvs, 16, 2), [0.25, 1]);
    expectClose(vertexOf(surface.uvs, 17, 2), [0.5, 0.75]);
  });

  it('puts the bottom cap centre at the bottom, facing down, in the other quarter', () => {
    const surface = buildTubeTrailMeshSurface(COARSE);

    expectClose(vertexOf(surface.positions, 21), [0, -1, 0]);
    expectClose(vertexOf(surface.normals, 21), [0, -1, 0]);
    expectClose(vertexOf(surface.uvs, 21, 2), [0.75, 0.75]);
    expectClose(vertexOf(surface.positions, 22), [0, -1, 0.5]);
    expectClose(vertexOf(surface.uvs, 22, 2), [0.75, 0.5]);
  });

  it("fronts each quad and cap triangle clockwise, Godot's winding", () => {
    const surface = buildTubeTrailMeshSurface(COARSE);

    expect(Array.from(surface.indices).slice(0, 6)).toEqual([0, 1, 5, 1, 6, 5]);
    expect(Array.from(surface.indices).slice(48, 51)).toEqual([15, 17, 16]);
    expect(Array.from(surface.indices).slice(60, 63)).toEqual([21, 22, 23]);
    expectClockwiseFronts(surface);
  });

  it('writes no UV2, which PrimitiveMesh::_update makes from UV', () => {
    expect(buildTubeTrailMeshSurface(COARSE).uv2s).toBeUndefined();
  });

  describe('with a curve', () => {
    // Godot 4.6.3 prints 0.6000000238 for `sample_baked(0.5)` of this curve.
    it('scales the radius of each row by the baked curve at its V', () => {
      const surface = buildTubeTrailMeshSurface({ ...COARSE, curve: SHRINKING });

      expectClose(vertexOf(surface.positions, 0), [0, 1, 0.5]);
      expectClose(vertexOf(surface.positions, 5), [0, 0, 0.3]);
      expectClose(vertexOf(surface.positions, 10), [0, -1, 0.1]);
    });

    it('leaves the normal unscaled', () => {
      const surface = buildTubeTrailMeshSurface({ ...COARSE, curve: SHRINKING });

      expectClose(vertexOf(surface.normals, 10), [0, 0, 1]);
    });

    it('scales each cap rim by the curve at its end', () => {
      const surface = buildTubeTrailMeshSurface({ ...COARSE, curve: SHRINKING });

      expectClose(vertexOf(surface.positions, 16), [0, 1, 0.5]);
      expectClose(vertexOf(surface.positions, 22), [0, -1, 0.1]);
    });

    it('drops the bottom cap when the curve ends at 0', () => {
      const surface = buildTubeTrailMeshSurface({ ...COARSE, curve: curveOf(point(0, 1), point(1, 0)) });

      expect(surface.positions.length / 3).toBe(BODY_VERTICES + CAP_VERTICES);
      expectClose(vertexOf(surface.positions, 15), [0, 1, 0]);
    });

    it('drops the top cap when the curve starts at 0', () => {
      const surface = buildTubeTrailMeshSurface({ ...COARSE, curve: curveOf(point(0, 0), point(1, 1)) });

      expect(surface.positions.length / 3).toBe(BODY_VERTICES + CAP_VERTICES);
      expectClose(vertexOf(surface.positions, 15), [0, -1, 0]);
    });

    it('draws a curve with no point as no curve', () => {
      const surface = buildTubeTrailMeshSurface({ ...COARSE, curve: EMPTY_CURVE });

      expect(surface.positions).toEqual(buildTubeTrailMeshSurface(COARSE).positions);
    });
  });
});
