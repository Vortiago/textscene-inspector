/**
 * The unit circle point a round PrimitiveMesh's `create_mesh_array` puts at column `i` of
 * `segments`: SphereMesh, CapsuleMesh, CylinderMesh and TubeTrailMesh each turn it onto their own
 * axes.
 */

import { TAU } from '../../../godot/math/math.js';
import { storedReal } from '../../../godot/math/real.js';

/**
 * `[sin, cos]` of column `i`'s angle. The seam column closes on `(0, 1)` exactly. Godot holds the
 * fraction and the point in a `float`, so each rounds to single precision.
 */
export function rimPoint(i: number, segments: number): [number, number] {
  if (i === segments) return [0, 1];
  const angle = storedReal(i / segments) * TAU;
  return [storedReal(Math.sin(angle)), storedReal(Math.cos(angle))];
}

/** Column `i` of every ring: its point on the unit circle, and its U. */
export interface RimColumn {
  x: number;
  z: number;
  u: number;
}

/**
 * Each column from 0 to `segments`, the seam included. Every ring and cap repeats the columns, so a
 * builder computes them once.
 */
export function rimColumns(segments: number): RimColumn[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const [x, z] = rimPoint(i, segments);
    return { x, z, u: storedReal(i / segments) };
  });
}
