/**
 * Godot's tree order as plain data: each node's place in the pre-order walk in which nodes enter
 * the tree, and the comparisons on it. Free of React, so a pure module can sort by it.
 */

/** The child index at each level from the scene root. Lexicographic order is tree order. */
export type TreeOrder = readonly number[];

/** The orders of `count` children of the node at `parent`. */
export function childOrders(parent: TreeOrder, count: number): TreeOrder[] {
  return Array.from({ length: count }, (_, i) => [...parent, i]);
}

/** Negative when `a` enters the tree before `b`, zero for one place. An ancestor comes first. */
export function compareTreeOrder(a: TreeOrder, b: TreeOrder): number {
  return siblingOrder(a, b) || a.length - b.length;
}

/**
 * Negative when `a` is notified `NOTIFICATION_POST_ENTER_TREE` before `b`, zero for one place.
 * `_propagate_ready` notifies a node after all its children (`node.cpp:316-326`), so a descendant
 * comes first.
 */
export function compareReadyOrder(a: TreeOrder, b: TreeOrder): number {
  return siblingOrder(a, b) || b.length - a.length;
}

/** The order of the siblings at the first level where `a` and `b` part, or 0 when one holds the other. */
function siblingOrder(a: TreeOrder, b: TreeOrder): number {
  const shared = Math.min(a.length, b.length);
  for (let level = 0; level < shared; level++) {
    if (a[level] !== b[level]) return a[level]! - b[level]!;
  }
  return 0;
}
