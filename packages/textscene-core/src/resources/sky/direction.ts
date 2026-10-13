/** The vector products that build a filter's frame around a texel's direction. */

import type { OctDirection } from '../../godot/octmap.js';

const { hypot } = Math;

export function cross(a: OctDirection, b: OctDirection): OctDirection {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function normalize([x, y, z]: OctDirection): OctDirection {
  const length = hypot(x, y, z);
  return [x / length, y / length, z / length];
}
