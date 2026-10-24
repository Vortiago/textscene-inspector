/** A value built once for each key object, made on the first ask for that key. */

export interface PerObjectOptions<K extends object> {
  /**
   * A number that tells when a key's value is stale, read on each ask. The value builds again when
   * the stamp differs from the one it was built under, as with a texture's `version`.
   */
  stamp: (key: K) => number;
}

interface Built<T> {
  stamp: number;
  value: T;
}

/**
 * A reader that builds its value once for each key it is called with. The key is the object's
 * identity, so the caller keeps a key unchanged for as long as its value holds, or gives a `stamp`
 * that moves when it stops holding. The WeakMap lets an entry be collected with its key. A build
 * that throws stores nothing, so the next ask builds again.
 */
export function perObject<K extends object, T>(
  build: (key: K) => T,
  { stamp = () => 0 }: Partial<PerObjectOptions<K>> = {}
): (key: K) => T {
  const built = new WeakMap<K, Built<T>>();
  return (key) => {
    const current = stamp(key);
    const stored = built.get(key);
    if (stored?.stamp === current) return stored.value;
    const value = build(key);
    built.set(key, { stamp: current, value });
    return value;
  };
}
