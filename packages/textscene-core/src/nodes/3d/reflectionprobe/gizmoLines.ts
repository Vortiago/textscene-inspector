/** The lines of the editor gizmo of a ReflectionProbe (`reflection_probe_gizmo_plugin.cpp:149-212`). */

import { aabbEdges, aabbEndpoint, centredAabb, type Aabb } from '../../../godot/math/aabb';
import type { Vector3 } from '../../../godot/math/vector';

const AXES = ['x', 'y', 'z'] as const;

/** Half the length of each segment of the origin cross (`reflection_probe_gizmo_plugin.cpp:193-197`). */
const ORIGIN_CROSS_HALF_LENGTH = 0.25;

interface ReflectionProbeGizmoInput {
  size: Vector3;
  blendDistance: number;
  originOffset: Vector3;
}

/** Flat `xyz` segment ends, in two sets that the gizmo draws at two opacities. */
interface ReflectionProbeGizmoLines {
  /** The blend box edges, then the origin cross. */
  lines: number[];
  /** One segment from each blend box corner to the matching corner of the outer box. */
  internalLines: number[];
}

/**
 * `outer` inset by the blend distance (`:160-169`). An axis that the inset would invert collapses
 * onto the centre of `outer`, with size 0.
 */
function blendBox(outer: Aabb, blendDistance: number): Aabb {
  const position = { ...outer.position };
  const size = { ...outer.size };
  for (const axis of AXES) {
    position[axis] = outer.position[axis] + blendDistance;
    size[axis] = outer.size[axis] - blendDistance * 2;
    if (size[axis] < position[axis]) {
      position[axis] = outer.position[axis] + outer.size[axis] / 2;
      size[axis] = 0;
    }
  }
  return { position, size };
}

/** Three segments centred on `offset`, one along each axis (`:190-199`). */
function originCross(offset: Vector3): number[] {
  return AXES.flatMap((axis) => {
    const start = { ...offset };
    const end = { ...offset };
    start[axis] -= ORIGIN_CROSS_HALF_LENGTH;
    end[axis] += ORIGIN_CROSS_HALF_LENGTH;
    return [start.x, start.y, start.z, end.x, end.y, end.z];
  });
}

/**
 * The lines of a probe of `size`, centred on the node. Godot draws no edge of the outer box. It
 * draws the blend box and the lines to the outer corners only for a blend distance that is not 0
 * (`:172`), and the origin cross only for an origin offset that is not 0 (`:190`).
 */
export function reflectionProbeGizmoLines({
  size,
  blendDistance,
  originOffset,
}: ReflectionProbeGizmoInput): ReflectionProbeGizmoLines {
  const outer = centredAabb(size);
  const hasOrigin = originOffset.x !== 0 || originOffset.y !== 0 || originOffset.z !== 0;
  const lines: number[] = [];
  const internalLines: number[] = [];
  if (blendDistance !== 0) {
    const blend = blendBox(outer, blendDistance);
    lines.push(...aabbEdges(blend));
    for (let corner = 0; corner < 8; corner++) {
      const inner = aabbEndpoint(blend, corner);
      const far = aabbEndpoint(outer, corner);
      internalLines.push(inner.x, inner.y, inner.z, far.x, far.y, far.z);
    }
  }
  if (hasOrigin) lines.push(...originCross(originOffset));
  return { lines, internalLines };
}
