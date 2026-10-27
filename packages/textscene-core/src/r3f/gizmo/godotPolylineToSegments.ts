/**
 * Line-segment positions of a Godot polyline gizmo, for the local space of a Node2D group: the
 * segments of a polygon outline or a path, ready for `<GizmoLine>`.
 */

import { writeGodotPointAsThree } from '../node2dTransform';
import { FLOATS_PER_VERTEX } from './axisCross';

/**
 * A flat `PackedVector2Array` `[x0,y0, x1,y1, …]` as flat `[ax,ay,0, bx,by,0, …]`
 * segment positions: N segments when `closed` (vN-1→v0 wraps), N-1 when open.
 * A dangling odd coordinate is ignored, not read as NaN. Null for fewer than 2
 * whole points.
 */
export function godotPolylineToSegments(points: ArrayLike<number>, closed: boolean): Float32Array | null {
  const n = Math.floor(points.length / 2);
  if (n < 2) return null;

  const segCount = closed ? n : n - 1;
  const out = new Float32Array(segCount * 2 * FLOATS_PER_VERTEX);

  for (let i = 0; i < segCount; i++) {
    // Open (segCount = n-1), i+1 is always < n, so the modulo covers both the
    // closed wrap and the open chain.
    const j = (i + 1) % n;
    const o = i * 2 * FLOATS_PER_VERTEX;
    writeGodotPointAsThree(out, o, points[i * 2]!, points[i * 2 + 1]!);
    writeGodotPointAsThree(out, o + FLOATS_PER_VERTEX, points[j * 2]!, points[j * 2 + 1]!);
  }

  return out;
}
