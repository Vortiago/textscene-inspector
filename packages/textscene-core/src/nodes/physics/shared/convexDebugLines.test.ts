/**
 * `convexDebugLines`: the hull edges `ConvexPolygonShape3D::get_debug_mesh_lines` draws
 * (convex_polygon_shape_3d.cpp:36-56), one segment per hull edge with coplanar faces merged.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { convexDebugLines } from './convexDebugLines';
import { godotDebugLinesFor, undirectedEdges } from './godotDebugLines.testkit';
import { decodeConvexPolygonShape3D } from '../../../resources/shapes/convexpolygonshape3d';

/** The triangles three's hull builds for the points, empty when it finds no volume or plane. */
function hullTriangles(points: Float32Array): ArrayLike<number> {
  const vertices: THREE.Vector3[] = [];
  for (let i = 0; i + 2 < points.length; i += 3) {
    vertices.push(new THREE.Vector3(points[i], points[i + 1], points[i + 2]));
  }
  return new ConvexGeometry(vertices).getAttribute('position').array;
}

describe('convexDebugLines', () => {
  it.each(godotDebugLinesFor('ConvexPolygonShape3D'))(
    'draws the hull edges Godot draws for $name',
    ({ shape, lines }) => {
      const { points } = decodeConvexPolygonShape3D(shape.data);
      expect(undirectedEdges(convexDebugLines(points, hullTriangles(points)))).toEqual(
        undirectedEdges(lines)
      );
    }
  );

  it('draws nothing for a single point, as Godot needs two', () => {
    expect(convexDebugLines(new Float32Array([1, 2, 3]), [])).toHaveLength(0);
  });
});
