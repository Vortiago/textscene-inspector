/** ConvexPolygonShape3D collision-shape resource parser. */

import { parsePackedVector3Array } from '../packedArray';
import { warn } from '../../../logger';

export interface ConvexPolygonShape3DProperties {
  /** Flat [x,y,z, x,y,z, ...] hull point cloud; build a ConvexGeometry from it. */
  points: Float32Array;
}

export function parseConvexPolygonShape3D(
  properties: Record<string, string>
): ConvexPolygonShape3DProperties {
  const raw = properties.points;
  if (!raw) return { points: new Float32Array(0) };
  // Stay lenient: malformed/hand-edited collision data degrades to an empty
  // gizmo instead of throwing through the render tree (this parser is called
  // directly inside CollisionGizmo render, which has no error boundary).
  try {
    return { points: parsePackedVector3Array(raw) };
  } catch (error) {
    warn(
      `Failed to parse ConvexPolygonShape3D points: ${error instanceof Error ? error.message : String(error)}`
    );
    return { points: new Float32Array(0) };
  }
}
