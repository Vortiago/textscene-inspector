/** Small shared helpers for node-type semantic linters. */

import type { TscnNode } from '../parser/types.js';

/**
 * Narrow a node's `properties` to a string-keyed record before reading raw
 * values in a semantic rule. Was duplicated verbatim in every node-type
 * `linter.ts` (architecture review S-2).
 */
export function isValidProperties(props: unknown): props is Record<string, string> {
  return typeof props === 'object' && props !== null;
}

/**
 * Find the parent of `target` in the node tree, or null when it is a root (no
 * parent) or absent. Shared by the linters that validate parent type — e.g.
 * CollisionShape2D/3D (must sit under a physics body) and PathFollow2D/3D (must
 * sit under a Path2D/Path3D).
 */
export function findParentNode(
  nodes: TscnNode[],
  target: TscnNode,
  parent: TscnNode | null = null
): TscnNode | null {
  for (const node of nodes) {
    if (node === target) return parent;
    const found = findParentNode(node.children, target, node);
    if (found !== null) return found;
  }
  return null;
}
