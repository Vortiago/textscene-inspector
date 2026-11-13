/** Whether two maps hold the same keys, with the same values by `equal`, which defaults to `===`. */
export function sameEntries<K, V>(
  a: ReadonlyMap<K, V>,
  b: ReadonlyMap<K, V>,
  equal: (x: V, y: V) => boolean = (x, y) => x === y
): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of b) {
    if (!a.has(key) || !equal(a.get(key)!, value)) return false;
  }
  return true;
}
