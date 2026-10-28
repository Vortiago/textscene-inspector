/**
 * The global transform of a Node3D of the Live scene tree, read from the transforms of the nodes on
 * the way down to it, so it holds across an instance border.
 */

import type { TscnNode } from '../parser/types.js';
import type { Transform3D } from '../godot/math/transform3d.js';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import type { LiveTree } from './liveSceneTree.js';
import { NO_PATCHES, patchedNode, type NodePatches } from './nodePatch.js';
import { globalMatrix3D, matrixToTransform3D } from './nodeTreeTransforms.js';

/**
 * The global transform of the Node3D at the live path `path`, or null where the path names no node
 * or a node that is not a Node3D. `placed` holds what a pass has moved so far, which the walk reads
 * in place of the node's own transform.
 */
export function liveGlobalTransform3D(
  tree: LiveTree,
  path: string,
  placed: NodePatches = NO_PATCHES
): Transform3D | null {
  const target = tree.at(path)?.step.node;
  if (!target || !descendsFromClass(target.type, 'Node3D')) return null;
  return matrixToTransform3D(globalMatrix3D(path, nodesOnTheWayTo(tree, path, placed)));
}

/** The node at each prefix of `path`, by prefix, each with the patch `placed` holds for it. */
export function nodesOnTheWayTo(tree: LiveTree, path: string, placed: NodePatches): Map<string, TscnNode> {
  const nodes = new Map<string, TscnNode>();
  let prefix = '';
  for (const name of path.split('/')) {
    prefix = prefix ? `${prefix}/${name}` : name;
    const node = tree.at(prefix)?.step.node;
    if (node) nodes.set(prefix, patchedNode(node as TscnNode, placed.get(prefix)));
  }
  return nodes;
}
