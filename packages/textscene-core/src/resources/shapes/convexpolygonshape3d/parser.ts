/** ConvexPolygonShape3D collision-shape resource parser. */

import { parsePackedVector3Array } from '../packedArray';

export interface ConvexPolygonShape3DProperties {
  /** Flat [x,y,z, x,y,z, ...] hull point cloud; build a ConvexGeometry from it. */
  points: Float32Array;
}

export function parseConvexPolygonShape3D(
  properties: Record<string, string>
): ConvexPolygonShape3DProperties {
  const raw = properties.points;
  const points = raw ? parsePackedVector3Array(raw) : new Float32Array(0);
  return { points };
}
