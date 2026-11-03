/**
 * The bounds Godot frames a GeometryInstance3D on, for a node that draws nothing of that size. The
 * `--frame` camera unions `global_transform * get_aabb()` of every such node, so a node with an
 * empty AABB still adds a point at its origin (`AABB()` is the empty box at the origin). The
 * object draws nothing and joins no selection box: only `frameSceneBounds.ts` reads it.
 */

import { useMemo } from 'react';
import type { Aabb } from '../../godot/math/aabb';
import { EMPTY_AABB } from '../../godot/math/aabb';
import { frameAabbUserData } from '../bounds';

/** @canonical Give a node the `get_aabb` the camera frames it on, in the node's space */
export function FrameAabb({ aabb }: { aabb: Aabb }) {
  const userData = useMemo(() => frameAabbUserData(aabb), [aabb]);
  return <object3D userData={userData} />;
}

/** The point at the node origin that a node with `get_aabb() == AABB()` frames as. */
export function FramePoint() {
  return <FrameAabb aabb={EMPTY_AABB} />;
}
