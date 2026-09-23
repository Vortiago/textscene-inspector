/** ConcavePolygonShape3D decode: `data` in, a flat triangle soup out. */

import { parsePackedVector3Array } from '../packedArray';
import { warn } from '../../../logger';
import type { ConcavePolygonShape3DProperties } from './types';

export function decodeConcavePolygonShape3D(
  properties: Record<string, string>
): ConcavePolygonShape3DProperties {
  const raw = properties.data;
  if (!raw) return { data: new Float32Array(0) };
  // Stay lenient: malformed/hand-edited collision data degrades to an empty
  // gizmo instead of throwing through the render tree (this decode is called
  // directly inside CollisionGizmo render, which has no error boundary).
  try {
    return { data: parsePackedVector3Array(raw) };
  } catch (error) {
    warn(
      `Failed to parse ConcavePolygonShape3D data: ${error instanceof Error ? error.message : String(error)}`
    );
    return { data: new Float32Array(0) };
  }
}
