import { intOr } from '../../../parser/valueParsers';
import {
  OCCLUDER_CULL_COUNTER_CLOCKWISE,
  OCCLUDER_CULL_DISABLED,
  type OccluderCullMode,
} from '../../../r3f/lighting2d/shadowVolumes';

/**
 * A flat `PackedVector2Array` `[x0,y0, x1,y1, …]` as flat `[ax,ay,0, bx,by,0, …]`
 * segment positions: N segments when `closed` (vN-1→v0 wraps), N-1 when open.
 * A dangling odd coordinate is ignored, not read as NaN. Null for fewer than 2
 * whole points.
 */
export function polygonToSegments(points: ArrayLike<number>, closed: boolean): Float32Array | null {
  const n = Math.floor(points.length / 2);
  if (n < 2) return null;

  const segCount = closed ? n : n - 1;
  const out = new Float32Array(segCount * 2 * 3);

  for (let i = 0; i < segCount; i++) {
    // Open (segCount = n-1), i+1 is always < n, so the modulo covers both the
    // closed wrap and the open chain.
    const j = (i + 1) % n;
    const o = i * 6;
    // Godot Y is down. Three Y is up → negate. `0 - v` (not `-v`) keeps a zero
    // input at +0, matching the repo's node2dTransform / navigationOverlay idiom.
    out[o] = points[i * 2]!;
    out[o + 1] = 0 - points[i * 2 + 1]!;
    out[o + 2] = 0;
    out[o + 3] = points[j * 2]!;
    out[o + 4] = 0 - points[j * 2 + 1]!;
    out[o + 5] = 0;
  }

  return out;
}

/**
 * `OccluderPolygon2D.cull_mode` from the raw sub-resource property, a bare enum
 * ordinal. Anything outside 0..2 falls back to Godot's default CULL_DISABLED,
 * which casts from every edge, so a garbled value still shadows.
 */
export function parseOccluderCullMode(raw: string | undefined): OccluderCullMode {
  const value = intOr(raw, OCCLUDER_CULL_DISABLED, 'OccluderPolygon2D.cull_mode');
  return value >= OCCLUDER_CULL_DISABLED && value <= OCCLUDER_CULL_COUNTER_CLOCKWISE
    ? (value as OccluderCullMode)
    : OCCLUDER_CULL_DISABLED;
}
