/**
 * The Skeleton3D scene pass. A MeshInstance3D that names a Skeleton3D through `skeleton`, and sets
 * no `skin`, binds to the automatic skin of that skeleton (`MeshInstance3D::_resolve_skeleton_path`,
 * `mesh_instance_3d.cpp:175-199`). The component cannot reach the skeleton, so this pass poses each
 * skeleton once and hands the mesh its skin matrices by its live path. It runs on the live stage
 * (ADR-0060), as Godot resolves the path on the live tree, across an instance border too.
 */

import type { TscnNode } from '../../../parser/types.js';
import type { Transform3D } from '../../../godot/math/transform3d.js';
import { resolveNodePathLiteral, UNIQUE_NODE_PREFIX } from '../../../godot/string/nodePath.js';
import type { LiveTree } from '../../../r3f/liveSceneTree.js';
import { nodePathUniquePaths } from '../../../r3f/nodePathUniqueNames.js';
import { perObject } from '../../../utils/perObject.js';
import type { MeshInstance3DProperties } from '../meshinstance3d/types.js';
import { automaticSkinMatrices } from './skeletonPose.js';
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
  tree.fold<void, void>(undefined, ({ step, path }, _, descend) => {
    const skin = boundSkinOf(step.node, path, tree);
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
function boundSkinOf(node: TscnNode, path: string, tree: LiveTree): readonly Transform3D[] | undefined {
  if (node.type !== 'MeshInstance3D') return undefined;
  const properties = node.properties as MeshInstance3DProperties;
  if (!namesSkeletonToBind(properties)) return undefined;
  // Only a `%Name` segment reads the table, which allocates for each bound mesh on each load.
  const uniquePaths = properties.skeleton.includes(UNIQUE_NODE_PREFIX)
    ? nodePathUniquePaths(path, tree.roots, tree.ctx)
    : undefined;
  const skeletonPath = resolveNodePathLiteral(path, properties.skeleton, uniquePaths);
  const target = skeletonPath === null ? undefined : tree.at(skeletonPath)?.step.node;
  return target?.type === 'Skeleton3D' ? automaticSkinOf(target) : undefined;
}

/**
 * One skin for each Skeleton3D node, shared by every mesh bound to it. A load that leaves the node
 * as it is hands back the same skin, so a bound mesh does not draw again.
 */
const automaticSkinOf = perObject((skeleton: TscnNode): readonly Transform3D[] => {
  const { bones, showRestOnly } = skeleton.properties as Skeleton3DProperties;
  return automaticSkinMatrices(bones, showRestOnly);
});
