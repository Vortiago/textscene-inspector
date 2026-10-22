/** Copy-on-change updates to a set of keys held in React state. */

/** `keys` with `key` added. The same set when it is already there, so no consumer re-renders. */
export function withKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (keys.has(key)) return keys;
  const next = new Set(keys);
  next.add(key);
  return next;
}

/** `keys` without `key`. The same set when it is not there, so no consumer re-renders. */
export function withoutKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (!keys.has(key)) return keys;
  const next = new Set(keys);
  next.delete(key);
  return next;
}
