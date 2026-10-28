/**
 * The Skeleton3D scene pass. A MeshInstance3D that names a Skeleton3D through `skeleton`, and sets
 * no `skin`, binds to the automatic skin of that skeleton (`MeshInstance3D::_resolve_skeleton_path`,
 * `mesh_instance_3d.cpp:175-199`). The component cannot reach the skeleton, so this pass poses each
 * skeleton once and hands the mesh its skin matrices, as `applyRemoteTransforms` hands its target a
 * transform. It runs once per parse, after the transform passes.
 */

import type { TscnNode } from '../../../parser/types.js';
import type { Transform3D } from '../../../godot/math/transform3d.js';
import { resolveNodePathLiteral } from '../../../godot/string/nodePath.js';
import { nodesByPath } from '../../../utils/nodePath.js';
import { uniqueNamePaths } from '../../../utils/uniqueNames.js';
import type { MeshInstance3DProperties } from '../meshinstance3d/types.js';
import { poseSkeleton } from './skeletonPose.js';
import type { Skeleton3DProperties } from './types.js';

/**
 * Sets `skinMatrices` on every MeshInstance3D bound to a Skeleton3D in `nodes`, mutating each in
 * place, and returns the same array. A node that writes no `skeleton` binds nothing, as Godot's
 * default is empty unless the project turns on `default_parent_skeleton_in_mesh_instance_3d`
 * (`mesh_instance_3d.cpp:937`). A path that is empty, resolves to no node, or names a node that is
 * not a Skeleton3D binds nothing, and so does a node with a `skin`, which this pass does not read.
 * A path into an instanced scene or from the live SceneTree stays unresolved, as in the other passes.
 * Idempotent: a re-run clears and writes the same matrices.
 */
export function bindMeshesToSkeletons(nodes: TscnNode[]): TscnNode[] {
  const nodeByPath = nodesByPath(nodes);
  const skinOf = new Map<TscnNode, Transform3D[]>();
  let uniquePaths: Map<string, string> | undefined;
  for (const [path, mesh] of nodeByPath) {
    if (mesh.type !== 'MeshInstance3D') continue;
    const properties = mesh.properties as MeshInstance3DProperties;
    delete properties.skinMatrices;
    if (properties.skin !== undefined || properties.skeleton === undefined) continue;
    uniquePaths ??= uniqueNamePaths(nodes);
    const targetPath = resolveNodePathLiteral(path, properties.skeleton, uniquePaths);
    const skeleton = targetPath === null ? undefined : nodeByPath.get(targetPath);
    if (skeleton?.type !== 'Skeleton3D') continue;
    let skin = skinOf.get(skeleton);
    if (!skin) {
      skin = automaticSkin(skeleton);
      skinOf.set(skeleton, skin);
    }
    properties.skinMatrices = skin;
  }
  return nodes;
}

function automaticSkin(skeleton: TscnNode): Transform3D[] {
  const { bones, showRestOnly } = skeleton.properties as Skeleton3DProperties;
  return poseSkeleton(bones, showRestOnly).automaticSkinMatrices;
}
