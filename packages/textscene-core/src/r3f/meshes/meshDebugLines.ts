/**
 * The segments of Godot's `Mesh::generate_debug_mesh_lines` (`mesh.cpp:466-501`), which the
 * SoftBody3D gizmo draws: three per triangle, in the order the triangles come.
 */

import type { SurfacedMesh } from './meshContent';
import { geometryDrawsPoints, godotTriangleVertices } from '../../resources/meshes/godotSurface';

const FLOATS_PER_VERTEX = 3;
/** Three segments, two vertices each. */
const FLOATS_PER_TRIANGLE_EDGES = 6 * FLOATS_PER_VERTEX;

/**
 * Flat `[x0,y0,z0, x1,y1,z1, …]` segment ends: for each triangle of a triangle part, `v0 → v1`,
 * `v1 → v2` and `v2 → v0`. A shared edge appears once for each triangle that holds it. A points
 * part adds none.
 *
 * @canonical A mesh's triangle edges in Godot's order
 */
export function meshDebugLines(mesh: SurfacedMesh): Float32Array {
  const triangles = mesh.parts
    .filter((part) => !geometryDrawsPoints(part.geometry))
    .map(({ geometry }) => ({
      positions: geometry.getAttribute('position').array,
      vertices: godotTriangleVertices(geometry),
    }));
  const vertexTotal = triangles.reduce((total, { vertices }) => total + vertices.length, 0);
  const lines = new Float32Array((vertexTotal / 3) * FLOATS_PER_TRIANGLE_EDGES);
  let written = 0;
  const writeSegment = (positions: ArrayLike<number>, from: number, to: number) => {
    for (let i = 0; i < FLOATS_PER_VERTEX; i++) lines[written++] = positions[from * FLOATS_PER_VERTEX + i]!;
    for (let i = 0; i < FLOATS_PER_VERTEX; i++) lines[written++] = positions[to * FLOATS_PER_VERTEX + i]!;
  };
  for (const { positions, vertices } of triangles) {
    for (let slot = 0; slot < vertices.length; slot += 3) {
      const [v0, v1, v2] = [vertices[slot]!, vertices[slot + 1]!, vertices[slot + 2]!];
      writeSegment(positions, v0, v1);
      writeSegment(positions, v1, v2);
      writeSegment(positions, v2, v0);
    }
  }
  return lines;
}
