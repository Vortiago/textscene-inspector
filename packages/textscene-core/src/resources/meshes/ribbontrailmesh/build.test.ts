/**
 * RibbonTrailMesh build, ported from `RibbonTrailMesh::_create_mesh_array`
 * (`primitive_meshes.cpp:2879-3004`). The curve scales the width of each row (`:2921-2924`).
 */

import { describe, expect, it } from 'vitest';
import { curveOf, point } from '../../curves/curve/curve.testkit';
import { EMPTY_CURVE } from '../../curves/curve/types';
import { expectClockwiseFronts, expectClose, vertexOf } from '../primitivemesh/surface.testkit';
import { buildRibbonTrailMeshSurface } from './build';
import type { RibbonTrailMeshProperties } from './types';

/** Two sections of length 1 with one segment each: three rows at y = 1, 0 and -1. */
const COARSE_FLAT: RibbonTrailMeshProperties = {
  isCross: false,
  size: 1,
  sections: 2,
  sectionSegments: 1,
  sectionLength: 1,
  curve: null,
};

const COARSE_CROSS: RibbonTrailMeshProperties = { ...COARSE_FLAT, isCross: true };

const SHRINKING = curveOf(point(0, 1), point(1, 0.2));

describe('buildRibbonTrailMeshSurface', () => {
  describe('flat', () => {
    it('builds (section_segments * sections + 1) * 2 vertices and 6 indices for each segment', () => {
      const surface = buildRibbonTrailMeshSurface(COARSE_FLAT);

      expect(surface.positions.length / 3).toBe(6);
      expect(surface.indices.length).toBe(12);
    });

    it('builds the default ribbon of 32 vertices', () => {
      const defaults = { ...COARSE_FLAT, sections: 5, sectionSegments: 3, sectionLength: 0.2 };

      expect(buildRibbonTrailMeshSurface(defaults).positions.length / 3).toBe((3 * 5 + 1) * 2);
    });

    it('puts the first row at the top and the last at the bottom, each as a left and a right vertex', () => {
      const surface = buildRibbonTrailMeshSurface(COARSE_FLAT);

      expectClose(vertexOf(surface.positions, 0), [-0.5, 1, 0]);
      expectClose(vertexOf(surface.positions, 1), [0.5, 1, 0]);
      expectClose(vertexOf(surface.positions, 4), [-0.5, -1, 0]);
      expectClose(vertexOf(surface.positions, 5), [0.5, -1, 0]);
    });

    it('faces +Z with a tangent along +Y, and runs U across and V down', () => {
      const surface = buildRibbonTrailMeshSurface(COARSE_FLAT);

      expectClose(vertexOf(surface.normals, 0), [0, 0, 1]);
      expectClose(vertexOf(surface.tangents, 1, 4), [0, 1, 0, 1]);
      expectClose(vertexOf(surface.uvs, 0, 2), [0, 0]);
      expectClose(vertexOf(surface.uvs, 1, 2), [1, 0]);
      expectClose(vertexOf(surface.uvs, 2, 2), [0, 0.5]);
      expectClose(vertexOf(surface.uvs, 5, 2), [1, 1]);
    });

    it("fronts each triangle clockwise, Godot's winding", () => {
      const surface = buildRibbonTrailMeshSurface(COARSE_FLAT);

      expect(Array.from(surface.indices).slice(0, 6)).toEqual([0, 1, 2, 1, 3, 2]);
      expect(Array.from(surface.indices).slice(6, 12)).toEqual([2, 3, 4, 3, 5, 4]);
      expectClockwiseFronts(surface);
    });
  });

  describe('cross', () => {
    it('builds twice the vertices and indices of the flat ribbon', () => {
      const surface = buildRibbonTrailMeshSurface(COARSE_CROSS);

      expect(surface.positions.length / 3).toBe(12);
      expect(surface.indices.length).toBe(24);
    });

    it('puts the second strip across the first, in the XY plane turned to Z, facing +X', () => {
      const surface = buildRibbonTrailMeshSurface(COARSE_CROSS);

      expectClose(vertexOf(surface.positions, 2), [0, 1, -0.5]);
      expectClose(vertexOf(surface.positions, 3), [0, 1, 0.5]);
      expectClose(vertexOf(surface.normals, 2), [1, 0, 0]);
      expectClose(vertexOf(surface.normals, 3), [1, 0, 0]);
      expectClose(vertexOf(surface.tangents, 3, 4), [0, 1, 0, 1]);
      expectClose(vertexOf(surface.uvs, 2, 2), [0, 0]);
      expectClose(vertexOf(surface.uvs, 3, 2), [1, 0]);
    });

    it('writes the four vertices of a row together and joins a row to the next four on', () => {
      const surface = buildRibbonTrailMeshSurface(COARSE_CROSS);

      expect(Array.from(surface.indices).slice(0, 12)).toEqual([0, 1, 4, 1, 5, 4, 2, 3, 6, 3, 7, 6]);
      expectClose(vertexOf(surface.positions, 4), [-0.5, 0, 0]);
      expectClose(vertexOf(surface.positions, 6), [0, 0, -0.5]);
    });

    it('winds the second strip against its stored normal, as Godot writes it', () => {
      const surface = buildRibbonTrailMeshSurface(COARSE_CROSS);

      // The first strip fronts clockwise against +Z; the strip facing +X winds counter-clockwise
      // against it (`:2968-2981`), so its front is seen from -X.
      const firstStrip = {
        ...surface,
        indices: Uint32Array.from(surface.indices).filter((_, i) => i % 12 < 6),
      };
      expectClockwiseFronts(firstStrip);
    });
  });

  it('writes no UV2, which PrimitiveMesh::_update makes from UV', () => {
    expect(buildRibbonTrailMeshSurface(COARSE_FLAT).uv2s).toBeUndefined();
  });

  it('scales the width by size', () => {
    const surface = buildRibbonTrailMeshSurface({ ...COARSE_FLAT, size: 3 });

    expectClose(vertexOf(surface.positions, 0), [-1.5, 1, 0]);
  });

  describe('with a curve', () => {
    // Godot 4.6.3 prints 0.6000000238 for `sample_baked(0.5)` of this curve.
    it('scales the width of each row by the baked curve at its V', () => {
      const surface = buildRibbonTrailMeshSurface({ ...COARSE_FLAT, curve: SHRINKING });

      expectClose(vertexOf(surface.positions, 1), [0.5, 1, 0]);
      expectClose(vertexOf(surface.positions, 3), [0.3, 0, 0]);
      expectClose(vertexOf(surface.positions, 5), [0.1, -1, 0]);
    });

    it('scales both strips of a cross ribbon', () => {
      const surface = buildRibbonTrailMeshSurface({ ...COARSE_CROSS, curve: SHRINKING });

      expectClose(vertexOf(surface.positions, 11), [0, -1, 0.1]);
    });

    it('leaves the normal unscaled', () => {
      const surface = buildRibbonTrailMeshSurface({ ...COARSE_FLAT, curve: SHRINKING });

      expectClose(vertexOf(surface.normals, 5), [0, 0, 1]);
    });

    it('draws a curve with no point as no curve', () => {
      const surface = buildRibbonTrailMeshSurface({ ...COARSE_FLAT, curve: EMPTY_CURVE });

      expect(surface.positions).toEqual(buildRibbonTrailMeshSurface(COARSE_FLAT).positions);
    });
  });
});
