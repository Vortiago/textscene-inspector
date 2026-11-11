/**
 * The bones a modification stack moves, solved on the Live scene tree. A scene pass that reads a
 * transform below a bone (a RemoteTransform2D, a Camera2D in the Cameras panel) stands where Godot's
 * Skeleton2D has put the bone, which the render shows through {@link Skeleton2DPose}. The solve
 * starts from the transforms the scene file stores, so an AnimationPlayer's pose does not reach it,
 * and it reads a stack that sits in the scene file, not one in a `.tres` file.
 */

import { equalTransform2D, transform2DDecompose } from '../../../godot/math/transform2d.js';
import { storedTransform2D } from '../../../godot/math/real.js';
import { decodeModificationStack } from '../../../resources/skeleton/skeletonmodificationstack2d/index.js';
import { liveScenePassResults, type LiveScenePass } from '../../../r3f/liveScenePass.js';
import type { TscnNode } from '../../../parser/types.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { nodesOnTheWayTo } from '../../../r3f/liveGlobalTransform.js';
import { transform2DOnCanvas, transform2DWithin } from '../../../r3f/liveTransform2D.js';
import { NO_PATCHES, type NodePatch } from '../../../r3f/nodePatch.js';
import { parentPathOf } from '../../../utils/nodePath.js';
import { buildStackScene, type PoseSource } from './buildStackScene.js';
import { solveStack } from './modificationStack/stackRun.js';
import { stackNodePaths } from './modificationStack/stackPaths.js';
import { bindSkeleton2DRigs, type Skeleton2DRig } from './skeletonRig.js';
import type { Skeleton2DProperties } from './types.js';
import { anchorPathsOf, stackTargets } from './stackTargets.js';

/** A stack in the scene file needs no other file, and a stack in one is not read here. */
const NO_FILES = (): undefined => undefined;

/** Where the nodes of `tree` stand as the scene file stores them, each named by its live path. */
function storedPoseSource(tree: LiveTree): PoseSource<string> {
  const chains = new Map<string, ReadonlyMap<string, TscnNode>>();
  const stored = (path: string) => {
    if (!chains.has(path)) chains.set(path, nodesOnTheWayTo(tree, path, NO_PATCHES));
    return chains.get(path)!;
  };
  return {
    canvas: (path) => storedTransform2D(transform2DOnCanvas(path, stored(path))),
    within: (path, ancestor) => storedTransform2D(transform2DWithin(path, ancestor, stored(path))),
    parent: parentPathOf,
  };
}

/**
 * The node patch of each Bone2D, by live path, that the stack of a Skeleton2D of `tree` moves:
 * the position, rotation, scale and skew of the solved local transform, as `Node2D::set_transform`
 * stores them. A bone the stack leaves where it is has no entry.
 */
export const solveSkeleton2DBones: LiveScenePass<NodePatch> = (tree) => {
  const patches = new Map<string, NodePatch>();
  const rigs = liveScenePassResults(bindSkeleton2DRigs, tree);
  tree.fold<void, void>(undefined, (link, _inherited, descend) => {
    if (link.step.node.type === 'Skeleton2D') solveSkeleton(link, tree, rigs, patches);
    descend();
  });
  return patches;
};

function solveSkeleton(
  { path, step }: LiveLink,
  tree: LiveTree,
  rigs: ReadonlyMap<string, Skeleton2DRig>,
  patches: Map<string, NodePatch>
): void {
  const { modificationStack } = step.node.properties as Skeleton2DProperties;
  if (modificationStack === undefined) return;
  const rig = rigs.get(path);
  const stack = decodeModificationStack(modificationStack, step.scope, NO_FILES);
  if (!rig || !stack) return;
  const targets = stackTargets(stackNodePaths(stack), path, tree, rigs);
  const anchors = new Set(anchorPathsOf(targets.values()));
  const bodies = [path, ...rig.bones.map((bone) => bone.path)];
  const { scene, posed } = buildStackScene(
    targets,
    rig,
    bodies,
    (anchor) => (anchors.has(anchor) ? anchor : undefined),
    storedPoseSource(tree)
  );
  const cache = posed.slice(0, rig.bones.length).map(({ from }) => from);
  const { locals } = solveStack(scene, cache, stack);
  posed.forEach(({ node, from }, index) => {
    if (!equalTransform2D(from, locals[index]!)) patches.set(node, transform2DDecompose(locals[index]!));
  });
}
