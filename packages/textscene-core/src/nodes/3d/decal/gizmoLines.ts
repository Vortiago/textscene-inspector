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
const EDGE_COUNT = 12;

type Point = [number, number, number];

/** `Vector3::lerp` (`core/math/vector3.h`). */
function lerpPoint(from: Point, to: Point, weight: number): Point {
  return [lerp(from[0], to[0], weight), lerp(from[1], to[1], weight), lerp(from[2], to[2], weight)];
}

/** The box edges, each from the least corner of `size` to its far corner, in the order of `AABB::get_edge`. */
function boxEdges(size: Vector3): number[][] {
  const flat = aabbEdges(centredAabb(size));
  return Array.from({ length: EDGE_COUNT }, (_, edge) =>
    flat.slice(edge * FLOATS_PER_EDGE, (edge + 1) * FLOATS_PER_EDGE)
  );
}

/**
 * The segments of a box of `size` centred on the node: each edge of equal y in full, each vertical
 * edge as two stubs, and a tick from the top face along +Y.
 */
export function decalGizmoLines(size: Vector3): Float32Array {
  const lines: number[] = [];
  for (const edge of boxEdges(size)) {
    const start = edge.slice(0, FLOATS_PER_POINT) as Point;
    const end = edge.slice(FLOATS_PER_POINT) as Point;
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
