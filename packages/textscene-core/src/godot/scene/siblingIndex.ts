/**
 * Where a node lands among its parent's children when the loader adds it: at the end, then moved to
 * its `index=` unless that is the last place or none (`packed_scene.cpp:541-544`).
 */

/** Adds `node` to `siblings` in place, so the caller owns the array. */
export function insertAtIndex<T extends { index?: number }>(siblings: T[], node: T): void {
  const { index } = node;
  if (index === undefined || index < 0 || index >= siblings.length) siblings.push(node);
  else siblings.splice(index, 0, node);
}

/** `siblings` with `node` added, as a new array: the siblings may be a shared cache entry. */
export function addAtIndex<T extends { index?: number }>(siblings: readonly T[], node: T): T[] {
  const placed = [...siblings];
  insertAtIndex(placed, node);
  return placed;
}
