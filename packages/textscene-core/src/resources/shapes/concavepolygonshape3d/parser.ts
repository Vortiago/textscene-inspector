/** ConcavePolygonShape3D collision-shape resource parser. */

import { parsePackedVector3Array } from '../packedArray';

export interface ConcavePolygonShape3DProperties {
  /** Flat [x,y,z, ...] triangle soup (every 3 vertices = 1 face); already triangulated. */
  data: Float32Array;
}

export function parseConcavePolygonShape3D(
  properties: Record<string, string>
): ConcavePolygonShape3DProperties {
  const raw = properties.data;
  const data = raw ? parsePackedVector3Array(raw) : new Float32Array(0);
  return { data };
}
