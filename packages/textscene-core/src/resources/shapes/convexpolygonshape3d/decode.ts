/** ConvexPolygonShape3D decode: `points` in, a flat hull point cloud out. */

import { parsePackedVector3Array } from '../packedArray';
import { warn } from '../../../logger';
import type { ConvexPolygonShape3DProperties } from './types';

export function decodeConvexPolygonShape3D(
  properties: Record<string, string>
): ConvexPolygonShape3DProperties {
  const raw = properties.points;
  if (!raw) return { points: new Float32Array(0) };
  // Stay lenient: malformed/hand-edited collision data degrades to an empty
  // gizmo instead of throwing through the render tree (this decode is called
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
