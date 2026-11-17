/**
 * @canonical Copy-on-write set of one map entry
 *   The same map when nothing changes, so a state setter that returns it renders nothing.
 */
export function withEntry<K, V>(map: ReadonlyMap<K, V>, key: K, value: V | undefined): ReadonlyMap<K, V> {
  if (map.get(key) === value) return map;
  const next = new Map(map);
  if (value === undefined) next.delete(key);
  else next.set(key, value);
  return next;
}
