/**
 * The nodes the NodePaths of a modification stack name, read from the Live scene tree: the place of
 * each in the rig of its skeleton. The drawn pose and the live solve both start from them.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import type { LiveTree } from '../../../r3f/liveSceneTree.js';
import { resolveLiteralOnLiveTree } from '../../../r3f/nodePathUniqueNames.js';
import { parentPathOf } from '../../../utils/nodePath.js';
import type { StackTarget } from './skeletonPose.js';
import { boneReachAt, skeletonOfBone, type Skeleton2DRig } from './skeletonRig.js';

/** The index of the nearest bone above the node at `path`, or -1 for a node below no bone. */
function carrierOf(path: string, bones: ReadonlyMap<string, number> | undefined): number {
  for (let above = parentPathOf(path); above !== null; above = parentPathOf(above)) {
    const index = bones?.get(above);
    if (index !== undefined) return index;
  }
  return -1;
}

/** `Bone2D::get_index_in_skeleton()` of the Bone2D at `path`: -1 for a bone that joins no skeleton. */
function indexInSkeletonOf(path: string, tree: LiveTree, rigs: ReadonlyMap<string, Skeleton2DRig>): number {
  const skeleton = skeletonOfBone(path, tree);
  return (skeleton === null ? undefined : rigs.get(skeleton)?.indexOf.get(path)) ?? -1;
}

/**
 * The node each NodePath literal of `literals` resolves to from the skeleton at `skeletonPath`, by
 * that literal. A literal that names no node has no entry.
 */
export function stackTargets(
  literals: readonly string[],
  skeletonPath: string,
  tree: LiveTree,
  rigs: ReadonlyMap<string, Skeleton2DRig>
): Map<string, StackTarget> {
  const bones = rigs.get(skeletonPath)?.indexOf;
  const targets = new Map<string, StackTarget>();
  for (const literal of literals) {
    const path = resolveLiteralOnLiveTree(skeletonPath, literal, tree);
    const link = path === null ? null : tree.at(path);
    if (path === null || link === null) continue;
    const { type } = link.step.node;
    const isBone = type === 'Bone2D';
    const boneIndex = bones?.get(path) ?? -1;
    targets.set(literal, {
      path,
      isNode2D: descendsFromClass(type, 'Node2D'),
      boneIndex,
      indexInSkeleton: isBone ? indexInSkeletonOf(path, tree, rigs) : null,
      carrier: carrierOf(path, bones),
      outsideBone:
        isBone && boneIndex < 0 ? { parentPath: parentPathOf(path), reach: boneReachAt(link, tree) } : null,
    });
  }
  return targets;
}

/**
 * The live paths of the Node2Ds a solve reads that are no bone of its skeleton: the nodes the stack
 * names, and the node above each outside bone. Each path once.
 */
export function anchorPathsOf(targets: Iterable<StackTarget>): string[] {
  const all = [...targets];
  const named = all.filter(({ isNode2D, boneIndex }) => isNode2D && boneIndex < 0);
  const abovePaths = all.flatMap(({ outsideBone }) => outsideBone?.parentPath ?? []);
  return [...new Set([...named.map(({ path }) => path), ...abovePaths])];
}
