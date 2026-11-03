/**
 * The `get_aabb` of a Godot node that draws no geometry of that size, such as a Decal or a
 * ReflectionProbe: the selection and hover boxes of the node take it. It mounts an object that
 * draws nothing, in the space of the node.
 */

import { useMemo } from 'react';
import type { Aabb } from '../../godot/math/aabb';
import { godotAabbUserData } from '../bounds';

/** @canonical Give a node the `get_aabb` its selection and hover boxes take */
export function NodeAabb({ aabb }: { aabb: Aabb }) {
  const userData = useMemo(() => godotAabbUserData(aabb), [aabb]);
  return <object3D userData={userData} />;
}
