/** A cache bounded to the keys read most recently. */

/**
 * A reader that builds the value of a key on its first read and keeps the values of the `max` keys
 * read most recently. A read moves its key to the newest place, so the key dropped at the cap is
 * the one read least recently. An animation through many keys then cannot drop a key still in use.
 *
 * @canonical A cache bounded to its most recently read keys
 *   For a key that an animation can step through without end, such as a font size or axis value.
 */
export function recentlyRead<K, V>(max: number): (key: K, build: (key: K) => V) => V {
  const kept = new Map<K, V>();
  /** Written only by the reader, on each read that moves a key to the newest place. */
  let newestKey: K | undefined;
  return (key, build) => {
    const found = kept.get(key);
    // `get` first: `has` runs only for a value of `undefined`, so a hit costs one lookup.
    const isKept = found !== undefined || kept.has(key);
    // A read of the newest key leaves the order as it is, so it skips the delete and the insert.
    if (isKept && key === newestKey) return found as V;
    const value = isKept ? (found as V) : build(key);
    if (isKept) kept.delete(key);
    else if (kept.size >= max) kept.delete(kept.keys().next().value!);
    kept.set(key, value);
    newestKey = key;
    return value;
  };
}
