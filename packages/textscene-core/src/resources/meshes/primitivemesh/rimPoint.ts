/**
 * The unit circle point a round PrimitiveMesh's `create_mesh_array` puts at column `i` of
 * `segments`: SphereMesh, CapsuleMesh and CylinderMesh step it from +Z towards +X.
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
