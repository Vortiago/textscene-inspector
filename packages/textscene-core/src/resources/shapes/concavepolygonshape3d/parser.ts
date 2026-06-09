/** ConcavePolygonShape3D collision-shape resource parser. */

import { parsePackedVector3Array } from '../packedArray';
import { warn } from '../../../logger';

export interface ConcavePolygonShape3DProperties {
  /** Flat [x,y,z, ...] triangle soup (every 3 vertices = 1 face); already triangulated. */
  data: Float32Array;
}

export function parseConcavePolygonShape3D(
  properties: Record<string, string>
): ConcavePolygonShape3DProperties {
  const raw = properties.data;
  if (!raw) return { data: new Float32Array(0) };
  // Stay lenient: malformed/hand-edited collision data degrades to an empty
  // gizmo instead of throwing through the render tree (this parser is called
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
