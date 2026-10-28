/**
 * The `%Name` table a NodePath on a live node reads, which every reader that resolves a NodePath
 * from the live tree shares.
 */

import type { TscnNode } from '../parser/types.js';
import type { LiveTreeContext } from './liveSceneTree.js';
import { claimOwnerOf, localSceneOf, localSceneUniquePaths, ownerUniquePaths } from './uniqueNameOwner.js';

/**
 * The `%Name` table a NodePath on the node at `path` reads: the node's own table where it is an
 * instance root, then its owner's, name by name (node.cpp:1930-1938). Without a path, the outer
 * root's table.
 *
 * @canonical The %Name table a NodePath on a live node reads
 */
export function nodePathUniquePaths(
  path: string | null,
  roots: readonly TscnNode[],
  ctx: LiveTreeContext
): ReadonlyMap<string, string> {
  const nodePath = path || (roots[0]?.name ?? '');
  // An instance root is the local scene of its own path, and the owner of the names inside it.
  const scene = localSceneOf(nodePath, roots, ctx);
  return scene.path === nodePath
    ? localSceneUniquePaths(scene)
    : ownerUniquePaths(claimOwnerOf(nodePath, roots, ctx));
}
