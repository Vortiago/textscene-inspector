/**
 * The Skeleton2D rig pass: the bones of each Skeleton2D of the Live scene tree, in the order the
 * skeleton indexes them, each with its parent, its bind pose and its reach
 * (`skeleton_2d.cpp:548-570`). The pose, the Polygon skin and the Bone2D kites read the one rig.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  affineInverseTransform2D,
  multiplyTransform2D,
  transform2DDeterminant,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { parentPathOf } from '../../../utils/nodePath.js';
import { keptPerLivePath } from '../../../r3f/keptPerLivePath.js';
import { sameData } from '../../../utils/sameData.js';
import { boneReachOf, type BoneReach } from '../bone2d/boneReach.js';
import type { Bone2DProperties } from '../bone2d/types.js';

/** One bone of a Skeleton2D. */
export interface Skeleton2DBone {
  /** The live path of the Bone2D. */
  path: string;
  /** The index of its parent bone, or -1 for a bone on the skeleton itself. */
  parent: number;
  /** The inverse of `get_skeleton_rest`, the rests composed from the skeleton down. */
  restInverse: Transform2DColumns;
  /** `get_length` and `get_bone_angle`, as the bone holds them once it is ready. */
  reach: BoneReach;
}

/** The bones of one Skeleton2D, by skeleton index. */
export interface Skeleton2DRig {
  bones: readonly Skeleton2DBone[];
  /** The skeleton index of each bone, by its live path. */
  indexOf: ReadonlyMap<string, number>;
}

/**
 * The rig of each Skeleton2D in `tree`, by the live path of the skeleton.
 *
 * @canonical The bones of a Skeleton2D on the Live scene tree
 */
export function bindSkeleton2DRigs(tree: LiveTree): ReadonlyMap<string, Skeleton2DRig> {
  const rigs = new Map<string, Skeleton2DRig>();
  tree.fold<void, void>(undefined, (link, _inherited, descend) => {
    if (link.step.node.type === 'Skeleton2D')
      rigs.set(link.path, kept(link.step.node, link.path, rigOf(link, tree)));
    descend();
  });
  return rigs;
}

/** What a bone hands the bones below it. */
interface ParentBone {
  index: number;
  skeletonRest: Transform2DColumns;
}

/**
 * The Bone2Ds that join `skeleton`, in tree order, as `bones.sort()` orders them
 * (`skeleton_2d.cpp:557`). A Bone2D joins the nearest Skeleton2D above it through Bone2D parents
 * only (`skeleton_2d.cpp:101-117`), so a node of another type ends the chain.
 */
function rigOf(skeleton: LiveLink, tree: LiveTree): Skeleton2DRig {
  const bones: Skeleton2DBone[] = [];
  tree.fold<ParentBone | null, void>(
    null,
    (link, parent, descend) => {
      if (link.step.node.type !== 'Bone2D') return;
      const props = link.step.node.properties as Bone2DProperties;
      const skeletonRest = parent ? multiplyTransform2D(parent.skeletonRest, props.rest) : props.rest;
      const index = bones.length;
      bones.push({
        path: link.path,
        parent: parent?.index ?? -1,
        restInverse: bindInverse(skeletonRest),
        reach: boneReachAt(link, tree),
      });
      descend({ index, skeletonRest });
    },
    skeleton
  );
  return { bones, indexOf: new Map(bones.map((bone, index) => [bone.path, index])) };
}

/** `get_length` and `get_bone_angle` of the Bone2D at `bone`, in a skeleton or in none. */
export function boneReachAt(bone: LiveLink, tree: LiveTree): BoneReach {
  return boneReachOf(bone.step.node.properties as Bone2DProperties, firstBoneChildPosition(bone, tree));
}

/** The position of the first Bone2D child of `bone` in its space, or null where it has none. */
function firstBoneChildPosition(bone: LiveLink, tree: LiveTree): { x: number; y: number } | null {
  const positions = tree.fold<void, { x: number; y: number } | null>(
    undefined,
    ({ step }) => (step.node.type === 'Bone2D' ? (step.node.properties as Bone2DProperties).position : null),
    bone
  );
  return positions.find((position) => position !== null) ?? null;
}

/** A rig holds a map beside its bones, so the bones alone tell two rigs apart. */
const kept = keptPerLivePath<Skeleton2DRig>((previous, rig) => sameData(previous.bones, rig.bones));

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
  return transform2DDeterminant(rest) === 0 ? rest : affineInverseTransform2D(rest);
}
