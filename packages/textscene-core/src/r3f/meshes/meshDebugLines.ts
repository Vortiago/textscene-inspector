/**
 * The segments of Godot's `Mesh::generate_debug_mesh_lines` (`mesh.cpp:466-501`), which the
 * SoftBody3D gizmo draws: three per triangle, in the order the triangles come.
 */

import type * as THREE from 'three';
import type { SurfacedMesh } from './meshContent';
import { geometryDrawsPoints } from '../../resources/meshes/godotSurface';

const FLOATS_PER_VERTEX = 3;
const VERTICES_PER_TRIANGLE = 3;
/** Three segments, two vertices each. */
const FLOATS_PER_TRIANGLE_EDGES = 6 * FLOATS_PER_VERTEX;

/**
 * Flat `[x0,y0,z0, x1,y1,z1, …]` segment ends: for each triangle of a triangle part, `v0 → v1`,
 * `v1 → v2` and `v2 → v0`. A shared edge appears once for each triangle that holds it. The geometry
 * stores a triangle as `(v0, v2, v1)`, because three fronts triangles counter-clockwise, so this
 * undoes that swap to give Godot's order. A points part adds none.
 *
 * @canonical A mesh's triangle edges in Godot's order
 */
export function meshDebugLines(mesh: SurfacedMesh): Float32Array {
  const triangleGeometries = mesh.parts.filter((part) => !geometryDrawsPoints(part.geometry));
  const totalTriangles = triangleGeometries.reduce((total, { geometry }) => total + trianglesIn(geometry), 0);
  const lines = new Float32Array(totalTriangles * FLOATS_PER_TRIANGLE_EDGES);
  let written = 0;
  const writeSegment = (positions: ArrayLike<number>, from: number, to: number) => {
    for (let i = 0; i < FLOATS_PER_VERTEX; i++) lines[written++] = positions[from + i]!;
    for (let i = 0; i < FLOATS_PER_VERTEX; i++) lines[written++] = positions[to + i]!;
  };
  for (const { geometry } of triangleGeometries) {
    const positions = geometry.getAttribute('position').array;
    const index = geometry.getIndex()?.array;
    const offsetAt = (slot: number) => (index ? index[slot]! : slot) * FLOATS_PER_VERTEX;
    const triangleCount = trianglesIn(geometry);
    for (let triangle = 0; triangle < triangleCount; triangle++) {
      const slot = triangle * VERTICES_PER_TRIANGLE;
      // Godot's v1 and v2 sit at slots 2 and 1: the geometry reverses the winding.
      const v0 = offsetAt(slot);
      const v1 = offsetAt(slot + 2);
      const v2 = offsetAt(slot + 1);
      writeSegment(positions, v0, v1);
      writeSegment(positions, v1, v2);
      writeSegment(positions, v2, v0);
    }
  }
  return lines;
}

/** Whole triangles in a geometry, indexed or not. */
function trianglesIn(geometry: THREE.BufferGeometry): number {
  const vertexCount = geometry.getIndex()?.count ?? geometry.getAttribute('position').count;
  return Math.floor(vertexCount / VERTICES_PER_TRIANGLE);
}
