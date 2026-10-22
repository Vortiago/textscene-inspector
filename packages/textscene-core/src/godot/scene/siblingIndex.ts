/**
 * Where a node lands among its parent's children when the loader adds it: at the end, then moved to
 * its `index=` unless that is the last place or none (`packed_scene.cpp:541-544`).
 */

/** `siblings` with `node` added, as a new array: the siblings may be a shared cache entry. */
export function addAtIndex<T extends { index?: number }>(siblings: readonly T[], node: T): T[] {
  const { index } = node;
  const lastPlace = siblings.length;
  if (index === undefined || index < 0 || index >= lastPlace) return [...siblings, node];
  return [...siblings.slice(0, index), node, ...siblings.slice(index)];
}
