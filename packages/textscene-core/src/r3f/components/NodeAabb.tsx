/**
 * The `get_aabb` of a Godot node that draws no geometry of that size, in the space of the node, as
 * an object that draws nothing. {@link NodeAabb}, for a Decal or a ReflectionProbe, gives the
 * selection and hover boxes of the node its box. {@link FrameAabb} gives the camera the box it
 * frames on, and counts an empty box as the point it is: Godot's `--frame` camera unions
 * `global_transform * get_aabb()` of every GeometryInstance3D, so `AABB()` still adds the node origin.
 */

import { useMemo } from 'react';
import { EMPTY_AABB, type Aabb } from '../../godot/math/aabb';
import { frameAabbUserData, godotAabbUserData } from '../bounds';

const POINT_USER_DATA = frameAabbUserData(EMPTY_AABB);

/** @canonical Give a node the `get_aabb` its selection and hover boxes take */
export function NodeAabb({ aabb }: { aabb: Aabb }) {
  const userData = useMemo(() => godotAabbUserData(aabb), [aabb]);
  return <object3D userData={userData} />;
}

/** Gives a node the `get_aabb` the camera frames it on. Only `frameSceneBounds.ts` reads it. */
export function FrameAabb({ aabb }: { aabb: Aabb }) {
  const userData = useMemo(() => frameAabbUserData(aabb), [aabb]);
  return <object3D userData={userData} />;
}

/** The point at the node origin that a node with `get_aabb() == AABB()` frames as. */
export function FramePoint() {
  return <object3D userData={POINT_USER_DATA} />;
}
