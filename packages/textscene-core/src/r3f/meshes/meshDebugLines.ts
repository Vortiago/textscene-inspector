/**
 * The segments of Godot's `Mesh::generate_debug_mesh_lines` (`mesh.cpp:466-501`), which the
 * SoftBody3D gizmo draws: three per triangle, in the order the triangles come.
 */

import type { SurfacedMesh } from './meshContent';
import { geometryDrawsPoints } from '../../resources/meshes/godotSurface';

const FLOATS_PER_VERTEX = 3;
const VERTICES_PER_TRIANGLE = 3;

/**
 * Flat `[x0,y0,z0, x1,y1,z1, …]` segment ends: for each triangle of a triangle part, `v0 → v1`,
 * `v1 → v2` and `v2 → v0`. A shared edge appears once for each triangle that holds it. The geometry
 * stores a triangle as `(v0, v2, v1)`, because three fronts triangles counter-clockwise, so this
 * undoes that swap to give Godot's order. A points part adds none.
 *
 * @canonical A mesh's triangle edges in Godot's order
 */
export function meshDebugLines(mesh: SurfacedMesh): Float32Array {
  const triangleParts = mesh.parts.filter((part) => !geometryDrawsPoints(part.geometry));
  const perPart = triangleParts.map(({ geometry }) => {
    const positions = geometry.getAttribute('position').array;
    const index = geometry.getIndex()?.array;
    const vertexCount = index ? index.length : positions.length / FLOATS_PER_VERTEX;
    const triangleCount = Math.floor(vertexCount / VERTICES_PER_TRIANGLE);
    const lines = new Float32Array(triangleCount * 6 * FLOATS_PER_VERTEX);
    const vertexAt = (slot: number) => (index ? index[slot]! : slot) * FLOATS_PER_VERTEX;
    for (let triangle = 0; triangle < triangleCount; triangle++) {
      const first = triangle * VERTICES_PER_TRIANGLE;
      const corners = [vertexAt(first), vertexAt(first + 2), vertexAt(first + 1)];
      for (let edge = 0; edge < VERTICES_PER_TRIANGLE; edge++) {
        const from = corners[edge]!;
        const to = corners[(edge + 1) % VERTICES_PER_TRIANGLE]!;
        const out = (triangle * 6 + edge * 2) * FLOATS_PER_VERTEX;
        lines.set(positions.subarray(from, from + FLOATS_PER_VERTEX), out);
        lines.set(positions.subarray(to, to + FLOATS_PER_VERTEX), out + FLOATS_PER_VERTEX);
      }
    }
    return lines;
  });
  const joined = new Float32Array(perPart.reduce((total, lines) => total + lines.length, 0));
  let offset = 0;
  for (const lines of perPart) {
    joined.set(lines, offset);
    offset += lines.length;
  }
  return joined;
}
