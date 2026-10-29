/**
 * Addresses a node of a Live tree by its name path or its child-index path, and replaces it as a
 * copy along that spine that shares every other node.
 */

import type { LiveNode } from './liveNode';

/** The node at `path` below the sub-scene root, or undefined where none sits there. */
export function nodeAt(tree: readonly LiveNode[], path: readonly string[]): LiveNode | undefined {
  let siblings = tree;
  let found: LiveNode | undefined;
  for (const name of path) {
    found = siblings.find((n) => n.name === name);
    if (!found) return undefined;
    siblings = found.children;
  }
  return found;
}

/**
 * `tree` with the node at `path` swapped for what `replace` returns for it, as a copy along that
 * spine that shares every other node. The caller passes a path that names a node.
 *
 * @canonical A Live tree with the node at a name path replaced
 */
export function replacedAt(
  tree: readonly LiveNode[],
  path: readonly string[],
  replace: (node: LiveNode) => LiveNode
): LiveNode[] {
  return replacedAtIndices(tree, indicesOf(tree, path), replace);
}

/**
 * `tree` with the node at `indices`, each a child index below the last, swapped for what `replace`
 * returns for it, as a copy along that spine that shares every other node.
 *
 * @canonical A Live tree with the node at an index path replaced
 */
export function replacedAtIndices(
  tree: readonly LiveNode[],
  indices: readonly number[],
  replace: (node: LiveNode) => LiveNode
): LiveNode[] {
  const replacedBelow = (siblings: readonly LiveNode[], depth: number): LiveNode[] => {
    const index = indices[depth]!;
    const target = siblings[index]!;
    const copy = [...siblings];
    copy[index] =
      depth === indices.length - 1
        ? replace(target)
        : { ...target, children: replacedBelow(target.children, depth + 1) };
    return copy;
  };
  return replacedBelow(tree, 0);
}

/** The child indices of the node at the name path `path`, each below the last. */
function indicesOf(tree: readonly LiveNode[], path: readonly string[]): number[] {
  let siblings = tree;
  return path.map((name) => {
    const index = siblings.findIndex((n) => n.name === name);
    if (index === -1) throw new Error(`expected a node at "${path.join('/')}", found none named "${name}"`);
    siblings = siblings[index]!.children;
    return index;
  });
}

/**
 * The child indices of the first node of `tree`, parents before children, that `isTarget` picks,
 * or undefined where none is picked.
 *
 * @canonical The index path of the first node of a Live tree that a test picks
 */
export function indicesWhere(
  tree: readonly LiveNode[],
  isTarget: (node: LiveNode) => boolean
): number[] | undefined {
  for (const [index, node] of tree.entries()) {
    if (isTarget(node)) return [index];
    const below = indicesWhere(node.children, isTarget);
    if (below) return [index, ...below];
  }
  return undefined;
}
