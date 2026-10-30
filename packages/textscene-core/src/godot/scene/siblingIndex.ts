/**
 * Where a node lands among its parent's children when the loader adds it: at the end, then moved to
 * its `index=` unless that is the last place or none (`packed_scene.cpp:541-544`).
 */

/** Adds `node` to `siblings` in place, so the caller owns the array. A sibling may state no index. */
export function insertAtIndex<T>(siblings: T[], node: T & { index?: number }): void {
  const { index } = node;
  if (index === undefined || index < 0 || index >= siblings.length) siblings.push(node);
  else siblings.splice(index, 0, node);
}

/**
 * `siblings` with `nodes` added in turn, as a new array: the siblings may be a shared cache entry,
 * such as the frozen objects of a GLB.
 */
export function addAtIndex<T extends { index?: number }>(siblings: readonly T[], ...nodes: T[]): T[] {
  const placed = [...siblings];
  for (const node of nodes) insertAtIndex(placed, node);
  return placed;
}
