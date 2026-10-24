/** A value built once for each key object, made on the first ask for that key. */

/**
 * A reader that builds its value once for each key it is called with. The key is the object's
 * identity, so the caller keeps a key unchanged for as long as its value holds. The WeakMap lets
 * an entry be collected with its key. A build that throws stores nothing, so the next ask builds again.
 */
export function perObject<K extends object, T>(build: (key: K) => T): (key: K) => T {
  const built = new WeakMap<K, T>();
  return (key) => {
    // `has` only on a miss: a build may return undefined, and that is a value too.
    const value = built.get(key);
    if (value !== undefined || built.has(key)) return value as T;
    const fresh = build(key);
    built.set(key, fresh);
    return fresh;
  };
}
