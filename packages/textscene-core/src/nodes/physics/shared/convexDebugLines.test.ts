/**
 * `convexDebugLines`: the hull edges `ConvexPolygonShape3D::get_debug_mesh_lines` draws
 * (convex_polygon_shape_3d.cpp:36-56), one segment per hull edge with coplanar faces merged.
 */
import { describe, expect, it } from 'vitest';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { convexDebugLines } from './convexDebugLines';
import { godotDebugLinesFor, undirectedEdges } from './godotDebugLines.testkit';
import { decodeConvexPolygonShape3D } from '../../../resources/shapes/convexpolygonshape3d';

describe('convexDebugLines', () => {
  it.each(godotDebugLinesFor('ConvexPolygonShape3D'))(
    'draws the hull edges Godot draws for $name',
    ({ shape, lines }) => {
      const { points } = decodeConvexPolygonShape3D(shape.data);
      expect(undirectedEdges(convexDebugLines(points, ConvexGeometry))).toEqual(undirectedEdges(lines));
    }
  );

  it('draws nothing for a single point, as Godot needs two', () => {
    expect(convexDebugLines(new Float32Array([1, 2, 3]), ConvexGeometry)).toHaveLength(0);
  });

  it('draws nothing for a point that is not finite, and no crash (edge case)', () => {
    const points = new Float32Array([0, 0, 0, 1, 0, 0, Number.NaN, 0, 0]);
    expect(undirectedEdges(convexDebugLines(points, ConvexGeometry))).toEqual(
      undirectedEdges([0, 0, 0, 1, 0, 0])
    );
  });
});
