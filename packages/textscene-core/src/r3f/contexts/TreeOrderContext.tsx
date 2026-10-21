/**
 * Each node's place in Godot's tree order, the pre-order walk in which nodes enter the tree. A
 * sub-scene that loads late still takes its place, which React's mount order cannot give.
 */

import { createContext, useContext, type ReactNode } from 'react';

/** The child index at each level from the scene root. Lexicographic order is tree order. */
export type TreeOrder = readonly number[];

const SCENE_ROOT: TreeOrder = Object.freeze([]);

const TreeOrderContext = createContext<TreeOrder>(SCENE_ROOT);
TreeOrderContext.displayName = 'TreeOrderContext';

export function TreeOrderProvider({ order, children }: { order: TreeOrder; children: ReactNode }) {
  return <TreeOrderContext.Provider value={order}>{children}</TreeOrderContext.Provider>;
}

/** The enclosing node's place in tree order. Outside the dispatcher, every node ties at the root. */
export function useTreeOrder(): TreeOrder {
  return useContext(TreeOrderContext);
}

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
