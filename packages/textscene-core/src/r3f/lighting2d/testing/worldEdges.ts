/** Test casters in world space, for occluders under an unrotated transform. */

import {
  OCCLUDER_CULL_DISABLED,
  type OccluderCullMode,
  type Quad2,
  type ShadowCasterEdges,
} from '../shadowVolumes';

/** The axis-aligned box around `segments`: the local bounds of an occluder with no rotation. */
export function axisAlignedBounds(segments: ArrayLike<number>): Quad2 {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < segments.length; i += 2) {
    minX = Math.min(minX, segments[i]!);
    maxX = Math.max(maxX, segments[i]!);
    minY = Math.min(minY, segments[i + 1]!);
    maxY = Math.max(maxY, segments[i + 1]!);
  }
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/** World `[ax,ay, bx,by, …]` edges of an unrotated occluder, its bounds around them. */
export function worldEdges(
  segments: ArrayLike<number>,
  cullMode: OccluderCullMode = OCCLUDER_CULL_DISABLED
): ShadowCasterEdges {
  return { segments, cullMode, bounds: axisAlignedBounds(segments) };
}
