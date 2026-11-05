/**
 * The bones of a Skeleton2D on the Live scene tree, in the order the skeleton indexes them, each
 * with the inverse of its rest in skeleton space: the bind pose (`skeleton_2d.cpp:548-570`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  affineInverseTransform2D,
  multiplyTransform2D,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { parentPathOf } from '../../../utils/nodePath.js';
import type { Bone2DProperties } from '../bone2d/types.js';

/** One bone of a Skeleton2D. */
export interface Skeleton2DBone {
  /** The live path of the Bone2D. */
  path: string;
  /** The inverse of `get_skeleton_rest`, the rests composed from the skeleton down. */
  restInverse: Transform2DColumns;
}

/**
 * The Bone2Ds that join `skeleton`, in tree order, as `bones.sort()` orders them
 * (`skeleton_2d.cpp:557`). A Bone2D joins the nearest Skeleton2D above it through Bone2D parents
 * only (`skeleton_2d.cpp:101-117`), so a node of another type ends the chain.
 */
export function skeleton2DBones(skeleton: LiveLink, tree: LiveTree): Skeleton2DBone[] {
  const bones: Skeleton2DBone[] = [];
  tree.fold<Transform2DColumns | null, void>(
    null,
    ({ step, path }, parentRest, descend) => {
      if (step.node.type !== 'Bone2D') return;
      const { rest } = step.node.properties as Bone2DProperties;
      const skeletonRest = parentRest ? multiplyTransform2D(parentRest, rest) : rest;
      bones.push({ path, restInverse: bindInverse(skeletonRest) });
      descend(skeletonRest);
    },
    skeleton
  );
  return bones;
}

/**
 * The live path of the Skeleton2D the Bone2D at `bonePath` joins, or null where its chain of Bone2D
 * parents ends at another type.
 */
export function skeletonOfBone(bonePath: string, tree: LiveTree): string | null {
  let path = parentPathOf(bonePath);
  while (path !== null) {
    const type = tree.at(path)?.step.node.type;
    if (type === 'Skeleton2D') return path;
    if (type !== 'Bone2D') return null;
    path = parentPathOf(path);
  }
  return null;
}

/**
 * `affine_inverse` of a rest. A singular rest, such as the unset all-zero one, stays as it is:
 * `ERR_FAIL_COND(det == 0)` returns before it inverts (`transform_2d.cpp:51`).
 */
function bindInverse(rest: Transform2DColumns): Transform2DColumns {
  const determinant = Math.fround(Math.fround(rest.a * rest.d) - Math.fround(rest.b * rest.c));
  return determinant === 0 ? rest : affineInverseTransform2D(rest);
}
