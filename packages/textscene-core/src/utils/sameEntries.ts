/** Whether two maps hold the same keys, with the same values compared with `===`. */
export function sameEntries<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of b) {
    if (!a.has(key) || a.get(key) !== value) return false;
  }
  return true;
}
