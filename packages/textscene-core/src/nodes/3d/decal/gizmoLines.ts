/** The lines of the editor gizmo of a Decal (`decal_gizmo_plugin.cpp:92-128`), in the decal's local space. */

import { aabbEdges, centredAabb } from '../../../godot/math/aabb';
import { lerp } from '../../../godot/math/math';
import type { Vector3 } from '../../../godot/math/vector';

/** The share of a vertical edge that each of its two stubs covers (`:111-114`). */
const STUB_SHARE = 0.2;

/** The tick above the top face ends at this multiple of the half height (`:122`). */
const TICK_REACH = 1.2;

const FLOATS_PER_POINT = 3;
const FLOATS_PER_EDGE = 2 * FLOATS_PER_POINT;

/** `Vector3::lerp` (`core/math/vector3.h`) on a point's three floats. */
function lerpPoint(from: number[], to: number[], weight: number): number[] {
  return from.map((value, axis) => lerp(value, to[axis]!, weight));
}

/**
 * The segments of a box of `size` centred on the node: each edge of equal y in full, each vertical
 * edge as two stubs, and a tick from the top face along +Y.
 */
export function decalGizmoLines(size: Vector3): Float32Array {
  const edges = aabbEdges(centredAabb(size));
  const lines: number[] = [];
  for (let edge = 0; edge < edges.length; edge += FLOATS_PER_EDGE) {
    const start = edges.slice(edge, edge + FLOATS_PER_POINT);
    const end = edges.slice(edge + FLOATS_PER_POINT, edge + FLOATS_PER_EDGE);
    if (start[1] === end[1]) {
      lines.push(...start, ...end);
    } else {
      lines.push(
        ...start,
        ...lerpPoint(start, end, STUB_SHARE),
        ...end,
        ...lerpPoint(end, start, STUB_SHARE)
      );
    }
  }
  const halfHeight = size.y / 2;
  lines.push(0, halfHeight, 0, 0, halfHeight * TICK_REACH, 0);
  return new Float32Array(lines);
}
