/** The frame a filter builds around a texel's direction, to turn its taps from frame space to world space. */

import type { OctDirection } from '../../godot/octmap.js';

const { hypot } = Math;

/** A frame axis, written in place, so a filter allocates nothing per texel. */
export type Axis = Float64Array;

/**
 * Writes `normalize(cross(up, normal))` to `x` and `cross(normal, x)` to `y`, the frame
 * `octmap_roughness.glsl:66-69` and `octmap_filter.glsl:113-114` build. `normal` is the frame's z.
 */
export function frameAround(up: OctDirection, normal: OctDirection, x: Axis, y: Axis): void {
  const cx = up[1] * normal[2] - up[2] * normal[1];
  const cy = up[2] * normal[0] - up[0] * normal[2];
  const cz = up[0] * normal[1] - up[1] * normal[0];
  const length = hypot(cx, cy, cz);
  x[0] = cx / length;
  x[1] = cy / length;
  x[2] = cz / length;
  y[0] = normal[1] * x[2]! - normal[2] * x[1]!;
  y[1] = normal[2] * x[0]! - normal[0] * x[2]!;
  y[2] = normal[0] * x[1]! - normal[1] * x[0]!;
}
