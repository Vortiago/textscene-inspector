/**
 * The Skeleton3D scene pass. A MeshInstance3D that names a Skeleton3D through `skeleton`, and sets
 * no `skin`, binds to the automatic skin of that skeleton (`MeshInstance3D::_resolve_skeleton_path`,
 * `mesh_instance_3d.cpp:175-199`). The component cannot reach the skeleton, so this pass poses each
 * skeleton once and hands the mesh its skin matrices by its live path. It runs on the live stage
 * (ADR-0060), as Godot resolves the path on the live tree, across an instance border too. The
 * SkeletonModifier3D children of the skeleton edit the pose first, in child order.
 */

import type { TscnNode } from '../../../parser/types.js';
import { identityTransform3D, sameTransform3D, type Transform3D } from '../../../godot/math/transform3d.js';
import { resolveNodePathLiteral } from '../../../godot/string/nodePath.js';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { liveGlobalTransform3D } from '../../../r3f/liveGlobalTransform.js';
import { uniquePathsOfLiteral } from '../../../r3f/nodePathUniqueNames.js';
import { liveNodePatches } from '../../../r3f/liveNodePatches.js';
import { liveScenePassResults } from '../../../r3f/liveScenePass.js';
import type { NodePatches } from '../../../r3f/nodePatch.js';
import { sameElements } from '../../../utils/sameElements.js';
import { perObject } from '../../../utils/perObject.js';
import type { MeshInstance3DProperties } from '../meshinstance3d/types.js';
import { automaticSkinMatrices, type PoseModifier } from './skeletonPose.js';
import type { Skeleton3DProperties } from './types.js';

/**
 * The skin matrices of every MeshInstance3D in `tree` bound to a Skeleton3D, by the mesh's live
 * path. A node that writes no `skeleton` binds nothing, as Godot's default is empty unless the
 * project turns on `default_parent_skeleton_in_mesh_instance_3d` (`mesh_instance_3d.cpp:937`). A
 * path that is empty, absolute, resolves to no node, or names a node that is not a Skeleton3D binds
 * nothing, and so does a node with a `skin`, which this pass does not read.
 */
export function bindMeshesToSkeletons(tree: LiveTree): ReadonlyMap<string, readonly Transform3D[]> {
  const skins = new Map<string, readonly Transform3D[]>();
  const skeletonSkins = new Map<string, readonly Transform3D[]>();
  tree.fold<void, void>(undefined, ({ step, path }, _, descend) => {
    const skin = boundSkinOf(step.node, path, tree, skeletonSkins);
    if (skin) skins.set(path, skin);
    descend();
  });
  return skins;
}

/** Whether a MeshInstance3D with `properties` can bind a skeleton: it names one and sets no `skin`. */
export function namesSkeletonToBind(
  properties: MeshInstance3DProperties
): properties is MeshInstance3DProperties & { skeleton: string } {
  return properties.skin === undefined && properties.skeleton !== undefined;
}

/** The skin of the node at `path` where it is a MeshInstance3D bound to a Skeleton3D, else undefined. */
function boundSkinOf(
  node: TscnNode,
  path: string,
  tree: LiveTree,
  skeletonSkins: Map<string, readonly Transform3D[]>
): readonly Transform3D[] | undefined {
  if (node.type !== 'MeshInstance3D') return undefined;
  const properties = node.properties as MeshInstance3DProperties;
  if (!namesSkeletonToBind(properties)) return undefined;
  const skeletonPath = resolveNodePathLiteral(
    path,
    properties.skeleton,
    uniquePathsOfLiteral(properties.skeleton, path, tree)
  );
  const skeleton = skeletonPath === null ? null : tree.at(skeletonPath);
  if (skeleton?.step.node.type !== 'Skeleton3D') return undefined;
  const known = skeletonSkins.get(skeleton.path);
  if (known) return known;
  const skin = skinOf(skeleton, tree);
  skeletonSkins.set(skeleton.path, skin);
  return skin;
}

/** The pose edit of each SkeletonModifier3D child of `skeleton` that makes one, in child order. */
function modifiersOf(skeleton: LiveLink, tree: LiveTree): PoseModifier[] {
  const modifiers: PoseModifier[] = [];
  // Where the nodes stand once a RemoteTransform has moved them, as a modifier reads them.
  const placed = liveScenePassResults(liveNodePatches, tree);
  let skeletonGlobal: Transform3D | undefined;
  tree.fold<void, void>(
    undefined,
    ({ step, path }) => {
      const reader = nodeComponentRegistry.poseModifierOf(step.node.type);
      if (!reader) return;
      skeletonGlobal ??= liveGlobalTransform3D(tree, skeleton.path, placed) ?? identityTransform3D();
      const edit = reader(step.node, {
        skeletonGlobal,
        nodeGlobal: (target) => referenceNodeGlobal(tree, placed, path, target),
      });
      if (edit) modifiers.push(edit);
    },
    skeleton
  );
  return modifiers;
}

/** The global transform of the Node3D that `target` names from the modifier at `modifierPath`. */
function referenceNodeGlobal(
  tree: LiveTree,
  placed: NodePatches,
  modifierPath: string,
  target: string
): Transform3D | null {
  const resolved = resolveNodePathLiteral(
    modifierPath,
    target,
    uniquePathsOfLiteral(target, modifierPath, tree)
  );
  return resolved === null ? null : liveGlobalTransform3D(tree, resolved, placed);
}

/**
 * One skin for each Skeleton3D node with no modifier child, shared by every mesh bound to it. A
 * load that leaves the node as it is hands back the same skin, so a bound mesh does not draw again.
 */
const automaticSkinOf = perObject((skeleton: TscnNode): readonly Transform3D[] => {
  const { bones, showRestOnly } = skeleton.properties as Skeleton3DProperties;
  return automaticSkinMatrices(bones, showRestOnly);
});

/**
 * Written only by `skinOf`: the previous skin of each Skeleton3D node with a modifier child, at each
 * live path. A modifier reads the scene around the skeleton, so two instances of one node pose
 * differently. The entries clear when nothing holds the node any more.
 */
const keptModifiedSkins = perObject(() => new Map<string, readonly Transform3D[]>());

/** The skin of the Skeleton3D at `skeleton`: the file pose, edited by the modifiers below it. */
function skinOf(skeleton: LiveLink, tree: LiveTree): readonly Transform3D[] {
  const modifiers = modifiersOf(skeleton, tree);
  if (modifiers.length === 0) return automaticSkinOf(skeleton.step.node);
  const { bones, showRestOnly } = skeleton.step.node.properties as Skeleton3DProperties;
  const skin = automaticSkinMatrices(bones, showRestOnly, modifiers);
  const kept = keptModifiedSkins(skeleton.step.node);
  const previous = kept.get(skeleton.path);
  if (previous && sameElements(previous, skin, sameTransform3D)) return previous;
  kept.set(skeleton.path, skin);
  return skin;
}
